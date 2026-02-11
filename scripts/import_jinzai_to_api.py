#!/usr/bin/env python3
import argparse
import csv
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path


def load_token(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def post_json(base: str, endpoint: str, token: str, body: dict) -> tuple[int, str]:
    url = f"{base.rstrip('/')}{endpoint}"
    req = urllib.request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        method="POST",
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


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--base", required=True, help="例: https://<api-id>.execute-api.ap-northeast-1.amazonaws.com/prod")
    p.add_argument("--token-file", default=str(Path.home() / ".cognito_token"))
    p.add_argument("--jinzai-csv", required=True)
    p.add_argument("--busho-csv", required=True)
    p.add_argument("--shokushu-csv", required=True)
    p.add_argument("--jinzai-endpoint", default="/jinzai")
    p.add_argument("--busho-endpoint", default="/jinzai/busho")
    p.add_argument("--shokushu-endpoint", default="/jinzai/shokushu")
    args = p.parse_args()

    token = load_token(Path(args.token_file))
    jinzai_rows = parse_csv(Path(args.jinzai_csv))
    busho_rows = parse_csv(Path(args.busho_csv))
    shokushu_rows = parse_csv(Path(args.shokushu_csv))

    summary = {"jinzai": [0, 0], "busho": [0, 0], "shokushu": [0, 0]}

    for row in busho_rows:
        status, _ = post_json(args.base, args.busho_endpoint, token, row)
        if 200 <= status < 300:
            summary["busho"][0] += 1
        else:
            summary["busho"][1] += 1

    for row in shokushu_rows:
        status, _ = post_json(args.base, args.shokushu_endpoint, token, row)
        if 200 <= status < 300:
            summary["shokushu"][0] += 1
        else:
            summary["shokushu"][1] += 1

    for row in jinzai_rows:
        # 配列JSON文字列を元に戻す
        for key in ("shokushu", "busho_ids"):
            val = row.get(key, "")
            if isinstance(val, str) and val.strip().startswith("["):
                try:
                    row[key] = json.loads(val)
                except Exception:
                    pass
        status, body = post_json(args.base, args.jinzai_endpoint, token, row)
        if 200 <= status < 300:
            summary["jinzai"][0] += 1
        else:
            summary["jinzai"][1] += 1
            print(f"[jinzai error] status={status} body={body[:400]}")

    print("=== import summary ===")
    print(f"busho   ok={summary['busho'][0]} ng={summary['busho'][1]}")
    print(f"shokushu ok={summary['shokushu'][0]} ng={summary['shokushu'][1]}")
    print(f"jinzai  ok={summary['jinzai'][0]} ng={summary['jinzai'][1]}")

    return 0 if all(v[1] == 0 for v in summary.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
