import json
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from urllib.parse import unquote

import boto3
from boto3.dynamodb.conditions import Attr


HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}

ALLOWED_COLLECTIONS = {"torihikisaki", "yagou", "tenpo", "souko", "jinzai", "service", "kadai", "kanri_log", "keiyaku", "zaiko", "zaiko_hacchu", "admin_chat"}

PK_MAP = {
    "torihikisaki": "torihikisaki_id",
    "yagou": "yagou_id",
    "tenpo": "tenpo_id",
    "souko": "souko_id",
    "jinzai": "jinzai_id",
    "service": "service_id",
    "kadai": "kadai_id",
    "kanri_log": "kanri_log_id",
    "keiyaku": "keiyaku_id",
    "zaiko": "zaiko_id",
    "zaiko_hacchu": "hacchu_id",
    "admin_chat": "chat_id",
}

# 子テーブルの最低限親キー
REQUIRED_PARENT_KEYS = {
    "yagou": ["torihikisaki_id"],
    "tenpo": ["torihikisaki_id", "yagou_id"],
    "souko": ["tenpo_id"],
    "keiyaku": ["tenpo_id"],
}

ID_PREFIX = {
    "torihikisaki": "TORI",
    "yagou": "YAGOU",
    "tenpo": "TENPO",
    "souko": "SOUKO",
    "jinzai": "JINZAI",
    "service": "SERVICE",
    "kadai": "KADAI",
    "kanri_log": "KANRI",
    "keiyaku": "KEIYAKU",
    "zaiko": "ZAIKO",
    "zaiko_hacchu": "HACCHU",
    "admin_chat": "CHAT",
}

# 登録情報（取引先/屋号/店舗/倉庫）は連番採番にする。
# 例: TORI#0001, YAGOU#0001, TENPO#0001, SOUKO#0001
SEQUENTIAL_ID_COLLECTIONS = {"torihikisaki", "yagou", "tenpo", "souko"}

TABLE_MAP = {
    "torihikisaki": os.environ.get("TABLE_TORIHIKISAKI", "torihikisaki"),
    "yagou": os.environ.get("TABLE_YAGOU", "yagou"),
    "tenpo": os.environ.get("TABLE_TENPO", "tenpo"),
    "souko": os.environ.get("TABLE_SOUKO", "souko"),
    "jinzai": os.environ.get("TABLE_JINZAI", "jinzai"),
    "service": os.environ.get("TABLE_SERVICE", "service"),
    "kadai": os.environ.get("TABLE_KADAI", "kadai"),
    "kanri_log": os.environ.get("TABLE_KANRI_LOG", "kanri_log"),
    "keiyaku": os.environ.get("TABLE_KEIYAKU", "keiyaku"),
    "zaiko": os.environ.get("TABLE_ZAIKO", "zaiko"),
    "zaiko_hacchu": os.environ.get("TABLE_ZAIKO_HACCHU", "zaiko_hacchu"),
    "admin_chat": os.environ.get("TABLE_ADMIN_CHAT", "admin_chat"),
}

TENPO_KARTE_TABLE = os.environ.get("TABLE_TENPO_KARTE", "tenpo_karte")

dynamodb = boto3.resource("dynamodb")
TABLES = {k: dynamodb.Table(v) for k, v in TABLE_MAP.items()}
TENPO_KARTE = dynamodb.Table(TENPO_KARTE_TABLE)
s3 = boto3.client("s3")
STORAGE_BUCKET = os.environ.get("STORAGE_BUCKET", "")
CHAT_STORAGE_BUCKET = os.environ.get("CHAT_STORAGE_BUCKET", "").strip() or STORAGE_BUCKET


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _resp(status_code: int, body: dict):
    return {"statusCode": status_code, "headers": HEADERS, "body": json.dumps(_json_safe(body), ensure_ascii=False)}


def _json_safe(value):
    if isinstance(value, Decimal):
        # DynamoDB Number は Decimal で返るため、JSON化前に通常数値へ変換する
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


def _parse_body(event):
    raw = event.get("body")
    if not raw:
        return {}
    if event.get("isBase64Encoded"):
        raw = raw.decode("utf-8")
    return json.loads(raw)


def _collection_from_event(event):
    params = event.get("pathParameters") or {}
    collection = params.get("collection")
    if collection in ALLOWED_COLLECTIONS:
        return collection
    return None


def _record_id_from_event(event):
    params = event.get("pathParameters") or {}
    rid = params.get("id")
    return unquote(rid) if rid else None


def _is_conditional_check_failed(err: Exception) -> bool:
    code = ((getattr(err, "response", {}) or {}).get("Error", {}) or {}).get("Code", "")
    if code == "ConditionalCheckFailedException":
        return True
    msg = str(err or "")
    return "ConditionalCheckFailedException" in msg or "conditional request failed" in msg.lower()


def _scan_max_numeric_suffix(collection: str) -> int:
    table = TABLES[collection]
    pk_name = PK_MAP[collection]
    prefix = f"{ID_PREFIX[collection]}#"
    max_num = 0
    last_key = None
    while True:
        kwargs = {
            "ProjectionExpression": pk_name,
            "Limit": 1000,
        }
        if last_key:
            kwargs["ExclusiveStartKey"] = last_key
        res = table.scan(**kwargs)
        for row in (res.get("Items") or []):
            rid = str(row.get(pk_name) or "").strip()
            if not rid.startswith(prefix):
                continue
            suffix = rid[len(prefix):]
            if suffix.isdigit():
                n = int(suffix)
                if n > max_num:
                    max_num = n
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
    return max_num


def _scan_max_service_number() -> int:
    table = TABLES["service"]
    pk_name = PK_MAP["service"]
    max_num = 0
    last_key = None
    while True:
        kwargs = {
            "ProjectionExpression": pk_name,
            "Limit": 1000,
        }
        if last_key:
            kwargs["ExclusiveStartKey"] = last_key
        res = table.scan(**kwargs)
        for row in (res.get("Items") or []):
            rid = str(row.get(pk_name) or "").strip()
            # 正式フォーマット: service_0001
            lower = rid.lower()
            if lower.startswith("service_"):
                suffix = rid[len("service_"):]
                if suffix.isdigit():
                    n = int(suffix)
                    if n > max_num:
                        max_num = n
                continue
            # 旧/混在フォーマットに数字がある場合も拾って連番を維持
            if rid.startswith("SERVICE#"):
                suffix = rid[len("SERVICE#"):]
                if suffix.isdigit():
                    n = int(suffix)
                    if n > max_num:
                        max_num = n
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
    return max_num


def _make_service_id() -> str:
    next_num = _scan_max_service_number() + 1
    width = max(4, len(str(next_num)))
    return f"service_{str(next_num).zfill(width)}"


def _make_sequential_id(collection: str) -> str:
    next_num = _scan_max_numeric_suffix(collection) + 1
    width = max(4, len(str(next_num)))
    return f"{ID_PREFIX[collection]}#{str(next_num).zfill(width)}"


def _make_id(collection: str) -> str:
    if collection == "service":
        return _make_service_id()
    if collection in SEQUENTIAL_ID_COLLECTIONS:
        return _make_sequential_id(collection)
    return f"{ID_PREFIX[collection]}#{uuid.uuid4().hex[:12]}"


def _put_item_with_generated_id(collection: str, build_item_fn, max_retries: int = 8):
    table = TABLES[collection]
    pk_name = PK_MAP[collection]
    last_error = None
    for _ in range(max_retries):
        item_id = _make_id(collection)
        item = build_item_fn(item_id)
        try:
            table.put_item(
                Item=item,
                ConditionExpression=f"attribute_not_exists({pk_name})",
            )
            return item_id, item
        except Exception as e:
            if _is_conditional_check_failed(e):
                last_error = e
                continue
            raise
    raise RuntimeError(f"id generation conflict: {collection} ({str(last_error or '')})")


def _validate_create(collection: str, data: dict, pk_name: str):
    name = str(data.get("name") or "").strip()
    if not name:
        return "name は必須です"
    for parent_key in REQUIRED_PARENT_KEYS.get(collection, []):
        if not str(data.get(parent_key) or "").strip():
            return f"{parent_key} は必須です"
    if pk_name in data and not str(data.get(pk_name) or "").strip():
        return f"{pk_name} が不正です"
    if pk_name in data and str(data.get(pk_name) or "").strip() and collection in SEQUENTIAL_ID_COLLECTIONS:
        return f"{pk_name} の直接指定はできません"
    return None


def _sanitize_create_payload(collection: str, data: dict, pk_name: str):
    if not isinstance(data, dict):
        return {}
    out = dict(data)
    trim_keys = {"name", pk_name, "touroku_date", *REQUIRED_PARENT_KEYS.get(collection, [])}
    if collection in SEQUENTIAL_ID_COLLECTIONS:
        trim_keys.update({"phone", "email", "address", "url", "tantou_name", "jouhou_touroku_sha_name"})
    for k in trim_keys:
        if k in out and isinstance(out.get(k), str):
            out[k] = out[k].strip()
    return out


def _get_item_by_id(collection: str, record_id: str):
    rid = _strip(record_id)
    if not rid:
        return None
    pk_name = PK_MAP[collection]
    res = TABLES[collection].get_item(Key={pk_name: rid})
    return res.get("Item")


def _is_active_item(item: dict) -> bool:
    if not isinstance(item, dict):
        return False
    return _strip(item.get("jotai")) != "torikeshi"


def _validate_parent_relations(collection: str, data: dict):
    if not isinstance(data, dict):
        return None

    if collection == "yagou":
        tori_id = _strip(data.get("torihikisaki_id"))
        if tori_id:
            tori = _get_item_by_id("torihikisaki", tori_id)
            if not _is_active_item(tori):
                return "torihikisaki_id が存在しないか無効です"
        return None

    if collection == "tenpo":
        tori_id = _strip(data.get("torihikisaki_id"))
        yagou_id = _strip(data.get("yagou_id"))

        if tori_id:
            tori = _get_item_by_id("torihikisaki", tori_id)
            if not _is_active_item(tori):
                return "torihikisaki_id が存在しないか無効です"

        if yagou_id:
            yagou = _get_item_by_id("yagou", yagou_id)
            if not _is_active_item(yagou):
                return "yagou_id が存在しないか無効です"
            yagou_tori_id = _strip(yagou.get("torihikisaki_id"))
            if tori_id and yagou_tori_id and yagou_tori_id != tori_id:
                return "yagou_id と torihikisaki_id の組み合わせが不正です"
        return None

    if collection in {"souko", "keiyaku"}:
        tenpo_id = _strip(data.get("tenpo_id"))
        if tenpo_id:
            tenpo = _get_item_by_id("tenpo", tenpo_id)
            if not _is_active_item(tenpo):
                return "tenpo_id が存在しないか無効です"
        return None

    return None


def _exists_active_name(collection: str, name: str, parent_values=None) -> bool:
    target = str(name or "").strip()
    if not target:
        return False
    expr = Attr("jotai").eq("yuko") & Attr("name").eq(target)
    for k, v in (parent_values or {}).items():
        sv = str(v or "").strip()
        if sv:
            expr = expr & Attr(k).eq(sv)

    table = TABLES[collection]
    pk_name = PK_MAP[collection]
    last_key = None
    while True:
        kwargs = {
            "FilterExpression": expr,
            "ProjectionExpression": pk_name,
            "Limit": 200,
        }
        if last_key:
            kwargs["ExclusiveStartKey"] = last_key
        res = table.scan(**kwargs)
        items = res.get("Items") or []
        if items:
            return True
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
    return False


def _build_filter(collection: str, q: dict):
    expr = None
    jotai = q.get("jotai", "yuko")
    if jotai:
        expr = Attr("jotai").eq(jotai)

    if collection == "service":
        category = q.get("category")
        if category:
            c_expr = Attr("category").eq(category)
            expr = c_expr if expr is None else expr & c_expr

    if collection in {"kadai", "kanri_log"}:
        for k in ["category", "status", "source", "priority", "list_scope", "log_type", "reported_by", "torihikisaki_id", "yagou_id", "tenpo_id", "jinzai_id"]:
            v = q.get(k)
            if v:
                k_expr = Attr(k).eq(v)
                expr = k_expr if expr is None else expr & k_expr

    if collection == "keiyaku":
        for k in ["status", "contract_type", "source", "torihikisaki_id", "yagou_id", "tenpo_id", "yakusoku_id", "keiyaku_kind"]:
            v = q.get(k)
            if v:
                k_expr = Attr(k).eq(v)
                expr = k_expr if expr is None else expr & k_expr

    if collection == "zaiko":
        for k in ["category", "supplier_name"]:
            v = q.get(k)
            if v:
                k_expr = Attr(k).eq(v)
                expr = k_expr if expr is None else expr & k_expr

    if collection == "zaiko_hacchu":
        for k in ["status", "zaiko_id", "supplier_name", "ordered_by"]:
            v = q.get(k)
            if v:
                k_expr = Attr(k).eq(v)
                expr = k_expr if expr is None else expr & k_expr

    if collection == "admin_chat":
        for k in ["room", "sender_id", "source"]:
            v = q.get(k)
            if v:
                k_expr = Attr(k).eq(v)
                expr = k_expr if expr is None else expr & k_expr

    for key in REQUIRED_PARENT_KEYS.get(collection, []):
        value = q.get(key)
        if value:
            key_expr = Attr(key).eq(value)
            expr = key_expr if expr is None else expr & key_expr
    return expr


def _safe_file_name(name: str) -> str:
    return (name or "file.bin").replace("/", "_").replace("\\", "_").strip() or "file.bin"


def _presign_upload_souko(body: dict):
    if not STORAGE_BUCKET:
        return None, _resp(500, {"error": "storage_bucket_not_configured"})

    tenpo_id = body.get("tenpo_id")
    if not tenpo_id:
        return None, _resp(400, {"error": "validation_error", "message": "tenpo_id は必須です"})

    file_name = _safe_file_name(body.get("file_name", "file.bin"))
    content_type = body.get("content_type", "application/octet-stream")
    key = f"souko/{tenpo_id}/{uuid.uuid4().hex}_{file_name}"
    expires_in = int(body.get("expires_in", 900))
    expires_in = min(max(expires_in, 60), 3600)

    put_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": STORAGE_BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=expires_in,
    )
    get_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": STORAGE_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )
    return {
        "bucket": STORAGE_BUCKET,
        "key": key,
        "content_type": content_type,
        "expires_in": expires_in,
        "put_url": put_url,
        "get_url": get_url,
    }, None


def _presign_upload_admin_chat(body: dict):
    bucket = CHAT_STORAGE_BUCKET
    if not bucket:
        return None, _resp(500, {"error": "chat_storage_bucket_not_configured"})

    room = _strip(body.get("room")) or "common_header"
    file_name = _safe_file_name(body.get("file_name", "file.bin"))
    content_type = body.get("content_type", "application/octet-stream")
    key = f"admin_chat/{room}/{datetime.now(timezone.utc).strftime('%Y/%m')}/{uuid.uuid4().hex}_{file_name}"
    expires_in = int(body.get("expires_in", 900))
    expires_in = min(max(expires_in, 60), 3600)

    put_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=expires_in,
    )
    get_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
    )
    return {
        "bucket": bucket,
        "key": key,
        "content_type": content_type,
        "expires_in": expires_in,
        "put_url": put_url,
        "get_url": get_url,
    }, None


def _enrich_admin_chat_items(items: list):
    if not isinstance(items, list):
        return items
    out = []
    for src in items:
        row = dict(src or {})
        attachments = row.get("attachments")
        if isinstance(attachments, list):
            enriched_attachments = []
            for a in attachments:
                if not isinstance(a, dict):
                    continue
                att = dict(a)
                key_multi = _strip(att.get("key"))
                bucket_multi = _strip(att.get("bucket")) or CHAT_STORAGE_BUCKET
                if key_multi and bucket_multi:
                    try:
                        att["url"] = s3.generate_presigned_url(
                            "get_object",
                            Params={"Bucket": bucket_multi, "Key": key_multi},
                            ExpiresIn=3600,
                        )
                    except Exception as e:
                        print(f"[admin_chat] attachment presign failed key={key_multi} err={str(e)}")
                enriched_attachments.append(att)
            row["attachments"] = enriched_attachments

        key = _strip(row.get("attachment_key"))
        if key:
            bucket = _strip(row.get("attachment_bucket")) or CHAT_STORAGE_BUCKET
            if bucket:
                try:
                    row["attachment_url"] = s3.generate_presigned_url(
                        "get_object",
                        Params={"Bucket": bucket, "Key": key},
                        ExpiresIn=3600,
                    )
                except Exception as e:
                    print(f"[admin_chat] attachment presign failed key={key} err={str(e)}")
        out.append(row)
    return out


def _strip(v):
    return str(v or "").strip()


def _apply_touroku_meta(item: dict, now_iso: str):
    if not isinstance(item, dict):
        return item
    touroku_at = _strip(item.get("touroku_at")) or now_iso
    item["touroku_at"] = touroku_at
    if not _strip(item.get("touroku_date")):
        item["touroku_date"] = touroku_at[:10]
    return item


def _normalize_tenpo_billing_owner(item: dict):
    """
    tenpo の請求主体（= クレジット/与信の owner）を正規化する。
    - デフォルト: torihikisaki を主体
    - 個人店などで屋号主体にしたい場合のみ yagou を主体に切替（管理のみ想定）
    """
    if not isinstance(item, dict):
        return item
    torihikisaki_id = item.get("torihikisaki_id")
    yagou_id = item.get("yagou_id")

    kind = (item.get("billing_owner_kind") or "").strip()
    owner_id = (item.get("billing_owner_id") or "").strip()

    if kind not in {"torihikisaki", "yagou"}:
        kind = "torihikisaki"

    if kind == "torihikisaki":
        if not owner_id and torihikisaki_id:
            owner_id = torihikisaki_id
    elif kind == "yagou":
        if not owner_id and yagou_id:
            owner_id = yagou_id

    item["billing_owner_kind"] = kind
    if owner_id:
        item["billing_owner_id"] = owner_id
    return item


def _rollback_torikeshi(created_stack):
    # created_stack: [(collection, id), ...]
    for collection, record_id in reversed(created_stack):
        try:
            pk = PK_MAP.get(collection)
            if not pk:
                continue
            TABLES[collection].update_item(
                Key={pk: record_id},
                UpdateExpression="SET jotai = :torikeshi, updated_at = :u",
                ExpressionAttributeValues={":torikeshi": "torikeshi", ":u": _now_iso()},
            )
        except Exception as e:
            print(f"[rollback] failed {collection}:{record_id} {str(e)}")


def _find_onboarding_by_idempotency(idempotency_key: str):
    if not idempotency_key:
        return None
    # NOTE:
    # Scan + FilterExpression で Limit=1 を使うと、
    # 「評価した先頭1件」が不一致の場合に一致を見逃してしまう。
    # idempotency は必ず一致が見つかるまでページングして探索する。
    tenpo = None
    last_key = None
    while True:
        kwargs = {
            "ConsistentRead": True,
            "FilterExpression": Attr("idempotency_key").eq(idempotency_key),
            "Limit": 200,
        }
        if last_key:
            kwargs["ExclusiveStartKey"] = last_key
        res = TABLES["tenpo"].scan(**kwargs)
        items = res.get("Items") or []
        if items:
            tenpo = items[0]
            break
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
    if not tenpo:
        return None
    tenpo_id = tenpo.get("tenpo_id")
    karte = None
    if tenpo_id:
        k_last = None
        while True:
            k_kwargs = {
                "ConsistentRead": True,
                "FilterExpression": Attr("tenpo_id").eq(tenpo_id),
                "Limit": 200,
            }
            if k_last:
                k_kwargs["ExclusiveStartKey"] = k_last
            kres = TENPO_KARTE.scan(**k_kwargs)
            kitems = kres.get("Items") or []
            if kitems:
                karte = kitems[0]
                break
            k_last = kres.get("LastEvaluatedKey")
            if not k_last:
                break
    return {
        "torihikisaki_id": tenpo.get("torihikisaki_id"),
        "yagou_id": tenpo.get("yagou_id"),
        "tenpo_id": tenpo_id,
        "karte_id": (karte or {}).get("karte_id"),
        "idempotency_key": idempotency_key,
        "idempotent": True,
    }


def _create_onboarding(body: dict):
    torihikisaki_name = _strip(body.get("torihikisaki_name"))
    yagou_name = _strip(body.get("yagou_name"))
    tenpo_name = _strip(body.get("tenpo_name"))
    if not torihikisaki_name:
        return _resp(400, {"error": "validation_error", "message": "torihikisaki_name は必須です"})
    if not yagou_name:
        # 屋号未入力時は取引先名を継承（取引先直下運用の互換）
        yagou_name = torihikisaki_name
    if not tenpo_name:
        # 店舗未入力時は屋号名を継承
        tenpo_name = yagou_name

    idempotency_key = _strip(body.get("idempotency_key"))
    if idempotency_key:
        hit = _find_onboarding_by_idempotency(idempotency_key)
        if hit:
            return _resp(200, hit)

    contact_phone = _strip(body.get("phone"))
    contact_email = _strip(body.get("email"))
    tantou_name = _strip(body.get("tantou_name"))
    address = _strip(body.get("address"))
    site_url = _strip(body.get("url"))
    info_registrar = _strip(body.get("jouhou_touroku_sha_name"))
    touroku_date = _strip(body.get("touroku_date"))
    # カルテは常時自動作成（登録時点で tenpo_karte を必ず作る）
    create_karte = True
    now = _now_iso()
    if not touroku_date:
        touroku_date = now[:10]
    created = []
    try:
        def _build_tori(new_id: str):
            item = {
                "torihikisaki_id": new_id,
                "name": torihikisaki_name,
                "touroku_date": touroku_date,
                "touroku_at": now,
                "jotai": "yuko",
                "created_at": now,
                "updated_at": now,
            }
            if contact_phone:
                item["phone"] = contact_phone
            if contact_email:
                item["email"] = contact_email
            if tantou_name:
                item["tantou_name"] = tantou_name
            if address:
                item["address"] = address
            if site_url:
                item["url"] = site_url
            if info_registrar:
                item["jouhou_touroku_sha_name"] = info_registrar
            return item

        torihikisaki_id, _ = _put_item_with_generated_id("torihikisaki", _build_tori)
        created.append(("torihikisaki", torihikisaki_id))

        def _build_yagou(new_id: str):
            return {
                "yagou_id": new_id,
                "torihikisaki_id": torihikisaki_id,
                "name": yagou_name,
                "touroku_date": touroku_date,
                "touroku_at": now,
                "jotai": "yuko",
                "created_at": now,
                "updated_at": now,
            }

        yagou_id, _ = _put_item_with_generated_id("yagou", _build_yagou)
        created.append(("yagou", yagou_id))

        karte_detail = {
            "basic": {
                "torihikisaki_name": torihikisaki_name,
                "yagou_name": yagou_name,
                "tenpo_name": tenpo_name,
                "phone": contact_phone,
                "email": contact_email,
                "tantou_name": tantou_name,
                "address": address,
                "url": site_url,
                "jouhou_touroku_sha_name": info_registrar,
                "touroku_date": touroku_date,
            },
            "created_at": now,
            "updated_at": now,
        }
        def _build_tenpo(new_id: str):
            item = {
                "tenpo_id": new_id,
                "torihikisaki_id": torihikisaki_id,
                "yagou_id": yagou_id,
                "name": tenpo_name,
                "touroku_date": touroku_date,
                "touroku_at": now,
                "jotai": "yuko",
                "created_at": now,
                "updated_at": now,
                "karte_detail": karte_detail,
            }
            # 請求主体（デフォルトは torihikisaki 主体）
            _normalize_tenpo_billing_owner(item)
            if contact_phone:
                item["phone"] = contact_phone
            if contact_email:
                item["email"] = contact_email
            if tantou_name:
                item["tantou_name"] = tantou_name
            if address:
                item["address"] = address
            if site_url:
                item["url"] = site_url
            if info_registrar:
                item["jouhou_touroku_sha_name"] = info_registrar
            if idempotency_key:
                item["idempotency_key"] = idempotency_key
            return item

        tenpo_id, _ = _put_item_with_generated_id("tenpo", _build_tenpo)
        created.append(("tenpo", tenpo_id))

        # 既存運用互換: souko 自動作成
        def _build_souko(new_id: str):
            return {
                "souko_id": new_id,
                "tenpo_id": tenpo_id,
                "name": f"{tenpo_name} 顧客ストレージ",
                "touroku_date": touroku_date,
                "touroku_at": now,
                "jotai": "yuko",
                "created_at": now,
                "updated_at": now,
            }

        souko_id, _ = _put_item_with_generated_id("souko", _build_souko)
        created.append(("souko", souko_id))

        karte_id = None
        if create_karte:
            karte_id = f"KARTE#{tenpo_id}"
            karte_item = {
                "karte_id": karte_id,
                "tenpo_id": tenpo_id,
                "torihikisaki_id": torihikisaki_id,
                "yagou_id": yagou_id,
                "name": f"{yagou_name} {tenpo_name} カルテ",
                "touroku_date": touroku_date,
                "touroku_at": now,
                "jotai": "yuko",
                "created_at": now,
                "updated_at": now,
                "karte_detail": karte_detail,
            }
            if idempotency_key:
                karte_item["idempotency_key"] = idempotency_key
            TENPO_KARTE.put_item(
                Item=karte_item,
                ConditionExpression="attribute_not_exists(karte_id)",
            )

        return _resp(201, {
            "torihikisaki_id": torihikisaki_id,
            "yagou_id": yagou_id,
            "tenpo_id": tenpo_id,
            "karte_id": karte_id,
            "idempotency_key": idempotency_key or None,
            "idempotent": False,
        })
    except Exception as e:
        _rollback_torikeshi(created)
        return _resp(500, {"error": "onboarding_failed", "message": str(e)})


def lambda_handler(event, context):
    try:
        method = event.get("httpMethod", "")
        if method == "OPTIONS":
            return _resp(200, {"ok": True})

        path = event.get("path") or ""
        if path.endswith("/test") or path == "/test":
            return _resp(200, {"ok": True, "path": path})

        # 単一API: 顧客オンボーディング（torihikisaki→yagou→tenpo＋任意karte）
        if method == "POST" and path.endswith("/master/tenpo/onboarding"):
            body = _parse_body(event)
            return _create_onboarding(body)

        collection = _collection_from_event(event)
        if not collection:
            return _resp(400, {"error": "invalid_collection", "allowed": sorted(list(ALLOWED_COLLECTIONS))})

        table = TABLES[collection]
        pk_name = PK_MAP[collection]
        record_id = _record_id_from_event(event)

        if method == "GET":
            if record_id:
                res = table.get_item(Key={pk_name: record_id})
                item = res.get("Item")
                if not item:
                    return _resp(404, {"error": "not_found"})
                return _resp(200, item)

            q = event.get("queryStringParameters") or {}
            # Client 指定の limit は「返却件数」の上限として扱う。
            # DynamoDB Scan の Limit は「評価した件数」で、FilterExpression 後の返却件数ではないため、
            # そのまま渡すと `limit=3` などで “当たりが入ってない3件を評価→0件” が起こりうる。
            limit = int(q.get("limit", "100"))
            limit = min(max(limit, 1), 20000)
            filter_expr = _build_filter(collection, q)
            scan_kwargs = {}
            if filter_expr is not None:
                scan_kwargs["FilterExpression"] = filter_expr

            # 評価件数の上限（1ページあたり）。少なくとも 1000 くらい評価しないとフィルタが当たらないケースがある。
            # テーブルが巨大化したら GSI/Query に寄せる前提。
            eval_limit = 1000

            items = []
            last_key = None
            while True:
                page_kwargs = dict(scan_kwargs)
                page_kwargs["Limit"] = eval_limit
                if last_key:
                    page_kwargs["ExclusiveStartKey"] = last_key

                res = table.scan(**page_kwargs)
                page_items = res.get("Items", []) or []
                items.extend(page_items)
                if len(items) >= limit:
                    items = items[:limit]
                    break
                last_key = res.get("LastEvaluatedKey")
                if not last_key:
                    break

            if collection == "admin_chat":
                items = _enrich_admin_chat_items(items)
            return _resp(200, {"items": items, "count": len(items)})

        if method == "POST":
            body = _parse_body(event)
            body = _sanitize_create_payload(collection, body, pk_name)

            # API Gateway のメソッド構成差異に備え、
            # /master/tenpo + { mode: "onboarding" } でも同じ処理を受け付ける。
            if collection == "tenpo" and str(body.get("mode", "")).lower() == "onboarding":
                return _create_onboarding(body)

            # 既存ゲートを増やさずに、/master/souko から presign を発行する
            if collection == "souko" and body.get("mode") == "presign_upload":
                payload, err_resp = _presign_upload_souko(body)
                if err_resp:
                    return err_resp
                return _resp(200, payload)

            if collection == "admin_chat" and body.get("mode") == "presign_upload":
                payload, err_resp = _presign_upload_admin_chat(body)
                if err_resp:
                    return err_resp
                return _resp(200, payload)

            err = _validate_create(collection, body, pk_name)
            if err:
                return _resp(400, {"error": "validation_error", "message": err})
            parent_err = _validate_parent_relations(collection, body)
            if parent_err:
                return _resp(400, {"error": "validation_error", "message": parent_err})

            if collection in {"torihikisaki", "yagou", "tenpo"}:
                parent_values = {k: body.get(k) for k in REQUIRED_PARENT_KEYS.get(collection, [])}
                if _exists_active_name(collection, body.get("name"), parent_values):
                    return _resp(409, {
                        "error": "duplicate_name",
                        "message": "同名データが既に存在します",
                    })
            now = _now_iso()
            if collection in {"torihikisaki", "yagou", "tenpo", "souko", "keiyaku"} and not _strip(body.get("touroku_date")):
                body = dict(body)
                body["touroku_date"] = now[:10]
            fixed_id = body.get(pk_name)
            if fixed_id:
                item = dict(body)
                item[pk_name] = fixed_id
                item["jotai"] = body.get("jotai", "yuko")
                item["created_at"] = now
                item["updated_at"] = now
                _apply_touroku_meta(item, now)
                if collection == "tenpo":
                    _normalize_tenpo_billing_owner(item)
                table.put_item(
                    Item=item,
                    ConditionExpression=f"attribute_not_exists({pk_name})",
                )
                return _resp(201, item)

            def _build_item(new_id: str):
                item = dict(body)
                item[pk_name] = new_id
                item["jotai"] = body.get("jotai", "yuko")
                item["created_at"] = now
                item["updated_at"] = now
                _apply_touroku_meta(item, now)
                if collection == "tenpo":
                    _normalize_tenpo_billing_owner(item)
                return item

            _, item = _put_item_with_generated_id(collection, _build_item)
            return _resp(201, item)

        if method == "PUT":
            if not record_id:
                return _resp(400, {"error": "missing_id"})
            body = _parse_body(event)
            res = table.get_item(Key={pk_name: record_id})
            item = res.get("Item")
            if not item:
                return _resp(404, {"error": "not_found"})
            for k, v in body.items():
                if k in {pk_name, "created_at"}:
                    continue
                item[k] = v
            parent_keys = REQUIRED_PARENT_KEYS.get(collection, [])
            if any(k in body for k in parent_keys):
                parent_err = _validate_parent_relations(collection, item)
                if parent_err:
                    return _resp(400, {"error": "validation_error", "message": parent_err})
            now = _now_iso()
            item["updated_at"] = now
            _apply_touroku_meta(item, now)
            if collection == "tenpo":
                _normalize_tenpo_billing_owner(item)
            table.put_item(Item=item)
            return _resp(200, item)

        if method == "DELETE":
            if not record_id:
                return _resp(400, {"error": "missing_id"})
            now = _now_iso()
            table.update_item(
                Key={pk_name: record_id},
                UpdateExpression="SET jotai = :torikeshi, updated_at = :u",
                ExpressionAttributeValues={":torikeshi": "torikeshi", ":u": now},
            )
            return _resp(200, {"ok": True, "id": record_id, "jotai": "torikeshi"})

        return _resp(405, {"error": "method_not_allowed"})
    except Exception as e:
        print(f"[torihikisaki-data] error: {str(e)}")
        return _resp(500, {"error": "internal_error", "message": str(e)})
