# AI関連コード調査結果（/ai/process・Gemini・認証）

実コードベースで grep / 全文検索により実施。推測は含めず実装のみ記載。

---

## 1. フロントAI関連

### 注意: `/staff/ai/process` について
フロントは **`${API_BASE}/ai/process`**（パスは `/ai/process`）に統一済み。  
Lambda では **`/ai/process`** と **`/staff/ai/process`** の両方を `handle_ai_process` にフォールスルーするため、どちらのURLでも同一処理。  
`src/assets/js/modules/report/assistant.js` の `API_BASE` は `.../prod` に修正済み（`.../prod/ai/process` を叩く）。

---

#### 1.1 管理者ユーザー詳細（AI分析）
- **ファイルパス:** `src/pages/admin/users/detail.html`
- **役割:** 従業員のAI分析（analyze_worker）を実行
- **呼び出しているAPI:** `POST ${API_BASE}/ai/process`
- **渡しているpayload:** `{ action: 'analyze_worker', id: currentUser.id }`
- **認証:** `buildAuthHeaders(true)` → `Authorization: Bearer ${token}`（`window.CognitoAuth.getIdToken()`）

※ バックエンドの `handle_ai_process` では `allowed_actions = {'suggest_request_form', 'suggest_estimate'}` のみ許可しており、**`analyze_worker` は 403 action_disabled になる実装**です。

---

#### 1.2 エントランス共通（コンシェルジュ）
- **ファイルパス:**  
  `src/pages/entrance/index.html`  
  `src/pages/entrance/hr/index.html`  
  `src/pages/entrance/office/index.html`  
  `src/pages/entrance/cleaning/index.html`  
  `src/pages/entrance/dev/index.html`  
  `src/pages/entrance/admin/index.html`  
  `src/pages/entrance/accounting/index.html`
- **役割:** コンシェルジュAI（admin_concierge / assistant_concierge）
- **呼び出しているAPI:** `POST ${API_BASE}/ai/process`
- **渡しているpayload:**  
  - テキスト: `{ action: 'admin_concierge', text: textToSend }` または `{ action: 'assistant_concierge', text: textToSend }`  
  - フォールバック: 上記の別 action
- **認証:** `ensureAuthOrRedirect()` で `localStorage.getItem('cognito_id_token')` を取得し、`headers` に含めて送信

※ 同上のため、**admin_concierge / assistant_concierge は現行 Lambda では 403 action_disabled** になります。

---

#### 1.3 Staff 日報（AI要約）
- **ファイルパス:** `src/pages/staff/daily-reports.html`
- **役割:** メモからAI要約（summarize_report）で報告書項目を補完
- **呼び出しているAPI:** `POST ${API_BASE}/ai/process`
- **渡しているpayload:** `{ action: 'summarize_report', text: notes }`
- **認証:** `Authorization: Bearer ${window.CognitoAuth.getIdToken()}`

※ **summarize_report も allowed_actions に含まれておらず 403** になります。

---

#### 1.4 営業トップ（コンシェルジュ）
- **ファイルパス:** `src/pages/sales/index.html`
- **役割:** テキスト・音声でコンシェルジュAI
- **呼び出しているAPI:** `POST ${API_BASE}/ai/process`
- **渡しているpayload:**  
  - テキスト: `{ action: 'assistant_concierge', text: text }`  
  - 音声: `{ action: 'assistant_concierge', audio: base64Audio, mime_type: cleanMime }`
- **認証:** `ensureAuthOrRedirect()` の token を `Authorization: Bearer ${token}` で送信

---

#### 1.5 営業アシスタント（チャット・音声・画像）
- **ファイルパス:** `src/pages/sales/assistant/index.html`
- **役割:** テキスト／音声／画像でAI処理
- **呼び出しているAPI:** `POST ${API_BASE}/ai/process`
- **渡しているpayload:**  
  - テキスト+画像: `{ action, text, (image, image_mime) }`（action はコード上変数 `body`）  
  - 音声: `{ action: 'assistant_concierge', audio: base64Audio, mime_type: 'audio/webm' }`
- **認証:** `ensureAuthOrRedirect()` の token を `Authorization: Bearer ${token}` で送信

---

#### 1.6 営業見積新規（見積提案）
- **ファイルパス:** `src/pages/sales/estimates/new.html`
- **役割:** メモから見積用構造化データをAI提案
- **呼び出しているAPI:** `POST ${API_BASE}/ai/process`
- **渡しているpayload:** `{ action: 'suggest_estimate', text: memoText }`
- **認証:** **Authorization ヘッダーを付けていない**（`Content-Type: application/json` のみ）

---

#### 1.7 営業スケジュール（依頼書提案）
- **ファイルパス:** `src/assets/js/sales-schedules.js`
- **役割:** メモ／音声から作業依頼書フォーム用AI提案
- **呼び出しているAPI:** `POST ${API_BASE}/ai/process`
- **渡しているpayload:** `{ action: 'suggest_request_form', ...params }`（text / audio 等）
- **認証:** **Authorization ヘッダーを付けていない**（`Content-Type: application/json` のみ）

---

#### 1.8 レポートアシスタント（埋め込みモジュール）
- **ファイルパス:** `src/assets/js/modules/report/assistant.js`
- **役割:** レポート作成画面用AIアシスタント（テキスト・音声・画像）
- **呼び出しているAPI:** `POST ${this.API_BASE}/ai/process`  
  - **API_BASE:** `https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/staff`  
  - よって実際のURLは **`.../prod/staff/ai/process`**（Lambda の path は `/staff/ai/process` として届く想定）
- **渡しているpayload:** `action`, `text`, および任意で `audio`+`mime_type` または `image`+`image_mime`
- **認証:** `getHeaders()` → `localStorage.getItem('cognito_id_token')` または `misesapo_auth.token` を `Authorization: Bearer ${token}` で送信

※ Lambda は **`/staff/ai/process` をルーティングしておらず**、`/ai/process` のみ処理するため、このURLだと 404 になる可能性があります。

---

#### 1.9 レガシーエントランス
- **ファイルパス:** `src/pages/legacy_ui/entrance.html`
- **役割:** 上記エントランスと同様のコンシェルジュAI
- **呼び出しているAPI:** `POST ${API_BASE}/ai/process`
- **渡しているpayload:** `admin_concierge` / `assistant_concierge` + `text`
- **認証:** 同上（token を headers に含める）

---

## 2. バックエンドAI関連

### 2.1 /ai/process を処理するLambda
- **ファイルパス:** `lambda_function.py`
- **Lambda/API名:** 同一 Lambda（`lambda_function.py`）のメイン `lambda_handler` 内で、`normalized_path == '/ai/process'` のとき `handle_ai_process(event, headers)` を実行
- **使用SDK/ライブラリ:**  
  - **Google Generative AI の公式SDK（@google/generative-ai 等）は未使用**  
  - **urllib.request** で REST 呼び出し: `https://generativelanguage.googleapis.com/{api_version}/models/{model_name}:generateContent?key={api_key}`
- **Gemini呼び出し方法:**  
  - 関数 `call_gemini_api(prompt, system_instruction=None, media=None)`（同一ファイル内）  
  - 環境変数 `GEMINI_API_KEY` を参照  
  - モデル名: `gemini-flash-latest`、API version: `v1beta`  
  - リクエスト body に `contents`, `system_instruction`（任意）, `generationConfig` を組み立てて POST

### 2.2 handle_ai_process の仕様
- **認証:** **Cognito ID トークン検証必須**。`_get_auth_header` → `verify_cognito_id_token`。未設定・不正なら 401。
- **許可 action:** `suggest_request_form`, `suggest_estimate`, `schedule_assistant`。それ以外は 403 `action_disabled`
- **入力:** body の `action`, `text`, `audio`, `mime_type`, `image`, `image_mime`（action により不要な項目あり）
- **処理:** action に応じて `call_gemini_api` を呼び、`suggest_*` は sales schema で検証、`schedule_assistant` は検証せずそのまま返却

#### schedule_assistant（追加）
- **入力:** `selected_schedule` / `selectedSchedule`（選択中の案件）, `rolling_days` / `rollingDays`（表示日付リスト）, `visible_schedules` / `visibleSchedules`（表示中の全案件）
- **出力:** `overlaps`（重複）, `congestion`（過密）, `contact_deadline`（事前連絡期限）, `notes_summary`（注意事項要約）を含む JSON

### 2.3 /staff/ai/process に紐づくルーティング
- **見つかりませんでした。**  
  Lambda 内で `normalized_path == '/staff/ai/process'` や `startswith('/staff/ai')` などの分岐はありません。  
  API Gateway で `/prod/staff/ai/process` が同じ Lambda に飛んでも、正規化後は `/staff/ai/process` のため、現行コードでは 404 相当の扱いになります。

### 2.4 その他Geminiを利用するハンドラ
- **ファイルパス:** `lambda_function.py`
- **handle_chat:** 汎用チャット（画像解析等）。内部で `call_gemini_api(message, full_system_prompt, media)` を呼び出し。  
  - ルーティング: `normalized_path == '/chat'`

---

## 3. 設定/認証

### 3.1 GEMINI_API_KEY
- **ファイルパス:** `lambda_function.py`（参照のみ。定義は環境変数）
- **設定項目:** `os.environ.get('GEMINI_API_KEY')`
- **用途:** `call_gemini_api` 内で Gemini REST API の `key` クエリに使用。未設定時は `Exception("GEMINI_API_KEY is not set.")` を投げる。  
- **設定場所（コード外）:** Lambda の環境変数または API Gateway 経由のデプロイ設定。リポジトリ内の `.env` や `GOOGLE_PROJECT_ID` / `VERTEX_REGION` の記載は見つかっていません。

### 3.2 GOOGLE_PROJECT_ID / VERTEX_REGION
- **見つかりませんでした。**  
  Vertex AI や Project ID を参照しているコードはありません。Gemini は API Key による `generativelanguage.googleapis.com` の呼び出しのみです。

### 3.3 Google関連のSecrets Manager
- **ファイルパス:** `lambda_function.py`
- **設定項目:** `GOOGLE_SERVICE_ACCOUNT_SECRET_NAME`（環境変数）、`GOOGLE_SERVICE_ACCOUNT_JSON`（環境変数）
- **用途:** Google Calendar API 用サービスアカウント取得。**Gemini / AI process には未使用。**

### 3.4 フロントのCognito設定
- **ファイルパス:**  
  - `src/misogi/pages/shared/auth/cognitoConfig.js`  
    - `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`（フォールバック: デフォルト User Pool ID / Client ID）
  - `src/misogi/dist/index.html`  
    - `window.CognitoConfig`（region, userPoolId, clientId）
- **用途:** ログイン・Cognito トークン取得。AI 呼び出し時に Bearer で渡すトークンは、各画面で `getIdToken()` や `localStorage.getItem('cognito_id_token')` 等で取得。

### 3.5 .env / 環境変数例
- **ファイルパス:** `src/misogi/config/.env.example`
- **内容:** ローカルで本番APIを叩くためのコピー用のコメントのみ。**GEMINI_API_KEY 等の記載は見つかりませんでした。**

### 3.6 テスト用 COGNITO_ID_TOKEN
- **ファイルパス:** `scripts/test_get_work_report.py`
- **設定項目:** 引数または環境変数 `COGNITO_ID_TOKEN`
- **用途:** 業務報告APIのテスト用。AI process 用の設定ファイルではありません。

---

## まとめ

| 項目 | 結果 |
|------|------|
| `/staff/ai/process` を呼んでいるフロント | **見つからなかった**（実装はすべて `${API_BASE}/ai/process`） |
| `/staff/ai/process` に紐づくLambda | **見つからなかった**（Lambda は `/ai/process` のみハンドル） |
| Gemini 呼び出し | `lambda_function.py` の `call_gemini_api`（urllib で REST）。SDK は未使用 |
| Vertex AI / @google/generative-ai | **未使用** |
| APIキー設定 | Lambda 環境変数 `GEMINI_API_KEY` のみ確認。GOOGLE_PROJECT_ID / VERTEX_REGION は未使用 |
| Cognito（フロント） | 各画面で getIdToken / localStorage の token を取得し、AI 呼び出しの多くで Bearer で送信 |
| Cognito（Lambda /ai/process） | **handle_ai_process では検証していない** |
