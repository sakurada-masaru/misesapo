import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key


TABLE_NAME = os.environ.get("TABLE_NAME", "kartes")
ALLOWED_ORIGINS = [origin.strip() for origin in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if origin.strip()]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _cors_headers(event_headers):
    if "*" in ALLOWED_ORIGINS:
        origin = "*"
    else:
        origin = event_headers.get("origin") or event_headers.get("Origin") or ""
        if origin not in ALLOWED_ORIGINS:
            origin = ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    }


def _response(status, body, event_headers):
    return {
        "statusCode": status,
        "headers": _cors_headers(event_headers),
        "body": json.dumps(body, ensure_ascii=False),
    }


def _sanitize(item):
    if not isinstance(item, dict):
        return {}
    sanitized = {}
    for key, value in item.items():
        if value is None:
            continue
        if value == "":
            continue
        if isinstance(value, list) and len(value) == 0:
            continue
        sanitized[key] = value
    return sanitized


def lambda_handler(event, context):
    event_headers = event.get("headers") or {}
    method = event.get("httpMethod", "")
    path_params = event.get("pathParameters") or {}
    query = event.get("queryStringParameters") or {}

    if method == "OPTIONS":
        return _response(200, {"ok": True}, event_headers)

    if method == "GET":
        karte_id = path_params.get("id")
        if karte_id:
            resp = table.get_item(Key={"id": karte_id})
            item = resp.get("Item")
            if not item:
                return _response(404, {"error": "not_found"}, event_headers)
            return _response(200, item, event_headers)

        store_id = query.get("store_id")
        client_id = query.get("client_id")
        if store_id:
            resp = table.query(
                IndexName="store-created-at",
                KeyConditionExpression=Key("store_id").eq(store_id),
                ScanIndexForward=False,
            )
            return _response(200, {"items": resp.get("Items", [])}, event_headers)
        if client_id:
            resp = table.query(
                IndexName="client-created-at",
                KeyConditionExpression=Key("client_id").eq(client_id),
                ScanIndexForward=False,
            )
            return _response(200, {"items": resp.get("Items", [])}, event_headers)
        return _response(400, {"error": "store_id or client_id required"}, event_headers)

    if method == "POST":
        try:
            body = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError:
            return _response(400, {"error": "invalid_json"}, event_headers)

        item = _sanitize(body)
        item["id"] = item.get("id") or str(uuid.uuid4())
        item["created_at"] = item.get("created_at") or _now_iso()
        item["updated_at"] = _now_iso()
        table.put_item(Item=item)
        return _response(200, item, event_headers)

    if method == "PUT":
        karte_id = path_params.get("id")
        if not karte_id:
            return _response(400, {"error": "id_required"}, event_headers)
        try:
            body = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError:
            return _response(400, {"error": "invalid_json"}, event_headers)

        item = _sanitize(body)
        item["id"] = karte_id
        item["updated_at"] = _now_iso()
        table.put_item(Item=item)
        return _response(200, item, event_headers)

    if method == "DELETE":
        karte_id = path_params.get("id")
        if not karte_id:
            return _response(400, {"error": "id_required"}, event_headers)
        table.delete_item(Key={"id": karte_id})
        return _response(200, {"deleted": karte_id}, event_headers)

    return _response(405, {"error": "method_not_allowed"})
