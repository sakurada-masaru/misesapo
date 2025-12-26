import json
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('misesapo-clients')

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

def lambda_handler(event, context):
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}
    
    if method == 'GET':
        response = table.scan()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps(response['Items'], cls=DecimalEncoder)}
    
    if method == 'POST':
        body = json.loads(event.get('body', '{}'))
        table.put_item(Item=body)
        return {'statusCode': 201, 'headers': headers, 'body': json.dumps(body)}
    
    if method == 'PUT':
        body = json.loads(event.get('body', '{}'))
        table.put_item(Item=body)
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps(body)}
    
    if method == 'DELETE':
        path = event.get('pathParameters', {})
        client_id = path.get('id') if path else event.get('queryStringParameters', {}).get('id')
        if client_id:
            table.delete_item(Key={'id': client_id})
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'deleted': client_id})}
    
    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Bad request'})}
