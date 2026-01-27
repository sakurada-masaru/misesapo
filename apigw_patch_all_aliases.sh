#!/bin/bash
set -euo pipefail

REST_API_ID="51bhoxkbxd"
REGION="${AWS_REGION:-ap-northeast-1}"

FUNCTIONS=(
  "misesapo-s3-upload"
  "misesapo-reports"
  "misesapo-workers-api"
  "misesapo-brands-api"
  "misesapo-kartes-api"
  "misesapo-tasks"
  "misesapo-stores"
  "misesapo-users-api"
  "misesapo-analytics-api"
)

echo "[INFO] Fetch resources..."
RES_JSON="$(aws apigateway get-resources --rest-api-id "$REST_API_ID" --region "$REGION" --output json)"

echo "$RES_JSON" | jq -c '.items[] | {id, path}' | while read -r res; do
  RES_ID="$(echo "$res" | jq -r '.id')"
  RES_PATH="$(echo "$res" | jq -r '.path')"

  METHODS="$(aws apigateway get-resource --rest-api-id "$REST_API_ID" --resource-id "$RES_ID" --region "$REGION" --query 'resourceMethods' --output json || echo null)"
  [[ "$METHODS" == "null" ]] && continue

  echo "$METHODS" | jq -r 'keys[]' | while read -r METHOD; do
    [[ "$METHOD" == "OPTIONS" ]] && continue

    INTEG="$(aws apigateway get-integration --rest-api-id "$REST_API_ID" --resource-id "$RES_ID" --http-method "$METHOD" --region "$REGION" --output json 2>/dev/null || echo null)"
    [[ "$INTEG" == "null" ]] && continue

    URI="$(echo "$INTEG" | jq -r '.uri // ""')"
    [[ -z "$URI" ]] && continue

    if [[ "$URI" == *'${stageVariables.lambdaAlias}'* ]]; then
      continue
    fi

    for FN in "${FUNCTIONS[@]}"; do
      if [[ "$URI" == *":function:${FN}/invocations" ]]; then
        NEW_URI=$(echo "$URI" | sed -E "s#:function:${FN}/invocations#:function:${FN}:\${stageVariables.lambdaAlias}/invocations#g")
        echo "[PATCH] ${RES_PATH} ${METHOD} -> ${FN}"
        aws apigateway update-integration \
          --rest-api-id "$REST_API_ID" \
          --resource-id "$RES_ID" \
          --http-method "$METHOD" \
          --region "$REGION" \
            --patch-operations "[{\"op\":\"replace\",\"path\":\"/uri\",\"value\":\"${NEW_URI}\"}]" >/dev/null
        sleep 0.2
        break
      fi
    done
  done
done

echo "[DONE] update-integration (all functions) complete."
