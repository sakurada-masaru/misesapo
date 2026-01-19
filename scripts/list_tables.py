import boto3

def list_tables():
    dynamodb = boto3.client('dynamodb', region_name='ap-northeast-1')
    response = dynamodb.list_tables()
    
    print("Existing DynamoDB Tables:")
    for table in response.get('TableNames', []):
        print(f"- {table}")

if __name__ == "__main__":
    list_tables()
