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
PAGES_DIR = SRC / "pages"  # 後方互換性のため保持
PARTIALS_DIR = SRC / "partials"
LAYOUTS_DIR = SRC / "layouts"
PUBLIC = ROOT / "public"
ASSETS_DIR = SRC / "assets"

# 役割分担のディレクトリ構造
CORPORATE_PAGES_DIR = SRC / "corporate" / "pages"  # 部下が担当：コーポレートサイト
CUSTOMER_PAGES_DIR = SRC / "customer" / "pages"     # 部下が担当：お客様ページ
STAFF_PAGES_DIR = SRC / "staff" / "pages"          # ユーザーが担当：清掃員ページ
SALES_PAGES_DIR = SRC / "sales" / "pages"          # ユーザーが担当：営業マンページ
ADMIN_PAGES_DIR = SRC / "admin" / "pages"           # ユーザーが担当：管理ページ
CORPORATE_ASSETS_DIR = SRC / "corporate" / "assets"


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
_base_path_logged = False

def get_base_path() -> str:
    """Get base path for GitHub Pages or local development."""
    global _base_path_logged
    
    # ALWAYS check for custom domain first (CNAME file exists in root OR public)
    # This takes priority over GITHUB_REPOSITORY environment variable
    root_cname = Path(__file__).parent.parent / "CNAME"
    public_cname = Path(__file__).parent.parent / "public" / "CNAME"
    
    if root_cname.exists() or public_cname.exists():
        if not _base_path_logged:
            print("[build] Custom domain (CNAME) detected, using base_path='/'")
            _base_path_logged = True
        return "/"
    
    # Check if running in GitHub Actions without custom domain
    github_repository = os.environ.get("GITHUB_REPOSITORY")
    if github_repository:
        # Extract repository name from GITHUB_REPOSITORY (e.g., "sakurada-masaru/misesapo" -> "misesapo")
        repo_name = github_repository.split("/")[1] if "/" in github_repository else github_repository
        if not _base_path_logged:
            print(f"[build] GitHub Actions detected (no CNAME), using base_path='/{repo_name}/'")
            _base_path_logged = True
        return f"/{repo_name}/"
    
    # Local development
    if not _base_path_logged:
        print("[build] Local development, using base_path='/'")
        _base_path_logged = True
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

    # 2.5) Generate meta tags if meta data exists
    meta_tags_html = ""
    if "meta" in context and isinstance(context["meta"], dict):
        meta = context["meta"]
        meta_tags_html = f'''    <meta name="description" content="{meta.get('description', '')}">
    <meta name="keywords" content="{meta.get('keywords', '')}">
    <meta name="robots" content="index, follow">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="{meta.get('og_url', '')}">
    <meta property="og:title" content="{meta.get('og_title', '')}">
    <meta property="og:description" content="{meta.get('og_description', '')}">
    <meta property="og:image" content="https://misesapo.co.jp/images/logo_144x144.png">
    <meta property="og:site_name" content="ミセサポ">
    <meta property="og:locale" content="ja_JP">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:url" content="{meta.get('og_url', '')}">
    <meta name="twitter:title" content="{meta.get('og_title', '')}">
    <meta name="twitter:description" content="{meta.get('og_description', '')}">
    <meta name="twitter:image" content="https://misesapo.co.jp/images/logo_144x144.png">
    
    <!-- Canonical URL -->
    <link rel="canonical" href="{meta.get('canonical', '')}">
'''
    context["meta_tags"] = meta_tags_html

    # 2.6) if layout specified, render layout and inject page content into {{ content }}
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
        # overwrite cleanly to avoid any potential residual content
        try:
            if out_path.exists():
                out_path.unlink()
        except Exception:
            pass
        write_html_with_directory(out_path, html, outputs, create_dir_structure=False)  # Skip for dynamic pages


def ensure_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def write_html_with_directory(out_path: Path, html: str, outputs: List[str], create_dir_structure: bool = True) -> None:
    """Write HTML file and optionally create directory structure for .html-less URLs."""
    ensure_dir(out_path)
    out_path.write_text(html, encoding="utf-8")
    outputs.append(str(out_path))
    
    # Create directory structure for .html-less URLs (e.g., /staff/mypage -> /staff/mypage/index.html)
    # Skip for dynamic pages (files with [id] in path) and files already in index.html
    if create_dir_structure and "[id]" not in str(out_path) and out_path.name != "index.html":
        dir_name = out_path.stem  # filename without extension
        dir_path = out_path.parent / dir_name
        dir_path.mkdir(parents=True, exist_ok=True)
        index_path = dir_path / "index.html"
        index_path.write_text(html, encoding="utf-8")
        outputs.append(str(index_path))


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
    base_path = get_base_path()
    
    # Include entrance shared JS/CSS directories
    entrance_shared_dir = SRC / "pages" / "entrance" / "shared"
    asset_dirs = [ASSETS_DIR, CORPORATE_ASSETS_DIR, entrance_shared_dir]
    
    for asset_root in asset_dirs:
        if not asset_root.exists():
            continue
            
        for src_path in asset_root.rglob("*"):
            if src_path.is_dir():
                continue
            # mirror under public/ stripping the leading root
            rel = src_path.relative_to(asset_root)
            dst_path = PUBLIC / rel
            ensure_dir(dst_path)
            
            # Process CSS files to fix absolute paths for GitHub Pages
            if src_path.suffix == ".css" and base_path != "/":
                content = read_text(src_path)
                base_prefix = base_path.rstrip("/")
                # Fix CSS url() syntax for absolute paths
                content = re.sub(r'url\(["\']?/([^"\']*)["\']?\)', 
                               lambda m: f'url("{base_prefix}/{m.group(1)}")',
                               content)
                dst_path.write_text(content, encoding="utf-8")
            else:
                # Use copy instead of copy2 to avoid timeout issues with extended attributes
                try:
                    shutil.copy(src_path, dst_path)
                except (OSError, IOError) as e:
                    print(f"[build:error] copy failed for {src_path.name}: {e}")
                    raise
            outputs.append(str(dst_path))
    
    # Copy logo_144x144.png to public/favicon.ico for browser auto-detection
    logo_path = ASSETS_DIR / "images" / "logo_144x144.png"
    if logo_path.exists():
        favicon_path = PUBLIC / "favicon.ico"
        try:
            shutil.copy2(logo_path, favicon_path)
        except (OSError, IOError):
            shutil.copy(logo_path, favicon_path)
        outputs.append(str(favicon_path))

    # Copy manifest.json and CNAME from root to public
    for filename in ["manifest.json", "CNAME"]:
        src_file = ROOT / filename
        if src_file.exists():
            dst_file = PUBLIC / filename
            try:
                shutil.copy2(src_file, dst_file)
            except (OSError, IOError):
                shutil.copy(src_file, dst_file)
            outputs.append(str(dst_file))


def copy_data_files(outputs: List[str]) -> None:
    """Copy JSON files from src/data/ to public/data/ for client-side access"""
    data_dir = SRC / "data"
    if not data_dir.exists():
        return
    
    for src_path in data_dir.rglob("*.json"):
        if src_path.is_dir():
            continue
        # mirror under public/data/ keeping the same structure
        rel = src_path.relative_to(data_dir)
        dst_path = PUBLIC / "data" / rel
        ensure_dir(dst_path)
        shutil.copy2(src_path, dst_path)
        outputs.append(str(dst_path))


def generate_images_list(outputs: List[str]) -> None:
    """Generate images list JSON file for client-side access (GitHub Pages compatible)
    
    Scans only images-public/ directory for the image list page.
    Other directories (images-admin/, images-customer/, images-service/, images-material/) 
    are excluded from the list.
    
    Note: images/ directory is excluded as it's the source directory.
    """
    # 画像一覧ページに表示するディレクトリ（images-public/のみ）
    images_dir = PUBLIC / "images-public"
    
    image_extensions = {'.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'}
    images = []
    
    if images_dir.exists():
        # Scan images-public directory recursively
        for img_path in images_dir.rglob('*'):
            if img_path.is_file() and img_path.suffix.lower() in image_extensions:
                # Get relative path from public/
                rel_path = img_path.relative_to(PUBLIC)
                # Convert to /images-public/... format
                image_path = '/' + str(rel_path).replace('\\', '/')
                images.append({
                    'path': image_path,
                    'name': img_path.name,
                    'size': img_path.stat().st_size,
                    'extension': img_path.suffix.lower()
                })
    
    # Sort by path
    images.sort(key=lambda x: x['path'])
    images_data = {"images": images}
    
    # Write to public/data/images.json
    images_json_path = PUBLIC / "data" / "images.json"
    ensure_dir(images_json_path)
    images_json_path.write_text(json.dumps(images_data, ensure_ascii=False, indent=2), encoding="utf-8")
    outputs.append(str(images_json_path))


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
        # overwrite cleanly to avoid any potential residual content
        try:
            if out_path.exists():
                out_path.unlink()
        except Exception:
            pass
        write_html_with_directory(out_path, html, outputs, create_dir_structure=False)  # Skip for dynamic pages


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
        # overwrite cleanly to avoid any potential residual content
        try:
            if out_path.exists():
                out_path.unlink()
        except Exception:
            pass
        write_html_with_directory(out_path, html, outputs, create_dir_structure=False)  # Skip for dynamic pages


def _build_assignment_detail_pages(template: Path, outputs: List[str]) -> None:
    """Generate pages/staff/assignments/{id}.html from staff_assignments.json and the template [id].html."""
    data_path = SRC / "data" / "staff_assignments.json"
    try:
        data = json.loads(read_text(data_path))
    except Exception as e:
        raise BuildError(f"Failed to load staff assignments data: {e}")
    assignments = data.get("assignments") or []
    if not isinstance(assignments, list):
        raise BuildError("staff_assignments.json: 'assignments' must be a list")

    for assignment in assignments:
        aid = assignment.get("id")
        if aid is None:
            continue

        # Prepare context with all assignment fields
        tasks = assignment.get("tasks") or []
        notes = assignment.get("notes", "")
        
        ctx = {
            "id": str(aid),
            "assignment_date": assignment.get("assignment_date", ""),
            "assignment_time": assignment.get("assignment_time", ""),
            "assignment_status": assignment.get("assignment_status", ""),
            "status_text": assignment.get("status_text", ""),
            "store_name": assignment.get("store_name", ""),
            "store_address": assignment.get("store_address", ""),
            "contact_person": assignment.get("contact_person", ""),
            "contact_phone": assignment.get("contact_phone", ""),
            "tasks": tasks,
            "notes": notes,
            "report_id": str(assignment.get("report_id")) if assignment.get("report_id") else "",
        }

        out_path = PUBLIC / "staff" / "assignments" / f"{aid}.html"
        html = render_page(template, ctx)
        # overwrite cleanly to avoid any potential residual content
        try:
            if out_path.exists():
                out_path.unlink()
        except Exception:
            pass
        write_html_with_directory(out_path, html, outputs, create_dir_structure=False)  # Skip for dynamic pages


def _build_service_pages(template: Path, outputs: List[str]) -> None:
    """Build user-facing service detail pages: service/[id].html"""
    if not template.exists():
        return
    data_path = SRC / "data" / "service_items.json"
    try:
        services = json.loads(read_text(data_path))
    except Exception as e:
        raise BuildError(f"Failed to load service items data: {e}")
    if not isinstance(services, list):
        raise BuildError("service_items.json: must be a list")

    for service in services:
        sid = service.get("id")
        if sid is None:
            continue

        # Prepare context with all service fields
        problems = service.get("problems") or []
        # service_items.jsonのimageフィールドをメイン画像として使用（すべての画面で統一）
        image = service.get("image") or ""
        # detail_imageが空の場合はimageを使用
        detail_image = service.get("detail-image") or service.get("detail_image") or image
        # 新しいsections配列構造に対応（後方互換性のためforms/detailsもサポート）
        sections = service.get("sections") or []
        forms = service.get("forms") or []
        details = service.get("details") or []
        # sectionsが存在しない場合は、forms/detailsを統合してsectionsに変換
        if not sections and (forms or details):
            sections = []
            if forms:
                sections.extend(forms)
            if details:
                sections.extend(details)
        
        ctx = {
            "id": str(sid),
            "title": service.get("title", ""),
            "category": service.get("category", ""),
            "price": service.get("price", ""),
            "image": image,
            "detail_image": detail_image,
            "description": service.get("description", ""),
            "problems": [{"value": p} for p in problems],  # list for foreach blocks
            "solution": service.get("solution", ""),
            "sections": sections,  # 新しいsections配列構造
            "forms": forms,
            "details": details,
        }

        out_path = PUBLIC / "service" / f"{sid}.html"
        html = render_page(template, ctx)
        # overwrite cleanly to avoid any potential residual content
        try:
            if out_path.exists():
                out_path.unlink()
        except Exception:
            pass
        write_html_with_directory(out_path, html, outputs, create_dir_structure=False)  # Skip for dynamic pages

def _build_service_detail_pages(template: Path, outputs: List[str]) -> None:
    """Generate pages/admin/services/{id}.html from service_items.json and the template [id].html."""
    data_path = SRC / "data" / "service_items.json"
    try:
        services = json.loads(read_text(data_path))
    except Exception as e:
        raise BuildError(f"Failed to load service items data: {e}")
    if not isinstance(services, list):
        raise BuildError("service_items.json: must be a list")

    for service in services:
        sid = service.get("id")
        if sid is None:
            continue

        # Prepare context with all service fields
        problems = service.get("problems") or []
        detail_image = service.get("detail-image") or service.get("detail_image") or ""
        image = service.get("image") or ""
        # 新しいsections配列構造に対応（後方互換性のためforms/detailsもサポート）
        sections = service.get("sections") or []
        forms = service.get("forms") or []
        details = service.get("details") or []
        # sectionsが存在しない場合は、forms/detailsを統合してsectionsに変換
        if not sections and (forms or details):
            sections = []
            if forms:
                sections.extend(forms)
            if details:
                sections.extend(details)
        
        ctx = {
            "id": str(sid),
            "title": service.get("title", ""),
            "category": service.get("category", ""),
            "price": service.get("price", ""),
            "image": image,
            "detail_image": detail_image,
            "description": service.get("description", ""),
            "problems": problems,  # list for foreach blocks
            "sections": sections,  # 新しいsections配列構造
            "solution": service.get("solution", ""),
            "forms": forms,
            "details": details,
        }

        out_path = PUBLIC / "admin" / "services" / f"{sid}.html"
        html = render_page(template, ctx)
        # overwrite cleanly to avoid any potential residual content
        try:
            if out_path.exists():
                out_path.unlink()
        except Exception:
            pass
        write_html_with_directory(out_path, html, outputs, create_dir_structure=False)  # Skip for dynamic pages


def _build_service_edit_pages(template: Path, outputs: List[str]) -> None:
    """Generate pages/admin/services/{id}/edit.html from service_items.json and the template [id]/edit.html."""
    data_path = SRC / "data" / "service_items.json"
    try:
        services = json.loads(read_text(data_path))
    except Exception as e:
        raise BuildError(f"Failed to load service items data: {e}")
    if not isinstance(services, list):
        raise BuildError("service_items.json: must be a list")

    for service in services:
        sid = service.get("id")
        if sid is None:
            continue

        # Prepare context with all service fields
        problems = service.get("problems") or []
        problems_text = "\n".join(problems) if isinstance(problems, list) else str(problems)
        detail_image = service.get("detail-image") or service.get("detail_image") or ""
        image = service.get("image") or ""
        
        ctx = {
            "id": str(sid),
            "title": service.get("title", ""),
            "category": service.get("category", ""),
            "price": service.get("price", ""),
            "image": image,
            "detail_image": detail_image,
            "description": service.get("description", ""),
            "problems_text": problems_text,
            "solution": service.get("solution", ""),
        }

        out_path = PUBLIC / "admin" / "services" / str(sid) / "edit.html"
        html = render_page(template, ctx)
        # overwrite cleanly to avoid any potential residual content
        try:
            if out_path.exists():
                out_path.unlink()
        except Exception:
            pass
        write_html_with_directory(out_path, html, outputs, create_dir_structure=False)  # Skip for dynamic pages


def build_all() -> List[str]:
    # Convert CSV to JSON before building pages
    csv_path = SRC / "data" / "clients.csv"
    json_path = SRC / "data" / "clients.json"
    if csv_path.exists():
        convert_csv_to_json(csv_path, json_path)
    
    outputs: List[str] = []
    
    # 複数のページディレクトリを処理
    # 役割分担: corporate, customer はルートレベルに出力
    # staff, sales, admin は各ディレクトリ配下に出力
    page_dirs = [
        (CORPORATE_PAGES_DIR, ""),      # corporate → public/ (ルート)
        (CUSTOMER_PAGES_DIR, "customer"),# customer → public/customer/
        (STAFF_PAGES_DIR, "staff"),     # staff → public/staff/
        (SALES_PAGES_DIR, "sales"),     # sales → public/sales/
        (ADMIN_PAGES_DIR, "admin"),     # admin → public/admin/
        (PAGES_DIR, ""),                # pages → public/ (後方互換性)
    ]
    
    for pages_dir, output_prefix in page_dirs:
        if not pages_dir.exists():
            continue  # ディレクトリが存在しない場合はスキップ
        
        for page in pages_dir.rglob("*.html"):
            rel = page.relative_to(pages_dir)
            # Special: generate detail pages from reports/[id].html
            # Note: reports/[id].html is now a dynamic page that fetches data from API
            # So we just copy the template as-is, not generate static pages
            # if str(rel).startswith("reports/") and rel.name == "[id].html":
            #     _build_report_detail_pages(page, outputs)
            #     continue
            # Special: generate detail pages from sales/clients/[id].html
            if str(rel).startswith("sales/clients/") and rel.name == "[id].html":
                _build_client_detail_pages(page, outputs)
                continue
            # Special: generate edit pages from sales/clients/[id]/edit.html
            if str(rel).startswith("sales/clients/") and "edit.html" in str(rel):
                _build_client_edit_pages(page, outputs)
                continue
            # Special: generate detail pages from staff/assignments/[id].html
            if str(rel).startswith("staff/assignments/") and rel.name == "[id].html":
                _build_assignment_detail_pages(page, outputs)
                continue
            # Special: generate detail pages from admin/services/[id].html
            if str(rel).startswith("admin/services/") and rel.name == "[id].html":
                _build_service_detail_pages(page, outputs)
                continue
            # Special: generate edit pages from admin/services/[id]/edit.html
            if str(rel).startswith("admin/services/") and "edit.html" in str(rel):
                _build_service_edit_pages(page, outputs)
                continue
            # Special: generate user-facing service pages from service/[id].html
            if str(rel).startswith("service/") and rel.name == "[id].html":
                _build_service_pages(page, outputs)
                continue
            
            # 出力パスの決定
            # 出力パスの決定
            if output_prefix:
                # staff, sales, admin, customer は各ディレクトリ配下に出力
                out_path = PUBLIC / output_prefix / rel
            else:
                # corporate, pages はルートレベルに出力
                out_path = PUBLIC / rel
            
            html = render_page(page)
            # 全てのページに対して、[id] を含まず、かつ index.html でない場合はディレクトリを作成して index.html を出力
            # これにより /customer/dashboard -> /customer/dashboard/index.html となる
            create_dir = "[id]" not in str(rel) and rel.name != "index.html"
            write_html_with_directory(out_path, html, outputs, create_dir_structure=create_dir)
    # copy static assets last
    copy_assets(outputs)
    # copy data files for client-side access
    copy_data_files(outputs)
    # generate images list JSON for client-side access
    generate_images_list(outputs)
    # copy CNAME file for custom domain (GitHub Pages)
    cname_src = ROOT / "CNAME"
    if cname_src.exists():
        cname_dst = PUBLIC / "CNAME"
        shutil.copy2(cname_src, cname_dst)
        outputs.append(str(cname_dst))
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
