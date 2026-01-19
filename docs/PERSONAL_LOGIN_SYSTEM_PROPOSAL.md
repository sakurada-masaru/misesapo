# 個人ログインシステムの実装提案

## 📋 要件

### 目標
1. **個人ベースのログイン**
   - メールアドレスでログイン
   - ロールで判別しつつ、個人のIDに紐づいた情報を表示

2. **マイページ機能**
   - 個人ごとのマイページ
   - 出退勤情報
   - スケジュール情報

3. **新入社員の登録フロー**
   - 管理が新入社員の情報を入力
   - 新たなマイページを発行
   - 新入社員は自分のメールアドレスでログイン
   - ブラウザで出退勤を入力できる

## 🎯 実装方針

### 1. データ構造の設計

#### DynamoDB `workers`テーブル
```json
{
  "id": "W1764549250789",  // DynamoDB用のID（既存）
  "firebase_uid": "abc123...",  // Firebase UID（新規追加）
  "email": "user@example.com",  // メールアドレス（Firebaseと一致）
  "name": "山田太郎",
  "role": "staff",  // ロール（Firebase Custom Claimsと一致）
  "department": "清掃員",
  "status": "active",
  "created_at": "2025-12-01T00:00:00Z",
  "updated_at": "2025-12-01T00:00:00Z"
}
```

#### Firebase Authentication
- メールアドレス + パスワードでログイン
- Custom Claimsにロールを設定
- Firebase UIDを取得

### 2. ログインフロー

```
1. ユーザーがメールアドレス + パスワードでログイン
   ↓
2. Firebase Authenticationで認証
   ↓
3. Firebase UIDを取得
   ↓
4. DynamoDBからFirebase UIDでユーザー情報を取得
   ↓
5. ロールを判定（Firebase Custom Claims + DynamoDB）
   ↓
6. 個人のIDに紐づいた情報を表示
   - マイページ: /staff/mypage.html?user_id=W1764549250789
   - 出退勤情報: 個人のIDでフィルタリング
   - スケジュール情報: 個人のIDでフィルタリング
```

### 3. 新入社員登録フロー

```
1. 管理が新入社員の情報を入力
   - 名前、メールアドレス、部署、ロールなど
   ↓
2. システムが自動的に：
   a. Firebase Authenticationにユーザーを作成
   b. パスワードを生成（または管理が設定）
   c. Custom Claimsにロールを設定
   d. DynamoDBにユーザー情報を保存（Firebase UIDを紐付け）
   ↓
3. 新入社員にメールアドレスとパスワードを通知
   ↓
4. 新入社員がログイン
   ↓
5. 個人のマイページが表示される
   - 出退勤入力
   - スケジュール確認
   - 個人情報の確認・編集
```

## 🔧 実装手順

### ステップ1: DynamoDBテーブルの拡張

**既存の`workers`テーブルに`firebase_uid`フィールドを追加**

```python
# Lambda関数でユーザー作成時
worker_data = {
    'id': worker_id,
    'firebase_uid': firebase_uid,  # 新規追加
    'email': email,
    'name': name,
    'role': role,
    # ...
}
```

### ステップ2: ログイン処理の改善

**`auth.js`の改善**

```javascript
async function loginWithFirebase(email, password) {
  // 1. Firebase Authenticationでログイン
  const userCredential = await window.FirebaseAuth.signInWithEmailAndPassword(
    email,
    password
  );
  
  const firebaseUser = userCredential.user;
  const firebaseUid = firebaseUser.uid;
  
  // 2. DynamoDBからユーザー情報を取得（Firebase UIDで検索）
  const userInfo = await fetchUserByFirebaseUid(firebaseUid);
  
  // 3. ロールを取得（Firebase Custom Claims + DynamoDB）
  const idTokenResult = await firebaseUser.getIdTokenResult();
  const role = idTokenResult.claims.role || userInfo.role || 'customer';
  
  // 4. ユーザー情報を保存
  const user = {
    id: userInfo.id,  // DynamoDBのID
    firebase_uid: firebaseUid,  // Firebase UID
    email: firebaseUser.email,
    role: role,
    name: userInfo.name || firebaseUser.displayName,
    // ...
  };
  
  setAuthData(role, user.email, user);
  return { success: true, user: user, role: role };
}
```

### ステップ3: マイページの改善

**`/staff/mypage.html`の改善**

```javascript
// ログイン中のユーザー情報を取得
async function loadMyPage() {
  // 1. 認証情報からユーザーIDを取得
  const authData = getAuthData();
  const userId = authData.user.id;  // DynamoDBのID
  
  // 2. ユーザー情報を取得
  const userInfo = await fetch(`${API_BASE}/workers/${userId}`);
  
  // 3. 出退勤情報を取得（個人のIDでフィルタリング）
  const attendance = await fetch(`${API_BASE}/attendance?user_id=${userId}`);
  
  // 4. スケジュール情報を取得（個人のIDでフィルタリング）
  const schedules = await fetch(`${API_BASE}/schedules?assigned_to=${userId}`);
  
  // 5. 表示
  renderUserInfo(userInfo);
  renderAttendance(attendance);
  renderSchedules(schedules);
}
```

### ステップ4: 新入社員登録機能の実装

**管理画面での新入社員登録**

```javascript
async function createNewEmployee(employeeData) {
  // 1. Firebase Authenticationにユーザーを作成
  const firebaseUser = await createFirebaseUser(
    employeeData.email,
    employeeData.password  // 自動生成または管理が設定
  );
  
  // 2. Custom Claimsにロールを設定
  await setFirebaseCustomClaim(firebaseUser.uid, employeeData.role);
  
  // 3. DynamoDBにユーザー情報を保存
  const workerData = {
    id: 'W' + Date.now(),  // 新しいID
    firebase_uid: firebaseUser.uid,  // Firebase UIDを紐付け
    email: employeeData.email,
    name: employeeData.name,
    role: employeeData.role,
    department: employeeData.department,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  await fetch(`${API_BASE}/workers`, {
    method: 'POST',
    body: JSON.stringify(workerData)
  });
  
  // 4. 新入社員にメールアドレスとパスワードを通知
  // （メール送信機能を実装）
}
```

### ステップ5: 出退勤機能の改善

**個人のIDに紐づいた出退勤記録**

```javascript
async function clockIn() {
  const authData = getAuthData();
  const userId = authData.user.id;  // DynamoDBのID
  
  await fetch(`${API_BASE}/attendance/clock-in`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      timestamp: new Date().toISOString()
    })
  });
}
```

## 💡 推奨される実装順序

### フェーズ1: 基盤整備（1-2日）
1. DynamoDBテーブルに`firebase_uid`フィールドを追加
2. 既存ユーザーのFirebase UIDを紐付け
3. Lambda関数でFirebase UIDでの検索機能を追加

### フェーズ2: ログイン処理の改善（1日）
1. ログイン時にFirebase UIDでDynamoDBからユーザー情報を取得
2. 個人のIDをセッションに保存
3. ロール判定の改善

### フェーズ3: マイページの実装（2-3日）
1. 個人のIDに紐づいた情報を表示
2. 出退勤情報の表示
3. スケジュール情報の表示

### フェーズ4: 新入社員登録機能（2-3日）
1. 管理画面での新入社員登録フォーム
2. Firebase Authenticationへのユーザー作成
3. DynamoDBへの情報保存
4. メール通知機能

### フェーズ5: 出退勤機能の改善（1-2日）
1. 個人のIDに紐づいた出退勤記録
2. 出退勤履歴の表示
3. 月次集計機能

## 🎯 メリット

### 1. 個人ベースの管理
- 各従業員が自分の情報を管理できる
- マイページで個人の情報を確認できる

### 2. セキュリティの向上
- メールアドレスベースの認証
- 個人のIDに紐づいた情報のみアクセス可能

### 3. 運用の効率化
- 新入社員の登録が簡単
- 自動的にマイページが発行される

### 4. 拡張性
- 将来的に機能を追加しやすい
- 個人ごとのカスタマイズが可能

## ⚠️ 注意点

### 1. 既存ユーザーの移行
- 既存ユーザーのFirebase UIDを紐付ける必要がある
- 移行スクリプトを作成する

### 2. セキュリティ
- Firebase Admin SDKを使用した認証検証を実装
- 個人のIDに紐づいた情報のみアクセス可能にする

### 3. データの整合性
- Firebase AuthenticationとDynamoDBのデータを同期
- メールアドレスの変更時に両方を更新

## 📋 結論

**この実装方針により、個人ベースのログインシステムが実現できます。**

- ✅ メールアドレスでログイン
- ✅ ロールで判別しつつ、個人のIDに紐づいた情報を表示
- ✅ マイページ機能
- ✅ 新入社員の登録フロー
- ✅ 出退勤機能

**実装期間**: 約1-2週間（段階的に実装可能）

