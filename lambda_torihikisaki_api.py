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

ALLOWED_COLLECTIONS = {"torihikisaki", "yagou", "tenpo", "souko", "jinzai", "service", "kadai"}

PK_MAP = {
    "torihikisaki": "torihikisaki_id",
    "yagou": "yagou_id",
    "tenpo": "tenpo_id",
    "souko": "souko_id",
    "jinzai": "jinzai_id",
    "service": "service_id",
    "kadai": "kadai_id",
}

# 子テーブルの最低限親キー
REQUIRED_PARENT_KEYS = {
    "yagou": ["torihikisaki_id"],
    "tenpo": ["torihikisaki_id", "yagou_id"],
    "souko": ["tenpo_id"],
}

ID_PREFIX = {
    "torihikisaki": "TORI",
    "yagou": "YAGOU",
    "tenpo": "TENPO",
    "souko": "SOUKO",
    "jinzai": "JINZAI",
    "service": "SERVICE",
    "kadai": "KADAI",
}

TABLE_MAP = {
    "torihikisaki": os.environ.get("TABLE_TORIHIKISAKI", "torihikisaki"),
    "yagou": os.environ.get("TABLE_YAGOU", "yagou"),
    "tenpo": os.environ.get("TABLE_TENPO", "tenpo"),
    "souko": os.environ.get("TABLE_SOUKO", "souko"),
    "jinzai": os.environ.get("TABLE_JINZAI", "jinzai"),
    "service": os.environ.get("TABLE_SERVICE", "service"),
    "kadai": os.environ.get("TABLE_KADAI", "kadai"),
}

TENPO_KARTE_TABLE = os.environ.get("TABLE_TENPO_KARTE", "tenpo_karte")

dynamodb = boto3.resource("dynamodb")
TABLES = {k: dynamodb.Table(v) for k, v in TABLE_MAP.items()}
TENPO_KARTE = dynamodb.Table(TENPO_KARTE_TABLE)
s3 = boto3.client("s3")
STORAGE_BUCKET = os.environ.get("STORAGE_BUCKET", "")


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


def _make_id(collection: str) -> str:
    return f"{ID_PREFIX[collection]}#{uuid.uuid4().hex[:12]}"


def _validate_create(collection: str, data: dict, pk_name: str):
    if not data.get("name"):
        return "name は必須です"
    for parent_key in REQUIRED_PARENT_KEYS.get(collection, []):
        if not data.get(parent_key):
            return f"{parent_key} は必須です"
    if pk_name in data and not data.get(pk_name):
        return f"{pk_name} が不正です"
    return None


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

    if collection == "kadai":
        for k in ["category", "status", "source", "priority", "torihikisaki_id", "yagou_id", "tenpo_id", "jinzai_id"]:
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


def _strip(v):
    return str(v or "").strip()


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
    if not torihikisaki_name or not yagou_name or not tenpo_name:
        return _resp(400, {"error": "validation_error", "message": "torihikisaki_name/yagou_name/tenpo_name は必須です"})

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
    # カルテは常時自動作成（登録時点で tenpo_karte を必ず作る）
    create_karte = True
    now = _now_iso()
    created = []
    try:
        torihikisaki_id = _make_id("torihikisaki")
        t_item = {
            "torihikisaki_id": torihikisaki_id,
            "name": torihikisaki_name,
            "jotai": "yuko",
            "created_at": now,
            "updated_at": now,
        }
        if contact_phone:
            t_item["phone"] = contact_phone
        if contact_email:
            t_item["email"] = contact_email
        if tantou_name:
            t_item["tantou_name"] = tantou_name
        if address:
            t_item["address"] = address
        if site_url:
            t_item["url"] = site_url
        if info_registrar:
            t_item["jouhou_touroku_sha_name"] = info_registrar
        TABLES["torihikisaki"].put_item(
            Item=t_item,
            ConditionExpression="attribute_not_exists(torihikisaki_id)",
        )
        created.append(("torihikisaki", torihikisaki_id))

        yagou_id = _make_id("yagou")
        y_item = {
            "yagou_id": yagou_id,
            "torihikisaki_id": torihikisaki_id,
            "name": yagou_name,
            "jotai": "yuko",
            "created_at": now,
            "updated_at": now,
        }
        TABLES["yagou"].put_item(
            Item=y_item,
            ConditionExpression="attribute_not_exists(yagou_id)",
        )
        created.append(("yagou", yagou_id))

        tenpo_id = _make_id("tenpo")
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
            },
            "created_at": now,
            "updated_at": now,
        }
        tenpo_item = {
            "tenpo_id": tenpo_id,
            "torihikisaki_id": torihikisaki_id,
            "yagou_id": yagou_id,
            "name": tenpo_name,
            "jotai": "yuko",
            "created_at": now,
            "updated_at": now,
            "karte_detail": karte_detail,
        }
        # 請求主体（デフォルトは torihikisaki 主体）
        _normalize_tenpo_billing_owner(tenpo_item)
        if contact_phone:
            tenpo_item["phone"] = contact_phone
        if contact_email:
            tenpo_item["email"] = contact_email
        if tantou_name:
            tenpo_item["tantou_name"] = tantou_name
        if address:
            tenpo_item["address"] = address
        if site_url:
            tenpo_item["url"] = site_url
        if info_registrar:
            tenpo_item["jouhou_touroku_sha_name"] = info_registrar
        if idempotency_key:
            tenpo_item["idempotency_key"] = idempotency_key
        TABLES["tenpo"].put_item(
            Item=tenpo_item,
            ConditionExpression="attribute_not_exists(tenpo_id)",
        )
        created.append(("tenpo", tenpo_id))

        # 既存運用互換: souko 自動作成
        souko_id = _make_id("souko")
        souko_item = {
            "souko_id": souko_id,
            "tenpo_id": tenpo_id,
            "name": f"{tenpo_name} 顧客ストレージ",
            "jotai": "yuko",
            "created_at": now,
            "updated_at": now,
        }
        TABLES["souko"].put_item(
            Item=souko_item,
            ConditionExpression="attribute_not_exists(souko_id)",
        )
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

            return _resp(200, {"items": items, "count": len(items)})

        if method == "POST":
            body = _parse_body(event)

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

            err = _validate_create(collection, body, pk_name)
            if err:
                return _resp(400, {"error": "validation_error", "message": err})
            now = _now_iso()
            item_id = body.get(pk_name) or _make_id(collection)
            item = dict(body)
            item[pk_name] = item_id
            item["jotai"] = body.get("jotai", "yuko")
            item["created_at"] = now
            item["updated_at"] = now
            if collection == "tenpo":
                _normalize_tenpo_billing_owner(item)
            table.put_item(
                Item=item,
                ConditionExpression=f"attribute_not_exists({pk_name})",
            )
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
            item["updated_at"] = _now_iso()
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
