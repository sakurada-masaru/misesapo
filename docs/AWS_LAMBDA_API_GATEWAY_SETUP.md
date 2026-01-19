# AWS Lambda + API Gateway でS3アップロードAPIを作成

GitHub Pages環境でも画像をアップロードできるように、AWS Lambda + API GatewayでS3アップロード用のAPIエンドポイントを作成します。

## 前提条件

1. AWSアカウントを持っていること
2. AWS S3バケットが既に作成されていること
3. IAMユーザーのアクセスキーが取得済みであること

## 手順

### ステップ1: Lambda関数を作成

#### 1-1. Lambda関数の作成

1. **AWS Console** (https://console.aws.amazon.com/) にアクセス
2. 検索バーに「**Lambda**」と入力して選択
3. **「関数の作成」** をクリック
4. **「一から作成」** を選択
5. **基本設定**:
   - **関数名**: `misesapo-s3-upload`
   - **ランタイム**: `Python 3.11` または `Python 3.12`
   - **アーキテクチャ**: `x86_64`
6. **「関数の作成」** をクリック

#### 1-2. Lambda関数のコードを記述

Lambda関数のコードエディタに以下のコードを貼り付け：

```python
import json
import boto3
import base64
import os
from datetime import datetime
from urllib.parse import unquote

# S3クライアントの初期化
s3_client = boto3.client('s3')

# 環境変数から設定を取得
S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME', 'misesapo-cleaning-manual-images')
S3_REGION = os.environ.get('S3_REGION', 'ap-northeast-1')
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', '*').split(',')

def lambda_handler(event, context):
    """
    S3に画像をアップロードするLambda関数
    """
    # CORSヘッダー
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    }
    
    # OPTIONSリクエスト（プリフライト）の処理
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'message': 'OK'})
        }
    
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        # multipart/form-dataの解析
        # API Gatewayから直接multipart/form-dataを受け取るのは複雑なため、
        # クライアント側でbase64エンコードして送信する方法を使用
        
        # リクエストボディがJSONの場合
        if isinstance(body, str):
            try:
                body_json = json.loads(body)
            except:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Invalid JSON'})
                }
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # 画像データとメタデータを取得
        image_data = base64.b64decode(body_json.get('image'))
        file_name = body_json.get('fileName', 'image.jpg')
        content_type = body_json.get('contentType', 'image/jpeg')
        
        # ファイル名を生成（タイムスタンプ + 元のファイル名）
        timestamp = int(datetime.now().timestamp() * 1000)
        safe_file_name = file_name.replace(' ', '_').replace('/', '_')
        s3_key = f"cleaning-manual-images/{timestamp}_{safe_file_name}"
        
        # S3にアップロード
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Body=image_data,
            ContentType=content_type,
            ACL='public-read'  # パブリック読み取りを許可
        )
        
        # S3の公開URLを生成
        s3_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '画像をS3にアップロードしました',
                'url': s3_url,
                'path': s3_url
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'アップロードに失敗しました',
                'message': str(e)
            })
        }
```

#### 1-3. 環境変数の設定

Lambda関数の設定画面で：

1. **「設定」** タブ → **「環境変数」** をクリック
2. **「環境変数を編集」** をクリック
3. 以下の環境変数を追加：
   - `S3_BUCKET_NAME`: `misesapo-cleaning-manual-images`（実際のバケット名）
   - `S3_REGION`: `ap-northeast-1`
   - `ALLOWED_ORIGINS`: `*`（または特定のオリジン、例: `https://sakurada-masaru.github.io`）

#### 1-4. IAMロールの権限設定

1. Lambda関数の設定画面で **「設定」** タブ → **「アクセス権限」** をクリック
2. **「ロール名」** をクリック（IAMコンソールが開く）
3. **「ポリシーをアタッチ」** をクリック
4. **「AmazonS3FullAccess」** を検索して選択
5. **「ポリシーをアタッチ」** をクリック

### ステップ2: API GatewayでREST APIを作成

#### 2-1. REST APIの作成

1. **AWS Console** で検索バーに「**API Gateway**」と入力して選択
2. **「API を作成」** をクリック
3. **「REST API」** の **「構築」** をクリック
4. **「新しいAPI」** を選択
5. **API名**: `misesapo-s3-upload-api`
6. **「API の作成」** をクリック

#### 2-2. リソースとメソッドの作成

1. **「アクション」** → **「リソースの作成」** をクリック
2. **リソース名**: `upload`
3. **「リソースの作成」** をクリック
4. `upload` リソースを選択
5. **「アクション」** → **「メソッドの作成」** をクリック
6. **メソッド**: `POST` を選択
7. **統合タイプ**: `Lambda関数` を選択
8. **Lambda関数**: `misesapo-s3-upload` を選択
9. **「保存」** をクリック
10. **「Lambda関数に権限を追加」** のダイアログで **「OK」** をクリック

#### 2-3. OPTIONSメソッドの追加（CORS用）

1. `upload` リソースを選択
2. **「アクション」** → **「メソッドの作成」** をクリック
3. **メソッド**: `OPTIONS` を選択
4. **統合タイプ**: `MOCK` を選択
5. **「保存」** をクリック
6. **「統合リクエスト」** をクリック
7. **「統合レスポンス」** をクリック
8. **「200」** のステータスコードを選択
9. **「ヘッダーのマッピング」** で以下を追加：
   - `Access-Control-Allow-Origin`: `'*'`
   - `Access-Control-Allow-Headers`: `'Content-Type'`
   - `Access-Control-Allow-Methods`: `'POST, OPTIONS'`
10. **「保存」** をクリック

#### 2-4. CORSの有効化

1. `upload` リソースを選択
2. **「アクション」** → **「CORS を有効にする」** をクリック
3. **「アクセス制御を許可するオリジン」**: `*`（または特定のオリジン）
4. **「アクセス制御を許可するヘッダー」**: `Content-Type`
5. **「アクセス制御を許可するメソッド」**: `POST, OPTIONS` にチェック
6. **「CORS を有効にして既存の CORS ヘッダーを置き換える」** をクリック
7. **「はい、既存の値を置き換えます」** をクリック

#### 2-5. APIのデプロイ

1. **「アクション」** → **「API のデプロイ」** をクリック
2. **デプロイされるステージ**: `[新しいステージ]` を選択
3. **ステージ名**: `prod` と入力
4. **「デプロイ」** をクリック
5. **「呼び出しURL」** をコピー（例: `https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod`）

### ステップ3: クライアント側のコードを修正

#### 3-1. API Gatewayのエンドポイントを設定

`src/assets/js/aws-s3-upload.js` を修正して、API Gatewayのエンドポイントを使用するようにします。

```javascript
/**
 * 開発サーバーのAPIエンドポイントを取得
 */
function getApiEndpoint() {
    // 開発サーバーが利用可能な場合は、開発サーバーのエンドポイントを使用
    const hostname = window.location.hostname;
    const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
    
    if (isLocalDev) {
        return `${window.location.protocol}//${window.location.host}`;
    }
    
    // GitHub Pages環境の場合、API Gatewayのエンドポイントを使用
    // このURLは、API Gatewayのデプロイ時に取得した「呼び出しURL」を使用
    return 'https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod';
}
```

#### 3-2. アップロード処理を修正

API Gatewayはmultipart/form-dataを直接処理できないため、base64エンコードしてJSONで送信する方法に変更します。

```javascript
/**
 * S3に画像をアップロード（API Gateway経由）
 */
async function uploadToS3(file, fieldName) {
    const apiEndpoint = getApiEndpoint();
    
    if (!apiEndpoint) {
        throw new Error('S3へのアップロードには開発サーバーまたはAPI Gatewayが必要です。');
    }
    
    // ファイルをbase64エンコード
    const base64Data = await fileToBase64(file);
    
    // API Gateway経由でアップロード
    const response = await fetch(`${apiEndpoint}/upload`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image: base64Data,
            fileName: file.name,
            contentType: file.type || 'image/jpeg'
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`S3アップロードエラー: ${errorData.message || errorData.error}`);
    }
    
    const result = await response.json();
    return {
        url: result.url || result.path,
        path: result.path || result.url
    };
}

/**
 * ファイルをbase64エンコード
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // data:image/jpeg;base64,xxxxx の形式から base64部分だけを取得
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
```

## トラブルシューティング

### Lambda関数のエラー

1. **CloudWatch Logsでログを確認**
   - Lambda関数の画面で **「モニタリング」** タブ → **「CloudWatch Logs を表示」** をクリック
   - エラーメッセージを確認

2. **IAMロールの権限を確認**
   - S3への書き込み権限があるか確認

### API Gatewayのエラー

1. **CORSエラーが発生する場合**
   - API GatewayのCORS設定を確認
   - Lambda関数のレスポンスヘッダーを確認

2. **500エラーが発生する場合**
   - Lambda関数のログを確認
   - リクエストボディの形式を確認

### クライアント側のエラー

1. **ネットワークエラー**
   - API GatewayのエンドポイントURLが正しいか確認
   - ブラウザのコンソールでエラーメッセージを確認

2. **認証エラー**
   - API Gatewayの認証設定を確認（認証なしで公開する場合は、リソースポリシーで制限）

## セキュリティの考慮事項

1. **API Gatewayのレート制限を設定**
   - API Gatewayの設定でレート制限を設定して、悪用を防ぐ

2. **リソースポリシーでアクセス制限**
   - 特定のIPアドレスやオリジンのみからアクセスできるように制限

3. **Lambda関数のタイムアウト設定**
   - 大きなファイルのアップロードに対応できるようにタイムアウトを調整（最大15分）

4. **ファイルサイズ制限**
   - API Gatewayのペイロードサイズ制限（10MB）を考慮
   - より大きなファイルの場合は、S3プリサインドURLを使用する方法を検討

## 参考

- [AWS Lambda ドキュメント](https://docs.aws.amazon.com/lambda/)
- [Amazon API Gateway ドキュメント](https://docs.aws.amazon.com/apigateway/)
- [AWS S3 ドキュメント](https://docs.aws.amazon.com/s3/)

