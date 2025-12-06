#!/usr/bin/env python3
"""
ユーザーをAPI経由で作成するスクリプト
"""
import json
import urllib.request
import urllib.parse
from datetime import datetime, timezone

API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'

def create_worker(user_id, name, email, role='admin', role_code='1', department='開発', phone='', status='active'):
    """ユーザーを作成"""
    try:
        # ロールコードマッピング
        role_code_map = {
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
        
        role_code = role_code_map.get(role, role_code)
        
        # ユーザーデータを準備
        worker_data = {
            'id': str(user_id),
            'name': name,
            'email': email,
            'phone': phone,
            'role': role,
            'role_code': role_code,
            'department': department,
            'status': status,
            'scheduled_start_time': '09:00',
            'scheduled_end_time': '18:00',
            'scheduled_work_hours': 8,
            'created_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'updated_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        }
        
        url = f'{API_BASE}/workers'
        data = json.dumps(worker_data).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                result = json.loads(response.read().decode())
                print(f'✓ ユーザー {user_id} ({name}) を作成しました')
                print(f'  メール: {email}')
                print(f'  ロール: {role} (role_code: {role_code})')
                return True
            else:
                error_body = response.read().decode()
                print(f'✗ 作成に失敗しました: {response.status} - {error_body}')
                return False
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else 'Unknown error'
        print(f'✗ 作成に失敗しました: {e.code} - {error_body}')
        return False
    except Exception as e:
        print(f'✗ エラーが発生しました: {e}')
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    import sys
    
    # 櫻田傑の情報
    user_id = '9999'
    name = '櫻田傑'
    email = 'sakurada@misesapo.co.jp'
    role = 'admin'
    department = '開発'
    
    print(f'ユーザーを作成します:')
    print(f'  ID: {user_id}')
    print(f'  名前: {name}')
    print(f'  メール: {email}')
    print(f'  ロール: {role}')
    print(f'  部署: {department}')
    print()
    
    success = create_worker(
        user_id=user_id,
        name=name,
        email=email,
        role=role,
        department=department
    )
    
    sys.exit(0 if success else 1)

