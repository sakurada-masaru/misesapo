#!/usr/bin/env python3
"""
全ユーザーを最新情報に同期するスクリプト（強制更新版）
既存情報を完全に廃棄し、提供されたリストの情報のみで更新します。
"""

import urllib.request
import urllib.parse
import json
import time
from datetime import datetime, timezone

API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'

# 最新のユーザーリスト（提供された情報）
LATEST_USERS = [
    {'id': 'W001', 'name': '遠藤虹輝', 'email': 'endo@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    {'id': 'W004', 'name': '板橋隆二', 'email': 'itabashi@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    {'id': 'W011', 'name': '熊谷円', 'email': 'kumagai@misesapo.co.jp', 'role': 'office', 'department': '営業事務'},
    {'id': 'W012', 'name': '増田優香', 'email': 'masuda@misesapo.co.jp', 'role': 'office', 'department': '営業事務'},
    {'id': 'W003', 'name': '中島郁哉', 'email': 'nakajima@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    {'id': 'W013', 'name': '生井剛', 'email': 'namai@misesapo.co.jp', 'role': 'sales', 'department': '営業'},
    {'id': 'W019', 'name': '夏目倫之助', 'email': 'natsume@misesapo.co.jp', 'role': 'developer', 'department': '開発'},
    {'id': 'W017', 'name': '岡本涼子', 'email': 'okamoto@misesapo.co.jp', 'role': 'office', 'department': '営業事務'},
    {'id': 'W009', 'name': '沖智弘', 'email': 'oki@misesapo.co.jp', 'role': 'sales', 'department': '営業'},
    {'id': 'W010', 'name': '北野康平', 'email': 'okitano@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    {'id': 'W007', 'name': '大野幹太', 'email': 'ono@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    {'id': 'W014', 'name': '太田真也', 'email': 'ota@misesapo.co.jp', 'role': 'admin', 'department': '開発'},
    {'id': 'W999', 'name': '櫻田傑', 'email': 'sakurada@misesapo.co.jp', 'role': 'admin', 'department': '開発'},
    {'id': 'W006', 'name': '佐々木一真', 'email': 'sasaki@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    {'id': 'W008', 'name': '平鋭未', 'email': 'taira@misesapo.co.jp', 'role': 'sales', 'department': '営業'},
    {'id': 'W020', 'name': '竹内那海', 'email': 'takeuchi@misesapo.co.jp', 'role': 'developer', 'department': '開発'},
    {'id': 'W002', 'name': '梅岡アレサンドレユウジ', 'email': 'umeoka@misesapo.co.jp', 'role': 'staff', 'department': '営業'},
    {'id': 'W018', 'name': '山村明広', 'email': 'yamamura@misesapo.co.jp', 'role': 'developer', 'department': '開発'},
    {'id': 'W005', 'name': '吉井奎吾', 'email': 'yoshii@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    # 正田和輝は最後にリストされているため、W001を上書きします
    {'id': 'W001', 'name': '正田和輝', 'email': 'frappe.manma@gmail.com', 'role': 'operation', 'department': '経営本部'},
]

# ロールコードマッピング
ROLE_CODE_MAP = {
    'admin': '1',
    'sales': '2',
    'office': '3',
    'staff': '4',
    'developer': '5',
    'designer': '6',
    'general_affairs': '7',
    'operation': '8',
    'contractor': '9',
    'accounting': '10',
    'human_resources': '11'
}

def get_existing_users():
    """既存のユーザーを取得"""
    try:
        url = f'{API_BASE}/workers'
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            workers = data if isinstance(data, list) else (data.get('items') or data.get('workers') or [])
            return {str(w.get('id')): w for w in workers if w.get('id')}
    except Exception as e:
        print(f'既存ユーザーの取得に失敗: {e}')
        return {}

def get_user_by_id(user_id):
    """IDでユーザーを直接取得"""
    try:
        url = f'{API_BASE}/workers/{urllib.parse.quote(str(user_id))}'
        with urllib.request.urlopen(url) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    except Exception:
        return None

def force_update_user(user_data):
    """ユーザーを強制更新（既存情報を完全に廃棄）"""
    user_id = user_data['id']
    
    # 既存ユーザーを確認
    existing_user = get_user_by_id(user_id)
    
    # 提供されたリストの情報のみを使用（既存情報は一切保持しない）
    now = datetime.now(timezone.utc).isoformat() + 'Z'
    data = {
        'id': user_id,
        'name': user_data['name'],
        'email': user_data['email'],
        'role': user_data['role'],
        'department': user_data['department'],
        'status': 'active',
        'role_code': ROLE_CODE_MAP.get(user_data['role'], '4'),
        'updated_at': now
    }
    
    # created_atのみ既存があれば保持
    if existing_user and existing_user.get('created_at'):
        data['created_at'] = existing_user['created_at']
    else:
        data['created_at'] = now
    
    try:
        if existing_user:
            # PUTで更新
            url = f'{API_BASE}/workers/{urllib.parse.quote(str(user_id))}'
            method = 'PUT'
            action = '更新'
        else:
            # POSTで作成
            url = f'{API_BASE}/workers'
            method = 'POST'
            action = '作成'
        
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method=method
        )
        
        with urllib.request.urlopen(req) as response:
            if response.status in [200, 201]:
                # 更新後、実際に反映されたか確認
                time.sleep(0.3)
                updated_user = get_user_by_id(user_id)
                if updated_user:
                    actual_email = updated_user.get('email', '') or ''
                    actual_name = updated_user.get('name', '') or ''
                    if actual_email.lower() == user_data['email'].lower() and actual_name == user_data['name']:
                        print(f'✓ {action}: {user_id} - {user_data["name"]} ({user_data["email"]})')
                        return True
                    else:
                        print(f'⚠ {action}: {user_id} - 反映確認失敗 (DB: {actual_name}/{actual_email}, 期待: {user_data["name"]}/{user_data["email"]})')
                        return False
                else:
                    print(f'✓ {action}: {user_id} - {user_data["name"]} ({user_data["email"]})')
                    return True
            else:
                print(f'✗ {action}失敗: {user_id} - ステータス: {response.status}')
                return False
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f'✗ {action}失敗: {user_id} - HTTP {e.code}: {error_body}')
        return False
    except Exception as e:
        print(f'✗ {action}失敗: {user_id} - {e}')
        return False

def delete_user(user_id):
    """ユーザーを削除"""
    try:
        url = f'{API_BASE}/workers/{urllib.parse.quote(str(user_id))}'
        req = urllib.request.Request(url, method='DELETE')
        
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                print(f'✓ 削除: {user_id}')
                return True
            else:
                print(f'✗ 削除失敗: {user_id} - ステータス: {response.status}')
                return False
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f'⚠ 削除スキップ（存在しない）: {user_id}')
            return True
        error_body = e.read().decode()
        print(f'✗ 削除失敗: {user_id} - HTTP {e.code}: {error_body}')
        return False
    except Exception as e:
        print(f'✗ 削除失敗: {user_id} - {e}')
        return False

def main():
    print('=== 全ユーザー同期開始（強制更新） ===\n')
    
    # 既存ユーザーを取得
    existing_users = get_existing_users()
    print(f'既存ユーザー数: {len(existing_users)}\n')
    
    # 最新リストのユーザーIDセット
    latest_user_ids = {user['id'] for user in LATEST_USERS}
    
    # 1. 最新リストのユーザーを強制更新/作成
    print('【強制更新・作成】')
    for user_data in LATEST_USERS:
        force_update_user(user_data)
        time.sleep(0.2)  # API負荷軽減
    
    print()
    
    # 2. リストにないユーザーを削除
    print('【削除】')
    users_to_delete = set(existing_users.keys()) - latest_user_ids
    # IDが数字だけのもの（1, 2, 3, 4など）も削除対象
    users_to_delete.update([uid for uid in existing_users.keys() if uid.isdigit()])
    
    if users_to_delete:
        for user_id in sorted(users_to_delete):
            user = existing_users.get(user_id)
            if user:
                name = user.get('name', 'N/A')
                email = user.get('email', 'N/A')
                print(f'削除対象: {user_id} - {name} ({email})')
            delete_user(user_id)
            time.sleep(0.2)
    else:
        print('削除対象なし')
    
    print()
    print('=== 同期完了 ===')
    
    # 最終確認
    print('\n【最終確認】')
    time.sleep(1)  # 削除処理が完了するまで待機
    final_users = get_existing_users()
    print(f'最終ユーザー数: {len(final_users)}')
    
    # 期待されるユーザーを表示
    print('\n【期待されるユーザー】')
    for user_data in LATEST_USERS:
        user_id = user_data['id']
        user = final_users.get(user_id)
        if user:
            email = user.get('email', 'N/A') or 'N/A'
            name = user.get('name', 'N/A') or 'N/A'
            role = user.get('role', 'N/A') or 'N/A'
            expected_email = user_data['email']
            expected_name = user_data['name']
            expected_role = user_data['role']
            
            email_match = email.lower() == expected_email.lower()
            name_match = name == expected_name
            role_match = role == expected_role
            
            if email_match and name_match and role_match:
                print(f'✓ {user_id}: {name} - {email} ({role})')
            else:
                print(f'✗ {user_id}: 不一致')
                print(f'  期待: {expected_name} - {expected_email} ({expected_role})')
                print(f'  実際: {name} - {email} ({role})')
        else:
            print(f'✗ {user_id}: 存在しない - {user_data["name"]} ({user_data["email"]})')

if __name__ == '__main__':
    main()

