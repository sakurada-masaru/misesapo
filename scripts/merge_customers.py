import boto3
from collections import defaultdict, Counter

REGION = 'ap-northeast-1'
db = boto3.resource('dynamodb', region_name=REGION)

TABLE_STORES = 'misesapo-stores'
TABLE_CLIENTS = 'misesapo-clients'
TABLE_BRANDS = 'misesapo-brands'

# Tables that reference store_id, client_id, or brand_id
REF_TABLES = {
    'schedules': {'pk': ['id'], 'store_key': 'store_id', 'client_key': 'client_id'},
    'staff-reports': {'pk': ['report_id', 'created_at'], 'store_key': 'store_id'},
    'kartes': {'pk': ['id'], 'store_key': 'store_id'},
    'misesapo-schedules': {'pk': ['id'], 'store_key': 'store_id'},
    'misesapo-reports': {'pk': ['id'], 'store_key': 'store_id'},
    'misesapo-tasks': {'pk': ['id'], 'store_key': 'store_id'},
    'misesapo-brands': {'pk': ['id'], 'client_key': 'client_id'},
    'misesapo-stores': {'pk': ['id'], 'client_key': 'client_id', 'brand_key': 'brand_id'}
}

def get_all_items(table_name):
    table = db.Table(table_name)
    response = table.scan()
    items = response.get('Items', [])
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response.get('Items', []))
    return items

def merge_entities(table_name, group_key_func):
    print(f"\n--- Checking duplicates for {table_name} ---")
    items = get_all_items(table_name)
    groups = defaultdict(list)
    for item in items:
        key = group_key_func(item)
        if key:
            groups[key].append(item)
    
    merges = {}
    for key, bundle in groups.items():
        if len(bundle) > 1:
            # Pick primary: prefer active, then oldest ID
            # Sorting by status (active first) then ID
            bundle.sort(key=lambda x: (0 if x.get('status') == 'active' else 1, x.get('id', 'ZZZ')))
            primary = bundle[0]
            others = bundle[1:]
            print(f"Duplicate found for {key}: Primary={primary['id']}, Others={[o['id'] for o in others]}")
            for o in others:
                merges[o['id']] = primary['id']
    return merges

def update_references(old_id, new_id, ref_key, table_name, pk_fields):
    table = db.Table(table_name)
    # We need to find all items with ref_key == old_id
    # Scan is slow but for this one-time merge it's safer than querying without GSI
    items = get_all_items(table_name)
    count = 0
    for item in items:
        if item.get(ref_key) == old_id:
            key = {pk: item[pk] for pk in pk_fields}
            table.update_item(
                Key=key,
                UpdateExpression=f"SET {ref_key} = :new",
                ExpressionAttributeValues={':new': new_id}
            )
            count += 1
    if count > 0:
        print(f"  Updated {count} references in {table_name}")

def main():
    # 1. Merge Clients
    client_merges = merge_entities(TABLE_CLIENTS, lambda x: x.get('name', '').strip() if x.get('name') else None)
    for old_cid, new_cid in client_merges.items():
        print(f"Merging client {old_cid} -> {new_cid}")
        # Update references in all tables that have client_id
        for t_name, info in REF_TABLES.items():
            if 'client_key' in info:
                update_references(old_cid, new_cid, info['client_key'], t_name, info['pk'])
        # Suspend old client
        db.Table(TABLE_CLIENTS).update_item(
            Key={'id': old_cid},
            UpdateExpression="SET #s = :s, merged_into = :m",
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={':s': 'suspended', ':m': new_cid}
        )

    # 2. Merge Brands
    brand_merges = merge_entities(TABLE_BRANDS, lambda x: (x.get('name', '').strip(), x.get('client_id')) if x.get('name') else None)
    for old_bid, new_bid in brand_merges.items():
        print(f"Merging brand {old_bid} -> {new_bid}")
        for t_name, info in REF_TABLES.items():
            if 'brand_key' in info:
                update_references(old_bid, new_bid, info['brand_key'], t_name, info['pk'])
        # Suspend old brand
        db.Table(TABLE_BRANDS).update_item(
            Key={'id': old_bid},
            UpdateExpression="SET #s = :s, merged_into = :m",
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={':s': 'suspended', ':m': new_bid}
        )

    # 3. Merge Stores
    store_merges = merge_entities(TABLE_STORES, lambda x: (x.get('name', '').strip(), x.get('client_id'), x.get('brand_id')) if x.get('name') else None)
    for old_sid, new_sid in store_merges.items():
        print(f"Merging store {old_sid} -> {new_sid}")
        # Update references in all tables that have store_id
        for t_name, info in REF_TABLES.items():
            if 'store_key' in info:
                update_references(old_sid, new_sid, info['store_key'], t_name, info['pk'])
        # Suspend old store
        db.Table(TABLE_STORES).update_item(
            Key={'id': old_sid},
            UpdateExpression="SET #s = :s, merged_into = :m",
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={':s': 'suspended', ':m': new_sid}
        )

    print("\nMerge and Consolidation Completed.")

if __name__ == "__main__":
    main()
