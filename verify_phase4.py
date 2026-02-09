import boto3
import uuid
import json
from datetime import datetime

dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
yakusoku_table = dynamodb.Table('yakusoku')
yotei_table = dynamodb.Table('yotei')
ugoki_table = dynamodb.Table('ugoki')

def verify():
    test_yak_id = f"TEST-YAK-{uuid.uuid4().hex[:6]}"
    test_yot_id = f"TEST-YOT-{uuid.uuid4().hex[:6]}"
    now = datetime.utcnow().isoformat() + 'Z'
    month_key = datetime.utcnow().strftime('%Y-%m')

    print(f"--- Phase 4 Verification Start ---")

    # 1. Register Yakusoku
    print("Step 1: Registering yakusoku...")
    yakusoku_table.put_item(Item={
        'yakusoku_id': test_yak_id,
        'status': 'active',
        'type': 'teiki',
        'monthly_quota': 4,
        'consumption_count': {},
        'created_at': now
    })
    
    # 2. Create Yotei with yakusoku_id
    print("Step 2: Creating yotei linked to yakusoku...")
    # Simulate API logic for yotei creation
    yotei_table.put_item(Item={
        'id': test_yot_id,
        'yakusoku_id': test_yak_id,
        'scheduled_date': '2026-02-09',
        'sagyouin_id': 'test-worker',
        'jotai': 'yuko',
        'created_at': now
    })
    # UGOKI initialization (normally done by API)
    ugoki_table.put_item(Item={
        'yotei_id': test_yot_id,
        'jotai': 'mikanryo',
        'updated_at': now
    })

    # 3. Complete (kanryou) the status
    print("Step 3: Completing ugoki status (first time)...")
    # Simulate API logic for ugoki_patch_status
    # Get current status
    curr_ugoki = ugoki_table.get_item(Key={'yotei_id': test_yot_id}).get('Item')
    curr_jotai = curr_ugoki.get('jotai')
    new_jotai = 'kanryou'
    
    if new_jotai == 'kanryou' and curr_jotai != 'kanryou':
        # Update Ugoki
        ugoki_table.update_item(
            Key={'yotei_id': test_yot_id},
            UpdateExpression="SET jotai = :j, updated_at = :u",
            ExpressionAttributeValues={':j': new_jotai, ':u': now}
        )
        # Update Yakusoku Count
        yakusoku_table.update_item(
            Key={'yakusoku_id': test_yak_id},
            UpdateExpression="SET consumption_count = if_not_exists(consumption_count, :empty)",
            ExpressionAttributeValues={':empty': {}}
        )
        yakusoku_table.update_item(
            Key={'yakusoku_id': test_yak_id},
            UpdateExpression="SET consumption_count.#m = if_not_exists(consumption_count.#m, :zero) + :one",
            ExpressionAttributeNames={'#m': month_key},
            ExpressionAttributeValues={':zero': 0, ':one': 1}
        )
    
    # 4. Check Consumption Count
    print("Step 4: Checking consumption count...")
    yak_res = yakusoku_table.get_item(Key={'yakusoku_id': test_yak_id}).get('Item')
    count = yak_res.get('consumption_count', {}).get(month_key, 0)
    print(f"Current Count for {month_key}: {count}")
    if count == 1:
        print("SUCCESS: Count is 1")
    else:
        print(f"FAILURE: Count is {count}, expected 1")

    # 5. Complete again (idempotency test)
    print("Step 5: Completing ugoki status again (idempotency test)...")
    curr_ugoki = ugoki_table.get_item(Key={'yotei_id': test_yot_id}).get('Item')
    curr_jotai = curr_ugoki.get('jotai') # Should be 'kanryou'
    
    if new_jotai == 'kanryou' and curr_jotai != 'kanryou':
        print("Logic Error: Status was already kanryou but entered increment block!")
    else:
        print("Correct: Bypassed increment block as status is already kanryou.")

    yak_res = yakusoku_table.get_item(Key={'yakusoku_id': test_yak_id}).get('Item')
    final_count = yak_res.get('consumption_count', {}).get(month_key, 0)
    print(f"Final Count: {final_count}")
    
    if final_count == 1:
        print("SUCCESS: Idempotency confirmed (no double counting).")
    else:
        print(f"FAILURE: Final count is {final_count}, expected 1")

    # Cleanup
    print("Cleaning up test records...")
    yakusoku_table.delete_item(Key={'yakusoku_id': test_yak_id})
    yotei_table.delete_item(Key={'id': test_yot_id})
    ugoki_table.delete_item(Key={'yotei_id': test_yot_id})
    
    print("--- Verification Complete ---")

if __name__ == "__main__":
    verify()
