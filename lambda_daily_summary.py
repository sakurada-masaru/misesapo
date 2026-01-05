"""
日報サマリーメール送信 Lambda関数

パターン1: 一般日報サマリー（19:00 JST）
- 対象: OS課・正田・太田を除く全従業員
- 内容: 日報の提出状況

パターン2: 清掃レポートサマリー（翌朝9:00 JST）
- 対象: OS課のみ
- 内容: 前日の清掃レポート内容
"""

import json
import boto3
from boto3.dynamodb.conditions import Key, Attr
from datetime import datetime, timedelta, timezone

# AWS クライアント
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
ses_client = boto3.client('ses', region_name='ap-northeast-1')

# テーブル
WORKERS_TABLE = dynamodb.Table('workers')
DAILY_REPORTS_TABLE = dynamodb.Table('misesapo-daily-reports')
REPORTS_TABLE = dynamodb.Table('misesapo-reports')

# 定数
JST = timezone(timedelta(hours=9))  # JST = UTC+9
SENDER_EMAIL = 'info@misesapo.co.jp'
RECIPIENT_EMAIL = 'info@misesapo.co.jp'

# 除外対象（OS課の清掃員は別途処理、CEOの正田・太田・高木は除外）
EXCLUDED_NAMES = ['正田', '太田', '高木']  # 名前に含まれていれば除外


def lambda_handler(event, context):
    """
    メインハンドラー
    event['type'] で処理を分岐:
    - 'general': 一般日報サマリー（19:00）
    - 'cleaning': 清掃レポートサマリー（9:00）
    """
    summary_type = event.get('type', 'general')
    
    try:
        if summary_type == 'general':
            return send_general_daily_report_summary()
        elif summary_type == 'cleaning':
            return send_cleaning_report_summary()
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': f'Unknown summary type: {summary_type}'})
            }
    except Exception as e:
        print(f'Error in lambda_handler: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }


def send_general_daily_report_summary():
    """
    パターン1: 一般日報サマリー（19:00）
    OS課・正田・太田を除く全従業員の日報提出状況
    """
    now = datetime.now(JST)
    today = now.strftime('%Y-%m-%d')
    
    print(f'[GeneralSummary] Generating summary for {today}')
    
    # 全従業員を取得
    workers_response = WORKERS_TABLE.scan(
        FilterExpression=Attr('status').eq('active') | Attr('status').not_exists()
    )
    all_workers = workers_response.get('Items', [])
    
    # OS課と正田・太田を除外
    target_workers = []
    for worker in all_workers:
        department = worker.get('department', '') or ''
        name = worker.get('name', '') or ''
        
        # OS課を除外
        if department == 'OS課' or department == '現場':
            continue
        
        # 正田・太田を除外
        if any(excluded in name for excluded in EXCLUDED_NAMES):
            continue
        
        target_workers.append(worker)
    
    print(f'[GeneralSummary] Target workers: {len(target_workers)}')
    
    # 本日の日報を取得
    try:
        reports_response = DAILY_REPORTS_TABLE.scan(
            FilterExpression=Attr('date').eq(today)
        )
        today_reports = reports_response.get('Items', [])
    except Exception as e:
        print(f'Error fetching daily reports: {e}')
        today_reports = []
    
    # 提出者のIDセット
    submitted_ids = {r.get('staff_id') for r in today_reports if r.get('staff_id')}
    
    # 提出者 / 未提出者を分類
    submitted = []
    not_submitted = []
    
    for worker in target_workers:
        worker_id = worker.get('id', '')
        worker_name = worker.get('name', '名前未設定')
        department = worker.get('department', '未設定')
        
        if worker_id in submitted_ids:
            submitted.append({'name': worker_name, 'department': department})
        else:
            not_submitted.append({'name': worker_name, 'department': department})
    
    # 提出率
    total = len(target_workers)
    rate = (len(submitted) / total * 100) if total > 0 else 0
    
    # メール本文を作成
    submitted_list = '\n'.join([f"  ・{s['name']} ({s['department']})" for s in submitted]) or '  （なし）'
    not_submitted_list = '\n'.join([f"  ・{s['name']} ({s['department']})" for s in not_submitted]) or '  （なし）'
    
    body = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 日報提出状況サマリー
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 対象日: {today}
📊 提出率: {rate:.0f}% ({len(submitted)}/{total}名)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 提出済み ({len(submitted)}名)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{submitted_list}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ 未提出 ({len(not_submitted)}名)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{not_submitted_list}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
※ このメールは自動送信されています。
※ OS課の清掃員は翌朝9:00に別途レポートサマリーが送信されます。
"""

    # メール送信
    subject = f'【日報サマリー】{today} - 提出率{rate:.0f}%'
    
    try:
        ses_client.send_email(
            Source=SENDER_EMAIL,
            Destination={'ToAddresses': [RECIPIENT_EMAIL]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {'Text': {'Data': body, 'Charset': 'UTF-8'}}
            }
        )
        print(f'[GeneralSummary] Email sent successfully')
    except Exception as e:
        print(f'[GeneralSummary] Failed to send email: {e}')
        raise e
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'General daily report summary sent',
            'date': today,
            'submitted': len(submitted),
            'not_submitted': len(not_submitted),
            'rate': rate
        })
    }


def send_cleaning_report_summary():
    """
    パターン2: 清掃レポートサマリー（翌朝9:00）
    OS課の前日の清掃レポート内容
    """
    now = datetime.now(JST)
    yesterday = (now - timedelta(days=1)).strftime('%Y-%m-%d')
    
    print(f'[CleaningSummary] Generating summary for {yesterday}')
    
    # OS課の従業員を取得
    workers_response = WORKERS_TABLE.scan(
        FilterExpression=(Attr('department').eq('OS課') | Attr('department').eq('現場')) & 
                         (Attr('status').eq('active') | Attr('status').not_exists())
    )
    os_workers = workers_response.get('Items', [])
    
    print(f'[CleaningSummary] OS workers: {len(os_workers)}')
    
    # 前日の清掃レポートを取得
    try:
        # created_atが前日のものを取得
        reports_response = REPORTS_TABLE.scan()
        all_reports = reports_response.get('Items', [])
        
        # 前日のレポートをフィルタリング
        yesterday_reports = []
        for report in all_reports:
            created_at = report.get('created_at', '')
            if created_at and created_at.startswith(yesterday):
                yesterday_reports.append(report)
    except Exception as e:
        print(f'Error fetching cleaning reports: {e}')
        yesterday_reports = []
    
    print(f'[CleaningSummary] Yesterday reports: {len(yesterday_reports)}')
    
    # レポート内容を整形
    if yesterday_reports:
        report_details = []
        for i, report in enumerate(yesterday_reports, 1):
            staff_name = report.get('staff_name', '不明')
            store_name = report.get('store_name', '店舗不明')
            status = report.get('status', '完了')
            created_at = report.get('created_at', '')
            
            # 時刻を抽出
            time_str = ''
            if created_at:
                try:
                    dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    time_str = dt.astimezone(JST).strftime('%H:%M')
                except:
                    time_str = created_at
            
            report_details.append(f"""
  [{i}] {store_name}
      担当: {staff_name}
      時刻: {time_str}
      状態: {status}
""")
        
        reports_text = '\n'.join(report_details)
    else:
        reports_text = '  （レポートなし）'
    
    # 提出者 / 未提出者を分類
    submitted_ids = {r.get('staff_id') or r.get('user_id') for r in yesterday_reports}
    
    submitted = []
    not_submitted = []
    
    for worker in os_workers:
        worker_id = worker.get('id', '')
        worker_name = worker.get('name', '名前未設定')
        
        if worker_id in submitted_ids:
            submitted.append(worker_name)
        else:
            not_submitted.append(worker_name)
    
    # 提出率
    total = len(os_workers)
    rate = (len(submitted) / total * 100) if total > 0 else 0
    
    # 未提出者リスト
    not_submitted_list = '\n'.join([f"  ・{name}" for name in not_submitted]) or '  （なし）'
    
    # メール本文を作成
    body = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧹 清掃レポートサマリー（OS課）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 対象日: {yesterday}（前日分）
📊 提出率: {rate:.0f}% ({len(submitted)}/{total}名)
📝 レポート数: {len(yesterday_reports)}件

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 レポート内容
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{reports_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ 未提出者 ({len(not_submitted)}名)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{not_submitted_list}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
※ このメールは自動送信されています。
"""

    # メール送信
    subject = f'【清掃レポート】{yesterday} - OS課 {len(yesterday_reports)}件'
    
    try:
        ses_client.send_email(
            Source=SENDER_EMAIL,
            Destination={'ToAddresses': [RECIPIENT_EMAIL]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {'Text': {'Data': body, 'Charset': 'UTF-8'}}
            }
        )
        print(f'[CleaningSummary] Email sent successfully')
    except Exception as e:
        print(f'[CleaningSummary] Failed to send email: {e}')
        raise e
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Cleaning report summary sent',
            'date': yesterday,
            'reports': len(yesterday_reports),
            'rate': rate
        })
    }


# テスト用
if __name__ == '__main__':
    # 一般日報サマリーテスト
    print('Testing general summary...')
    result = lambda_handler({'type': 'general'}, None)
    print(result)
    
    # 清掃レポートサマリーテスト
    print('\nTesting cleaning summary...')
    result = lambda_handler({'type': 'cleaning'}, None)
    print(result)
