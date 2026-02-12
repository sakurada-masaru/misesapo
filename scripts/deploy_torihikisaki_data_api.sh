#!/usr/bin/env bash
set -euo pipefail

# Deploy the local master API implementation (lambda_torihikisaki_api.py)
# into the AWS Lambda that backs torihikisaki-data API Gateway (jtn6in2iuj).
#
# This repo's convention is: Lambda handler module is `lambda_function.lambda_handler`,
# so we package our code as `lambda_function.py` inside the zip.
#
# Usage:
#   bash scripts/deploy_torihikisaki_data_api.sh
#
# Optional env:
#   REGION=ap-northeast-1
#   LAMBDA_NAME=misesapo-torihikisaki-data-api

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${REGION:-ap-northeast-1}"
LAMBDA_NAME="${LAMBDA_NAME:-misesapo-torihikisaki-data-api}"
SRC="${ROOT_DIR}/lambda_torihikisaki_api.py"

if [[ ! -f "$SRC" ]]; then
  echo "[ERROR] source not found: $SRC" >&2
  exit 1
fi

echo "[deploy] region=$REGION lambda=$LAMBDA_NAME"

# Confirm the function exists and read handler
HANDLER="$(
  aws lambda get-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION" \
    --query 'Handler' \
    --output text
)"

MODULE="${HANDLER%%.*}"
if [[ -z "$MODULE" || "$MODULE" == "None" ]]; then
  echo "[ERROR] failed to detect handler module (Handler=$HANDLER)" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
ZIP="${TMP_DIR}/master-api.zip"
cp "$SRC" "${TMP_DIR}/${MODULE}.py"

(cd "$TMP_DIR" && zip -q -j "$ZIP" "${MODULE}.py")

aws lambda update-function-code \
  --function-name "$LAMBDA_NAME" \
  --zip-file "fileb://${ZIP}" \
  --region "$REGION" >/dev/null

aws lambda wait function-updated \
  --function-name "$LAMBDA_NAME" \
  --region "$REGION"

echo "[ok] code updated: $LAMBDA_NAME"

# NOTE: API Gateway does NOT need redeploy for Lambda *code* updates.
# If you edited API Gateway resources/methods/integrations, deploy separately.

