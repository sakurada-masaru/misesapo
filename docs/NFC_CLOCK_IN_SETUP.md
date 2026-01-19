# NFCタグ打刻システム - セットアップガイド

## 📚 関連ドキュメント

- **[クイックスタートガイド](./NFC_CLOCK_IN_QUICK_START.md)** - 具体的な手順をステップバイステップで説明

## 概要

NFCタグ打刻システムのバックエンド基盤をAWS上に構築するためのセットアップガイドです。

## システム構成

- **API Gateway**: HTTP POSTリクエストを受け付ける
- **Lambda関数**: 打刻データを処理し、DynamoDBに保存
- **DynamoDB**: 打刻ログを保存するデータベース

## 1. DynamoDBテーブルの作成

### テーブル名
`cleaning-logs`

### テーブル設定

| 項目 | 値 |
|------|-----|
| テーブル名 | `cleaning-logs` |
| パーティションキー | `log_id` (String) |
| ソートキー | `timestamp` (String) |

### テーブル作成手順

1. AWSマネジメントコンソールでDynamoDBを開く
2. 「テーブルの作成」をクリック
3. 以下の設定を入力：
   - **テーブル名**: `cleaning-logs`
   - **パーティションキー**: `log_id` (文字列)
   - **ソートキー**: `timestamp` (文字列)
4. 「テーブルの作成」をクリック

### データ構造

保存されるデータの例：

```json
{
  "log_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-15T10:30:00.123456+00:00",
  "user_id": "WKR_001",
  "facility_id": "ABC_001",
  "location_id": "TK_R01_TOILET_IN",
  "created_at": "2025-01-15T10:30:00.123456+00:00"
}
```

## 2. Lambda関数の設定

### 関数名
既存のLambda関数（例: `misesapo-s3-upload`）にエンドポイントを追加

### エンドポイント
`POST /staff/nfc/clock-in`

### リクエスト形式

```json
{
  "user_id": "WKR_001",
  "facility_id": "ABC_001",
  "location_id": "TK_R01_TOILET_IN"
}
```

### レスポンス形式

**成功時 (200)**:
```json
{
  "status": "success",
  "message": "Clock-in recorded",
  "log_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-15T10:30:00.123456+00:00"
}
```

**エラー時 (400)**:
```json
{
  "error": "user_id is required"
}
```

## 3. IAMポリシーの設定

Lambda関数に以下のIAMポリシーを付与する必要があります。

### 最小限のIAMポリシー

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/cleaning-logs"
    }
  ]
}
```

### IAMポリシーの設定手順

1. AWSマネジメントコンソールでIAMを開く
2. 「ロール」を選択
3. Lambda関数に紐づいているロールを選択（例: `misesapo-s3-upload-role`）
4. 「ポリシーをアタッチ」をクリック
5. 「ポリシーを作成」をクリック
6. JSONタブを選択し、上記のポリシーを貼り付け
7. ポリシー名を入力（例: `CleaningLogsWritePolicy`）
8. 「ポリシーを作成」をクリック
9. 作成したポリシーをロールにアタッチ

### 既存のポリシーに追加する場合

既存のポリシーがある場合は、以下のように`Statement`配列に追加してください：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/cleaning-logs"
    },
    // ... 既存のStatement ...
  ]
}
```

## 4. API Gatewayの設定

### エンドポイントの追加

1. API Gatewayコンソールで対象のAPIを開く
2. `/staff/nfc/clock-in` リソースを作成（または既存の`/staff`リソースの下に`/nfc/clock-in`を追加）
3. **POST**メソッドを追加
4. 統合タイプ: `Lambda関数`を選択
5. Lambda関数: 対象のLambda関数を選択（例: `misesapo-s3-upload`）
6. **「Lambdaプロキシ統合を使用」**にチェックを入れる
7. 「保存」をクリック
8. Lambda関数の権限を許可するか確認された場合は「OK」をクリック

### OPTIONSメソッドの追加（CORS対応）

1. 同じリソースに**OPTIONS**メソッドを追加
2. 統合タイプ: `MOCK`を選択
3. 「統合レスポンス」で以下のヘッダーを設定：
   - `Access-Control-Allow-Origin`: `*`
   - `Access-Control-Allow-Headers`: `Content-Type,Authorization`
   - `Access-Control-Allow-Methods`: `POST,OPTIONS`

## 5. セットアップスクリプトの実行（オプション）

### 自動セットアップスクリプト

プロジェクトには、AWSリソースを自動的に作成するスクリプトが含まれています：

```bash
# AWS認証情報を設定（必要に応じて）
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=ap-northeast-1

# セットアップスクリプトを実行
./scripts/setup_nfc_clock_in.sh
```

このスクリプトは以下を自動的に実行します：
1. DynamoDBテーブル `cleaning-logs` の作成
2. IAMポリシー `CleaningLogsWritePolicy` の作成
3. Lambda関数のロールへのポリシーアタッチ

**注意**: スクリプト内の変数（Lambda関数名、API Gateway名など）を環境に合わせて変更してください。

### テストスクリプト

APIの動作確認用のテストスクリプトも用意されています：

```bash
# API GatewayのURLを設定
export API_GATEWAY_URL=https://YOUR_API_GATEWAY_URL/prod

# テストスクリプトを実行
./scripts/test_nfc_clock_in.sh
```

## 6. テスト

### cURLでのテスト例

```bash
curl -X POST https://YOUR_API_GATEWAY_URL/prod/staff/nfc/clock-in \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "WKR_001",
    "facility_id": "ABC_001",
    "location_id": "TK_R01_TOILET_IN"
  }'
```

### 成功時のレスポンス

```json
{
  "status": "success",
  "message": "Clock-in recorded",
  "log_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-15T10:30:00.123456+00:00"
}
```

## 7. 打刻ログ取得API

打刻ログを取得するAPIも実装されています。

### エンドポイント
`GET /staff/nfc/clock-in`

### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| user_id | String | 任意 | ユーザーIDでフィルタ |
| facility_id | String | 任意 | 施設IDでフィルタ |
| location_id | String | 任意 | 場所IDでフィルタ |
| start_date | String | 任意 | 開始日時（ISO 8601形式） |
| end_date | String | 任意 | 終了日時（ISO 8601形式） |
| limit | Integer | 任意 | 取得件数（デフォルト: 100、最大: 1000） |

### レスポンス例

```json
{
  "status": "success",
  "count": 2,
  "logs": [
    {
      "log_id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2025-01-15T10:30:00.123456+00:00",
      "user_id": "WKR_001",
      "facility_id": "ABC_001",
      "location_id": "TK_R01_TOILET_IN",
      "created_at": "2025-01-15T10:30:00.123456+00:00"
    },
    {
      "log_id": "660e8400-e29b-41d4-a716-446655440001",
      "timestamp": "2025-01-15T09:15:00.123456+00:00",
      "user_id": "WKR_001",
      "facility_id": "ABC_001",
      "location_id": "TK_R01_TOILET_OUT",
      "created_at": "2025-01-15T09:15:00.123456+00:00"
    }
  ]
}
```

### 使用例

```bash
# 特定ユーザーのログを取得
curl "https://YOUR_API_GATEWAY_URL/prod/staff/nfc/clock-in?user_id=WKR_001&limit=50"

# 特定施設のログを取得
curl "https://YOUR_API_GATEWAY_URL/prod/staff/nfc/clock-in?facility_id=ABC_001"

# 日時範囲でフィルタ
curl "https://YOUR_API_GATEWAY_URL/prod/staff/nfc/clock-in?start_date=2025-01-15T00:00:00Z&end_date=2025-01-15T23:59:59Z"
```

## 8. トラブルシューティング

### エラー: "user_id is required"

- リクエストボディに`user_id`が含まれているか確認
- JSON形式が正しいか確認

### エラー: "Internal server error"

- CloudWatch LogsでLambda関数のエラーログを確認
- DynamoDBテーブルが正しく作成されているか確認
- IAMポリシーが正しく設定されているか確認

### エラー: "AccessDeniedException"

- Lambda関数のIAMロールにDynamoDBへの書き込み権限があるか確認
- リソースARNが正しいか確認（リージョン名を含む）

## 9. データクエリ例

### 特定ユーザーの打刻ログを取得

```python
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('cleaning-logs')

# スキャンでuser_idでフィルタリング
response = table.scan(
    FilterExpression=Key('user_id').eq('WKR_001')
)

items = response['Items']
```

### 特定施設の打刻ログを取得

```python
response = table.scan(
    FilterExpression=Key('facility_id').eq('ABC_001')
)
```

## 10. セキュリティ考慮事項

- 本番環境では、API Gatewayに認証（API Key、Cognito等）を追加することを推奨
- DynamoDBのアクセス制御を適切に設定
- CloudWatch Logsで監視を設定

## 11. コスト最適化

- DynamoDBのオンデマンドモードまたはプロビジョニングモードを選択
- 必要に応じてTTL（Time To Live）を設定して古いログを自動削除
- CloudWatch Logsの保持期間を設定

