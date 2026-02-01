# 顧客登録「登録して招待リンクを送信」ボタン仕様

## 概要

misogi の顧客登録ページ（`/sales/clients/new`）にある **「登録して招待リンクを送信」** ボタンの現状の挙動と、ラベルが示唆する仕様の差を整理したドキュメントです。

---

## 1. ボタンの現状の挙動（実装）

| 項目 | 内容 |
|------|------|
| **表示** | 送信中は「登録中...」、通常時は「登録して招待リンクを送信」 |
| **トリガー** | フォーム送信（submit） |
| **処理** | 1. `POST /api/stores` でリード情報を DynamoDB（misesapo-stores）に登録<br>2. レスポンスの `result.id`（店舗ID: ST00001 形式）を使って招待リンクを組み立て<br>3. **alert で招待リンクを表示**（ユーザーが手動でコピーして顧客に送る想定）<br>4. 営業入口（`/jobs/sales/entrance`）へ遷移 |

### 招待リンクの形式

```
{origin}/registration/customer-complete.html?token={store_id}
```

- `origin`: フロントのオリジン（例: `https://example.com` や `http://localhost:3335`）
- `token`: バックエンドが返す店舗ID（`create_store` の戻り値 `id`、例: `ST00001`）

### バックエンド（create_store）

- **API**: `POST /api/stores`
- **認証**: Bearer（Cognito ID Token）必須
- **戻り値**: `{ status: 'success', id: store_id, message: '...', store: store_data }`
- **招待リンクの送信**: **行っていない**（メール送信・SMS 等の処理はなし）

### 招待リンク先（customer-complete.html）

- **パス**: `src/corporate/pages/registration/customer-complete.html`
- **クエリ**: `token` = 店舗ID（store_id）
- **役割**: お客様がそのリンクを開くと「お客様情報登録」フォーム（基本情報・店舗情報・清掃希望・確認のステップ）が表示され、送信時に **同一の store_id で `PUT /api/stores/{store_id}` が呼ばれ、既存レコードが更新される**（リード → 詳細情報付きの顧客情報に更新）。

---

## 2. ラベルが示唆する仕様との差

- **ラベル**: 「登録して**招待リンクを送信**」
- **現状**: 登録は行うが、**招待リンクの「送信」は行っていない**。
  - 招待リンクは **alert で表示されるだけ**で、営業担当者が自分でコピーしてメール・チャット等で顧客に送る必要がある。
  - システムから顧客のメールアドレスへ自動で招待メールを送る処理は **未実装**。

---

## 3. 仕様として取りうる方向

1. **現状のまま（手動送付前提）**  
   - ラベルを「登録して招待リンクを表示」など、実際の挙動に合わせて変更する。
2. **自動送信を実装する**  
   - 登録時に、フォームのメールアドレス宛に招待リンク付きメールを送る（Lambda で SES 等を使用）。  
   - その場合、管理画面の「招待リンク送信」オプション（`src/pages/admin/customers/index.html` の `send-invite` 等）と仕様を揃える必要がある。

---

## 4. 関連コード位置

| 役割 | ファイル／API |
|------|----------------|
| ボタン・フォーム送信・招待リンク表示 | `src/misogi/pages/jobs/sales/clients/SalesClientNewPage.jsx` |
| 店舗作成 API | `lambda_function.py` の `create_store`、`POST /api/stores` |
| 招待リンク先（お客様詳細入力） | `src/corporate/pages/registration/customer-complete.html`（`?token=` で store_id を渡し、PUT で更新） |
| 別ルートのリード登録（HTML） | `src/misogi/pages/jobs/sales/entrance/new.html`（同様の文言・招待リンク alert あり） |
| 管理画面の招待リンク送信オプション | `src/pages/admin/customers/index.html`、`src/assets/js/sales-clients.js`（招待リンク表示はあるが、メール送信の有無は要確認） |

---

## 5. まとめ

- **「登録して招待リンクを送信」** は、  
  - **登録** → 実装済み（POST /api/stores）。  
  - **招待リンクの送信** → **未実装**（alert で表示のみ。送信は営業の手動に依存）。
- 仕様をはっきりさせるには、  
  - ラベルを「登録して招待リンクを表示」などに変更するか、  
  - メール送信を実装して「送信」の意味を満たすか、のどちらか（または両方）を決める必要があります。
