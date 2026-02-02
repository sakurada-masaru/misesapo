# Misogi 認証とロール

## ロールの決まり方

ログイン後、画面上の「誰として入室するか」は **ロール (role)** で決まります。

1. **GET /api/workers?email=... または ?cognito_sub=...** の応答の **user.role**（最優先）
2. 上で取れない場合: Cognito ID Token の **custom:role**
3. それも無い場合: **'staff'**

実装: `src/misogi/pages/shared/auth/signInWithCognito.js`  
`user.role = userInfo.role || payload['custom:role'] || 'staff'`

## 「違う名前でログインしても全部管理だけになる」場合

- ロールは **workers API（本番 API 51bhoxkbxd の /workers）** が返す **そのユーザーの role** で決まります。
- 全員「管理だけ」になる = **workers のデータで、そのユーザー（または全ユーザー）の role が 'admin' になっている**可能性が高いです。

### 確認すること

1. **workers API の返す role**  
   - ログインに使ったメールで `GET /api/workers?email=そのメール` を叩き、返ってきた 1 件の **role** を確認する。
2. **DynamoDB の workers テーブル**  
   - 各ユーザーの **role** 属性が、想定どおりか（admin / sales / office / cleaning / multi / single:xxx など）確認する。
3. **ロールの変更**  
   - `scripts/update_user_role.py` で、ユーザーごとに role を変更できる（API 経由で workers を更新）。

### Portal での見え方

- **role=admin** → 「入室」でそのまま **管理エントランス** に飛ぶ（ジョブ選択なし）。
- **role=single:sales** → 「入室」で **営業エントランス** に飛ぶ。
- **role=multi または上以外** → 「入室」で **ジョブ選択**（営業・清掃・事務・管理など）が表示される。

「全部管理だけになる」場合は、そのアカウント（または全アカウント）の **role が admin になっていないか** を上記で確認してください。
