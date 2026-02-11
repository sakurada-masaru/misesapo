#!/usr/bin/env python3
import argparse
import csv
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def load_token(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def request_json(base: str, endpoint: str, token: str, method: str, body: dict) -> tuple[int, str]:
    url = f"{base.rstrip('/')}{endpoint}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="ignore")


def parse_csv(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def normalize_row(row: dict) -> dict:
    out = {
        "service_id": (row.get("service_id") or "").strip(),
        "name": (row.get("name") or "").strip(),
        "category": (row.get("category") or "other").strip() or "other",
        "jotai": (row.get("jotai") or "yuko").strip() or "yuko",
    }
    # 数値は空文字を避ける
    duration = (row.get("default_duration_min") or "").strip()
    price = (row.get("default_price") or "").strip()
    out["default_duration_min"] = int(duration) if duration.isdigit() else 0
    out["default_price"] = int(price) if price.isdigit() else 0
    return out


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--base", required=True, help="例: https://<api-id>.execute-api.ap-northeast-1.amazonaws.com/prod")
    p.add_argument("--token-file", default=str(Path.home() / ".cognito_token"))
    p.add_argument("--csv", default="docs/spec/templates/service_master_seed_full.csv")
    p.add_argument("--endpoint", default="/master/service")
    args = p.parse_args()

    token = load_token(Path(args.token_file))
    rows = parse_csv(Path(args.csv))

    ok_post = ng_post = ok_put = ng_put = 0

    for row in rows:
        body = normalize_row(row)
        sid = body.get("service_id", "")
        if not sid or not body.get("name"):
            ng_post += 1
            print(f"[SKIP] invalid row service_id={sid!r}")
            continue

        st, msg = request_json(args.base, args.endpoint, token, "POST", body)
        if 200 <= st < 300:
            ok_post += 1
            continue

        put_ep = f"{args.endpoint}/{urllib.parse.quote(sid, safe='')}"
        st2, msg2 = request_json(args.base, put_ep, token, "PUT", body)
        if 200 <= st2 < 300:
            ok_put += 1
        else:
            ng_put += 1
            print(f"[NG] {sid} POST={st} PUT={st2} msg={msg2[:200]}")

    print("=== service import summary ===")
    print(f"POST ok={ok_post} ng={ng_post}")
    print(f"PUT  ok={ok_put} ng={ng_put}")

    return 0 if ng_put == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
