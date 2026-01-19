# フロントエンド動作確認チェックリスト

## 📋 確認項目

### 1. 開発サーバーの起動確認

- [ ] 開発サーバーが起動しているか確認
  ```bash
  curl http://localhost:5173/admin/reports.html
  ```
  またはブラウザで http://localhost:5173/admin/reports.html にアクセス

---

### 2. Firebase認証の確認

#### 2-1. ログイン状態の確認

1. **ログインページにアクセス**
   - http://localhost:5173/signin.html
   - メールアドレスとパスワードでログイン

2. **ブラウザの開発者ツールで確認**
   - F12キーで開発者ツールを開く
   - Consoleタブで以下を確認：
     - [ ] `[Firebase] Initialized successfully` が表示されているか
     - [ ] エラーメッセージがないか

3. **Firebase認証状態の確認**
   - Consoleタブで以下を実行：
     ```javascript
     // Firebase Authが利用可能か確認
     typeof window.FirebaseAuth !== 'undefined'  // true であるべき
     
     // 現在のユーザーを確認
     window.FirebaseAuth.currentUser  // null でない（ログイン後）
     ```

---

### 3. レポート一覧ページの確認

#### 3-1. ページの表示確認

1. **レポート一覧ページにアクセス**
   - http://localhost:5173/admin/reports.html

2. **表示確認**
   - [ ] ページが正常に表示されるか
   - [ ] ローディング表示が表示されるか
   - [ ] レポート一覧が表示されるか（または空のメッセージ）

3. **ブラウザの開発者ツールで確認**
   - Consoleタブ：
     - [ ] `[Reports]` で始まるログを確認
     - [ ] エラーメッセージがないか
   - Networkタブ：
     - [ ] `GET /staff/reports` リクエストが送信されているか
     - [ ] ステータスコードが200か
     - [ ] `Authorization: Bearer ...` ヘッダーが含まれているか
     - [ ] `mock-token`ではなく、実際のFirebase IDトークンが送信されているか（ログイン後）

---

### 4. レポート作成ページの確認

#### 4-1. ページの表示確認

1. **レポート作成ページにアクセス**
   - http://localhost:5173/admin/reports/new.html

2. **表示確認**
   - [ ] フォームが正常に表示されるか
   - [ ] 店舗選択ドロップダウンが表示されるか
   - [ ] 日付・時刻入力フィールドが表示されるか
   - [ ] 清掃項目の追加ボタンが表示されるか

3. **機能確認**
   - [ ] 清掃項目を追加できるか
   - [ ] 清掃項目を削除できるか
   - [ ] 写真アップロードボタンが表示されるか

---

### 5. レポート詳細ページの確認

#### 5-1. ページの表示確認

1. **レポート詳細ページにアクセス**
   - http://localhost:5173/reports/0f094145-69d3-4254-b0c1-f6adcf72d64b.html
   - （または、レポート一覧から「詳細を見る」をクリック）

2. **表示確認**
   - [ ] ページが正常に表示されるか
   - [ ] ローディング表示が表示されるか
   - [ ] レポート詳細が表示されるか

3. **ブラウザの開発者ツールで確認**
   - Consoleタブ：
     - [ ] `[Reports]` で始まるログを確認
     - [ ] エラーメッセージがないか
   - Networkタブ：
     - [ ] `GET /staff/reports/{report_id}` リクエストが送信されているか
     - [ ] ステータスコードが200か
     - [ ] `Authorization: Bearer ...` ヘッダーが含まれているか

---

### 6. レポート編集ページの確認

#### 6-1. ページの表示確認

1. **レポート編集ページにアクセス**
   - http://localhost:5173/admin/reports/0f094145-69d3-4254-b0c1-f6adcf72d64b/edit.html
   - （または、レポート一覧から「編集」をクリック）

2. **表示確認**
   - [ ] ページが正常に表示されるか
   - [ ] ローディング表示が表示されるか
   - [ ] 既存データがフォームに読み込まれるか

3. **ブラウザの開発者ツールで確認**
   - Consoleタブ：
     - [ ] `[Reports]` で始まるログを確認
     - [ ] エラーメッセージがないか
   - Networkタブ：
     - [ ] `GET /staff/reports/{report_id}` リクエストが送信されているか
     - [ ] ステータスコードが200か

---

### 7. Firebase IDトークンの確認

#### 7-1. ログイン後の確認

1. **ログイン状態でレポートページにアクセス**

2. **ブラウザの開発者ツールで確認**
   - Consoleタブで以下を実行：
     ```javascript
     // 現在のユーザーを確認
     window.FirebaseAuth.currentUser
     
     // IDトークンを取得
     window.FirebaseAuth.currentUser.getIdToken().then(token => {
       console.log('ID Token:', token);
     })
     ```

3. **Networkタブで確認**
   - APIリクエストの`Authorization`ヘッダーを確認
   - `Bearer`の後に実際のFirebase IDトークンが含まれているか確認
   - `mock-token`ではないことを確認

---

### 8. エラーハンドリングの確認

#### 8-1. 未ログイン状態での確認

1. **ログアウト状態でレポートページにアクセス**
   - http://localhost:5173/admin/reports.html

2. **確認**
   - [ ] `mock-token`が使用されているか（Consoleログで確認）
   - [ ] エラーメッセージが適切に表示されるか

#### 8-2. ネットワークエラーの確認

1. **開発者ツールでネットワークを無効化**
   - Networkタブ → 「Offline」を選択

2. **レポートページにアクセス**

3. **確認**
   - [ ] エラーメッセージが適切に表示されるか
   - [ ] ユーザーフレンドリーなメッセージが表示されるか

---

## 🐛 よくある問題と対処法

### 問題1: Firebase Authが初期化されていない

**症状**: Consoleに `[Reports] Firebase Auth is not available` が表示される

**対処法**:
1. `src/layouts/base.html`でFirebase SDKが読み込まれているか確認
2. `public/js/firebase-config.js`が存在するか確認
3. ブラウザのキャッシュをクリア（Ctrl+Shift+R / Cmd+Shift+R）

### 問題2: IDトークンが`mock-token`のまま

**症状**: Networkタブで`Authorization: Bearer mock-token`が表示される

**対処法**:
1. ログインしているか確認
2. `window.FirebaseAuth.currentUser`が`null`でないか確認
3. ブラウザの開発者ツールでエラーメッセージを確認

### 問題3: APIリクエストが404エラー

**症状**: Networkタブで404エラーが表示される

**対処法**:
1. APIエンドポイントのURLが正しいか確認
2. API Gatewayが正しく設定されているか確認
3. Lambda関数がデプロイされているか確認

---

## 📝 確認結果の記録

確認日: _______________

確認者: _______________

### 確認結果

- [ ] レポート一覧ページ: ✅ / ❌
- [ ] レポート作成ページ: ✅ / ❌
- [ ] レポート詳細ページ: ✅ / ❌
- [ ] レポート編集ページ: ✅ / ❌
- [ ] Firebase認証: ✅ / ❌
- [ ] IDトークンの取得: ✅ / ❌

### 発見した問題

1. 
2. 
3. 

---

## 🎯 次のステップ

すべての確認が完了したら：

1. **問題があれば修正**
2. **バックエンドの実装に進む**（Firebase Admin SDKの統合）
3. **統合テストを実施**

