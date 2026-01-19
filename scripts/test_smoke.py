#!/usr/bin/env python3
"""
Minimal smoke test for the static mock and (future) template build output.

Checks:
- Optionally runs scripts/build.py if present.
- Verifies generated HTML files exist and exceed a minimal size.
- Scans HTML for relative href/src references and ensures targets exist under public/.

Exit codes:
- 0: All checks passed
- 1: Any failure
"""

from __future__ import annotations

import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Tuple


RE_REF = re.compile(r"\b(?:href|src)=[\"']([^\"']+)[\"']", re.IGNORECASE)
SIZE_THRESHOLD_BYTES = 256


@dataclass
class Issue:
    kind: str  # e.g., missing_file, small_file, build_failed
    detail: str


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def run_build_if_present(issues: List[Issue]) -> None:
    build = repo_root() / "scripts" / "build.py"
    if not build.exists():
        print("[info] scripts/build.py not found; skipping build step.")
        return
    print("[info] Running build: python3 scripts/build.py")
    try:
        res = subprocess.run([sys.executable, str(build)], capture_output=True, text=True)
    except Exception as e:
        issues.append(Issue("build_failed", f"Exception: {e}"))
        return
    if res.returncode != 0:
        issues.append(Issue("build_failed", f"exit={res.returncode}\nstdout:\n{res.stdout}\nstderr:\n{res.stderr}"))
    else:
        # Show concise output for context
        out = res.stdout.strip()
        if out:
            print("[build stdout]\n" + out)
        err = res.stderr.strip()
        if err:
            print("[build stderr]\n" + err)


def expected_pages(public_dir: Path) -> List[Path]:
    """期待ページを決定する。

    優先順位:
    - src/pages/*.html が存在すれば、それらが public/ に生成されていることを期待。
    - 後方互換: templates/pages/*.html も同様にサポート。
    - いずれも無い場合は、現在の public/*.html を基準に検証。
    """
    src_pages = repo_root() / "src" / "pages"
    if src_pages.exists():
        pages = sorted(p for p in src_pages.glob("*.html") if p.is_file())
        if pages:
            return [public_dir / p.name for p in pages]
    templates_pages = repo_root() / "templates" / "pages"
    if templates_pages.exists():
        pages = sorted(p for p in templates_pages.glob("*.html") if p.is_file())
        if pages:
            return [public_dir / p.name for p in pages]
    # Fallback: whatever is already in public
    return sorted(p for p in public_dir.glob("*.html") if p.is_file())


def scan_refs(html: str) -> Iterable[str]:
    for m in RE_REF.finditer(html):
        yield m.group(1).strip()


def is_external_or_ignored(url: str) -> bool:
    lower = url.lower()
    if not url or lower.startswith(("http://", "https://", "//")):
        return True
    if lower.startswith(("mailto:", "tel:", "data:", "javascript:", "about:")):
        return True
    if lower.startswith("#"):
        return True
    return False


def normalize_target(base_dir: Path, url: str) -> Path:
    # Strip query/hash
    clean = url.split("?", 1)[0].split("#", 1)[0]
    if clean.startswith("/"):
        return base_dir / clean.lstrip("/")
    return base_dir / clean


def check_public(public_dir: Path) -> List[Issue]:
    issues: List[Issue] = []
    if not public_dir.exists():
        return [Issue("missing_dir", f"{public_dir} does not exist")] 

    pages = expected_pages(public_dir)
    if not pages:
        print("[warn] No HTML pages found to validate under public/.")
        return issues

    for page in pages:
        if not page.exists():
            issues.append(Issue("missing_file", f"expected page not found: {page}"))
            continue
        try:
            data = page.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            issues.append(Issue("read_error", f"{page}: {e}"))
            continue
        size = len(data.encode("utf-8", errors="ignore"))
        if size < SIZE_THRESHOLD_BYTES:
            issues.append(Issue("small_file", f"{page} size={size} < {SIZE_THRESHOLD_BYTES}"))

        # Reference checks
        for url in scan_refs(data):
            if is_external_or_ignored(url):
                continue
            target = normalize_target(public_dir, url)
            if url.endswith("/") and not target.exists():
                # Allow default index.html resolution for directory-style refs
                target = target / "index.html"
            if not target.exists():
                issues.append(Issue("missing_ref", f"{page.name} -> {url} (resolved: {target})"))

    return issues


def main() -> int:
    root = repo_root()
    public = root / "public"

    issues: List[Issue] = []

    # 1) Optional build
    run_build_if_present(issues)

    # 2) Validate public output
    issues.extend(check_public(public))

    if issues:
        print("\n[FAIL] Issues found:")
        for i in issues:
            print(f"- {i.kind}: {i.detail}")
        return 1
    print("\n[OK] Smoke tests passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
