#!/usr/bin/env python3
"""
DynamoDB workers テーブルを Scan し、件数と id / name / email / role を表示する。
本番の「誰がどの role か」を確認する用。
実行: python3 scripts/list_workers_table.py [limit]
例: python3 scripts/list_workers_table.py
    python3 scripts/list_workers_table.py 50
"""
import os
import sys

import boto3

TABLE_NAME = os.environ.get('WORKERS_TABLE', 'workers')
REGION = os.environ.get('AWS_REGION', 'ap-northeast-1')
DEFAULT_LIMIT = 100


def main():
    limit = DEFAULT_LIMIT
    if len(sys.argv) >= 2:
        try:
            limit = int(sys.argv[1])
        except ValueError:
            limit = DEFAULT_LIMIT

    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)

    items = []
    scan_kw = {}
    while True:
        resp = table.scan(**scan_kw)
        items.extend(resp.get('Items', []))
        if not resp.get('LastEvaluatedKey') or len(items) >= limit * 2:
            break
        scan_kw['ExclusiveStartKey'] = resp['LastEvaluatedKey']

    # id=9999 は除外（API と同様）
    items = [it for it in items if str(it.get('id', '')).strip() != '9999']
    total = len(items)
    display = items[:limit]

    print(f'Table: {TABLE_NAME} (region: {REGION})')
    print(f'Items: {total}' + (f' (showing first {limit})' if total > limit else ''))
    print()
    print(f'{"id":<8} {"name":<20} {"email":<35} {"role":<15}')
    print('-' * 82)
    for it in display:
        uid = (it.get('id') or '—')
        name = (it.get('name') or '—')[:18]
        email = (it.get('email') or '—')[:33]
        role = (it.get('role') or '—')
        print(f'{str(uid):<8} {name:<20} {email:<35} {role:<15}')
    if not display:
        print('  (no items)')


if __name__ == '__main__':
    main()
