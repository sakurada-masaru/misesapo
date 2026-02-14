#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def load_token(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def request_json(
    base: str,
    endpoint: str,
    method: str,
    token: Optional[str] = None,
    body: Optional[dict] = None,
) -> Tuple[int, Any]:
    url = f"{base.rstrip('/')}{endpoint}"
    data = None
    headers: Dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode("utf-8", errors="ignore")
            if not text:
                return resp.status, None
            try:
                return resp.status, json.loads(text)
            except json.JSONDecodeError:
                return resp.status, text
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", errors="ignore")
        try:
            return e.code, json.loads(text) if text else None
        except json.JSONDecodeError:
            return e.code, text


def iso_date(s: str) -> str:
    try:
        dt.date.fromisoformat(s)
    except ValueError:
        raise argparse.ArgumentTypeError(f"invalid date: {s} (expected YYYY-MM-DD)")
    return s


def should_include(item: dict, mode: str) -> bool:
    # mode:
    # - all: delete everything in range
    # - safe: only clearly-non-prod items
    origin = str(item.get("origin") or "").lower()
    memo = str(item.get("memo") or item.get("notes") or item.get("description") or "")
    if mode == "all":
        return True
    if origin in {"manual", "import", "calendar"}:
        # origin alone is not enough; still require test-ish marker
        pass
    markers = ["test", "probe", "recreate", "dummy", "デモ", "[demo]", "demo"]
    return any(m.lower() in memo.lower() for m in markers)


def item_id(item: dict) -> str:
    return str(item.get("id") or item.get("schedule_id") or item.get("yotei_id") or "")


def item_date(item: dict) -> str:
    return str(item.get("date") or item.get("scheduled_date") or item.get("start_at") or "")


def main() -> int:
    p = argparse.ArgumentParser(description="Clear yotei items in date range (dry-run by default)")
    p.add_argument("--base", required=True, help="例: http://127.0.0.1:3334/api or https://.../prod")
    p.add_argument("--from", dest="date_from", required=True, type=iso_date)
    p.add_argument("--to", dest="date_to", required=True, type=iso_date)
    p.add_argument("--limit", type=int, default=5000)
    p.add_argument("--mode", choices=["safe", "all"], default="safe")
    p.add_argument("--apply", action="store_true", help="Apply DELETE")
    p.add_argument("--token-file", default=str(Path.home() / ".cognito_token"))
    p.add_argument("--no-auth", action="store_true", help="Do not send Authorization header")
    args = p.parse_args()

    token = None if args.no_auth else load_token(Path(args.token_file))

    qs = urllib.parse.urlencode(
        {
            "from": args.date_from,
            "to": args.date_to,
            "limit": str(args.limit),
        }
    )
    st, payload = request_json(args.base, f"/yotei?{qs}", "GET", token=token)
    if st < 200 or st >= 300:
        print(f"[NG] list status={st} body={payload}")
        return 1

    items: List[dict] = list((payload or {}).get("items") or [])
    plans = []
    skipped = 0
    for it in items:
        if not isinstance(it, dict):
            continue
        if not should_include(it, args.mode):
            skipped += 1
            continue
        iid = item_id(it)
        if not iid:
            skipped += 1
            continue
        plans.append(
            {
                "id": iid,
                "date": item_date(it),
                "jotai": it.get("jotai") or it.get("status"),
                "tenpo_id": it.get("tenpo_id") or it.get("store_id"),
                "sagyouin_id": it.get("sagyouin_id") or it.get("worker_id") or it.get("assigned_to"),
                "memo": (it.get("memo") or it.get("notes") or it.get("description") or "")[:120],
            }
        )

    print(f"[SUMMARY] range={args.date_from}..{args.date_to} fetched={len(items)} plan={len(plans)} skipped={skipped} mode={args.mode}")
    for x in plans[:30]:
        print(f"[PLAN] {x['date']} {x['id']} jotai={x['jotai']} tenpo={x['tenpo_id']} worker={x['sagyouin_id']} memo={x['memo']!r}")
    if len(plans) > 30:
        print(f"[PLAN] ... and {len(plans)-30} more")

    if not args.apply:
        print("[DRY-RUN] no delete. use --apply to DELETE.")
        return 0

    ok = 0
    ng = 0
    for x in plans:
        iid = x["id"]
        ep = f"/yotei/{urllib.parse.quote(iid, safe='')}"
        st2, out2 = request_json(args.base, ep, "DELETE", token=token)
        if 200 <= st2 < 300:
            ok += 1
        else:
            ng += 1
            print(f"[NG] delete {iid} status={st2} body={out2}")
    print(f"[APPLY] ok={ok} ng={ng}")
    return 0 if ng == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

