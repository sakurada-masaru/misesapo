# ユーザー管理からマイページへのリンク調査結果

## 📋 調査日
2025年1月

## ユーザーリストの正のソース

workers 一覧の正のソースは **DynamoDB の workers テーブル**（および API `GET /workers`）のみです。`workers.json` は廃止済みです。詳細は `docs/spec/WORKERS_LIST_REFERENCE.md` を参照してください。

---

## 🔗 マイページへのリンク

### 1. ユーザー一覧画面 (`/admin/users/index.html`)

**実装場所**: `src/assets/js/admin-users.js`

```javascript
// マイページリンクを生成（IDを優先、なければメールアドレス）
let mypageUrl = '/staff/mypage';
if (u.id && u.id !== 'N/A' && !u.id.startsWith('temp_')) {
  mypageUrl = `/staff/mypage?id=${encodeURIComponent(u.id)}`;
} else if (u.email && u.email !== '-') {
  mypageUrl = `/staff/mypage?email=${encodeURIComponent(u.email)}`;
}
```

**リンク形式**:
- IDがある場合: `/staff/mypage?id=W001`
- IDがない場合: `/staff/mypage?email=user@example.com`
- **拡張子なし**（`.html`が付いていない）

---

### 2. ユーザー詳細画面 (`/admin/users/detail.html`)

**実装場所**: `src/pages/admin/users/detail.html`

```javascript
// マイページリンクを更新（サイドバー）
const mypageLink = document.getElementById('user-mypage-link');
if (mypageLink && user.id) {
  mypageLink.href = `/staff/mypage.html?id=${user.id}`;
  mypageLink.style.display = 'flex';
}

// マイページボタンを更新（クイックアクション）
const mypageBtn = document.getElementById('mypage-btn');
if (mypageBtn && user.id) {
  mypageBtn.href = `/staff/mypage.html?id=${user.id}`;
  mypageBtn.style.display = 'flex';
}
```

**リンク形式**:
- `/staff/mypage.html?id=W001`
- **拡張子あり**（`.html`が付いている）

---

### 3. マイページの実装 (`/staff/mypage.html`)

**ファイル**: `src/pages/staff/mypage.html`

**URLパラメータの処理**:
```javascript
// URLパラメータからIDまたはメールアドレスを取得
const urlParams = new URLSearchParams(window.location.search);
const urlId = urlParams.get('id');
const urlEmail = urlParams.get('email');

if (urlId) {
  userId = urlId;
} else if (urlEmail) {
  userEmail = urlEmail;
}
```

**ユーザー情報の取得順序**:
1. URLパラメータ（`id`または`email`）
2. ローカルストレージの`cognito_user`
3. Cognito認証情報
4. `misesapo_auth`
5. Firebase認証情報

**データソース**: AWS API（`/workers/{id}` または `/workers?email={email}`）のみ。workers 一覧の正のソースは DynamoDB です。

---

## ⚠️ 問題点

### 1. パスの不整合
- **一覧画面**: `/staff/mypage?id=W001`（拡張子なし）
- **詳細画面**: `/staff/mypage.html?id=W001`（拡張子あり）
- **実際のファイル**: `/staff/mypage.html`

### 2. 影響
- 拡張子なしのパスは、Webサーバーの設定によっては動作しない可能性がある
- 一貫性がないため、メンテナンスが困難

---

## 🔧 推奨修正

### 修正方針
すべてのリンクを**拡張子あり**（`.html`）に統一することを推奨します。

### 修正箇所

#### 1. ユーザー一覧画面 (`src/assets/js/admin-users.js`)
```javascript
// 修正前
let mypageUrl = '/staff/mypage';
if (u.id && u.id !== 'N/A' && !u.id.startsWith('temp_')) {
  mypageUrl = `/staff/mypage?id=${encodeURIComponent(u.id)}`;
} else if (u.email && u.email !== '-') {
  mypageUrl = `/staff/mypage?email=${encodeURIComponent(u.email)}`;
}

// 修正後
let mypageUrl = '/staff/mypage.html';
if (u.id && u.id !== 'N/A' && !u.id.startsWith('temp_')) {
  mypageUrl = `/staff/mypage.html?id=${encodeURIComponent(u.id)}`;
} else if (u.email && u.email !== '-') {
  mypageUrl = `/staff/mypage.html?email=${encodeURIComponent(u.email)}`;
}
```

---

## 📊 まとめ

### ✅ 完了した作業
1. JSONファイルの同期スクリプトのバグ修正
2. AWSからJSONファイルへの同期実行（22名のユーザー情報）
3. マイページリンクの実装箇所の調査

### 🔧 必要な修正
1. ユーザー一覧画面のマイページリンクを拡張子ありに統一

### 📝 注意事項
- マイページはURLパラメータ（`id`または`email`）でユーザーを識別
- ユーザー情報は AWS API（DynamoDB workers）からのみ取得（workers.json は廃止済み）

