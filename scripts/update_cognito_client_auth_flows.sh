#!/bin/bash
# AWS Cognito User Pool App Clientの認証フローを更新

set -e

REGION="ap-northeast-1"
USER_POOL_ID="ap-northeast-1_EDKElIGoC"
CLIENT_ID="25abe85ibm5hn6rrsokd5jssb5"

echo "=== AWS Cognito App Clientの認証フローを更新 ==="

# App Clientの認証フローを更新
echo "App Clientの認証フローを更新中..."
aws cognito-idp update-user-pool-client \
  --user-pool-id ${USER_POOL_ID} \
  --client-id ${CLIENT_ID} \
  --region ${REGION} \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --query 'UserPoolClient.ClientId' \
  --output text

if [ $? -eq 0 ]; then
  echo "✅ App Clientの認証フローを更新しました"
  echo ""
  echo "有効な認証フロー:"
  echo "  - ALLOW_USER_SRP_AUTH"
  echo "  - ALLOW_USER_PASSWORD_AUTH"
  echo "  - ALLOW_REFRESH_TOKEN_AUTH"
else
  echo "❌ エラー: App Clientの更新に失敗しました"
  exit 1
fi

