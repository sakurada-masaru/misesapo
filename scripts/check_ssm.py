import boto3
import json

def check_ssm():
    try:
        ssm = boto3.client('ssm', region_name='ap-northeast-1')
        response = ssm.describe_instance_information()
        print("SSM Instances:")
        print(json.dumps(response['InstanceInformationList'], indent=2, default=str))
    except Exception as e:
        print(f"Error checking SSM: {str(e)}")

if __name__ == "__main__":
    check_ssm()
