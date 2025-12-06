#!/usr/bin/env python3
"""
Cognitoユーザーのロールを更新するスクリプト
"""
import boto3
import sys

REGION = 'ap-northeast-1'
USER_POOL_ID = 'ap-northeast-1_EDKElIGoC'

def update_cognito_user_role(email, role):
    """Cognitoユーザーのロールを更新"""
    try:
        cognito_client = boto3.client('cognito-idp', region_name=REGION)
        
        # ユーザーの現在の属性を取得
        response = cognito_client.admin_get_user(
            UserPoolId=USER_POOL_ID,
            Username=email
        )
        
        # 既存の属性を取得
        existing_attrs = {attr['Name']: attr['Value'] for attr in response.get('UserAttributes', [])}
        
        # 更新する属性を準備
        user_attributes = [
            {'Name': 'custom:role', 'Value': role}
        ]
        
        # 既存のnameとdepartmentも保持
        if 'custom:name' in existing_attrs:
            user_attributes.append({'Name': 'custom:name', 'Value': existing_attrs['custom:name']})
        if 'custom:department' in existing_attrs:
            user_attributes.append({'Name': 'custom:department', 'Value': existing_attrs['custom:department']})
        
        # ユーザー属性を更新
        cognito_client.admin_update_user_attributes(
            UserPoolId=USER_POOL_ID,
            Username=email,
            UserAttributes=user_attributes
        )
        
        print(f'✓ Cognitoユーザー {email} のロールを {role} に更新しました')
        return True
        
    except cognito_client.exceptions.UserNotFoundException:
        print(f'✗ Cognitoユーザー {email} が見つかりません')
        return False
    except Exception as e:
        print(f'✗ Cognitoユーザー {email} の更新に失敗しました: {e}')
        return False

if __name__ == '__main__':
    if len(sys.argv) >= 3:
        email = sys.argv[1]
        role = sys.argv[2]
    else:
        print('Usage: python3 update_cognito_user_role.py <email> <role>')
        sys.exit(1)
    
    success = update_cognito_user_role(email, role)
    sys.exit(0 if success else 1)

