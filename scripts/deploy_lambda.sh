#!/bin/bash
# scripts/deploy_lambda.sh

# 引数チェック
if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <function-name> <stg|prod> [source-file]"
    echo "Example: $0 misesapo-s3-upload stg lambda_function.py"
    exit 1
fi

FUNCTION_NAME=$1
STAGE=$2
SOURCE_FILE=${3:-"lambda_function.py"}
API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
ACCOUNT_ID="475462779604"

echo "--------------------------------------------------"
echo "🚀 Deploying to $FUNCTION_NAME ($STAGE)"
echo "📄 Source file: $SOURCE_FILE"
echo "--------------------------------------------------"

# 1. コードのZIP作成 (依存ファイルも含める)
TEMP_ZIP="/tmp/lambda_deploy_$(date +%s).zip"
if [[ "$SOURCE_FILE" == "lambda_function.py" ]]; then
    # メイン関数の場合は共通モジュールも含める
    zip -j "$TEMP_ZIP" "$SOURCE_FILE" misogi_flags.py misogi_schemas.py
else
    zip -j "$TEMP_ZIP" "$SOURCE_FILE"
fi

# 2. 関数コードの更新
echo "📥 Updating function code..."
aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$TEMP_ZIP" \
    --region "$REGION" > /dev/null

# 更新完了を待機 (ResourceConflictException 対策)
echo "⏳ Waiting for update to complete..."
aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION"

# 3. バージョンの発行
echo "🔖 Publishing new version..."
VERSION=$(aws lambda publish-version --function-name "$FUNCTION_NAME" --region "$REGION" --query "Version" --output text)
echo "✅ Published version: $VERSION"

# 4. エイリアスの更新 (なければ作成)
echo "🔗 Updating alias '$STAGE' to version $VERSION..."
aws lambda update-alias \
    --function-name "$FUNCTION_NAME" \
    --name "$STAGE" \
    --function-version "$VERSION" \
    --region "$REGION" || \
aws lambda create-alias \
    --function-name "$FUNCTION_NAME" \
    --name "$STAGE" \
    --function-version "$VERSION" \
    --region "$REGION"

# 5. API Gateway 実行権限の付与 (ステージ固定)
echo "🔑 Ensuring API Gateway permissions..."
aws lambda add-permission \
    --function-name "arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}:${STAGE}" \
    --statement-id "apigw-invoke-${STAGE}-$(date +%s)" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/${STAGE}/*/*" \
    --region "$REGION" > /dev/null 2>&1 || echo "⚠️ Permission already exists or could not be added (Skipped)"

# 6. 完了報告
echo "--------------------------------------------------"
echo "✨ Deployment Complete!"
echo "Function: $FUNCTION_NAME"
echo "Alias:    $STAGE -> Version $VERSION"
echo "URL:      https://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}/"
echo "--------------------------------------------------"

rm "$TEMP_ZIP"
