import json
import os
import uuid
import base64
import decimal
from urllib.parse import unquote
import boto3
from boto3.dynamodb.conditions import Attr 
from datetime import datetime, timezone, timedelta

# DynamoDBのDecimal型をJSONで扱えるようにするエンコーダー
class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            return float(o) if o % 1 > 0 else int(o)
        return super(DecimalEncoder, self).default(o)

# 設定
REGION = 'ap-northeast-1'
TABLE_NAME = os.environ.get('HOUKOKU_TABLE', 'houkoku')
dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

# S3
from botocore.config import Config
S3_BUCKET = os.environ.get('HOUKOKU_BUCKET', 'misesapo-houkoku')
s3_client = boto3.client(
    's3', 
    region_name=REGION,
    endpoint_url=f"https://s3.{REGION}.amazonaws.com",
    config=Config(signature_version='s3v4', s3={'addressing_style': 'virtual'})
)

# JST
JST = timezone(timedelta(hours=9))

def response(status, body, origin='*'):
    return {
        'statusCode': status,
        'headers': {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body, cls=DecimalEncoder, ensure_ascii=False)
    }

def get_user_from_token(event):
    auth = (event.get('headers') or {}).get('Authorization', '')
    if not auth.startswith('Bearer '): return None
    token = auth.split(' ')[1]
    try:
        _, payload, _ = token.split('.')
        missing_padding = len(payload) % 4
        if missing_padding: payload += '=' * (4 - missing_padding)
        data = json.loads(base64.urlsafe_b64decode(payload))
        return {
            'user_id': data.get('sub') or data.get('cognito:username'),
            'email': data.get('email'),
            'name': data.get('name'),
            'role': data.get('custom:role') or 'user'
        }
    except: return None

def sanitize_payload(payload: dict) -> dict:
    """
    payloadからDB直下で管理する項目を削除する（二重管理防止）
    work_date, user_name 等は houkoku テーブル直下が唯一の正
    既存のheader構造と新しいoverview構造の両方に対応
    """
    if not isinstance(payload, dict):
        return {}

    # 新構造: overview
    overview = payload.get("overview")
    if isinstance(overview, dict):
        overview.pop("work_date", None)
        overview.pop("worker_name", None)
        overview.pop("user_name", None)
        overview.pop("store_id", None)
        payload["overview"] = overview

    # 旧構造: header（後方互換）
    header = payload.get("header")
    if isinstance(header, dict):
        header.pop("work_date", None)
        header.pop("reporter_name", None)  # 旧名
        header.pop("user_name", None)
        header.pop("store_id", None)
        payload["header"] = header

    return payload

def lambda_handler(event, context):
    try:
        path = event.get('path', '') or event.get('rawPath', '') or '/'
        method = event.get('httpMethod', '') or event.get('requestContext', {}).get('http', {}).get('method', '')
        
        for stage in ['/prod', '/dev', '/test']:
            if path.startswith(stage):
                path = path[len(stage):] or '/'
                break
        
        origin = (event.get('headers') or {}).get('origin', '*')
        if method == 'OPTIONS': return response(200, {}, origin)
        
        if path == '/houkoku' or path == '/houkoku/':
            if method == 'POST': return handle_create(event, origin)
            if method == 'GET': return handle_list(event, origin)
        
        if path.startswith('/houkoku/upload-url'):
            if method == 'POST': return handle_upload_url(event, origin)
            
        if path.startswith('/houkoku/'):
            report_id = unquote(path.replace('/houkoku/', '').strip('/'))
            if report_id:
                if method == 'GET': return handle_get(event, report_id, origin)
                if method == 'PUT': return handle_update(event, report_id, origin)
                if method == 'DELETE': return handle_delete(event, report_id, origin)
        
        return response(404, {'error': 'Not Found', 'path': path})
    except Exception as e:
        import traceback
        return response(500, {'error': str(e), 'trace': traceback.format_exc()})

def handle_create(event, origin):
    user = get_user_from_token(event)
    if not user: return response(401, {'error': 'Unauthorized'}, origin)
    body = json.loads(event.get('body') or '{}')
    now = datetime.now(JST)
    
    # store_id extraction logic
    body_payload = body.get('payload') or {}
    store_id = body.get('store_id')
    if not store_id:
        overview = body_payload.get('overview')
        if isinstance(overview, dict):
            store_id = overview.get('store_id')
        if not store_id:
            header = body_payload.get('header')
            if isinstance(header, dict):
                store_id = header.get('store_id')

    new_id = f"HK-{now.strftime('%Y%m%d')}-{user['user_id'][:8]}-{uuid.uuid4().hex[:8]}"
    item = {
        'id': new_id,
        'user_id': user['user_id'],
        'user_name': user.get('name') or user.get('email') or 'Unknown',
        'work_date': body.get('work_date') or now.strftime('%Y-%m-%d'),
        'template_id': body.get('template_id') or 'DEFAULT',
        'payload': sanitize_payload(body_payload),
        'state': 'submitted',
        'created_at': now.isoformat(),
        'updated_at': now.isoformat()
    }
    if store_id:
        item['store_id'] = store_id
        
    table.put_item(Item=item)
    return response(200, {'id': new_id, 'message': '保存しました'}, origin)

def handle_list(event, origin):
    user = get_user_from_token(event)
    if not user: return response(401, {'error': 'Unauthorized'}, origin)
    params = event.get('queryStringParameters') or {}
    work_date = params.get('date') or datetime.now(JST).strftime('%Y-%m-%d')
    result = table.scan(FilterExpression=Attr('work_date').eq(work_date))
    items = result.get('Items', [])
    items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    return response(200, {'items': items, 'count': len(items)}, origin)

def handle_get(event, report_id, origin):
    user = get_user_from_token(event); 
    if not user: return response(401, {'error': 'Unauthorized'}, origin)
    item = table.get_item(Key={'id': report_id}).get('Item')
    if not item: return response(404, {'error': 'Not Found'}, origin)
    return response(200, item, origin)

def handle_update(event, report_id, origin):
    user = get_user_from_token(event); 
    if not user: return response(401, {'error': 'Unauthorized'}, origin)
    body = json.loads(event.get('body') or '{}')
    table.update_item(
        Key={'id': report_id},
        UpdateExpression='SET payload = :p, updated_at = :u',
        ExpressionAttributeValues={':p': sanitize_payload(body.get('payload', {})), ':u': datetime.now(JST).isoformat()}
    )
    return response(200, {'id': report_id, 'message': '更新しました'}, origin)

def handle_delete(event, report_id, origin):
    user = get_user_from_token(event); 
    if not user: return response(401, {'error': 'Unauthorized'}, origin)
    table.delete_item(Key={'id': report_id})
    return response(200, {'id': report_id, 'message': '削除しました'}, origin)

def handle_upload_url(event, origin):
    user = get_user_from_token(event); 
    if not user: return response(401, {'error': 'Unauthorized'}, origin)
    body = json.loads(event.get('body') or '{}')
    filename = body.get('filename', 'file.jpg')
    key = f"uploads/{datetime.now(JST).strftime('%Y/%m')}/{uuid.uuid4().hex}.{filename.split('.')[-1]}"
    url = s3_client.generate_presigned_url('put_object', Params={'Bucket': S3_BUCKET, 'Key': key, 'ContentType': body.get('mime', 'application/octet-stream')}, ExpiresIn=3600)
    return response(200, {'url': f"https://{S3_BUCKET}.s3.{REGION}.amazonaws.com/{key}", 'uploadUrl': url, 'key': key}, origin)
