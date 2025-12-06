#!/usr/bin/env python3
"""
DynamoDBに直接全ユーザーを更新するスクリプト
既存情報を完全に廃棄し、提供されたリストの情報のみで更新します。
"""

import json
import subprocess
from datetime import datetime, timezone

# 最新のユーザーリスト
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

ROLE_CODE_MAP = {
    'admin': '1', 'sales': '2', 'office': '3', 'staff': '4', 'developer': '5',
    'designer': '6', 'general_affairs': '7', 'operation': '8', 'contractor': '9',
    'accounting': '10', 'human_resources': '11'
}

def update_user_in_dynamodb(user_data, existing_created_at=None):
    """DynamoDBに直接ユーザーを更新"""
    user_id = user_data['id']
    now = datetime.now(timezone.utc).isoformat() + 'Z'
    
    # DynamoDBアイテムを作成
    item = {
        'id': {'S': user_id},
        'name': {'S': user_data['name']},
        'email': {'S': user_data['email']},
        'role': {'S': user_data['role']},
        'department': {'S': user_data['department']},
        'status': {'S': 'active'},
        'role_code': {'S': ROLE_CODE_MAP.get(user_data['role'], '4')},
        'updated_at': {'S': now}
    }
    
    # created_atは既存があれば保持
    if existing_created_at:
        item['created_at'] = {'S': existing_created_at}
    else:
        item['created_at'] = {'S': now}
    
    try:
        # AWS CLIでDynamoDBに直接put-item
        cmd = [
            'aws', 'dynamodb', 'put-item',
            '--table-name', 'workers',
            '--item', json.dumps(item, ensure_ascii=False),
            '--region', 'ap-northeast-1'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f'✓ 更新: {user_id} - {user_data["name"]} ({user_data["email"]})')
        return True
    except subprocess.CalledProcessError as e:
        print(f'✗ 更新失敗: {user_id} - {e.stderr}')
        return False
    except Exception as e:
        print(f'✗ 更新失敗: {user_id} - {e}')
        return False

def get_existing_user_from_dynamodb(user_id):
    """DynamoDBから直接ユーザーを取得"""
    try:
        cmd = [
            'aws', 'dynamodb', 'get-item',
            '--table-name', 'workers',
            '--key', json.dumps({'id': {'S': user_id}}),
            '--region', 'ap-northeast-1'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        if 'Item' in data:
            item = data['Item']
            return {
                'created_at': item.get('created_at', {}).get('S')
            }
    except subprocess.CalledProcessError:
        pass
    except Exception:
        pass
    return None

def delete_user_from_dynamodb(user_id):
    """DynamoDBから直接ユーザーを削除"""
    try:
        cmd = [
            'aws', 'dynamodb', 'delete-item',
            '--table-name', 'workers',
            '--key', json.dumps({'id': {'S': user_id}}),
            '--region', 'ap-northeast-1'
        ]
        
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f'✓ 削除: {user_id}')
        return True
    except subprocess.CalledProcessError as e:
        if 'ResourceNotFoundException' in e.stderr or 'not found' in e.stderr.lower():
            print(f'⚠ 削除スキップ（存在しない）: {user_id}')
            return True
        print(f'✗ 削除失敗: {user_id} - {e.stderr}')
        return False
    except Exception as e:
        print(f'✗ 削除失敗: {user_id} - {e}')
        return False

def main():
    print('=== DynamoDB直接更新開始 ===\n')
    
    # 1. 最新リストのユーザーを更新/作成
    print('【更新・作成】')
    for user_data in LATEST_USERS:
        user_id = user_data['id']
        existing = get_existing_user_from_dynamodb(user_id)
        created_at = existing.get('created_at') if existing else None
        update_user_in_dynamodb(user_data, created_at)
    
    print()
    
    # 2. リストにないユーザーを削除
    print('【削除】')
    latest_user_ids = {user['id'] for user in LATEST_USERS}
    
    # 既存ユーザーを取得（API経由）
    import urllib.request
    try:
        url = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/workers'
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            workers = data if isinstance(data, list) else (data.get('items') or data.get('workers') or [])
            existing_user_ids = {str(w.get('id')) for w in workers if w.get('id')}
            
            users_to_delete = existing_user_ids - latest_user_ids
            users_to_delete.update([uid for uid in existing_user_ids if uid.isdigit()])
            
            if users_to_delete:
                for user_id in sorted(users_to_delete):
                    delete_user_from_dynamodb(user_id)
            else:
                print('削除対象なし')
    except Exception as e:
        print(f'既存ユーザー取得エラー: {e}')
    
    print()
    print('=== 更新完了 ===')

if __name__ == '__main__':
    main()

