#!/bin/bash
# Staff Reports API Full Setup Script
# Configures GET, POST, and OPTIONS for /staff/reports
# Ensures Authorization is NONE so Lambda can handle auth
# Connects to 'misesapo-reports' Lambda function

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
ACCOUNT_ID="475462779604"
LAMBDA_FUNCTION_NAME="misesapo-reports"
LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_FUNCTION_NAME}"

echo "=== Staff Reports API Full Setup ==="

# Get Resource IDs
STAFF_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id ${REST_API_ID} --region ${REGION} --query "items[?path=='/staff'].id" --output text)
if [ -z "$STAFF_RESOURCE_ID" ] || [ "$STAFF_RESOURCE_ID" == "None" ]; then echo "Error: /staff not found"; exit 1; fi

REPORTS_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id ${REST_API_ID} --region ${REGION} --query "items[?path=='/staff/reports'].id" --output text)
if [ -z "$REPORTS_RESOURCE_ID" ] || [ "$REPORTS_RESOURCE_ID" == "None" ]; then
    echo "Creating /staff/reports..."
    REPORTS_RESOURCE_ID=$(aws apigateway create-resource --rest-api-id ${REST_API_ID} --region ${REGION} --parent-id ${STAFF_RESOURCE_ID} --path-part "reports" --query "id" --output text)
fi
echo "Reports Resource ID: ${REPORTS_RESOURCE_ID}"

# Setup GET and POST (Auth: NONE, Integ: Lambda Proxy)
for METHOD in GET POST; do
  echo "Setting up ${METHOD}..."
  aws apigateway delete-method --rest-api-id ${REST_API_ID} --resource-id ${REPORTS_RESOURCE_ID} --http-method ${METHOD} --region ${REGION} 2>/dev/null || true
  
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${REPORTS_RESOURCE_ID} \
    --http-method ${METHOD} \
    --authorization-type "NONE" \
    --region ${REGION} > /dev/null

  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${REPORTS_RESOURCE_ID} \
    --http-method ${METHOD} \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region ${REGION} > /dev/null
    
  # Add permission
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigw-${METHOD}-staffreports-$(date +%s)" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/${METHOD}/staff/reports" \
    --region ${REGION} 2>/dev/null || echo "Permission might already exist"
done

# Setup OPTIONS (CORS)
echo "Setting up OPTIONS..."
aws apigateway delete-method --rest-api-id ${REST_API_ID} --resource-id ${REPORTS_RESOURCE_ID} --http-method OPTIONS --region ${REGION} 2>/dev/null || true

aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${REPORTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type "NONE" \
  --region ${REGION} > /dev/null

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${REPORTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\":200}"}' \
  --region ${REGION} > /dev/null

aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${REPORTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region ${REGION} > /dev/null 2>&1 || true

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${REPORTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'\",\"method.response.header.Access-Control-Allow-Methods\":\"'GET,POST,OPTIONS'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" \
  --region ${REGION} > /dev/null

echo "Deploying API..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --query "id" \
  --output text)

echo "Done. Deployment ID: ${DEPLOYMENT_ID}"
