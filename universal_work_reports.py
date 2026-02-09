import json
import boto3
import os
import uuid
import logging
import traceback
from datetime import datetime, timedelta, timezone
import calendar
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from decimal import Decimal

# ロガー設定（CloudWatch Logs 用）
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def decimal_handler(obj):
    """
    DynamoDB 由来の Decimal を JSON で安全に扱うための変換関数。
    - Decimal は int / float に変換して返す（数値として保持）
    - それ以外の非シリアライズ型は最後の手段として文字列化する
      （予期しない 500 を避けるため）
    """
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return str(obj)


_original_json_dumps = json.dumps


def json_dumps_decimal(obj, *args, **kwargs):
    """
    json.dumps を Decimal 対応版でラップする。
    - 明示的な default 指定があっても decimal_handler に統一
    - ensure_ascii / indent など他の引数はそのまま尊重
    """
    kwargs["default"] = decimal_handler
    return _original_json_dumps(obj, *args, **kwargs)


json.dumps = json_dumps_decimal

# DynamoDB initialization（リージョン明示で保存先を確実に）
DYNAMODB_REGION = os.environ.get('AWS_REGION', 'ap-northeast-1')
dynamodb = boto3.resource('dynamodb', region_name=DYNAMODB_REGION)
# ✅ ハードコード排除: 環境変数から必ず取得（文字列直書き禁止）
TABLE_NAME = os.environ.get('UNIVERSAL_WORK_LOGS_TABLE', 'misesapo-sales-work-reports')
if not TABLE_NAME:
    raise ValueError("UNIVERSAL_WORK_LOGS_TABLE environment variable is required")
table = dynamodb.Table(TABLE_NAME)
logger.info("[INIT] DynamoDB table=%s, region=%s", TABLE_NAME, DYNAMODB_REGION)
print(f"[INIT] DynamoDB table={TABLE_NAME}, region={DYNAMODB_REGION}")

def _get_jst_now():
    return datetime.now(timezone(timedelta(hours=9)))

def _calculate_work_minutes(start_at, end_at, break_minutes, next_day):
    """
    開始時刻、終了時刻、休憩、翌日フラグから実稼働時間を計算
    """
    try:
        fmt = '%H:%M'
        start_dt = datetime.strptime(start_at, fmt)
        end_dt = datetime.strptime(end_at, fmt)
        
        if next_day:
            end_dt += timedelta(days=1)
            
        diff = end_dt - start_dt
        total_minutes = int(diff.total_seconds() / 60)
        return max(0, total_minutes - int(break_minutes or 0))
    except (ValueError, TypeError):
        return 0

def _create_history_entry(history_type, by_user, from_state, to_state, reason=None):
    """
    history エントリを作成（ルールB準拠）
    - history_type: "update" または "state"
    - by_user: 実行ユーザーID
    - from_state: 遷移前の状態（新規作成時は None）
    - to_state: 遷移後の状態
    - reason: 理由（オプション、rejected 時などに必須）
    """
    now_iso = _get_jst_now().isoformat()
    entry = {
        'at': now_iso,
        'by': by_user,
        'type': history_type,
        'from_state': from_state,
        'to_state': to_state
    }
    if reason:
        entry['reason'] = reason
    return entry


def handle_universal_worker_work_reports(event, headers, path, method, user_info):
    """
    Worker向け汎用業務報告API
    """
    # ✅ デバッグ: event / method / path を可視化
    try:
        event_str = json.dumps(event, default=str, ensure_ascii=False)
        logger.info("[DEBUG] raw_event (first 4000 chars)=%s", event_str[:4000])
    except Exception as e:
        logger.warning("[DEBUG] Failed to serialize event: %s", str(e))
    
    # method / path の正規化（API Gateway の形式に合わせる）
    method_upper = (method or '').upper()
    path_normalized = (path or '').split('?')[0]  # クエリパラメータ除去
    
    logger.info("[DEBUG] method=%s path=%s (normalized: %s)", method, path, path_normalized)
    
    if not user_info:
        logger.warning("[work-report] 401: user_info is None (token missing or invalid; 403 may be from API Gateway)")
        print("[work-report] 401: user_info is None (token missing or invalid; 403 may be from API Gateway)")
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'})}
    
    worker_id = user_info['uid']
    parts = path_normalized.split('/')
    
    logger.info("[DEBUG] worker_id=%s, parts=%s", worker_id, parts)
    
    # GET /work-report
    # 自分の報告一覧を取得（クエリパラメータでフィルタリング可）
    if method == 'GET' and path == '/work-report':
        query_params = event.get('queryStringParameters') or {}
        month = query_params.get('month')
        date = query_params.get('date')
        date_from = query_params.get('date_from')
        date_to = query_params.get('date_to')
        state = query_params.get('state')
        limit_raw = query_params.get('limit')

        # limit のパース（不正値は無視）
        limit = None
        if limit_raw:
            try:
                limit_val = int(limit_raw)
                if limit_val > 0:
                    limit = limit_val
            except ValueError:
                pass
        
        try:
            # GSI1: PK=worker_id, SK=work_date
            # 注意: ここではGSI1のインデックス名を 'WorkerIndex' と想定
            key_cond = Key('worker_id').eq(worker_id)

            # 日付範囲指定を優先
            if date_from or date_to:
                if date_from and date_to:
                    key_cond &= Key('work_date').between(date_from, date_to)
                elif date_from:
                    key_cond &= Key('work_date').gte(date_from)
                else:
                    key_cond &= Key('work_date').lte(date_to)
            elif date:
                key_cond &= Key('work_date').begins_with(date)
            elif month:
                key_cond &= Key('work_date').begins_with(month)

            query_params_db = {
                'IndexName': 'WorkerIndex',
                'KeyConditionExpression': key_cond,
                'ScanIndexForward': False  # work_date の降順
            }

            if limit is not None:
                query_params_db['Limit'] = limit

            # state フィルタはセカンダリ条件として適用
            filter_expr = None
            if state:
                filter_expr = Attr('state').eq(state)
                query_params_db['FilterExpression'] = filter_expr

            response = table.query(**query_params_db)
            items = response.get('Items', [])
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(items, ensure_ascii=False)
            }
        except Exception as e:
            # GSIがない場合のフォールバック（Scanは非推奨だが開発初期用）
            print(f"GSI Query failed: {str(e)}. Falling back to scan.")
            scan_filter = Attr('worker_id').eq(worker_id)

            if state:
                scan_filter &= Attr('state').eq(state)
            if date_from:
                scan_filter &= Attr('work_date').gte(date_from)
            if date_to:
                scan_filter &= Attr('work_date').lte(date_to)
            if date:
                scan_filter &= Attr('work_date').begins_with(date)
            if month:
                scan_filter &= Attr('work_date').begins_with(month)

            response = table.scan(
                FilterExpression=scan_filter
            )
            items = response.get('Items', [])
            # work_date の降順ソート
            items.sort(key=lambda x: x.get('work_date', ''), reverse=True)
            if limit is not None:
                items = items[:limit]
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(items, ensure_ascii=False)
            }

    # GET /work-report/{log_id} 自分の報告1件を log_id で取得
    if method == 'GET' and len(parts) >= 3 and parts[1] == 'work-report':
        log_id = parts[2]
        try:
            resp = table.get_item(Key={'log_id': log_id})
            item = resp.get('Item')
            if not item:
                return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}
            if item.get('worker_id') != worker_id:
                print(f"[GET /work-report/{log_id}] 403: worker_id mismatch (report owner != current user)")
                return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'})}
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps(item, ensure_ascii=False)}
        except Exception as e:
            return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}

    # PUT /work-report (Save Draft)
    # ✅ デバッグ: 分岐マッチ確認
    logger.info("[DEBUG] Checking PUT /work-report: method=%s (==PUT? %s), path=%s (==/work-report? %s)", 
                method_upper, method_upper == 'PUT', path_normalized, path_normalized == '/work-report')
    
    if method_upper == 'PUT' and path_normalized == '/work-report':
        request_id = event.get('requestContext', {}).get('requestId', 'unknown')
        try:
            body = json.loads(event.get('body') or '{}')
            log_id = body.get('log_id')
            
            # ログ出力（PII除外）
            print(f"[PUT /work-report] request_id={request_id}, log_id={log_id}, has_date={'date' in body or 'work_date' in body}, template_id={body.get('template_id', 'N/A')}")
            
            now_iso = _get_jst_now().isoformat()

            # 対象日付（必須）。既存レコードがあれば同じ日付のものを更新する。
            date = body.get("date") or body.get("work_date")
            if not date:
                print(f"[PUT /work-report] request_id={request_id}: Missing date/work_date")
                return {
                    "statusCode": 400,
                    "headers": headers,
                    "body": json.dumps({
                        "error": "BadRequest",
                        "message": "date is required (or work_date)"
                    })
                }

            existing = None

            if log_id:
                # log_id 明示指定の場合は、従来どおり単純更新
                resp = table.get_item(Key={'log_id': log_id})
                existing = resp.get('Item')
            else:
                # log_id が無い場合は、worker_id + date で既存レコードを探して upsert する
                try:
                    query_resp = table.query(
                        IndexName='WorkerIndex',
                        KeyConditionExpression=Key('worker_id').eq(worker_id) & Key('work_date').begins_with(date)
                    )
                    items = query_resp.get('Items', [])
                    # 同一日付の最新レコードを 1 件だけ採用
                    existing_candidates = [i for i in items if i.get('work_date') == date]
                    if existing_candidates:
                        # version 降順で最新を取得
                        existing_candidates.sort(key=lambda x: x.get('version', 0), reverse=True)
                        existing = existing_candidates[0]
                        log_id = existing.get('log_id')
                except Exception as e:
                    # インデックスが無ければ get_item などの他手段に頼ることも検討できるが、
                    # ここでは単純に「新規作成」として扱う
                    print(f"WorkerIndex query failed in PUT /work-report: {str(e)}")

            if existing:
                # 権限チェック
                if existing.get('worker_id') != worker_id:
                    print(f"[PUT /work-report] request_id={request_id}: Forbidden - worker_id mismatch")
                    return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'})}
                
                # 状態チェック（approved/archived/canceled は編集禁止）
                current_state = existing.get('state')
                if current_state in ['approved', 'archived', 'canceled']:
                    print(f"[PUT /work-report] request_id={request_id}: Conflict - state={current_state}")
                    return {
                        'statusCode': 409,
                        'headers': headers,
                        'body': json.dumps({
                            'error': 'Conflict',
                            'reason': f'state_locked',
                            'message': f'Cannot edit report in {current_state} state. The report has been finalized and cannot be modified.',
                            'current_state': current_state
                        }, ensure_ascii=False)
                    }
                
                # submitted は編集可（蓄積・参照のみの運用のため差し戻しフローは使わない）

                # 楽観的ロック
                old_version = body.get('version', 0)
                existing_version = existing.get('version', 0)
                if existing_version != old_version:
                    print(f"[PUT /work-report] request_id={request_id}: Conflict - version mismatch (existing={existing_version}, provided={old_version})")
                    return {
                        'statusCode': 409,
                        'headers': headers,
                        'body': json.dumps({
                            'error': 'Conflict',
                            'reason': 'version_mismatch',
                            'message': 'The report has been updated by another process. Please refresh and try again.',
                            'expected_version': existing_version,
                            'provided_version': old_version
                        }, ensure_ascii=False)
                    }
                
                new_version = old_version + 1
                history = existing.get('history', [])
                from_state = current_state
            else:
                # 新規作成
                log_id = log_id or str(uuid.uuid4())
                new_version = 1
                history = []
                from_state = None

            # データの構築
            work_date = body.get('work_date') or date  # date をフォールバックとして使用
            if not work_date:
                print(f"[PUT /work-report] request_id={request_id}: Missing work_date")
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'BadRequest', 'message': 'work_date is required'})
                }
            
            start_at = body.get('start_at', '00:00')
            end_at = body.get('end_at', '00:00')
            break_minutes = int(body.get('break_minutes', 0))
            next_day = bool(body.get('next_day', False))
            
            # 実稼働時間の計算
            work_minutes = body.get('work_minutes')
            if work_minutes is None:
                work_minutes = _calculate_work_minutes(start_at, end_at, break_minutes, next_day)

            item = {
                'log_id': log_id,
                'worker_id': worker_id,
                'work_date': work_date,
                'start_at': start_at,
                'end_at': end_at,
                'next_day': next_day,
                'break_minutes': break_minutes,
                'work_minutes': int(work_minutes),
                'category': body.get('category', 'other'),
                'description': body.get('description', ''),
                'deliverables': body.get('deliverables', ''),
                'ref_type': body.get('ref_type', 'none'),
                'ref_id': body.get('ref_id', ''),
                'pay_code': body.get('pay_code', ''),
                'template_id': body.get('template_id'),  # テンプレートIDを追加
                'target_label': body.get('target_label'),  # ターゲットラベルを追加
                'state': body.get('state', 'draft'),  # リクエストのstateを使用（デフォルトはdraft）
                'version': new_version,
                'updated_at': now_iso,
                'created_at': existing.get('created_at', now_iso) if existing else now_iso
            }
            
            # None値を削除（DynamoDBではNone値は保存できない）
            item = {k: v for k, v in item.items() if v is not None}
            
            # historyの追記（ルールB準拠: type="update"）
            history.append(_create_history_entry(
                history_type='update',
                by_user=worker_id,
                from_state=from_state,
                to_state='draft'
            ))
            item['history'] = history

            # 条件付き書き込み / upsert
            try:
                item["date"] = date
                item["work_date"] = date
                
                # ✅ 保存処理ログ（直前）
                table_name = os.environ.get('UNIVERSAL_WORK_LOGS_TABLE', 'misesapo-sales-work-reports')
                logger.info("[WORK_REPORT] saving log_id=%s, table=%s, existing=%s", log_id, table_name, bool(existing))
                print(f"[PUT /work-report] About to save: log_id={log_id}, table={table_name}, existing={bool(existing)}")

                if existing:
                    # 既存レコードは version で楽観ロック
                    table.put_item(
                        Item=item,
                        ConditionExpression="version = :oldv",
                        ExpressionAttributeValues={":oldv": old_version}
                    )
                else:
                    # 新規作成はシンプルに attribute_not_exists(log_id) で衝突を防ぐ
                    table.put_item(
                        Item=item,
                        ConditionExpression="attribute_not_exists(log_id)"
                    )
                
                # ✅ 保存処理ログ（直後）
                logger.info("[WORK_REPORT] saved log_id=%s, table=%s", log_id, table_name)
                print(f"[PUT /work-report] Saved successfully: log_id={log_id}, table={table_name}")

            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "Unknown")
                if error_code == "ConditionalCheckFailedException":
                    print(f"[PUT /work-report] request_id={request_id}: ConditionalCheckFailedException - concurrent update")
                    # 既存レコードの最新versionを取得して返す
                    latest_version = 0
                    provided_version = 0
                    try:
                        if existing:
                            latest_resp = table.get_item(Key={'log_id': log_id})
                            latest_item = latest_resp.get('Item')
                            latest_version = latest_item.get('version', 0) if latest_item else existing.get('version', 0)
                            provided_version = old_version
                        else:
                            # 新規作成時の衝突（同じlog_idが既に存在）
                            latest_resp = table.get_item(Key={'log_id': log_id})
                            latest_item = latest_resp.get('Item')
                            if latest_item:
                                latest_version = latest_item.get('version', 0)
                    except Exception as get_error:
                        print(f"[PUT /work-report] request_id={request_id}: Failed to get latest version: {str(get_error)}")
                        latest_version = existing.get('version', 0) if existing else 0
                        provided_version = old_version if existing else 0
                    
                    return {
                        "statusCode": 409,
                        "headers": headers,
                        "body": json.dumps({
                            "error": "Conflict",
                            "reason": "concurrent_update",
                            "message": "The report was updated by another process while you were editing. Please refresh and try again.",
                            "expected_version": latest_version,
                            "provided_version": provided_version
                        }, ensure_ascii=False)
                    }
                print(f"[PUT /work-report] request_id={request_id}: DynamoDB ClientError - {error_code}: {str(e)}")
                raise

            # ✅ 保存成功ログ（必須）
            logger.info(f"[WORK_REPORT] saved log_id={log_id}, version={new_version}, worker_id={worker_id}, template_id={item.get('template_id', 'N/A')}")
            print(f"[PUT /work-report] request_id={request_id}: Success - log_id={log_id}, version={new_version}")
            
            # ✅ 必須: log_id が確実に含まれることを確認
            if not item.get('log_id'):
                logger.error(f"[WORK_REPORT] CRITICAL: log_id missing in response item! log_id={log_id}")
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({'error': 'InternalServerError', 'message': 'log_id missing in response', 'request_id': request_id})
                }
            
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(item, ensure_ascii=False)
            }

        except json.JSONDecodeError as e:
            print(f"[PUT /work-report] request_id={request_id}: JSON decode error - {str(e)}")
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'BadRequest', 'message': 'Invalid JSON in request body'})
            }
        except KeyError as e:
            print(f"[PUT /work-report] request_id={request_id}: Missing required field - {str(e)}")
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'BadRequest', 'message': f'Missing required field: {str(e)}'})
            }
        except ValueError as e:
            print(f"[PUT /work-report] request_id={request_id}: Validation error - {str(e)}")
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'BadRequest', 'message': str(e)})
            }
        except Exception as e:
            # ✅ 保存失敗ログ（必須: logger.exception 相当）
            error_trace = traceback.format_exc()
            logger.exception(f"[WORK_REPORT] save failed request_id={request_id}, error={str(e)}")
            print(f"[PUT /work-report] request_id={request_id}: Unexpected error - {str(e)}")
            print(f"[PUT /work-report] request_id={request_id}: Traceback:\n{error_trace}")
            # ✅ 必須: 保存失敗時は絶対に200を返さない
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': 'InternalServerError',
                    'message': 'An unexpected error occurred',
                    'request_id': request_id
                }, ensure_ascii=False)
            }

    # POST /work-report/submit
    if method == 'POST' and path == '/work-report/submit':
        try:
            body = json.loads(event.get('body') or '{}')
            log_id = body.get('log_id')
            if not log_id:
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'log_id is required'})}
            
            resp = table.get_item(Key={'log_id': log_id})
            item = resp.get('Item')
            
            if not item:
                return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}
            if item.get('worker_id') != worker_id:
                return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'})}
            current_state = item.get('state')
            if current_state in ['submitted', 'approved', 'archived', 'canceled']:
                return {'statusCode': 409, 'headers': headers, 'body': json.dumps({'error': f'Cannot submit from state {current_state}'})}

            now_iso = _get_jst_now().isoformat()
            history = item.get('history', [])
            # ルールB準拠: type="state"
            history.append(_create_history_entry(
                history_type='state',
                by_user=worker_id,
                from_state=current_state,
                to_state='submitted'
            ))
            
            updated = table.update_item(
                Key={'log_id': log_id},
                UpdateExpression="SET #st=:st, history=:hist, updated_at=:at, version=version + :one",
                ExpressionAttributeNames={'#st': 'state'},
                ExpressionAttributeValues={':st': 'submitted', ':hist': history, ':at': now_iso, ':one': 1},
                ReturnValues="ALL_NEW"
            )
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps(updated['Attributes'], ensure_ascii=False)}
        except Exception as e:
            return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}

    # PATCH /work-report/{log_id}
    # 状態遷移: draft -> submitted（Worker 用）
    # ✅ デバッグ: 分岐マッチ確認
    logger.info("[DEBUG] Checking PATCH /work-report/{log_id}: method=%s (==PATCH? %s), parts=%s, len(parts)=%d, parts[1]=%s (==work-report? %s)", 
                method_upper, method_upper == 'PATCH', parts, len(parts), parts[1] if len(parts) > 1 else None, parts[1] == 'work-report' if len(parts) > 1 else False)
    
    if method_upper == 'PATCH' and len(parts) >= 3 and parts[1] == 'work-report':
        log_id = parts[2]
        try:
            body = json.loads(event.get('body') or '{}')
            target_state = body.get('state')

            if target_state != 'submitted':
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Only transition to submitted is allowed for worker'})
                }

            resp = table.get_item(Key={'log_id': log_id})
            item = resp.get('Item')
            if not item:
                return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}
            if item.get('worker_id') != worker_id:
                return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'})}
            current_state = item.get('state')
            if current_state != 'draft':
                return {'statusCode': 409, 'headers': headers, 'body': json.dumps({'error': f'Can only submit from draft, current state: {current_state}'})}

            now_iso = _get_jst_now().isoformat()
            history = item.get('history', [])
            # ルールB準拠: type="state"
            history.append(_create_history_entry(
                history_type='state',
                by_user=worker_id,
                from_state=current_state,
                to_state='submitted'
            ))
            # 提出時に個別URL用の share_token を発行（既にある場合は上書きしない）
            share_token = item.get('share_token') or uuid.uuid4().hex

            # ✅ 保存処理ログ（直前）
            table_name = os.environ.get('UNIVERSAL_WORK_LOGS_TABLE', 'misesapo-sales-work-reports')
            logger.info("[WORK_REPORT] submitting log_id=%s, table=%s", log_id, table_name)
            print(f"[PATCH /work-report/{log_id}] About to submit: log_id={log_id}, table={table_name}")
            
            updated = table.update_item(
                Key={'log_id': log_id},
                UpdateExpression="SET #st=:st, history=:hist, updated_at=:at, share_token=:share, version=version + :one",
                ExpressionAttributeNames={'#st': 'state'},
                ExpressionAttributeValues={':st': 'submitted', ':hist': history, ':at': now_iso, ':share': share_token, ':one': 1},
                ReturnValues="ALL_NEW"
            )
            
            # ✅ 保存処理ログ（直後）
            logger.info("[WORK_REPORT] submitted log_id=%s, table=%s", log_id, table_name)
            print(f"[PATCH /work-report/{log_id}] Submitted successfully: log_id={log_id}, table={table_name}")
            updated_item = updated['Attributes']
            
            # ✅ 必須: log_id が確実に含まれることを確認
            if not updated_item.get('log_id'):
                logger.error(f"[WORK_REPORT] CRITICAL: log_id missing in PATCH response! log_id={log_id}")
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({'error': 'InternalServerError', 'message': 'log_id missing in response'}, ensure_ascii=False)
                }
            
            # ✅ 保存成功ログ（必須）
            logger.info(f"[WORK_REPORT] submitted log_id={log_id}, worker_id={worker_id}, state=submitted")
            print(f"[PATCH /work-report/{log_id}] Success - state=submitted")
            
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps(updated_item, ensure_ascii=False)}
        except Exception as e:
            # ✅ 保存失敗ログ（必須: logger.exception 相当）
            error_trace = traceback.format_exc()
            logger.exception(f"[WORK_REPORT] submit failed log_id={log_id}, error={str(e)}")
            print(f"[PATCH /work-report/{log_id}] Error: {str(e)}\n{error_trace}")
            # ✅ 必須: 保存失敗時は絶対に200を返さない
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': 'InternalServerError', 'message': str(e)}, ensure_ascii=False)
            }

    # PATCH /work-report  (bodyで対象を指定する互換パス)
    # - UI/クライアントが /work-report/{log_id} を未使用の場合の救済
    # - PUT と同じキー（worker_id + report_date）または log_id で対象を特定
    # ✅ デバッグ: 分岐マッチ確認
    logger.info("[DEBUG] Checking PATCH /work-report (compat): method=%s (==PATCH? %s), path=%s (==/work-report? %s)", 
                method_upper, method_upper == 'PATCH', path_normalized, path_normalized == '/work-report')
    
    if method_upper == 'PATCH' and path_normalized == '/work-report':
        request_id = event.get('requestContext', {}).get('requestId', 'unknown')
        try:
            body = json.loads(event.get('body') or '{}')

            target_state = body.get('state') or body.get('to')
            if target_state != 'submitted':
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'BadRequest',
                        'message': 'Only transition to submitted is allowed for worker'
                    }, ensure_ascii=False)
                }

            # 対象特定（優先: log_id）
            log_id = body.get('log_id')
            date = body.get('date') or body.get('work_date') or body.get('report_date')
            template_id = body.get('template_id')

            item = None
            if log_id:
                resp = table.get_item(Key={'log_id': log_id})
                item = resp.get('Item')
            else:
                if not date:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({
                            'error': 'BadRequest',
                            'message': 'date (report_date/work_date) is required when log_id is not provided'
                        }, ensure_ascii=False)
                    }

                # WorkerIndex: worker_id + work_date（同一日付の最新を取る）
                try:
                    q = table.query(
                        IndexName='WorkerIndex',
                        KeyConditionExpression=Key('worker_id').eq(worker_id) & Key('work_date').between(date, date),
                        ScanIndexForward=False
                    )
                    candidates = q.get('Items', [])
                except Exception as e:
                    print(f"[PATCH /work-report] request_id={request_id}: WorkerIndex query failed: {str(e)}")
                    candidates = []

                if template_id:
                    candidates = [c for c in candidates if c.get('template_id') == template_id]

                if candidates:
                    # version降順で最新を採用
                    candidates.sort(key=lambda x: x.get('version', 0), reverse=True)
                    item = candidates[0]
                    log_id = item.get('log_id')

            if not item or not log_id:
                return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'}, ensure_ascii=False)}

            if item.get('worker_id') != worker_id:
                return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'}, ensure_ascii=False)}

            current_state = item.get('state')
            if current_state != 'draft':
                return {
                    'statusCode': 409,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'Conflict',
                        'reason': 'invalid_transition',
                        'message': f'Can only submit from draft (current: {current_state})',
                        'current_state': current_state
                    }, ensure_ascii=False)
                }

            provided_version = body.get('version')
            expected_version = item.get('version', 0)
            if provided_version is None:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'BadRequest',
                        'message': 'version is required for PATCH (optimistic locking)'
                    }, ensure_ascii=False)
                }
            if int(provided_version) != int(expected_version):
                return {
                    'statusCode': 409,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'Conflict',
                        'reason': 'version_mismatch',
                        'message': 'The report has been updated by another process. Please refresh and try again.',
                        'expected_version': expected_version,
                        'provided_version': int(provided_version)
                    }, ensure_ascii=False)
                }

            now_iso = _get_jst_now().isoformat()
            history = item.get('history', [])
            history.append(_create_history_entry(
                history_type='state',
                by_user=worker_id,
                from_state=current_state,
                to_state='submitted'
            ))
            share_token = item.get('share_token') or uuid.uuid4().hex

            # ✅ 保存処理ログ（直前）
            table_name = os.environ.get('UNIVERSAL_WORK_LOGS_TABLE', 'misesapo-sales-work-reports')
            logger.info("[WORK_REPORT] submitting (compat) log_id=%s, table=%s", log_id, table_name)
            print(f"[PATCH /work-report (compat)] About to submit: log_id={log_id}, table={table_name}")

            try:
                updated = table.update_item(
                    Key={'log_id': log_id},
                    UpdateExpression="SET #st=:st, history=:hist, updated_at=:at, last_submitted_at=:lsa, share_token=:share, version=version + :one",
                    ConditionExpression="version = :v AND #st = :draft AND worker_id = :wid",
                    ExpressionAttributeNames={'#st': 'state'},
                    ExpressionAttributeValues={
                        ':st': 'submitted',
                        ':hist': history,
                        ':at': now_iso,
                        ':lsa': now_iso,
                        ':share': share_token,
                        ':one': 1,
                        ':v': int(provided_version),
                        ':draft': 'draft',
                        ':wid': worker_id
                    },
                    ReturnValues="ALL_NEW"
                )
            except ClientError as e:
                code = e.response.get('Error', {}).get('Code')
                if code == 'ConditionalCheckFailedException':
                    # 競合 or 状態変更
                    latest = table.get_item(Key={'log_id': log_id}).get('Item') or {}
                    latest_v = latest.get('version', expected_version)
                    latest_state = latest.get('state', current_state)
                    reason = 'version_mismatch' if latest_v != int(provided_version) else 'invalid_transition'
                    return {
                        'statusCode': 409,
                        'headers': headers,
                        'body': json.dumps({
                            'error': 'Conflict',
                            'reason': reason,
                            'message': 'Conflict detected. Please refresh and try again.',
                            'expected_version': latest_v,
                            'provided_version': int(provided_version),
                            'current_state': latest_state
                        }, ensure_ascii=False)
                    }
                raise
            
            # ✅ 保存処理ログ（直後）
            logger.info("[WORK_REPORT] submitted (compat) log_id=%s, table=%s", log_id, table_name)
            print(f"[PATCH /work-report (compat)] Submitted successfully: log_id={log_id}, table={table_name}")

            return {'statusCode': 200, 'headers': headers, 'body': json.dumps(updated['Attributes'], ensure_ascii=False)}

        except json.JSONDecodeError:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'BadRequest', 'message': 'Invalid JSON in request body'}, ensure_ascii=False)}
        except Exception as e:
            return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': 'InternalServerError', 'message': str(e)}, ensure_ascii=False)}

    # ✅ 未マッチ時の警告（必須）
    logger.warning("[WORK_REPORT] unmatched route: method=%s path=%s (normalized: %s), parts=%s", 
                  method_upper, path, path_normalized, parts)
    print(f"[WORK_REPORT] WARNING: Unmatched route - method={method_upper}, path={path} (normalized: {path_normalized}), parts={parts}")
    return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'}, ensure_ascii=False)}

def handle_universal_admin_work_reports(event, headers, path, method, user_info, is_hr_admin):
    """
    管理者向け汎用業務報告API
    """
    if not user_info:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'})}
    if not is_hr_admin:
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'})}

    parts = path.split('/')
    
    # GET /admin/work-report
    # 未承認の報告を中心に一覧取得
    if method == 'GET' and path == '/admin/work-report':
        query_params = event.get('queryStringParameters') or {}
        state = query_params.get('state') or 'submitted'
        
        try:
            # GSI3: PK=state, SK=work_date#worker_id
            # インデックス名を 'StateIndex' と想定
            response = table.query(
                IndexName='StateIndex',
                KeyConditionExpression=Key('state').eq(state)
            )
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps(response.get('Items', []), ensure_ascii=False)}
        except:
            # フォールバック
            response = table.scan(FilterExpression=Attr('state').eq(state))
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps(response.get('Items', []), ensure_ascii=False)}

    # POST /admin/work-report/{id}/approve or /return
    if method == 'POST' and len(parts) >= 5:
        log_id = parts[3]
        action = parts[4] # approve or return
        
        try:
            resp = table.get_item(Key={'log_id': log_id})
            item = resp.get('Item')
            if not item:
                return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}
            
            if item.get('state') != 'submitted' and action == 'approve':
                return {'statusCode': 409, 'headers': headers, 'body': json.dumps({'error': 'Can only approve submitted reports'})}

            body = json.loads(event.get('body') or '{}')
            comment = body.get('comment', '')
            
            if action == 'return' and not comment:
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Comment is required for return'})}
            
            new_state = 'approved' if action == 'approve' else 'returned'
            current_state = item.get('state')
            now_iso = _get_jst_now().isoformat()
            
            history = item.get('history', [])
            # ルールB準拠: type="state"
            history.append(_create_history_entry(
                history_type='state',
                by_user=user_info['uid'],
                from_state=current_state,
                to_state=new_state,
                reason=comment if comment else None
            ))
            
            updated = table.update_item(
                Key={'log_id': log_id},
                UpdateExpression="SET #st=:st, history=:hist, updated_at=:at, version=version + :one",
                ExpressionAttributeNames={'#st': 'state'},
                ExpressionAttributeValues={':st': new_state, ':hist': history, ':at': now_iso, ':one': 1},
                ReturnValues="ALL_NEW"
            )
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps(updated['Attributes'], ensure_ascii=False)}
        except Exception as e:
            return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}

    # PATCH /admin/work-report/{log_id}
    # 状態遷移: submitted -> approved / rejected（管理者用）
    if method == 'PATCH' and len(parts) >= 4 and parts[1] == 'admin' and parts[2] == 'work-report':
        log_id = parts[3]
        try:
            body = json.loads(event.get('body') or '{}')
            target_state = body.get('state')
            comment = body.get('comment') or body.get('reason')

            if target_state not in ['approved', 'rejected']:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'state must be approved or rejected'})
                }

            resp = table.get_item(Key={'log_id': log_id})
            item = resp.get('Item')
            if not item:
                return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}
            
            current_state = item.get('state')
            # approved/archived/canceled からの変更は禁止
            if current_state in ['approved', 'archived', 'canceled']:
                return {'statusCode': 409, 'headers': headers, 'body': json.dumps({'error': f'Cannot change state from {current_state}'})}
            
            # triaged への遷移は submitted からのみ
            if target_state == 'triaged' and current_state != 'submitted':
                return {'statusCode': 409, 'headers': headers, 'body': json.dumps({'error': f'Can only triage from submitted, current: {current_state}'})}
            
            # approved/rejected への遷移は triaged または submitted から
            if target_state in ['approved', 'rejected']:
                if current_state not in ['triaged', 'submitted']:
                    return {'statusCode': 409, 'headers': headers, 'body': json.dumps({'error': f'Can only approve/reject from triaged or submitted, current: {current_state}'})}

            # rejected の場合は理由必須
            if target_state == 'rejected' and not comment:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Comment/reason is required for rejected'})
                }

            now_iso = _get_jst_now().isoformat()
            history = item.get('history', [])
            # ルールB準拠: type="state"
            history.append(_create_history_entry(
                history_type='state',
                by_user=user_info['uid'],
                from_state=current_state,
                to_state=target_state,
                reason=comment if comment else None
            ))

            updated = table.update_item(
                Key={'log_id': log_id},
                UpdateExpression="SET #st=:st, history=:hist, updated_at=:at, version=version + :one",
                ExpressionAttributeNames={'#st': 'state'},
                ExpressionAttributeValues={':st': target_state, ':hist': history, ':at': now_iso, ':one': 1},
                ReturnValues="ALL_NEW"
            )
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps(updated['Attributes'], ensure_ascii=False)}
        except Exception as e:
            return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}

    return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}

def handle_admin_work_reports(event, headers, path, method, user_info, is_hr_admin):
    """
    管理者向け業務報告API（/admin/work-reports 複数形）
    ルールA〜Gに準拠。GET /admin/work-reports/{id} は管理者または報告本人（worker_id 一致）も可。
    すべてのレスポンス（エラー含む）に CORS ヘッダが含まれることを保証（headers は lambda_work_reports.py で CORS 付きで渡される）。
    """
    if headers is None:
        headers = {}
    if not user_info:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}
    if not path:
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': 'Missing path', 'exception_type': 'ValueError'}, ensure_ascii=False)}

    parts = path.split('/')
    parts = [p for p in parts if p]  # 空文字を除去

    # GET /admin/work-reports/{id} (詳細) は管理者でなくても報告本人なら閲覧可（/sales/work-reports で開くため）
    if method == 'GET' and len(parts) == 3 and parts[0] == 'admin' and parts[1] == 'work-reports':
        report_id = parts[2]
        return _handle_admin_work_reports_detail(report_id, headers, user_info, is_hr_admin)

    if not is_hr_admin:
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'})}

    # GET /admin/payroll/{user_id}/{YYYY-MM} 経理用・ユーザー×年月の月次ビュー（支払対象＝approved のみデフォルト）
    if method == 'GET' and len(parts) == 4 and parts[0] == 'admin' and parts[1] == 'payroll':
        user_id = parts[2]
        yyyy_mm = parts[3]
        return _handle_admin_payroll_month(user_id, yyyy_mm, event, headers, user_info, is_hr_admin)
    
    # GET /admin/work-reports (一覧)  path => admin, work-reports => len 2
    if method == 'GET' and len(parts) == 2 and parts[0] == 'admin' and parts[1] == 'work-reports':
        try:
            return _handle_admin_work_reports_list(event, headers, user_info, is_hr_admin)
        except Exception as e:
            import traceback
            traceback.print_exc()
            err_body = {'error': str(e)[:500], 'exception_type': type(e).__name__}
            try:
                body_str = json.dumps(err_body, ensure_ascii=False)
            except Exception:
                body_str = json.dumps({'error': 'Internal error', 'exception_type': type(e).__name__})
            return {'statusCode': 500, 'headers': headers, 'body': body_str}
    
    # GET /admin/work-reports/{id} は上で処理済み

    # PATCH /admin/work-reports/{id}/state  path => admin, work-reports, id, state => len 4
    if method == 'PATCH' and len(parts) == 4 and parts[0] == 'admin' and parts[1] == 'work-reports' and parts[3] == 'state':
        report_id = parts[2]
        return _handle_admin_work_reports_state_change(report_id, event, headers, user_info, is_hr_admin)
    
    # POST /admin/work-reports/bulk/state (一括状態遷移)
    if method == 'POST' and len(parts) == 4 and parts[0] == 'admin' and parts[1] == 'work-reports' and parts[2] == 'bulk' and parts[3] == 'state':
        return _handle_admin_work_reports_bulk_state(event, headers, user_info, is_hr_admin)
    
    # POST /admin/work-reports/{id}/export/pdf (PDF生成)
    if method == 'POST' and len(parts) == 5 and parts[0] == 'admin' and parts[1] == 'work-reports' and parts[3] == 'export' and parts[4] == 'pdf':
        report_id = parts[2]
        return _handle_admin_work_reports_export_pdf(report_id, headers, user_info, is_hr_admin)
    
    # POST /admin/work-reports/bulk/export/pdf (一括PDF生成)
    if method == 'POST' and len(parts) == 5 and parts[0] == 'admin' and parts[1] == 'work-reports' and parts[2] == 'bulk' and parts[3] == 'export' and parts[4] == 'pdf':
        return _handle_admin_work_reports_bulk_export_pdf(event, headers, user_info, is_hr_admin)
    
    return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}


def _handle_admin_payroll_month(user_id, yyyy_mm, event, headers, user_info, is_hr_admin):
    """
    経理用: GET /admin/payroll/{user_id}/{YYYY-MM}
    ユーザー×年月の月次ビュー。デフォルトは支払対象（state=approved）のみ。
    WorkerIndex (PK=worker_id, SK=work_date) で Query。Scan は使わない。
    """
    if headers is None:
        headers = {}
    try:
        # YYYY-MM 検証と月の範囲
        if len(yyyy_mm) != 7 or yyyy_mm[4] != '-':
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'BadRequest', 'message': 'month must be YYYY-MM'})}
        try:
            y, m = int(yyyy_mm[:4]), int(yyyy_mm[5:7])
            if m < 1 or m > 12:
                raise ValueError('month out of range')
        except (ValueError, TypeError):
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'BadRequest', 'message': 'invalid YYYY-MM'})}
        _, last_day = calendar.monthrange(y, m)
        month_start = f'{y:04d}-{m:02d}-01'
        month_end = f'{y:04d}-{m:02d}-{last_day:02d}'

        query_params = (event or {}).get('queryStringParameters') or {}
        state_filter = (query_params.get('state') or 'approved').strip().lower()
        approved_only = (state_filter != 'all')

        items = []
        try:
            q = table.query(
                IndexName='WorkerIndex',
                KeyConditionExpression=Key('worker_id').eq(user_id) & Key('work_date').between(month_start, month_end)
            )
            items = q.get('Items', [])
            while q.get('LastEvaluatedKey'):
                q = table.query(
                    IndexName='WorkerIndex',
                    KeyConditionExpression=Key('worker_id').eq(user_id) & Key('work_date').between(month_start, month_end),
                    ExclusiveStartKey=q['LastEvaluatedKey']
                )
                items.extend(q.get('Items', []))
        except ClientError as e:
            code = e.response.get('Error', {}).get('Code', '')
            return {'statusCode': 503, 'headers': headers, 'body': json.dumps({'error': str(e), 'code': code})}

        if approved_only:
            items = [i for i in items if i.get('state') == 'approved']

        rows = []
        total_minutes = 0
        for it in items:
            mins = int(it.get('work_minutes') or it.get('total_minutes') or 0)
            total_minutes += mins
            rows.append({
                'report_id': it.get('log_id'),
                'date': it.get('work_date') or it.get('report_date') or it.get('date'),
                'template_id': it.get('template_id'),
                'minutes': mins,
                'state': it.get('state'),
                'amount': None,
            })

        body = {
            'user_id': user_id,
            'month': yyyy_mm,
            'total_minutes': total_minutes,
            'total_amount': None,
            'rows': rows,
        }
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps(body, ensure_ascii=False)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}


def _handle_admin_work_reports_list(event, headers, user_info, is_hr_admin):
    """
    GET /admin/work-reports 一覧取得
    ルールD準拠: report_date desc, updated_at desc の安定ソート、limit + next_cursor
    """
    if headers is None:
        headers = {}
    try:
        query_params = (event or {}).get('queryStringParameters') or {}
        
        # クエリパラメータのパース
        date_from = query_params.get('from')
        date_to = query_params.get('to')
        states_str = query_params.get('states', '')
        templates_str = query_params.get('templates', '')
        q_target = query_params.get('q_target', '')
        q_user = query_params.get('q_user', '')
        flags_str = query_params.get('flags', '')
        cursor = query_params.get('cursor')
        limit_raw = query_params.get('limit', '50')
        
        # limit のパース（デフォルト50、最大100）
        try:
            limit = min(int(limit_raw), 100)
            if limit <= 0:
                limit = 50
        except ValueError:
            limit = 50
        
        # states のパース（カンマ区切り）
        states = [s.strip() for s in states_str.split(',') if s.strip()] if states_str else []
        if not states:
            # デフォルト: 下書きも含めて一覧表示（提出済みだけでなく保存済みも見えるようにする）
            states = ['draft', 'submitted', 'triaged', 'rejected']
        
        # templates のパース
        templates = [t.strip() for t in templates_str.split(',') if t.strip()] if templates_str else []
        
        # flags のパース（カンマ区切り、例: "over_12h,over_delta_30m"）
        flags = [f.strip() for f in flags_str.split(',') if f.strip()] if flags_str else []
        
        # 日付範囲のデフォルト（空配列になりにくい: 直近7日）
        if not date_from or not date_to:
            now_jst = _get_jst_now()
            if not date_to:
                date_to = now_jst.strftime('%Y-%m-%d')
            if not date_from:
                date_from = (now_jst - timedelta(days=7)).strftime('%Y-%m-%d')
        
        # ソートキー（report_date, updated_at を str 化して型混在による TypeError を防ぐ）
        def _sort_key(x):
            d = x.get('report_date') or x.get('work_date') or x.get('date') or ''
            u = x.get('updated_at') or ''
            return (str(d), str(u))
        
        items = []
        next_cursor = None
        
        try:
            # 状態ごとに scan してマージ（OR 式は boto3 環境差で落ちることがあるため避ける）
            all_items = []
            for state in states:
                try:
                    scan_filter = Attr('state').eq(state)
                    if date_from:
                        scan_filter = scan_filter & Attr('work_date').gte(date_from)
                    if date_to:
                        scan_filter = scan_filter & Attr('work_date').lte(date_to)
                    scan_kw = {'FilterExpression': scan_filter}
                    response = table.scan(**scan_kw)
                    all_items.extend(response.get('Items', []))
                    while response.get('LastEvaluatedKey'):
                        scan_kw['ExclusiveStartKey'] = response['LastEvaluatedKey']
                        response = table.scan(**scan_kw)
                        all_items.extend(response.get('Items', []))
                except ClientError as ce:
                    err_code = ce.response.get('Error', {}).get('Code', '')
                    print(f"DynamoDB ClientError state={state}: {err_code} - {ce}")
                    return {
                        'statusCode': 503,
                        'headers': headers,
                        'body': json.dumps({'error': str(ce), 'code': err_code, 'hint': 'Check UNIVERSAL_WORK_LOGS_TABLE (or default misesapo-sales-work-reports) and IAM'})
                    }
            # log_id で重複除去（同一レコードが複数 state でヒットすることはないが念のため）
            seen = set()
            unique = []
            for it in all_items:
                lid = it.get('log_id')
                if lid and lid not in seen:
                    seen.add(lid)
                    unique.append(it)
            all_items = unique
            
            # フィルタリング（日付・文字列は str に正規化して TypeError を防ぐ）
            filtered_items = []
            for item in all_items:
                # 日付範囲フィルタ（型混在で比較エラーにならないよう str 化）
                report_date_raw = item.get('report_date') or item.get('work_date') or item.get('date')
                report_date = str(report_date_raw) if report_date_raw else ''
                if report_date and (report_date < date_from or report_date > date_to):
                    continue
                
                # template_id フィルタ
                if templates and item.get('template_id') not in templates:
                    continue
                
                # target_label 部分一致
                if q_target:
                    target_label = str(item.get('target_label') or '')
                    if q_target.lower() not in target_label.lower():
                        continue
                
                # user 検索（worker_id または created_by_name）
                if q_user:
                    worker_id = str(item.get('worker_id') or '')
                    created_by_name = str(item.get('created_by_name') or '')
                    if q_user.lower() not in worker_id.lower() and q_user.lower() not in created_by_name.lower():
                        continue
                
                # flags フィルタ（flags のいずれかが true）
                if flags:
                    item_flags = item.get('flags')
                    if not isinstance(item_flags, dict):
                        item_flags = {}
                    has_flag = any(item_flags.get(flag, False) for flag in flags)
                    if not has_flag:
                        continue
                
                filtered_items.append(item)
            
            # ソート: report_date desc, updated_at desc
            filtered_items.sort(key=_sort_key, reverse=True)
            
            # limit 適用
            items = filtered_items[:limit]
            if len(filtered_items) > limit:
                # 簡易 cursor（最後の item の report_date + updated_at）
                last_item = filtered_items[limit - 1]
                next_cursor = f"{last_item.get('report_date') or last_item.get('work_date') or ''}|{last_item.get('updated_at') or ''}"
        
        except Exception as e:
            print(f"Error querying work reports: {str(e)}")
            # フォールバック: 状態ごとに単純 scan
            all_items = []
            for state in states:
                try:
                    fe = Attr('state').eq(state)
                    if date_from:
                        fe = fe & Attr('work_date').gte(date_from)
                    if date_to:
                        fe = fe & Attr('work_date').lte(date_to)
                    resp = table.scan(FilterExpression=fe)
                    all_items.extend(resp.get('Items', []))
                except Exception:
                    pass
            seen = set()
            unique = []
            for it in all_items:
                lid = it.get('log_id')
                if lid and lid not in seen:
                    seen.add(lid)
                    unique.append(it)
            items = sorted(unique, key=_sort_key, reverse=True)[:limit]
        
        # HR_V1 の template_data をマスク（ルールE）
        for item in items:
            if item.get('template_id') == 'HR_V1' and not is_hr_admin:
                # template_data をマスク（共通項のみ残す）
                if 'template_data' in item:
                    item['template_data'] = {'visibility': 'private', 'masked': True}
        
        try:
            body_str = json.dumps({
                'items': items,
                'rows': items,
                'next_cursor': next_cursor,
                'count': len(items)
            }, ensure_ascii=False)
        except Exception as serr:
            print(f"JSON serialize error: {serr}")
            return {'statusCode': 500, 'headers': headers or {}, 'body': json.dumps({'error': str(serr), 'exception_type': type(serr).__name__, 'hint': 'Response serialization failed'})}
        
        return {'statusCode': 200, 'headers': headers, 'body': body_str}
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error in _handle_admin_work_reports_list: {str(e)}")
        err_body = {'error': str(e), 'exception_type': type(e).__name__}
        return {'statusCode': 500, 'headers': headers or {}, 'body': json.dumps(err_body)}

def _handle_admin_work_reports_detail(report_id, headers, user_info, is_hr_admin):
    """
    GET /admin/work-reports/{id} 詳細取得。
    管理者は全件、それ以外は報告本人（worker_id 一致）のみ閲覧可。
    """
    try:
        resp = table.get_item(Key={'log_id': report_id})
        item = resp.get('Item')
        
        if not item:
            return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}
        
        # 管理者でない場合は報告本人（worker_id 一致）のみ許可
        if not is_hr_admin:
            uid = (user_info or {}).get('uid') or (user_info or {}).get('sub') or ''
            if item.get('worker_id') != uid:
                return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'})}
        
        # HR_V1 の template_data をマスク（ルールE）
        if item.get('template_id') == 'HR_V1' and not is_hr_admin:
            if 'template_data' in item:
                item['template_data'] = {'visibility': 'private', 'masked': True}
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(item, ensure_ascii=False)
        }
    
    except Exception as e:
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}

def _admin_409(headers, reason, message, **extra):
    """409 Conflict を reason 付きで返す（UI が必ず reason を見られるようにする）"""
    body = {'error': 'Conflict', 'reason': reason, 'message': message}
    body.update(extra)
    return {'statusCode': 409, 'headers': headers, 'body': json.dumps(body, ensure_ascii=False)}


def _handle_admin_work_reports_state_change(report_id, event, headers, user_info, is_hr_admin):
    """
    PATCH /admin/work-reports/{id}/state 状態遷移
    ルールC準拠: state machine の制約をチェック。409 は必ず reason を返す。
    """
    try:
        body = json.loads(event.get('body') or '{}')
        target_state = body.get('to')
        reason = body.get('reason', '')
        allowed_to = ['triaged', 'approved', 'rejected', 'archived']
        if target_state not in allowed_to:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'to must be one of: ' + ', '.join(allowed_to)})}
        
        if not target_state:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'to is required'})}
        
        resp = table.get_item(Key={'log_id': report_id})
        item = resp.get('Item')
        
        if not item:
            return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}
        
        current_state = item.get('state')
        version_now = item.get('version', 0)
        
        # ルールC: state machine チェック（409 は reason 必須）
        if current_state in ['approved', 'archived', 'canceled']:
            return _admin_409(headers, 'state_locked', f'Cannot change state from {current_state}', current_state=current_state)
        
        if target_state == 'triaged' and current_state != 'submitted':
            return _admin_409(headers, 'invalid_transition', f'Can only triage from submitted, current: {current_state}', current_state=current_state)
        
        if target_state in ['approved', 'rejected']:
            if current_state not in ['triaged', 'submitted']:
                return _admin_409(headers, 'invalid_transition', f'Can only approve/reject from triaged or submitted, current: {current_state}', current_state=current_state)
        
        if target_state == 'rejected' and not (reason or body.get('comment')):
            return _admin_409(headers, 'reason_required', 'reason is required for rejected')
        
        # 楽観ロック（version 指定があればチェック）
        provided_version = body.get('version')
        if provided_version is not None and int(provided_version) != int(version_now):
            return _admin_409(headers, 'version_mismatch', 'The report was updated by another process. Please refresh and try again.', expected_version=version_now, provided_version=int(provided_version))
        
        reason_val = reason or body.get('comment', '') or None
        now_iso = _get_jst_now().isoformat()
        history = item.get('history', [])
        history.append(_create_history_entry(
            history_type='state',
            by_user=user_info['uid'],
            from_state=current_state,
            to_state=target_state,
            reason=reason_val
        ))
        
        try:
            updated = table.update_item(
                Key={'log_id': report_id},
                UpdateExpression="SET #st=:st, history=:hist, updated_at=:at, version=version + :one",
                ConditionExpression="version = :v",
                ExpressionAttributeNames={'#st': 'state'},
                ExpressionAttributeValues={':st': target_state, ':hist': history, ':at': now_iso, ':one': 1, ':v': int(version_now)},
                ReturnValues="ALL_NEW"
            )
        except ClientError as e:
            if e.response.get('Error', {}).get('Code') == 'ConditionalCheckFailedException':
                latest = table.get_item(Key={'log_id': report_id}).get('Item') or {}
                latest_v = latest.get('version', version_now)
                return _admin_409(headers, 'version_mismatch', 'Conflict detected. Please refresh and try again.', expected_version=latest_v, provided_version=int(version_now))
            raise
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(updated['Attributes'], ensure_ascii=False)
        }
    
    except Exception as e:
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}

def _handle_admin_work_reports_bulk_state(event, headers, user_info, is_hr_admin):
    """
    POST /admin/work-reports/bulk/state 一括状態遷移
    部分成功を許容し、成功/失敗を返す
    """
    try:
        body = json.loads(event.get('body') or '{}')
        ids = body.get('ids', [])
        target_state = body.get('to')
        reason = body.get('reason', '')
        
        if not ids or not isinstance(ids, list):
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'ids array is required'})}
        
        if not target_state:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'to is required'})}
        
        if target_state == 'rejected' and not reason:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'reason is required for rejected'})}
        
        ok_ids = []
        ng = []
        
        for report_id in ids:
            try:
                resp = table.get_item(Key={'log_id': report_id})
                item = resp.get('Item')
                
                if not item:
                    ng.append({
                        'id': report_id,
                        'code': 'NOT_FOUND',
                        'message': 'Not found'
                    })
                    continue
                
                current_state = item.get('state')
                
                # state machine チェック
                if current_state in ['approved', 'archived', 'canceled']:
                    ng.append({
                        'id': report_id,
                        'code': 'INVALID_STATE_TRANSITION',
                        'message': f'Cannot change from {current_state}'
                    })
                    continue
                
                if target_state == 'triaged' and current_state != 'submitted':
                    ng.append({
                        'id': report_id,
                        'code': 'INVALID_STATE_TRANSITION',
                        'message': f'Can only triage from submitted, current: {current_state}'
                    })
                    continue
                
                if target_state in ['approved', 'rejected'] and current_state not in ['triaged', 'submitted']:
                    ng.append({
                        'id': report_id,
                        'code': 'INVALID_STATE_TRANSITION',
                        'message': f'Can only approve/reject from triaged or submitted, current: {current_state}'
                    })
                    continue
                
                # 状態遷移実行
                now_iso = _get_jst_now().isoformat()
                history = item.get('history', [])
                history.append(_create_history_entry(
                    history_type='state',
                    by_user=user_info['uid'],
                    from_state=current_state,
                    to_state=target_state,
                    reason=reason if reason else None
                ))
                
                table.update_item(
                    Key={'log_id': report_id},
                    UpdateExpression="SET #st=:st, history=:hist, updated_at=:at, version=version + :one",
                    ExpressionAttributeNames={'#st': 'state'},
                    ExpressionAttributeValues={':st': target_state, ':hist': history, ':at': now_iso, ':one': 1}
                )
                
                ok_ids.append(report_id)
            
            except Exception as e:
                ng.append({
                    'id': report_id,
                    'code': 'INTERNAL_ERROR',
                    'message': str(e)
                })
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'ok_ids': ok_ids,
                'ng': ng
            }, ensure_ascii=False)
        }
    
    except Exception as e:
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}

def _handle_admin_work_reports_export_pdf(report_id, headers, user_info, is_hr_admin):
    """
    POST /admin/work-reports/{id}/export/pdf PDF生成（清掃のみ）
    S3署名URLを返す
    """
    try:
        resp = table.get_item(Key={'log_id': report_id})
        item = resp.get('Item')
        
        if not item:
            return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}
        
        template_id = item.get('template_id')
        if template_id != 'CLEANING_PDF':
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'PDF export is only available for CLEANING_PDF template'})}
        
        # S3 key を生成
        s3_key = f"work-reports/{report_id}/export_{_get_jst_now().strftime('%Y%m%d_%H%M%S')}.pdf"
        # 業務報告専用バケット（WORK_REPORTS_BUCKET）があれば優先
        s3_bucket = os.environ.get('WORK_REPORTS_BUCKET') or os.environ.get('S3_BUCKET_NAME', 'misesapo-cleaning-manual-images')
        s3_region = os.environ.get('S3_REGION', 'ap-northeast-1')
        s3_client = boto3.client('s3', region_name=s3_region)
        
        # 最小限の PDF プレースホルダーを S3 に配置（オブジェクトがないと get 署名 URL でエラーになるため）
        pdf_placeholder = b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF'
        s3_client.put_object(
            Bucket=s3_bucket,
            Key=s3_key,
            Body=pdf_placeholder,
            ContentType='application/pdf'
        )
        
        # S3署名URL生成（1時間有効）
        pdf_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': s3_bucket, 'Key': s3_key},
            ExpiresIn=3600
        )
        
        # pdf_status を更新
        now_iso = _get_jst_now().isoformat()
        table.update_item(
            Key={'log_id': report_id},
            UpdateExpression="SET pdf_status=:status, pdf_s3_key=:key, updated_at=:at",
            ExpressionAttributeValues={
                ':status': 'generated',
                ':key': s3_key,
                ':at': now_iso
            }
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'pdf_s3_key': s3_key,
                'pdf_url': pdf_url,
                'pdf_status': 'generated'
            }, ensure_ascii=False)
        }
    
    except Exception as e:
        print(f"Error exporting PDF: {str(e)}")
        import traceback
        traceback.print_exc()
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}

def _handle_admin_work_reports_bulk_export_pdf(event, headers, user_info, is_hr_admin):
    """
    POST /admin/work-reports/bulk/export/pdf 一括PDF生成（清掃のみ）
    """
    try:
        body = json.loads(event.get('body') or '{}')
        ids = body.get('ids', [])
        
        if not ids or not isinstance(ids, list):
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'ids array is required'})}
        
        ok_ids = []
        ng = []
        pdf_urls = {}
        
        s3_bucket = os.environ.get('WORK_REPORTS_BUCKET') or os.environ.get('S3_BUCKET_NAME', 'misesapo-cleaning-manual-images')
        s3_region = os.environ.get('S3_REGION', 'ap-northeast-1')
        s3_client = boto3.client('s3', region_name=s3_region)
        
        for report_id in ids:
            try:
                resp = table.get_item(Key={'log_id': report_id})
                item = resp.get('Item')
                
                if not item:
                    ng.append({
                        'id': report_id,
                        'code': 'NOT_FOUND',
                        'message': 'Not found'
                    })
                    continue
                
                template_id = item.get('template_id')
                if template_id != 'CLEANING_PDF':
                    ng.append({
                        'id': report_id,
                        'code': 'INVALID_TEMPLATE',
                        'message': 'Only CLEANING_PDF template can be exported'
                    })
                    continue
                
                # PDF生成（簡易版: プレースホルダーを S3 に配置してから署名 URL を発行）
                s3_key = f"work-reports/{report_id}/export_{_get_jst_now().strftime('%Y%m%d_%H%M%S')}.pdf"
                now_iso = _get_jst_now().isoformat()
                pdf_placeholder = b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF'
                s3_client.put_object(
                    Bucket=s3_bucket,
                    Key=s3_key,
                    Body=pdf_placeholder,
                    ContentType='application/pdf'
                )
                pdf_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': s3_bucket, 'Key': s3_key},
                    ExpiresIn=3600
                )
                
                table.update_item(
                    Key={'log_id': report_id},
                    UpdateExpression="SET pdf_status=:status, pdf_s3_key=:key, updated_at=:at",
                    ExpressionAttributeValues={
                        ':status': 'generated',
                        ':key': s3_key,
                        ':at': now_iso
                    }
                )
                
                ok_ids.append(report_id)
                pdf_urls[report_id] = pdf_url
            
            except Exception as e:
                ng.append({
                    'id': report_id,
                    'code': 'INTERNAL_ERROR',
                    'message': str(e)
                })
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'ok_ids': ok_ids,
                'ng': ng,
                'pdf_urls': pdf_urls
            }, ensure_ascii=False)
        }
    
    except Exception as e:
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}
