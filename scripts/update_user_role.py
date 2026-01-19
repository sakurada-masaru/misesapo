#!/usr/bin/env python3
"""
ユーザーロールをAPI経由で更新するスクリプト
"""
import json
import urllib.request
import urllib.parse
from datetime import datetime, timezone

API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'

def get_user_by_email(email):
    """メールアドレスでユーザーを検索"""
    try:
        url = f'{API_BASE}/workers?email={urllib.parse.quote(email)}'
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            workers = data if isinstance(data, list) else (data.get('items') or data.get('workers') or [])
            if workers:
                return workers[0]
    except Exception as e:
        print(f'Error fetching user: {e}')
    return None

def get_user_by_id(user_id):
    """IDでユーザーを取得"""
    try:
        url = f'{API_BASE}/workers/{user_id}'
        with urllib.request.urlopen(url) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f'Error fetching user: {e}')
    return None

def update_user_role(user_id, role, role_code):
    """ユーザーのロールを更新"""
    # まず現在のユーザー情報を取得
    user = get_user_by_id(user_id)
    if not user:
        print(f'ユーザー {user_id} が見つかりません')
        return False
    
    # 更新データを準備
    update_data = {
        'name': user.get('name', ''),
        'email': user.get('email', ''),
        'phone': user.get('phone', ''),
        'role': role,
        'role_code': role_code,
        'department': user.get('department', ''),
        'status': user.get('status', 'active'),
        'scheduled_start_time': user.get('scheduled_start_time', '09:00'),
        'scheduled_end_time': user.get('scheduled_end_time', '18:00'),
        'scheduled_work_hours': user.get('scheduled_work_hours', 8),
        'updated_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    }
    
    # 既存のフィールドがあれば保持
    if 'created_at' in user:
        update_data['created_at'] = user['created_at']
    
    try:
        url = f'{API_BASE}/workers/{user_id}'
        data = json.dumps(update_data).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data,
            headers={'Content-Type': 'application/json'},
            method='PUT'
        )
        
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                print(f'✓ ユーザー {user_id} ({user.get("name", "N/A")}) のロールを {role} に更新しました')
                return True
            else:
                print(f'✗ 更新に失敗しました: {response.status} - {response.read().decode()}')
                return False
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else 'Unknown error'
        print(f'✗ 更新に失敗しました: {e.code} - {error_body}')
        return False
    except Exception as e:
        print(f'✗ エラーが発生しました: {e}')
        return False

if __name__ == '__main__':
    import sys
    
    # コマンドライン引数から取得、またはデフォルト値を使用
    if len(sys.argv) >= 3:
        email_or_id = sys.argv[1]
        role = sys.argv[2]
    else:
        # デフォルト: sakurada@misesapo.co.jp を admin に
        email_or_id = 'sakurada@misesapo.co.jp'
        role = 'admin'
    
    # ロールコードマッピング
    role_code_map = {
        'admin': '1',
        'sales': '2',
        'office': '3',
        'cleaning': '4',
        'public_relations': '5',
        'designer': '6',
        'general_affairs': '7',
        'director': '8',
        'contractor': '9',
        'accounting': '10',
        'human_resources': '11',
        'special_advisor': '12',
        'field_sales': '13',
        'inside_sales': '14',
        'mechanic': '15',
        'engineer': '16',
        'part_time': '17'
    }
    
    role_code = role_code_map.get(role, '4')
    
    # ユーザーIDを取得
    user_id = None
    if email_or_id.startswith('W'):
        # IDが指定されている場合
        user_id = email_or_id
    else:
        # メールアドレスが指定されている場合
        user = get_user_by_email(email_or_id)
        if user:
            user_id = user.get('id')
            print(f'ユーザーが見つかりました: {user.get("name")} (ID: {user_id})')
        else:
            print(f'ユーザー {email_or_id} が見つかりません')
            sys.exit(1)
    
    if not user_id:
        print('ユーザーIDが取得できませんでした')
        sys.exit(1)
    
    # ロールを更新
    success = update_user_role(user_id, role, role_code)
    sys.exit(0 if success else 1)

