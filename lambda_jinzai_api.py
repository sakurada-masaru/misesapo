import json
import os
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from urllib.parse import unquote

import boto3
from boto3.dynamodb.conditions import Attr


HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}

dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")

TABLE_JINZAI = dynamodb.Table(os.environ.get("TABLE_JINZAI", "jinzai"))
TABLE_BUSHO = dynamodb.Table(os.environ.get("TABLE_JINZAI_BUSHO", "jinzai_busho"))
TABLE_SHOKUSHU = dynamodb.Table(os.environ.get("TABLE_JINZAI_SHOKUSHU", "jinzai_shokushu"))
TABLE_KABAN = dynamodb.Table(os.environ.get("TABLE_JINZAI_KABAN", "jinzai_kaban"))
KABAN_BUCKET = os.environ.get("KABAN_BUCKET", "")


def _resp(status_code: int, body: dict):
    return {
        "statusCode": status_code,
        "headers": HEADERS,
        "body": json.dumps(body, ensure_ascii=False, default=_json_default),
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _apply_touroku_meta(item: dict, now_iso: str):
    if not isinstance(item, dict):
        return item
    touroku_at = str(item.get("touroku_at") or "").strip() or now_iso
    item["touroku_at"] = touroku_at
    if not str(item.get("touroku_date") or "").strip():
        item["touroku_date"] = touroku_at[:10]
    return item


def _safe_file_name(name: str) -> str:
    return (name or "file.bin").replace("/", "_").replace("\\", "_").strip() or "file.bin"


def _parse_body(event):
    raw = event.get("body")
    if not raw:
        return {}
    return json.loads(raw)


def _json_default(obj):
    # DynamoDB Number is Decimal; convert for JSON response safely.
    if isinstance(obj, Decimal):
        # Keep int shape when possible, otherwise float.
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    return str(obj)


def _safe_limit(query_params, default=100, max_value=1000):
    raw = (query_params or {}).get("limit", str(default))
    try:
        v = int(raw)
    except Exception:
        v = default
    return min(max(v, 1), max_value)


def _split_path(event):
    path = (event.get("path") or "").strip("/")
    return [unquote(p) for p in path.split("/") if p]


def _scan_with_filter(table, limit: int, filter_expr=None):
    kwargs = {"Limit": limit}
    if filter_expr is not None:
        kwargs["FilterExpression"] = filter_expr
    res = table.scan(**kwargs)
    items = res.get("Items", [])
    return {"items": items, "count": len(items)}


def _presign_kaban_upload(jinzai_id: str, body: dict):
    if not KABAN_BUCKET:
        return _resp(500, {"error": "kaban_bucket_not_configured"})
    file_name = _safe_file_name(body.get("file_name", "file.bin"))
    content_type = body.get("content_type", "application/octet-stream")
    expires_in = int(body.get("expires_in", 900))
    expires_in = min(max(expires_in, 60), 3600)
    key = f"kaban/{jinzai_id}/{uuid.uuid4().hex}_{file_name}"

    put_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": KABAN_BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=expires_in,
    )
    get_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": KABAN_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )
    return _resp(
        200,
        {
            "bucket": KABAN_BUCKET,
            "key": key,
            "content_type": content_type,
            "expires_in": expires_in,
            "put_url": put_url,
            "get_url": get_url,
        },
    )


def _jinzai_collection(method: str, event):
    if method == "GET":
        q = event.get("queryStringParameters") or {}
        jotai = q.get("jotai", "yuko")
        limit = _safe_limit(q)
        filt = Attr("jotai").eq(jotai) if jotai else None
        return _resp(200, _scan_with_filter(TABLE_JINZAI, limit, filt))

    if method == "POST":
        body = _parse_body(event)
        if not body.get("name"):
            return _resp(400, {"error": "validation_error", "message": "name は必須です"})
        item = dict(body)
        item["jinzai_id"] = body.get("jinzai_id") or f"JINZAI#{uuid.uuid4().hex[:12]}"
        item["jotai"] = body.get("jotai", "yuko")
        now = _now_iso()
        item["created_at"] = now
        item["updated_at"] = now
        _apply_touroku_meta(item, now)
        TABLE_JINZAI.put_item(Item=item, ConditionExpression="attribute_not_exists(jinzai_id)")
        return _resp(201, item)

    return _resp(405, {"error": "method_not_allowed"})


def _jinzai_item(method: str, jinzai_id: str, event):
    if method == "GET":
        res = TABLE_JINZAI.get_item(Key={"jinzai_id": jinzai_id})
        item = res.get("Item")
        if not item:
            return _resp(404, {"error": "not_found"})
        return _resp(200, item)

    if method == "PUT":
        body = _parse_body(event)
        res = TABLE_JINZAI.get_item(Key={"jinzai_id": jinzai_id})
        item = res.get("Item")
        if not item:
            return _resp(404, {"error": "not_found"})
        for k, v in body.items():
            if k in {"jinzai_id", "created_at"}:
                continue
            item[k] = v
        now = _now_iso()
        item["updated_at"] = now
        _apply_touroku_meta(item, now)
        TABLE_JINZAI.put_item(Item=item)
        return _resp(200, item)

    if method == "DELETE":
        TABLE_JINZAI.update_item(
            Key={"jinzai_id": jinzai_id},
            UpdateExpression="SET jotai = :t, updated_at = :u",
            ExpressionAttributeValues={":t": "torikeshi", ":u": _now_iso()},
        )
        return _resp(200, {"ok": True, "jinzai_id": jinzai_id, "jotai": "torikeshi"})

    return _resp(405, {"error": "method_not_allowed"})


def _simple_master_collection(method: str, event, table, pk_name: str):
    if method == "GET":
        q = event.get("queryStringParameters") or {}
        jotai = q.get("jotai", "yuko")
        limit = _safe_limit(q)
        filt = Attr("jotai").eq(jotai) if jotai else None
        return _resp(200, _scan_with_filter(table, limit, filt))
    if method == "POST":
        body = _parse_body(event)
        if not body.get("name") and pk_name != "shokushu_code":
            return _resp(400, {"error": "validation_error", "message": "name は必須です"})
        if pk_name == "shokushu_code" and not body.get(pk_name):
            return _resp(400, {"error": "validation_error", "message": "shokushu_code は必須です"})
        item = dict(body)
        item[pk_name] = body.get(pk_name) or f"{pk_name.upper()}#{uuid.uuid4().hex[:12]}"
        item["jotai"] = body.get("jotai", "yuko")
        now = _now_iso()
        item["created_at"] = now
        item["updated_at"] = now
        _apply_touroku_meta(item, now)
        table.put_item(Item=item, ConditionExpression=f"attribute_not_exists({pk_name})")
        return _resp(201, item)
    return _resp(405, {"error": "method_not_allowed"})


def _simple_master_item(method: str, item_id: str, event, table, pk_name: str):
    if method == "GET":
        res = table.get_item(Key={pk_name: item_id})
        item = res.get("Item")
        if not item:
            return _resp(404, {"error": "not_found"})
        return _resp(200, item)

    if method == "PUT":
        body = _parse_body(event)
        res = table.get_item(Key={pk_name: item_id})
        item = res.get("Item")
        if not item:
            return _resp(404, {"error": "not_found"})
        for k, v in body.items():
            if k in {pk_name, "created_at"}:
                continue
            item[k] = v
        now = _now_iso()
        item["updated_at"] = now
        _apply_touroku_meta(item, now)
        table.put_item(Item=item)
        return _resp(200, item)

    if method == "DELETE":
        table.update_item(
            Key={pk_name: item_id},
            UpdateExpression="SET jotai = :t, updated_at = :u",
            ExpressionAttributeValues={":t": "torikeshi", ":u": _now_iso()},
        )
        return _resp(200, {"ok": True, pk_name: item_id, "jotai": "torikeshi"})

    return _resp(405, {"error": "method_not_allowed"})


def _kaban_collection(method: str, jinzai_id: str, event):
    if method == "GET":
        q = event.get("queryStringParameters") or {}
        jotai = q.get("jotai", "yuko")
        limit = _safe_limit(q)
        filt = Attr("jinzai_id").eq(jinzai_id)
        if jotai:
            filt = filt & Attr("jotai").eq(jotai)
        return _resp(200, _scan_with_filter(TABLE_KABAN, limit, filt))

    if method == "POST":
        body = _parse_body(event)
        if body.get("mode") == "presign_upload":
            return _presign_kaban_upload(jinzai_id, body)
        item = dict(body)
        item["jinzai_kaban_id"] = body.get("jinzai_kaban_id") or f"KABAN#{uuid.uuid4().hex[:12]}"
        item["jinzai_id"] = jinzai_id
        item["jotai"] = body.get("jotai", "yuko")
        now = _now_iso()
        item["created_at"] = now
        item["updated_at"] = now
        _apply_touroku_meta(item, now)
        if not item.get("name"):
            item["name"] = f"{jinzai_id} kaban"
        TABLE_KABAN.put_item(Item=item, ConditionExpression="attribute_not_exists(jinzai_kaban_id)")
        return _resp(201, item)

    return _resp(405, {"error": "method_not_allowed"})


def _kaban_item(method: str, jinzai_id: str, kaban_id: str, event):
    if method == "PUT":
        body = _parse_body(event)
        res = TABLE_KABAN.get_item(Key={"jinzai_kaban_id": kaban_id})
        item = res.get("Item")
        if not item:
            return _resp(404, {"error": "not_found"})
        if item.get("jinzai_id") != jinzai_id:
            return _resp(400, {"error": "mismatch_jinzai_id"})
        for k, v in body.items():
            if k in {"jinzai_kaban_id", "jinzai_id", "created_at"}:
                continue
            item[k] = v
        item["updated_at"] = _now_iso()
        TABLE_KABAN.put_item(Item=item)
        return _resp(200, item)

    if method == "DELETE":
        TABLE_KABAN.update_item(
            Key={"jinzai_kaban_id": kaban_id},
            UpdateExpression="SET jotai = :t, updated_at = :u",
            ExpressionAttributeValues={":t": "torikeshi", ":u": _now_iso()},
        )
        return _resp(200, {"ok": True, "jinzai_kaban_id": kaban_id, "jotai": "torikeshi"})

    return _resp(405, {"error": "method_not_allowed"})


def lambda_handler(event, context):
    try:
        method = event.get("httpMethod", "")
        if method == "OPTIONS":
            return _resp(200, {"ok": True})

        parts = _split_path(event)
        # expected:
        # /jinzai
        # /jinzai/{jinzai_id}
        # /jinzai/busho
        # /jinzai/shokushu
        # /jinzai/{jinzai_id}/kaban
        # /jinzai/{jinzai_id}/kaban/{kaban_id}
        if not parts:
            return _resp(404, {"error": "not_found"})

        if parts[0] != "jinzai":
            return _resp(404, {"error": "not_found"})

        if len(parts) == 1:
            return _jinzai_collection(method, event)

        if len(parts) == 2 and parts[1] == "busho":
            return _simple_master_collection(method, event, TABLE_BUSHO, "busho_id")

        if len(parts) == 2 and parts[1] == "shokushu":
            return _simple_master_collection(method, event, TABLE_SHOKUSHU, "shokushu_code")

        if len(parts) == 3 and parts[1] == "busho":
            return _simple_master_item(method, parts[2], event, TABLE_BUSHO, "busho_id")

        if len(parts) == 3 and parts[1] == "shokushu":
            return _simple_master_item(method, parts[2], event, TABLE_SHOKUSHU, "shokushu_code")

        jinzai_id = parts[1]
        if len(parts) == 2:
            return _jinzai_item(method, jinzai_id, event)

        if len(parts) == 3 and parts[2] == "kaban":
            return _kaban_collection(method, jinzai_id, event)

        if len(parts) == 4 and parts[2] == "kaban":
            return _kaban_item(method, jinzai_id, parts[3], event)

        return _resp(404, {"error": "not_found"})
    except Exception as e:
        print(f"[jinzai-api] error: {str(e)}")
        return _resp(500, {"error": "internal_error", "message": str(e)})
