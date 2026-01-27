#!/bin/bash
REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"

echo "--- [Checking API Methods for stg/prod compliance] ---"
echo "Path | Method | Status | Integration URI"
echo "---|---|---|---"

RESOURCES=$(aws apigateway get-resources \
  --rest-api-id "$REST_API_ID" \
  --region "$REGION" \
  --query 'items[].[id,path]' \
  --output json)

echo "$RESOURCES" | jq -c '.[]' | while read -r res; do
  RES_ID=$(echo "$res" | jq -r '.[0]')
  RES_PATH=$(echo "$res" | jq -r '.[1]')

  METHODS=$(aws apigateway get-resource \
    --rest-api-id "$REST_API_ID" \
    --resource-id "$RES_ID" \
    --region "$REGION" \
    --query 'resourceMethods' \
    --output json)

  if [ "$METHODS" != "null" ]; then
    echo "$METHODS" | jq -r 'keys[]' | while read -r METHOD; do

      [ "$METHOD" = "OPTIONS" ] && continue

      INTEGRATION=$(aws apigateway get-integration \
        --rest-api-id "$REST_API_ID" \
        --resource-id "$RES_ID" \
        --http-method "$METHOD" \
        --region "$REGION" 2>/dev/null)

      [ -z "$INTEGRATION" ] && continue

      URI=$(echo "$INTEGRATION" | jq -r '.uri // "N/A"')

      if [[ "$URI" == *'${stageVariables.lambdaAlias}'* ]]; then
        STATUS="✅ OK"
      elif [[ "$URI" == *"arn:aws:lambda"* ]]; then
        STATUS="❌ NG (Hardcoded)"
      else
        STATUS="➖ N/A"
      fi

      echo "$RES_PATH | $METHOD | $STATUS | $URI"

    done
  fi
done
