#!/usr/bin/env python3
"""
Workers（従業員）のIDを新しい形式にマイグレーションするスクリプト
- 古いID形式（数値、W001形式）を新しい形式（W + タイムスタンプ）に変換
- 意味をなしていないユーザー（名前が「ユーザー1」など）を削除
"""

import json
import boto3
from datetime import datetime
import sys

# DynamoDBクライアントの初期化
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
WORKERS_TABLE = dynamodb.Table('workers')

# APIエンドポイント
API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'

def generate_new_id():
    """新しいIDを生成（W + タイムスタンプ）"""
    return 'W' + str(int(datetime.utcnow().timestamp() * 1000))

def is_invalid_user(user):
    """意味をなしていないユーザーかどうかを判定"""
    name = user.get('name', '').strip()
    
    # 名前が空、または「ユーザー」+ 数字のみの場合は無効
    if not name:
        return True
    
    # 「ユーザー1」「ユーザー2」などのパターンを検出
    if name.startswith('ユーザー') and len(name) <= 5:
        try:
            int(name.replace('ユーザー', ''))
            return True
        except:
            pass
    
    # メールアドレスもなく、名前も意味をなしていない場合
    email = user.get('email', '').strip()
    if not email and len(name) < 2:
        return True
    
    return False

def migrate_workers():
    """WorkersのIDをマイグレーション"""
    print("=== Workers ID マイグレーション開始 ===\n")
    
    # 1. 現在のデータを取得（APIから）
    import urllib.request
    try:
        with urllib.request.urlopen(f"{API_BASE}/workers") as response:
            data = json.loads(response.read().decode())
            workers = data if isinstance(data, list) else data.get('items', data.get('workers', []))
    except Exception as e:
        print(f"APIからデータを取得できませんでした: {e}")
        print("DynamoDBから直接取得を試みます...")
        response = WORKERS_TABLE.scan()
        workers = response.get('Items', [])
    
    print(f"取得したユーザー数: {len(workers)}件\n")
    
    # 2. 無効なユーザーを特定
    invalid_users = []
    valid_users = []
    
    for worker in workers:
        if is_invalid_user(worker):
            invalid_users.append(worker)
        else:
            valid_users.append(worker)
    
    print(f"有効なユーザー: {len(valid_users)}件")
    print(f"削除対象のユーザー: {len(invalid_users)}件")
    
    if invalid_users:
        print("\n削除対象のユーザー:")
        for u in invalid_users:
            print(f"  - ID: {u.get('id')}, 名前: {u.get('name')}, メール: {u.get('email')}")
    
    # 3. 確認
    print("\n=== マイグレーション内容 ===")
    print(f"1. 有効なユーザー {len(valid_users)}件のIDを確認（既に適切な形式の場合はそのまま）")
    print(f"2. 無効なユーザー {len(invalid_users)}件を削除")
    
    # 非対話式で実行（--yes フラグがある場合は確認をスキップ）
    import sys
    if '--yes' not in sys.argv:
        response = input("\n実行しますか？ (yes/no): ")
        if response.lower() != 'yes':
            print("キャンセルしました。")
            return
    
    # 4. 無効なユーザーを削除
    print("\n=== 無効なユーザーを削除中 ===")
    for user in invalid_users:
        old_id = user.get('id')
        try:
            WORKERS_TABLE.delete_item(Key={'id': str(old_id)})
            print(f"✓ 削除: ID {old_id} ({user.get('name', 'N/A')})")
        except Exception as e:
            print(f"✗ 削除失敗: ID {old_id} - {e}")
    
    # 5. 有効なユーザーをDynamoDBに保存
    print("\n=== 有効なユーザーをDynamoDBに保存中 ===")
    migration_map = {}  # 旧ID -> 新IDのマッピング
    updated_count = 0
    skipped_count = 0
    saved_count = 0
    
    for user in valid_users:
        old_id = str(user.get('id'))
        
        # データを正規化
        worker_data = {
            'id': old_id,
            'name': user.get('name') or user.get('display_name') or '',
            'email': user.get('email') or user.get('email_address') or '',
            'phone': user.get('phone') or user.get('phone_number') or '',
            'role': user.get('role') or 'staff',
            'role_code': user.get('role_code') or '99',
            'department': user.get('department') or user.get('team') or '',
            'status': user.get('status') or 'active',
            'created_at': user.get('created_at') or user.get('created_date') or datetime.utcnow().isoformat() + 'Z',
            'updated_at': user.get('updated_at') or datetime.utcnow().isoformat() + 'Z'
        }
        
        # role_codeからroleを設定
        if worker_data['role'] == 'staff' and worker_data['role_code'] == '99':
            pass  # デフォルト値のまま
        elif worker_data['role_code'] == '1':
            worker_data['role'] = 'admin'
        elif worker_data['role_code'] == '2':
            worker_data['role'] = 'sales'
        
        # DynamoDBに保存
        try:
            WORKERS_TABLE.put_item(Item=worker_data)
            print(f"✓ 保存: {old_id} ({worker_data['name']})")
            saved_count += 1
        except Exception as e:
            print(f"✗ 保存失敗: {old_id} - {e}")
    
    # 6. マイグレーションマップを保存
    with open('worker_id_migration_map.json', 'w', encoding='utf-8') as f:
        json.dump(migration_map, f, ensure_ascii=False, indent=2)
    
    print(f"\n=== マイグレーション完了 ===")
    print(f"保存: {saved_count}件")
    print(f"削除: {len(invalid_users)}件")
    print(f"合計: {saved_count + len(invalid_users)}件処理")

if __name__ == '__main__':
    migrate_workers()

