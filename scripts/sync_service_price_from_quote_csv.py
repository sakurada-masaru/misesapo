#!/usr/bin/env python3
import argparse
import csv
import datetime as dt
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Dict, List, Optional, Tuple


PRICE_HEADERS = {
    "monthly": "サブスク料金\n毎月",
    "bimonthly": "サブスク料金\n2ヶ月に1度",
    "quarterly": "サブスク料金\n3ヶ月に1度",
    "halfyearly": "サブスク料金\n6ヶ月に1度",
    "yearly": "サブスク料金\n1年に1度",
    "spot": "スポット料金",
}


def load_token(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def parse_price(value: str) -> int:
    if value is None:
        return 0
    s = str(value).strip()
    if not s:
        return 0
    digits = re.sub(r"[^\d]", "", s)
    return int(digits) if digits else 0


def normalize_name(name: str) -> str:
    if not name:
        return ""
    s = str(name)
    s = s.strip().lower()
    s = s.replace("　", "").replace(" ", "")
    s = s.replace("（", "(").replace("）", ")")
    s = s.replace("・", "").replace("／", "/").replace("，", ",").replace("、", ",")
    s = s.replace("～", "~").replace("〜", "~")
    # 括弧内は一致率向上のため残すが、記号は減らす
    s = re.sub(r"[\"'`]", "", s)
    return s


def request_json(base: str, endpoint: str, token: str, method: str, body: Optional[dict] = None) -> Tuple[int, dict]:
    url = f"{base.rstrip('/')}{endpoint}"
    data = None
    headers = {"Authorization": f"Bearer {token}"}
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode("utf-8", errors="ignore")
            try:
                return resp.status, json.loads(text) if text else {}
            except json.JSONDecodeError:
                return resp.status, {"raw": text}
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", errors="ignore")
        try:
            payload = json.loads(text) if text else {}
        except json.JSONDecodeError:
            payload = {"raw": text}
        return e.code, payload


@dataclass
class QuoteRow:
    name: str
    price: int
    row_no: int
    price_raw: str
    normalized: str


def load_quote_rows(csv_path: Path, price_mode: str) -> List[QuoteRow]:
    price_header = PRICE_HEADERS[price_mode]
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))

    header_idx = None
    for i, row in enumerate(rows):
        if "年間サポート内容" in row and price_header in row:
            header_idx = i
            break
    if header_idx is None:
        raise RuntimeError(f"Header row not found: 年間サポート内容 / {price_header}")

    header = rows[header_idx]
    name_col = header.index("年間サポート内容")
    price_col = header.index(price_header)

    out: List[QuoteRow] = []
    for i, row in enumerate(rows[header_idx + 1 :], start=header_idx + 2):
        if name_col >= len(row):
            continue
        name = (row[name_col] or "").strip()
        if not name:
            continue
        if name in {"項目名", "毎月："}:
            continue
        raw_price = row[price_col] if price_col < len(row) else ""
        price = parse_price(raw_price)
        out.append(
            QuoteRow(
                name=name,
                price=price,
                row_no=i,
                price_raw=str(raw_price),
                normalized=normalize_name(name),
            )
        )
    return out


def choose_best_match(service_name: str, quote_rows: List[QuoteRow]) -> Tuple[Optional[QuoteRow], float]:
    target = normalize_name(service_name)
    if not target:
        return None, 0.0

    exact = next((r for r in quote_rows if r.normalized == target), None)
    if exact:
        return exact, 1.0

    best_row = None
    best_score = 0.0
    for r in quote_rows:
        score = SequenceMatcher(None, target, r.normalized).ratio()
        if score > best_score:
            best_score = score
            best_row = r
    return best_row, best_score


def build_report_path(prefix: str) -> Path:
    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    p = Path("docs/spec") / f"{prefix}_{ts}.csv"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def main() -> int:
    p = argparse.ArgumentParser(description="Sync service.default_price from quote CSV")
    p.add_argument("--base", required=True, help="https://<api-id>.execute-api.ap-northeast-1.amazonaws.com/prod")
    p.add_argument("--token-file", default=str(Path.home() / ".cognito_token"))
    p.add_argument("--csv", required=True, help="Quote CSV path")
    p.add_argument("--price-mode", choices=list(PRICE_HEADERS.keys()), default="spot")
    p.add_argument("--min-score", type=float, default=0.84, help="Fuzzy match threshold (0..1)")
    p.add_argument("--apply", action="store_true", help="Apply PUT updates")
    args = p.parse_args()

    token = load_token(Path(args.token_file))
    quote_rows = load_quote_rows(Path(args.csv), args.price_mode)

    st, payload = request_json(args.base, "/master/service?limit=5000&jotai=yuko", token, "GET")
    if st < 200 or st >= 300:
        print(f"[NG] service list failed status={st} body={payload}")
        return 1

    services = payload.get("items") or []
    plans = []
    unmatched = []
    for s in services:
        sid = s.get("service_id", "")
        name = s.get("name", "")
        old_price = int(s.get("default_price") or 0)
        row, score = choose_best_match(name, quote_rows)
        if (not row) or (score < args.min_score):
            unmatched.append((sid, name, old_price, score))
            continue
        new_price = int(row.price)
        changed = new_price != old_price
        plans.append(
            {
                "service_id": sid,
                "service_name": name,
                "old_price": old_price,
                "new_price": new_price,
                "changed": changed,
                "score": round(score, 4),
                "quote_name": row.name,
                "quote_row": row.row_no,
                "quote_price_raw": row.price_raw,
            }
        )

    report_path = build_report_path("service_price_sync")
    with report_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "service_id",
                "service_name",
                "old_price",
                "new_price",
                "changed",
                "score",
                "quote_name",
                "quote_row",
                "quote_price_raw",
            ],
        )
        w.writeheader()
        w.writerows(plans)

    print(
        f"[SUMMARY] services={len(services)} matched={len(plans)} unmatched={len(unmatched)} "
        f"changed={sum(1 for x in plans if x['changed'])} mode={args.price_mode}"
    )
    print(f"[REPORT] {report_path}")

    for x in plans[:20]:
        flag = "UPDATE" if x["changed"] else "KEEP"
        print(
            f"[PLAN:{flag}] {x['service_id']} {x['service_name']} "
            f"{x['old_price']} -> {x['new_price']} score={x['score']}"
        )
    if len(plans) > 20:
        print(f"[PLAN] ... and {len(plans)-20} more")

    if not args.apply:
        print("[DRY-RUN] no write. use --apply to PUT updates.")
        return 0

    ok = 0
    ng = 0
    for x in plans:
        if not x["changed"]:
            continue
        sid = x["service_id"]
        get_ep = f"/master/service/{urllib.parse.quote(sid, safe='')}"
        st_get, current = request_json(args.base, get_ep, token, "GET")
        if st_get < 200 or st_get >= 300:
            ng += 1
            print(f"[NG] {sid} GET status={st_get} body={current}")
            continue
        current["default_price"] = int(x["new_price"])
        st_put, out = request_json(args.base, get_ep, token, "PUT", current)
        if 200 <= st_put < 300:
            ok += 1
        else:
            ng += 1
            print(f"[NG] {sid} PUT status={st_put} body={out}")

    print(f"[APPLY] ok={ok} ng={ng}")
    return 0 if ng == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

