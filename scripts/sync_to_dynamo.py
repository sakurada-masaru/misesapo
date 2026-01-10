import json
import boto3
from datetime import datetime
import uuid

# Configuration
REGION = 'ap-northeast-1'
TABLE_STORES = 'misesapo-stores'
TABLE_CLIENTS = 'misesapo-clients'
TABLE_BRANDS = 'misesapo-brands'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
store_table = dynamodb.Table(TABLE_STORES)
client_table = dynamodb.Table(TABLE_CLIENTS)
brand_table = dynamodb.Table(TABLE_BRANDS)

def normalize(text):
    if not text: return ""
    return str(text).strip().replace(" ", "").replace("　", "")

def get_next_id(prefix, current_ids):
    max_num = 0
    for cid in current_ids:
        if cid.startswith(prefix):
            try:
                num = int(cid[len(prefix):])
                if num > max_num:
                    max_num = num
            except:
                continue
    return f"{prefix}{str(max_num + 1).zfill(5)}"

def sync():
    # 1. Load Data
    with open("notion_export.json", "r", encoding="utf-8") as f:
        notion_data = json.load(f)
    
    with open("aws_export.json", "r", encoding="utf-8") as f:
        aws_stores = json.load(f).get("items", [])
    
    with open("clients_export.json", "r", encoding="utf-8") as f:
        aws_clients = json.load(f).get("items", [])
        
    with open("brands_export.json", "r", encoding="utf-8") as f:
        aws_brands = json.load(f).get("items", [])

    # Maps
    client_name_map = {normalize(c.get("name")): c for c in aws_clients if c.get("name")}
    brand_name_map = {normalize(b.get("name")): b for b in aws_brands if b.get("name")}
    store_name_map = {normalize(s.get("name")): s for s in aws_stores if s.get("name")}

    client_ids = [c["id"] for c in aws_clients]
    brand_ids = [b["id"] for b in aws_brands]
    store_ids = [s["id"] for s in aws_stores]

    now = datetime.utcnow().isoformat() + "Z"

    # 2. Process Clients (Companies)
    for n in notion_data:
        c_name = n.get("company")
        if c_name and normalize(c_name) not in client_name_map:
            new_id = get_next_id("CL", client_ids)
            print(f"Creating Client: {c_name} -> {new_id}")
            item = {
                "id": new_id,
                "name": c_name,
                "status": "active",
                "created_at": now,
                "updated_at": now,
                "role": "customer"
            }
            client_table.put_item(Item=item)
            client_name_map[normalize(c_name)] = item
            client_ids.append(new_id)

    # 3. Process Brands
    for n in notion_data:
        b_name = n.get("brand")
        c_name = n.get("company")
        if b_name and normalize(b_name) not in brand_name_map:
            client_id = client_name_map.get(normalize(c_name), {}).get("id") if c_name else None
            new_id = get_next_id("BR", brand_ids)
            print(f"Creating Brand: {b_name} -> {new_id} (Client: {client_id})")
            item = {
                "id": new_id,
                "name": b_name,
                "client_id": client_id,
                "status": "active",
                "created_at": now,
                "updated_at": now
            }
            brand_table.put_item(Item=item)
            brand_name_map[normalize(b_name)] = item
            brand_ids.append(new_id)

    # 4. Process Stores
    for n in notion_data:
        n_store = n.get("store")
        n_brand = n.get("brand")
        n_company = n.get("company")
        n_status = n.get("status")
        
        target_name = n_store if n_store else n_brand
        if not target_name: continue
        
        target_status = "active" if n_status == "稼働中" else "suspended"
        key = normalize(target_name)
        
        client_id = client_name_map.get(normalize(n_company), {}).get("id") if n_company else None
        brand_id = brand_name_map.get(normalize(n_brand), {}).get("id") if n_brand else None

        if key in store_name_map:
            aws_item = store_name_map[key]
            # Update if status differs
            if aws_item.get("status") != target_status:
                print(f"Updating Store Status: {target_name} ({aws_item['id']}) -> {target_status}")
                store_table.update_item(
                    Key={'id': aws_item['id']},
                    UpdateExpression="SET #s = :s, updated_at = :u",
                    ExpressionAttributeNames={'#s': 'status'},
                    ExpressionAttributeValues={':s': target_status, ':u': now}
                )
        else:
            # Create new store
            new_id = get_next_id("ST", store_ids)
            print(f"Creating Store: {target_name} -> {new_id}")
            item = {
                "id": new_id,
                "name": target_name,
                "client_id": client_id,
                "brand_id": brand_id,
                "status": target_status,
                "email": n.get("email", ""),
                "phone": n.get("phone", ""),
                "contact_person": n.get("contact_person", ""),
                "created_at": now,
                "updated_at": now,
                "registration_type": "notion_sync"
            }
            store_table.put_item(Item=item)
            store_ids.append(new_id)

    # 5. Suspend stores not in Notion (that were active)
    matched_keys = {normalize(n.get("store") if n.get("store") else n.get("brand")) for n in notion_data}
    for key, s in store_name_map.items():
        if key not in matched_keys and s.get("status") == "active":
            print(f"Suspending Store (Not in Notion): {s['name']} ({s['id']})")
            store_table.update_item(
                Key={'id': s['id']},
                UpdateExpression="SET #s = :s, updated_at = :u",
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':s': 'suspended', ':u': now}
            )

    print("Sync Completed Successfully.")

if __name__ == "__main__":
    sync()
