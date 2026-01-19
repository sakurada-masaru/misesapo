# テストの実行方法

## 📋 テストの種類

### 1. API Gateway経由のテスト（推奨）

**ローカルのターミナルで実行**します。これは、実際のAPIエンドポイント（API Gateway経由）にHTTPリクエストを送信してテストします。

#### 実行方法

```bash
# ターミナルを開く
# プロジェクトのディレクトリに移動
cd /Users/sakuradamasaru/Desktop/misesapo-main

# テストスクリプトを実行
./test-api.sh
```

#### 何をテストするか

- API Gatewayのエンドポイントが正しく動作するか
- Lambda関数が正しく呼び出されるか
- DynamoDBへのアクセスが正しく動作するか
- レスポンスが正しく返ってくるか

---

### 2. Lambda関数の直接テスト（オプション）

**AWS Lambdaコンソールの「テスト」タブ**で実行します。これは、Lambda関数を直接呼び出してテストします。

#### 実行方法

1. **AWS Lambdaコンソールを開く**
   - https://console.aws.amazon.com/lambda/ にアクセス

2. **Lambda関数を選択**

3. **「テスト」タブを開く**

4. **テストイベントを作成**
   - 「新しいイベントを作成」をクリック
   - イベント名を入力（例: `test-get-reports`）
   - 以下のJSONを入力：

```json
{
  "httpMethod": "GET",
  "path": "/staff/reports",
  "headers": {
    "Authorization": "Bearer mock-token",
    "Content-Type": "application/json"
  },
  "queryStringParameters": null,
  "body": null
}
```

5. **「テスト」ボタンをクリック**

#### 何をテストするか

- Lambda関数のコードが正しく動作するか
- エラーハンドリングが正しく動作するか
- ログが正しく出力されるか

---

## 🚀 推奨されるテスト手順

### ステップ1: Lambda関数をデプロイ

1. **Lambdaコンソールを開く**
   - https://console.aws.amazon.com/lambda/

2. **関数を選択**

3. **「コード」タブを開く**

4. **コードを更新**
   - ローカルの `lambda_function.py` の内容をコピー
   - Lambda関数のコードエディタに貼り付け
   - 「Deploy」ボタンをクリック

### ステップ2: API Gateway経由でテスト（ローカルターミナル）

```bash
# ターミナルで実行
cd /Users/sakuradamasaru/Desktop/misesapo-main
./test-api.sh
```

### ステップ3: 結果を確認

- ✅ すべてのテストが成功すれば、設定は正しく動作しています
- ❌ エラーが出た場合は、エラーメッセージを確認して対応してください

---

## 📝 注意事項

- **`./test-api.sh` はローカルのターミナルで実行**してください
- AWS Lambdaのテストタブは、Lambda関数を直接テストする場合に使用します
- 通常は、API Gateway経由のテスト（`./test-api.sh`）で十分です

---

## 🆘 よくある質問

### Q: ターミナルがどこにあるかわからない

**macOSの場合：**
- `Cmd + Space` でSpotlight検索を開く
- 「ターミナル」と入力してEnter
- または、`アプリケーション` → `ユーティリティ` → `ターミナル`

### Q: テストスクリプトが実行できない

```bash
# 実行権限を付与
chmod +x test-api.sh

# 再度実行
./test-api.sh
```

### Q: curlコマンドが見つからない

macOSには標準でcurlがインストールされています。もしエラーが出る場合は：

```bash
# curlのバージョンを確認
curl --version
```

