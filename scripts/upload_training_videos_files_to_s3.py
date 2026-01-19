#!/usr/bin/env python3
"""
研修動画ファイルをS3にアップロードするスクリプト
"""

import boto3
import json
import os
from pathlib import Path

# 環境変数から設定を取得
try:
    from dotenv import load_dotenv
    load_dotenv()
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_S3_BUCKET_NAME = os.getenv('AWS_S3_BUCKET_NAME', 'misesapo-cleaning-manual-images')
    AWS_S3_REGION = os.getenv('AWS_S3_REGION', 'ap-northeast-1')
except ImportError:
    print("Error: python-dotenv not installed. Install with: pip3 install python-dotenv")
    exit(1)

# プロジェクトのルートディレクトリ
ROOT = Path(__file__).resolve().parents[1]
MOVIE_DIR = ROOT / 'src' / 'assets' / 'movie'

def upload_video_to_s3(file_path, s3_key, bucket_name, region):
    """動画ファイルをS3にアップロード"""
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=region
        )
        
        print(f"📤 アップロード中: {file_path.name} → s3://{bucket_name}/{s3_key}")
        
        # ファイルサイズを確認
        file_size = file_path.stat().st_size
        file_size_mb = file_size / (1024 * 1024)
        print(f"   ファイルサイズ: {file_size_mb:.2f} MB")
        
        # S3にアップロード
        with open(file_path, 'rb') as f:
            s3_client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=f,
                ContentType='video/mp4'
            )
        
        # S3の公開URLを生成
        s3_url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{s3_key}"
        print(f"✅ アップロード完了: {s3_url}")
        return s3_url
    except Exception as e:
        print(f"❌ エラー: {e}")
        return None

def main():
    """メイン処理"""
    print("=" * 60)
    print("研修動画ファイルをS3にアップロード")
    print("=" * 60)
    print()
    
    # 環境変数のチェック
    if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
        print("❌ エラー: AWS認証情報が設定されていません。")
        print("以下の環境変数を設定してください:")
        print("  - AWS_ACCESS_KEY_ID")
        print("  - AWS_SECRET_ACCESS_KEY")
        print("  - AWS_S3_BUCKET_NAME (オプション、デフォルト: misesapo-cleaning-manual-images)")
        print("  - AWS_S3_REGION (オプション、デフォルト: ap-northeast-1)")
        print("\n.envファイルを作成するか、環境変数を設定してください。")
        exit(1)
    
    print(f"設定:")
    print(f"  S3バケット: {AWS_S3_BUCKET_NAME}")
    print(f"  リージョン: {AWS_S3_REGION}")
    print()
    
    # 動画ディレクトリの確認
    if not MOVIE_DIR.exists():
        print(f"❌ エラー: {MOVIE_DIR} が見つかりません。")
        exit(1)
    
    # 動画ファイルを検索
    video_files = list(MOVIE_DIR.glob('*.mp4'))
    if not video_files:
        print(f"❌ エラー: {MOVIE_DIR} に動画ファイルが見つかりません。")
        exit(1)
    
    print(f"📁 動画ファイル: {len(video_files)} 件")
    print()
    
    # 各動画ファイルをアップロード
    uploaded_videos = {}
    for video_file in video_files:
        # S3キーを生成（training-videos/ファイル名）
        s3_key = f"training-videos/{video_file.name}"
        s3_url = upload_video_to_s3(video_file, s3_key, AWS_S3_BUCKET_NAME, AWS_S3_REGION)
        
        if s3_url:
            uploaded_videos[video_file.name] = s3_url
        print()
    
    # アップロード結果を表示
    print("=" * 60)
    print("✅ アップロード完了!")
    print("=" * 60)
    print()
    print("アップロードされた動画:")
    for filename, url in uploaded_videos.items():
        print(f"  - {filename}")
        print(f"    URL: {url}")
    print()
    print("次のステップ:")
    print("1. training_videos.jsonのvideo_urlをS3のURLに更新してください")
    print("2. 更新したJSONをS3にアップロードしてください（scripts/upload_training_videos_to_s3.py）")
    
    # JSONファイルを更新するか確認
    print()
    update_json = input("training_videos.jsonのvideo_urlを自動更新しますか？ (y/n): ").strip().lower()
    if update_json == 'y':
        update_json_file(uploaded_videos)

def update_json_file(uploaded_videos):
    """training_videos.jsonのvideo_urlを更新"""
    json_file = ROOT / 'src' / 'data' / 'training_videos.json'
    
    if not json_file.exists():
        print(f"❌ エラー: {json_file} が見つかりません。")
        return
    
    # JSONファイルを読み込む
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # video_urlを更新
    updated = False
    for category in data.get('categories', []):
        for video in category.get('videos', []):
            video_url = video.get('video_url', '')
            # ローカルパス（/movie/で始まる）をS3のURLに置き換え
            if video_url.startswith('/movie/'):
                filename = video_url.replace('/movie/', '')
                if filename in uploaded_videos:
                    video['video_url'] = uploaded_videos[filename]
                    updated = True
                    print(f"✅ 更新: {video.get('title')} → {uploaded_videos[filename]}")
    
    if updated:
        # JSONファイルを保存
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print()
        print(f"✅ {json_file} を更新しました。")
    else:
        print("⚠️  更新するvideo_urlが見つかりませんでした。")

if __name__ == '__main__':
    main()

