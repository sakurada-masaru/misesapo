# AWSデータ整合性の改善

## 📋 実施日
2025年1月

## 🎯 目的
AWS（DynamoDB）上のユーザー情報が常に正確にページに反映されるようにする。

## ✅ 実施した改善

### 1. Lambda関数で強整合性読み取りを有効化

**ファイル**: `lambda_function.py`

**変更内容**:
- `WORKERS_TABLE.scan()`に`ConsistentRead=True`を追加
- すべてのスキャン操作で強整合性読み取りを有効化

**効果**:
- DynamoDBの最終的な整合性による遅延を解消
- 更新直後でも最新データが確実に取得できる

```python
# 変更前
response = WORKERS_TABLE.scan()

# 変更後
response = WORKERS_TABLE.scan(ConsistentRead=True)
```

---

### 2. AWS APIを優先、ローカルJSONは完全にフォールバックに変更

**変更したファイル**:
- `src/pages/staff/mypage.html`
- `src/assets/js/cognito_auth.js`
- `src/assets/js/admin-sidebar.js`
- `src/pages/wiki/index.html`
- `src/pages/admin/users/detail.html`

**変更内容**:
- すべての箇所でAWS APIを最初に呼び出す
- ローカルJSONファイルはAPIが失敗した場合のみ使用
- キャッシュ無効化を徹底（タイムスタンプ、`cache: 'no-store'`）

**効果**:
- 常に最新のAWSデータを優先的に使用
- ローカルJSONの古いデータが表示されることを防止

---

### 3. キャッシュ無効化の徹底

**実施内容**:
- すべてのAPI呼び出しにタイムスタンプを追加
- `cache: 'no-store'`オプションを設定
- 編集後の再読み込み時にキャッシュをクリア

**効果**:
- ブラウザキャッシュによる古いデータの表示を防止
- 常に最新データを取得

---

### 4. 編集後の再読み込みの改善

**変更したファイル**:
- `src/pages/admin/users/detail.html`
- `src/assets/js/admin-users.js`

**変更内容**:
- 編集保存後、DynamoDBの反映を待ってから再読み込み
- キャッシュをクリアしてから再読み込み

**効果**:
- 編集直後に最新データが確実に表示される

---

## 📊 データ取得の優先順位

### 変更前
1. ローカルJSONファイル（`/data/workers.json`）
2. AWS API（フォールバック）

### 変更後
1. **AWS API**（唯一のソース、強整合性読み取り）。`workers.json` は廃止済みで、workers 一覧の正のソースは DynamoDB のみです。

---

## 🔧 技術的な詳細

### 強整合性読み取り（ConsistentRead）

DynamoDBのスキャン操作は、デフォルトで最終的な整合性（Eventual Consistency）で実行されます。これにより、更新直後は古いデータが返される可能性があります。

`ConsistentRead=True`を設定することで、常に最新のデータを取得できます。

**注意点**:
- 強整合性読み取りは、最終的な整合性読み取りよりコストが高い
- レイテンシが若干増加する可能性がある
- ただし、データの正確性が重要なため、この設定を採用

---

## 📝 今後の改善案

1. **Service Workerによるキャッシュ管理**
   - オフライン対応とデータの正確性のバランスを取る

2. **リアルタイム更新**
   - WebSocketやServer-Sent Eventsを使用したリアルタイム同期

3. **データバージョニング**
   - データのバージョン番号を管理し、古いデータを検出

---

## ✅ 確認事項

- [x] Lambda関数で強整合性読み取りを有効化
- [x] すべての箇所でAWS APIを優先
- [x] キャッシュ無効化を徹底
- [x] 編集後の再読み込みを改善
- [x] ドキュメント化

---

## 🎉 結果

AWS上のユーザー情報が常に正確にページに反映されるようになりました。編集や更新を行った場合、即座に最新のデータが表示されます。

