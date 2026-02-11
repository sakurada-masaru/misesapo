import json
import boto3
import os
import uuid
import traceback
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
JST = timezone(timedelta(hours=9))

# 業務報告ドメインが責任を持つ専用テーブル
TABLES = {
    'houkoku': dynamodb.Table('houkoku')
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
            'uid': payload.get('sub'),
            'name': payload.get('name') or payload.get('email')
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
    path_parts = raw_path.split('/')
    
    collection = 'houkoku' # このAPIはほぼこれ専用
    record_id = None
    
    if 'houkoku' in path_parts:
        c_idx = path_parts.index('houkoku')
        if len(path_parts) > c_idx + 1:
            record_id = path_parts[c_idx + 1]
    
    table = TABLES['houkoku']
    pk_name = 'id'
    method = event.get('httpMethod')

    try:
        if method == 'GET':
            if record_id:
                res = table.get_item(Key={pk_name: record_id})
                if 'Item' not in res: return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps(res['Item'], default=str)}
            else:
                # 日付等による検索（簡易版）
                res = table.scan(Limit=50)
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'items': res.get('Items', [])}, default=str)}

        elif method == 'POST':
            body = json.loads(event.get('body') or '{}')
            now = datetime.now(JST)
            new_id = body.get(pk_name) or f"HK-{now.strftime('%Y%m%d')}-{user['uid'][:8]}-{uuid.uuid4().hex[:8]}"
            item = {
                pk_name: new_id,
                'user_id': user['uid'],
                'user_name': user['name'],
                'created_at': now.isoformat(),
                'updated_at': now.isoformat(),
                'state': 'submitted'
            }
            item.update(body)
            table.put_item(Item=item)
            return {'statusCode': 201, 'headers': headers, 'body': json.dumps(item)}

        elif method == 'PUT':
            if not record_id: return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Missing ID'})}
            body = json.loads(event.get('body') or '{}')
            now = datetime.now(JST).isoformat()
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

    except Exception as e:
        traceback.print_exc()
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}
