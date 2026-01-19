#!/usr/bin/env python3
"""
Cognito User Poolのユーザー一覧を取得して、リストと照合するスクリプト
"""

import json
import subprocess
import sys

# 組織図データのメールアドレスリスト
VALID_EMAILS = {
    'frappe.manma@gmail.com',  # W001
    'umeoka@misesapo.co.jp',  # W002
    'nakajima@misesapo.co.jp',  # W003
    'itabashi@misesapo.co.jp',  # W004
    'yoshii@misesapo.co.jp',  # W005
    'sasaki@misesapo.co.jp',  # W006
    'ono@misesapo.co.jp',  # W007
    'taira@misesapo.co.jp',  # W008
    'oki@misesapo.co.jp',  # W009
    'okitano@misesapo.co.jp',  # W010
    'kumagai@misesapo.co.jp',  # W011
    'masuda@misesapo.co.jp',  # W012
    'namai@misesapo.co.jp',  # W013
    'ota@misesapo.co.jp',  # W014
    'okamoto@misesapo.co.jp',  # W017
    'yamamura@misesapo.co.jp',  # W018
    'natsume@misesapo.co.jp',  # W019
    'takeuchi@misesapo.co.jp',  # W020
    'endo@misesapo.co.jp',  # W021
    'eiichi@prf.tokyo',  # W022
    'sakurada@misesapo.co.jp'  # W999
}

USER_POOL_ID = 'ap-northeast-1_EDKElIGoC'

def list_cognito_users():
    """Cognito User Poolから全ユーザーを取得"""
    try:
        users = []
        pagination_token = None
        
        while True:
            cmd = [
                'aws', 'cognito-idp', 'list-users',
                '--user-pool-id', USER_POOL_ID,
                '--region', 'ap-northeast-1'
            ]
            
            if pagination_token:
                cmd.extend(['--pagination-token', pagination_token])
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            data = json.loads(result.stdout)
            
            for user in data.get('Users', []):
                email = None
                for attr in user.get('Attributes', []):
                    if attr['Name'] == 'email':
                        email = attr['Value']
                        break
                if email:
                    users.append({
                        'username': user.get('Username'),
                        'email': email,
                        'status': user.get('UserStatus'),
                        'enabled': user.get('Enabled', True)
                    })
            
            pagination_token = data.get('PaginationToken')
            if not pagination_token:
                break
        
        return users
    except Exception as e:
        print(f'✗ Cognitoユーザー取得エラー: {e}')
        return []

def delete_cognito_user(username):
    """Cognito User Poolからユーザーを削除"""
    try:
        cmd = [
            'aws', 'cognito-idp', 'admin-delete-user',
            '--user-pool-id', USER_POOL_ID,
            '--username', username,
            '--region', 'ap-northeast-1'
        ]
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f'✓ Cognitoから削除: {username}')
        return True
    except Exception as e:
        print(f'✗ Cognito削除失敗: {username} - {e}')
        return False

def main():
    print('=' * 80)
    print('Cognito User Poolのユーザー一覧を確認')
    print('=' * 80)
    print()
    
    users = list_cognito_users()
    print(f'Cognito User Poolの総ユーザー数: {len(users)}名\n')
    
    # リストにないユーザーを特定
    invalid_users = []
    for user in users:
        if user['email'] not in VALID_EMAILS:
            invalid_users.append(user)
            print(f'削除対象: {user["email"]} ({user["username"]}) - ステータス: {user["status"]}')
    
    if not invalid_users:
        print('✓ リストにないユーザーはありません')
        return
    
    print(f'\n削除対象: {len(invalid_users)}名\n')
    
    # 確認
    response = input('Cognito User Poolから削除を実行しますか？ (yes/no): ')
    if response.lower() != 'yes':
        print('削除をキャンセルしました')
        return
    
    # 削除実行
    success_count = 0
    fail_count = 0
    
    for user in invalid_users:
        if delete_cognito_user(user['username']):
            success_count += 1
        else:
            fail_count += 1
    
    print()
    print('=' * 80)
    print(f'完了: 成功 {success_count}件, 失敗 {fail_count}件')
    print('=' * 80)
    
    if fail_count > 0:
        sys.exit(1)

if __name__ == '__main__':
    main()

