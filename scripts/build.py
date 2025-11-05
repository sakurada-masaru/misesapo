#!/usr/bin/env python3
"""
Simple HTML builder that supports only @include directives (Laravel-like) for static mocks.

Supported directive:
- @include('partials.header')  # ドット表記をパスに変換

Search roots for includes:
- src (absolute path under src)
- src/partials (デフォルトのパーシャル置き場)
- src/layouts（必要ならレイアウト断片も @include で組み合わせる）

Input → Output:
- Reads: src/pages/**/*.html
- Writes: public/**/*.html (same relative path)

Exit codes:
- 0 on success
- 1 on any build error
"""

from __future__ import annotations

import re
import json
import csv
import sys
import os
from dataclasses import dataclass
from pathlib import Path
import shutil
from typing import Dict, List, Optional, Tuple


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
PAGES_DIR = SRC / "pages"
PARTIALS_DIR = SRC / "partials"
LAYOUTS_DIR = SRC / "layouts"
PUBLIC = ROOT / "public"
ASSETS_DIR = SRC / "assets"


RE_INCLUDE = re.compile(r"@include\(['\"](.*?)['\"]\)")
# @layout('layouts.base')
RE_LAYOUT = re.compile(r"@layout\(\s*['\"](.*?)['\"]\s*\)")
# @json('path/to/data.json', $var) or @json('path/to/data.json', var)
RE_JSON = re.compile(r"@json\(\s*['\"](.*?)['\"]\s*(?:,\s*\$?([A-Za-z_][A-Za-z0-9_]*))?\s*\)")
# @foreach $var ... @endforeach  (also supports @foreach($var))
RE_FOREACH = re.compile(
    r"@foreach(?:\s*\(\s*)?\$?([A-Za-z_][A-Za-z0-9_]*)\s*(?:\)\s*)?(.*?)@endforeach",
    re.DOTALL,
)
# {{ key }} placeholder replacement inside foreach blocks
RE_PLACEHOLDER = re.compile(r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}")
## @jsonvar $var  → inline JSON string of a context variable
RE_JSONVAR = re.compile(r"@jsonvar\s+\$?([A-Za-z_][A-Za-z0-9_]*)")


class BuildError(Exception):
    pass


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise BuildError(f"File not found: {path}")


def dot_to_path(name: str) -> Path:
    # Prevent directory traversal
    if ".." in name:
        raise BuildError(f"Illegal template name (..): {name}")
    rel = name.replace(".", "/").lstrip("/")
    return Path(rel + ".html") if not rel.endswith(".html") else Path(rel)


def resolve_include(name: str) -> Path:
    rel = dot_to_path(name)
    # Try absolute within src
    candidates = [
        SRC / rel,  # explicit path under src
        PARTIALS_DIR / rel,  # default to partials
        LAYOUTS_DIR / rel,
    ]
    for c in candidates:
        if c.exists():
            return c
    raise BuildError(f"@include target not found: {name} (tried: {', '.join(str(c) for c in candidates)})")


def render_includes(text: str, depth: int = 0, max_depth: int = 20) -> str:
    if depth > max_depth:
        raise BuildError("Include depth exceeded (possible recursion loop)")

    def _sub(m: re.Match) -> str:
        name = m.group(1).strip()
        path = resolve_include(name)
        content = read_text(path)
        # Recurse for nested includes
        return render_includes(content, depth + 1, max_depth)

    while True:
        new = RE_INCLUDE.sub(_sub, text)
        if new == text:
            return new
        text = new


def resolve_data_path(raw: str) -> Path:
    # Support dot or slash, default under src/ if relative
    p = raw.strip()
    if ".." in p:
        raise BuildError(f"Illegal data path (..): {raw}")
    # dot to path
    if "." in p and "/" not in p:
        p = p.replace(".", "/")
    path = Path(p)
    if not path.is_absolute():
        # Prefer src/data then src root
        candidates = [SRC / "data" / path, SRC / path]
        for c in candidates:
            if c.exists():
                return c
        # fallback
        return SRC / path
    return path


def apply_placeholders(fragment: str, context: Dict[str, str]) -> str:
    def _sub(m: re.Match) -> str:
        key = m.group(1)
        val = context.get(key, "")
        return str(val)

    return RE_PLACEHOLDER.sub(_sub, fragment)


def render_foreach_blocks(text: str, context: Dict[str, object]) -> str:
    # Simple scanner to support @foreach $var ... @endforeach (non-nested)
    safety = 0
    while True:
        safety += 1
        if safety > 1000:
            raise BuildError("Too many @foreach expansions (possible loop)")

        start = text.find("@foreach")
        if start == -1:
            return text

        # Parse header directly from this position
        rest = text[start:]
        m_head = re.match(r"@foreach(?:\s*\(\s*)?\s*\$?([A-Za-z_][A-Za-z0-9_]*)", rest)
        if not m_head:
            raise BuildError("Malformed @foreach header. Use @foreach $var or @foreach($var)")
        var = m_head.group(1)
        head_len = m_head.end()

        end = text.find("@endforeach", start + head_len)
        if end == -1:
            raise BuildError("Missing @endforeach for @foreach block")

        body = text[start + head_len:end]

        data = context.get(var)
        if data is None:
            raise BuildError(f"@foreach references undefined variable: ${var}")
        if not isinstance(data, list):
            raise BuildError(f"@foreach expects list for ${var}, got: {type(data).__name__}")

        parts: List[str] = []
        for idx, item in enumerate(data, start=1):
            if isinstance(item, dict):
                item_ctx = {k: v for k, v in item.items()}
            else:
                item_ctx = {"value": item}
            item_ctx["index"] = idx
            rendered = apply_placeholders(body, item_ctx)
            parts.append(rendered)

        text = text[:start] + "".join(parts) + text[end + len("@endforeach"):]


def process_json_directives(text: str, context: Dict[str, object]) -> str:
    # Iterate all json directives and load data into context
    def _sub(m: re.Match) -> str:
        raw_path = m.group(1)
        var = m.group(2)
        path = resolve_data_path(raw_path)
        try:
            data = json.loads(read_text(path))
        except json.JSONDecodeError as e:
            raise BuildError(f"Invalid JSON in {path}: {e}")
        if var is None or not var:
            # derive from filename
            name = path.stem
            var_name = name
        else:
            var_name = var
        context[var_name] = data
        return ""  # directive removed

    return RE_JSON.sub(_sub, text)


def process_jsonvar_directives(text: str, context: Dict[str, object]) -> str:
    def _sub(m: re.Match) -> str:
        var = m.group(1)
        if var not in context:
            raise BuildError(f"@jsonvar references undefined variable: ${var}")
        try:
            return json.dumps(context[var], ensure_ascii=False)
        except Exception as e:
            raise BuildError(f"Failed to serialize ${var} to JSON: {e}")

    return RE_JSONVAR.sub(_sub, text)
def get_base_path() -> str:
    """Get base path for GitHub Pages or local development."""
    # Check if running in GitHub Actions (GitHub Pages)
    github_repository = os.environ.get("GITHUB_REPOSITORY")
    if github_repository:
        # Extract repository name from GITHUB_REPOSITORY (e.g., "sakurada-masaru/misesapo" -> "misesapo")
        repo_name = github_repository.split("/")[1] if "/" in github_repository else github_repository
        return f"/{repo_name}/"
    # Local development
    return "/"

def render_page(path: Path, preset_context: Optional[Dict[str, object]] = None) -> str:
    raw = read_text(path)
    # 0) detect optional layout directive (single, top-most)
    m_layout = RE_LAYOUT.search(raw)
    layout_path: Optional[Path] = None
    if m_layout:
        name = m_layout.group(1).strip()
        layout_path = resolve_include(name)
        # remove layout directive from source before includes
        raw = RE_LAYOUT.sub("", raw, count=1)

    # 1) resolve includes first
    text = render_includes(raw)

    # 2) process json + foreach with a simple context
    context: Dict[str, object] = {}
    if preset_context:
        context.update(preset_context)
    # Add base_path to context
    context["base_path"] = get_base_path()
    text = process_json_directives(text, context)
    text = render_foreach_blocks(text, context)
    text = process_jsonvar_directives(text, context)

    # 2.5) if layout specified, render layout and inject page content into {{ content }}
    if layout_path is not None:
        layout_html = read_text(layout_path)
        layout_html = render_includes(layout_html)
        # naive replace of {{ content }} with page body
        layout_html = layout_html.replace("{{ content }}", text)
        text = layout_html

    # 3) final placeholder pass (top-level replacements)
    text = apply_placeholders(text, {k: v for k, v in context.items() if isinstance(v, (str, int, float))})
    
    # 4) Fix absolute paths for GitHub Pages (replace /path with /repo/path if base_path is not /)
    base_path = context.get("base_path", "/")
    if base_path != "/":
        base_prefix = base_path.rstrip("/")
        # Protect base tag from replacement - must match exact base_path value
        base_tag_pattern = rf'<base\s+href=["\']{re.escape(base_path)}["\']\s*/>'
        base_match = re.search(base_tag_pattern, text)
        if base_match:
            # Temporarily replace with placeholder that won't match our regex
            text = text.replace(base_match.group(0), "___BASE_TAG_PLACEHOLDER___")
        
        # Replace absolute paths in href, src, url attributes
        # But preserve external URLs (http://, https://, //)
        text = re.sub(r'(href|src|url)\s*=\s*["\'](/[^"\']*)["\']', 
                     lambda m: f'{m.group(1)}="{base_prefix}{m.group(2)}"',
                     text)
        # Replace absolute paths in srcset attribute (handles multiple URLs)
        def fix_srcset(match):
            srcset_content = match.group(1)
            # Replace /path with /repo/path in srcset
            fixed = re.sub(r'/([^\s,]+)', rf'{base_prefix}/\1', srcset_content)
            return f'srcset="{fixed}"'
        text = re.sub(r'srcset\s*=\s*["\']([^"\']*)["\']', fix_srcset, text)
        # Also handle CSS url() syntax
        text = re.sub(r'url\(["\']?/([^"\']*)["\']?\)', 
                     lambda m: f'url("{base_prefix}/{m.group(1)}")',
                     text)
        
        # Restore original base tag
        if base_match:
            text = text.replace("___BASE_TAG_PLACEHOLDER___", f'<base href="{base_path}" />')
    
    return text


def _build_report_detail_pages(template: Path, outputs: List[str]) -> None:
    """Generate pages/reports/{id}.html from cleaning_reports.json and the template [id].html."""
    data_path = SRC / "data" / "cleaning_reports.json"
    try:
        data = json.loads(read_text(data_path))
    except Exception as e:
        raise BuildError(f"Failed to load cleaning reports data: {e}")
    reports = data.get("reports") or []
    if not isinstance(reports, list):
        raise BuildError("cleaning_reports.json: 'reports' must be a list")

    for idx, rep in enumerate(reports):
        rid = rep.get("id")
        if rid is None:
            continue
        # Prepare context
        detail = rep.get("detail") or []
        enriched: List[Dict[str, object]] = []
        for item in detail:
            if not isinstance(item, dict):
                continue
            desc = str(item.get("description") or "")
            tokens = [t for t in desc.replace("、", " ").replace(",", " ").split() if t]
            tags_html = "".join([f"<span class=\"detail-tag\">{t}</span>" for t in tokens])
            images = item.get("images") or []
            before_img = images[0] if len(images) > 0 else "/images/service-300x200.svg"
            after_img = images[1] if len(images) > 1 else "/images/service-300x200.svg"
            enriched.append({
                "cleaning_item": item.get("cleaning_item", ""),
                "work_content": item.get("work_content", ""),
                "work_memo": item.get("work_memo", ""),
                "tags_html": tags_html,
                "before_image": before_img,
                "after_image": after_img,
            })

        # prev/next helpers
        prev_id = None
        next_id = None
        # find previous valid id
        for j in range(idx - 1, -1, -1):
            _rid = reports[j].get("id")
            if _rid is not None:
                prev_id = _rid
                break
        # find next valid id
        for j in range(idx + 1, len(reports)):
            _rid = reports[j].get("id")
            if _rid is not None:
                next_id = _rid
                break

        ctx = {
            "cleaning_datetime": rep.get("cleaning_datetime", ""),
            # list for foreach blocks
            "cleaning_content": rep.get("cleaning_content") or [],
            "detail": enriched,
            # navigation
            "prev_href": f"/reports/{prev_id}.html" if prev_id is not None else "",
            "next_href": f"/reports/{next_id}.html" if next_id is not None else "",
            "prev_class": "report-nav-btn" + (" disabled" if prev_id is None else ""),
            "next_class": "report-nav-btn" + (" disabled" if next_id is None else ""),
        }

        out_path = PUBLIC / "reports" / f"{rid}.html"
        html = render_page(template, ctx)
        ensure_dir(out_path)
        # overwrite cleanly to avoid any potential residual content
        try:
            if out_path.exists():
                out_path.unlink()
        except Exception:
            pass
        out_path.write_text(html, encoding="utf-8")
        outputs.append(str(out_path))


def ensure_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def convert_csv_to_json(csv_path: Path, json_path: Path) -> None:
    """Convert clients.csv to clients.json."""
    if not csv_path.exists():
        return
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            # Skip to actual header (line 70, index 69)
            for _ in range(69):
                try:
                    next(reader)
                except StopIteration:
                    return
            
            # Read actual header
            header = next(reader)
            # Clean header: remove empty columns
            header = [h.strip() if h else f'col_{i}' for i, h in enumerate(header)]
            
            clients = []
            for row in reader:
                if not row or not any(row):  # Skip empty rows
                    continue
                
                # Map columns based on actual structure
                # Column mapping from CSV: 
                # 0=会社名, 1=企業・ブランド名, 2=店舗名, 3=担当者名, 4=メール, 
                # 6=営業担当, 7=店舗数, 8=ステータス, 9=メモ, 
                # 12=日付, 13=URL, 14=清掃頻度
                client = {
                    'company_name': row[0] if len(row) > 0 else '',
                    'company_name_kana': '',
                    'brand_name': row[1] if len(row) > 1 else '',
                    'store_name': row[2] if len(row) > 2 else '',
                    'contact_person': row[3] if len(row) > 3 else '',
                    'email': row[4] if len(row) > 4 else '',
                    'sales_rep': row[6] if len(row) > 6 else '',
                    'store_count': row[7] if len(row) > 7 else '',
                    'status': row[8] if len(row) > 8 else '',
                    'notes': row[9] if len(row) > 9 else '',
                    'next_date': row[12] if len(row) > 12 else '',
                    'url': row[13] if len(row) > 13 else '',
                    'cleaning_frequency': row[14] if len(row) > 14 else '',
                }
                
                # Clean empty values
                client = {k: v.strip() if v else '' for k, v in client.items()}
                
                # Generate UUID-like ID
                import hashlib
                id_str = f"{client['company_name']}_{client['store_name']}_{client['contact_person']}"
                client['id'] = hashlib.md5(id_str.encode('utf-8')).hexdigest()[:8]
                
                clients.append(client)
        
        # Write JSON
        json_data = {'clients': clients, 'total': len(clients)}
        ensure_dir(json_path)
        json_path.write_text(json.dumps(json_data, ensure_ascii=False, indent=2), encoding='utf-8')
        
    except Exception as e:
        raise BuildError(f"Failed to convert CSV to JSON: {e}")


def copy_assets(outputs: List[str]) -> None:
    if not ASSETS_DIR.exists():
        return
    for src_path in ASSETS_DIR.rglob("*"):
        if src_path.is_dir():
            continue
        # mirror under public/ stripping the leading 'assets/'
        rel = src_path.relative_to(ASSETS_DIR)
        dst_path = PUBLIC / rel
        ensure_dir(dst_path)
        shutil.copy2(src_path, dst_path)
        outputs.append(str(dst_path))


def _build_client_detail_pages(template: Path, outputs: List[str]) -> None:
    """Generate pages/sales/clients/{id}.html from clients.json and the template [id].html."""
    data_path = SRC / "data" / "clients.json"
    try:
        data = json.loads(read_text(data_path))
    except Exception as e:
        raise BuildError(f"Failed to load clients data: {e}")
    clients = data.get("clients") or []
    if not isinstance(clients, list):
        raise BuildError("clients.json: 'clients' must be a list")

    for idx, client in enumerate(clients):
        cid = client.get("id")
        if cid is None:
            continue
        
        # prev/next helpers
        prev_id = None
        next_id = None
        # find previous valid id
        for j in range(idx - 1, -1, -1):
            _cid = clients[j].get("id")
            if _cid is not None:
                prev_id = _cid
                break
        # find next valid id
        for j in range(idx + 1, len(clients)):
            _cid = clients[j].get("id")
            if _cid is not None:
                next_id = _cid
                break

        # Prepare context with all client fields
        ctx = {
            "id": cid,
            "company_name": client.get("company_name", ""),
            "company_name_kana": client.get("company_name_kana", ""),
            "brand_name": client.get("brand_name", ""),
            "store_name": client.get("store_name", ""),
            "contact_person": client.get("contact_person", ""),
            "email": client.get("email", ""),
            "sales_rep": client.get("sales_rep", ""),
            "store_count": client.get("store_count", ""),
            "status": client.get("status", ""),
            "notes": client.get("notes", ""),
            "next_date": client.get("next_date", ""),
            "url": client.get("url", ""),
            "cleaning_frequency": client.get("cleaning_frequency", ""),
            # navigation
            "prev_href": f"/sales/clients/{prev_id}.html" if prev_id is not None else "",
            "next_href": f"/sales/clients/{next_id}.html" if next_id is not None else "",
            "prev_class": "client-nav-btn" + (" disabled" if prev_id is None else ""),
            "next_class": "client-nav-btn" + (" disabled" if next_id is None else ""),
        }

        out_path = PUBLIC / "sales" / "clients" / f"{cid}.html"
        html = render_page(template, ctx)
        ensure_dir(out_path)
        # overwrite cleanly to avoid any potential residual content
        try:
            if out_path.exists():
                out_path.unlink()
        except Exception:
            pass
        out_path.write_text(html, encoding="utf-8")
        outputs.append(str(out_path))


def _build_client_edit_pages(template: Path, outputs: List[str]) -> None:
    """Generate pages/sales/clients/{id}/edit.html from clients.json and the template [id]/edit.html."""
    data_path = SRC / "data" / "clients.json"
    try:
        data = json.loads(read_text(data_path))
    except Exception as e:
        raise BuildError(f"Failed to load clients data: {e}")
    clients = data.get("clients") or []
    if not isinstance(clients, list):
        raise BuildError("clients.json: 'clients' must be a list")

    for client in clients:
        cid = client.get("id")
        if cid is None:
            continue

        # Prepare context with all client fields
        ctx = {
            "id": cid,
            "company_name": client.get("company_name", ""),
            "company_name_kana": client.get("company_name_kana", ""),
            "brand_name": client.get("brand_name", ""),
            "store_name": client.get("store_name", ""),
            "contact_person": client.get("contact_person", ""),
            "email": client.get("email", ""),
            "sales_rep": client.get("sales_rep", ""),
            "store_count": client.get("store_count", ""),
            "status": client.get("status", ""),
            "notes": client.get("notes", ""),
            "next_date": client.get("next_date", ""),
            "url": client.get("url", ""),
            "cleaning_frequency": client.get("cleaning_frequency", ""),
        }

        out_path = PUBLIC / "sales" / "clients" / cid / "edit.html"
        html = render_page(template, ctx)
        ensure_dir(out_path)
        # overwrite cleanly to avoid any potential residual content
        try:
            if out_path.exists():
                out_path.unlink()
        except Exception:
            pass
        out_path.write_text(html, encoding="utf-8")
        outputs.append(str(out_path))


def build_all() -> List[str]:
    if not PAGES_DIR.exists():
        raise BuildError(f"Missing input directory: {PAGES_DIR}")
    
    # Convert CSV to JSON before building pages
    csv_path = SRC / "data" / "clients.csv"
    json_path = SRC / "data" / "clients.json"
    if csv_path.exists():
        convert_csv_to_json(csv_path, json_path)
    
    outputs: List[str] = []
    for page in PAGES_DIR.rglob("*.html"):
        rel = page.relative_to(PAGES_DIR)
        # Special: generate detail pages from reports/[id].html
        if str(rel).startswith("reports/") and rel.name == "[id].html":
            _build_report_detail_pages(page, outputs)
            continue
        # Special: generate detail pages from sales/clients/[id].html
        if str(rel).startswith("sales/clients/") and rel.name == "[id].html":
            _build_client_detail_pages(page, outputs)
            continue
        # Special: generate edit pages from sales/clients/[id]/edit.html
        if str(rel).startswith("sales/clients/") and "edit.html" in str(rel):
            _build_client_edit_pages(page, outputs)
            continue
        out_path = PUBLIC / rel
        html = render_page(page)
        ensure_dir(out_path)
        out_path.write_text(html, encoding="utf-8")
        outputs.append(str(out_path))
    # copy static assets last
    copy_assets(outputs)
    return outputs


def main() -> int:
    try:
        outputs = build_all()
    except BuildError as e:
        print(f"[build:error] {e}")
        return 1
    except Exception as e:
        print(f"[build:exception] {e}")
        return 1

    print("[build] generated files:\n" + "\n".join(outputs))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
