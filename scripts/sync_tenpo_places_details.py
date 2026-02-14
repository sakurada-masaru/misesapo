#!/usr/bin/env python3
"""
Sync tenpo phone / opening hours from Google Places API.

Default is dry-run (no write). Use --apply to PUT updates.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib import parse, request, error


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def strip(v: object) -> str:
    return str(v or "").strip()


def auth_headers(token: str) -> Dict[str, str]:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def http_json(method: str, url: str, token: str = "", body: Optional[dict] = None) -> Tuple[int, dict]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = request.Request(url, data=data, method=method, headers=auth_headers(token))
    try:
        with request.urlopen(req, timeout=30) as r:
            raw = r.read().decode("utf-8")
            try:
                return r.status, json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                return r.status, {"raw": raw}
    except error.HTTPError as e:
        try:
            raw = e.read().decode("utf-8")
            try:
                return e.code, json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                return e.code, {"raw": raw}
        except Exception:
            return e.code, {"error": str(e)}


@dataclass
class Tenpo:
    tenpo_id: str
    name: str
    address: str
    phone: str
    place_id: str
    raw: dict


def load_tenpo(base: str, token: str, limit: int) -> List[Tenpo]:
    url = f"{base.rstrip('/')}/master/tenpo?limit={limit}&jotai=yuko"
    st, res = http_json("GET", url, token)
    if st < 200 or st >= 300:
        raise RuntimeError(f"GET tenpo failed: {st} {res}")
    items = res.get("items") or []
    out: List[Tenpo] = []
    for it in items:
        tid = strip(it.get("tenpo_id"))
        name = strip(it.get("name"))
        if not tid or not name:
            continue
        out.append(
            Tenpo(
                tenpo_id=tid,
                name=name,
                address=strip(it.get("address")),
                phone=strip(it.get("phone")),
                place_id=strip(it.get("maps_place_id") or it.get("place_id")),
                raw=it,
            )
        )
    return out


def places_find_place(api_key: str, query: str, language: str = "ja") -> Tuple[str, str, str]:
    params = {
        "input": query,
        "inputtype": "textquery",
        "fields": "place_id,name,formatted_address",
        "language": language,
        "key": api_key,
    }
    url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json?" + parse.urlencode(params)
    st, res = http_json("GET", url)
    if st < 200 or st >= 300:
        raise RuntimeError(f"findplace HTTP {st}: {res}")
    status = strip(res.get("status"))
    if status != "OK":
        return "", "", ""
    cands = res.get("candidates") or []
    if not cands:
        return "", "", ""
    c0 = cands[0] or {}
    return strip(c0.get("place_id")), strip(c0.get("name")), strip(c0.get("formatted_address"))


def places_detail(api_key: str, place_id: str, language: str = "ja") -> dict:
    params = {
        "place_id": place_id,
        "fields": ",".join(
            [
                "place_id",
                "name",
                "formatted_address",
                "formatted_phone_number",
                "international_phone_number",
                "opening_hours",
                "url",
                "website",
            ]
        ),
        "language": language,
        "key": api_key,
    }
    url = "https://maps.googleapis.com/maps/api/place/details/json?" + parse.urlencode(params)
    st, res = http_json("GET", url)
    if st < 200 or st >= 300:
        raise RuntimeError(f"details HTTP {st}: {res}")
    status = strip(res.get("status"))
    if status != "OK":
        return {}
    return res.get("result") or {}


def build_query(t: Tenpo) -> str:
    if t.address:
        return f"{t.name} {t.address}"
    return t.name


def calc_update_body(t: Tenpo, detail: dict, *, overwrite: bool) -> dict:
    body: Dict[str, object] = {}
    current_phone = strip(t.raw.get("phone"))
    current_address = strip(t.raw.get("address"))
    current_map = strip(t.raw.get("google_map_url") or t.raw.get("map_url"))
    current_place = strip(t.raw.get("maps_place_id") or t.raw.get("place_id"))
    current_hours = t.raw.get("opening_hours")

    new_place = strip(detail.get("place_id"))
    new_name = strip(detail.get("name"))
    new_address = strip(detail.get("formatted_address"))
    new_phone = strip(detail.get("formatted_phone_number"))
    new_phone_i18n = strip(detail.get("international_phone_number"))
    new_url = strip(detail.get("url"))
    new_website = strip(detail.get("website"))
    new_hours = detail.get("opening_hours") if isinstance(detail.get("opening_hours"), dict) else None

    if new_place and (overwrite or not current_place) and new_place != current_place:
        body["maps_place_id"] = new_place
    if new_name and (overwrite or not strip(t.raw.get("maps_name"))) and new_name != strip(t.raw.get("maps_name")):
        body["maps_name"] = new_name
    if new_address and (overwrite or not current_address) and new_address != current_address:
        body["address"] = new_address
    if new_phone and (overwrite or not current_phone) and new_phone != current_phone:
        body["phone"] = new_phone
    if new_phone_i18n and (overwrite or not strip(t.raw.get("phone_international"))):
        body["phone_international"] = new_phone_i18n
    if new_url and (overwrite or not current_map):
        body["google_map_url"] = new_url
        body["map_url"] = new_url
    if new_website and (overwrite or not strip(t.raw.get("website"))):
        body["website"] = new_website
    if new_hours and (overwrite or current_hours is None):
        body["opening_hours"] = new_hours

    if body:
        body["maps_source"] = "google_places"
        body["maps_updated_at"] = now_iso()
    return body


def main() -> int:
    p = argparse.ArgumentParser(description="Sync tenpo phone/opening_hours from Google Places (dry-run by default).")
    p.add_argument("--base", required=True, help="Master API base (e.g. https://.../prod)")
    p.add_argument("--token-file", default=os.path.expanduser("~/.cognito_token"))
    p.add_argument("--api-key", default=os.environ.get("GOOGLE_MAPS_API_KEY", ""), help="Google Maps API key")
    p.add_argument("--limit-tenpo", type=int, default=20000)
    p.add_argument("--language", default="ja")
    p.add_argument("--sleep-sec", type=float, default=0.05)
    p.add_argument("--overwrite", action="store_true", help="Overwrite existing phone/opening/address/map fields")
    p.add_argument("--apply", action="store_true", help="Apply updates (default: dry-run)")
    p.add_argument("--report-dir", default="docs/spec")
    args = p.parse_args()

    if not args.api_key:
        print("[ERR] --api-key or GOOGLE_MAPS_API_KEY is required", file=sys.stderr)
        return 2

    token = ""
    tf = Path(args.token_file).expanduser()
    if tf.exists():
        token = tf.read_text(encoding="utf-8").strip()

    tenpos = load_tenpo(args.base, token, args.limit_tenpo)
    print(f"[INFO] tenpo={len(tenpos)}")

    report_dir = Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_csv = report_dir / f"tenpo_places_sync_{ts}.csv"

    updates: List[dict] = []
    report_rows: List[dict] = []
    ng_lookup = 0
    for idx, t in enumerate(tenpos, start=1):
        try:
            place_id = t.place_id
            place_name = ""
            place_addr = ""
            if not place_id:
                q = build_query(t)
                place_id, place_name, place_addr = places_find_place(args.api_key, q, args.language)
                time.sleep(args.sleep_sec)
            if not place_id:
                report_rows.append(
                    {
                        "tenpo_id": t.tenpo_id,
                        "tenpo_name": t.name,
                        "status": "NO_MATCH",
                        "place_id": "",
                        "phone": "",
                        "address": "",
                        "fields": "",
                    }
                )
                continue
            detail = places_detail(args.api_key, place_id, args.language)
            time.sleep(args.sleep_sec)
            if not detail:
                report_rows.append(
                    {
                        "tenpo_id": t.tenpo_id,
                        "tenpo_name": t.name,
                        "status": "DETAIL_EMPTY",
                        "place_id": place_id,
                        "phone": "",
                        "address": place_addr,
                        "fields": "",
                    }
                )
                continue

            body = calc_update_body(t, detail, overwrite=args.overwrite)
            fields = ",".join(sorted(body.keys()))
            report_rows.append(
                {
                    "tenpo_id": t.tenpo_id,
                    "tenpo_name": t.name,
                    "status": "PLAN" if body else "NO_CHANGE",
                    "place_id": strip(detail.get("place_id")) or place_id,
                    "phone": strip(detail.get("formatted_phone_number")),
                    "address": strip(detail.get("formatted_address")),
                    "fields": fields,
                }
            )
            if body:
                updates.append({"tenpo_id": t.tenpo_id, "tenpo_name": t.name, "body": body})
                if len(updates) <= 20:
                    print(f"[PLAN] {t.tenpo_id} {t.name} fields={fields}")
        except Exception as e:
            ng_lookup += 1
            report_rows.append(
                {
                    "tenpo_id": t.tenpo_id,
                    "tenpo_name": t.name,
                    "status": f"LOOKUP_NG:{str(e)[:80]}",
                    "place_id": "",
                    "phone": "",
                    "address": "",
                    "fields": "",
                }
            )
        if idx % 100 == 0:
            print(f"[PROGRESS] checked={idx}/{len(tenpos)} planned={len(updates)} lookup_ng={ng_lookup}")

    with report_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["tenpo_id", "tenpo_name", "status", "place_id", "phone", "address", "fields"],
        )
        w.writeheader()
        w.writerows(report_rows)

    print(f"[SUMMARY] plan_updates={len(updates)} lookup_ng={ng_lookup}")
    print(f"[REPORT] {report_csv}")

    if not args.apply:
        print("[DRY-RUN] no write. use --apply to PUT updates.")
        return 0

    ok = 0
    ng = 0
    for u in updates:
        tid = u["tenpo_id"]
        url = f"{args.base.rstrip('/')}/master/tenpo/{parse.quote(tid, safe='')}"
        st, res = http_json("PUT", url, token, u["body"])
        if 200 <= st < 300:
            ok += 1
            print(f"[OK] {tid} {u['tenpo_name']}")
        else:
            ng += 1
            print(f"[NG] {tid} status={st} body={str(res)[:200]}")
    print(f"[APPLY] ok={ok} ng={ng}")
    return 0 if ng == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
