#!/usr/bin/env python3
"""
業務報告テーブル（デフォルト misesapo-sales-work-reports）を Scan し、
件数と先頭数件の log_id を表示する。テーブルが空かどうか確認する用。
実行: python3 scripts/list_work_reports_table.py [limit]
例: python3 scripts/list_work_reports_table.py
    python3 scripts/list_work_reports_table.py 10
"""
import os
import sys

import boto3

TABLE_NAME = os.environ.get('UNIVERSAL_WORK_LOGS_TABLE', 'misesapo-sales-work-reports')
DEFAULT_LIMIT = 5


def main():
    limit = DEFAULT_LIMIT
    if len(sys.argv) >= 2:
        try:
            limit = int(sys.argv[1])
        except ValueError:
            limit = DEFAULT_LIMIT

    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(TABLE_NAME)
    resp = table.scan(Limit=limit * 3)  # 多めに取得してから limit 件表示
    items = resp.get('Items', [])
    count = len(items)
    while resp.get('LastEvaluatedKey') and count < limit * 2:
        resp = table.scan(Limit=limit * 3, ExclusiveStartKey=resp['LastEvaluatedKey'])
        items.extend(resp.get('Items', []))
        count = len(items)

    total_approx = count
    if resp.get('LastEvaluatedKey'):
        total_approx = f'{count}+'

    print(f'Table: {TABLE_NAME}')
    print(f'Items (this scan): {total_approx}')
    for i, it in enumerate(items[:limit]):
        log_id = it.get('log_id', '—')
        work_date = it.get('work_date', '—')
        state = it.get('state', '—')
        print(f'  [{i+1}] log_id={log_id} work_date={work_date} state={state}')
    if not items:
        print('  (no items)')


if __name__ == '__main__':
    main()
