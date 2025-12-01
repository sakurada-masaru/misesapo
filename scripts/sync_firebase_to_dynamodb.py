#!/usr/bin/env python3
"""
Firebase AuthenticationのユーザーをDynamoDBのworkersテーブルに同期するスクリプト

使用方法:
1. Firebase Consoleからサービスアカウントキーを取得
2. scripts/firebase-service-account.json に保存
3. pip install firebase-admin boto3
4. python3 scripts/sync_firebase_to_dynamodb.py
"""

import json
import boto3
import sys
import os
from pathlib import Path
from datetime import datetime

# Firebase Admin SDKのインポート
try:
    import firebase_admin
    from firebase_admin import credentials, auth
except ImportError:
    print("❌ エラー: firebase-admin がインストールされていません")
    print("   pip install firebase-admin を実行してください")
    sys.exit(1)

# DynamoDBクライアントの初期化
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
workers_table = dynamodb.Table('workers')

# Firebase Admin SDKの初期化
script_dir = Path(__file__).parent
service_account_path = script_dir / 'firebase-service-account.json'

if not service_account_path.exists():
    print("❌ エラー: firebase-service-account.json が見つかりません")
    print("")
    print("📝 手順:")
    print("1. Firebase Console → プロジェクトの設定 → サービスアカウント")
    print("2. 「新しい秘密鍵を生成」をクリック")
    print("3. ダウンロードしたJSONファイルを scripts/firebase-service-account.json に保存")
    print("")
    sys.exit(1)

try:
    cred = credentials.Certificate(str(service_account_path))
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    print("✅ Firebase Admin SDKを初期化しました")
except Exception as e:
    print(f"❌ エラー: Firebase Admin SDKの初期化に失敗しました: {e}")
    sys.exit(1)

def get_all_firebase_users():
    """Firebase Authenticationから全ユーザーを取得"""
    users = []
    try:
        page = auth.list_users()
        while page:
            for user in page.users:
                users.append(user)
            page = page.get_next_page()
        return users
    except Exception as e:
        print(f"❌ エラー: Firebaseユーザーの取得に失敗しました: {e}")
        return []

def get_worker_by_firebase_uid(firebase_uid):
    """DynamoDBからFirebase UIDでworkerを検索"""
    try:
        response = workers_table.scan(
            FilterExpression=boto3.dynamodb.conditions.Attr('firebase_uid').eq(firebase_uid)
        )
        items = response.get('Items', [])
        return items[0] if items else None
    except Exception as e:
        print(f"   ⚠️  DynamoDB検索エラー: {e}")
        return None

def get_worker_by_email(email):
    """DynamoDBからメールアドレスでworkerを検索"""
    try:
        response = workers_table.scan(
            FilterExpression=boto3.dynamodb.conditions.Attr('email').eq(email)
        )
        items = response.get('Items', [])
        return items[0] if items else None
    except Exception as e:
        print(f"   ⚠️  DynamoDB検索エラー: {e}")
        return None

def create_worker_from_firebase_user(firebase_user):
    """FirebaseユーザーからDynamoDBのworkerを作成"""
    # カスタムクレームからロールを取得
    custom_claims = firebase_user.custom_claims or {}
    role = custom_claims.get('role', 'customer')
    
    # ロールコードを設定
    role_code_map = {
        'staff': '99',
        'sales': '2',
        'admin': '1',
        'developer': '1',
        'master': '1',
        'customer': '99'  # デフォルト
    }
    role_code = role_code_map.get(role, '99')
    
    # ユーザーIDを生成（既存のIDがない場合）
    worker_id = 'W' + str(int(datetime.utcnow().timestamp() * 1000))
    
    # 名前を取得（displayNameまたはメールアドレスのローカル部分）
    name = firebase_user.display_name or firebase_user.email.split('@')[0] if firebase_user.email else 'ユーザー'
    
    now = datetime.utcnow().isoformat() + 'Z'
    
    worker_data = {
        'id': worker_id,
        'firebase_uid': firebase_user.uid,
        'email': firebase_user.email or '',
        'name': name,
        'phone': '',
        'role': role,
        'role_code': role_code,
        'department': '',
        'status': 'active',
        'created_at': firebase_user.user_metadata.creation_timestamp.isoformat() + 'Z' if firebase_user.user_metadata.creation_timestamp else now,
        'updated_at': now
    }
    
    return worker_data

def sync_firebase_user_to_dynamodb(firebase_user):
    """FirebaseユーザーをDynamoDBに同期"""
    # 既にDynamoDBに存在するか確認
    existing_worker = get_worker_by_firebase_uid(firebase_user.uid)
    
    if existing_worker:
        # 既に存在する場合は、firebase_uidを更新（念のため）
        print(f"   ✓ 既にDynamoDBに存在します: {existing_worker.get('id')}")
        return {'action': 'exists', 'id': existing_worker.get('id')}
    
    # メールアドレスで検索（firebase_uidが設定されていない場合）
    if firebase_user.email:
        existing_worker = get_worker_by_email(firebase_user.email)
        if existing_worker:
            # firebase_uidを追加
            print(f"   → firebase_uidを追加します: {existing_worker.get('id')}")
            try:
                workers_table.update_item(
                    Key={'id': existing_worker['id']},
                    UpdateExpression='SET firebase_uid = :uid, updated_at = :updated_at',
                    ExpressionAttributeValues={
                        ':uid': firebase_user.uid,
                        ':updated_at': datetime.utcnow().isoformat() + 'Z'
                    }
                )
                return {'action': 'updated', 'id': existing_worker.get('id')}
            except Exception as e:
                print(f"   ❌ 更新エラー: {e}")
                return {'action': 'error', 'error': str(e)}
    
    # 新規作成
    worker_data = create_worker_from_firebase_user(firebase_user)
    try:
        workers_table.put_item(Item=worker_data)
        print(f"   ✅ 新規作成しました: {worker_data['id']}")
        return {'action': 'created', 'id': worker_data['id']}
    except Exception as e:
        print(f"   ❌ 作成エラー: {e}")
        return {'action': 'error', 'error': str(e)}

def main():
    print("")
    print("🚀 Firebase Authentication → DynamoDB 同期を開始します...")
    print("")
    
    # Firebaseから全ユーザーを取得
    print("📧 Firebase Authenticationからユーザーを取得中...")
    firebase_users = get_all_firebase_users()
    print(f"   取得したユーザー数: {len(firebase_users)}")
    print("")
    
    if not firebase_users:
        print("⚠️  Firebaseにユーザーが見つかりませんでした")
        return
    
    results = {
        'exists': [],
        'updated': [],
        'created': [],
        'error': []
    }
    
    # 各ユーザーを同期
    for firebase_user in firebase_users:
        email = firebase_user.email or 'N/A'
        print(f"📧 {email} (UID: {firebase_user.uid})")
        
        result = sync_firebase_user_to_dynamodb(firebase_user)
        results[result['action']].append({
            'email': email,
            'uid': firebase_user.uid,
            'id': result.get('id'),
            'error': result.get('error')
        })
        
        print("")
    
    # 結果を表示
    print("📊 結果:")
    print(f"   ✓ 既に存在: {len(results['exists'])}件")
    print(f"   → 更新: {len(results['updated'])}件")
    print(f"   ✅ 新規作成: {len(results['created'])}件")
    print(f"   ❌ エラー: {len(results['error'])}件")
    print("")
    
    if results['created']:
        print("✅ 新規作成されたユーザー:")
        for item in results['created']:
            print(f"   - {item['email']} (ID: {item['id']})")
        print("")
    
    if results['updated']:
        print("→ 更新されたユーザー:")
        for item in results['updated']:
            print(f"   - {item['email']} (ID: {item['id']})")
        print("")
    
    if results['error']:
        print("❌ エラーが発生したユーザー:")
        for item in results['error']:
            print(f"   - {item['email']}: {item.get('error', 'Unknown error')}")
        print("")

if __name__ == '__main__':
    main()

