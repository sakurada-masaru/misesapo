#!/usr/bin/env python3
"""
WIKIデータをS3にアップロードするスクリプト
"""

import json
import os
import sys
from pathlib import Path

# プロジェクトのルートディレクトリ
ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "src" / "data"
WIKI_ENTRIES_JSON = DATA_DIR / "wiki_entries.json"

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
WIKI_KEY = 'wiki/wiki_entries.json'


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
            Body=json.dumps(json_data, ensure_ascii=False, indent=2),
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
    print("WIKIデータをS3にアップロード")
    print("=" * 60)
    print()
    
    # 環境変数の確認
    if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
        print("Error: AWS認証情報が設定されていません")
        print("以下の環境変数を設定してください:")
        print("  - AWS_ACCESS_KEY_ID")
        print("  - AWS_SECRET_ACCESS_KEY")
        print("  - AWS_S3_BUCKET_NAME (オプション、デフォルト: misesapo-cleaning-manual-images)")
        print("  - AWS_S3_REGION (オプション、デフォルト: ap-northeast-1)")
        print()
        print(".envファイルを作成するか、環境変数を設定してください")
        sys.exit(1)
    
    # JSONファイルを読み込む
    if not WIKI_ENTRIES_JSON.exists():
        print(f"Error: WIKIデータファイルが見つかりません: {WIKI_ENTRIES_JSON}")
        sys.exit(1)
    
    try:
        with open(WIKI_ENTRIES_JSON, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✓ JSONファイルを読み込みました: {WIKI_ENTRIES_JSON}")
        print(f"  データ構造:")
        print(f"    - entries: {len(data.get('entries', []))} 項目")
        print(f"    - categories: {len(data.get('categories', []))} 項目")
        print()
    except Exception as e:
        print(f"Error: JSONファイルの読み込みに失敗しました: {e}")
        sys.exit(1)
    
    # S3にアップロード
    success = upload_json_data(data, WIKI_KEY, AWS_S3_BUCKET_NAME, AWS_S3_REGION)
    
    if success:
        print("\n" + "=" * 60)
        print("✓ アップロード完了!")
        print("=" * 60)
        print(f"\nS3 URL: https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{WIKI_KEY}")
        print("\n次のステップ:")
        print("1. WIKIページをリロードして、データが表示されることを確認してください")
        print("2. API Gatewayの設定が正しいことを確認してください")
    else:
        print("\n" + "=" * 60)
        print("✗ アップロード失敗")
        print("=" * 60)
        sys.exit(1)


if __name__ == '__main__':
    main()

