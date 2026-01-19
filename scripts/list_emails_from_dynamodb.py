#!/usr/bin/env python3
"""
DynamoDBに登録されているメールアドレスのリストを取得するスクリプト
"""

import boto3
import json
from collections import defaultdict

# DynamoDBクライアントを初期化
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')

# テーブル名
WORKERS_TABLE = dynamodb.Table('workers')
CLIENTS_TABLE = dynamodb.Table('clients')
STORES_TABLE = dynamodb.Table('stores')

def get_all_emails_from_table(table, table_name):
    """指定されたテーブルからすべてのメールアドレスを取得"""
    emails = []
    try:
        # テーブルをスキャン
        response = table.scan()
        items = response.get('Items', [])
        
        # ページネーション対応
        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            items.extend(response.get('Items', []))
        
        # メールアドレスを抽出
        for item in items:
            email = item.get('email', '')
            if email:
                emails.append({
                    'email': email,
                    'id': item.get('id', ''),
                    'name': item.get('name', ''),
                    'role': item.get('role', ''),
                    'table': table_name
                })
    except Exception as e:
        print(f"Error scanning {table_name} table: {str(e)}")
    
    return emails

def main():
    """メイン処理"""
    print("=" * 60)
    print("DynamoDBに登録されているメールアドレスのリストを取得中...")
    print("=" * 60)
    print()
    
    all_emails = []
    
    # workersテーブルから取得
    print("📋 workersテーブルから取得中...")
    workers_emails = get_all_emails_from_table(WORKERS_TABLE, 'workers')
    all_emails.extend(workers_emails)
    print(f"   {len(workers_emails)}件のメールアドレスを取得")
    print()
    
    # clientsテーブルから取得
    print("📋 clientsテーブルから取得中...")
    clients_emails = get_all_emails_from_table(CLIENTS_TABLE, 'clients')
    all_emails.extend(clients_emails)
    print(f"   {len(clients_emails)}件のメールアドレスを取得")
    print()
    
    # storesテーブルから取得
    print("📋 storesテーブルから取得中...")
    stores_emails = get_all_emails_from_table(STORES_TABLE, 'stores')
    all_emails.extend(stores_emails)
    print(f"   {len(stores_emails)}件のメールアドレスを取得")
    print()
    
    # 結果を表示
    print("=" * 60)
    print(f"合計: {len(all_emails)}件のメールアドレス")
    print("=" * 60)
    print()
    
    # テーブル別に集計
    table_counts = defaultdict(int)
    for email_info in all_emails:
        table_counts[email_info['table']] += 1
    
    print("📊 テーブル別の件数:")
    for table_name, count in sorted(table_counts.items()):
        print(f"   {table_name}: {count}件")
    print()
    
    # メールアドレスのリストを表示
    print("=" * 60)
    print("メールアドレス一覧:")
    print("=" * 60)
    print()
    
    # テーブル別にグループ化
    emails_by_table = defaultdict(list)
    for email_info in all_emails:
        emails_by_table[email_info['table']].append(email_info)
    
    for table_name in sorted(emails_by_table.keys()):
        print(f"【{table_name}】")
        for email_info in sorted(emails_by_table[table_name], key=lambda x: x['email']):
            print(f"  - {email_info['email']}")
            if email_info.get('name'):
                print(f"    名前: {email_info['name']}")
            if email_info.get('id'):
                print(f"    ID: {email_info['id']}")
            if email_info.get('role'):
                print(f"    ロール: {email_info['role']}")
            print()
        print()
    
    # メールアドレスのみのリスト（重複除去）
    unique_emails = sorted(set(email_info['email'] for email_info in all_emails))
    print("=" * 60)
    print(f"ユニークなメールアドレス: {len(unique_emails)}件")
    print("=" * 60)
    print()
    for email in unique_emails:
        print(email)
    print()
    
    # JSONファイルに保存
    output_file = 'emails_list.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'total_count': len(all_emails),
            'unique_count': len(unique_emails),
            'by_table': dict(table_counts),
            'emails': all_emails,
            'unique_emails': unique_emails
        }, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 結果を {output_file} に保存しました")
    
    # CSVファイルにも保存（メールアドレスのみ）
    csv_file = 'emails_list.csv'
    with open(csv_file, 'w', encoding='utf-8') as f:
        f.write("email,id,name,role,table\n")
        for email_info in sorted(all_emails, key=lambda x: (x['table'], x['email'])):
            f.write(f"{email_info['email']},{email_info.get('id', '')},{email_info.get('name', '')},{email_info.get('role', '')},{email_info['table']}\n")
    
    print(f"✅ CSV形式で {csv_file} に保存しました")

if __name__ == '__main__':
    main()

