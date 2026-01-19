#!/usr/bin/env python3
"""
AWS（DynamoDB）に登録されている全ユーザーのロールと部署を一覧表示するスクリプト
"""
import json
import urllib.request
from collections import defaultdict

API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'

def get_all_workers():
    """APIから全ユーザーを取得"""
    try:
        url = f'{API_BASE}/workers'
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            workers = data if isinstance(data, list) else (data.get('items') or data.get('workers') or [])
            return workers
    except Exception as e:
        print(f'エラー: ユーザー情報の取得に失敗しました: {e}')
        return []

def get_role_label(role):
    """ロール名を日本語に変換"""
    role_labels = {
        'admin': '管理者',
        'sales': '営業',
        'office': '事務',
        'cleaning': '清掃',
        'public_relations': '広報',
        'designer': 'デザイナー',
        'general_affairs': '総務',
        'director': '取締役',
        'contractor': '外部委託',
        'accounting': '経理',
        'human_resources': '人事',
        'special_advisor': 'スペシャルバイザー',
        'field_sales': 'フィールドセールス',
        'inside_sales': 'インサイドセールス',
        'mechanic': 'メカニック',
        'engineer': 'エンジニア',
        'part_time': 'アルバイト',
        'customer': '顧客',
        'staff': '清掃員',
        'developer': '開発者',
        'operation': '運営',
        'master': 'マスター'
    }
    return role_labels.get(role, role)

def main():
    print('=' * 80)
    print('AWS（DynamoDB）登録ユーザー - ロール・部署一覧')
    print('=' * 80)
    print()
    
    # 全ユーザーを取得
    workers = get_all_workers()
    
    if not workers:
        print('ユーザーが見つかりませんでした。')
        return
    
    # お客様（customer）を除外（従業員のみを表示）
    employees = [w for w in workers if w.get('role') != 'customer']
    
    if not employees:
        print('従業員が見つかりませんでした。')
        return
    
    print(f'登録従業員数: {len(employees)}名\n')
    
    # ロール別に集計
    role_counts = defaultdict(int)
    department_counts = defaultdict(int)
    role_department_counts = defaultdict(lambda: defaultdict(int))
    
    # ユーザー情報を整理
    user_list = []
    for worker in employees:
        user_id = worker.get('id', 'N/A')
        name = worker.get('name', '名前未設定')
        email = worker.get('email', '-')
        role = worker.get('role', '未設定')
        role_code = worker.get('role_code', '-')
        department = worker.get('department', '未設定') or '未設定'
        status = worker.get('status', 'active')
        
        # 統計情報を更新
        role_counts[role] += 1
        department_counts[department] += 1
        role_department_counts[role][department] += 1
        
        user_list.append({
            'id': user_id,
            'name': name,
            'email': email,
            'role': role,
            'role_code': role_code,
            'department': department,
            'status': status
        })
    
    # IDでソート
    user_list.sort(key=lambda x: x['id'])
    
    # 1. ロール別集計を表示
    print('【ロール別集計】')
    print('-' * 80)
    for role, count in sorted(role_counts.items(), key=lambda x: x[1], reverse=True):
        role_label = get_role_label(role)
        print(f'  {role_label:20s} ({role:20s}): {count:3d}名')
    print()
    
    # 2. 部署別集計を表示
    print('【部署別集計】')
    print('-' * 80)
    for department, count in sorted(department_counts.items(), key=lambda x: x[1], reverse=True):
        print(f'  {department:30s}: {count:3d}名')
    print()
    
    # 3. ロール×部署のクロス集計を表示
    print('【ロール×部署 クロス集計】')
    print('-' * 80)
    for role in sorted(role_counts.keys()):
        role_label = get_role_label(role)
        print(f'\n  {role_label} ({role}):')
        for department, count in sorted(role_department_counts[role].items()):
            print(f'    - {department:30s}: {count:3d}名')
    print()
    
    # 4. 全ユーザー詳細リストを表示
    print('【全ユーザー詳細リスト】')
    print('-' * 80)
    print(f'{"ID":<15s} {"名前":<20s} {"メールアドレス":<35s} {"ロール":<20s} {"部署":<20s} {"ステータス":<10s}')
    print('-' * 80)
    
    for user in user_list:
        role_label = get_role_label(user['role'])
        status_label = '有効' if user['status'] == 'active' else '無効'
        print(f'{user["id"]:<15s} {user["name"]:<20s} {user["email"]:<35s} {role_label:<20s} {user["department"]:<20s} {status_label:<10s}')
    
    print('-' * 80)
    print(f'\n合計: {len(user_list)}名')
    print()
    
    # 5. 統計サマリー
    print('【統計サマリー】')
    print('-' * 80)
    print(f'  登録ユーザー数: {len(user_list)}名')
    print(f'  ロール種類数: {len(role_counts)}種類')
    print(f'  部署種類数: {len(department_counts)}部署')
    print(f'  有効ユーザー: {sum(1 for u in user_list if u["status"] == "active")}名')
    print(f'  無効ユーザー: {sum(1 for u in user_list if u["status"] != "active")}名')
    print()

if __name__ == '__main__':
    main()

