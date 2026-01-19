# レポート機能のAWS設定ガイド

## 📋 概要

レポート機能を動作させるためのAWS設定手順です。

---

## 1. DynamoDBテーブルの作成

### テーブル名: `staff-reports`

#### ステップ1: テーブルを作成

1. **AWSコンソールにログイン**
   - https://console.aws.amazon.com/ にアクセス
   - DynamoDBサービスを選択

2. **テーブルを作成**
   - 「テーブルの作成」をクリック
   - 以下の設定を入力：
     - **テーブル名**: `staff-reports`
     - **パーティションキー**: `report_id` (データ型: **String** = 文字列)
     - **ソートキー**: `created_at` (データ型: **String** = 文字列)
   - **補足**: `String` は文字列型（テキスト）を意味します。AWSコンソールでは「文字列」と表示されます。
   - 「テーブルの作成」をクリック

#### ステップ2: GSI（グローバルセカンダリインデックス）を作成

テーブル作成後、以下の3つのGSIを追加：

##### GSI 1: `staff_id-created_at-index`
- **インデックス名**: `staff_id-created_at-index`
- **パーティションキー**: `staff_id` (データ型: **String** = 文字列)
- **ソートキー**: `created_at` (データ型: **String** = 文字列)
- **用途**: 清掃員が自分のレポート一覧を取得

##### GSI 2: `store_id-created_at-index`
- **インデックス名**: `store_id-created_at-index`
- **パーティションキー**: `store_id` (データ型: **String** = 文字列)
- **ソートキー**: `created_at` (データ型: **String** = 文字列)
- **用途**: 店舗ごとのレポート一覧を取得

##### GSI 3: `status-created_at-index`
- **インデックス名**: `status-created_at-index`
- **パーティションキー**: `status` (データ型: **String** = 文字列)
- **ソートキー**: `created_at` (データ型: **String** = 文字列)
- **用途**: ステータス別のレポート取得（将来: 承認待ちレポートの管理）

**手順**:

1. **GSI 1を作成**
   - テーブル `staff-reports` を選択
   - 「インデックス」タブを選択
   - 「インデックスの作成」をクリック
   - GSI 1の設定を入力して作成
   - **⏳ 待機**: インデックスのステータスが「**ACTIVE**」になるまで待つ（通常1-2分）
     - 「インデックス」タブでステータスを確認
     - 「作成中」→「**ACTIVE**」になったら次へ

2. **GSI 2を作成**
   - **GSI 1がACTIVE状態であることを確認**
   - 「インデックスの作成」をクリック
   - GSI 2の設定を入力して作成
   - **⏳ 待機**: インデックスのステータスが「**ACTIVE**」になるまで待つ

3. **GSI 3を作成**
   - **GSI 2がACTIVE状態であることを確認**
   - 「インデックスの作成」をクリック
   - GSI 3の設定を入力して作成
   - **⏳ 待機**: インデックスのステータスが「**ACTIVE**」になるまで待つ

**💡 ヒント**: 各インデックスの作成には通常1-2分かかります。3つすべてを作成するには合計で約3-6分かかります。

---

## 2. S3バケットの確認

### 既存バケット: `misesapo-cleaning-manual-images`

レポートの写真は既存のS3バケットに保存します。

#### 確認事項

1. **バケットが存在するか確認**
   - S3コンソールで `misesapo-cleaning-manual-images` を確認

2. **アクセス権限の確認**
   - バケットポリシーでLambda関数からの書き込みを許可
   - 公開読み取りを許可（写真の表示用）

#### バケットポリシー例

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowLambdaPutObject",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:role/YOUR_LAMBDA_ROLE"
      },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::misesapo-cleaning-manual-images/reports/*"
    },
    {
      "Sid": "AllowPublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::misesapo-cleaning-manual-images/reports/*"
    }
  ]
}
```

---

## 3. Lambda関数の更新

### ステップ1: Lambda関数にDynamoDB権限を追加

1. **IAMロールを確認**
   - Lambda関数の設定 → 実行ロールを確認
   - 例: `CreateAnnouncement-role-xxxxx`

2. **DynamoDB権限を追加**
   - IAMコンソールで該当ロールを選択
   - 「ポリシーをアタッチ」をクリック
   - `AmazonDynamoDBFullAccess` を選択（またはカスタムポリシーで `staff-reports` テーブルのみ許可）

### ステップ2: Lambda関数のコードをデプロイ

1. **Lambda関数を選択**
   - 既存のLambda関数（お知らせ機能で使用しているもの）を選択

2. **コードを更新**
   - `lambda_function.py` の最新版をアップロード
   - または、GitHubからデプロイしている場合は、コードをプッシュ

3. **環境変数の確認**
   - `S3_BUCKET_NAME`: `misesapo-cleaning-manual-images`
   - `S3_REGION`: `ap-northeast-1`

---

## 4. API Gatewayの設定

### ステップ1: 新しいリソースとメソッドを追加

**既存のAPI Gatewayを確認**:
- 既存のAPI Gatewayに `/announcements` リソースがあることを確認
- 同じAPI Gatewayに `/staff/reports` リソースを追加します

既存のAPI Gateway（お知らせ機能で使用しているもの）に以下を追加：

#### リソース: `/staff/reports`

1. **リソースを作成**
   - API Gatewayコンソールで既存のAPIを選択
   - 「リソース」→「リソースの作成」
   - **リソースパス**: `/staff/reports`
   - 「リソースの作成」をクリック

2. **メソッドを追加**

   ##### GET `/staff/reports`
   - 「アクション」→「メソッドの作成」→「GET」を選択
   - **統合タイプ**: Lambda関数
   - **Lambda関数**: 既存のLambda関数を選択
   - 「保存」をクリック

   ##### POST `/staff/reports`
   - 「アクション」→「メソッドの作成」→「POST」を選択
   - **統合タイプ**: Lambda関数
   - **Lambda関数**: 既存のLambda関数を選択
   - 「保存」をクリック

   ##### PUT `/staff/reports`
   - 「アクション」→「メソッドの作成」→「PUT」を選択
   - **統合タイプ**: Lambda関数
   - **Lambda関数**: 既存のLambda関数を選択
   - 「保存」をクリック

#### リソース: `/staff/reports/{report_id}`

1. **リソースを作成**
   - `/staff/reports` を選択
   - 「アクション」→「リソースの作成」
   - **リソースパス**: `{report_id}`
   - 「リソースの作成」をクリック

2. **メソッドを追加**

   ##### GET `/staff/reports/{report_id}`
   - 「アクション」→「メソッドの作成」→「GET」を選択
   - **統合タイプ**: Lambda関数
   - **Lambda関数**: 既存のLambda関数を選択
   - 「保存」をクリック

   ##### DELETE `/staff/reports/{report_id}`
   - 「アクション」→「メソッドの作成」→「DELETE」を選択
   - **統合タイプ**: Lambda関数
   - **Lambda関数**: 既存のLambda関数を選択
   - 「保存」をクリック

### ステップ2: CORS設定

各メソッドにCORSを設定：

1. **リソースを選択**
   - `/staff/reports` または `/staff/reports/{report_id}` を選択

2. **CORSを有効化**
   - 「アクション」→「CORSを有効にする」
   - 以下の設定を入力：
     - **Access-Control-Allow-Origin**: `*`（本番では特定のドメインを指定）
     - **Access-Control-Allow-Headers**: `Content-Type,Authorization`
     - **Access-Control-Allow-Methods**: `GET,POST,PUT,DELETE,OPTIONS`
   - 「CORSを有効にして既存のCORSヘッダーを置き換える」をクリック

### ステップ3: APIをデプロイ

1. **デプロイ**
   - 「アクション」→「APIのデプロイ」
   - **デプロイステージ**: `prod`（既存のステージを選択）
   - 「デプロイ」をクリック

2. **エンドポイントURLを確認**
   - デプロイ後、エンドポイントURLが表示されます
   - 例: `https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/prod`

---

## 5. フロントエンドの設定

### APIエンドポイントURLを更新

作成したページのJavaScriptで、APIエンドポイントURLを更新：

1. **`src/pages/admin/reports.html`**
   ```javascript
   const API_BASE_URL = 'https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod';
   ```

2. **`src/pages/admin/reports/new.html`**
   ```javascript
   const API_BASE_URL = 'https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod';
   ```

---

## 6. Firebase認証の統合（Lambda関数側）

### ステップ1: Firebase Admin SDKをLambdaレイヤーに追加

1. **Firebase Admin SDKをダウンロード**
   ```bash
   mkdir -p firebase-admin-layer/python
   pip install firebase-admin -t firebase-admin-layer/python/
   ```

2. **ZIPファイルを作成**
   ```bash
   cd firebase-admin-layer
   zip -r firebase-admin-layer.zip python/
   ```

3. **Lambdaレイヤーを作成**
   - Lambdaコンソール → 「レイヤー」→「レイヤーの作成」
   - ZIPファイルをアップロード
   - レイヤー名: `firebase-admin-layer`

4. **Lambda関数にレイヤーを追加**
   - Lambda関数の設定 → 「レイヤー」→「レイヤーの追加」
   - 作成したレイヤーを選択

### ステップ2: Firebase設定を環境変数に追加

1. **Firebase設定を取得**
   - Firebase Console → プロジェクト設定 → サービスアカウント
   - 「新しい秘密鍵の生成」をクリック
   - JSONファイルをダウンロード

2. **環境変数に追加**
   - Lambda関数の設定 → 「環境変数」
   - `FIREBASE_CONFIG`: Firebase設定JSONを文字列として追加

### ステップ3: Lambda関数のコードを更新

`lambda_function.py` の `verify_firebase_token` 関数を更新：

```python
import firebase_admin
from firebase_admin import credentials, auth
import json
import os

# Firebase Admin SDKの初期化
if not firebase_admin._apps:
    firebase_config_str = os.environ.get('FIREBASE_CONFIG', '{}')
    firebase_config = json.loads(firebase_config_str)
    cred = credentials.Certificate(firebase_config)
    firebase_admin.initialize_app(cred)

def verify_firebase_token(id_token):
    """
    Firebase ID Tokenを検証
    """
    try:
        decoded_token = auth.verify_id_token(id_token)
        return {
            'verified': True,
            'uid': decoded_token['uid'],
            'email': decoded_token.get('email'),
            'role': decoded_token.get('role', 'customer'),
            'name': decoded_token.get('name')
        }
    except Exception as e:
        print(f"Error verifying token: {str(e)}")
        return {'verified': False, 'error': str(e)}
```

---

## 7. テスト

### ステップ1: APIエンドポイントのテスト

1. **GET `/staff/reports` をテスト**
   ```bash
   curl -X GET "https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod/staff/reports" \
     -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN"
   ```

2. **POST `/staff/reports` をテスト**
   ```bash
   curl -X POST "https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod/staff/reports" \
     -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "store_id": "store-001",
       "store_name": "テスト店舗",
       "cleaning_date": "2025-03-28",
       "work_items": []
     }'
   ```

### ステップ2: フロントエンドのテスト

1. **レポート一覧ページを開く**
   - `/admin/reports.html` にアクセス
   - レポート一覧が表示されることを確認

2. **レポート作成ページを開く**
   - `/admin/reports/new.html` にアクセス
   - フォームが表示されることを確認
   - レポートを作成して送信

---

## 8. トラブルシューティング

### エラー: `Table not found: staff-reports`

**原因**: DynamoDBテーブルが作成されていない

**解決方法**:
1. DynamoDBコンソールでテーブルが存在するか確認
2. テーブル名が `staff-reports` であることを確認

### エラー: `Access Denied` (S3)

**原因**: Lambda関数にS3への書き込み権限がない

**解決方法**:
1. IAMロールに `AmazonS3FullAccess` を追加
2. または、カスタムポリシーで `misesapo-cleaning-manual-images/reports/*` への書き込み権限を追加

### エラー: `Unauthorized` (Firebase)

**原因**: Firebase IDトークンが無効または期限切れ

**解決方法**:
1. フロントエンドでFirebase IDトークンを正しく取得しているか確認
2. Lambda関数でFirebase Admin SDKが正しく初期化されているか確認
3. 環境変数 `FIREBASE_CONFIG` が正しく設定されているか確認

### ⚠️ GSI（インデックス）がいつまでも作成されない

**原因**: いくつかの原因が考えられます

**確認すべき点**:

1. **テーブルの状態を確認**
   - DynamoDBコンソールでテーブル `staff-reports` を開く
   - 「概要」タブでテーブルのステータスを確認
   - テーブルが「**アクティブ**」状態であることを確認
   - テーブルが「作成中」の場合は、アクティブになるまで待つ

2. **インデックスのステータスを確認**
   - 「インデックス」タブを開く
   - 作成中のインデックスのステータスを確認：
     - **「作成中」**: 正常に作成中です。通常1-2分で完了しますが、テーブルにデータがある場合は時間がかかることがあります
     - **「アクティブ」**: 作成完了です。次のインデックスを作成できます
     - **「削除中」**: 削除処理中です。完了するまで待つ必要があります
     - **エラー表示**: エラーが発生しています。詳細を確認してください

3. **テーブルにデータがある場合**
   - テーブルに既にデータが存在する場合、インデックスの作成に時間がかかります
   - データ量に応じて、数分から数十分かかることがあります
   - テーブルが空の場合は通常1-2分で完了します

4. **インデックスの設定を確認**
   - インデックス名、パーティションキー、ソートキーが正しく設定されているか確認
   - パーティションキーとソートキーのデータ型が「文字列」であることを確認

5. **エラーメッセージを確認**
   - インデックスの詳細を開いて、エラーメッセージがないか確認
   - エラーがある場合は、エラーメッセージに従って修正してください

6. **時間がかかりすぎる場合（10分以上）**
   - テーブルを削除して再作成することを検討
   - または、AWSサポートに問い合わせる

**解決方法**:

1. **待つ**: 通常は1-2分で完了しますが、データがある場合は10分以上かかることがあります
2. **ページをリロード**: ブラウザをリロードして最新のステータスを確認
3. **別のインデックスを試す**: 他のインデックスが作成できるか確認
4. **テーブルを再作成**: テーブルが空の場合は、削除して再作成することも検討

**💡 ヒント**: 
- テーブルが空の場合は、インデックスの作成は通常1-2分で完了します
- データがある場合は、データ量に応じて時間がかかります
- 大量のデータがある場合、インデックスの作成に30分以上かかることがあります

---

## 📝 チェックリスト

- [ ] DynamoDBテーブル `staff-reports` を作成
- [ ] GSI 3つを作成（`staff_id-created_at-index`, `store_id-created_at-index`, `status-created_at-index`）
- [ ] S3バケット `misesapo-cleaning-manual-images` のアクセス権限を確認
- [ ] Lambda関数にDynamoDB権限を追加
- [ ] Lambda関数にS3権限を追加
- [ ] API Gatewayに `/staff/reports` リソースを追加
- [ ] API Gatewayに `/staff/reports/{report_id}` リソースを追加
- [ ] CORSを設定
- [ ] APIをデプロイ
- [ ] フロントエンドのAPIエンドポイントURLを更新
- [ ] Firebase Admin SDKをLambdaレイヤーに追加
- [ ] Firebase設定を環境変数に追加
- [ ] Lambda関数のコードを更新
- [ ] テストを実行

---

## 🎯 次のステップ

AWS設定が完了したら、以下の実装を続けます：

1. レポート詳細ページ（ユーザー向け `/reports/{id}.html`）
2. レポート編集ページ（管理者向け `/admin/reports/{id}/edit.html`）
3. Firebase認証の統合（フロントエンド側）

