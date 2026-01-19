#!/bin/bash
# Announcements Root API Setup Script
# Configures GET and OPTIONS for /announcements on API 51bhoxkbxd
# Connects to 'misesapo-reports' Lambda (Monolith)

set -e
REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
ACCOUNT_ID="475462779604"
LAMBDA_FUNCTION_NAME="misesapo-reports" 
LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_FUNCTION_NAME}"

echo "=== Announcements Root API CORs Setup ==="

# Get Root
ROOT_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id ${REST_API_ID} --region ${REGION} --query "items[?path=='/'].id" --output text)
echo "Root Resource: ${ROOT_RESOURCE_ID}"

# Check/Create /announcements
ANNOUNCEMENTS_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id ${REST_API_ID} --region ${REGION} --query "items[?path=='/announcements'].id" --output text)
if [ -z "$ANNOUNCEMENTS_RESOURCE_ID" ] || [ "$ANNOUNCEMENTS_RESOURCE_ID" == "None" ]; then
    echo "Creating /announcements..."
    ANNOUNCEMENTS_RESOURCE_ID=$(aws apigateway create-resource --rest-api-id ${REST_API_ID} --region ${REGION} --parent-id ${ROOT_RESOURCE_ID} --path-part "announcements" --query "id" --output text)
fi
echo "Announcements Resource ID: ${ANNOUNCEMENTS_RESOURCE_ID}"

# Setup GET
echo "Setting up GET..."
aws apigateway delete-method --rest-api-id ${REST_API_ID} --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} --http-method GET --region ${REGION} 2>/dev/null || true
aws apigateway put-method --rest-api-id ${REST_API_ID} --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} --http-method GET --authorization-type "NONE" --region ${REGION} > /dev/null
aws apigateway put-integration --rest-api-id ${REST_API_ID} --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} --http-method GET --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" --region ${REGION} > /dev/null
aws lambda add-permission --function-name ${LAMBDA_FUNCTION_NAME} --statement-id "apigw-GET-announcements-$(date +%s)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/GET/announcements" --region ${REGION} 2>/dev/null || true

# Setup OPTIONS
echo "Setting up OPTIONS..."
aws apigateway delete-method --rest-api-id ${REST_API_ID} --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} --http-method OPTIONS --region ${REGION} 2>/dev/null || true
aws apigateway put-method --rest-api-id ${REST_API_ID} --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} --http-method OPTIONS --authorization-type "NONE" --region ${REGION} > /dev/null
aws apigateway put-integration --rest-api-id ${REST_API_ID} --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\":200}"}' --region ${REGION} > /dev/null
aws apigateway put-method-response --rest-api-id ${REST_API_ID} --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} --http-method OPTIONS --status-code 200 --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" --region ${REGION} > /dev/null
aws apigateway put-integration-response --rest-api-id ${REST_API_ID} --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} --http-method OPTIONS --status-code 200 --response-parameters "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'\",\"method.response.header.Access-Control-Allow-Methods\":\"'GET,POST,OPTIONS'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" --region ${REGION} > /dev/null

echo "Deploying..."
DEPLOYMENT_ID=$(aws apigateway create-deployment --rest-api-id ${REST_API_ID} --region ${REGION} --stage-name "prod" --query "id" --output text)
echo "Done. Deployment: ${DEPLOYMENT_ID}"
