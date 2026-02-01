#!/usr/bin/env python3
"""
テスト用に業務報告テーブル（デフォルト misesapo-sales-work-reports）に1件挿入するスクリプト。既存の WORK REPORT は使わない。
事務UI（/office/work-reports）の一覧で「未承認」として表示される想定。
実行: AWS_PROFILE=your_profile python scripts/create_one_test_work_report.py
"""
import os
import sys
import uuid
import boto3
from datetime import datetime, timedelta, timezone

# プロジェクトルートをパスに追加（universal_work_reports の定数を使う場合用）
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TABLE_NAME = os.environ.get('UNIVERSAL_WORK_LOGS_TABLE', 'misesapo-sales-work-reports')


def jst_now():
    return datetime.now(timezone(timedelta(hours=9)))


def main():
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(TABLE_NAME)

    now = jst_now()
    work_date = now.strftime('%Y-%m-%d')  # 直近7日で一覧に出る

    log_id = str(uuid.uuid4())
    worker_id = 'test-worker-001'
    state = 'submitted'  # 未承認として表示される

    history = [
        {
            'at': now.isoformat(),
            'by': worker_id,
            'type': 'state',
            'from_state': None,
            'to_state': 'submitted',
        }
    ]

    item = {
        'log_id': log_id,
        'worker_id': worker_id,
        'work_date': work_date,
        'date': work_date,
        'start_at': '09:00',
        'end_at': '18:00',
        'next_day': False,
        'break_minutes': 60,
        'work_minutes': 480,
        'category': 'cleaning',
        'description': '',
        'deliverables': '',
        'ref_type': 'none',
        'ref_id': '',
        'pay_code': '',
        'template_id': 'CLEANING_PDF',
        'target_label': 'テスト対象店舗A',
        'state': state,
        'version': 1,
        'updated_at': now.isoformat(),
        'created_at': now.isoformat(),
        'history': history,
    }
    # DynamoDB は None を許容しないので除外
    item = {k: v for k, v in item.items() if v is not None}

    table.put_item(Item=item)
    print(f"Created 1 test work report: log_id={log_id}, work_date={work_date}, state={state}")
    print(f"Table: {TABLE_NAME}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
