#!/bin/bash
# Google Calendar API用のLambda Layerを作成するスクリプト

set -e

REGION="ap-northeast-1"
LAYER_NAME="google-calendar-api"
PYTHON_VERSION="python3.12"

echo "=== Google Calendar API Lambda Layer作成スクリプト ==="
echo ""

# 一時ディレクトリを作成
TEMP_DIR=$(mktemp -d)
echo "一時ディレクトリ: ${TEMP_DIR}"

# 依存関係をインストール
echo "依存関係をインストール中..."
pip3 install -r requirements.txt -t ${TEMP_DIR}/python/lib/${PYTHON_VERSION}/site-packages/

# ZIPファイルを作成
ZIP_FILE="google-calendar-layer.zip"
echo "ZIPファイルを作成中: ${ZIP_FILE}"
cd ${TEMP_DIR}
zip -r ${ZIP_FILE} . > /dev/null
mv ${ZIP_FILE} ~/Desktop/misesapo-main/

# Lambda Layerを作成
echo "Lambda Layerを作成中..."
cd ~/Desktop/misesapo-main
LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name ${LAYER_NAME} \
  --description "Google Calendar API libraries" \
  --zip-file fileb://${ZIP_FILE} \
  --compatible-runtimes ${PYTHON_VERSION} \
  --region ${REGION} \
  --query 'LayerVersionArn' \
  --output text)

echo "Lambda Layer作成完了: ${LAYER_ARN}"
echo ""

# Lambda関数にLayerを追加
echo "Lambda関数にLayerを追加中..."
FUNCTION_NAME="misesapo-s3-upload"

# 既存のLayersを取得（Noneを除外）
EXISTING_LAYERS=$(aws lambda get-function-configuration \
  --function-name ${FUNCTION_NAME} \
  --region ${REGION} \
  --query 'Layers[?Arn!=`null`].Arn' \
  --output text)

# 新しいLayerを追加
if [ -z "$EXISTING_LAYERS" ] || [ "$EXISTING_LAYERS" == "None" ]; then
  LAYERS="${LAYER_ARN}"
else
  LAYERS="${EXISTING_LAYERS} ${LAYER_ARN}"
fi

aws lambda update-function-configuration \
  --function-name ${FUNCTION_NAME} \
  --layers ${LAYERS} \
  --region ${REGION} > /dev/null

echo "Lambda関数にLayerを追加しました"
echo ""

# 一時ディレクトリを削除
rm -rf ${TEMP_DIR}

echo "=========================================="
echo "完了！"
echo "=========================================="
echo ""
echo "Layer ARN: ${LAYER_ARN}"
echo ""
echo "次のステップ:"
echo "1. Lambda関数がLayerを使用しているか確認"
echo "2. APIエンドポイントをテスト"
echo ""

