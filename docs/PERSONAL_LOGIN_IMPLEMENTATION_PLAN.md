# 個人ログインシステム実装計画

## 🎯 目標

### 現状
- ロールベースのログイン
- 個人のIDに紐づいた情報が取得できない

### 目標
- **個人ベースのログイン**: メールアドレスでログインし、個人のIDに紐づいた情報を表示
- **マイページ機能**: 個人ごとのマイページ、出退勤情報、スケジュール情報
- **新入社員登録**: 管理が新入社員を登録し、自動的にマイページを発行

## 📋 実装方針

### 1. データ構造の設計

#### DynamoDB `workers`テーブルに追加
```json
{
  "id": "W1764549250789",  // DynamoDB用のID（既存）
  "firebase_uid": "abc123...",  // Firebase UID（新規追加）⭐
  "email": "user@example.com",  // メールアドレス（Firebaseと一致）
  "name": "山田太郎",
  "role": "staff",
  "department": "清掃員",
  "status": "active",
  "created_at": "2025-12-01T00:00:00Z",
  "updated_at": "2025-12-01T00:00:00Z"
}
```

**重要**: `firebase_uid`フィールドを追加して、Firebase UIDとDynamoDB IDを紐付けます。

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
5. 個人のID（DynamoDBのID）を取得
   ↓
6. ロールを判定（Firebase Custom Claims + DynamoDB）
   ↓
7. セッションに個人のIDを保存
   ↓
8. 個人のIDに紐づいた情報を表示
   - マイページ: /staff/mypage.html
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

### ステップ1: DynamoDBテーブルの拡張（1日）

**Lambda関数でユーザー作成時に`firebase_uid`を保存**

```python
# lambda_function.py
def create_worker(event, headers):
    # ...
    worker_data = {
        'id': worker_id,
        'firebase_uid': body_json.get('firebase_uid'),  # 新規追加
        'email': body_json.get('email'),
        'name': body_json.get('name'),
        # ...
    }
```

**既存ユーザーのFirebase UIDを紐付け**

```python
# マイグレーションスクリプト
# Firebase Authenticationから全ユーザーを取得
# DynamoDBのworkersテーブルとメールアドレスでマッチング
# firebase_uidを更新
```

### ステップ2: Lambda関数でFirebase UID検索機能を追加（1日）

**`get_workers`関数にFirebase UID検索を追加**

```python
def get_workers(event, headers):
    query_params = event.get('queryStringParameters') or {}
    firebase_uid = query_params.get('firebase_uid')
    
    if firebase_uid:
        # Firebase UIDで検索
        response = WORKERS_TABLE.scan(
            FilterExpression=Attr('firebase_uid').eq(firebase_uid)
        )
        workers = response.get('Items', [])
    # ...
```

### ステップ3: ログイン処理の改善（1日）

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
  const response = await fetch(`${API_BASE}/workers?firebase_uid=${firebaseUid}`);
  const users = await response.json();
  const userInfo = (users.items || users.workers || [])[0];
  
  if (!userInfo) {
    throw new Error('ユーザー情報が見つかりませんでした');
  }
  
  // 3. ロールを取得（Firebase Custom Claims + DynamoDB）
  const idTokenResult = await firebaseUser.getIdTokenResult();
  const role = idTokenResult.claims.role || userInfo.role || 'customer';
  
  // 4. ユーザー情報を保存（個人のIDを含む）
  const user = {
    id: userInfo.id,  // DynamoDBのID（重要！）
    firebase_uid: firebaseUid,  // Firebase UID
    email: firebaseUser.email,
    role: role,
    name: userInfo.name || firebaseUser.displayName,
    department: userInfo.department,
    // ...
  };
  
  setAuthData(role, user.email, user);
  return { success: true, user: user, role: role };
}
```

### ステップ4: マイページの改善（2日）

**`/staff/mypage.html`の改善**

```javascript
async function loadCurrentUser() {
  // 1. 認証情報から個人のIDを取得
  const authData = window.Auth?.getAuthData?.();
  if (!authData || !authData.user || !authData.user.id) {
    throw new Error('ログインしてください');
  }
  
  const userId = authData.user.id;  // DynamoDBのID
  
  // 2. ユーザー情報を取得
  const response = await fetch(`${API_BASE}/workers/${userId}`);
  if (!response.ok) {
    throw new Error('ユーザー情報を取得できませんでした');
  }
  
  currentUser = await response.json();
  
  // 3. 出退勤情報を取得（個人のIDでフィルタリング）
  await loadAttendanceRecords(userId);
  
  // 4. スケジュール情報を取得（個人のIDでフィルタリング）
  await loadWeeklySchedule(userId);
  
  // 5. レポート情報を取得（個人のIDでフィルタリング）
  await loadRecentReports(userId);
}
```

### ステップ5: 出退勤機能の改善（1日）

**個人のIDに紐づいた出退勤記録**

```javascript
async function clockIn() {
  const authData = window.Auth?.getAuthData?.();
  const userId = authData.user.id;  // DynamoDBのID
  
  await fetch(`${API_BASE}/attendance/clock-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getFirebaseIdToken()}`
    },
    body: JSON.stringify({
      user_id: userId,  // 個人のID
      timestamp: new Date().toISOString()
    })
  });
}
```

### ステップ6: 新入社員登録機能の実装（2-3日）

**管理画面での新入社員登録**

```javascript
async function createNewEmployee(employeeData) {
  // 1. Firebase Authenticationにユーザーを作成
  // （Firebase Admin SDKを使用、Lambda関数で実装）
  const response = await fetch(`${API_BASE}/admin/create-employee`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getFirebaseIdToken()}`
    },
    body: JSON.stringify({
      email: employeeData.email,
      password: employeeData.password || generatePassword(),  // 自動生成
      name: employeeData.name,
      role: employeeData.role,
      department: employeeData.department,
      // ...
    })
  });
  
  // 2. 新入社員にメールアドレスとパスワードを通知
  // （メール送信機能を実装）
}
```

**Lambda関数での実装**

```python
def create_employee(event, headers):
    # 1. 管理者権限をチェック
    user_info = verify_firebase_token(id_token)
    if not check_admin_permission(user_info):
        return {'statusCode': 403, ...}
    
    # 2. Firebase Authenticationにユーザーを作成
    # （Firebase Admin SDKを使用）
    firebase_user = auth.create_user(
        email=body_json['email'],
        password=body_json['password'],
        display_name=body_json['name']
    )
    
    # 3. Custom Claimsにロールを設定
    auth.set_custom_user_claims(firebase_user.uid, {
        'role': body_json['role']
    })
    
    # 4. DynamoDBにユーザー情報を保存
    worker_data = {
        'id': 'W' + str(int(datetime.utcnow().timestamp() * 1000)),
        'firebase_uid': firebase_user.uid,  # Firebase UIDを紐付け
        'email': body_json['email'],
        'name': body_json['name'],
        'role': body_json['role'],
        'department': body_json['department'],
        'status': 'active',
        'created_at': datetime.utcnow().isoformat() + 'Z',
        'updated_at': datetime.utcnow().isoformat() + 'Z'
    }
    
    WORKERS_TABLE.put_item(Item=worker_data)
    
    # 5. メール通知（SESを使用）
    # ...
```

## 💡 メリット

### 1. 個人ベースの管理
- ✅ 各従業員が自分の情報を管理できる
- ✅ マイページで個人の情報を確認できる
- ✅ 出退勤記録が個人に紐づく

### 2. セキュリティの向上
- ✅ メールアドレスベースの認証
- ✅ 個人のIDに紐づいた情報のみアクセス可能
- ✅ Firebase Authenticationで認証

### 3. 運用の効率化
- ✅ 新入社員の登録が簡単
- ✅ 自動的にマイページが発行される
- ✅ 管理が一括でユーザーを管理できる

### 4. 拡張性
- ✅ 将来的に機能を追加しやすい
- ✅ 個人ごとのカスタマイズが可能

## ⚠️ 注意点

### 1. 既存ユーザーの移行
- 既存ユーザーのFirebase UIDをDynamoDBに紐付ける必要がある
- 移行スクリプトを作成する

### 2. Firebase Admin SDKの実装
- Lambda関数でFirebase Admin SDKを使用する必要がある
- 認証検証を実装する

### 3. データの整合性
- Firebase AuthenticationとDynamoDBのデータを同期
- メールアドレスの変更時に両方を更新

## 📋 実装スケジュール

### フェーズ1: 基盤整備（2-3日）
1. DynamoDBテーブルに`firebase_uid`フィールドを追加
2. 既存ユーザーのFirebase UIDを紐付け
3. Lambda関数でFirebase UID検索機能を追加

### フェーズ2: ログイン処理の改善（1-2日）
1. ログイン時にFirebase UIDでDynamoDBからユーザー情報を取得
2. 個人のIDをセッションに保存
3. ロール判定の改善

### フェーズ3: マイページの実装（2-3日）
1. 個人のIDに紐づいた情報を表示
2. 出退勤情報の表示
3. スケジュール情報の表示

### フェーズ4: 新入社員登録機能（2-3日）
1. 管理画面での新入社員登録フォーム
2. Firebase Authenticationへのユーザー作成（Lambda関数）
3. DynamoDBへの情報保存
4. メール通知機能

### フェーズ5: 出退勤機能の改善（1-2日）
1. 個人のIDに紐づいた出退勤記録
2. 出退勤履歴の表示
3. 月次集計機能

**合計**: 約1-2週間（段階的に実装可能）

## 🎯 結論

**この実装方針により、個人ベースのログインシステムが実現できます。**

- ✅ メールアドレスでログイン
- ✅ ロールで判別しつつ、個人のIDに紐づいた情報を表示
- ✅ マイページ機能
- ✅ 新入社員の登録フロー
- ✅ 出退勤機能

**実装を開始しますか？**

