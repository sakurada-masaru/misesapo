#!/usr/bin/env python3
"""
DynamoDB（workers API）に登録されている従業員を Cognito User Pool に一括登録するスクリプト。
これにより、misogi のサインインで「登録されているメールアドレス」でログインできるようになる。

前提:
  - AWS CLI が設定済み（aws configure）で、Cognito に admin_create_user できる権限があること
  - 環境変数 COGNITO_DEFAULT_PASSWORD で初回パスワードを指定（未設定時はデフォルトを使用し、変更を促す）

使い方:
  cd /path/to/misesapo
  COGNITO_DEFAULT_PASSWORD='YourSecurePassword' python3 scripts/sync_workers_to_cognito.py
  # または --dry-run で登録せずに「Cognito に未登録のメール」だけ表示
  python3 scripts/sync_workers_to_cognito.py --dry-run
"""

import json
import os
import sys
import urllib.request

API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'
USER_POOL_ID = 'ap-northeast-1_EDKElIGoC'
REGION = 'ap-northeast-1'

# 初回パスワード（本番では必ず環境変数で上書きすること）
DEFAULT_PASSWORD_ENV = 'COGNITO_DEFAULT_PASSWORD'
FALLBACK_PASSWORD = 'Misesapo2024!'  # 未設定時用（スクリプト内で警告表示）


def get_workers():
    """API から全従業員を取得"""
    try:
        url = f'{API_BASE}/workers'
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            workers = data if isinstance(data, list) else (data.get('items') or data.get('workers') or [])
            return [w for w in workers if w.get('email') and w.get('role') != 'customer']
    except Exception as e:
        print(f'✗ 従業員一覧の取得に失敗: {e}')
        return []


def get_cognito_user_emails():
    """Cognito User Pool に登録済みのメール一覧を取得（boto3）"""
    try:
        import boto3
        client = boto3.client('cognito-idp', region_name=REGION)
        emails = set()
        pagination_token = None
        while True:
            kwargs = {'UserPoolId': USER_POOL_ID}
            if pagination_token:
                kwargs['PaginationToken'] = pagination_token
            resp = client.list_users(**kwargs)
            for u in resp.get('Users', []):
                for attr in u.get('Attributes', []):
                    if attr.get('Name') == 'email':
                        emails.add(attr['Value'])
                        break
            pagination_token = resp.get('PaginationToken')
            if not pagination_token:
                break
        return emails
    except ImportError:
        print('✗ boto3 が必要です: pip install boto3')
        sys.exit(1)
    except Exception as e:
        print(f'✗ Cognito ユーザー一覧の取得に失敗: {e}')
        return set()


def create_cognito_user(email, password, name, role, department):
    """Cognito にユーザーを作成（boto3）"""
    try:
        import boto3
        from botocore.exceptions import ClientError
        client = boto3.client('cognito-idp', region_name=REGION)
        attrs = [
            {'Name': 'email', 'Value': email},
            {'Name': 'email_verified', 'Value': 'true'},
        ]
        if role:
            attrs.append({'Name': 'custom:role', 'Value': str(role)})
        if department:
            attrs.append({'Name': 'custom:department', 'Value': str(department)})

        client.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            UserAttributes=attrs,
            TemporaryPassword=password,
            MessageAction='SUPPRESS',
        )
        client.admin_set_user_password(
            UserPoolId=USER_POOL_ID,
            Username=email,
            Password=password,
            Permanent=True,
        )
        return True
    except ClientError as e:
        if e.response.get('Error', {}).get('Code') == 'UsernameExistsException':
            return False  # 既存はスキップ
        print(f'  ✗ {email}: {e}')
        return False
    except Exception as e:
        print(f'  ✗ {email}: {e}')
        return False


def main():
    dry_run = '--dry-run' in sys.argv
    password = os.environ.get(DEFAULT_PASSWORD_ENV) or FALLBACK_PASSWORD
    if not os.environ.get(DEFAULT_PASSWORD_ENV):
        print(f'⚠️  {DEFAULT_PASSWORD_ENV} が未設定のため、初回パスワードに {FALLBACK_PASSWORD!r} を使用します。')
        print('   本番では COGNITO_DEFAULT_PASSWORD を設定し、利用者に初回パスワードを通知・変更を促してください。\n')

    workers = get_workers()
    if not workers:
        print('従業員が 0 件です。')
        return

    existing = get_cognito_user_emails()
    to_create = [w for w in workers if (w.get('email') or '').strip() and (w.get('email') or '').strip().lower() not in {e.lower() for e in existing}]

    print(f'DynamoDB workers: {len(workers)} 件')
    print(f'Cognito 登録済み: {len(existing)} 件')
    print(f'Cognito に未登録（今回対象）: {len(to_create)} 件\n')

    if not to_create:
        print('Cognito に未登録の従業員はいません。このメールアドレスでログインできます。')
        return

    if dry_run:
        print('【--dry-run】以下のメールを Cognito に登録するとログイン可能になります:')
        for w in to_create:
            print(f"  - {w.get('email')} ({w.get('name')}, {w.get('role')})")
        return

    created = 0
    failed = 0
    for w in to_create:
        email = (w.get('email') or '').strip()
        name = (w.get('name') or '')[:50]
        role = (w.get('role') or 'staff')[:50]
        department = (w.get('department') or '')[:50]
        if create_cognito_user(email, password, name, role, department):
            created += 1
            print(f'  ✓ {email} ({name})')
        else:
            failed += 1

    print(f'\n作成: {created} 件, スキップ/失敗: {failed} 件')
    print('misogi のサインインで、上記メールアドレスと設定したパスワードでログインできます。')


if __name__ == '__main__':
    main()
