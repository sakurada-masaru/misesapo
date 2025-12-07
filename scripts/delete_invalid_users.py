#!/usr/bin/env python3
"""
リストにないユーザーを削除するスクリプト
"""

import json
import subprocess
import sys

# リストに載っている有効なID
VALID_IDS = {
    'W001', 'W002', 'W003', 'W004', 'W005', 'W006', 'W007', 'W008', 'W009', 'W010',
    'W011', 'W012', 'W013', 'W014', 'W017', 'W018', 'W019', 'W020', 'W021', 'W022', 'W999'
}

def delete_user_from_dynamodb(user_id):
    """DynamoDBからユーザーを削除"""
    try:
        cmd = [
            'aws', 'dynamodb', 'delete-item',
            '--table-name', 'workers',
            '--key', json.dumps({'id': {'S': user_id}}),
            '--region', 'ap-northeast-1'
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f'✓ DynamoDBから削除: {user_id}')
        return True
    except subprocess.CalledProcessError as e:
        print(f'✗ DynamoDB削除失敗: {user_id} - {e.stderr}')
        return False
    except Exception as e:
        print(f'✗ DynamoDB削除失敗: {user_id} - {e}')
        return False

def get_all_users_from_dynamodb():
    """DynamoDBから全ユーザーを取得"""
    try:
        cmd = [
            'aws', 'dynamodb', 'scan',
            '--table-name', 'workers',
            '--region', 'ap-northeast-1'
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        users = []
        for item in data.get('Items', []):
            user = {}
            for key, value in item.items():
                if 'S' in value:
                    user[key] = value['S']
                elif 'N' in value:
                    user[key] = value['N']
            users.append(user)
        return users
    except Exception as e:
        print(f'✗ ユーザー取得エラー: {e}')
        return []

def main():
    print('=' * 80)
    print('リストにないユーザーを削除します')
    print('=' * 80)
    print()
    
    # 全ユーザーを取得
    users = get_all_users_from_dynamodb()
    print(f'総ユーザー数: {len(users)}名\n')
    
    # リストにないユーザーを特定
    invalid_users = []
    for user in users:
        user_id = str(user.get('id', '')).strip()
        if user_id and user_id not in VALID_IDS:
            invalid_users.append(user)
            print(f'削除対象: {user_id} - {user.get("name", "N/A")} ({user.get("email", "N/A")})')
    
    if not invalid_users:
        print('削除対象のユーザーはありません')
        return
    
    print(f'\n削除対象: {len(invalid_users)}名\n')
    
    # 確認
    response = input('削除を実行しますか？ (yes/no): ')
    if response.lower() != 'yes':
        print('削除をキャンセルしました')
        return
    
    # 削除実行
    success_count = 0
    fail_count = 0
    
    for user in invalid_users:
        user_id = user.get('id')
        if delete_user_from_dynamodb(user_id):
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

