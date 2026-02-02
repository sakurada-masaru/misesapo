# ユーザー（workers）リスト参照

## 完全に正規のリストは DynamoDB workers テーブル

**DynamoDB の workers テーブルから取得した一覧が完全に正規のリスト**です。API はこのテーブルを Scan して返しているだけなので、正のソースは DB です。

| 所在 | 正規性 | 説明 |
|------|--------|------|
| **DynamoDB** | **完全に正規** | テーブル名 **workers**（本番の唯一の正のソース。Lambda が参照。`lambda_function.py` で `WORKERS_TABLE = dynamodb.Table('workers')`） |
| **API** | **正規（DB の読み出し）** | `GET https://51bhoxkbxd.../prod/workers`。上記 DynamoDB workers を Scan して返す。 |

Misogi のログイン時のロールは、**DynamoDB workers に入っているそのユーザーの role**（＝API が返す値）で決まります。

### 現在の一覧を取得する方法

1. **API で取得**（推奨）  
   ```bash
   curl -s "https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/workers" | jq '.items // .workers // .'
   ```
2. **DynamoDB を直接参照**（AWS 権限がある場合）  
   - テーブル名: **workers**  
   - AWS CLI 例: `aws dynamodb scan --table-name workers --region ap-northeast-1`（必要なら `--profile` 指定）

### DynamoDB（DB）を調べる方法

**workers テーブル**が完全に正規のリストです。一覧は `python3 scripts/list_workers_table.py` で表示できます。API はこのテーブルを Scan して返しています。

| 項目 | 値 |
|------|-----|
| テーブル名 | **workers** |
| リージョン | **ap-northeast-1** |
| プライマリキー | **id**（String。例: W001, W999） |
| 主な属性 | id, name, email, role, department, status, role_code, created_at, updated_at, cognito_sub 等 |

**1. 全件スキャン（AWS CLI）**
```bash
aws dynamodb scan --table-name workers --region ap-northeast-1
```
必要なら `--profile` を指定。出力は DynamoDB 形式（`{"id":{"S":"W001"},...}`）のため、見やすくするには `jq` や下記スクリプトを使うと便利です。

**2. 1件取得（id 指定）**
```bash
aws dynamodb get-item --table-name workers \
  --key '{"id":{"S":"W001"}}' \
  --region ap-northeast-1
```

**3. スクリプトで一覧表示（id / name / email / role）**
```bash
python3 scripts/list_workers_table.py
python3 scripts/list_workers_table.py 50   # 先頭50件
```
AWS 認証（`aws configure` または環境変数）が通っている必要があります。本番で「違う名前でログインしても全部管理になる」ときは、このスクリプトで **DB 上の role** を確認してください。

---

## このリスト以外のユーザーリスト

| ファイル | 用途 | 認証 | 備考 |
|----------|------|------|------|
| **src/data/staff_users.json** | 開発/別系統のスタッフ用 | メール+パスワード（JSON 内に password） | dev_server.py 等で参照。id(数値), email, password, role, name, employee_id。**Misogi のログインでは使わない**。 |

- **Misogi のエントランス振り分け**に使うのは **workers**（DynamoDB / API）のみです。
- staff_users.json は別システム・開発用のため、Portal の「入室」振り分けには使っていません。

## role → エントランス振り分け（Portal「入室」）

workers リストの **role** に応じて、入室時に次のエントランスへ振り分けます。

| role | エントランス | 備考 |
|------|--------------|------|
| **headquarters** | **ジョブ選択**（営業・清掃・事務・開発・管理から選択） | **マスター**＝全ジョブに権限あり。入室時にどのジョブで入るか選ぶ。 |
| admin, operation, human_resources | 管理エントランス (/admin/entrance) | |
| sales | 営業エントランス (/jobs/sales/entrance) | |
| office | 事務エントランス (/jobs/office/entrance) | |
| staff, cleaning | 清掃エントランス (/jobs/cleaning/entrance) | |
| developer, dev | 開発エントランス (/jobs/dev/entrance) | |

上記に該当しない role（例: multi）の場合は、ジョブ選択画面を表示します。実装: `src/misogi/pages/portal/pages/Portal.jsx` の `ROLE_TO_ENTRANCE`。

本番で「違う名前でログインしても全部管理になる」場合は、**DynamoDB の workers テーブル**側の role を確認してください。  
- **DB を直接確認**: 上記「DynamoDB（DB）を調べる方法」の `python3 scripts/list_workers_table.py` で id / name / email / role を一覧表示できます。  
- **API で確認**: `GET /api/workers?email=そのメール` の返り値の `role`。
