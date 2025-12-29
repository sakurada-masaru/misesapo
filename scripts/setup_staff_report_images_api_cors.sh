#!/bin/bash
# Report Images API Setup Script
# Configures POST, DELETE, OPTIONS for /staff/report-images on API 51bhoxkbxd
# Connects to 'misesapo-reports' Lambda

set -e
REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
ACCOUNT_ID="475462779604"
LAMBDA_FUNCTION_NAME="misesapo-reports" 
LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_FUNCTION_NAME}"

echo "=== Staff Report Images API Setup ==="

# Get Root
ROOT_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id ${REST_API_ID} --region ${REGION} --query "items[?path=='/'].id" --output text)
echo "Root Resource: ${ROOT_RESOURCE_ID}"

# Check/Create /staff
STAFF_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id ${REST_API_ID} --region ${REGION} --query "items[?path=='/staff'].id" --output text)
if [ -z "$STAFF_RESOURCE_ID" ] || [ "$STAFF_RESOURCE_ID" == "None" ]; then
    echo "Creating /staff..."
    STAFF_RESOURCE_ID=$(aws apigateway create-resource --rest-api-id ${REST_API_ID} --region ${REGION} --parent-id ${ROOT_RESOURCE_ID} --path-part "staff" --query "id" --output text)
fi
echo "Staff Resource ID: ${STAFF_RESOURCE_ID}"

# Check/Create /staff/report-images
IMAGES_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id ${REST_API_ID} --region ${REGION} --query "items[?path=='/staff/report-images'].id" --output text)
if [ -z "$IMAGES_RESOURCE_ID" ] || [ "$IMAGES_RESOURCE_ID" == "None" ]; then
    echo "Creating /staff/report-images..."
    IMAGES_RESOURCE_ID=$(aws apigateway create-resource --rest-api-id ${REST_API_ID} --region ${REGION} --parent-id ${STAFF_RESOURCE_ID} --path-part "report-images" --query "id" --output text)
fi
echo "Report Images Resource ID: ${IMAGES_RESOURCE_ID}"

# Setup POST
echo "Setting up POST..."
aws apigateway delete-method --rest-api-id ${REST_API_ID} --resource-id ${IMAGES_RESOURCE_ID} --http-method POST --region ${REGION} 2>/dev/null || true
aws apigateway put-method --rest-api-id ${REST_API_ID} --resource-id ${IMAGES_RESOURCE_ID} --http-method POST --authorization-type "NONE" --region ${REGION} > /dev/null
aws apigateway put-integration --rest-api-id ${REST_API_ID} --resource-id ${IMAGES_RESOURCE_ID} --http-method POST --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" --region ${REGION} > /dev/null
aws lambda add-permission --function-name ${LAMBDA_FUNCTION_NAME} --statement-id "apigw-POST-report-images-$(date +%s)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/POST/staff/report-images" --region ${REGION} 2>/dev/null || true

# Setup DELETE
echo "Setting up DELETE..."
aws apigateway delete-method --rest-api-id ${REST_API_ID} --resource-id ${IMAGES_RESOURCE_ID} --http-method DELETE --region ${REGION} 2>/dev/null || true
aws apigateway put-method --rest-api-id ${REST_API_ID} --resource-id ${IMAGES_RESOURCE_ID} --http-method DELETE --authorization-type "NONE" --region ${REGION} > /dev/null
aws apigateway put-integration --rest-api-id ${REST_API_ID} --resource-id ${IMAGES_RESOURCE_ID} --http-method DELETE --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" --region ${REGION} > /dev/null
aws lambda add-permission --function-name ${LAMBDA_FUNCTION_NAME} --statement-id "apigw-DELETE-report-images-$(date +%s)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/DELETE/staff/report-images" --region ${REGION} 2>/dev/null || true

# Setup OPTIONS
echo "Setting up OPTIONS..."
aws apigateway delete-method --rest-api-id ${REST_API_ID} --resource-id ${IMAGES_RESOURCE_ID} --http-method OPTIONS --region ${REGION} 2>/dev/null || true
aws apigateway put-method --rest-api-id ${REST_API_ID} --resource-id ${IMAGES_RESOURCE_ID} --http-method OPTIONS --authorization-type "NONE" --region ${REGION} > /dev/null
aws apigateway put-integration --rest-api-id ${REST_API_ID} --resource-id ${IMAGES_RESOURCE_ID} --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\":200}"}' --region ${REGION} > /dev/null
aws apigateway put-method-response --rest-api-id ${REST_API_ID} --resource-id ${IMAGES_RESOURCE_ID} --http-method OPTIONS --status-code 200 --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" --region ${REGION} > /dev/null
aws apigateway put-integration-response --rest-api-id ${REST_API_ID} --resource-id ${IMAGES_RESOURCE_ID} --http-method OPTIONS --status-code 200 --response-parameters "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'\",\"method.response.header.Access-Control-Allow-Methods\":\"'POST,DELETE,OPTIONS'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" --region ${REGION} > /dev/null

echo "Deploying..."
DEPLOYMENT_ID=$(aws apigateway create-deployment --rest-api-id ${REST_API_ID} --region ${REGION} --stage-name "prod" --query "id" --output text)
echo "Done. Deployment: ${DEPLOYMENT_ID}"
