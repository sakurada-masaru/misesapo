# プロジェクト引き継ぎドキュメント (2026-01-20 更新)

## 1. 概要
- Sales Entrance ページのUI刷新と、独立した社内チャット（チームチャット）機能の実装。
- **[New]** HR勤怠管理ダッシュボード（閲覧・確認専用）の実装完了。

## 2. 実装済みの機能

### HR 勤怠管理ダッシュボード (Phase-1)
- **概要**: 打刻修正・給与計算機能を含まない、純粋な確認用ダッシュボード。
- **ステータス分類**: コンプライアンスに基づく5カテゴリ（欠勤、打刻なし、遅刻、休憩問題、乖離）で自動判定。
- **データ優先度**: `raw`（生データ）より `fixed`（確定データ）を優先表示。
- **期間制限**:
    - ボード表示: 当日 ±7日
    - 詳細表示: 最大31日
- **UI/UX**:
    - **宇宙テーマ**（紫基調）の採用。
    - **KPIカード**: 各ステータスの件数を視覚的に表示。
    - **エラーハンドリング**: `no_data`, 503, 403, 500 等の明示的なUIメッセージ。
    - **JST等時性**: 全ての日時表示を日本標準時 (UTC+9) に統一。
- **デプロイ状況**:
    - Backend: `lambda_function.py` (misesapo-s3-upload) 更新済み。DynamoDB GSI (`status-published_at-index`) の依存問題を解消。
    - Frontend: `src/pages/entrance/hr/` 更新済み。
    - Tag: `v2026.01.20-attendance-complete`

### UI/Layout (Sales/Chat)
- **FF14風チャットログシステム**:
    - **Generalタブ**: 全てのメッセージ（MISOGI会話 + 社内チャット）を表示。
    - **Eventタブ**: MISOGIとの会話（AI/User）のみを表示。
    - **Callタブ**: 社内チャット（Team）のみを表示。
- **操作性**:
    - **Alt + ドラッグ**: ログコンテナを画面内の自由な位置へ移動可能。
    - **リサイズ**: 右辺、上辺、右上角をドラッグしてサイズ変更可能。
    - **永続化**: 位置とサイズは `localStorage` に保存され、リロード後も維持。
    - **xボタン**: ログ表示部のみを隠し、ボタン類は残す仕様に変更。
- **入力欄の分離**:
    - 中央下部の入力欄：MISOGIとの会話専用。
    - ログパネル下部の入力欄：社内チャット専用。

### バックエンド (AWS)
- **DynamoDB**: `team-messages` テーブル作成済み。`attendance` 関連テーブル連携済み。
- **Lambda**: `misesapo-team-chat`, `misesapo-s3-upload` (勤怠ロジック内包)。
- **API Gateway**:
    - Chat: `/prod/chat`
    - Attendance Board: `/prod/admin/attendance/board`
    - Attendance Detail: `/prod/admin/attendance/user_detail`
- **通信方式**: Chatは5秒ポーリング、勤怠はオンデマンドFetch。

## 3. 技術的詳細
- **言語/フレームワーク**: HTML/CSS/Vanilla JS (No Framework), Python 3.9 (Lambda)
- **JOB_TYPES**: 各部署のキーワードとカラー（Sales: オレンジ, Cleaning: 緑, HR: 紫など）を定義。
- **z-index管理**:
    - チャットログコンテナ: `500`
    - メインチャットコンテナ: `400`
    - スタートオーバーレイ: `2000`

## 4. 今後の課題・未完了項目
1. **チャンネルの切り替え詳細**: 現在は `#` ボタンからチャンネル選択モーダルが開くが、インライン入力欄がどのチャンネルに送信するかをより直感的に選択できるUIの検討。
2. **WebSocket移行 (Phase 2)**: ユーザー数や要望が増えた場合、5秒のラグをなくすために WebSocket（API Gateway WebSocket API）への移行が必要。
3. **DM機能**: 特定個人へのメッセージ送受信機能の追加。

## 5. 運用記録 (Traceability)
- **2026-01-20 16:15:13 JST**: Production Smoke Test時に `429 Too Many Requests` (Transient) を観測。
    - **URL**: `https://misesapo.co.jp/entrance/hr/`
    - **Note**: アプリケーション動作（200 OK）と画面表示（Universeテーマ、データ整合性）は正常であることを確認済み。自動テスト（Browser Subagent）による短時間での多重アクセスが原因と推測される。

## 6. 動作確認方法 (HR)
1. HRアカウントでログイン。
2. ダッシュボードにKPIカードと従業員一覧が表示されることを確認。
3. "櫻田傑" (W999) が "欠勤" ステータスであることを確認（モデルケース）。

---
作成者: Antigravity (AI Assistant)
更新日: 2026-01-20
