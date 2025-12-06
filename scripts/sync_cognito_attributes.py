#!/usr/bin/env python3
"""
Cognitoユーザーの属性を更新するスクリプト
提供されたリストに基づいて、Cognitoのcustom:role, custom:name, custom:departmentを更新します。
"""

import subprocess
import json

# 提供されたリスト
USERS = [
    {'id': 'W001', 'name': '遠藤虹輝', 'email': 'endo@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    {'id': 'W004', 'name': '板橋隆二', 'email': 'itabashi@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    {'id': 'W011', 'name': '熊谷円', 'email': 'kumagai@misesapo.co.jp', 'role': 'office', 'department': '営業事務'},
    {'id': 'W012', 'name': '増田優香', 'email': 'masuda@misesapo.co.jp', 'role': 'office', 'department': '営業事務'},
    {'id': 'W003', 'name': '中島郁哉', 'email': 'nakajima@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    {'id': 'W013', 'name': '生井剛', 'email': 'namai@misesapo.co.jp', 'role': 'sales', 'department': '営業'},
    {'id': 'W019', 'name': '夏目倫之助', 'email': 'natsume@misesapo.co.jp', 'role': 'developer', 'department': '開発'},
    {'id': 'W017', 'name': '岡本涼子', 'email': 'okamoto@misesapo.co.jp', 'role': 'office', 'department': '営業事務'},
    {'id': 'W009', 'name': '沖智弘', 'email': 'oki@misesapo.co.jp', 'role': 'sales', 'department': '営業'},
    {'id': 'W010', 'name': '北野康平', 'email': 'okitano@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    {'id': 'W007', 'name': '大野幹太', 'email': 'ono@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    {'id': 'W014', 'name': '太田真也', 'email': 'ota@misesapo.co.jp', 'role': 'admin', 'department': '開発'},
    {'id': 'W999', 'name': '櫻田傑', 'email': 'sakurada@misesapo.co.jp', 'role': 'admin', 'department': '開発'},
    {'id': 'W006', 'name': '佐々木一真', 'email': 'sasaki@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    {'id': 'W008', 'name': '平鋭未', 'email': 'taira@misesapo.co.jp', 'role': 'sales', 'department': '営業'},
    {'id': 'W020', 'name': '竹内那海', 'email': 'takeuchi@misesapo.co.jp', 'role': 'developer', 'department': '開発'},
    {'id': 'W002', 'name': '梅岡アレサンドレユウジ', 'email': 'umeoka@misesapo.co.jp', 'role': 'staff', 'department': '営業'},
    {'id': 'W018', 'name': '山村明広', 'email': 'yamamura@misesapo.co.jp', 'role': 'developer', 'department': '開発'},
    {'id': 'W005', 'name': '吉井奎吾', 'email': 'yoshii@misesapo.co.jp', 'role': 'staff', 'department': '現場清掃'},
    # 正田和輝は最後にリストされているため、W001を上書きします
    {'id': 'W001', 'name': '正田和輝', 'email': 'frappe.manma@gmail.com', 'role': 'operation', 'department': '経営本部'},
]

USER_POOL_ID = 'ap-northeast-1_EDKElIGoC'
REGION = 'ap-northeast-1'

def update_cognito_user_attributes(email, name, role, department):
    """Cognitoユーザーの属性を更新（custom:nameは存在しないため、custom:roleとcustom:departmentのみ更新）"""
    try:
        # custom:name属性は存在しないため、custom:roleとcustom:departmentのみ更新
        cmd = [
            'aws', 'cognito-idp', 'admin-update-user-attributes',
            '--user-pool-id', USER_POOL_ID,
            '--username', email,
            '--user-attributes',
            f'Name=custom:role,Value={role}',
            f'Name=custom:department,Value={department}',
            '--region', REGION
        ]
        
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        if 'UserNotFoundException' in e.stderr:
            print(f'  ⚠ Cognitoに未登録: {email}')
            return False
        else:
            print(f'  ✗ エラー: {e.stderr[:200]}')
            return False
    except Exception as e:
        print(f'  ✗ エラー: {e}')
        return False

def main():
    print('=== Cognitoユーザー属性更新 ===\n')
    
    success_count = 0
    fail_count = 0
    not_found_count = 0
    
    for user in USERS:
        email = user['email']
        name = user['name']
        role = user['role']
        department = user['department']
        user_id = user['id']
        
        print(f'更新中: {user_id} - {name} ({email})')
        if update_cognito_user_attributes(email, name, role, department):
            print(f'  ✓ 更新完了: role={role}, name={name}, dept={department}')
            success_count += 1
        else:
            if '未登録' in str(email):
                not_found_count += 1
            else:
                fail_count += 1
        print()
    
    print('=== 更新完了 ===')
    print(f'成功: {success_count}名')
    print(f'失敗: {fail_count}名')
    print(f'未登録: {not_found_count}名')

if __name__ == '__main__':
    main()

