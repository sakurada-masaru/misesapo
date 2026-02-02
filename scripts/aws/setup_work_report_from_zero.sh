#!/bin/bash
# 業務報告をゼロから立ち上げる（API・テーブル・DB・バケットすべて新規）
# 既存の WORK REPORT には触らない。
# 実行: ./scripts/aws/setup_work_report_from_zero.sh [gateway]
#   gateway … 先頭に渡すと専用 API（1x0f73dj2l）も新規作成。既にあれば省略可。
# 仕様: docs/spec/WORK_REPORT_API_SPEC.md

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CREATE_GATEWAY="${1:-}"

echo "=============================================="
echo "業務報告 ゼロから立ち上げ（API・テーブル・DB・バケット すべて新規）"
echo "=============================================="
echo ""

# 0) 専用 API 作成（オプション）
if [[ "$CREATE_GATEWAY" == "gateway" ]]; then
  echo ">>> 0) 専用 API Gateway を新規作成"
  "$SCRIPT_DIR/create_work_report_gateway.sh"
  echo ""
else
  echo ">>> 0) 専用 API はスキップ（既存の 1x0f73dj2l を使用。新規作成する場合は: $0 gateway）"
  echo ""
fi

# 1) 業務報告用テーブル（DynamoDB）を新規作成
echo ">>> 1) 業務報告用テーブル（misesapo-sales-work-reports）を新規作成"
"$SCRIPT_DIR/create_sales_work_reports_table.sh"
echo ""

# 2) 業務報告用 S3 バケットを新規作成
echo ">>> 2) 業務報告用 S3 バケット（misesapo-work-reports）を新規作成"
"$SCRIPT_DIR/create_work_reports_bucket.sh"
echo ""

# 3) 実行ロールに S3 バケット権限付与
echo ">>> 3) 実行ロールに S3 バケット権限を付与"
"$SCRIPT_DIR/attach_work_reports_s3_policy.sh"
echo ""

# 4) 実行ロールに DynamoDB 権限付与
echo ">>> 4) 実行ロールに業務報告テーブル（DynamoDB）への権限を付与"
"$SCRIPT_DIR/attach_work_reports_dynamodb_policy.sh"
echo ""

# 5) 業務報告専用 Lambda（misesapo-work-reports）の作成・デプロイ
echo ">>> 5) 業務報告専用 Lambda（misesapo-work-reports）の作成・デプロイ"
"$SCRIPT_DIR/create_work_reports_lambda.sh" 2>/dev/null || true
"$REPO_ROOT/scripts/deploy_work_reports_lambda.sh" prod
echo ""

# 6) 専用 API（1x0f73dj2l）を専用 Lambda に紐づけ
echo ">>> 6) 専用 API 1x0f73dj2l を misesapo-work-reports に紐づけ"
"$SCRIPT_DIR/setup_work_report_api_full.sh" "1x0f73dj2l" "misesapo-work-reports"
echo ""

echo "=============================================="
echo "✅ 業務報告のゼロ立ち上げが完了しました"
echo "   API: 専用ゲート 1x0f73dj2l（vite は /api-wr でプロキシ済み）"
echo "   Lambda: misesapo-work-reports (prod) ※業務報告専用"
echo "   テーブル: misesapo-sales-work-reports"
echo "   バケット: misesapo-work-reports"
echo "   管理・経理: /api-wr → 1x0f73dj2l（misesapo-work-reports）"
echo "=============================================="
echo ""
echo "フロントで営業日報の保存・提出と管理画面の一覧表示が 200 になることを確認してください。"
