# エックスサーバー アップロードチェックリスト

## アップロードが必要なファイル一覧

### 1. CSSファイル（2ファイル）

**アップロード先:** `assets/css/`

- ✅ `public/css/style.css` → `assets/css/style.css`
- ✅ `public/css/swiper-bundle.min.css` → `assets/css/swiper-bundle.min.css`

**手順:**
1. エックスサーバーのファイルマネージャーで `assets/css/` フォルダを開く
2. 「アップロード」ボタンをクリック
3. ローカルの `public/css/style.css` を選択してアップロード
4. 再度「アップロード」ボタンをクリック
5. ローカルの `public/css/swiper-bundle.min.css` を選択してアップロード

### 2. JavaScriptファイル（複数ファイル）

**アップロード先:** `assets/js/`

- ✅ `public/js/script.js` → `assets/js/script.js`
- ✅ `public/js/navigation.js` → `assets/js/navigation.js`
- ✅ `public/js/auth.js` → `assets/js/auth.js`
- ✅ `public/js/swiper-bundle.min.js` → `assets/js/swiper-bundle.min.js`
- ✅ `public/js/firebase-auth.js` → `assets/js/firebase-auth.js`（使用している場合）
- ✅ `public/js/firebase-config.js` → `assets/js/firebase-config.js`（使用している場合）
- ✅ `public/js/role_config.js` → `assets/js/role_config.js`（使用している場合）
- ✅ `public/js/users.js` → `assets/js/users.js`（使用している場合）
- ✅ `public/js/client_auth.js` → `assets/js/client_auth.js`（使用している場合）

**手順:**
1. エックスサーバーのファイルマネージャーで `assets/js/` フォルダを開く
2. 「アップロード」ボタンをクリック
3. ローカルの `public/js/` フォルダ内の全ファイルを選択（CtrlキーまたはCmdキーを押しながら複数選択）
4. アップロード

**または、1つずつアップロード:**
- `script.js`
- `navigation.js`
- `auth.js`
- `swiper-bundle.min.js`
- その他、使用しているJSファイル

### 3. 画像ファイル（フォルダごと）

**アップロード先:** `assets/images/`

以下のフォルダをアップロード：

- ✅ `public/images-admin/` → `assets/images/images-admin/`
- ✅ `public/images-service/` → `assets/images/images-service/`
- ✅ `public/images-material/` → `assets/images/images-material/`
- ✅ `public/images/` → `assets/images/images/`（その他の画像がある場合）
- ✅ `public/images-customer/` → `assets/images/images-customer/`（使用している場合）
- ✅ `public/images-public/` → `assets/images/images-public/`（使用している場合）

**手順（フォルダごと）:**

#### 方法A: フォルダ内のファイルを個別にアップロード

1. `assets/images/` フォルダを開く
2. 「新規作成」→「フォルダを作成」で `images-admin` フォルダを作成
3. `images-admin` フォルダを開く
4. 「アップロード」ボタンをクリック
5. ローカルの `public/images-admin/` 内の全ファイルを選択してアップロード
6. 同様に `images-service`、`images-material` フォルダも作成してアップロード

#### 方法B: ZIPファイルでアップロード（推奨・簡単）

1. **ローカルでZIPファイルを作成:**
   - `public/images-admin/` フォルダをZIPに圧縮 → `images-admin.zip`
   - `public/images-service/` フォルダをZIPに圧縮 → `images-service.zip`
   - `public/images-material/` フォルダをZIPに圧縮 → `images-material.zip`

2. **エックスサーバーで:**
   - `assets/images/` フォルダを開く
   - ZIPファイルをアップロード
   - ZIPファイルを右クリック → 「展開」を選択
   - 展開後、ZIPファイルを削除

## アップロード後の確認

### ファイルが正しくアップロードされたか確認

1. **ブラウザで直接アクセス:**
   ```
   https://misesapo.site/wp-content/themes/cocoon-child-master/assets/css/style.css
   https://misesapo.site/wp-content/themes/cocoon-child-master/assets/js/script.js
   https://misesapo.site/wp-content/themes/cocoon-child-master/assets/images/images-admin/hero-image001.png
   ```

2. **WordPress管理画面で確認:**
   - サイトが正常に表示されるか
   - エラーメッセージが出ていないか

## チェックリスト

### CSSファイル
- [ ] `style.css` をアップロード
- [ ] `swiper-bundle.min.css` をアップロード

### JavaScriptファイル
- [ ] `script.js` をアップロード
- [ ] `navigation.js` をアップロード
- [ ] `auth.js` をアップロード
- [ ] `swiper-bundle.min.js` をアップロード
- [ ] その他のJSファイル（使用しているもの）

### 画像ファイル
- [ ] `images-admin/` フォルダと画像をアップロード
- [ ] `images-service/` フォルダと画像をアップロード
- [ ] `images-material/` フォルダと画像をアップロード
- [ ] その他の画像フォルダ（使用しているもの）

## よくある質問

**Q: `style.css` だけアップロードすればいい？**
A: いいえ。`style.css` と `swiper-bundle.min.css` の2つが必要です。また、JSファイルと画像ファイルも必要です。

**Q: 画像ファイルは全部必要？**
A: 使用している画像だけアップロードすればOKです。ただし、ヒーローセクションで使用している画像は必須です：
- `hero-image001.png`
- `hero-image002.png`
- `hero-image003.png`
- `mask-hero001.png`

**Q: ファイルが多すぎてアップロードに時間がかかる**
A: ZIPファイルで圧縮してアップロード後、展開する方法がおすすめです。

## 次のステップ

1. ✅ CSSファイルをアップロード
2. ✅ JavaScriptファイルをアップロード
3. ✅ 画像ファイルをアップロード
4. ⬜ 動作確認
5. ⬜ Elementorでショートコードをテスト


