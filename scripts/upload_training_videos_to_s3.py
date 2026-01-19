#!/usr/bin/env python3
"""
研修動画データをS3にアップロードするスクリプト
"""

import boto3
import json
import os
from pathlib import Path

# 環境変数から設定を取得
S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME', 'misesapo-cleaning-manual-images')
S3_REGION = os.environ.get('S3_REGION', 'ap-northeast-1')
TRAINING_VIDEOS_KEY = 'training-videos/data.json'

# プロジェクトのルートディレクトリ
ROOT = Path(__file__).resolve().parents[1]
TRAINING_VIDEOS_JSON = ROOT / 'src' / 'data' / 'training_videos.json'

def upload_training_videos_to_s3():
    """研修動画データをS3にアップロード"""
    # S3クライアントの初期化
    s3_client = boto3.client('s3', region_name=S3_REGION)
    
    # JSONファイルを読み込む
    if not TRAINING_VIDEOS_JSON.exists():
        print(f"❌ エラー: {TRAINING_VIDEOS_JSON} が見つかりません")
        return False
    
    print(f"📄 読み込み中: {TRAINING_VIDEOS_JSON}")
    with open(TRAINING_VIDEOS_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # S3にアップロード
    print(f"☁️  S3にアップロード中: s3://{S3_BUCKET_NAME}/{TRAINING_VIDEOS_KEY}")
    s3_client.put_object(
        Bucket=S3_BUCKET_NAME,
        Key=TRAINING_VIDEOS_KEY,
        Body=json.dumps(data, ensure_ascii=False, indent=2),
        ContentType='application/json'
    )
    
    print(f"✅ アップロード完了: s3://{S3_BUCKET_NAME}/{TRAINING_VIDEOS_KEY}")
    print(f"   カテゴリ数: {len(data.get('categories', []))}")
    
    # 動画の総数をカウント
    total_videos = sum(len(cat.get('videos', [])) for cat in data.get('categories', []))
    print(f"   動画総数: {total_videos}")
    
    return True

if __name__ == '__main__':
    try:
        success = upload_training_videos_to_s3()
        if success:
            print("\n✅ 研修動画データのアップロードが完了しました")
        else:
            print("\n❌ アップロードに失敗しました")
            exit(1)
    except Exception as e:
        print(f"\n❌ エラー: {e}")
        exit(1)

