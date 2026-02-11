#!/usr/bin/env python3
import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

import boto3


def load_token(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def api_request(base: str, path: str, token: str, method: str = "GET", body: dict | None = None):
    url = f"{base.rstrip('/')}{path}"
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
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


def fetch_all_jinzai(base: str, token: str) -> list[dict]:
    # current API supports limit; use large limit for now
    status, body = api_request(base, "/jinzai?limit=2000&jotai=yuko", token, "GET")
    if status < 200 or status >= 300:
        raise RuntimeError(f"GET /jinzai failed: status={status}, body={body[:300]}")
    parsed = json.loads(body or "{}")
    items = parsed.get("items") if isinstance(parsed, dict) else None
    if not isinstance(items, list):
        return []
    return items


def list_cognito_users(user_pool_id: str, region: str) -> list[dict]:
    client = boto3.client("cognito-idp", region_name=region)
    users = []
    pagination = client.get_paginator("list_users")
    for page in pagination.paginate(UserPoolId=user_pool_id):
        users.extend(page.get("Users", []))
    return users


def attr(user: dict, name: str) -> str:
    for a in user.get("Attributes", []):
        if a.get("Name") == name:
            return a.get("Value", "")
    return ""


def normalize_email(v: str) -> str:
    return (v or "").strip().lower()


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Cognito sub into jinzai records by email match.")
    parser.add_argument("--base", required=True, help="e.g. https://<api-id>.execute-api.ap-northeast-1.amazonaws.com/prod")
    parser.add_argument("--token-file", default=str(Path.home() / ".cognito_token"))
    parser.add_argument("--user-pool-id", default="ap-northeast-1_EDKElIGoC")
    parser.add_argument("--region", default="ap-northeast-1")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    token = load_token(Path(args.token_file))
    jinzai_items = fetch_all_jinzai(args.base, token)
    cognito_users = list_cognito_users(args.user_pool_id, args.region)

    email_to_jinzai: dict[str, list[dict]] = defaultdict(list)
    for item in jinzai_items:
        em = normalize_email(item.get("email", ""))
        if em:
            email_to_jinzai[em].append(item)

    email_to_sub: dict[str, str] = {}
    duplicate_cognito_email = set()
    for u in cognito_users:
        em = normalize_email(attr(u, "email"))
        sub = attr(u, "sub")
        if not em or not sub:
            continue
        if em in email_to_sub and email_to_sub[em] != sub:
            duplicate_cognito_email.add(em)
        else:
            email_to_sub[em] = sub

    ok = 0
    ng = 0
    skip = 0
    duplicate_jinzai = 0
    duplicate_cognito = 0

    for email, rows in email_to_jinzai.items():
        if len(rows) > 1:
            duplicate_jinzai += 1
            for r in rows:
                print(f"[SKIP duplicate jinzai email] {email} -> {r.get('jinzai_id')}")
            continue
        if email in duplicate_cognito_email:
            duplicate_cognito += 1
            print(f"[SKIP duplicate cognito email] {email}")
            continue
        sub = email_to_sub.get(email)
        if not sub:
            skip += 1
            continue

        item = rows[0]
        current_sub = (item.get("cognito_sub") or "").strip()
        if current_sub == sub:
            skip += 1
            continue

        jinzai_id = item.get("jinzai_id", "")
        if not jinzai_id:
            skip += 1
            continue

        body = dict(item)
        body["cognito_sub"] = sub
        body.pop("created_at", None)
        path = f"/jinzai/{urllib.parse.quote(jinzai_id, safe='')}"

        if args.dry_run:
            print(f"[DRY] PUT {jinzai_id} email={email} cognito_sub={sub}")
            ok += 1
            continue

        status, resp_body = api_request(args.base, path, token, "PUT", body)
        if 200 <= status < 300:
            ok += 1
            print(f"[OK] {jinzai_id} {email}")
        else:
            ng += 1
            print(f"[NG] {jinzai_id} status={status} body={resp_body[:300]}")

    print("=== sync summary ===")
    print(f"ok={ok} ng={ng} skip={skip}")
    print(f"duplicate_jinzai_email={duplicate_jinzai}")
    print(f"duplicate_cognito_email={duplicate_cognito}")

    return 0 if ng == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

