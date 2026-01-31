# AWS 情報の確認方法（v2 プロジェクト）

このプロジェクトで AWS 関連の情報を「どこで」「どうやって」確認するかをまとめています。  
秘密情報（トークン・パスワード・Secret の値）は記載しません。

---

## 1. どこに書いてあるか（コード・ドキュメント）

| 種類 | 所在 | 内容 |
|------|------|------|
| **API ベース URL（本番）** | `scripts/create-and-fetch-work-report.sh`<br>`docs/admin-work-reports-test-report.md`<br>`legacy/extract/js/office-work-reports.js` 等 | `https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod` |
| **フロントの API 先** | `src/shared/api/client.js` | `import.meta.env.VITE_API_BASE ?? '/api'`<br>未設定なら `/api`（プロキシ想定） |
| **Cognito User Pool ID** | `docs/V1_DATA_SOURCES_MAP.md` | `ap-northeast-1_EDKElIGoC`（v1 記載） |
| **トークンの置き場所** | ブラウザ: `src/shared/auth/cognitoStorage.js`<br>CLI: `~/.cognito_token` | `cognito_id_token`（localStorage）<br>Bearer 用に `~/.cognito_token` を読むスクリプトあり |
| **データソース一覧** | `docs/V1_DATA_SOURCES_MAP.md` | DynamoDB テーブル名・Cognito・API の対応 |

---

## 2. どうやって確認するか

### A. ドキュメントを読む

- **データの所在・API 対応**: `docs/V1_DATA_SOURCES_MAP.md`
- **業務報告 API のテスト手順**: `docs/admin-work-reports-test-report.md`
- **AWS 在庫コマンド一覧**: `docs/aws_inventory_commands.sh`（実行方法は下記）

### B. AWS CLI でリソース一覧を取得する（秘密は取らない）

```bash
# プロジェクトルートで実行。出力は aws_inventory/ に JSON で保存される
bash docs/aws_inventory_commands.sh
```

取得するもの: Cognito User Pools / Identity Pools、S3 バケット一覧、Secrets Manager 一覧、CloudFront、IAM ロール一覧、DynamoDB テーブル一覧。  
**実行しないもの**: `get-secret-value`、ユーザ一覧、Access Key の値など。

### C. フロントから本番 API を叩くとき（ローカル開発）

1. テンプレをコピー: `cp config/.env.example .env`（`.env` はルートに作成）
2. 必要なら `.env` の値を編集
3. 開発サーバーを再起動（`npm run dev`）
4. ブラウザでは `localStorage` の `cognito_id_token` が Bearer として使われる（ログイン済みの場合）

### D. トークンの確認（CLI 用）

```bash
# 中身は表示しないが、存在・長さだけ確認する例
test -s ~/.cognito_token && echo "token file exists" || echo "no token file"
```

トークンが期限切れの場合は Cognito で再ログインし、新しい ID Token を `~/.cognito_token` に上書きする。

---

## 3. よく使う値の早見表

| 項目 | 値（例） |
|------|----------|
| 本番 API Base | `https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod` |
| リージョン | `ap-northeast-1` |
| Cognito User Pool ID（v1 記載） | `ap-northeast-1_EDKElIGoC` |
| 業務報告 PUT/GET | `PUT /work-report`, `GET /work-report?date=YYYY-MM-DD` |
| 環境変数（Vite） | `VITE_API_BASE` → API のベース URL |

---

## 4. 追加で知りたいとき

- **API Gateway の REST API ID / Authorizer**: `aws_inventory_commands.sh` のコメントにある `get-rest-apis` / `get-authorizers` を手動実行
- **DynamoDB のテーブル定義**: 同スクリプトの `describe-table` を手動実行
- **Cognito のクライアント ID など**: `list-user-pool-clients` を手動実行（`docs/aws_inventory_commands.sh` 内に例あり）

これらはすべて「どのコマンドで何を取るか」が `docs/aws_inventory_commands.sh` に書いてあります。
