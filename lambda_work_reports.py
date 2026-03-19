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
from datetime import datetime, timedelta, timezone

import boto3
from boto3.dynamodb.conditions import Attr

try:
    print("[lambda_work_reports] Attempting to import universal_work_reports...")
    from universal_work_reports import (
        handle_universal_worker_work_reports,
        handle_admin_work_reports,
        handle_public_work_report,
    )
    print(f"[lambda_work_reports] ✅ Import successful: handle_universal_worker_work_reports={type(handle_universal_worker_work_reports)}, handle_admin_work_reports={type(handle_admin_work_reports)}")
except Exception as e:
    handle_universal_worker_work_reports = None
    handle_admin_work_reports = None
    handle_public_work_report = None
    print(f"[lambda_work_reports] ❌ universal_work_reports not available: {e}")
    import traceback
    traceback.print_exc()

# 業務報告専用バケット（環境変数必須）
WORK_REPORTS_BUCKET = os.environ.get('WORK_REPORTS_BUCKET', 'misesapo-work-reports')
S3_REGION = os.environ.get('S3_REGION', 'ap-northeast-1')
s3_client = boto3.client('s3', region_name=S3_REGION)
dynamodb = boto3.resource('dynamodb', region_name=S3_REGION)
work_reports_table = dynamodb.Table(os.environ.get('UNIVERSAL_WORK_LOGS_TABLE', 'misesapo-sales-work-reports'))
kanri_log_table = dynamodb.Table(os.environ.get('TABLE_KANRI_LOG', 'kanri_log'))
admin_chat_table = dynamodb.Table(os.environ.get('TABLE_ADMIN_CHAT', 'admin_chat'))
ses_client = boto3.client('ses', region_name=os.environ.get('SES_REGION', S3_REGION))

JST = timezone(timedelta(hours=9))
CUSTOMER_CHAT_ADMIN_ROOM = os.environ.get('CUSTOMER_CHAT_ADMIN_ROOM', 'customer_portal_chat')
CUSTOMER_MASTER_APPROVAL_ROOM = os.environ.get('CUSTOMER_MASTER_APPROVAL_ROOM', 'customer_master_approval')
DAILY_ACTIVITY_EMAIL_TO = os.environ.get('DAILY_ACTIVITY_EMAIL_TO', 'info@misesapo.co.jp')
DAILY_ACTIVITY_EMAIL_FROM = os.environ.get('DAILY_ACTIVITY_EMAIL_FROM', 'info@misesapo.co.jp')
DAILY_ACTIVITY_HOURS = int(os.environ.get('DAILY_ACTIVITY_HOURS', '24'))
DAILY_ACTIVITY_MAX_LINES = int(os.environ.get('DAILY_ACTIVITY_MAX_LINES', '200'))


def _now_jst():
    return datetime.now(JST)


def _to_iso(dt: datetime):
    return dt.isoformat()


def _parse_epoch_ms(raw):
    if raw is None:
        return 0
    s = str(raw).strip()
    if not s:
        return 0
    try:
        if s.endswith('Z'):
            s = f"{s[:-1]}+00:00"
        return int(datetime.fromisoformat(s).timestamp() * 1000)
    except Exception:
        pass
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S', '%Y-%m-%d'):
        try:
            dt = datetime.strptime(s, fmt).replace(tzinfo=JST)
            return int(dt.timestamp() * 1000)
        except Exception:
            continue
    return 0


def _label_hhmm(epoch_ms: int):
    if epoch_ms <= 0:
        return '--:--'
    return datetime.fromtimestamp(epoch_ms / 1000, JST).strftime('%H:%M')


def _pick_name(*candidates):
    for c in candidates:
        v = str(c or '').strip()
        if v:
            return v
    return '未設定'


def _parse_json_like_object(raw):
    if isinstance(raw, dict):
        return raw
    s = str(raw or '').strip()
    if not s:
        return {}
    try:
        parsed = json.loads(s)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _shrink_inline_text(value, max_len=36):
    s = str(value or '').replace('\n', ' ').replace('\r', ' ')
    s = ' '.join(s.split()).strip()
    if not s:
        return ''
    return f"{s[:max_len]}…" if len(s) > max_len else s


def _report_content_preview(item):
    payload = _parse_json_like_object(item.get('payload'))
    service_names = []
    for raw in (item.get('service_names'), payload.get('service_names'), (payload.get('context') or {}).get('service_names')):
        if isinstance(raw, list):
            for v in raw:
                sv = _shrink_inline_text(v, 20)
                if sv and sv not in service_names:
                    service_names.append(sv)
    service_label = ' / '.join(service_names[:2])
    store_label = _shrink_inline_text(
        item.get('target_label')
        or item.get('tenpo_name')
        or item.get('store_name')
        or payload.get('tenpo_name')
        or payload.get('store_name')
        or payload.get('target_name')
        or (payload.get('context') or {}).get('tenpo_label'),
        40,
    )
    body_label = _shrink_inline_text(
        item.get('summary')
        or item.get('memo')
        or item.get('detail')
        or item.get('work_detail')
        or item.get('work_content')
        or payload.get('summary')
        or payload.get('memo')
        or payload.get('work_detail')
        or payload.get('work_content')
        or payload.get('report_body')
        or payload.get('honjitsu_seika')
        or payload.get('result_today')
        or payload.get('exception_note'),
        48,
    )
    if body_label:
        return body_label
    combo = " / ".join([v for v in [store_label, service_label] if v])
    return _shrink_inline_text(combo, 48)


def _scan_all(table_obj, *, filter_expression=None, max_items=5000):
    items = []
    kwargs = {}
    if filter_expression is not None:
        kwargs['FilterExpression'] = filter_expression
    while True:
        resp = table_obj.scan(**kwargs)
        chunk = resp.get('Items', [])
        items.extend(chunk)
        if len(items) >= max_items:
            return items[:max_items]
        lek = resp.get('LastEvaluatedKey')
        if not lek:
            break
        kwargs['ExclusiveStartKey'] = lek
    return items


def _collect_recent_activity(hours=24):
    now = _now_jst()
    now_ms = int(now.timestamp() * 1000)
    since_ms = int((now - timedelta(hours=hours)).timestamp() * 1000)
    events = []

    # 1) 管理日誌（kanri_log）
    try:
        kanri_items = _scan_all(kanri_log_table, filter_expression=Attr('jotai').eq('yuko'))
    except Exception as e:
        print(f"[activity-digest] kanri_log scan failed: {str(e)}")
        kanri_items = []
    for row in kanri_items:
        at_ms = _parse_epoch_ms(row.get('updated_at') or row.get('created_at') or row.get('reported_at'))
        if at_ms < since_ms or at_ms > now_ms:
            continue
        who = _pick_name(row.get('reported_by'), row.get('updated_by_name'), row.get('created_by_name'))
        what = _pick_name(
            row.get('action'),
            row.get('event'),
            row.get('name'),
            row.get('title'),
            row.get('note'),
            row.get('summary'),
            '情報を更新しました',
        )
        events.append({
            'at_ms': at_ms,
            'at': _label_hhmm(at_ms),
            'kind': 'kanri_log',
            'who': who,
            'what': what,
        })

    # 2) 業務報告提出（universal_work_reports table）
    try:
        report_items = _scan_all(work_reports_table)
    except Exception as e:
        print(f"[activity-digest] work_reports scan failed: {str(e)}")
        report_items = []
    for item in report_items:
        state = str(item.get('state') or '').strip().lower()
        posted_ms = _parse_epoch_ms(
            item.get('submitted_at')
            or item.get('last_submitted_at')
            or item.get('report_submitted_at')
            or item.get('updated_at')
            or item.get('created_at')
        )
        if posted_ms < since_ms or posted_ms > now_ms:
            continue
        if state and state != 'submitted' and not item.get('submitted_at') and not item.get('last_submitted_at'):
            continue
        who = _pick_name(
            item.get('submitted_by_name'),
            item.get('created_by_name'),
            item.get('user_name'),
            item.get('worker_name'),
            item.get('worker_id'),
        )
        template = str(item.get('template_id') or '').strip()
        work_date = str(item.get('work_date') or item.get('date') or '').strip()
        extra = []
        if template:
            extra.append(template)
        if work_date:
            extra.append(work_date)
        suffix = f"（{' / '.join(extra)}）" if extra else ''
        preview = _report_content_preview(item)
        events.append({
            'at_ms': posted_ms,
            'at': _label_hhmm(posted_ms),
            'kind': 'work_report_submitted',
            'who': who,
            'what': f"業務報告を提出しました{suffix}{f'「{preview}」' if preview else ''}",
        })

    # 3) お客様チャット
    try:
        chat_items = _scan_all(admin_chat_table, filter_expression=Attr('room').eq(CUSTOMER_CHAT_ADMIN_ROOM))
    except Exception as e:
        print(f"[activity-digest] admin_chat scan failed: {str(e)}")
        chat_items = []
    for row in chat_items:
        at_ms = _parse_epoch_ms(row.get('created_at') or row.get('updated_at'))
        if at_ms < since_ms or at_ms > now_ms:
            continue
        who = _pick_name(row.get('sender_display_name'), row.get('sender_name'), row.get('created_by_name'))
        msg = str(row.get('message') or '').strip().replace('\n', ' ')
        preview = f"「{msg[:32]}{'…' if len(msg) > 32 else ''}」" if msg else ''
        events.append({
            'at_ms': at_ms,
            'at': _label_hhmm(at_ms),
            'kind': 'customer_chat',
            'who': who,
            'what': f"お客様チャットを受信しました{preview}",
        })

    # 4) 顧客マスタ申請（admin_chat room=customer_master_approval）
    try:
        approval_items = _scan_all(admin_chat_table, filter_expression=Attr('room').eq(CUSTOMER_MASTER_APPROVAL_ROOM))
    except Exception as e:
        print(f"[activity-digest] customer_master_approval scan failed: {str(e)}")
        approval_items = []
    for row in approval_items:
        at_ms = _parse_epoch_ms(row.get('created_at') or row.get('updated_at'))
        if at_ms < since_ms or at_ms > now_ms:
            continue
        payload = _parse_json_like_object(row.get('data_payload'))
        event_type = str(payload.get('event_type') or '').strip()
        if event_type not in ('change_request', 'change_decision'):
            continue
        who = _pick_name(
            payload.get('sender_name'),
            row.get('sender_display_name'),
            row.get('sender_name'),
            row.get('created_by_name'),
        )
        summary = _shrink_inline_text(payload.get('summary') or row.get('message') or row.get('name'), 48)
        if event_type == 'change_decision':
            decision = str(payload.get('decision') or '').strip()
            decision_label = '承認' if decision == 'approved' else ('却下' if decision == 'rejected' else '判定')
            what = f"顧客マスタ申請を{decision_label}しました"
        else:
            what = "顧客マスタ申請を送信しました"
        if summary:
            what = f"{what}「{summary}」"
        events.append({
            'at_ms': at_ms,
            'at': _label_hhmm(at_ms),
            'kind': 'customer_master_approval',
            'who': who,
            'what': what,
        })

    events.sort(key=lambda x: x.get('at_ms', 0), reverse=True)
    return events[:DAILY_ACTIVITY_MAX_LINES], since_ms, now_ms


def _send_daily_activity_digest(hours=24):
    events, since_ms, now_ms = _collect_recent_activity(hours=hours)
    since_label = datetime.fromtimestamp(since_ms / 1000, JST).strftime('%Y/%m/%d %H:%M')
    now_label = datetime.fromtimestamp(now_ms / 1000, JST).strftime('%Y/%m/%d %H:%M')
    date_label = _now_jst().strftime('%Y/%m/%d')

    subject = f"【MISOGI】直近アクティビティ通知 {date_label}"
    lines = [
        "MISOGI 管理アクティビティ（日次通知）",
        f"対象期間: {since_label} - {now_label} (JST)",
        f"件数: {len(events)}",
        "",
    ]
    if events:
        for idx, ev in enumerate(events, start=1):
            lines.append(f"{idx:03d}. {ev.get('at','--:--')} | {ev.get('who','未設定')} | {ev.get('what','')}")
    else:
        lines.append("対象期間内のアクティビティはありません。")
    body = "\n".join(lines)

    ses_client.send_email(
        Source=DAILY_ACTIVITY_EMAIL_FROM,
        Destination={'ToAddresses': [DAILY_ACTIVITY_EMAIL_TO]},
        Message={
            'Subject': {'Data': subject, 'Charset': 'UTF-8'},
            'Body': {'Text': {'Data': body, 'Charset': 'UTF-8'}},
        },
    )
    return {'subject': subject, 'count': len(events), 'from': DAILY_ACTIVITY_EMAIL_FROM, 'to': DAILY_ACTIVITY_EMAIL_TO}


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
        department = payload.get('custom:department') or payload.get('department', '')
        worker_id = payload.get('custom:worker_id') or payload.get('worker_id') or uid
        return {
            'uid': uid,
            'worker_id': worker_id,
            'email': email,
            'role': role,
            'department': department,
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
        department = authorizer_claims.get('custom:department') or authorizer_claims.get('department')
        worker_id = authorizer_claims.get('custom:worker_id') or authorizer_claims.get('worker_id') or uid
        return {
            'uid': uid,
            'worker_id': worker_id,
            'email': authorizer_claims.get('email'),
            'role': role or 'cleaning',
            'department': department or '',
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
    """
    CORS ヘッダー（業務報告専用 API 用）
    Origin が https://misesapo.co.jp のときはそれに限定、それ以外は許可しない（本番セキュリティ）。
    """
    origin_header = event_headers.get('Origin') or event_headers.get('origin') or ''
    # 本番: https://misesapo.co.jp のみ許可
    allowed_origins = ['https://misesapo.co.jp']
    # 開発用: localhost も許可（必要に応じて追加）
    if origin_header.startswith('http://localhost:') or origin_header.startswith('https://localhost:'):
        allowed_origins.append(origin_header)
    
    # Origin が許可リストに含まれる場合のみ返す
    if origin_header in allowed_origins:
        allow_origin = origin_header
    else:
        # 許可されていない Origin の場合は空文字（CORS エラーになるが、セキュリティ上正しい）
        allow_origin = ''
    
    headers = {
        'Access-Control-Allow-Origin': allow_origin,
        'Access-Control-Allow-Headers': 'Authorization,Content-Type',
        'Access-Control-Allow-Methods': 'GET,PUT,POST,PATCH,DELETE,OPTIONS',
        'Vary': 'Origin',
    }
    # Content-Type は通常レスポンスに付けるが、OPTIONS では不要な場合もあるので呼び出し側で追加
    return headers


def lambda_handler(event, context):
    """
    業務報告専用 API（1x0f73dj2l）からの /work-report・/upload-url・/upload-put のみ処理。
    """
    # ✅ Step 2: Handler の先頭に print デバッグ（最重要）
    print("### HIT LAMBDA_HANDLER ###")
    print("### EVENT_KEYS ###", list(event.keys())[:50] if isinstance(event, dict) else str(event)[:200])
    print("### CONTEXT ###", str(context)[:200] if context else "None")

    # EventBridge スケジュール実行（毎日 19:00 JST 想定）
    if isinstance(event, dict) and (
        event.get('source') == 'aws.events'
        or event.get('detail-type') == 'Scheduled Event'
        or event.get('action') == 'send_daily_activity_digest'
    ):
        try:
            result = _send_daily_activity_digest(hours=DAILY_ACTIVITY_HOURS)
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json; charset=utf-8'},
                'body': json.dumps({'ok': True, 'result': result}, ensure_ascii=False),
            }
        except Exception as e:
            import traceback
            print(f"[activity-digest] failed: {str(e)}")
            traceback.print_exc()
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json; charset=utf-8'},
                'body': json.dumps({'ok': False, 'error': str(e)}, ensure_ascii=False),
            }
    
    try:
        path = event.get('path', '') or event.get('requestContext', {}).get('path', '') or ''
        method = event.get('httpMethod', '') or event.get('requestContext', {}).get('http', {}).get('method', '') or ''
        
        event_headers = _get_headers(event)
        cors_headers = _cors_headers(event_headers)
        
        # OPTIONS（CORS プリフライト）: 早期リターン（path 処理不要）
        if method == 'OPTIONS':
            return {'statusCode': 200, 'headers': cors_headers, 'body': ''}
        
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

        # 通常レスポンス用ヘッダー（CORS + Content-Type）
        headers = {**cors_headers, 'Content-Type': 'application/json; charset=utf-8'}
    except Exception as e:
        # OPTIONS 処理やヘッダー生成でエラーが発生した場合も CORS ヘッダを返す
        print(f"[lambda_handler] Error in initial processing: {str(e)}")
        import traceback
        traceback.print_exc()
        error_cors = {
            'Access-Control-Allow-Origin': event_headers.get('Origin') or event_headers.get('origin') or '',
            'Access-Control-Allow-Headers': 'Authorization,Content-Type',
            'Access-Control-Allow-Methods': 'GET,PUT,POST,PATCH,DELETE,OPTIONS',
            'Vary': 'Origin',
        }
        return {'statusCode': 500, 'headers': error_cors, 'body': json.dumps({'error': 'Internal server error'}, ensure_ascii=False)}

    if normalized_path == '/upload-url':
        if method == 'POST':
            return handle_upload_url(event, headers)
        return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)}

    if normalized_path == '/upload-put':
        if method == 'POST':
            return handle_upload_put(event, headers)
        return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)}

    if normalized_path.startswith('/public/work-report'):
        if handle_public_work_report:
            return handle_public_work_report(event, headers, normalized_path, method)
        return {'statusCode': 503, 'headers': headers, 'body': json.dumps({'error': 'Service unavailable'}, ensure_ascii=False)}

    if normalized_path.startswith('/admin'):
        if not handle_admin_work_reports:
            return {'statusCode': 503, 'headers': headers, 'body': json.dumps({'error': 'Service unavailable'}, ensure_ascii=False)}
        user_info = _get_user_info_from_event(event)
        is_hr_admin = _is_hr_admin(user_info)
        return handle_admin_work_reports(event, headers, normalized_path, method, user_info, is_hr_admin)

    if normalized_path.startswith('/houkoku'):
        from universal_work_reports import handle_houkoku_reports
        if not handle_houkoku_reports:
            return {'statusCode': 503, 'headers': headers, 'body': json.dumps({'error': 'Service unavailable'}, ensure_ascii=False)}
        user_info = _get_user_info_from_event(event)
        return handle_houkoku_reports(event, headers, normalized_path, method, user_info)

    if normalized_path.startswith('/work-report'):
        print(f"[lambda_handler] Routing to handle_universal_worker_work_reports: path={normalized_path}, method={method}")
        print(f"[lambda_handler] handle_universal_worker_work_reports type: {type(handle_universal_worker_work_reports)}")
        print(f"[lambda_handler] handle_universal_worker_work_reports is None: {handle_universal_worker_work_reports is None}")
        if not handle_universal_worker_work_reports:
            print("[lambda_handler] ERROR: handle_universal_worker_work_reports is None!")
            print("[lambda_handler] Import error check - universal_work_reports module may not be imported correctly")
            return {'statusCode': 503, 'headers': headers, 'body': json.dumps({'error': 'Service unavailable'}, ensure_ascii=False)}
        user_info = _get_user_info_from_event(event)
        print(f"[lambda_handler] Calling handle_universal_worker_work_reports: user_info={bool(user_info)}, user_id={user_info.get('uid') if user_info else 'N/A'}")
        result = handle_universal_worker_work_reports(event, headers, normalized_path, method, user_info)
        print(f"[lambda_handler] handle_universal_worker_work_reports returned: statusCode={result.get('statusCode') if isinstance(result, dict) else 'N/A'}")
        return result

    return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not Found'}, ensure_ascii=False)}
