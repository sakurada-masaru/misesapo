#!/bin/bash
TOKEN=$(cat ~/.cognito_token | tr -d '\n')
URL="https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/yotei"

echo "Listing yotei..."
curl -sS -i -H "Authorization: Bearer ${TOKEN}" "${URL}?limit=5"
