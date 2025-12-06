#!/usr/bin/env python3
"""
IDでユーザーを削除するスクリプト
"""
import json
import urllib.request
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
            if response.status in [200, 204]:
                print(f'✓ ユーザー {user_id} を削除しました')
                return True
            else:
                error_body = response.read().decode()
                print(f'✗ 削除に失敗しました: {response.status} - {error_body}')
                return False
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else 'Unknown error'
        if e.code == 404:
            print(f'✗ ユーザー {user_id} が見つかりません（既に削除されている可能性があります）')
        else:
            print(f'✗ 削除に失敗しました: {e.code} - {error_body}')
        return False
    except Exception as e:
        print(f'✗ エラーが発生しました: {e}')
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    user_id = 'W1764549250789'
    
    print(f'ユーザー {user_id} を削除します...')
    success = delete_user_by_id(user_id)
    sys.exit(0 if success else 1)

