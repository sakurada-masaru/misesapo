# デプロイメント選択肢と動的ルーティング対応

## 現在の状況

### バックエンド
- ✅ **AWS Lambda + API Gateway**: 既に実装済み
- ✅ **DynamoDB**: データベース
- ✅ **S3**: 画像ストレージ

### フロントエンド
- 📦 **静的ファイル**: HTML/CSS/JS
- 🌐 **GitHub Pages**: 現在デプロイ中（静的ホスティング）
- 🔥 **Firebase Hosting**: 設定済み（静的ホスティング）

### 問題点
- ❌ 静的ホスティングでは、サーバーサイドの動的ルーティングができない
- ❌ `/admin/reports/{report_id}/edit.html` のような動的パスが404になる

---

## 解決策の選択肢

### オプション1: クライアントサイドルーティング（推奨・簡単）

**概要**: 静的ホスティングのまま、JavaScriptで動的ルーティングを実装

**メリット**:
- ✅ 既存のホスティング（GitHub Pages、Firebase Hosting、S3）をそのまま使える
- ✅ 追加コストなし
- ✅ 実装が簡単（既存コードの修正のみ）

**実装方法**:
1. すべての動的パスを `index.html` にリダイレクト（Firebase Hostingの `rewrites` で対応済み）
2. JavaScriptでURLを解析して、適切なページを表示
3. 例: `/admin/reports/123/edit.html` → JavaScriptが `[id].html` テンプレートを読み込んで表示

**必要な変更**:
- `src/pages/admin/reports/[id]/edit.html` を `src/pages/admin/reports/edit.html` にリネーム
- JavaScriptで `report_id` をURLから取得して、APIからデータを取得
- 既に実装済みの部分が多い（`getReportIdFromUrl()` など）

**デプロイ先**: GitHub Pages、Firebase Hosting、AWS S3 + CloudFront のいずれでもOK

---

### オプション2: AWS S3 + CloudFront + Lambda@Edge

**概要**: AWSの静的ホスティング + エッジで動的ルーティング

**メリット**:
- ✅ AWSのエコシステムに統一
- ✅ CloudFrontのCDNで高速配信
- ✅ Lambda@Edgeで動的ルーティングが可能

**デメリット**:
- ❌ 設定が複雑
- ❌ Lambda@Edgeのコストが発生（ただし低コスト）
- ❌ デプロイがやや複雑

**実装方法**:
1. S3に静的ファイルをアップロード
2. CloudFrontで配信
3. Lambda@Edgeで動的パスを処理

**コスト**: 月額 $1-5程度（トラフィックによる）

---

### オプション3: AWS Amplify

**概要**: AWSのフルマネージドホスティングサービス

**メリット**:
- ✅ 自動デプロイ（GitHub連携）
- ✅ サーバーサイドルーティング対応
- ✅ CI/CDが簡単

**デメリット**:
- ❌ 新しいサービスの学習が必要
- ❌ 設定ファイルの追加が必要

**実装方法**:
1. `amplify.yml` を追加
2. GitHubと連携
3. 自動デプロイ

**コスト**: 無料枠あり、その後は従量課金

---

### オプション4: AWS EC2 + Nginx

**概要**: サーバーを立てて、Nginxで動的ルーティング

**メリット**:
- ✅ 完全な制御が可能
- ✅ サーバーサイドルーティングが簡単

**デメリット**:
- ❌ サーバー管理が必要
- ❌ コストが高い（月額 $10-50程度）
- ❌ スケーリングが手動

**実装方法**:
1. EC2インスタンスを起動
2. Nginxを設定
3. 動的ルーティングを設定

---

### オプション5: Vercel / Netlify

**概要**: モダンなホスティングサービス

**メリット**:
- ✅ サーバーサイドルーティング対応
- ✅ 自動デプロイ
- ✅ 無料枠あり

**デメリット**:
- ❌ AWS以外のサービス（既存のAWSインフラと分離）
- ❌ カスタムドメイン設定が必要な場合あり

---

## 推奨: オプション1（クライアントサイドルーティング）

### 理由
1. **既存のインフラを活用**: GitHub PagesやFirebase Hostingをそのまま使える
2. **コスト**: 追加コストなし
3. **実装の簡単さ**: 既存コードの修正のみ
4. **バックエンドは既にAWS**: APIは既にAWS Lambda + API Gatewayで実装済み

### 実装手順

1. **動的ページを単一のHTMLファイルに統合**
   - `src/pages/admin/reports/[id]/edit.html` → `src/pages/admin/reports/edit.html`
   - `src/pages/reports/[id].html` → `src/pages/reports/detail.html`

2. **JavaScriptでURLからIDを取得**
   ```javascript
   // 既に実装済み
   function getReportIdFromUrl() {
     const path = window.location.pathname;
     const match = path.match(/\/admin\/reports\/([^\/]+)\/edit\.html/);
     return match ? match[1] : null;
   }
   ```

3. **Firebase Hostingのrewrites設定を活用**
   ```json
   {
     "source": "**",
     "destination": "/index.html"
   }
   ```
   これで、すべてのパスが `index.html` にリダイレクトされ、JavaScriptで処理できる

4. **ルーティングロジックを実装**
   - URLに応じて、適切なページコンテンツを表示
   - 既存の `getReportIdFromUrl()` などを活用

---

## 結論

**AWSに完全移行する必要はありません！**

- **バックエンド**: 既にAWS（Lambda + API Gateway + DynamoDB + S3）✅
- **フロントエンド**: 静的ホスティング（GitHub Pages / Firebase Hosting）でOK ✅
- **動的ルーティング**: クライアントサイドルーティングで解決 ✅

**次のステップ**: オプション1を実装して、動的ルーティングをクライアントサイドで処理する

