# ユーザー登録・管理システムの提案

## 📋 現状の問題

現在、ユーザーデータは`users.js`にハードコードされているため、新しいユーザーを追加するには：

1. `users.js`を編集
2. パスワードをSHA-256でハッシュ化
3. ビルドしてGitHubにプッシュ

という手順が必要で、**非現実的**です。

---

## 🎯 解決策の提案

### オプション1: localStorage + 管理者によるユーザー追加（推奨）

**概要**: 
- 初期ユーザーは`users.js`にハードコード
- 新規ユーザーはlocalStorageに保存
- 管理者がユーザーを追加できるページを作成

**メリット**:
- ✅ GitHub Pagesでも動作
- ✅ コード変更不要でユーザー追加可能
- ✅ 実装が比較的簡単

**デメリット**:
- ❌ localStorageはクライアント側のみ（他のデバイスでは使えない）
- ❌ ブラウザのデータを削除すると消える
- ❌ 複数デバイスでの同期ができない

**実装内容**:
1. `users.js`を修正して、localStorageからもユーザーデータを読み込む
2. 管理者によるユーザー追加ページを作成（`/admin/users/new.html`）
3. 追加されたユーザーはlocalStorageに保存
4. ログイン時に`users.js`の初期データとlocalStorageのデータをマージ

---

### オプション2: 外部認証サービス（Firebase Auth、Auth0など）

**概要**: 
- Firebase Auth、Auth0などの外部サービスを使用
- ユーザー登録・認証を外部サービスに委託

**メリット**:
- ✅ セキュリティが高い
- ✅ 複数デバイスでの同期が可能
- ✅ パスワードリセット機能などが標準装備

**デメリット**:
- ❌ 外部サービスへの依存
- ❌ コストがかかる可能性（無料枠あり）
- ❌ 実装が複雑

**推奨サービス**:
- **Firebase Auth**: Google提供、無料枠あり、実装が比較的簡単
- **Auth0**: エンタープライズ向け、無料枠あり
- **Supabase Auth**: オープンソース、無料枠あり

---

### オプション3: GitHub Pages + GitHub API

**概要**: 
- GitHubのAPIを使ってユーザーデータを管理
- GitHubのリポジトリにユーザーデータを保存

**メリット**:
- ✅ GitHub Pagesと統合
- ✅ バージョン管理が可能

**デメリット**:
- ❌ 実装が複雑
- ❌ GitHub APIのレート制限
- ❌ セキュリティ上の懸念（リポジトリにパスワードハッシュを保存）

---

## 🚀 推奨実装: オプション1（localStorage + 管理者によるユーザー追加）

### 実装ステップ

#### 1. `users.js`の修正

```javascript
// 初期ユーザーデータ（ハードコード）
const INITIAL_USERS = [...];

// localStorageからユーザーデータを読み込む
function loadUsersFromStorage() {
  try {
    const stored = localStorage.getItem('misesapo_users');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('[Users] Error loading from storage:', e);
    return [];
  }
}

// 全ユーザーデータを取得（初期データ + localStorage）
function getAllUsers() {
  const storedUsers = loadUsersFromStorage();
  // 初期ユーザーとlocalStorageのユーザーをマージ（重複は初期ユーザーを優先）
  const allUsers = [...INITIAL_USERS];
  storedUsers.forEach(stored => {
    if (!INITIAL_USERS.find(u => u.email === stored.email)) {
      allUsers.push(stored);
    }
  });
  return allUsers;
}
```

#### 2. 管理者によるユーザー追加ページ

`/admin/users/new.html`を作成：
- メールアドレス入力
- パスワード入力
- ロール選択（staff, concierge, admin, developer）
- 名前入力
- 追加ボタン

追加時に：
1. パスワードをSHA-256でハッシュ化
2. localStorageに保存
3. 管理者に通知

#### 3. ユーザー登録機能（オプション）

一般ユーザーが自分で登録できる機能：
- `/signup.html`で登録
- 登録後、管理者の承認を待つ（`status: 'pending'`）
- 承認後、`status: 'active'`に変更

---

## 📝 実装の優先順位

1. **フェーズ1（必須）**: localStorage対応 + 管理者によるユーザー追加
2. **フェーズ2（推奨）**: ユーザー登録機能 + 承認フロー
3. **フェーズ3（将来）**: 外部認証サービスへの移行

---

## ⚠️ 注意事項

### localStorageの制限

- **データの永続性**: ブラウザのデータを削除すると消える
- **デバイス間の同期**: 複数デバイスでの同期ができない
- **容量制限**: 約5-10MB（通常は十分）

### セキュリティ

- パスワードはSHA-256でハッシュ化されているが、ハッシュ値はJavaScriptファイルに含まれる
- 本番環境では、外部認証サービス（Firebase Authなど）の使用を推奨

---

## 💡 次のステップ

1. **オプション1を実装**: localStorage対応 + 管理者によるユーザー追加
2. **テスト**: 管理者がユーザーを追加できることを確認
3. **ドキュメント**: 管理者向けのユーザー追加手順を作成

