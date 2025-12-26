#!/usr/bin/env python3
"""
Build only changed files based on git status.

Usage:
  python3 scripts/build_changed.py
  python3 scripts/build_changed.py --full
  python3 scripts/build_changed.py --force

Notes:
- Changes under src/partials or src/layouts can affect many pages.
  Use --full to rebuild everything, or --force to proceed anyway.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Tuple

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
PUBLIC = ROOT / "public"
ASSETS_DIR = SRC / "assets"
DATA_DIR = SRC / "data"
PARTIALS_DIR = SRC / "partials"
LAYOUTS_DIR = SRC / "layouts"

PAGES_DIRS: List[Tuple[Path, str]] = [
    (SRC / "corporate" / "pages", ""),
    (SRC / "customer" / "pages", "customer"),
    (SRC / "staff" / "pages", "staff"),
    (SRC / "sales" / "pages", "sales"),
    (SRC / "admin" / "pages", "admin"),
    (SRC / "pages", ""),
]

try:
    import scripts.build as builder
except Exception:
    sys.path.insert(0, str(ROOT))
    import scripts.build as builder


def is_under(path: Path, base: Path) -> bool:
    try:
        path.relative_to(base)
        return True
    except ValueError:
        return False


def get_changed_files() -> List[Path]:
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise SystemExit(f"[build_changed] git status failed: {result.stderr.strip()}")

    paths: List[Path] = []
    for line in result.stdout.splitlines():
        if not line:
            continue
        raw_path = line[3:].strip()
        if "->" in raw_path:
            raw_path = raw_path.split("->", 1)[1].strip()
        if raw_path:
            paths.append(Path(raw_path))
    return paths


def find_page_root(page_file: Path) -> Optional[Tuple[Path, str]]:
    for pages_dir, output_prefix in PAGES_DIRS:
        if is_under(page_file, pages_dir):
            return pages_dir, output_prefix
    return None


def build_page(page_file: Path, outputs: List[str]) -> None:
    if page_file.suffix != ".html":
        return
    if not page_file.exists():
        return

    root_info = find_page_root(page_file)
    if not root_info:
        return

    pages_dir, output_prefix = root_info
    rel = page_file.relative_to(pages_dir)
    rel_str = str(rel).replace("\\", "/")

    if rel_str.startswith("sales/clients/") and rel.name == "[id].html":
        builder._build_client_detail_pages(page_file, outputs)
        return
    if rel_str.startswith("sales/clients/") and "edit.html" in rel_str:
        builder._build_client_edit_pages(page_file, outputs)
        return
    if rel_str.startswith("staff/assignments/") and rel.name == "[id].html":
        builder._build_assignment_detail_pages(page_file, outputs)
        return
    if rel_str.startswith("admin/services/") and rel.name == "[id].html":
        builder._build_service_detail_pages(page_file, outputs)
        return
    if rel_str.startswith("admin/services/") and "edit.html" in rel_str:
        builder._build_service_edit_pages(page_file, outputs)
        return
    if rel_str.startswith("service/") and rel.name == "[id].html":
        builder._build_service_pages(page_file, outputs)
        return

    if output_prefix:
        out_path = PUBLIC / output_prefix / rel
    else:
        out_path = PUBLIC / rel

    html = builder.render_page(page_file)
    create_dir = "[id]" not in rel_str and rel.name != "index.html"
    builder.write_html_with_directory(out_path, html, outputs, create_dir_structure=create_dir)


def copy_asset(src_file: Path, outputs: List[str]) -> None:
    if not src_file.exists():
        return
    if not is_under(src_file, ASSETS_DIR):
        return

    rel = src_file.relative_to(ASSETS_DIR)
    dst = PUBLIC / rel
    dst.parent.mkdir(parents=True, exist_ok=True)

    if src_file.suffix == ".css":
        content = builder.read_text(src_file)
        base_path = builder.get_base_path()
        if base_path != "/":
            base_prefix = base_path.rstrip("/")
            content = builder.re.sub(
                r'url\(["\']?/([^"\']*)["\']?\)',
                lambda m: f'url("{base_prefix}/{m.group(1)}")',
                content,
            )
        dst.write_text(content, encoding="utf-8")
    else:
        dst.write_bytes(src_file.read_bytes())
    outputs.append(str(dst))


def copy_data_file(src_file: Path, outputs: List[str]) -> None:
    if not src_file.exists():
        return
    if not is_under(src_file, DATA_DIR):
        return
    if src_file.suffix != ".json":
        return

    rel = src_file.relative_to(DATA_DIR)
    dst = PUBLIC / "data" / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(src_file.read_bytes())
    outputs.append(str(dst))


def main(argv: List[str]) -> int:
    if "--full" in argv:
        outputs = builder.build_all()
        print("[build_changed] full build generated:\n" + "\n".join(outputs))
        return 0

    force = "--force" in argv
    changed = get_changed_files()
    if not changed:
        print("[build_changed] no changes detected")
        return 0

    include_changed = False
    pages: List[Path] = []
    assets: List[Path] = []
    data_json: List[Path] = []
    clients_csv: Optional[Path] = None

    for rel_path in changed:
        abs_path = (ROOT / rel_path).resolve()
        if is_under(abs_path, PARTIALS_DIR) or is_under(abs_path, LAYOUTS_DIR):
            include_changed = True
            continue
        if is_under(abs_path, ASSETS_DIR):
            assets.append(abs_path)
            continue
        if is_under(abs_path, DATA_DIR):
            if abs_path.name == "clients.csv":
                clients_csv = abs_path
            elif abs_path.suffix == ".json":
                data_json.append(abs_path)
            continue
        if abs_path.suffix == ".html" and find_page_root(abs_path):
            pages.append(abs_path)

    if include_changed and not force:
        print("[build_changed] detected changes in src/partials or src/layouts.")
        print("[build_changed] run with --full to rebuild everything, or --force to proceed anyway.")
        return 2

    outputs: List[str] = []

    if clients_csv and clients_csv.exists():
        json_path = DATA_DIR / "clients.json"
        builder.convert_csv_to_json(clients_csv, json_path)
        data_json.append(json_path)

    for page_file in pages:
        build_page(page_file, outputs)

    for asset_file in assets:
        copy_asset(asset_file, outputs)

    for data_file in data_json:
        copy_data_file(data_file, outputs)

    if any(is_under(path, ASSETS_DIR / "images-public") for path in assets):
        builder.generate_images_list(outputs)

    if not outputs:
        print("[build_changed] nothing to build for detected changes")
        return 0

    print("[build_changed] generated:\n" + "\n".join(outputs))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
