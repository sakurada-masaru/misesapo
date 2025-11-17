# Firebase設定 - クイックスタートガイド

## ステップ1: Firebase CLIのインストール

```bash
npm install -g firebase-tools
firebase login
```

## ステップ2: Firebase Consoleでの設定

### 2-1. Firestore Databaseを有効化

1. https://console.firebase.google.com/ にアクセス
2. プロジェクト `misesapo-system` を選択
   - 画面左上の「プロジェクトを選択」から選択できます
3. 左メニューから **「Firestore Database」** をクリック
   - メニューが見えない場合は、左上の「☰」（ハンバーガーメニュー）をクリック
   - 「構築」セクションの中に「Firestore Database」があります
4. **「データベースを作成」** または **「始める」** ボタンをクリック
   - 画面中央に大きなボタンが表示されています
   - 既にデータベースが存在する場合は、このステップをスキップしてください
5. セキュリティルール: **「テストモードで開始」** を選択
   - ⚠️ 重要: 「本番モードで開始」は選択しないでください
6. **「次へ」** をクリック
7. ロケーション: **「asia-northeast1 (Tokyo)」** を選択
   - ドロップダウンから選択します
8. **「有効にする」** をクリック
   - データベースの作成が開始されます（数秒〜数分かかります）

### 2-2. Firebase Storageを有効化

1. 左メニューから **「Storage」** をクリック
   - 「構築」セクションの中にあります
   - メニューが見えない場合は、左上の「☰」をクリック
2. **「始める」** または **「Get started」** ボタンをクリック
   - 画面中央に表示されています
   - 既にStorageが有効化されている場合は、このステップをスキップしてください
3. セキュリティルール: **「テストモードで開始」** を選択
4. **「次へ」** をクリック
5. ロケーション: Firestoreと同じロケーション（`asia-northeast1`）を選択
6. **「完了」** または **「Done」** をクリック

### 2-3. セキュリティルールを設定

#### Firestore セキュリティルール

1. 左メニューから **「Firestore Database」** をクリック
2. 画面上部のタブから **「ルール」** タブをクリック
   - 「データ」「使用量」「インデックス」「ルール」などのタブがあります
3. エディタに以下のルールをコピー&ペースト:

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

4. **「公開」** ボタンをクリック（画面右上または下部）

#### Firebase Storage セキュリティルール

1. 左メニューから **「Storage」** をクリック
2. 画面上部のタブから **「ルール」** タブをクリック
3. エディタに以下のルールをコピー&ペースト:

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

4. **「公開」** ボタンをクリック（画面右上または下部）

## ステップ3: Firebase Hostingでデプロイ

```bash
# プロジェクトルートで実行
cd /Users/sakuradamasaru/Desktop/misesapo-main

# Firebaseプロジェクトを初期化（初回のみ）
firebase init hosting

# 質問に答える:
# - 既存のプロジェクトを選択: misesapo-system
# - 公開ディレクトリ: public
# - シングルページアプリとして設定: Yes
# - GitHub Actionsで自動デプロイ: No

# デプロイ（ホスティング、セキュリティルール）
firebase deploy --only hosting,firestore:rules,storage:rules
```

## ステップ4: 初期データの投入（オプション）

既存の `src/data/cleaning-manual.json` をFirestoreに投入する場合:

### 方法1: 管理画面から手動でアップロード（推奨）

1. Firebase HostingのURLにアクセス: `https://misesapo-system.web.app`
2. ログインして管理画面にアクセス
3. 各項目を編集して「確定保存」をクリック

### 方法2: スクリプトで一括投入

```bash
# Firebase Admin SDKが必要
node scripts/import_cleaning_manual_to_firestore.js
```

## ステップ5: 動作確認

1. **管理画面**: `https://misesapo-system.web.app/cleaning-manual-admin.html`
   - ログインが必要
   - 編集・保存・画像アップロードをテスト

2. **一般ユーザー向けページ**: `https://misesapo-system.web.app/cleaning-manual.html`
   - ログイン不要
   - データが正しく表示されるか確認

## よくある質問

### Q: Firebase CLIがインストールできない
A: Node.jsがインストールされているか確認してください。`node --version` で確認できます。

### Q: デプロイ時にエラーが出る
A: `firebase login` でログインしているか確認してください。

### Q: セキュリティルールエラーが出る
A: Firebase Consoleでルールが正しく設定されているか確認してください。特に、Custom Claims（`request.auth.token.role`）が設定されている必要があります。

### Q: 画像がアップロードできない
A: 
- ファイルサイズが10MB以下か確認
- 画像ファイル形式（jpg, png, gif等）か確認
- ログインしているか確認
- ロール（admin, staff等）が設定されているか確認

## 次のステップ

- Custom Claimsの設定: `scripts/set_firebase_custom_claims.js` を実行してユーザーにロールを設定
- 自動デプロイの設定: GitHub Actionsで自動デプロイを設定（オプション）

