# API Gateway CORS設定: 研修動画エンドポイント

研修動画データ（`/training-videos`）エンドポイントのCORS設定手順です。

## 前提条件

- API Gatewayで`/training-videos`リソースが作成済み
- Lambda関数が`/training-videos`エンドポイントを処理するように設定済み

## 手順

### 1. API Gatewayコンソールを開く

1. AWSコンソールにログイン
2. **API Gateway**サービスを開く
3. 対象のAPI（例: `misesapo-api`）を選択

### 2. `/training-videos`リソースを確認

1. 左側のリソースツリーで`/training-videos`を探す
2. 存在しない場合は作成する必要があります（後述）

### 3. リソースが存在しない場合の作成手順

#### 3.1 リソースの作成

1. 親リソース（通常は`/`）を選択
2. **アクション** → **リソースの作成**をクリック
3. **リソース名**: `training-videos`
4. **リソースパス**: `/training-videos`（自動入力）
5. **リソースの作成**をクリック

#### 3.2 メソッドの追加

`/training-videos`リソースを選択し、以下のメソッドを追加：

##### GET メソッド

1. **アクション** → **メソッドの作成** → **GET**を選択
2. **統合タイプ**: **Lambda関数**を選択
3. **Lambda関数**: 対象のLambda関数名を入力（例: `misesapo-api-handler`）
4. **保存**をクリック
5. **Lambda関数へのアクセス権限を付与しますか？** → **OK**をクリック

##### PUT メソッド

1. **アクション** → **メソッドの作成** → **PUT**を選択
2. **統合タイプ**: **Lambda関数**を選択
3. **Lambda関数**: 対象のLambda関数名を入力
4. **保存**をクリック
5. **Lambda関数へのアクセス権限を付与しますか？** → **OK**をクリック

##### POST メソッド（必要に応じて）

1. **アクション** → **メソッドの作成** → **POST**を選択
2. **統合タイプ**: **Lambda関数**を選択
3. **Lambda関数**: 対象のLambda関数名を入力
4. **保存**をクリック
5. **Lambda関数へのアクセス権限を付与しますか？** → **OK**をクリック

##### OPTIONS メソッド（CORS用）

1. **アクション** → **メソッドの作成** → **OPTIONS**を選択
2. **統合タイプ**: **MOCK**を選択
3. **保存**をクリック

### 4. CORSの有効化

#### 4.1 CORS設定を開く

1. `/training-videos`リソースを選択
2. **アクション** → **CORSの有効化**をクリック

#### 4.2 CORS設定を入力

以下の値を設定：

- **アクセス制御許可オリジン**: `*`（すべてのオリジンを許可）
- **アクセス制御許可ヘッダー**: 
  ```
  Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token
  ```
- **アクセス制御許可メソッド**: 
  - `GET`
  - `PUT`
  - `POST`
  - `OPTIONS`
- **アクセス制御許可資格情報**: チェックを**外す**（`*`を使用する場合）
- **アクセス制御Max-Age**: `600`（10分）

#### 4.3 CORS設定を保存

1. **CORSの有効化と既存のCORSヘッダーの置き換え**をクリック
2. 確認ダイアログで**はい、既存の値を置き換えます**をクリック

### 5. OPTIONSメソッドの設定（MOCK統合の場合）

CORSの有効化でOPTIONSメソッドが自動的に作成されない場合、手動で設定します。

#### 5.1 Method Responseの設定

1. `/training-videos` → **OPTIONS**メソッドを選択
2. **Method Response**をクリック
3. **HTTPステータス**: `200`を展開
4. **ヘッダー**セクションで以下を追加：
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Headers`
   - `Access-Control-Allow-Methods`
   - `Access-Control-Max-Age`

#### 5.2 Integration Responseの設定

1. **Integration Response**をクリック
2. **200**を展開
3. **ヘッダーマッピング**で以下を設定：
   - `Access-Control-Allow-Origin`: `'*'`
   - `Access-Control-Allow-Headers`: `'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'`
   - `Access-Control-Allow-Methods`: `'GET,PUT,POST,OPTIONS'`
   - `Access-Control-Max-Age`: `'600'`

#### 5.3 Integration Requestの設定

1. **Integration Request**をクリック
2. **マッピングテンプレート**を展開
3. **コンテンツタイプを追加** → `application/json`を入力
4. **マッピングテンプレート**に以下を入力：
   ```json
   {}
   ```

### 6. Lambda Proxy統合の設定

GET/PUT/POSTメソッドで**Lambda Proxy統合**を有効にする必要があります。

#### 6.1 既存の統合レスポンス設定を削除（重要）

**「レスポンスを変換するようにプロキシ統合を設定できません」というエラーが発生する場合**、既存の統合レスポンス設定を削除する必要があります。

1. 各メソッド（GET/PUT/POST）を選択
2. **統合レスポンス**をクリック
3. 既存のステータスコード（例: `200`）を展開
4. **削除**ボタンをクリックして、統合レスポンスの設定を削除
5. すべての統合レスポンス設定を削除する

**注意**: Lambda Proxy統合を使用する場合、統合レスポンスの設定は不要です。Lambda関数が直接レスポンスを返すためです。

#### 6.2 Lambda Proxy統合を有効化

1. 各メソッド（GET/PUT/POST）を選択
2. **統合リクエスト**をクリック
3. **統合タイプ**が**Lambda関数**であることを確認
4. **Lambda関数**: `misesapo-s3-upload`が選択されていることを確認
5. **「Lambda Proxy統合を使用」**にチェックを入れる（重要）
6. **保存**をクリック
7. **「Lambda関数に権限を追加」**のダイアログで**OK**をクリック

**重要**: 「Lambda Proxy統合を使用」にチェックが入っていない場合、`event`オブジェクトの構造が異なり、`path`や`httpMethod`が取得できません。

### 7. APIのデプロイ

1. **アクション** → **APIのデプロイ**をクリック
2. **デプロイされるステージ**: `prod`（または対象のステージ）を選択
3. **デプロイ**をクリック

### 8. 動作確認

ブラウザの開発者ツール（F12）で以下を確認：

1. **Network**タブを開く
2. ページをリロード
3. `/training-videos`へのリクエストを確認
4. **OPTIONS**リクエスト（プリフライト）が`200`を返すことを確認
5. **GET**リクエストが成功することを確認

## トラブルシューティング

### 「レスポンスを変換するようにプロキシ統合を設定できません」エラー

このエラーは、Lambda Proxy統合を有効にしようとした際に、既存の統合レスポンス設定が存在する場合に発生します。

**解決方法**:
1. メソッド（GET/PUT/POST）を選択
2. **統合レスポンス**をクリック
3. すべての統合レスポンス設定（ステータスコード、ヘッダーマッピングなど）を削除
4. **統合リクエスト**に戻る
5. **「Lambda Proxy統合を使用」**にチェックを入れる
6. **保存**をクリック

**注意**: Lambda Proxy統合を使用する場合、統合レスポンスの設定は不要です。Lambda関数が直接レスポンスを返すためです。

### CORSエラーが続く場合

1. **API Gatewayのデプロイを再実行**（ステージを再デプロイ）
2. **ブラウザのキャッシュをクリア**（ハードリロード: `Ctrl+Shift+R` / `Cmd+Shift+R`）
3. **CloudWatch Logs**でLambda関数のログを確認
4. **Network**タブでOPTIONSリクエストのレスポンスヘッダーを確認

### 404エラーが発生する場合

- Lambda関数のパス処理を確認（`/training-videos`を正しく処理しているか）
- API GatewayのリソースパスとLambda関数のパス処理が一致しているか確認
- **Lambda Proxy統合を使用**にチェックが入っているか確認

### 500エラーが発生する場合

- CloudWatch LogsでLambda関数のエラーログを確認
- Lambda関数のコードで`/training-videos`エンドポイントが正しく処理されているか確認

## 参考

- [清掃マニュアルエンドポイントのCORS設定](./AWS_API_GATEWAY_CORS_CLEANING_MANUAL.md)
- [API Gateway CORS設定のトラブルシューティング](./AWS_CORS_TROUBLESHOOTING.md)

