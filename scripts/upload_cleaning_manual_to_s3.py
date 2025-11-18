#!/usr/bin/env python3
"""
既存の清掃マニュアルJSONデータをS3にアップロードするスクリプト
"""

import json
import os
import sys
from pathlib import Path

# プロジェクトのルートディレクトリ
ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "src" / "data"
CLEANING_MANUAL_JSON = DATA_DIR / "cleaning-manual.json"

# AWS設定
try:
    from dotenv import load_dotenv
    load_dotenv()
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_S3_BUCKET_NAME = os.getenv('AWS_S3_BUCKET_NAME', 'misesapo-cleaning-manual-images')
    AWS_S3_REGION = os.getenv('AWS_S3_REGION', 'ap-northeast-1')
except ImportError:
    print("Error: python-dotenv not installed. Install with: pip3 install python-dotenv")
    sys.exit(1)

# boto3のインポート
try:
    import boto3
except ImportError:
    print("Error: boto3 not installed. Install with: pip3 install boto3")
    sys.exit(1)

# S3キー
DATA_KEY = 'cleaning-manual/data.json'
DRAFT_KEY = 'cleaning-manual/draft.json'


def upload_to_s3(file_path, s3_key, bucket_name, region):
    """ファイルをS3にアップロード"""
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=region
        )
        
        print(f"Uploading {file_path} to s3://{bucket_name}/{s3_key}...")
        
        with open(file_path, 'rb') as f:
            s3_client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=f,
                ContentType='application/json'
            )
        
        print(f"✓ Successfully uploaded to s3://{bucket_name}/{s3_key}")
        return True
    except Exception as e:
        print(f"✗ Error uploading to S3: {e}")
        return False


def upload_json_data(json_data, s3_key, bucket_name, region):
    """JSONデータを直接S3にアップロード"""
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=region
        )
        
        print(f"Uploading JSON data to s3://{bucket_name}/{s3_key}...")
        
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=json.dumps(json_data, ensure_ascii=False, indent=2).encode('utf-8'),
            ContentType='application/json'
        )
        
        print(f"✓ Successfully uploaded to s3://{bucket_name}/{s3_key}")
        return True
    except Exception as e:
        print(f"✗ Error uploading to S3: {e}")
        return False


def main():
    """メイン処理"""
    print("=" * 60)
    print("清掃マニュアルデータをS3にアップロード")
    print("=" * 60)
    print("\n注意: 既存のS3バケットを使用します。")
    print("新しいバケットを作成する必要はありません。\n")
    
    # 環境変数のチェック
    if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
        print("Error: AWS認証情報が設定されていません。")
        print("以下の環境変数を設定してください:")
        print("  - AWS_ACCESS_KEY_ID")
        print("  - AWS_SECRET_ACCESS_KEY")
        print("  - AWS_S3_BUCKET_NAME (オプション、デフォルト: misesapo-cleaning-manual-images)")
        print("  - AWS_S3_REGION (オプション、デフォルト: ap-northeast-1)")
        print("\n.envファイルを作成するか、環境変数を設定してください。")
        sys.exit(1)
    
    print(f"\n設定:")
    print(f"  S3バケット: {AWS_S3_BUCKET_NAME} (既存のバケット)")
    print(f"  リージョン: {AWS_S3_REGION}")
    print(f"  データキー: {DATA_KEY}")
    print(f"\nバケット内の構造:")
    print(f"  {AWS_S3_BUCKET_NAME}/")
    print(f"  ├── cleaning-manual-images/  (画像ファイル - 既存)")
    print(f"  └── cleaning-manual/         (データファイル - 新規追加)")
    print(f"      └── data.json")
    print()
    
    # JSONファイルの存在確認
    if not CLEANING_MANUAL_JSON.exists():
        print(f"Error: {CLEANING_MANUAL_JSON} が見つかりません。")
        sys.exit(1)
    
    # JSONファイルを読み込む
    try:
        with open(CLEANING_MANUAL_JSON, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✓ JSONファイルを読み込みました: {CLEANING_MANUAL_JSON}")
        print(f"  データ構造:")
        print(f"    - kitchen: {len(data.get('kitchen', []))} 項目")
        print(f"    - aircon: {len(data.get('aircon', []))} 項目")
        print(f"    - floor: {len(data.get('floor', []))} 項目")
        print(f"    - other: {len(data.get('other', []))} 項目")
        print()
    except Exception as e:
        print(f"Error: JSONファイルの読み込みに失敗しました: {e}")
        sys.exit(1)
    
    # S3にアップロード
    success = upload_json_data(data, DATA_KEY, AWS_S3_BUCKET_NAME, AWS_S3_REGION)
    
    if success:
        print("\n" + "=" * 60)
        print("✓ アップロード完了!")
        print("=" * 60)
        print(f"\nS3 URL: https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{DATA_KEY}")
        print("\n次のステップ:")
        print("1. Lambda関数をデプロイして、API Gatewayの設定を更新してください")
        print("2. API GatewayでGETメソッドを追加してください（まだの場合）")
        print("3. ブラウザで動作確認してください")
    else:
        print("\n" + "=" * 60)
        print("✗ アップロード失敗")
        print("=" * 60)
        sys.exit(1)


if __name__ == '__main__':
    main()

