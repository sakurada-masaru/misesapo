#!/usr/bin/env python3
import argparse
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


MASTER_TARGETS = [
    ("torihikisaki", "torihikisaki_id"),
    ("yagou", "yagou_id"),
    ("tenpo", "tenpo_id"),
    ("souko", "souko_id"),
    ("service", "service_id"),
    ("zaiko", "zaiko_id"),
]

JINZAI_TARGETS = [
    ("/jinzai", "jinzai_id"),
    ("/jinzai/busho", "busho_id"),
    ("/jinzai/shokushu", "shokushu_code"),
]


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_token(token_file: Path) -> str:
    raw = token_file.read_text(encoding="utf-8").strip().replace("\r", "").replace("\n", "")
    return raw.replace("Bearer ", "", 1)


def req_json(method: str, url: str, token: str, body=None):
    data = None
    headers = {"Authorization": f"Bearer {token}"}
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as res:
        text = res.read().decode("utf-8", "replace")
        return json.loads(text) if text else {}


def list_items(base_url: str, resource: str, token: str):
    merged = {}
    for jotai in ("yuko", "torikeshi"):
        qs = urllib.parse.urlencode({"limit": 5000, "jotai": jotai})
        url = f"{base_url.rstrip('/')}/{resource}?{qs}"
        data = req_json("GET", url, token)
        for it in (data.get("items") or []):
            rid = str(it.get(f"{resource}_id") or it.get("id") or "").strip()
            if rid:
                merged[rid] = it
    return list(merged.values())


def list_items_path(base_url: str, path: str, token: str):
    merged = {}
    for jotai in ("yuko", "torikeshi"):
        qs = urllib.parse.urlencode({"limit": 5000, "jotai": jotai})
        url = f"{base_url.rstrip('/')}{path}?{qs}"
        data = req_json("GET", url, token)
        for it in (data.get("items") or []):
            rid = str(it.get("jinzai_id") or it.get("busho_id") or it.get("shokushu_code") or "").strip()
            if rid:
                merged[rid] = it
    return list(merged.values())


def update_items_master(base_master: str, token: str, stamp: str, dry_run: bool):
    done = 0
    for resource, id_key in MASTER_TARGETS:
        items = list_items(base_master, resource, token)
        for row in items:
            rid = str(row.get(id_key) or "").strip()
            if not rid:
                continue
            payload = dict(row)
            payload["touroku_at"] = stamp
            if not str(payload.get("touroku_date") or "").strip():
                payload["touroku_date"] = stamp[:10]
            if dry_run:
                print(f"[DRY] {resource} {rid} -> touroku_at={stamp}")
                done += 1
                continue
            enc = urllib.parse.quote(rid, safe="")
            url = f"{base_master.rstrip('/')}/{resource}/{enc}"
            req_json("PUT", url, token, payload)
            print(f"[OK]  {resource} {rid}")
            done += 1
    return done


def update_items_jinzai(base_jinzai: str, token: str, stamp: str, dry_run: bool):
    done = 0
    for path, id_key in JINZAI_TARGETS:
        items = list_items_path(base_jinzai, path, token)
        for row in items:
            rid = str(row.get(id_key) or "").strip()
            if not rid:
                continue
            payload = dict(row)
            payload["touroku_at"] = stamp
            if not str(payload.get("touroku_date") or "").strip():
                payload["touroku_date"] = stamp[:10]
            if dry_run:
                print(f"[DRY] {path} {rid} -> touroku_at={stamp}")
                done += 1
                continue
            enc = urllib.parse.quote(rid, safe="")
            url = f"{base_jinzai.rstrip('/')}{path}/{enc}"
            req_json("PUT", url, token, payload)
            print(f"[OK]  {path} {rid}")
            done += 1
    return done


def main():
    p = argparse.ArgumentParser(description="Backfill touroku_at/touroku_date for master and jinzai records.")
    p.add_argument("--base-master", default="http://127.0.0.1:3334/api-master/master")
    p.add_argument("--base-jinzai", default="http://127.0.0.1:3334/api-jinzai")
    p.add_argument("--token-file", default=str(Path.home() / ".cognito_token"))
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    token = load_token(Path(args.token_file))
    stamp = now_iso()
    print(f"stamp={stamp}")

    total = 0
    total += update_items_master(args.base_master, token, stamp, args.dry_run)
    total += update_items_jinzai(args.base_jinzai, token, stamp, args.dry_run)
    print(f"done={total}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)
