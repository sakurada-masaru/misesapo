#!/bin/bash

# NFCタグ打刻システム - AWSリソースセットアップスクリプト
# このスクリプトは、NFCタグ打刻システムに必要なAWSリソースを作成します

set -e

echo "=========================================="
echo "NFCタグ打刻システム - AWSリソースセットアップ"
echo "=========================================="
echo ""

# 設定変数（必要に応じて変更してください）
REGION="ap-northeast-1"
TABLE_NAME="cleaning-logs"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"  # 既存のLambda関数名に合わせて変更してください
API_GATEWAY_NAME="misesapo-api"  # 既存のAPI Gateway名に合わせて変更してください

echo "設定:"
echo "  リージョン: $REGION"
echo "  DynamoDBテーブル名: $TABLE_NAME"
echo "  Lambda関数名: $LAMBDA_FUNCTION_NAME"
echo "  API Gateway名: $API_GATEWAY_NAME"
echo ""

# 1. DynamoDBテーブルの作成
echo "1. DynamoDBテーブルを作成中..."
aws dynamodb create-table \
    --table-name $TABLE_NAME \
    --attribute-definitions \
        AttributeName=log_id,AttributeType=S \
        AttributeName=timestamp,AttributeType=S \
    --key-schema \
        AttributeName=log_id,KeyType=HASH \
        AttributeName=timestamp,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region $REGION \
    --no-cli-pager

echo "  テーブル作成を待機中..."
aws dynamodb wait table-exists \
    --table-name $TABLE_NAME \
    --region $REGION

echo "  ✓ DynamoDBテーブル '$TABLE_NAME' を作成しました"
echo ""

# 2. IAMポリシーの確認と追加
echo "2. Lambda関数のIAMロールを確認中..."
LAMBDA_ROLE_ARN=$(aws lambda get-function \
    --function-name $LAMBDA_FUNCTION_NAME \
    --region $REGION \
    --query 'Configuration.Role' \
    --output text)

LAMBDA_ROLE_NAME=$(echo $LAMBDA_ROLE_ARN | awk -F'/' '{print $NF}')

echo "  Lambda関数のロール名: $LAMBDA_ROLE_NAME"
echo ""

# IAMポリシードキュメントを作成
POLICY_DOC=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem"
      ],
      "Resource": "arn:aws:dynamodb:${REGION}:*:table/${TABLE_NAME}"
    }
  ]
}
EOF
)

# ポリシー名
POLICY_NAME="CleaningLogsWritePolicy"

echo "3. IAMポリシーを作成中..."
# 既存のポリシーをチェック
EXISTING_POLICY=$(aws iam list-policies \
    --scope Local \
    --query "Policies[?PolicyName=='${POLICY_NAME}'].Arn" \
    --output text \
    --region $REGION 2>/dev/null || echo "")

if [ -z "$EXISTING_POLICY" ]; then
    # ポリシーを作成
    POLICY_ARN=$(aws iam create-policy \
        --policy-name $POLICY_NAME \
        --policy-document "$POLICY_DOC" \
        --query 'Policy.Arn' \
        --output text \
        --region $REGION)
    
    echo "  ✓ IAMポリシー '$POLICY_NAME' を作成しました"
    echo "  ポリシーARN: $POLICY_ARN"
else
    POLICY_ARN=$EXISTING_POLICY
    echo "  ℹ IAMポリシー '$POLICY_NAME' は既に存在します"
    echo "  ポリシーARN: $POLICY_ARN"
fi
echo ""

# アカウントIDを取得
ACCOUNT_ID=$(aws sts get-caller-identity \
    --query 'Account' \
    --output text \
    --region $REGION)

FULL_POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"

echo "4. Lambda関数のロールにポリシーをアタッチ中..."
# 既にアタッチされているかチェック
ATTACHED=$(aws iam list-attached-role-policies \
    --role-name $LAMBDA_ROLE_NAME \
    --query "AttachedPolicies[?PolicyArn=='${FULL_POLICY_ARN}'].PolicyArn" \
    --output text \
    --region $REGION 2>/dev/null || echo "")

if [ -z "$ATTACHED" ]; then
    aws iam attach-role-policy \
        --role-name $LAMBDA_ROLE_NAME \
        --policy-arn $FULL_POLICY_ARN \
        --region $REGION
    
    echo "  ✓ IAMポリシーをロールにアタッチしました"
else
    echo "  ℹ IAMポリシーは既にロールにアタッチされています"
fi
echo ""

echo "=========================================="
echo "セットアップ完了！"
echo "=========================================="
echo ""
echo "次のステップ:"
echo "1. API Gatewayで '/staff/nfc/clock-in' エンドポイントを追加してください"
echo "2. 以下のコマンドでテストできます:"
echo ""
echo "   curl -X POST https://YOUR_API_GATEWAY_URL/prod/staff/nfc/clock-in \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"user_id\":\"WKR_001\",\"facility_id\":\"ABC_001\",\"location_id\":\"TK_R01_TOILET_IN\"}'"
echo ""
echo "詳細は docs/NFC_CLOCK_IN_SETUP.md を参照してください。"

