# 管理ダッシュボード機能追加 - 次のステップ

## 📋 実装完了内容

### ✅ 完了した実装
1. **Lambda関数**: 統計データ取得API (`get_dashboard_stats`)
2. **開発サーバー**: 統計データ取得API (`/api/admin/dashboard/stats`)
3. **フロントエンド**: 3つの新しい統計カード（承認待ちレポート、緊急お問い合わせ、今日の清掃予定）
4. **クイックリンク**: 清掃マニュアル管理、スケジュール管理を追加

---

## 🚀 次のステップ

### Step 1: AWS API Gatewayの設定（必須）

#### 1-1. API Gatewayリソースの追加

1. **AWSコンソールにログイン**
   - https://console.aws.amazon.com/apigateway/ にアクセス
   - 既存のAPI（`2z0ui5xfxb` など）を選択

2. **リソースを作成**
   - 左メニューから「リソース」を選択
   - `/admin` リソースが存在しない場合は作成
   - `/admin` → `/dashboard` → `/stats` の順にリソースを作成
   - または、既存の `/admin` リソースがある場合は、その下に `/dashboard/stats` を作成

3. **GETメソッドを追加**
   - `/admin/dashboard/stats` リソースを選択
   - 「アクション」→「メソッドの作成」→「GET」を選択
   - 統合タイプ: **Lambda関数**
   - Lambda関数: 既存のLambda関数を選択（清掃マニュアル用の関数と同じ）
   - 「保存」をクリック

4. **CORSを有効化**
   - `/admin/dashboard/stats` リソースを選択
   - 「アクション」→「CORSの有効化」
   - 設定を確認して「CORSの有効化と既存のCORSヘッダーの置き換え」をクリック

5. **APIをデプロイ**
   - 「アクション」→「APIのデプロイ」
   - デプロイステージ: `prod`
   - 「デプロイ」をクリック

---

### Step 2: Lambda関数のデプロイ（必須）

1. **Lambdaコンソールを開く**
   - https://console.aws.amazon.com/lambda/ にアクセス
   - 既存のLambda関数を選択

2. **コードを更新**
   - 「コード」タブを開く
   - `lambda_function.py` の内容をコピー＆ペースト
   - 「Deploy」をクリック

3. **動作確認**
   - 「テスト」タブでテストイベントを作成
   - 以下のJSONを使用：
   ```json
   {
     "httpMethod": "GET",
     "path": "/admin/dashboard/stats",
     "headers": {}
   }
   ```
   - 「テスト」を実行して、統計データが返されることを確認

---

### Step 3: 動作確認（必須）

#### 3-1. 開発サーバーでの確認

1. **開発サーバーを起動**
   ```bash
   python3 scripts/dev_server.py
   ```

2. **ブラウザで確認**
   - http://localhost:5173/admin/dashboard.html にアクセス
   - 新しい統計カードが表示されることを確認
   - ブラウザの開発者ツール（F12）でコンソールを開き、エラーがないか確認

3. **APIエンドポイントをテスト**
   ```bash
   curl http://localhost:5173/api/admin/dashboard/stats
   ```
   - 統計データが返されることを確認

#### 3-2. AWS環境での確認

1. **API GatewayのURLを確認**
   - API Gatewayコンソールで、デプロイされたAPIのURLを確認
   - 例: `https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod/admin/dashboard/stats`

2. **APIをテスト**
   ```bash
   curl https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod/admin/dashboard/stats
   ```
   - 統計データが返されることを確認

3. **フロントエンドで確認**
   - 本番環境（GitHub Pagesなど）で管理ダッシュボードを開く
   - 統計データが正しく表示されることを確認

---

### Step 4: データ取得の実装（今後）

現在、以下の統計データはプレースホルダー（0または`-`）です。今後、対応するテーブルができたら実装します：

#### 4-1. 今日の清掃予定数
- **データソース**: スケジュールテーブル（未実装）
- **実装方法**: DynamoDBテーブル `schedules` を作成し、今日の日付でクエリ

#### 4-2. 緊急お問い合わせ数
- **データソース**: お問い合わせテーブル（未実装）
- **実装方法**: DynamoDBテーブル `support_tickets` を作成し、優先度が「高」のものをカウント

#### 4-3. その他の統計データ
- **総顧客数**: 顧客テーブル（未実装）
- **今月発注数**: 発注テーブル（未実装）
- **今月売上**: 支払いテーブル（未実装）
- **稼働中清掃員数**: 清掃員テーブル（未実装）

---

## 🔧 トラブルシューティング

### 問題1: API Gatewayで404エラー

**原因**: リソースパスが正しく設定されていない

**解決方法**:
1. API Gatewayコンソールでリソース構造を確認
2. `/admin/dashboard/stats` が正しく作成されているか確認
3. Lambda関数の統合が正しく設定されているか確認

### 問題2: Lambda関数でエラー

**原因**: `status-created_at-index` GSIが存在しない

**解決方法**:
1. DynamoDBコンソールで `staff-reports` テーブルを確認
2. `status-created_at-index` GSIが存在するか確認
3. 存在しない場合は作成（1つずつ順番に）

### 問題3: 統計データが表示されない

**原因**: APIエンドポイントが正しく呼び出されていない

**解決方法**:
1. ブラウザの開発者ツール（F12）でネットワークタブを確認
2. `/api/admin/dashboard/stats` または `/admin/dashboard/stats` へのリクエストを確認
3. レスポンスを確認してエラーがないか確認

---

## 📝 チェックリスト

### AWS設定
- [ ] API Gatewayに `/admin/dashboard/stats` リソースを作成
- [ ] GETメソッドを追加し、Lambda関数に統合
- [ ] CORSを有効化
- [ ] APIをデプロイ
- [ ] Lambda関数のコードを更新・デプロイ

### 動作確認
- [ ] 開発サーバーで統計データが表示される
- [ ] 開発サーバーのAPIエンドポイントが動作する
- [ ] AWS環境でAPIエンドポイントが動作する
- [ ] フロントエンドで統計データが正しく表示される

### データ取得
- [ ] 承認待ちレポート数が正しく取得される（実装済み）
- [ ] 緊急お問い合わせ数（今後実装）
- [ ] 今日の清掃予定数（今後実装）

---

## 🎯 今後の拡張

### Phase 2: 追加統計データの実装
1. スケジュールテーブルの作成
2. お問い合わせテーブルの作成
3. 顧客テーブルの作成
4. 発注テーブルの作成
5. 支払いテーブルの作成

### Phase 3: リアルタイム更新
1. WebSocketまたはポーリングで統計データを自動更新
2. 承認待ちレポートの通知機能

### Phase 4: グラフ・チャートの追加
1. Chart.jsなどのライブラリを使用
2. 売上推移グラフの実装
3. サービス別売上円グラフの実装

---

## 📚 参考資料

- [API Gateway設定ガイド](./SERVICES_AWS_SETUP_GUIDE.md)
- [Lambda関数デプロイガイド](./LAMBDA_DEPLOY_GUIDE.md)
- [管理ダッシュボード機能提案](./ADMIN_DASHBOARD_RECOMMENDATIONS.md)



































