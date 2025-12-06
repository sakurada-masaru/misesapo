#!/usr/bin/env python3
"""
ユーザーをAPI経由で削除するスクリプト
"""
import json
import urllib.request
import urllib.parse
import sys

API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'

def delete_user_by_id(user_id):
    """IDでユーザーを削除"""
    try:
        url = f'{API_BASE}/workers/{user_id}'
        req = urllib.request.Request(
            url,
            headers={'Content-Type': 'application/json'},
            method='DELETE'
        )
        
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                data = json.loads(response.read().decode())
                print(f'✓ ユーザー {user_id} を削除しました')
                return True
            else:
                print(f'✗ 削除に失敗しました: {response.status} - {response.read().decode()}')
                return False
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else 'Unknown error'
        print(f'✗ 削除に失敗しました: {e.code} - {error_body}')
        return False
    except Exception as e:
        print(f'✗ エラーが発生しました: {e}')
        return False

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

if __name__ == '__main__':
    email = 'masarunospec@gmail.com'
    
    # メールアドレスでユーザーを検索
    user = get_user_by_email(email)
    if user:
        user_id = user.get('id')
        name = user.get('name', 'N/A')
        print(f'ユーザーが見つかりました: {name} (ID: {user_id})')
        
        # 削除確認
        confirm = input(f'このユーザーを削除しますか？ (yes/no): ')
        if confirm.lower() == 'yes':
            success = delete_user_by_id(user_id)
            sys.exit(0 if success else 1)
        else:
            print('削除をキャンセルしました')
            sys.exit(0)
    else:
        print(f'ユーザー {email} が見つかりません')
        sys.exit(1)

