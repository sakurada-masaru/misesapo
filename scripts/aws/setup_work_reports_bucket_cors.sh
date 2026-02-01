#!/bin/bash
# S3 バケット misesapo-work-reports に CORS を設定
# フロント（localhost や本番）から Presigned URL で PUT する際に CORS エラーにならないようにする
# 実行: ./scripts/aws/setup_work_reports_bucket_cors.sh

set -e
BUCKET_NAME="misesapo-work-reports"
REGION="ap-northeast-1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORS_JSON="${SCRIPT_DIR}/s3/work-reports-cors.json"

echo "=============================================="
echo "S3 バケット CORS 設定"
echo "バケット: ${BUCKET_NAME}  Region: ${REGION}"
echo "=============================================="

if [ ! -f "$CORS_JSON" ]; then
  echo "エラー: CORS 設定ファイルが見つかりません: $CORS_JSON"
  exit 1
fi

aws s3api put-bucket-cors \
  --bucket "$BUCKET_NAME" \
  --cors-configuration "file://${CORS_JSON}" \
  --region "$REGION"

echo "適用後の CORS 設定を確認:"
aws s3api get-bucket-cors --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null || echo "  (get-bucket-cors で確認)"

echo ""
echo "=============================================="
echo "✅ 完了。ブラウザで写真追加（Presigned URL で S3 PUT）を再試行してください。"
echo "   まだ CORS エラーが出る場合は、ブラウザをハードリロード（Ctrl+Shift+R / Cmd+Shift+R）してから再試行。"
echo "=============================================="
