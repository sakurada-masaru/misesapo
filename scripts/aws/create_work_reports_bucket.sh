#!/bin/bash
# 業務報告用 S3 バケット作成（misesapo-work-reports）
# 用途: POST /upload-url の添付ファイル（reports/日付/）、業務報告 PDF エクスポート（work-reports/report_id/）
# 実行: ./scripts/aws/create_work_reports_bucket.sh
# Lambda で使うには環境変数 WORK_REPORTS_BUCKET=misesapo-work-reports を設定し、実行ロールに S3 権限を付与すること。
# 権限付与: ./scripts/aws/attach_work_reports_s3_policy.sh（ポリシー定義は iam/work-reports-s3-policy.json）

set -e
BUCKET_NAME="misesapo-work-reports"
REGION="ap-northeast-1"

echo "=== 業務報告用 S3 バケット作成 ==="
echo "バケット名: ${BUCKET_NAME}"
echo "リージョン: ${REGION}"
echo ""

if aws s3api head-bucket --bucket "${BUCKET_NAME}" 2>/dev/null; then
  echo "⚠️  バケット ${BUCKET_NAME} は既に存在します"
  exit 0
fi

echo "バケット ${BUCKET_NAME} を作成中..."
aws s3api create-bucket \
  --bucket "${BUCKET_NAME}" \
  --region "${REGION}" \
  --create-bucket-configuration LocationConstraint="${REGION}"

echo "✅ バケット作成完了: s3://${BUCKET_NAME}"
echo ""
echo "次のステップ:"
echo "  1. Lambda（misesapo-reports）の環境変数に WORK_REPORTS_BUCKET=${BUCKET_NAME} を追加"
echo "  2. Lambda 実行ロールへ S3 権限を付与: ./scripts/aws/attach_work_reports_s3_policy.sh"
echo "  3. Lambda を再デプロイ: ./scripts/deploy_lambda.sh misesapo-reports prod lambda_function.py"
