#!/usr/bin/env bash
set -euo pipefail

REGION="${REGION:-ap-northeast-1}"
API_NAME="${API_NAME:-jinzai-data}"
STAGE="${STAGE:-prod}"
LAMBDA_NAME="${LAMBDA_NAME:-misesapo-jinzai-data-api}"
KABAN_BUCKET="${KABAN_BUCKET:-jinzai-kaban}"

echo "REGION=$REGION"
echo "API_NAME=$API_NAME"
echo "STAGE=$STAGE"
echo "LAMBDA_NAME=$LAMBDA_NAME"
echo "KABAN_BUCKET=$KABAN_BUCKET"

create_table_if_missing () {
  local TABLE="$1"
  local PK="$2"
  if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" >/dev/null 2>&1; then
    echo "[exists] $TABLE"
    return
  fi
  echo "[create] $TABLE"
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName="$PK",AttributeType=S \
    --key-schema AttributeName="$PK",KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" >/dev/null
  aws dynamodb wait table-exists --table-name "$TABLE" --region "$REGION"
  echo "[ready] $TABLE"
}

create_table_if_missing "jinzai" "jinzai_id"
create_table_if_missing "jinzai_busho" "busho_id"
create_table_if_missing "jinzai_shokushu" "shokushu_code"
create_table_if_missing "jinzai_kaban" "jinzai_kaban_id"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

if aws lambda get-function --function-name "$LAMBDA_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "[lambda exists] $LAMBDA_NAME"
else
  echo "[lambda create] $LAMBDA_NAME"
  zip -j /tmp/jinzai-api.zip lambda_jinzai_api.py >/dev/null
  ROLE_ARN="$(aws iam get-role --role-name misesapo-s3-upload-role-822vffeh --query Role.Arn --output text)"
  aws lambda create-function \
    --function-name "$LAMBDA_NAME" \
    --runtime python3.9 \
    --handler lambda_jinzai_api.lambda_handler \
    --zip-file fileb:///tmp/jinzai-api.zip \
    --role "$ROLE_ARN" \
    --timeout 10 \
    --memory-size 256 \
    --region "$REGION" >/dev/null
  echo "[lambda ready] $LAMBDA_NAME"
fi

aws lambda update-function-configuration \
  --function-name "$LAMBDA_NAME" \
  --region "$REGION" \
  --environment "Variables={TABLE_JINZAI=jinzai,TABLE_JINZAI_BUSHO=jinzai_busho,TABLE_JINZAI_SHOKUSHU=jinzai_shokushu,TABLE_JINZAI_KABAN=jinzai_kaban,KABAN_BUCKET=${KABAN_BUCKET}}" >/dev/null

aws lambda wait function-updated --function-name "$LAMBDA_NAME" --region "$REGION"

zip -j /tmp/jinzai-api.zip lambda_jinzai_api.py >/dev/null
aws lambda update-function-code --function-name "$LAMBDA_NAME" --zip-file fileb:///tmp/jinzai-api.zip --region "$REGION" >/dev/null
aws lambda wait function-updated --function-name "$LAMBDA_NAME" --region "$REGION"
echo "[lambda updated] $LAMBDA_NAME"

API_ID="$(aws apigateway get-rest-apis --region "$REGION" --query "items[?name=='${API_NAME}'].id | [0]" --output text)"
if [[ -z "$API_ID" || "$API_ID" == "None" ]]; then
  API_ID="$(aws apigateway create-rest-api --name "$API_NAME" --region "$REGION" --query id --output text)"
  echo "[api created] $API_NAME -> $API_ID"
else
  echo "[api exists] $API_NAME -> $API_ID"
fi

ROOT_ID="$(aws apigateway get-resources --rest-api-id "$API_ID" --region "$REGION" --query "items[?path=='/'].id | [0]" --output text)"

create_res () {
  local PARENT="$1"
  local PART="$2"
  local ID
  ID="$(aws apigateway get-resources --rest-api-id "$API_ID" --region "$REGION" --query "items[?parentId=='${PARENT}' && pathPart=='${PART}'].id | [0]" --output text)"
  if [[ -z "$ID" || "$ID" == "None" ]]; then
    ID="$(aws apigateway create-resource --rest-api-id "$API_ID" --region "$REGION" --parent-id "$PARENT" --path-part "$PART" --query id --output text)"
  fi
  echo "$ID"
}

JINZAI_ID="$(create_res "$ROOT_ID" "jinzai")"
JINZAI_ITEM_ID="$(create_res "$JINZAI_ID" "{jinzai_id}")"
BUSHO_ID="$(create_res "$JINZAI_ID" "busho")"
SHOKUSHU_ID="$(create_res "$JINZAI_ID" "shokushu")"
BUSHO_ITEM_ID="$(create_res "$BUSHO_ID" "{busho_id}")"
SHOKUSHU_ITEM_ID="$(create_res "$SHOKUSHU_ID" "{shokushu_code}")"
KABAN_COLL_ID="$(create_res "$JINZAI_ITEM_ID" "kaban")"
KABAN_ITEM_ID="$(create_res "$KABAN_COLL_ID" "{jinzai_kaban_id}")"

put_method_safe () {
  local RID="$1"
  local M="$2"
  aws apigateway put-method \
    --rest-api-id "$API_ID" \
    --region "$REGION" \
    --resource-id "$RID" \
    --http-method "$M" \
    --authorization-type NONE >/dev/null 2>&1 || true
}

for m in GET POST OPTIONS; do put_method_safe "$JINZAI_ID" "$m"; done
for m in GET PUT DELETE OPTIONS; do put_method_safe "$JINZAI_ITEM_ID" "$m"; done
for m in GET POST OPTIONS; do put_method_safe "$BUSHO_ID" "$m"; done
for m in GET POST OPTIONS; do put_method_safe "$SHOKUSHU_ID" "$m"; done
for m in GET PUT DELETE OPTIONS; do put_method_safe "$BUSHO_ITEM_ID" "$m"; done
for m in GET PUT DELETE OPTIONS; do put_method_safe "$SHOKUSHU_ITEM_ID" "$m"; done
for m in GET POST OPTIONS; do put_method_safe "$KABAN_COLL_ID" "$m"; done
for m in PUT DELETE OPTIONS; do put_method_safe "$KABAN_ITEM_ID" "$m"; done

LAMBDA_URI="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_NAME}/invocations"

put_integration_safe () {
  local RID="$1"
  local M="$2"
  aws apigateway put-integration \
    --rest-api-id "$API_ID" \
    --region "$REGION" \
    --resource-id "$RID" \
    --http-method "$M" \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "$LAMBDA_URI" >/dev/null
}

for m in GET POST OPTIONS; do put_integration_safe "$JINZAI_ID" "$m"; done
for m in GET PUT DELETE OPTIONS; do put_integration_safe "$JINZAI_ITEM_ID" "$m"; done
for m in GET POST OPTIONS; do put_integration_safe "$BUSHO_ID" "$m"; done
for m in GET POST OPTIONS; do put_integration_safe "$SHOKUSHU_ID" "$m"; done
for m in GET PUT DELETE OPTIONS; do put_integration_safe "$BUSHO_ITEM_ID" "$m"; done
for m in GET PUT DELETE OPTIONS; do put_integration_safe "$SHOKUSHU_ITEM_ID" "$m"; done
for m in GET POST OPTIONS; do put_integration_safe "$KABAN_COLL_ID" "$m"; done
for m in PUT DELETE OPTIONS; do put_integration_safe "$KABAN_ITEM_ID" "$m"; done

SID="apigw-${API_ID}-invoke-${LAMBDA_NAME}"
aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --statement-id "$SID" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/*" \
  --region "$REGION" >/dev/null 2>&1 || true

aws apigateway create-deployment --rest-api-id "$API_ID" --region "$REGION" --stage-name "$STAGE" >/dev/null

echo "DONE"
echo "API_ID=$API_ID"
echo "BASE=https://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}"
