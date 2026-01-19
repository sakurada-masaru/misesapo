#!/usr/bin/env python3
"""
従業員を一括登録するスクリプト
AWS CognitoとDynamoDBに従業員情報を登録します
"""

import json
import sys
import urllib.request
import urllib.parse
from typing import Dict, List, Optional

# API Base URL
API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'

# 従業員情報
EMPLOYEES = [
    {
        'name': '管理者',
        'email': 'admin@misesapo.app',
        'password': '887jchgasgw',
        'role': 'admin',
        'department': '管理者',
        'phone': ''
    },
    {
        'name': '管理者（経理）',
        'email': 'keiri@misesapo.app',
        'password': 'misesapo0000',
        'role': 'admin',
        'department': '経理',
        'phone': ''
    },
    {
        'name': '清掃員',
        'email': 'worker@misesapo.app',
        'password': 'Toh0ohchie',
        'role': 'staff',
        'department': '清掃員',
        'phone': ''
    },
    {
        'name': '開発者',
        'email': 'design@misesapo.app',
        'password': 'misesapo1234',
        'role': 'developer',
        'department': '開発',
        'phone': ''
    },
    {
        'name': 'コンシェルジュ',
        'email': 'misesapofeedback@gmail.com',  # 注意: 個人Gmailアドレス
        'password': 'MandC280408',
        'role': 'staff',  # ロールが不明なため、staffに設定
        'department': 'コンシェルジュ',
        'phone': ''
    },
    {
        'name': 'マスター',
        'email': 'info@misesapo.app',
        'password': 'Kazuki.428',
        'role': 'master',
        'department': 'マスター',
        'phone': ''
    }
]

def create_cognito_user(email: str, password: str, name: str, role: str, department: str) -> Optional[Dict]:
    """
    AWS Cognitoにユーザーを作成
    """
    url = f'{API_BASE}/admin/cognito/users'
    data = {
        'email': email,
        'password': password,
        'name': name,
        'role': role,
        'department': department
    }
    
    try:
        json_data = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=json_data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result
    except urllib.error.HTTPError as e:
        try:
            error_data = json.loads(e.read().decode('utf-8'))
            return {
                'success': False,
                'error': error_data.get('error', f'HTTP {e.code}'),
                'message': error_data.get('message', '')
            }
        except:
            return {
                'success': False,
                'error': f'HTTP {e.code}'
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def create_worker(employee: Dict, cognito_sub: str) -> Optional[Dict]:
    """
    DynamoDBに従業員情報を保存
    """
    url = f'{API_BASE}/workers'
    
    # ロールコードを設定
    role_code_map = {
        'staff': '99',
        'sales': '2',
        'admin': '1',
        'developer': '1',
        'master': '1'
    }
    
    data = {
        'cognito_sub': cognito_sub,
        'name': employee['name'],
        'email': employee['email'],
        'phone': employee.get('phone', ''),
        'role': employee['role'],
        'role_code': role_code_map.get(employee['role'], '99'),
        'department': employee['department'],
        'status': 'active'
    }
    
    try:
        json_data = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=json_data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result
    except urllib.error.HTTPError as e:
        try:
            error_data = json.loads(e.read().decode('utf-8'))
            return {
                'success': False,
                'error': error_data.get('error', f'HTTP {e.code}'),
                'message': error_data.get('message', '')
            }
        except:
            return {
                'success': False,
                'error': f'HTTP {e.code}'
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def register_employee(employee: Dict) -> Dict:
    """
    従業員を登録（Cognito + DynamoDB）
    """
    print(f"\n{'='*60}")
    print(f"従業員を登録中: {employee['name']} ({employee['email']})")
    print(f"{'='*60}")
    
    # 1. Cognitoにユーザーを作成
    print(f"1. AWS Cognitoにユーザーを作成中...")
    cognito_result = create_cognito_user(
        email=employee['email'],
        password=employee['password'],
        name=employee['name'],
        role=employee['role'],
        department=employee['department']
    )
    
    if not cognito_result or 'sub' not in cognito_result:
        error_msg = cognito_result.get('error', '不明なエラー') if cognito_result else 'レスポンスがありません'
        print(f"   ❌ Cognitoユーザーの作成に失敗: {error_msg}")
        return {
            'success': False,
            'employee': employee['name'],
            'email': employee['email'],
            'error': f'Cognito: {error_msg}'
        }
    
    cognito_sub = cognito_result['sub']
    print(f"   ✅ Cognitoユーザーを作成しました (Sub: {cognito_sub})")
    
    # 2. DynamoDBに従業員情報を保存
    print(f"2. DynamoDBに従業員情報を保存中...")
    worker_result = create_worker(employee, cognito_sub)
    
    if not worker_result or 'id' not in worker_result:
        error_msg = worker_result.get('error', '不明なエラー') if worker_result else 'レスポンスがありません'
        print(f"   ❌ DynamoDBへの保存に失敗: {error_msg}")
        return {
            'success': False,
            'employee': employee['name'],
            'email': employee['email'],
            'error': f'DynamoDB: {error_msg}'
        }
    
    worker_id = worker_result.get('id', 'N/A')
    print(f"   ✅ DynamoDBに保存しました (ID: {worker_id})")
    
    print(f"✅ 登録完了: {employee['name']} ({employee['email']})")
    
    return {
        'success': True,
        'employee': employee['name'],
        'email': employee['email'],
        'worker_id': worker_id,
        'cognito_sub': cognito_sub
    }

def main():
    """
    メイン処理
    """
    print("="*60)
    print("従業員一括登録スクリプト")
    print("="*60)
    print(f"登録対象: {len(EMPLOYEES)}名")
    print()
    
    # 警告: コンシェルジュのメールアドレスについて
    concierge = next((e for e in EMPLOYEES if 'コンシェルジュ' in e['name']), None)
    if concierge and not concierge['email'].endswith('@misesapo.app'):
        print("⚠️  警告: コンシェルジュのメールアドレスが個人Gmailアドレスです")
        print(f"   メールアドレス: {concierge['email']}")
        print("   バリデーションエラーが発生する可能性があります")
        print()
    
    results = []
    success_count = 0
    error_count = 0
    
    for employee in EMPLOYEES:
        result = register_employee(employee)
        results.append(result)
        
        if result['success']:
            success_count += 1
        else:
            error_count += 1
    
    # 結果サマリー
    print("\n" + "="*60)
    print("登録結果サマリー")
    print("="*60)
    print(f"成功: {success_count}名")
    print(f"失敗: {error_count}名")
    print()
    
    if error_count > 0:
        print("失敗した従業員:")
        for result in results:
            if not result['success']:
                print(f"  - {result['employee']} ({result['email']}): {result['error']}")
        print()
    
    print("="*60)
    
    # 成功した従業員の情報を出力
    if success_count > 0:
        print("\n登録された従業員:")
        for result in results:
            if result['success']:
                print(f"  - {result['employee']} ({result['email']})")
                print(f"    Worker ID: {result.get('worker_id', 'N/A')}")
                print(f"    Cognito Sub: {result.get('cognito_sub', 'N/A')}")
                print()
    
    return 0 if error_count == 0 else 1

if __name__ == '__main__':
    sys.exit(main())

