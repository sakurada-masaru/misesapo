#!/usr/bin/env python3
"""
ICSファイルを直接DynamoDBに取り込むスクリプト
先週の日曜日以降のデータのみを取り込みます
"""

import sys
import os
import json
import boto3
from datetime import datetime, timedelta, timezone
from boto3.dynamodb.conditions import Attr

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# lambda_function.pyから必要な関数をインポート
try:
    from lambda_function import parse_ics_content, get_max_sequence_for_date
    SCHEDULES_TABLE_NAME = 'schedules'
except ImportError:
    print("Error: lambda_function.pyが見つかりません")
    sys.exit(1)

def get_last_sunday():
    """先週の日曜日を取得"""
    today = datetime.now()
    # 今日が何曜日か（0=月曜日、6=日曜日）
    days_since_sunday = (today.weekday() + 1) % 7
    # 先週の日曜日 = 今日から (days_since_sunday + 7) 日前
    last_sunday = today - timedelta(days=days_since_sunday + 7)
    return last_sunday.strftime('%Y-%m-%d')

def hhmm_to_minutes(hhmm):
    """HH:MM形式を分に変換"""
    try:
        parts = hhmm.split(':')
        return int(parts[0]) * 60 + int(parts[1])
    except:
        return 540  # デフォルト9:00

def minutes_to_hhmm(minutes):
    """分をHH:MM形式に変換"""
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"

def import_ics_file(ics_file_path, from_date=None, to_date=None):
    """ICSファイルを読み込んでDynamoDBに保存"""
    
    # DynamoDB接続
    dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
    schedules_table = dynamodb.Table(SCHEDULES_TABLE_NAME)
    
    # ICSファイルを読み込み
    print(f"📖 ICSファイルを読み込み中: {ics_file_path}")
    with open(ics_file_path, 'r', encoding='utf-8') as f:
        ics_content = f.read()
    
    # 日付範囲の設定
    if not from_date:
        from_date = get_last_sunday()
    if not to_date:
        # 90日後
        to_date = (datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d')
    
    print(f"📅 取り込み期間: {from_date} 〜 {to_date}")
    
    # ICSをパース
    print("🔍 ICSファイルをパース中...")
    events = parse_ics_content(ics_content, from_date, to_date)
    print(f"✅ {len(events)}件のイベントが見つかりました")
    
    if len(events) == 0:
        print("⚠️  取り込むイベントがありません")
        return
    
    # 既存のexternal_idをチェック（重複防止）
    print("🔍 既存データの重複チェック中...")
    existing_external_ids = set()
    try:
        scan_response = schedules_table.scan(
            ProjectionExpression='external_id',
            FilterExpression=Attr('external_id').exists()
        )
        for item in scan_response.get('Items', []):
            ext_id = item.get('external_id')
            if ext_id:
                existing_external_ids.add(ext_id)
        
        # ページネーション対応
        while 'LastEvaluatedKey' in scan_response:
            scan_response = schedules_table.scan(
                ProjectionExpression='external_id',
                FilterExpression=Attr('external_id').exists(),
                ExclusiveStartKey=scan_response['LastEvaluatedKey']
            )
            for item in scan_response.get('Items', []):
                ext_id = item.get('external_id')
                if ext_id:
                    existing_external_ids.add(ext_id)
        
        print(f"✅ 既存データ: {len(existing_external_ids)}件")
    except Exception as e:
        print(f"⚠️  重複チェックでエラー: {str(e)}")
    
    # 日付ごとにグループ化して、各日付の最大連番を事前に取得（パフォーマンス最適化）
    print("🔢 日付ごとの最大連番を取得中...")
    date_to_max_seq = {}
    unique_dates = set()
    for event_data in events:
        date_str = event_data.get('date')
        if date_str:
            unique_dates.add(date_str)
    
    for date_str in unique_dates:
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            date_prefix = date_obj.strftime('%Y%m%d')
            max_seq = get_max_sequence_for_date(schedules_table, date_prefix)
            date_to_max_seq[date_str] = max_seq
        except Exception as e:
            print(f"⚠️  {date_str}の最大連番取得でエラー: {str(e)}")
            date_to_max_seq[date_str] = 0
    
    # 日付ごとの連番カウンター
    date_seq_counters = {date: date_to_max_seq[date] for date in unique_dates}
    
    # スケジュールを作成
    inserted = 0
    skipped = 0
    errors = []
    
    print(f"\n💾 DynamoDBに保存中...")
    for i, event_data in enumerate(events, 1):
        external_id = event_data.get('uid')
        if not external_id:
            errors.append({'event': event_data.get('summary', 'Unknown'), 'error': 'UID not found'})
            continue
        
        # 重複チェック
        if external_id in existing_external_ids:
            skipped += 1
            if i % 100 == 0:
                print(f"  進捗: {i}/{len(events)}件処理済み（追加: {inserted}件、スキップ: {skipped}件）")
            continue
        
        try:
            # スケジュールID生成（事前取得した最大連番を使用）
            date_str = event_data.get('date')
            if not date_str:
                errors.append({'event': event_data.get('summary', 'Unknown'), 'error': 'Date not found'})
                continue
            
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            date_prefix = date_obj.strftime('%Y%m%d')
            
            # 日付ごとの連番をインクリメント
            if date_str not in date_seq_counters:
                date_seq_counters[date_str] = 0
            date_seq_counters[date_str] += 1
            seq_str = str(date_seq_counters[date_str]).zfill(3)
            schedule_id = f"SCH-{date_prefix}-{seq_str}"
            
            now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            
            schedule_item = {
                'id': schedule_id,
                'scheduled_date': date_str,
                'date': date_str,  # 互換性のため
                'start_time': event_data.get('start_time', '09:00'),
                'end_time': event_data.get('end_time', '10:00'),
                'start_min': event_data.get('start_min', 540),  # 9:00
                'end_min': event_data.get('end_min', 600),  # 10:00
                'service': 'cleaning',
                'status': 'scheduled',
                'work_type': 'external',  # 外部取り込み
                'origin': 'google_ics',
                'external_id': external_id,
                'target_name': event_data.get('summary', '外部予定'),
                'location': event_data.get('location', ''),
                'description': event_data.get('description', ''),
                'raw': json.dumps({
                    'summary': event_data.get('summary'),
                    'location': event_data.get('location'),
                    'description': event_data.get('description', '')[:500]  # 長すぎる場合は切り詰め
                }, ensure_ascii=False),
                'created_at': now,
                'updated_at': now
            }
            
            schedules_table.put_item(Item=schedule_item)
            existing_external_ids.add(external_id)
            inserted += 1
            
            if i % 100 == 0:
                print(f"  進捗: {i}/{len(events)}件処理済み（追加: {inserted}件、スキップ: {skipped}件）")
        except Exception as e:
            errors.append({
                'event': event_data.get('summary', 'Unknown'),
                'error': str(e)
            })
            print(f"❌ エラー: {event_data.get('summary', 'Unknown')} - {str(e)}")
    
    # 結果を表示
    print(f"\n✅ 取り込み完了！")
    print(f"  追加: {inserted}件")
    print(f"  スキップ（重複）: {skipped}件")
    if errors:
        print(f"  エラー: {len(errors)}件")
        for err in errors[:10]:  # 最初の10件のみ表示
            print(f"    - {err.get('event', 'Unknown')}: {err.get('error', 'Unknown error')}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python import_ics_to_db.py <ics_file_path> [from_date] [to_date]")
        print("Example: python import_ics_to_db.py ~/Downloads/basic.ics")
        print("         python import_ics_to_db.py ~/Downloads/basic.ics 2026-01-25 2026-05-01")
        sys.exit(1)
    
    ics_file_path = sys.argv[1]
    from_date = sys.argv[2] if len(sys.argv) > 2 else None
    to_date = sys.argv[3] if len(sys.argv) > 3 else None
    
    if not os.path.exists(ics_file_path):
        print(f"❌ エラー: ファイルが見つかりません: {ics_file_path}")
        sys.exit(1)
    
    import_ics_file(ics_file_path, from_date, to_date)
