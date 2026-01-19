#!/usr/bin/env python3
"""
指定されたメールアドレスのユーザーをDBから削除するスクリプト
"""
import json
import urllib.request
import urllib.parse
import sys

API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'

# 削除対象のメールアドレス
EMAILS_TO_DELETE = [
    'itabashi@misesapo.co.jp',
    'kitano@misesapo.co.jp',
    'kumagai@misesapo.co.jp',
    'natsume@misesapo.co.jp',
    'oki@misesapo.co.jp',
    'ono@misesapo.co.jp'
]

def get_user_by_email(email):
    """メールアドレスでユーザーを検索"""
    try:
        url = f'{API_BASE}/workers?email={urllib.parse.quote(email)}'
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            workers = data if isinstance(data, list) else (data.get('items') or data.get('workers') or [])
            if workers:
                return workers[0]
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f'Error fetching user {email}: {e.code} - {e.read().decode()}')
    except Exception as e:
        print(f'Error fetching user {email}: {e}')
    return None

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
            if response.status in [200, 204]:
                return True
            else:
                error_body = response.read().decode()
                print(f'✗ 削除に失敗しました: {response.status} - {error_body}')
                return False
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else 'Unknown error'
        if e.code == 404:
            # 既に削除されている場合は成功として扱う
            return True
        print(f'✗ 削除に失敗しました: {e.code} - {error_body}')
        return False
    except Exception as e:
        print(f'✗ エラーが発生しました: {e}')
        return False

def main():
    print('=== メールアドレス指定ユーザー削除 ===\n')
    
    deleted_count = 0
    not_found_count = 0
    error_count = 0
    
    for email in EMAILS_TO_DELETE:
        print(f'処理中: {email}...')
        
        # メールアドレスでユーザーを検索
        user = get_user_by_email(email)
        if user:
            user_id = user.get('id')
            name = user.get('name', 'N/A')
            print(f'  ユーザーが見つかりました: {name} (ID: {user_id})')
            
            # 削除実行
            if delete_user_by_id(user_id):
                print(f'  ✓ 削除成功: {email} (ID: {user_id})')
                deleted_count += 1
            else:
                print(f'  ✗ 削除失敗: {email}')
                error_count += 1
        else:
            print(f'  ⚠ ユーザーが見つかりません: {email}')
            not_found_count += 1
        
        print()
    
    # 結果サマリー
    print('=== 削除結果 ===')
    print(f'削除成功: {deleted_count}件')
    print(f'見つからず: {not_found_count}件')
    print(f'エラー: {error_count}件')
    print(f'合計: {len(EMAILS_TO_DELETE)}件')
    
    sys.exit(0 if error_count == 0 else 1)

if __name__ == '__main__':
    main()

