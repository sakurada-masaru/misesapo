#!/usr/bin/env python3
"""
業務報告テーブル（デフォルト misesapo-sales-work-reports）で log_id を指定して1件取得する。
GET /admin/work-reports/{id} が 404 になる場合、該当レコードがテーブルに存在するか確認する用。

実行（リポジトリルートで）:
  python3 scripts/get_work_report_by_id.py <log_id>

例:
  python3 scripts/get_work_report_by_id.py 28c19e6e-225f-4497-9148-24b491845c56

必要: AWS 認証（aws configure または環境変数）、boto3（pip3 install boto3）。
"""
import json
import os
import sys

try:
    import boto3
except ImportError:
    print('boto3 が入っていません。pip3 install boto3 を実行してください。', file=sys.stderr)
    sys.exit(1)

TABLE_NAME = os.environ.get('UNIVERSAL_WORK_LOGS_TABLE', 'misesapo-sales-work-reports')
REGION = os.environ.get('AWS_REGION', 'ap-northeast-1')


def main():
    if len(sys.argv) < 2:
        print('Usage: python3 scripts/get_work_report_by_id.py <log_id>', file=sys.stderr)
        print('例: python3 scripts/get_work_report_by_id.py 28c19e6e-225f-4497-9148-24b491845c56', file=sys.stderr)
        sys.exit(1)
    log_id = sys.argv[1].strip()

    try:
        dynamodb = boto3.resource('dynamodb', region_name=REGION)
        table = dynamodb.Table(TABLE_NAME)
        resp = table.get_item(Key={'log_id': log_id})
    except Exception as e:
        print(f'DynamoDB アクセスエラー: {e}', file=sys.stderr)
        print('AWS 認証を確認してください（aws configure または AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY）', file=sys.stderr)
        sys.exit(3)
    item = resp.get('Item')

    if not item:
        print(f'Not found: log_id={log_id} (table={TABLE_NAME})', file=sys.stderr)
        sys.exit(2)

    # 表示用に簡略化（description は長いので要約のみ）
    out = dict(item)
    if 'description' in out and isinstance(out['description'], str) and len(out['description']) > 200:
        out['description'] = out['description'][:200] + '...'
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()

