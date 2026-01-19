#!/usr/bin/env python3
"""
Build a single page (or a list of pages) from src/pages into public.

Usage:
  python3 scripts/build_one.py src/pages/admin/customers/karte.html
  python3 scripts/build_one.py src/pages/admin/customers/karte.html src/pages/index.html

Notes:
- This only renders the specified HTML files.
- It will also copy src/assets to public/ for up-to-date CSS/JS.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "pages"
PUBLIC = ROOT / "public"

# Reuse build logic from build.py
try:
    import scripts.build as builder
except Exception:
    # Fallback when running as a script
    sys.path.insert(0, str(ROOT))
    import scripts.build as builder


def ensure_relative(src_path: Path) -> Path:
    if not src_path.is_absolute():
        return (ROOT / src_path).resolve()
    return src_path


def build_page(src_file: Path, outputs: list[str]) -> None:
    if not src_file.exists():
        raise SystemExit(f"Source not found: {src_file}")
    if SRC not in src_file.parents:
        raise SystemExit(f"Source must be under {SRC}")

    rel = src_file.relative_to(SRC)
    dst = PUBLIC / rel
    dst.parent.mkdir(parents=True, exist_ok=True)

    html = builder.render_page(src_file)
    dst.write_text(html, encoding="utf-8")
    outputs.append(str(dst))


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: python3 scripts/build_one.py <src/pages/...> [more files...]")
        return 1

    outputs: list[str] = []
    for raw in argv[1:]:
        src_file = ensure_relative(Path(raw))
        build_page(src_file, outputs)

    # Keep assets in sync with latest edits
    builder.copy_assets(outputs)

    print("[build_one] generated:")
    for path in outputs:
        print(" -", path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
