# Firebase設定 - 次のステップ

## 現在の状態
✅ Firestore Databaseが作成されました

## 次のステップ

### ステップ1: Firestore セキュリティルールを設定

1. **現在のFirestore Databaseのページで、画面上部のタブを確認**
   - 「データ」「使用量」「インデックス」「ルール」などのタブがあります
   - **「ルール」タブをクリック**

2. **エディタに以下のルールをコピー&ペースト**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /cleaning-manual/{document=**} {
      allow read: if true;
      allow write: if request.auth != null && 
                     (request.auth.token.role == 'admin' || 
                      request.auth.token.role == 'staff' || 
                      request.auth.token.role == 'concierge' || 
                      request.auth.token.role == 'developer' || 
                      request.auth.token.role == 'master');
    }
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

3. **「公開」ボタンをクリック**
   - 画面右上または下部に「公開」ボタンがあります
   - ルールが保存されます

### ステップ2: Firebase Storageを有効化

1. **左メニューから「Storage」をクリック**
   - 「構築」セクションの中にあります

2. **「始める」または「Get started」ボタンをクリック**

3. **セキュリティルール: 「テストモードで開始」を選択**

4. **「次へ」をクリック**

5. **ロケーション: Firestoreと同じロケーション（`asia-northeast1`）を選択**

6. **「完了」をクリック**

### ステップ3: Firebase Storage セキュリティルールを設定

1. **Storageのページで「ルール」タブをクリック**

2. **エディタに以下のルールをコピー&ペースト**

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
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

3. **「公開」ボタンをクリック**

### ステップ4: Firebase Hostingでデプロイ

ターミナルで以下を実行:

```bash
cd /Users/sakuradamasaru/Desktop/misesapo-main

# Firebase CLIがインストールされていない場合
npm install -g firebase-tools
firebase login

# Firebaseプロジェクトを初期化（初回のみ）
firebase init hosting

# 質問に答える:
# - 既存のプロジェクトを選択: misesapo-system
# - 公開ディレクトリ: public
# - シングルページアプリとして設定: Yes
# - GitHub Actionsで自動デプロイ: No

# デプロイ
firebase deploy --only hosting,firestore:rules,storage:rules
```

### ステップ5: 動作確認

デプロイが完了したら:

1. **管理画面**: `https://misesapo-system.web.app/cleaning-manual-admin.html`
   - ログインが必要
   - 編集・保存・画像アップロードをテスト

2. **一般ユーザー向けページ**: `https://misesapo-system.web.app/cleaning-manual.html`
   - ログイン不要
   - データが正しく表示されるか確認

## 補足: 初期データについて

現在はデータベースが空の状態です。データを追加する方法:

### 方法1: 管理画面から手動で追加（推奨）
1. デプロイ後に管理画面にアクセス
2. 各項目を編集して「確定保存」をクリック

### 方法2: 既存のJSONデータを一括投入
- 後でスクリプトを実行して `src/data/cleaning-manual.json` のデータを投入できます

