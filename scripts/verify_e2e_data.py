import boto3
import datetime
import uuid
import sys
import json

# Initialize DynamoDB Client (not Resource, to match successful describe_table)
dynamodb = boto3.client('dynamodb', region_name='ap-northeast-1')

SCHEDULES_TABLE_NAME = 'schedules'
REPORTS_TABLE_NAME = 'staff-reports'

def verify_data_integrity():
    print("Starting Data Integrity Verification (using Client)...")
    
    # 1. Create Verification Schedule
    verify_schedule_id = f"SCH-VERIFY-{uuid.uuid4().hex[:8]}"
    store_id = "TEST-STORE-001" 
    
    print(f"Creating Verification Schedule: {verify_schedule_id}")
    try:
        dynamodb.put_item(
            TableName=SCHEDULES_TABLE_NAME,
            Item={
                'id': {'S': verify_schedule_id},
                'store_id': {'S': store_id},
                'status': {'S': 'scheduled'},
                'scheduled_date': {'S': datetime.datetime.now().strftime('%Y-%m-%d')},
                'scheduled_time': {'S': '12:00'},
                'created_at': {'S': datetime.datetime.now().isoformat()}
            }
        )
    except Exception as e:
        print(f"Error creating schedule: {e}")
        return

    # 2. Simulate Report Creation
    report_id = str(uuid.uuid4())
    now = datetime.datetime.now().isoformat()
    
    print(f"Creating Verification Report: {report_id} linked to {verify_schedule_id}")
    
    try:
        dynamodb.put_item(
            TableName=REPORTS_TABLE_NAME,
            Item={
                'report_id': {'S': report_id}, # Partition Key
                'created_at': {'S': now},      # Sort Key
                'updated_at': {'S': now},
                'schedule_id': {'S': verify_schedule_id},
                'store_id': {'S': store_id},
                'staff_id': {'S': 'VERIFY-STAFF'},
                'status': {'S': 'submitted'},
                'report_content': {'S': 'Verification Report Content'}
            }
        )
        print("Report created successfully.")
    except Exception as e:
        print(f"Error creating report: {e}")
        return
    
    # 3. Verify Linkage (Scan with Filter)
    print("Verifying Report retrieval by Schedule ID...")
    
    try:
        response = dynamodb.scan(
            TableName=REPORTS_TABLE_NAME,
            FilterExpression='#sid = :sid',
            ExpressionAttributeNames={'#sid': 'schedule_id'},
            ExpressionAttributeValues={':sid': {'S': verify_schedule_id}}
        )
        items = response.get('Items', [])
        
        if len(items) == 1:
            item = items[0]
            if item.get('report_id', {}).get('S') == report_id:
                print("SUCCESS: Report correctly linked to Schedule.")
            else:
                print(f"FAILURE: Found item but ID mismatch. Found: {item}")
        else:
            print(f"FAILURE: Could not find report. Found count: {len(items)}")
            
    except Exception as e:
        print(f"Error scanning reports: {e}")

    # 4. Clean up
    print("Cleaning up verification data...")
    try:
        dynamodb.delete_item(TableName=SCHEDULES_TABLE_NAME, Key={'id': {'S': verify_schedule_id}})
        dynamodb.delete_item(
            TableName=REPORTS_TABLE_NAME, 
            Key={
                'report_id': {'S': report_id},
                'created_at': {'S': now}
            }
        )
    except Exception as e:
        print(f"Error cleaning up: {e}")
        
    print("Verification and Cleanup Complete.")

if __name__ == "__main__":
    verify_data_integrity()
