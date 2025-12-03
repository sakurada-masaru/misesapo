# 🚀 レポート機能 クイックスタート

## 今すぐやること（3ステップ）

### ステップ1: API GatewayのエンドポイントURLを取得

1. **AWSコンソールにログイン**
   - https://console.aws.amazon.com/apigateway/ にアクセス

2. **APIを選択**
   - 既存のAPIを選択

3. **エンドポイントURLをコピー**
   - 「ステージ」タブを開く
   - `prod` ステージを選択
   - 「呼び出しURL」をコピー
   - 例: `https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/prod`

---

### ステップ2: フロントエンドのAPI URLを更新

以下の4つのファイルで `API_BASE_URL` を実際のURLに置き換えてください：

1. `src/pages/admin/reports.html` (211行目)
2. `src/pages/admin/reports/new.html` (385行目)
3. `src/pages/admin/reports/[id]/edit.html` (408行目)
4. `src/pages/reports/[id].html` (確認が必要)

**変更例：**
```javascript
// 変更前
const API_BASE_URL = 'https://your-api-gateway-url.execute-api.ap-northeast-1.amazonaws.com/prod';

// 変更後（実際のURLに置き換え）
const API_BASE_URL = 'https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/prod';
```

---

### ステップ3: テストを実行

#### 方法1: テストスクリプトでテスト

```bash
# APIエンドポイントURLを環境変数に設定
export API_URL="https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod"

# テストスクリプトを実行
./test-api.sh
```

#### 方法2: ブラウザでテスト

1. **ローカルサーバーを起動**
   ```bash
   python3 -m http.server 5173 --directory public
   ```

2. **ブラウザで開く**
   - http://localhost:5173/admin/reports.html
   - レポート一覧が表示されるか確認

---

## ⚠️ 事前確認（まだの場合）

### DynamoDBテーブル
- [ ] `staff-reports` テーブルが作成されている
- [ ] GSI 3つが「アクティブ」状態

### Lambda関数
- [ ] 最新のコードがデプロイされている
- [ ] 環境変数が設定されている
- [ ] IAMロールにDynamoDBとS3の権限がある

### API Gateway
- [ ] `/staff/reports` リソースが作成されている
- [ ] `/staff/reports/{report_id}` リソースが作成されている
- [ ] 各メソッド（GET, POST, PUT, DELETE, OPTIONS）が設定されている
- [ ] CORSが有効化されている
- [ ] APIがデプロイされている

---

## 📚 詳細な手順

詳細な手順は `docs/TEST_STEPS.md` を参照してください。

