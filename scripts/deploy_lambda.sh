#!/bin/bash
# scripts/deploy_lambda.sh
#
# 要点:
#   - 実行時に REPO_ROOT に cd して安定化
#   - lambda_package/ は .gitignore でリポジトリに無いため、デプロイ時に「生成」する（再現性担保）
#     mkdir lambda_package && ルートの universal_work_reports.py 等をコピー → zip -j で同梱
#   - 続けて lambda_function.py / misogi_*.py を投入して handler をルート版で上書き
#   - unzip -l で universal_work_reports.py が無ければエラー終了
#   - 依存: boto3（Lambda内蔵）と標準ライブラリのみ。追加パッケージ不要。
#
# 実行例: ./scripts/deploy_lambda.sh misesapo-reports prod lambda_function.py
#
# 完了条件: GET /work-report?date=2026-01-29 が 503 以外（200/401/404等）になり、CloudWatch で import 後ログが確認できること。
#
# ローカルでZIP内容を確認する例:
#   cd /path/to/misesapo
#   TEMP_ZIP="/tmp/lambda_verify.zip"
#   find lambda_package -maxdepth 1 -name "*.py" -type f -exec zip -j "$TEMP_ZIP" {} \;
#   for f in lambda_function.py misogi_flags.py misogi_schemas.py; do [[ -f "$f" ]] && zip -j "$TEMP_ZIP" "$f"; done
#   unzip -l "$TEMP_ZIP" | grep universal_work_reports.py  # 必ず 1 行出ること
#   rm -f "$TEMP_ZIP"

# 引数チェック
if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <function-name> <stg|prod> [source-file]"
    echo "Example: $0 misesapo-reports prod lambda_function.py"
    exit 1
fi

FUNCTION_NAME=$1
STAGE=$2
SOURCE_FILE=${3:-"lambda_function.py"}
API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
ACCOUNT_ID="475462779604"

# リポジトリルートで実行（lambda_package はスクリプト内で生成）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT" || exit 1

echo "--------------------------------------------------"
echo "🚀 Deploying to $FUNCTION_NAME ($STAGE)"
echo "📄 Source file: $SOURCE_FILE"
echo "📁 Working directory: $REPO_ROOT"
echo "--------------------------------------------------"

# 1. コードのZIP作成（lambda_function.py の場合は lambda_package を「生成」してからZIP＝再現性担保）
TEMP_ZIP="/tmp/lambda_deploy_$(date +%s).zip"
if [[ "$SOURCE_FILE" == "lambda_function.py" ]]; then
    # lambda_package を生成（.gitignore でリポジトリに無くても再現できるようにする）
    LAMBDA_PKG_DIR="$REPO_ROOT/lambda_package"
    mkdir -p "$LAMBDA_PKG_DIR"
    # ルートから同梱すべき .py を lambda_package にコピー（Lambda で import するモジュール）
    for f in universal_work_reports.py; do
        if [[ -f "$REPO_ROOT/$f" ]]; then
            cp "$REPO_ROOT/$f" "$LAMBDA_PKG_DIR/"
            echo "📦 Copied $f -> lambda_package/"
        else
            echo "⚠️ WARNING: $f not found at repo root (optional if not using work-reports)"
        fi
    done
    # lambda_package/*.py が 0 件の場合はエラー
    PACKAGE_PY_COUNT=$(find "$LAMBDA_PKG_DIR" -maxdepth 1 -name "*.py" -type f 2>/dev/null | wc -l)
    if [[ "$PACKAGE_PY_COUNT" -eq 0 ]]; then
        echo "❌ ERROR: lambda_package/*.py が 0 件です。universal_work_reports.py 等をルートに配置してください。"
        exit 1
    fi
    # lambda_package/*.py をすべて ZIP ルートに投入（-j でパスを落とす）
    find "$LAMBDA_PKG_DIR" -maxdepth 1 -name "*.py" -type f -exec zip -j "$TEMP_ZIP" {} \;
    # ルートの lambda_function.py / misogi_*.py を投入して handler をルート版で上書き
    for f in lambda_function.py misogi_flags.py misogi_schemas.py; do
        [[ -f "$REPO_ROOT/$f" ]] && zip -j "$TEMP_ZIP" "$REPO_ROOT/$f"
    done
    # 必須: universal_work_reports.py がZIPに無ければエラー終了
    if ! unzip -l "$TEMP_ZIP" | grep -q "universal_work_reports.py"; then
        echo "❌ ERROR: universal_work_reports.py がZIPに含まれていません。ルートに universal_work_reports.py を配置してください。"
        rm -f "$TEMP_ZIP"
        exit 1
    fi
    # 同梱 .py 一覧を表示してログに残す
    echo "✅ 同梱 .py 一覧:"
    unzip -l "$TEMP_ZIP" | grep -E "\.py$"
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
