#!/bin/bash
# AWS Cognito User Pool作成スクリプト

set -e

REGION="ap-northeast-1"
USER_POOL_NAME="misesapo-workers-pool"
CLIENT_NAME="misesapo-workers-client"

echo "=== AWS Cognito User Pool作成を開始 ==="

# User Poolを作成
echo "User Poolを作成中..."
USER_POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name ${USER_POOL_NAME} \
  --region ${REGION} \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=true}" \
  --schema \
    Name=email,AttributeDataType=String,Required=true,Mutable=true \
    Name=name,AttributeDataType=String,Required=false,Mutable=true \
    Name=role,AttributeDataType=String,Required=false,Mutable=true \
    Name=department,AttributeDataType=String,Required=false,Mutable=true \
  --query 'UserPool.Id' \
  --output text)

if [ -z "$USER_POOL_ID" ]; then
  echo "❌ エラー: User Poolの作成に失敗しました"
  exit 1
fi

echo "✅ User Poolを作成しました: ${USER_POOL_ID}"

# App Clientを作成
echo "App Clientを作成中..."
CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id ${USER_POOL_ID} \
  --client-name ${CLIENT_NAME} \
  --region ${REGION} \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --access-token-validity 3600 \
  --id-token-validity 3600 \
  --refresh-token-validity 2592000 \
  --query 'UserPoolClient.ClientId' \
  --output text)

if [ -z "$CLIENT_ID" ]; then
  echo "❌ エラー: App Clientの作成に失敗しました"
  exit 1
fi

echo "✅ App Clientを作成しました: ${CLIENT_ID}"

# 結果を表示
echo ""
echo "=== 作成完了 ==="
echo "User Pool ID: ${USER_POOL_ID}"
echo "Client ID: ${CLIENT_ID}"
echo ""
echo "📝 次のステップ:"
echo "1. これらのIDを環境変数または設定ファイルに保存してください"
echo "2. フロントエンドの認証処理を実装してください"
echo "3. Lambda関数でCognito認証を実装してください"

