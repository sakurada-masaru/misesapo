#!/usr/bin/env python3
"""
Create kanri_log entries from docs/spec/PR_DAILY_REPORT_2026_02.md.

Default target range:
  2026-02-17 .. 2026-02-25

Usage:
  python3 scripts/create_kanri_logs_from_pr_report.py
  python3 scripts/create_kanri_logs_from_pr_report.py --dry-run
  python3 scripts/create_kanri_logs_from_pr_report.py --base https://<gateway>/prod/master
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict, List, Tuple


DEFAULT_BASE = "http://127.0.0.1:3334/api-master/master"
DEFAULT_REPORT = "docs/spec/PR_DAILY_REPORT_2026_02.md"
DEFAULT_FROM = "2026-02-17"
DEFAULT_TO = "2026-02-25"
DEFAULT_REPORTED_BY = "櫻田傑"


def read_token(token_file: Path) -> str:
    token = token_file.read_text(encoding="utf-8").strip()
    if token.startswith("Bearer "):
        token = token[len("Bearer ") :]
    if not token:
        raise ValueError(f"token is empty: {token_file}")
    return token


def http_json(method: str, url: str, token: str, payload: dict | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8", "replace")
    return json.loads(raw or "{}")


def iter_dates(from_ymd: str, to_ymd: str) -> List[str]:
    s = dt.date.fromisoformat(from_ymd)
    e = dt.date.fromisoformat(to_ymd)
    if s > e:
        raise ValueError(f"from > to: {from_ymd} > {to_ymd}")
    cur = s
    out = []
    while cur <= e:
        out.append(cur.isoformat())
        cur += dt.timedelta(days=1)
    return out


def parse_report_sections(path: Path) -> Dict[str, List[str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    sections: Dict[str, List[str]] = {}
    cur_date = None
    for line in lines:
        m = re.match(r"^##\s+(20\d{2}-\d{2}-\d{2})\s*$", line.strip())
        if m:
            cur_date = m.group(1)
            sections.setdefault(cur_date, [])
            continue
        if line.startswith("## "):
            cur_date = None
            continue
        if cur_date:
            b = re.match(r"^- (.+)$", line.strip())
            if b:
                sections[cur_date].append(b.group(1).strip())
    return sections


def to_name(bullets: List[str], ymd: str) -> str:
    if not bullets:
        return f"管理日誌 {ymd}"
    first = bullets[0].strip()
    return first[:60] if first else f"管理日誌 {ymd}"


def to_body(bullets: List[str], ymd: str) -> str:
    if not bullets:
        return f"{ymd} の実装作業を実施。"
    return "\n".join(f"- {b}" for b in bullets)


def to_tomorrow_plan(next_bullets: List[str], next_ymd: str | None) -> str:
    if next_bullets:
        return "\n".join(f"- {b}" for b in next_bullets[:5])
    if next_ymd:
        return f"- {next_ymd} の計画タスクを実施する。"
    return "- 継続タスクの整理・確認を行う。"


def fetch_existing_dates(base: str, token: str) -> set[str]:
    url = f"{base.rstrip('/')}/kanri_log?limit=5000&jotai=yuko"
    data = http_json("GET", url, token)
    items = data.get("items") or []
    dates = set()
    for it in items:
        ymd = str(it.get("reported_at") or "").strip()
        if ymd:
            dates.add(ymd)
    return dates


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--from", dest="from_ymd", default=DEFAULT_FROM)
    ap.add_argument("--to", dest="to_ymd", default=DEFAULT_TO)
    ap.add_argument("--reported-by", default=DEFAULT_REPORTED_BY)
    ap.add_argument("--report-file", default=DEFAULT_REPORT)
    ap.add_argument("--token-file", default="~/.cognito_token")
    ap.add_argument("--work-time", default="")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-fetch-existing", action="store_true")
    args = ap.parse_args()

    report_path = Path(args.report_file)
    token_path = Path(args.token_file).expanduser()

    if not report_path.exists():
        print(f"ERROR: report file not found: {report_path}")
        return 1

    try:
        token = read_token(token_path)
    except Exception as e:
        print(f"ERROR: {e}")
        return 1

    sections = parse_report_sections(report_path)
    target_dates = iter_dates(args.from_ymd, args.to_ymd)

    existing_dates: set[str] = set()
    if not args.skip_fetch_existing:
        try:
            existing_dates = fetch_existing_dates(args.base, token)
        except Exception as e:
            print(f"ERROR: existing fetch failed: {e}")
            return 1

    create_count = 0
    skip_count = 0
    for i, ymd in enumerate(target_dates):
        if ymd in existing_dates:
            print(f"SKIP  {ymd} already exists")
            skip_count += 1
            continue
        bullets = sections.get(ymd, [])
        next_ymd = target_dates[i + 1] if i + 1 < len(target_dates) else None
        next_bullets = sections.get(next_ymd, []) if next_ymd else []

        payload = {
            "list_scope": "kanri_log",
            "category": "kanri_log",
            "log_type": "kanri_log",
            "source": "kanri_log",
            "status": "open",
            "task_state": "mikanryo",
            "jotai": "yuko",
            "reported_at": ymd,
            "reported_by": args.reported_by,
            "work_time": args.work_time,
            "name": to_name(bullets, ymd),
            "request": to_body(bullets, ymd),
            "tomorrow_plan": to_tomorrow_plan(next_bullets, next_ymd),
            "related_kadai_ids": "",
        }

        if args.dry_run:
            print(f"DRY   {ymd} {payload['name']}")
            create_count += 1
            continue

        try:
            url = f"{args.base.rstrip('/')}/kanri_log"
            res = http_json("POST", url, token, payload)
            print(f"OK    {ymd} {res.get('kanri_log_id', '-')}")
            create_count += 1
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")
            print(f"FAIL  {ymd} HTTP {e.code}: {detail}")
            return 1
        except Exception as e:
            print(f"FAIL  {ymd} {e}")
            return 1

    print(f"DONE  created={create_count} skipped={skip_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

