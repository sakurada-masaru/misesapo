import json
import boto3
import os
import uuid
import traceback
from datetime import datetime
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')

# 予定ドメインが責任を持つ専用テーブル
TABLES = {
    'yotei':    dynamodb.Table('yotei'),
    'yakusoku': dynamodb.Table('yakusoku'),
    'ugoki':    dynamodb.Table('ugoki')
}

# テーブルごとのPK名規則
PK_MAP = {
    'yotei':    'id',
    'yakusoku': 'yakusoku_id',
    'ugoki':    'yotei_id'
}

def _get_auth_header(event):
    headers = event.get('headers', {})
    return headers.get('Authorization') or headers.get('authorization')

def _decode_token_simple(token):
    try:
        parts = token.split('.')
        if len(parts) != 3: return None
        import base64
        payload_b64 = parts[1]
        missing_padding = len(payload_b64) % 4
        if missing_padding: payload_b64 += '=' * (4 - missing_padding)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode('utf-8'))
        return {
            'role': payload.get('custom:role') or payload.get('role') or 'user',
            'uid': payload.get('sub')
        }
    except: return None

def lambda_handler(event, context):
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'true'
    }
    
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'OK'})}

    # 1. 認証
    auth = _get_auth_header(event)
    user = _decode_token_simple(auth.replace('Bearer ', '')) if auth else None
    if not user:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'})}

    # 2. パス解析
    raw_path = (event.get('path') or '').rstrip('/')
    # 例: /yotei/123 or /yakusoku or /prod/ugoki
    path_parts = raw_path.split('/')
    
    collection = None
    record_id = None
    
    # yotei, yakusoku, ugoki のいずれかを含むかチェック
    for c in TABLES.keys():
        if c in path_parts:
            collection = c
            c_idx = path_parts.index(c)
            if len(path_parts) > c_idx + 1:
                record_id = path_parts[c_idx + 1]
            break
            
    if not collection:
        return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found', 'path': raw_path})}

    table = TABLES[collection]
    pk_name = PK_MAP[collection]
    method = event.get('httpMethod')

    try:
        if method == 'GET':
            if record_id:
                res = table.get_item(Key={pk_name: record_id})
                if 'Item' not in res: return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps(res['Item'], default=str)}
            else:
                # 検索 (簡易版)
                res = table.scan(Limit=50)
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'items': res.get('Items', [])}, default=str)}

        elif method == 'POST':
            body = json.loads(event.get('body') or '{}')
            new_id = body.get(pk_name) or str(uuid.uuid4())
            now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
            item = {pk_name: new_id, 'created_at': now, 'updated_at': now}
            item.update(body)
            table.put_item(Item=item)
            return {'statusCode': 201, 'headers': headers, 'body': json.dumps(item)}

        elif method == 'PUT':
            if not record_id: return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Missing ID'})}
            body = json.loads(event.get('body') or '{}')
            now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
            update_expr = "SET updated_at = :now"
            attr_values = {":now": now}
            attr_names = {}
            for i, (k, v) in enumerate(body.items()):
                if k == pk_name: continue
                update_expr += f", #f{i} = :v{i}"
                attr_names[f"#f{i}"] = k
                attr_values[f":v{i}"] = v
            table.update_item(Key={pk_name: record_id}, UpdateExpression=update_expr, ExpressionAttributeNames=attr_names, ExpressionAttributeValues=attr_values)
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'Updated'})}

        elif method == 'DELETE':
            if not record_id: return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Missing ID'})}
            table.delete_item(Key={pk_name: record_id})
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'Deleted'})}

    except Exception as e:
        traceback.print_exc()
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}
