# 清掃マニュアル管理システム - Firebase設定手順

## 前提条件
- Firebaseプロジェクトが既に作成されている（`misesapo-system`）
- Firebase CLIがインストールされている

## 1. Firebase CLIのインストール（未インストールの場合）

```bash
npm install -g firebase-tools
firebase login
```

## 2. Firestore Databaseの有効化

1. Firebase Consoleにアクセス: https://console.firebase.google.com/
2. プロジェクト `misesapo-system` を選択
3. 左メニューから「Firestore Database」を選択
4. 「データベースを作成」をクリック
5. セキュリティルール:
   - **テストモードで開始** を選択（後でセキュリティルールを設定します）
6. ロケーション: `asia-northeast1` (東京) を推奨
7. 「有効にする」をクリック

## 3. Firebase Storageの有効化

1. Firebase Consoleで「Storage」を選択
2. 「始める」をクリック
3. セキュリティルール:
   - **テストモードで開始** を選択（後でセキュリティルールを設定します）
4. ロケーション: Firestoreと同じロケーションを選択
5. 「完了」をクリック

## 4. セキュリティルールの設定

### Firestore セキュリティルール

Firebase Console → Firestore Database → 「ルール」タブで以下を設定:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 清掃マニュアル（確定版）- 誰でも読み取り可能、認証済みユーザーのみ書き込み可能
    match /cleaning-manual/{document=**} {
      allow read: if true; // 誰でも読み取り可能
      allow write: if request.auth != null && 
                     (request.auth.token.role == 'admin' || 
                      request.auth.token.role == 'staff' || 
                      request.auth.token.role == 'concierge' || 
                      request.auth.token.role == 'developer' || 
                      request.auth.token.role == 'master');
    }
    
    // 清掃マニュアル（下書き版）- 認証済みユーザーのみ読み書き可能
    match /cleaning-manual-drafts/{document=**} {
      allow read, write: if request.auth != null && 
                           (request.auth.token.role == 'admin' || 
                            request.auth.token.role == 'staff' || 
                            request.auth.token.role == 'concierge' || 
                            request.auth.token.role == 'developer' || 
                            request.auth.token.role == 'master');
    }
  }
}
```

### Firebase Storage セキュリティルール

Firebase Console → Storage → 「ルール」タブで以下を設定:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 清掃マニュアル画像 - 誰でも読み取り可能、認証済みユーザーのみアップロード可能
    match /cleaning-manual-images/{allPaths=**} {
      allow read: if true; // 誰でも読み取り可能
      allow write: if request.auth != null && 
                     (request.auth.token.role == 'admin' || 
                      request.auth.token.role == 'staff' || 
                      request.auth.token.role == 'concierge' || 
                      request.auth.token.role == 'developer' || 
                      request.auth.token.role == 'master') &&
                     request.resource.size < 10 * 1024 * 1024 && // 10MB以下
                     request.resource.contentType.matches('image/.*');
    }
  }
}
```

## 5. Firebase Hostingの設定

### 5-1. firebase.jsonの作成

プロジェクトルートに `firebase.json` を作成（既に存在する場合は更新）:

```json
{
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

### 5-2. Firestore セキュリティルールファイルの作成

プロジェクトルートに `firestore.rules` を作成:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 清掃マニュアル（確定版）- 誰でも読み取り可能、認証済みユーザーのみ書き込み可能
    match /cleaning-manual/{document=**} {
      allow read: if true;
      allow write: if request.auth != null && 
                     (request.auth.token.role == 'admin' || 
                      request.auth.token.role == 'staff' || 
                      request.auth.token.role == 'concierge' || 
                      request.auth.token.role == 'developer' || 
                      request.auth.token.role == 'master');
    }
    
    // 清掃マニュアル（下書き版）- 認証済みユーザーのみ読み書き可能
    match /cleaning-manual-drafts/{document=**} {
      allow read, write: if request.auth != null && 
                           (request.auth.token.role == 'admin' || 
                            request.auth.token.role == 'staff' || 
                            request.auth.token.role == 'concierge' || 
                            request.auth.token.role == 'developer' || 
                            request.auth.token.role == 'master');
    }
  }
}
```

### 5-3. Storage セキュリティルールファイルの作成

プロジェクトルートに `storage.rules` を作成:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 清掃マニュアル画像 - 誰でも読み取り可能、認証済みユーザーのみアップロード可能
    match /cleaning-manual-images/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && 
                     (request.auth.token.role == 'admin' || 
                      request.auth.token.role == 'staff' || 
                      request.auth.token.role == 'concierge' || 
                      request.auth.token.role == 'developer' || 
                      request.auth.token.role == 'master') &&
                     request.resource.size < 10 * 1024 * 1024 &&
                     request.resource.contentType.matches('image/.*');
    }
  }
}
```

### 5-4. Firestore インデックスファイルの作成

プロジェクトルートに `firestore.indexes.json` を作成:

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

## 6. Firebase Hostingでデプロイ

```bash
# プロジェクトルートで実行
firebase init hosting

# 既存のプロジェクトを選択: misesapo-system
# 公開ディレクトリ: public
# シングルページアプリとして設定: Yes
# GitHub Actionsで自動デプロイ: No（手動デプロイの場合）

# デプロイ
firebase deploy --only hosting,firestore:rules,storage:rules
```

## 7. 初期データの投入（オプション）

既存の `src/data/cleaning-manual.json` をFirestoreに投入する場合:

```bash
# Node.jsスクリプトを作成して実行（後で提供）
```

または、管理画面から手動でデータをアップロードしてください。

## 8. 動作確認

1. Firebase HostingのURLにアクセス: `https://misesapo-system.web.app`
2. ログインして管理画面にアクセス: `https://misesapo-system.web.app/cleaning-manual-admin.html`
3. 編集・保存・画像アップロードをテスト
4. 一般ユーザー向けページ: `https://misesapo-system.web.app/cleaning-manual.html`

## トラブルシューティング

### 認証エラー
- Firebase Console → Authentication でユーザーが作成されているか確認
- Custom Claimsが設定されているか確認（`scripts/set_firebase_custom_claims.js` を実行）

### セキュリティルールエラー
- Firebase Console → Firestore Database → ルール でルールが正しく設定されているか確認
- Firebase Console → Storage → ルール でルールが正しく設定されているか確認

### 画像アップロードエラー
- ファイルサイズが10MB以下か確認
- 画像ファイル形式（jpg, png, gif等）か確認

