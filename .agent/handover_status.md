# プロジェクト引き継ぎ状況 (2026-01-10)

## 完了したタスク

### 1. HACCP準拠レポートシステム
*   **新テンプレート**: `/src/pages/admin/reports/template.html`
    *   HACCP形式、タブナビゲーション、ビフォー/アフター比較、署名欄。
*   **公開用閲覧ページ**: `/src/pages/reports/view.html`
    *   URLパラメータでデータを読み取り、ログイン不要で店舗管理者が閲覧・印刷可能。
*   **プレビュー機能**: `/src/pages/reports/preview.html`
    *   エントランスから送信する前に、別ウィンドウで仕上がりを確認できる画面。

### 2. データバックエンド
*   **DynamoDB `customer-reports` テーブル**: 顧客公開用レポートの保存先。
    *   GSI: `client_id-index` (PK: client_id, SK: date)。
*   **Lambda (`misesapo-reports`)**:
    *   既存の保存処理に `customer-reports` への書き込みを追加。店舗IDから `client_id` を逆引きして保存される。

### 3. 顧客マイページ連携
*   **レポート一覧**: `/src/customer/pages/reports/index.html`
    *   顧客IDに紐づくレポートを一覧表示。店舗・年で絞り込み可能。
*   **ナビゲーション**: `mypage.html` のサイドバーに「レポート」リンクを追加。

### 4. エントランス (MISOGI) 統合
*   **レポート作成ウィザード**: `src/pages/entrance/index.html`
    *   `startReportWizard()` によりチャット形式で入力開始。
    *   今日のスケジュール（DynamoDBから取得）を選択するか、店舗を手入力。
    *   写真アップロード（Before/After）、清掃対象選択、備考、次回提案（時期・内容）の選択。
    *   送信前にプレビューウィンドウを開く連携。

### 5. インフラ復旧
*   **RDS復旧**: 1/3のスナップショットから `misesapo-db-restored` を作成し、available状態。
*   **Laravelサイト復活**: EC2の `.env` の DB_HOST を新RDSに更新。接続確認済み (200 OK)。

## 現在の課題・UI調整
*   **チャット履歴の干渉**: エントランス画面で、中央のアクションバブル（写真UI等）が表示されると、flexboxの構造上、チャット履歴が押し上げられたり削られたりする。
*   **解決案**: チャット履歴を背面レイヤー（z-index）に配置し、独立したスクロール領域にすることで、中央の演出と重なっても表示が壊れないようにする。

## 関連ファイル
*   `src/pages/entrance/index.html`: エントランスのメインロジック。
*   `src/assets/js/modules/report/`: レポートエンジンの共通モジュール。
*   `.env` (EC2上の `/opt/prod.misesapo.app/`): RDS接続設定。
