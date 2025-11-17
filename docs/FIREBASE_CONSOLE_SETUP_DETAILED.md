# Firebase Console設定 - 詳細手順

## Firestore Databaseの有効化（詳細版）

### 手順1: Firebase Consoleにアクセス

1. ブラウザで https://console.firebase.google.com/ を開く
2. Googleアカウントでログイン（必要に応じて）

### 手順2: プロジェクトを選択

1. 画面上部または左側のプロジェクト一覧から **「misesapo-system」** をクリック
   - もしプロジェクトが表示されない場合は、左上の「プロジェクトを選択」をクリックして選択

### 手順3: Firestore Databaseに移動

**方法A: 左メニューから選択**
1. 画面左側のメニューを確認
2. 「構築」セクションの中に **「Firestore Database」** という項目があるはずです
3. それをクリック

**方法B: メニューが折りたたまれている場合**
1. 画面左上の「☰」（ハンバーガーメニュー）アイコンをクリック
2. 「構築」を展開
3. 「Firestore Database」をクリック

**方法C: 検索で探す**
1. 画面左上の検索ボックスに「Firestore」と入力
2. 「Firestore Database」を選択

### 手順4: データベースを作成

Firestore Databaseのページに移動すると、以下のいずれかの画面が表示されます：

**パターン1: 「データベースを作成」ボタンが表示されている場合**
- 画面中央に大きな **「データベースを作成」** ボタンが表示されています
- このボタンをクリック

**パターン2: 「始める」ボタンが表示されている場合**
- 画面中央に **「始める」** または **「Get started」** ボタンが表示されています
- このボタンをクリック

**パターン3: 既にデータベースが存在する場合**
- 「データベースが既に存在します」というメッセージが表示される
- この場合は既に有効化されているので、次のステップ（セキュリティルール設定）に進んでください

### 手順5: セキュリティルールの選択

「データベースを作成」または「始める」をクリックすると、セキュリティルールの選択画面が表示されます：

1. **「テストモードで開始」** を選択
   - ⚠️ 重要: 「本番モードで開始」は選択しないでください
   - テストモードを選択すると、30日間は誰でも読み書きできますが、後でセキュリティルールを設定します

2. **「次へ」** または **「Next」** をクリック

### 手順6: ロケーションの選択

1. データベースのロケーション（リージョン）を選択する画面が表示されます
2. **「asia-northeast1 (Tokyo)」** または **「asia-northeast1」** を選択
   - 日本に最も近いリージョンです
   - 他のリージョンを選択しても動作しますが、レイテンシが高くなる可能性があります

3. **「有効にする」** または **「Enable」** をクリック

### 手順7: 完了

- データベースの作成が開始されます
- 数秒〜数分かかることがあります
- 「データベースが作成されました」というメッセージが表示されたら完了です

---

## Firebase Storageの有効化（詳細版）

### 手順1: Storageに移動

1. 画面左側のメニューから **「Storage」** をクリック
   - 「構築」セクションの中にあります
   - 見つからない場合は、ハンバーガーメニュー（☰）から探してください

### 手順2: Storageを開始

Storageのページに移動すると、以下のいずれかが表示されます：

**パターン1: 「始める」ボタンが表示されている場合**
- 画面中央に **「始める」** または **「Get started」** ボタンが表示されています
- このボタンをクリック

**パターン2: 既にStorageが有効化されている場合**
- 「Storageは既に有効化されています」というメッセージが表示される
- この場合は既に有効化されているので、次のステップ（セキュリティルール設定）に進んでください

### 手順3: セキュリティルールの選択

1. **「テストモードで開始」** を選択
2. **「次へ」** をクリック

### 手順4: ロケーションの選択

1. Firestoreと同じロケーション（`asia-northeast1`）を選択
2. **「完了」** または **「Done」** をクリック

---

## セキュリティルールの設定（詳細版）

### Firestore セキュリティルール

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

### Firebase Storage セキュリティルール

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

4. **「公開」** ボタンをクリック

---

## トラブルシューティング

### 「データベースを作成」ボタンが見つからない

**原因1: 既にデータベースが存在する**
- Firestore Databaseのページに移動して、データベースが既に存在するか確認してください
- 存在する場合は、そのままセキュリティルールの設定に進んでください

**原因2: 権限がない**
- Firebaseプロジェクトのオーナーまたは編集者権限が必要です
- プロジェクトの設定で権限を確認してください

**原因3: 別の画面にいる**
- 必ず「Firestore Database」のページにいることを確認してください
- URLが `https://console.firebase.google.com/project/misesapo-system/firestore` になっているか確認

### メニューが見つからない

- 画面左上の「☰」（ハンバーガーメニュー）アイコンをクリックしてメニューを展開してください
- ブラウザのウィンドウサイズが小さい場合、メニューが折りたたまれている可能性があります

### プロジェクトが表示されない

- 画面左上の「プロジェクトを選択」をクリック
- プロジェクト一覧から「misesapo-system」を選択
- もしプロジェクトが一覧にない場合は、プロジェクトを作成する必要があります

