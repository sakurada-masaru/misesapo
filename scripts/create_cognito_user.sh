#!/bin/bash
# AWS Cognito User Poolにユーザーを作成するスクリプト

set -e

REGION="ap-northeast-1"
USER_POOL_ID="ap-northeast-1_EDKElIGoC"

# ユーザー情報
EMAIL="${1:-masarunospec@gmail.com}"
PASSWORD="${2:-MandC280408}"
NAME="${3:-Masaru}"
ROLE="${4:-admin}"
DEPARTMENT="${5:-管理者}"

echo "=== AWS Cognito User Poolにユーザーを作成 ==="
echo "メールアドレス: ${EMAIL}"
echo "名前: ${NAME}"
echo "ロール: ${ROLE}"
echo "部署: ${DEPARTMENT}"
echo ""

# ユーザーを作成
echo "ユーザーを作成中..."
USER_CREATE_RESPONSE=$(aws cognito-idp admin-create-user \
  --user-pool-id ${USER_POOL_ID} \
  --username ${EMAIL} \
  --user-attributes \
    Name=email,Value=${EMAIL} \
    Name=email_verified,Value=true \
    Name=custom:name,Value="${NAME}" \
    Name=custom:role,Value=${ROLE} \
    Name=custom:department,Value="${DEPARTMENT}" \
  --temporary-password ${PASSWORD} \
  --message-action SUPPRESS \
  --region ${REGION} 2>&1)

if [ $? -ne 0 ]; then
  if echo "$USER_CREATE_RESPONSE" | grep -q "UsernameExistsException"; then
    echo "⚠️  ユーザーは既に存在します。パスワードを更新します..."
  else
    echo "❌ エラー: ユーザーの作成に失敗しました"
    echo "$USER_CREATE_RESPONSE"
    exit 1
  fi
else
  echo "✅ ユーザーを作成しました"
fi

# パスワードを永続化（一時パスワードから通常パスワードに変更）
echo "パスワードを永続化中..."
aws cognito-idp admin-set-user-password \
  --user-pool-id ${USER_POOL_ID} \
  --username ${EMAIL} \
  --password ${PASSWORD} \
  --permanent \
  --region ${REGION} > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ パスワードを永続化しました"
else
  echo "⚠️  パスワードの永続化に失敗しました（一時パスワードのままです）"
fi

echo ""
echo "=== 作成完了 ==="
echo "メールアドレス: ${EMAIL}"
echo "パスワード: ${PASSWORD}"
echo ""
echo "📝 次のステップ:"
echo "1. /staff/signin.html でログインしてください"
echo "2. 管理者画面でユーザー情報をDynamoDBに保存してください"

