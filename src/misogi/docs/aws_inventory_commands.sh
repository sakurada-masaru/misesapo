#!/usr/bin/env bash
# v1 データ所在マップ用：AWS リソースの所在取得（秘密情報は取得しない）
# 実行: プロジェクトルートで bash docs/aws_inventory_commands.sh
# 前提: AWS CLI 設定済み。出力は aws_inventory/ に保存。
# 禁止: get-secret-value / ユーザ一覧 / Access Key 等は実行しない。

set -e
export AWS_REGION="${AWS_REGION:-ap-northeast-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$ROOT_DIR/aws_inventory"
mkdir -p "$OUT_DIR"
cd "$OUT_DIR"

echo "[1/6] Cognito User Pools (list only)..."
aws cognito-idp list-user-pools --max-results 60 --region "$AWS_REGION" --output json > cognito_user_pools.json 2>/dev/null || echo "[]" > cognito_user_pools.json

echo "[2/6] Cognito Identity Pools (list only)..."
aws cognito-identity list-identity-pools --max-results 60 --region "$AWS_REGION" --output json > cognito_identity_pools.json 2>/dev/null || echo "[]" > cognito_identity_pools.json

# 候補プールがあれば詳細（POOL_ID は cognito_user_pools.json の Id を手動で指定して実行可）
# aws cognito-idp describe-user-pool --user-pool-id <POOL_ID> --region $AWS_REGION --output json > cognito_<POOL_ID>_detail.json
# aws cognito-idp list-user-pool-clients --user-pool-id <POOL_ID> --region $AWS_REGION --output json > cognito_<POOL_ID>_clients.json

echo "[3/6] S3 Buckets (list only)..."
aws s3api list-buckets --output json > s3_buckets.json 2>/dev/null || echo "{}" > s3_buckets.json

# 候補バケットを絞り、CORS/ロケーション確認（秘密は含めない）
# for b in BUCKET1 BUCKET2; do aws s3api get-bucket-cors --bucket "$b" --output json > "s3_${b}_cors.json" 2>/dev/null || true; aws s3api get-bucket-location --bucket "$b" --output json > "s3_${b}_location.json" 2>/dev/null || true; done

echo "[4/6] Secrets Manager (list only, get-secret-value は実行しない)..."
aws secretsmanager list-secrets --region "$AWS_REGION" --output json > secrets_list.json 2>/dev/null || echo "{}" > secrets_list.json

echo "[5/6] CloudFront Distributions (list only)..."
aws cloudfront list-distributions --output json > cloudfront_distributions.json 2>/dev/null || echo "{}" > cloudfront_distributions.json

echo "[6/6] IAM Roles (list only, misesapo 系だけ抽出する場合は jq で絞る)..."
aws iam list-roles --output json > iam_roles.json 2>/dev/null || echo "{}" > iam_roles.json

# API Gateway Authorizer の有無（REST API ID が分かっている場合）
# aws apigateway get-rest-apis --region $AWS_REGION --output json > apigw_apis.json
# aws apigateway get-authorizers --rest-api-id <REST_API_ID> --region $AWS_REGION --output json > apigw_<API_ID>_authorizers.json

# DynamoDB テーブル一覧
echo "[DynamoDB] Tables..."
aws dynamodb list-tables --region "$AWS_REGION" --output json > dynamodb_tables.json 2>/dev/null || echo "{}" > dynamodb_tables.json

# 候補テーブル describe（手動でテーブル名を指定して実行可）
# for t in UNIVERSAL_WORK_LOGS misesapo-clients misesapo-brands misesapo-stores report-images workers attendance; do aws dynamodb describe-table --table-name "$t" --region $AWS_REGION --output json > "dynamodb_${t}.json" 2>/dev/null || true; done

echo "Done. Output in $OUT_DIR/"
echo "※ get-secret-value / ユーザ一覧 / Access Key 等は取得していません。"
