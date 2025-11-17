# WordPressページの表示確認ガイド

## 📋 現在の状況

WordPressのページに、以下のショートコードを追加したはずです：

1. `[misesapo_hero]` - ヒーローセクション
2. `[misesapo_contact_box]` - お問い合わせボタンセクション
3. `[misesapo_problem]` - お悩みセクション

---

## 🔍 確認方法

### ステップ1: WordPress管理画面でページを確認

1. WordPress管理画面にログイン
2. **固定ページ** → **すべてのページ** に移動
3. 作成したページ（例：「トップページ」）を開く
4. **Elementorで編集** をクリック

### ステップ2: Elementorエディターで確認

Elementorエディターで、以下のショートコードが追加されているか確認：

1. **HTMLウィジェット** または **Codeウィジェット** を確認
2. 各ウィジェット内に以下のショートコードが入力されているか確認：
   - `[misesapo_hero]`
   - `[misesapo_contact_box]`
   - `[misesapo_problem]`

### ステップ3: フロントエンドで確認

1. **ページを表示** をクリック
2. または、フロントエンドで直接ページを開く
3. 以下のセクションが表示されているか確認：

#### 1. ヒーローセクション
- フルスクリーンの画像スライダー
- マスク画像
- 化粧ヘッダー（ロゴとナビゲーション）

#### 2. お問い合わせボタンセクション
- 「まずはご気軽にご相談してみませんか？」の見出し
- 電話番号ボタン（070-3332-3939）
- Webでのお申し込みボタン

#### 3. お悩みセクション
- 「こんなお悩みありませんか？」の見出し
- お悩みリスト（4項目）
- イラスト画像

---

## 🚨 表示されていない場合

### ショートコードが表示されない場合

1. **ショートコードが正しく入力されているか確認**
   - `[misesapo_hero]` のように、角括弧で囲まれているか
   - スペースや改行が入っていないか

2. **テンプレートファイルが存在するか確認**
   - `/lightning-child/templates/hero-section.php`
   - `/lightning-child/templates/contact-box-section.php`
   - `/lightning-child/templates/problem-section.php`

3. **functions.php でショートコードが登録されているか確認**
   - `add_shortcode('misesapo_hero', ...)`
   - `add_shortcode('misesapo_contact_box', ...)`
   - `add_shortcode('misesapo_problem', ...)`

### 画像が表示されない場合

1. **画像ファイルがアップロードされているか確認**
   - `/lightning-child/assets/images/images-admin/`
   - `/lightning-child/assets/images/images-material/`

2. **画像パスが正しいか確認**
   - `misesapo_image_url()` 関数が正しく動作しているか

### CSSが適用されていない場合

1. **CSSファイルがアップロードされているか確認**
   - `/lightning-child/assets/css/style.css`

2. **functions.php でCSSが読み込まれているか確認**
   - `wp_enqueue_style('misesapo-style', ...)`

---

## 📝 現在表示されている内容を教えてください

以下の情報を教えていただけると、問題を特定できます：

1. **どのセクションが表示されているか**
   - ヒーローセクション：表示されている / 表示されていない
   - お問い合わせボタンセクション：表示されている / 表示されていない
   - お悩みセクション：表示されている / 表示されていない

2. **表示されている内容**
   - 何が表示されているか（テキスト、画像、ボタンなど）
   - レイアウトは正しいか

3. **エラーメッセージ**
   - ブラウザの開発者ツール（F12）でエラーが出ていないか

---

## 🎯 次のステップ

現在の表示状況を教えていただければ、次の対応を提案します。


