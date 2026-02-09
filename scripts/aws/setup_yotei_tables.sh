#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-1}"

echo "[yotei] region: ${REGION}"

create_table_if_missing() {
  local table_name="$1"
  local key_attr="$2"

  if aws dynamodb describe-table --table-name "${table_name}" --region "${REGION}" >/dev/null 2>&1; then
    echo "[yotei] table exists: ${table_name}"
    return 0
  fi

  echo "[yotei] creating table: ${table_name}"
  aws dynamodb create-table \
    --table-name "${table_name}" \
    --attribute-definitions "AttributeName=${key_attr},AttributeType=S" \
    --key-schema "AttributeName=${key_attr},KeyType=HASH" \
    --billing-mode PAY_PER_REQUEST \
    --region "${REGION}" >/dev/null

  aws dynamodb wait table-exists --table-name "${table_name}" --region "${REGION}"
  echo "[yotei] created: ${table_name}"
}

create_table_if_missing "yotei" "id"

# Phase2（ugoki）で必要な場合のみ作成
if [[ "${CREATE_YOTEI_DISPATCH:-0}" == "1" ]]; then
  create_table_if_missing "yotei-dispatch" "id"
fi

echo "[yotei] done."
