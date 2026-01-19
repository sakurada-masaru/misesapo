import boto3
import json

def describe_table():
    dynamodb = boto3.client('dynamodb', region_name='ap-northeast-1')
    table_name = 'staff-reports'
    
    try:
        response = dynamodb.describe_table(TableName=table_name)
        table = response['Table']
        print(f"Table: {table_name}")
        print("KeySchema:")
        for key in table['KeySchema']:
            print(f"  - {key['AttributeName']} ({key['KeyType']})")
            
        print("AttributeDefinitions:")
        for attr in table['AttributeDefinitions']:
            print(f"  - {attr['AttributeName']} ({attr['AttributeType']})")
            
    except Exception as e:
        print(f"Error describing table: {e}")

if __name__ == "__main__":
    describe_table()
