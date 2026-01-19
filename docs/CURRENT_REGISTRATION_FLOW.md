# 現在の登録フロー

## ✅ 実装済み

### 従業員（Worker）の登録
```
1. 管理者が /admin/users/index.html で従業員を登録
   ↓
2. AWS Cognito User Poolにユーザーを作成
   ↓
3. DynamoDBのworkersテーブルに保存
   - cognito_sub: Cognito User Subを紐付け
   - role: staff, sales, admin, developer, master
   ↓
4. 従業員は /staff/signin.html でAWS Cognitoを使ってログイン
```

**管理**: AWS Cognito + DynamoDB（workersテーブル）

---

### お客様（Customer）の登録
```
1. お客様が /signup.html で新規登録
   ↓
2. Firebase Authenticationに登録
   ↓
3. 現時点ではworkersテーブルにも保存（後方互換性のため）
   - firebase_uid: Firebase UIDを紐付け
   - role: customer（固定）
   ↓
4. お客様は /signin.html でFirebase認証を使ってログイン
```

**管理**: Firebase Authentication + DynamoDB（workersテーブル、将来的にはclientsテーブルに移行予定）

---

## 📋 まとめ

| ユーザー種別 | 登録窓口 | 認証システム | データ保存先 | ログインページ |
|------------|---------|------------|------------|--------------|
| **従業員** | `/admin/users/index.html`（管理者が登録） | AWS Cognito | DynamoDB `workers`テーブル | `/staff/signin.html` |
| **お客様** | `/signup.html`（自己登録） | Firebase Authentication | DynamoDB `workers`テーブル（将来的には`clients`テーブル） | `/signin.html` |

---

## 🔄 今後の改善予定

1. **お客様用のclientsテーブルを作成**
   - `/signup.html`で新規登録時に`clients`テーブルに保存
   - `workers`テーブルから分離

2. **データ構造の明確化**
   - `workers`テーブル: 従業員のみ（cognito_sub必須）
   - `clients`テーブル: お客様のみ（firebase_uid必須）

