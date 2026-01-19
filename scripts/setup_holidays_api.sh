#!/bin/bash

# 休日・祝日管理APIのエンドポイントを設定

API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION="misesapo-s3-upload"

echo "Setting up holidays API endpoints..."

# /holidays リソースを作成
echo "Creating /holidays resource..."
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $(aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/'].id" --output text) \
  --path-part holidays \
  --region $REGION > /dev/null 2>&1

HOLIDAYS_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/holidays'].id" --output text)

if [ -z "$HOLIDAYS_RESOURCE_ID" ]; then
  echo "Error: Could not create /holidays resource"
  exit 1
fi

echo "HOLIDAYS_RESOURCE_ID: $HOLIDAYS_RESOURCE_ID"

# GET /holidays
echo "Setting up GET /holidays..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAYS_RESOURCE_ID \
  --http-method GET \
  --authorization-type NONE \
  --region $REGION

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAYS_RESOURCE_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION}/invocations" \
  --region $REGION

# POST /holidays
echo "Setting up POST /holidays..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAYS_RESOURCE_ID \
  --http-method POST \
  --authorization-type NONE \
  --region $REGION

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAYS_RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION}/invocations" \
  --region $REGION

# OPTIONS /holidays (CORS)
echo "Setting up OPTIONS /holidays..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAYS_RESOURCE_ID \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region $REGION

aws apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAYS_RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false \
  --region $REGION

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAYS_RESOURCE_ID \
  --http-method OPTIONS \
  --type MOCK \
  --integration-http-method OPTIONS \
  --request-templates '{"application/json":"{\"statusCode\":200}"}' \
  --region $REGION

aws apigateway put-integration-response \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAYS_RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'\''Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'\''","method.response.header.Access-Control-Allow-Methods":"'\''GET,POST,PUT,DELETE,OPTIONS'\''","method.response.header.Access-Control-Allow-Origin":"'\''*'\''"}' \
  --region $REGION

# /holidays/{id} リソースを作成
echo "Creating /holidays/{id} resource..."
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $HOLIDAYS_RESOURCE_ID \
  --path-part "{id}" \
  --region $REGION > /dev/null 2>&1

HOLIDAY_ID_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/holidays/{id}'].id" --output text)

if [ -z "$HOLIDAY_ID_RESOURCE_ID" ]; then
  echo "Error: Could not create /holidays/{id} resource"
  exit 1
fi

echo "HOLIDAY_ID_RESOURCE_ID: $HOLIDAY_ID_RESOURCE_ID"

# GET /holidays/{id}
echo "Setting up GET /holidays/{id}..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAY_ID_RESOURCE_ID \
  --http-method GET \
  --authorization-type NONE \
  --region $REGION

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAY_ID_RESOURCE_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION}/invocations" \
  --region $REGION

# PUT /holidays/{id}
echo "Setting up PUT /holidays/{id}..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAY_ID_RESOURCE_ID \
  --http-method PUT \
  --authorization-type NONE \
  --region $REGION

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAY_ID_RESOURCE_ID \
  --http-method PUT \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION}/invocations" \
  --region $REGION

# DELETE /holidays/{id}
echo "Setting up DELETE /holidays/{id}..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAY_ID_RESOURCE_ID \
  --http-method DELETE \
  --authorization-type NONE \
  --region $REGION

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAY_ID_RESOURCE_ID \
  --http-method DELETE \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION}/invocations" \
  --region $REGION

# OPTIONS /holidays/{id} (CORS)
echo "Setting up OPTIONS /holidays/{id}..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAY_ID_RESOURCE_ID \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region $REGION

aws apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAY_ID_RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false \
  --region $REGION

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAY_ID_RESOURCE_ID \
  --http-method OPTIONS \
  --type MOCK \
  --integration-http-method OPTIONS \
  --request-templates '{"application/json":"{\"statusCode\":200}"}' \
  --region $REGION

aws apigateway put-integration-response \
  --rest-api-id $API_ID \
  --resource-id $HOLIDAY_ID_RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'\''Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'\''","method.response.header.Access-Control-Allow-Methods":"'\''GET,POST,PUT,DELETE,OPTIONS'\''","method.response.header.Access-Control-Allow-Origin":"'\''*'\''"}' \
  --region $REGION

echo "Deploying API..."
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region $REGION > /dev/null 2>&1

echo "Holidays API setup completed!"

