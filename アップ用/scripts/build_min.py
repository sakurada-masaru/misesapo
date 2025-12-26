#!/usr/bin/env python3
"""
Minimal build: render specific pages and copy selected assets only.

Usage:
  python3 scripts/build_min.py \
    --page src/pages/admin/customers/karte.html \
    --asset src/assets/css/admin-karte.css \
    --asset src/assets/js/admin-karte.js
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_PAGES = ROOT / "src" / "pages"
SRC_ASSETS = ROOT / "src" / "assets"
PUBLIC = ROOT / "public"

try:
    import scripts.build as builder
except Exception:
    sys.path.insert(0, str(ROOT))
    import scripts.build as builder


def ensure_relative(raw: str) -> Path:
    path = Path(raw)
    if not path.is_absolute():
        return (ROOT / path).resolve()
    return path


def build_page(src_file: Path, outputs: list[str]) -> None:
    if not src_file.exists():
        raise SystemExit(f"Source not found: {src_file}")
    if SRC_PAGES not in src_file.parents:
        raise SystemExit(f"Page must be under {SRC_PAGES}")

    rel = src_file.relative_to(SRC_PAGES)
    dst = PUBLIC / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    html = builder.render_page(src_file)
    dst.write_text(html, encoding="utf-8")
    outputs.append(str(dst))


def copy_asset(src_file: Path, outputs: list[str]) -> None:
    if not src_file.exists():
        raise SystemExit(f"Asset not found: {src_file}")
    if SRC_ASSETS not in src_file.parents:
        raise SystemExit(f"Asset must be under {SRC_ASSETS}")

    rel = src_file.relative_to(SRC_ASSETS)
    dst = PUBLIC / rel
    dst.parent.mkdir(parents=True, exist_ok=True)

    # Use build.py helper to preserve base_path behavior for CSS
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


def main(argv: list[str]) -> int:
    pages: list[Path] = []
    assets: list[Path] = []

    it = iter(argv[1:])
    for arg in it:
        if arg == "--page":
            try:
                pages.append(ensure_relative(next(it)))
            except StopIteration:
                raise SystemExit("--page requires a value")
        elif arg == "--asset":
            try:
                assets.append(ensure_relative(next(it)))
            except StopIteration:
                raise SystemExit("--asset requires a value")
        else:
            raise SystemExit(f"Unknown argument: {arg}")

    if not pages:
        raise SystemExit("At least one --page is required")

    outputs: list[str] = []
    for page in pages:
        build_page(page, outputs)
    for asset in assets:
        copy_asset(asset, outputs)

    print("[build_min] generated:")
    for path in outputs:
        print(" -", path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
