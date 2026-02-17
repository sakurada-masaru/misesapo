#!/usr/bin/env python3
"""
Normalize jinzai koyou_kubun + partner_type + han_type.

Rule:
- koyou_kubun is canonicalized to fixed enum values.
- partner_type is then derived from canonical koyou_kubun.
- han_type (affiliation) is centralized to:
  - internal: self company
  - gaibu: all external workers (dispatch / outsourced / partner companies / sole proprietors)

Default mode is dry-run. Use --apply to write.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any
import unicodedata


def auth_header() -> dict[str, str]:
    token_path = os.path.expanduser("~/.cognito_token")
    token = ""
    try:
        with open(token_path, "r", encoding="utf-8") as f:
            token = f.read().strip()
    except OSError:
        pass
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}"}


def fetch_json(url: str, headers: dict[str, str]) -> Any:
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=30) as res:
        body = res.read().decode("utf-8", errors="ignore")
    return json.loads(body)


def put_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> tuple[int, str]:
    req = urllib.request.Request(
        url,
        method="PUT",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={**headers, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, res.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="ignore")


def to_text(v: Any) -> str:
    return str(v or "").strip()


def normalize_koyou_kubun(v: Any) -> str:
    s = unicodedata.normalize("NFKC", to_text(v)).lower()
    # Keep Japanese terms readable; remove separators for stable matching.
    s = s.replace(" ", "").replace("　", "")
    s = s.replace("-", "_").replace("/", "_")
    return s


# Canonical DB values for koyou_kubun
KOYOU_CANONICAL = {
    "seishain",       # 正社員
    "keiyaku_shain",  # 契約社員
    "gyomu_itaku",    # 業務委託
    "arbeit_part",    # アルバイト/パート
    "haken_shain",    # 派遣社員
    "yakuin",         # 役員
}


def canonical_koyou_kubun(raw: Any) -> str:
    s = normalize_koyou_kubun(raw)
    if not s:
        return ""

    # already canonical
    if s in KOYOU_CANONICAL:
        return s

    # exact/synonym mappings
    if s in {"役員", "yakuin", "officer", "executive"}:
        return "yakuin"
    if s in {"正社員", "seishain", "full_time", "employee"}:
        return "seishain"
    if s in {"契約社員", "keiyaku_shain", "contract_staff", "contract_employee"}:
        return "keiyaku_shain"
    if s in {"業務委託", "gyomu_itaku", "outsourcing"}:
        return "gyomu_itaku"
    if s in {"アルバイト", "バイト", "パート", "part_time", "arbeit", "arbeit_part"}:
        return "arbeit_part"
    if s in {"派遣", "派遣社員", "haken", "dispatch", "temporary_staff", "haken_shain"}:
        return "haken_shain"

    # conservative fallback for decorated labels
    if "役員" in s or "officer" in s or "executive" in s:
        return "yakuin"
    if "派遣" in s or "dispatch" in s or "haken" in s:
        return "haken_shain"
    if "業務委託" in s:
        return "gyomu_itaku"
    if "契約社員" in s:
        return "keiyaku_shain"
    if "アルバイト" in s or "パート" in s or "バイト" in s:
        return "arbeit_part"
    return ""


def expected_partner_type(canonical_koyou: str) -> str:
    s = to_text(canonical_koyou).lower()
    if not s:
        return ""
    if s == "haken_shain":
        return "kigyou"
    if s in KOYOU_CANONICAL:
        return "kojin"
    return ""


def expected_han_type(canonical_koyou: str, current_han_type: Any) -> str:
    s = to_text(canonical_koyou).lower()
    if s in {"gyomu_itaku", "haken_shain"}:
        return "gaibu"
    if s in {"seishain", "keiyaku_shain", "arbeit_part", "yakuin"}:
        return "internal"
    curr = to_text(current_han_type).lower()
    if curr in {"kigyou", "kojin"}:
        return "gaibu"
    return to_text(current_han_type).lower()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="example: https://ho3cd7ibtl.execute-api.ap-northeast-1.amazonaws.com/prod")
    ap.add_argument("--limit", type=int, default=2000)
    ap.add_argument("--jotai", default="yuko")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    base = args.base.rstrip("/")
    headers = auth_header()
    qs = urllib.parse.urlencode({"limit": str(args.limit), "jotai": args.jotai})
    url = f"{base}/jinzai?{qs}"
    data = fetch_json(url, headers)
    items = data if isinstance(data, list) else data.get("items", [])
    if not isinstance(items, list):
        print("[NG] unexpected response format")
        return 1

    plans: list[dict[str, Any]] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        jinzai_id = to_text(it.get("jinzai_id") or it.get("id"))
        if not jinzai_id:
            continue
        name = to_text(it.get("name"))
        koyou_raw = to_text(it.get("koyou_kubun"))
        koyou = canonical_koyou_kubun(koyou_raw)
        curr = to_text(it.get("partner_type")).lower()
        want = expected_partner_type(koyou)
        curr_han = to_text(it.get("han_type")).lower()
        want_han = expected_han_type(koyou, curr_han)
        if not koyou or not want:
            continue
        curr_koyou = to_text(it.get("koyou_kubun"))
        if curr == want and curr_koyou == koyou and curr_han == want_han:
            continue
        plans.append(
            {
                "jinzai_id": jinzai_id,
                "name": name,
                "koyou_raw": koyou_raw,
                "koyou_kubun": koyou,
                "current": curr or "-",
                "expected": want,
                "current_han": curr_han or "-",
                "expected_han": want_han or "-",
                "item": it,
            }
        )

    print(f"[SUMMARY] total={len(items)} update_candidates={len(plans)}")
    for p in plans[:50]:
        print(
            f"[PLAN] {p['jinzai_id']} {p['name']} koyou={p['koyou_raw']} -> {p['koyou_kubun']} "
            f"partner={p['current']} -> {p['expected']} "
            f"han={p['current_han']} -> {p['expected_han']}"
        )
    if len(plans) > 50:
        print(f"[PLAN] ... and {len(plans) - 50} more")

    if not args.apply:
        print("[DRY-RUN] no write. use --apply to update.")
        return 0

    ok = 0
    ng = 0
    for p in plans:
        item = dict(p["item"])
        item["koyou_kubun"] = p["koyou_kubun"]
        item["partner_type"] = p["expected"]
        item["han_type"] = p["expected_han"]
        put_url = f"{base}/jinzai/{urllib.parse.quote(p['jinzai_id'], safe='')}"
        status, body = put_json(put_url, headers, item)
        if 200 <= status < 300:
            ok += 1
        else:
            ng += 1
            print(f"[NG] {p['jinzai_id']} status={status} body={body[:300]}")
    print(f"[APPLY] ok={ok} ng={ng}")
    return 0 if ng == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
