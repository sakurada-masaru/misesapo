import json, os, uuid
import boto3
from datetime import datetime
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("TORIHIKISAKI_TABLE", "torihikisaki")
table = dynamodb.Table(TABLE_NAME)

def _resp(status, body, extra_headers=None):
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    }
    if extra_headers:
        headers.update(extra_headers)
    return {"statusCode": status, "headers": headers, "body": json.dumps(body, ensure_ascii=False, default=str)}

def lambda_handler(event, context):
    method = event.get("httpMethod")
    path = (event.get("path") or "").rstrip("/")

    if method == "OPTIONS":
        return _resp(200, {"ok": True})

    # 疎通
    if path.endswith("/test") or path == "/test":
        re _resp(200, {"ok": True, "path": path})

    # ルーティング：/master/torihikisaki or /master/torihikisaki/{id}
    parts = [p for p in path.split("/") if p]
    # 例: ["master","torihikisaki"] or ["master","torihikisaki","T0001"]
    if len(parts) < 2 or parts[0] != "master" or parts[1] != "torihikisaki":
        return _resp(404, {"error": "not_found", "path": path})

    record_id = parts[2] if len(parts) >= 3 else None

    try:
        if method == "GET":
            if record_id:
                res = table.get_item(Key={"id": record_id})
                item = res.get("Item")
                if not item:
                    return _resp(404, {"error": "not_found", "id": record_id})
                return _resp(200, item)
            else:
                q = event.get("queryStringParameters") or {}
                jotai = q.get("jotai", "yuko")
                res = table.scan(FilterExpression=Attr("jotai").eq(jotai))
                return _resp(200, {"items": res.get("Items", [])})

        ST":
            body = json.loads(event.get("body") or "{}")
            new_id = body.get("id") or f"T-{uuid.uuid4().hex[:12]}"
            now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
            item = {
                "id": new_id,
                "jotai": "yuko",
                "created_at": now,
                "updated_at": now,
            }
            item.update({k: v for k, v in body.items() if k != "id"})
            table.put_item(Item=item)
            return _resp(201, item)

        if method == "PUT":
            if not record_id:
                return _resp(400, {"error": "missing_id"})
            body = json.loads(event.get("body") or "{}")
            now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

            # まず既存取得→上書き（最小実装）
            res = table.get_item(Key={"id": record_id})
            item = res.get("Item") or {"id": record_id, "created_at": now, "jotai": "yuko"}
            item.update(body)
            item["id"] = recoat"] = now
            table.put_item(Item=item)
            return _resp(200, item)

        if method == "DELETE":
            if not record_id:
                return _resp(400, {"error": "missing_id"})
            now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
            table.update_item(
                Key={"id": record_id},
                UpdateExpression="SET jotai=:j, updated_at=:u",
                ExpressionAttributeValues={":j": "torikeshi", ":u": now},
            )
            return _resp(200, {"ok": True, "id": record_id, "jotai": "torikeshi"})

        return _resp(405, {"error": "method_not_allowed", "method": method})

    except Exception as e:
        return _resp(500, {"error": "internal", "message": str(e)})
