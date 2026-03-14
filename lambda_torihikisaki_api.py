import json
import os
import base64
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from urllib.parse import unquote
from urllib import request as urllib_request
from urllib import error as urllib_error

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.config import Config


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
AWS_REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
s3 = boto3.client(
    "s3",
    region_name=AWS_REGION,
    config=Config(
        signature_version="s3v4",
        s3={"addressing_style": "virtual"},
    ),
)
STORAGE_BUCKET = os.environ.get("STORAGE_BUCKET", "")
CHAT_STORAGE_BUCKET = os.environ.get("CHAT_STORAGE_BUCKET", "").strip() or STORAGE_BUCKET
FILEBOX_SOUKO_SOURCE = "admin_filebox"
FILEBOX_SOUKO_TENPO_ID = "filebox_company"
translate_client = boto3.client("translate", region_name=AWS_REGION)

GOOGLE_AI_MODEL = os.environ.get("GOOGLE_AI_MODEL", "gemini-2.0-flash").strip() or "gemini-2.0-flash"
GOOGLE_AI_API_KEY = os.environ.get("GOOGLE_AI_API_KEY", "").strip()
CUSTOMER_CHAT_AI_ENABLED_RAW = str(os.environ.get("CUSTOMER_CHAT_AI_ENABLED", "true")).strip().lower()
CUSTOMER_CHAT_AI_ENABLED = CUSTOMER_CHAT_AI_ENABLED_RAW not in {"0", "false", "off", "disabled"}
try:
    CUSTOMER_CHAT_OPERATOR_START_HOUR = int(str(os.environ.get("CUSTOMER_CHAT_OPERATOR_START_HOUR", "9")).strip() or "9")
except Exception:
    CUSTOMER_CHAT_OPERATOR_START_HOUR = 9
try:
    CUSTOMER_CHAT_OPERATOR_END_HOUR = int(str(os.environ.get("CUSTOMER_CHAT_OPERATOR_END_HOUR", "18")).strip() or "18")
except Exception:
    CUSTOMER_CHAT_OPERATOR_END_HOUR = 18

CUSTOMER_CHAT_RESTRICTED_KEYWORDS = [
    "契約",
    "契約書",
    "約款",
    "規約",
    "料金",
    "金額",
    "見積",
    "請求",
    "領収",
    "支払",
    "値引",
    "返金",
    "違約",
    "補償",
    "賠償",
    "責任",
    "保証",
    "法務",
    "違法",
    "訴訟",
    "判断",
    "確約",
    "承認",
    "合意",
]
CUSTOMER_CHAT_RESTRICTED_REPLY = "ご質問ありがとうございます。契約・金額・判断が必要な内容はAIでは確定回答できません。担当者が確認のうえご連絡いたします。"


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


def _get_headers(event):
    headers = event.get("headers") or {}
    return headers if isinstance(headers, dict) else {}


def _get_auth_header(event):
    headers = _get_headers(event)
    return headers.get("Authorization") or headers.get("authorization") or ""


def _decode_jwt_payload(token: str) -> dict:
    if not token:
        return {}
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        payload_part = parts[1]
        padding = 4 - (len(payload_part) % 4)
        if padding != 4:
            payload_part += "=" * padding
        payload_json = base64.urlsafe_b64decode(payload_part.encode("utf-8"))
        payload = json.loads(payload_json.decode("utf-8"))
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def _norm_identity(value) -> str:
    return _strip(value).lower()


def _norm_match_token(value) -> str:
    return "".join(_strip(value).lower().split())


def _extract_actor(event) -> dict:
    request_context = event.get("requestContext") or {}
    authorizer = request_context.get("authorizer") or {}
    claims = authorizer.get("claims") if isinstance(authorizer, dict) else {}
    if not isinstance(claims, dict):
        claims = {}

    token = _get_auth_header(event)
    token = token.replace("Bearer ", "").strip() if token else ""
    token_claims = _decode_jwt_payload(token)

    def _pick(*values):
        for v in values:
            sv = _strip(v)
            if sv:
                return sv
        return ""

    actor_id = _pick(
        claims.get("custom:worker_id"),
        claims.get("worker_id"),
        authorizer.get("workerId") if isinstance(authorizer, dict) else None,
        authorizer.get("worker_id") if isinstance(authorizer, dict) else None,
        claims.get("sub"),
        claims.get("cognito:username"),
        authorizer.get("principalId") if isinstance(authorizer, dict) else None,
        token_claims.get("custom:worker_id"),
        token_claims.get("worker_id"),
        token_claims.get("sub"),
        token_claims.get("cognito:username"),
        claims.get("email"),
        token_claims.get("email"),
    )
    actor_name = _pick(
        claims.get("name"),
        claims.get("preferred_username"),
        token_claims.get("name"),
        token_claims.get("preferred_username"),
        claims.get("email"),
        token_claims.get("email"),
    )

    ids = set()
    tokens = set()
    for v in [
        actor_id,
        actor_name,
        claims.get("email"),
        token_claims.get("email"),
        claims.get("sub"),
        token_claims.get("sub"),
        claims.get("cognito:username"),
        token_claims.get("cognito:username"),
        claims.get("custom:worker_id"),
        token_claims.get("custom:worker_id"),
        claims.get("worker_id"),
        token_claims.get("worker_id"),
    ]:
        sv = _strip(v)
        if not sv:
            continue
        ids.add(_norm_identity(sv))
        token = _norm_match_token(sv)
        if token:
            tokens.add(token)
        if "@" in sv:
            local = _norm_identity(sv.split("@")[0])
            ids.add(local)
            local_token = _norm_match_token(local)
            if local_token:
                tokens.add(local_token)

    if not actor_name and actor_id:
        actor_name = actor_id.split("@")[0] if "@" in actor_id else actor_id

    return {"id": actor_id, "name": actor_name, "ids": ids, "tokens": tokens}


def _is_admin_filebox_item(item: dict) -> bool:
    if not isinstance(item, dict):
        return False
    return (
        _strip(item.get("source")) == FILEBOX_SOUKO_SOURCE
        and _strip(item.get("tenpo_id")) == FILEBOX_SOUKO_TENPO_ID
    )


def _is_souko_owner(event, item: dict) -> bool:
    if not _is_admin_filebox_item(item):
        return True

    actor = _extract_actor(event)
    actor_ids = actor.get("ids") or set()
    actor_tokens = actor.get("tokens") or set()
    if not actor_ids and not actor_tokens:
        # 開発環境などで authorizer 情報が無い場合は互換性優先
        return True

    owner_ids = set()
    owner_tokens = set()
    sender_ids = set()
    sender_tokens = set()
    owner_sources = [
        item.get("owner_user_id"),
        item.get("owner_name"),
        item.get("owner_key"),
    ]
    if not any(_strip(v) for v in owner_sources):
        # 旧データ互換: owner_* が無いレコードは作成者一致で判定
        owner_sources.extend([item.get("uploaded_by"), item.get("uploaded_by_name")])

    for v in owner_sources:
        sv = _strip(v)
        if not sv:
            continue
        owner_ids.add(_norm_identity(sv))
        token = _norm_match_token(sv)
        if token:
            owner_tokens.add(token)
        if "@" in sv:
            local = _norm_identity(sv.split("@")[0])
            owner_ids.add(local)
            local_token = _norm_match_token(local)
            if local_token:
                owner_tokens.add(local_token)

    sender_sources = [
        item.get("uploaded_by"),
        item.get("uploaded_by_name"),
        item.get("request_sender_id"),
        item.get("request_sender_name"),
        item.get("request_sender_key"),
    ]
    for v in sender_sources:
        sv = _strip(v)
        if not sv:
            continue
        sender_ids.add(_norm_identity(sv))
        token = _norm_match_token(sv)
        if token:
            sender_tokens.add(token)
        if "@" in sv:
            local = _norm_identity(sv.split("@")[0])
            sender_ids.add(local)
            local_token = _norm_match_token(local)
            if local_token:
                sender_tokens.add(local_token)

    if owner_ids & actor_ids:
        return True
    if owner_tokens & actor_tokens:
        return True
    if sender_ids & actor_ids:
        return True
    if sender_tokens & actor_tokens:
        return True
    return False


def _is_admin_chat_owner(event, item: dict) -> bool:
    actor = _extract_actor(event)
    actor_ids = actor.get("ids") or set()
    if not actor_ids:
        # 開発環境などで authorizer 情報が無い場合は互換性優先
        return True

    owner_ids = set()
    for v in [
        item.get("sender_id"),
        item.get("created_by"),
        item.get("updated_by"),
        item.get("sender_name"),
        item.get("sender_display_name"),
        item.get("created_by_name"),
        item.get("updated_by_name"),
    ]:
        sv = _strip(v)
        if not sv:
            continue
        owner_ids.add(_norm_identity(sv))
        if "@" in sv:
            owner_ids.add(_norm_identity(sv.split("@")[0]))

    if not owner_ids:
        return True
    return len(actor_ids.intersection(owner_ids)) > 0


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
        source = _strip(data.get("source"))
        # 会社共通ファイルボックスは擬似 tenpo_id で運用する。
        if (
            collection == "souko"
            and tenpo_id == FILEBOX_SOUKO_TENPO_ID
            and source == FILEBOX_SOUKO_SOURCE
        ):
            return None
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

    if collection == "souko":
        for k in ["source", "folder_id", "uploaded_by", "owner_user_id", "owner_name", "owner_key"]:
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


def _normalize_lang_code(lang: str, default_value: str) -> str:
    raw = _strip(lang).lower()
    if not raw:
        return default_value
    if raw in {"auto", "ja", "pt", "en"}:
        return raw
    if raw in {"pt-br", "pt_br", "ptbr"}:
        return "pt"
    return default_value


def _translate_admin_chat_text(body: dict):
    text = str(body.get("text") or "")
    if not text.strip():
        return {
            "translated_text": "",
            "source_language": "auto",
            "target_language": _normalize_lang_code(body.get("target_lang"), "ja"),
        }, None


def _jst_hour_now() -> int:
    try:
        jst_now = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=9)))
        return int(jst_now.hour)
    except Exception:
        return int(datetime.now().hour)


def _is_within_operator_support_hours() -> bool:
    hour = _jst_hour_now()
    start = CUSTOMER_CHAT_OPERATOR_START_HOUR if isinstance(CUSTOMER_CHAT_OPERATOR_START_HOUR, int) else 9
    end = CUSTOMER_CHAT_OPERATOR_END_HOUR if isinstance(CUSTOMER_CHAT_OPERATOR_END_HOUR, int) else 18
    return hour >= start and hour < end


def _detect_restricted_customer_inquiry(text: str):
    raw = _strip(text).lower()
    if not raw:
        return []
    reasons = []
    for kw in CUSTOMER_CHAT_RESTRICTED_KEYWORDS:
        if kw and kw.lower() in raw:
            reasons.append(kw)
    return reasons


def _build_recent_history_text(recent_messages):
    rows = recent_messages if isinstance(recent_messages, list) else []
    lines = []
    for src in rows[-6:]:
        if not isinstance(src, dict):
            continue
        sender_role = _strip(src.get("sender_role") or src.get("senderRole")).lower()
        role = "お客様" if sender_role == "customer" else "担当者"
        text = _strip(src.get("text"))[:220]
        if text:
            lines.append(f"{role}: {text}")
    return "\n".join(lines)


def _parse_gemini_text(payload: dict) -> str:
    try:
        candidates = payload.get("candidates") if isinstance(payload, dict) else None
        first = candidates[0] if isinstance(candidates, list) and candidates else {}
        content = first.get("content") if isinstance(first, dict) else {}
        parts = content.get("parts") if isinstance(content, dict) else []
        if not isinstance(parts, list):
            return ""
        out = []
        for p in parts:
            if isinstance(p, dict):
                out.append(str(p.get("text") or ""))
        return "".join(out).replace("\r", "").strip()
    except Exception:
        return ""


def _request_gemini_customer_reply(user_message: str, store_label: str = "", recent_messages=None) -> str:
    if not GOOGLE_AI_API_KEY:
        raise RuntimeError("Google AI APIキーが未設定です（GOOGLE_AI_API_KEY）。")

    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GOOGLE_AI_MODEL}:generateContent?key={GOOGLE_AI_API_KEY}"
    )
    history_text = _build_recent_history_text(recent_messages)
    prompt_text = "\n\n".join(
        [
            f"店舗ラベル: {store_label or '未設定'}",
            f"直近会話:\n{history_text}" if history_text else "",
            f"今回のお問い合わせ:\n{user_message}",
        ]
    ).strip()

    body = {
        "systemInstruction": {
            "parts": [{
                "text": "\n".join([
                    "あなたは「ミセサポ」お客様窓口AIです。",
                    "役割: 受付・一般案内・確認事項の整理のみ。",
                    "禁止: 契約、金額、請求、値引き、補償、責任、法務、判断、確約、承認に関する確定回答。",
                    "禁止話題が含まれる場合は、必ず「担当者が確認して連絡する」旨の案内に留める。",
                    "回答は日本語、丁寧語、120文字以内を目安。過剰な装飾や絵文字は使わない。",
                ])
            }]
        },
        "generationConfig": {
            "temperature": 0.35,
            "topP": 0.9,
            "maxOutputTokens": 180,
        },
        "contents": [{
            "role": "user",
            "parts": [{"text": prompt_text}],
        }],
    }

    req = urllib_request.Request(
        endpoint,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=18) as res:
            status = int(res.getcode() or 0)
            raw = res.read().decode("utf-8")
        if status < 200 or status >= 300:
            raise RuntimeError(f"Google AI応答エラー: {status} {raw}".strip())
        payload = json.loads(raw)
    except urllib_error.HTTPError as e:
        err_body = ""
        try:
            err_body = e.read().decode("utf-8")
        except Exception:
            err_body = str(e)
        raise RuntimeError(f"Google AI応答エラー: {e.code} {err_body}".strip())
    except Exception as e:
        raise RuntimeError(f"Google AI応答エラー: {str(e)}".strip())

    text = _parse_gemini_text(payload)
    if not text:
        raise RuntimeError("Google AIから有効な応答テキストを取得できませんでした。")
    return text


def _customer_ai_reply_admin_chat(body: dict):
    user_message = _strip(body.get("user_message") or body.get("message") or body.get("text"))
    store_label = _strip(body.get("store_label"))
    recent_messages = body.get("recent_messages") if isinstance(body.get("recent_messages"), list) else []

    if not user_message:
        return {
            "enabled": CUSTOMER_CHAT_AI_ENABLED,
            "blocked": False,
            "mode": "empty",
            "provider": "none",
            "model": GOOGLE_AI_MODEL,
            "reply": "",
        }, None

    if not CUSTOMER_CHAT_AI_ENABLED:
        return {
            "enabled": False,
            "blocked": False,
            "mode": "disabled",
            "provider": "none",
            "model": GOOGLE_AI_MODEL,
            "reply": "",
        }, None

    if _is_within_operator_support_hours():
        return {
            "enabled": True,
            "blocked": False,
            "mode": "operator_hours",
            "provider": "none",
            "model": GOOGLE_AI_MODEL,
            "reply": "",
        }, None

    reasons = _detect_restricted_customer_inquiry(user_message)
    if reasons:
        return {
            "enabled": True,
            "blocked": True,
            "mode": "restricted",
            "provider": "misogi-guard",
            "model": GOOGLE_AI_MODEL,
            "reasons": reasons,
            "reply": CUSTOMER_CHAT_RESTRICTED_REPLY,
        }, None

    try:
        ai_text = _request_gemini_customer_reply(
            user_message=user_message,
            store_label=store_label,
            recent_messages=recent_messages,
        )
        return {
            "enabled": True,
            "blocked": False,
            "mode": "gemini",
            "provider": "gemini",
            "model": GOOGLE_AI_MODEL,
            "reply": _strip(ai_text) or "お問い合わせありがとうございます。担当者が内容を確認し、必要に応じてご連絡いたします。",
        }, None
    except Exception as e:
        print(f"[admin_chat] customer_ai_reply fallback err={str(e)}")
        return {
            "enabled": True,
            "blocked": False,
            "mode": "fallback",
            "provider": "misogi-fallback",
            "model": GOOGLE_AI_MODEL,
            "reply": "お問い合わせありがとうございます。内容を受け付けました。担当者が確認してご連絡いたします。",
            "error": str(e),
        }, None
    if len(text) > 4000:
        text = text[:4000]

    target_lang = _normalize_lang_code(body.get("target_lang"), "ja")
    source_lang = _normalize_lang_code(body.get("source_lang"), "auto")

    try:
        params = {
            "Text": text,
            "TargetLanguageCode": target_lang,
        }
        if source_lang != "auto":
            params["SourceLanguageCode"] = source_lang
        res = translate_client.translate_text(**params)
        return {
            "translated_text": _strip(res.get("TranslatedText")),
            "source_language": _strip(res.get("SourceLanguageCode")) or source_lang,
            "target_language": target_lang,
            "fallback": False,
        }, None
    except Exception as e:
        print(f"[admin_chat] translate failed err={str(e)}")
        # 権限不足/一時障害でもチャット操作を止めない。
        # 200 で原文を返し、UI 側でフォールバック表示できるようにする。
        return {
            "translated_text": text,
            "source_language": source_lang,
            "target_language": target_lang,
            "fallback": True,
            "error": str(e),
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


def _enrich_souko_items(items: list):
    if not isinstance(items, list):
        return items
    out = []
    for src in items:
        row = dict(src or {})
        files = row.get("files")
        if isinstance(files, list):
            enriched_files = []
            for f in files:
                if not isinstance(f, dict):
                    continue
                one = dict(f)
                key = _strip(one.get("key"))
                bucket = _strip(one.get("bucket")) or STORAGE_BUCKET
                if key and bucket and not _strip(one.get("get_url")):
                    try:
                        one["get_url"] = s3.generate_presigned_url(
                            "get_object",
                            Params={"Bucket": bucket, "Key": key},
                            ExpiresIn=3600,
                        )
                    except Exception as e:
                        print(f"[souko] file presign failed key={key} err={str(e)}")
                enriched_files.append(one)
            row["files"] = enriched_files
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
                if collection == "souko" and not _is_souko_owner(event, item):
                    return _resp(403, {"error": "forbidden", "message": "このデータへのアクセス権がありません"})
                if collection == "souko":
                    item = (_enrich_souko_items([item]) or [item])[0]
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
                if collection == "souko":
                    page_items = [row for row in page_items if _is_souko_owner(event, row)]
                items.extend(page_items)
                if len(items) >= limit:
                    items = items[:limit]
                    break
                last_key = res.get("LastEvaluatedKey")
                if not last_key:
                    break

            if collection == "admin_chat":
                items = _enrich_admin_chat_items(items)
            if collection == "souko":
                items = _enrich_souko_items(items)
            return _resp(200, {"items": items, "count": len(items)})

        if method == "POST":
            body = _parse_body(event)
            body = _sanitize_create_payload(collection, body, pk_name)
            actor = _extract_actor(event) if collection == "admin_chat" else {"id": "", "name": ""}

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

            mode = _strip(body.get("mode")).lower()
            if collection == "admin_chat" and mode in {"customer_ai_reply", "customer_ai", "ai_reply_customer"}:
                payload, err_resp = _customer_ai_reply_admin_chat(body)
                if err_resp:
                    return err_resp
                return _resp(200, payload)

            looks_like_translate = ("text" in body)
            if collection == "admin_chat" and (mode in {"translate_text", "translate", "translation"} or looks_like_translate):
                payload, err_resp = _translate_admin_chat_text(body)
                if err_resp:
                    return err_resp
                return _resp(200, payload)

            if collection == "admin_chat":
                sender_id = _strip(body.get("sender_id")) or _strip(actor.get("id"))
                sender_name = (
                    _strip(body.get("sender_name"))
                    or _strip(body.get("sender_display_name"))
                    or _strip(actor.get("name"))
                )
                if sender_id:
                    body["sender_id"] = sender_id
                if sender_name:
                    body["sender_name"] = sender_name
                    body["sender_display_name"] = _strip(body.get("sender_display_name")) or sender_name
                if sender_id and not _strip(body.get("created_by")):
                    body["created_by"] = sender_id
                if sender_name and not _strip(body.get("created_by_name")):
                    body["created_by_name"] = sender_name

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
            if collection == "souko" and not _is_souko_owner(event, item):
                return _resp(403, {"error": "forbidden", "message": "このデータは更新できません"})
            actor = _extract_actor(event) if collection == "admin_chat" else {"id": "", "name": ""}
            if collection == "admin_chat" and not _is_admin_chat_owner(event, item):
                return _resp(403, {"error": "forbidden", "message": "自分の投稿のみ更新できます"})
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
            if collection == "admin_chat":
                if _strip(actor.get("id")):
                    item["updated_by"] = _strip(actor.get("id"))
                if _strip(actor.get("name")):
                    item["updated_by_name"] = _strip(actor.get("name"))
            _apply_touroku_meta(item, now)
            if collection == "tenpo":
                _normalize_tenpo_billing_owner(item)
            table.put_item(Item=item)
            return _resp(200, item)

        if method == "DELETE":
            if not record_id:
                return _resp(400, {"error": "missing_id"})
            now = _now_iso()
            if collection == "souko":
                res = table.get_item(Key={pk_name: record_id})
                item = res.get("Item")
                if not item:
                    return _resp(404, {"error": "not_found"})
                if not _is_souko_owner(event, item):
                    return _resp(403, {"error": "forbidden", "message": "このデータは削除できません"})
            if collection == "admin_chat":
                res = table.get_item(Key={pk_name: record_id})
                item = res.get("Item")
                if not item:
                    return _resp(404, {"error": "not_found"})
                if not _is_admin_chat_owner(event, item):
                    return _resp(403, {"error": "forbidden", "message": "自分の投稿のみ削除できます"})
                actor = _extract_actor(event)
                item["jotai"] = "torikeshi"
                item["updated_at"] = now
                item["torikeshi_at"] = now
                if _strip(actor.get("id")):
                    item["updated_by"] = _strip(actor.get("id"))
                if _strip(actor.get("name")):
                    item["updated_by_name"] = _strip(actor.get("name"))
                table.put_item(Item=item)
                return _resp(200, {"ok": True, "id": record_id, "jotai": "torikeshi"})
            table.update_item(
                Key={pk_name: record_id},
                UpdateExpression="SET jotai = :torikeshi, updated_at = :u",
                ExpressionAttributeValues={":torikeshi": "torikeshi", ":u": now},
            )
            return _resp(200, {"ok": True, "id": record_id, "jotai": "torikeshi"})

        return _resp(405, {"error": "method_not_allowed"})
    except Exception as e:
        print(f"[torihikisaki-data] error: {str(e)}")
        # 翻訳はチャット操作の補助機能のため、失敗時でもUIを止めない。
        try:
            method = event.get("httpMethod", "")
            collection = _collection_from_event(event)
            if method == "POST" and collection == "admin_chat":
                body = _parse_body(event)
                if isinstance(body, dict) and "text" in body:
                    target_lang = _normalize_lang_code(body.get("target_lang"), "ja")
                    source_lang = _normalize_lang_code(body.get("source_lang"), "auto")
                    return _resp(200, {
                        "translated_text": str(body.get("text") or ""),
                        "source_language": source_lang,
                        "target_language": target_lang,
                        "fallback": True,
                        "error": str(e),
                    })
        except Exception:
            pass
        return _resp(500, {"error": "internal_error", "message": str(e)})
