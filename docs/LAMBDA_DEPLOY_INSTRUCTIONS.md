# Lambda関数デプロイ手順

## 🚀 デプロイ方法

### 方法1: AWSコンソールからデプロイ（推奨）

1. **AWS Lambdaコンソールを開く**
   - https://console.aws.amazon.com/lambda/ にアクセス
   - リージョン: `ap-northeast-1` を選択

2. **Lambda関数を選択**
   - 関数一覧から該当するLambda関数を選択
   - （例: `misesapo-api` など）

3. **コードを更新**
   - 「コード」タブを開く
   - ローカルの `lambda_function.py` の内容をすべてコピー
   - Lambda関数のコードエディタに貼り付け
   - 「Deploy」ボタンをクリック
   - デプロイが完了するまで待つ（数秒〜数十秒）

4. **デプロイの確認**
   - 「Last modified: ...」が最新の日時になっていることを確認

---

## ✅ デプロイ後の確認

### 1. APIエンドポイントのテスト

```bash
# 全ユーザー取得APIをテスト
curl "https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/workers?t=$(date +%s)"
```

### 2. データの統一性確認

```bash
python3 scripts/check_data_consistency.py
```

---

## 📝 注意事項

- Lambda関数のコードサイズが大きい場合（3MB以上）、ZIPファイルでのアップロードが必要になる場合があります
- デプロイ後、API Gatewayのキャッシュが残っている可能性があるため、数分待ってからテストしてください

