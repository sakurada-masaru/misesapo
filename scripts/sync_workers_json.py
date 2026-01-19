#!/usr/bin/env python3
"""
APIから最新のユーザー情報を取得してworkers.jsonを更新するスクリプト
"""
import json
import urllib.request
from datetime import datetime, timezone

API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'
WORKERS_JSON_PATH = 'src/data/workers.json'

def get_all_workers():
    """APIから全ユーザーを取得"""
    try:
        url = f'{API_BASE}/workers'
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            workers = data if isinstance(data, list) else (data.get('items') or data.get('workers') or [])
            return workers
    except Exception as e:
        print(f'Error fetching workers: {e}')
        return []

def normalize_worker(worker):
    """ユーザー情報を正規化"""
    # roleフィールドを優先、存在しない場合のみrole_codeから判定
    role_code = worker.get('role_code')
    role = worker.get('role')
    
    # roleフィールドがない場合のみ、role_codeから変換
    if not role or role == '':
    if role_code is not None:
        role_code_map = {
            '1': 'admin', '2': 'sales', '3': 'office', '4': 'staff',
            '5': 'developer', '6': 'designer', '7': 'general_affairs',
            '8': 'operation', '9': 'contractor', '10': 'accounting', '11': 'human_resources'
        }
            role = role_code_map.get(str(role_code), 'staff')
        else:
            role = 'staff'
    
    return {
        'id': str(worker.get('id', '')),
        'name': worker.get('name') or worker.get('display_name') or '',
        'email': worker.get('email') or worker.get('email_address') or '',
        'phone': worker.get('phone') or worker.get('phone_number') or '',
        'department': worker.get('department') or worker.get('team') or '',
        'role': role,
        'role_code': str(role_code) if role_code is not None else '4',
        'status': worker.get('status', 'active'),
        'scheduled_start_time': worker.get('scheduled_start_time', '09:00'),
        'scheduled_end_time': worker.get('scheduled_end_time', '18:00'),
        'scheduled_work_hours': worker.get('scheduled_work_hours', 8),
        'created_at': worker.get('created_at') or datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'updated_at': worker.get('updated_at') or datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    }

def sync_workers_json():
    """workers.jsonをAPIの最新情報で更新"""
    print('APIからユーザー情報を取得中...')
    workers = get_all_workers()
    
    if not workers:
        print('ユーザー情報が取得できませんでした')
        return False
    
    print(f'{len(workers)}名のユーザーを取得しました')
    
    # ユーザー情報を正規化
    normalized_workers = []
    for worker in workers:
        # 無効なユーザーを除外
        name = (worker.get('name') or worker.get('display_name') or '').strip()
        email = (worker.get('email') or worker.get('email_address') or '').strip()
        worker_id = str(worker.get('id', ''))
        
        # IDがない場合はスキップ
        if not worker_id or worker_id == 'None':
            continue
        
        # 名前がない場合はスキップ
        if not name:
            continue
        
        # 「ユーザー1」「ユーザー2」などのパターンを除外
        import re
        if name and re.match(r'^ユーザー\d+$', name):
            continue
        
        normalized_worker = normalize_worker(worker)
        normalized_workers.append(normalized_worker)
    
    # IDでソート
    normalized_workers.sort(key=lambda w: w['id'])
    
    print(f'{len(normalized_workers)}名のユーザーをworkers.jsonに保存します')
    
    # workers.jsonを更新
    try:
        with open(WORKERS_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(normalized_workers, f, ensure_ascii=False, indent=2)
        print(f'✓ {WORKERS_JSON_PATH} を更新しました')
        return True
    except Exception as e:
        print(f'✗ ファイルの更新に失敗しました: {e}')
        return False

if __name__ == '__main__':
    import sys
    success = sync_workers_json()
    sys.exit(0 if success else 1)

