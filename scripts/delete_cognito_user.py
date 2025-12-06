#!/usr/bin/env python3
"""
Cognitoユーザーを削除するスクリプト
"""
import boto3
import sys

REGION = 'ap-northeast-1'
USER_POOL_ID = 'ap-northeast-1_EDKElIGoC'

def delete_cognito_user(email):
    """Cognitoユーザーを削除"""
    try:
        cognito_client = boto3.client('cognito-idp', region_name=REGION)
        
        cognito_client.admin_delete_user(
            UserPoolId=USER_POOL_ID,
            Username=email
        )
        
        print(f'✓ Cognitoユーザー {email} を削除しました')
        return True
        
    except cognito_client.exceptions.UserNotFoundException:
        print(f'⚠ Cognitoユーザー {email} は既に存在しません')
        return True  # 既に削除されている場合は成功とみなす
    except Exception as e:
        print(f'✗ Cognitoユーザー {email} の削除に失敗しました: {e}')
        return False

if __name__ == '__main__':
    if len(sys.argv) >= 2:
        email = sys.argv[1]
    else:
        print('Usage: python3 delete_cognito_user.py <email>')
        sys.exit(1)
    
    success = delete_cognito_user(email)
    sys.exit(0 if success else 1)

