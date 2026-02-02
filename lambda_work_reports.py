"""
業務報告専用 Lambda（misesapo-work-reports）のエントリポイント。
専用 API Gateway（1x0f73dj2l）からの /work-report・/upload-url・/upload-put のみ処理。
"""

import json
import base64
import os
import re
import uuid
import urllib.request
import urllib.error
from datetime import datetime

import boto3

try:
    from universal_work_reports import (
        handle_universal_worker_work_reports,
        handle_admin_work_reports,
    )
except Exception as e:
    handle_universal_worker_work_reports = None
    handle_admin_work_reports = None
    print(f"[lambda_work_reports] universal_work_reports not available: {e}")

# 業務報告専用バケット（環境変数必須）
WORK_REPORTS_BUCKET = os.environ.get('WORK_REPORTS_BUCKET', 'misesapo-work-reports')
S3_REGION = os.environ.get('S3_REGION', 'ap-northeast-1')
s3_client = boto3.client('s3', region_name=S3_REGION)


def _get_headers(event):
    """event の headers を必ず dict で返す。API Gateway の headers / multiValueHeaders の両方に対応。"""
    h = event.get("headers")
    if h is None or not isinstance(h, dict):
        h = {}
    multi = event.get("multiValueHeaders") or {}
    if isinstance(multi, dict):
        for k, v in multi.items():
            if k not in h and isinstance(v, list) and len(v) > 0:
                h[k] = v[0]
    return h


def _get_auth_header(event):
    """event から Authorization ヘッダー値を取得する。"""
    headers = _get_headers(event)
    return headers.get("Authorization") or headers.get("authorization") or ""


def verify_cognito_id_token(id_token):
    """
    Cognito ID Token（Authorization: Bearer）を検証（簡易デコード版）。
    """
    if not id_token:
        return None
    try:
        parts = id_token.split('.')
        if len(parts) != 3:
            return None
        payload_part = parts[1]
        padding = 4 - len(payload_part) % 4
        if padding != 4:
            payload_part += '=' * padding
        payload_json = base64.urlsafe_b64decode(payload_part)
        payload = json.loads(payload_json)
        uid = payload.get('sub') or payload.get('cognito:username', '')
        email = payload.get('email', '')
        role = payload.get('custom:role') or payload.get('role')
        groups_raw = payload.get('cognito:groups', [])
        groups = groups_raw if isinstance(groups_raw, list) else (groups_raw.split(',') if isinstance(groups_raw, str) else [])
        if not role and groups:
            g_lower = [str(g).lower() for g in groups]
            role = 'admin' if 'admin' in g_lower else ('headquarters' if 'headquarters' in g_lower else ('cleaning' if 'staff' in g_lower else 'cleaning'))
        if not role:
            role = 'cleaning'
        return {
            'uid': uid,
            'email': email,
            'role': role,
            'verified': True
        }
    except Exception as e:
        print(f"Error verifying token: {str(e)}")
        return None


def _is_hr_admin(user_info):
    """業務報告の管理操作を許可するロールか"""
    role = (user_info or {}).get('role')
    if not role:
        return False
    r = str(role).lower()
    allowed = [
        'human_resources', 'hr', 'admin', 'operation', 'general_affairs',
        'headquarters',
    ]
    if role == '管理者':
        return True
    return r in allowed


def _get_user_info_from_event(event):
    """API Gateway Authorizer または Authorization ヘッダーからユーザー情報を取得。"""
    authorizer_claims = event.get('requestContext', {}).get('authorizer', {}).get('claims')
    if authorizer_claims:
        uid = authorizer_claims.get('sub') or authorizer_claims.get('cognito:username')
        role = authorizer_claims.get('custom:role')
        groups = authorizer_claims.get('cognito:groups', [])
        if isinstance(groups, str):
            groups = groups.split(',')
        if not role and groups and any(g.lower() == 'admin' for g in groups):
            role = 'admin'
        return {
            'uid': uid,
            'email': authorizer_claims.get('email'),
            'role': role or 'cleaning',
            'verified': True
        }
    auth_header = _get_auth_header(event)
    id_token = auth_header.replace('Bearer ', '') if auth_header else ''
    if id_token:
        return verify_cognito_id_token(id_token)
    return None


def _sanitize_upload_filename(filename):
    """アップロード用ファイル名をサニタイズ（reports/ 用）"""
    if not filename or not isinstance(filename, str):
        return 'file'
    base = re.sub(r'^.*[/\\]', '', filename)
    base = re.sub(r'[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf.\-]', '_', base)
    return (base[:200] or 'file')


def handle_upload_url(event, headers):
    """
    POST /upload-url: 業務報告添付用 Presigned URL を発行（認証必須）
    """
    user_info = _get_user_info_from_event(event)
    if not user_info:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}
    try:
        body = event.get('body') or '{}'
        body_json = json.loads(body) if isinstance(body, str) else body
    except json.JSONDecodeError:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Invalid JSON'}, ensure_ascii=False)}
    filename = body_json.get('filename') or 'file'
    mime = body_json.get('mime') or 'application/octet-stream'
    date = body_json.get('date') or datetime.utcnow().strftime('%Y-%m-%d')
    safe_name = _sanitize_upload_filename(filename)
    key = f"reports/{date}/{str(uuid.uuid4())}_{safe_name}"
    bucket = os.environ.get('WORK_REPORTS_BUCKET', WORK_REPORTS_BUCKET)
    region = os.environ.get('S3_REGION', S3_REGION)
    try:
        upload_url = s3_client.generate_presigned_url(
            'put_object',
            Params={'Bucket': bucket, 'Key': key, 'ContentType': mime},
            ExpiresIn=3600
        )
    except Exception as e:
        print(f"[upload-url] presign failed: {e}")
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': 'Failed to generate upload URL'}, ensure_ascii=False)}
    file_url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({'uploadUrl': upload_url, 'fileUrl': file_url, 'key': key}, ensure_ascii=False)
    }


def handle_upload_put(event, headers):
    """
    POST /upload-put: Presigned URL 宛に Lambda が PUT する（CORS 回避用）
    """
    user_info = _get_user_info_from_event(event)
    if not user_info:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}
    try:
        body = event.get('body') or '{}'
        body_json = json.loads(body) if isinstance(body, str) else body
    except json.JSONDecodeError:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Invalid JSON'}, ensure_ascii=False)}
    upload_url = body_json.get('uploadUrl')
    contentType = body_json.get('contentType') or 'application/octet-stream'
    file_b64 = body_json.get('fileBase64')
    if not upload_url or not file_b64:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'uploadUrl and fileBase64 required'}, ensure_ascii=False)}
    try:
        file_bytes = base64.b64decode(file_b64)
    except Exception as e:
        print(f"[upload-put] base64 decode failed: {e}")
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Invalid base64'}, ensure_ascii=False)}
    try:
        req = urllib.request.Request(upload_url, data=file_bytes, method='PUT', headers={'Content-Type': contentType})
        with urllib.request.urlopen(req, timeout=60) as resp:
            if resp.status not in (200, 204):
                return {'statusCode': 502, 'headers': headers, 'body': json.dumps({'error': 'Upload failed'}, ensure_ascii=False)}
    except urllib.error.HTTPError as e:
        print(f"[upload-put] S3 PUT HTTPError: {e.code} {e.reason}")
        return {'statusCode': 502, 'headers': headers, 'body': json.dumps({'error': 'Upload failed'}, ensure_ascii=False)}
    except Exception as e:
        print(f"[upload-put] S3 PUT failed: {e}")
        return {'statusCode': 502, 'headers': headers, 'body': json.dumps({'error': 'Upload failed'}, ensure_ascii=False)}
    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'ok': True}, ensure_ascii=False)}


def _cors_headers(event_headers):
    """CORS ヘッダー（業務報告専用 API 用）"""
    origin = (event_headers.get('Origin') or event_headers.get('origin') or '*')
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,PUT,POST,PATCH,DELETE,OPTIONS',
        'Content-Type': 'application/json; charset=utf-8',
    }


def lambda_handler(event, context):
    """
    業務報告専用 API（1x0f73dj2l）からの /work-report・/upload-url・/upload-put のみ処理。
    """
    path = event.get('path', '') or event.get('requestContext', {}).get('path', '') or ''
    method = event.get('httpMethod', '') or event.get('requestContext', {}).get('http', {}).get('method', '') or ''
    normalized_path = (path or '/').split('?')[0]
    if not normalized_path.startswith('/'):
        normalized_path = '/' + normalized_path
    if len(normalized_path) > 1:
        normalized_path = normalized_path.rstrip('/')
    # API Gateway の path に stage（/prod, /dev）が含まれる場合を除去（GET /admin/work-reports/{id} 等のルート一致のため）
    for stage in ('/prod', '/dev', '/test'):
        if normalized_path.startswith(stage + '/') or normalized_path == stage:
            normalized_path = normalized_path[len(stage):] or '/'
            break

    event_headers = _get_headers(event)
    headers = _cors_headers(event_headers)

    # OPTIONS（CORS プリフライト）
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}

    if normalized_path == '/upload-url':
        if method == 'POST':
            return handle_upload_url(event, headers)
        return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)}

    if normalized_path == '/upload-put':
        if method == 'POST':
            return handle_upload_put(event, headers)
        return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)}

    if normalized_path.startswith('/admin'):
        if not handle_admin_work_reports:
            return {'statusCode': 503, 'headers': headers, 'body': json.dumps({'error': 'Service unavailable'}, ensure_ascii=False)}
        user_info = _get_user_info_from_event(event)
        is_hr_admin = _is_hr_admin(user_info)
        return handle_admin_work_reports(event, headers, normalized_path, method, user_info, is_hr_admin)

    if normalized_path.startswith('/work-report'):
        if not handle_universal_worker_work_reports:
            return {'statusCode': 503, 'headers': headers, 'body': json.dumps({'error': 'Service unavailable'}, ensure_ascii=False)}
        user_info = _get_user_info_from_event(event)
        return handle_universal_worker_work_reports(event, headers, normalized_path, method, user_info)

    return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not Found'}, ensure_ascii=False)}
