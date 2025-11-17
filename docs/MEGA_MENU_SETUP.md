# メガメニュー セットアップガイド

## 📋 概要

WordPress/Elementorで使用できるメガメニューを作成しました。デスクトップではホバーでサブメニューが表示され、スマホではハンバーガーメニューとして動作します。

## 📁 ファイル構成

```
lightning-child/
├── templates/
│   └── mega-menu.php          # メガメニューのHTMLテンプレート
├── assets/
│   ├── css/
│   │   └── mega-menu.css      # メガメニューのスタイル
│   └── js/
│       └── mega-menu.js       # メガメニューのJavaScript
└── functions.php               # ショートコードとアセット読み込み（更新済み）
```

## 🚀 セットアップ手順

### ステップ1: ファイルのアップロード

#### 1-1. テンプレートファイルのアップロード

1. **ローカルファイル**: `wordpress-templates/mega-menu.php`
2. **アップロード先**: `/lightning-child/templates/mega-menu.php`
3. フォルダが存在しない場合は作成してください

#### 1-2. CSSファイルのアップロード

1. **ローカルファイル**: `public/css/mega-menu.css`
2. **アップロード先**: `/lightning-child/assets/css/mega-menu.css`

#### 1-3. JavaScriptファイルのアップロード

1. **ローカルファイル**: `public/js/mega-menu.js`
2. **アップロード先**: `/lightning-child/assets/js/mega-menu.js`

### ステップ2: functions.php の更新

`docs/LIGHTNING_CHILD_FUNCTIONS_PHP.md` の内容を `functions.php` に追加してください。

**追加される内容:**
- CSS読み込み: `misesapo-mega-menu-css`
- JavaScript読み込み: `misesapo-mega-menu-js`
- ショートコード: `[misesapo_mega_menu]`

### ステップ3: Elementorでの使用

#### 方法1: ショートコードウィジェットを使用（推奨）

1. Elementorでページを編集
2. **ウィジェット** → **ショートコード** をドラッグ&ドロップ
3. ショートコード欄に `[misesapo_mega_menu]` を入力
4. **更新** をクリック

#### 方法2: HTMLウィジェットを使用

1. Elementorでページを編集
2. **ウィジェット** → **HTML** をドラッグ&ドロップ
3. 以下のコードを入力：

```html
[misesapo_mega_menu]
```

4. **更新** をクリック

### ステップ4: ヘッダーに配置する場合

Elementorのヘッダーテンプレートまたはテーマのヘッダーに配置する場合：

1. **外観** → **カスタマイズ** → **ヘッダー** に移動
2. ヘッダーエリアにショートコードウィジェットを追加
3. `[misesapo_mega_menu]` を入力

または、テーマの `header.php` を編集：

```php
<?php echo do_shortcode('[misesapo_mega_menu]'); ?>
```

## 🎨 カスタマイズ

### メニュー項目の編集

`templates/mega-menu.php` を編集して、メニュー項目を追加・削除・変更できます。

**例: 新しいメニュー項目を追加**

```php
<li class="mega-menu-item">
    <a href="<?php echo esc_url(home_url('/new-page')); ?>" class="mega-menu-link">
        新しいページ
    </a>
</li>
```

**例: サブメニューを追加**

```php
<li class="mega-menu-item mega-menu-has-submenu">
    <a href="<?php echo esc_url(home_url('/parent')); ?>" class="mega-menu-link">
        親メニュー
        <span class="mega-menu-arrow">▼</span>
    </a>
    <div class="mega-menu-submenu">
        <div class="mega-menu-submenu-inner">
            <div class="mega-menu-column">
                <h3 class="mega-menu-column-title">カテゴリ1</h3>
                <ul class="mega-menu-column-list">
                    <li><a href="<?php echo esc_url(home_url('/sub1')); ?>">サブメニュー1</a></li>
                    <li><a href="<?php echo esc_url(home_url('/sub2')); ?>">サブメニュー2</a></li>
                </ul>
            </div>
        </div>
    </div>
</li>
```

### スタイルのカスタマイズ

`assets/css/mega-menu.css` を編集して、色やレイアウトを変更できます。

**主なCSS変数:**

```css
/* メインカラー */
color: #FF008C;

/* ホバー時の背景色 */
background-color: rgba(255, 0, 140, 0.08);

/* サブメニューの幅 */
width: 600px;
```

## 📱 レスポンシブ対応

- **デスクトップ（769px以上）**: 横並びメニュー、ホバーでサブメニュー表示
- **タブレット（769px〜1024px）**: 横並びメニュー、サブメニュー幅を調整
- **スマホ（768px以下）**: ハンバーガーメニュー、タップでサブメニュー表示

## 🔧 機能

### デスクトップ機能

- ✅ ホバーでサブメニューを表示
- ✅ スムーズなアニメーション
- ✅ 現在のページをハイライト
- ✅ タッチデバイス対応

### スマホ機能

- ✅ ハンバーガーメニュー
- ✅ タップでサブメニューを開閉
- ✅ メニュー外タップで閉じる
- ✅ ESCキーで閉じる
- ✅ スクロールロック

## 🐛 トラブルシューティング

### メニューが表示されない

1. **ファイルが正しくアップロードされているか確認**
   - `templates/mega-menu.php`
   - `assets/css/mega-menu.css`
   - `assets/js/mega-menu.js`

2. **functions.php が正しく更新されているか確認**
   - CSS/JSの読み込みコードがあるか
   - ショートコードが登録されているか

3. **ブラウザのキャッシュをクリア**
   - Ctrl+Shift+R (Windows/Linux)
   - Cmd+Shift+R (Mac)

### スタイルが適用されない

1. **CSSファイルのパスを確認**
   - `assets/css/mega-menu.css` が正しいか

2. **functions.php のCSS読み込みを確認**
   ```php
   wp_enqueue_style('misesapo-mega-menu-css', $theme_uri . '/assets/css/mega-menu.css', array(), '1.0');
   ```

3. **ブラウザの開発者ツールで確認**
   - F12キーで開発者ツールを開く
   - 「Network」タブでCSSファイルが読み込まれているか確認

### JavaScriptが動作しない

1. **JavaScriptファイルのパスを確認**
   - `assets/js/mega-menu.js` が正しいか

2. **functions.php のJS読み込みを確認**
   ```php
   wp_enqueue_script('misesapo-mega-menu-js', $theme_uri . '/assets/js/mega-menu.js', array('jquery'), '1.0', true);
   ```

3. **ブラウザのコンソールでエラーを確認**
   - F12キーで開発者ツールを開く
   - 「Console」タブでエラーメッセージを確認

### スマホでメニューが開かない

1. **JavaScriptファイルが読み込まれているか確認**
2. **ハンバーガーボタンのIDが正しいか確認**
   - `id="mega-menu-toggle"`

3. **ブラウザのコンソールでエラーを確認**

## 📝 メニュー項目のURL設定

現在のメニュー項目は以下のURLを使用しています：

- **トップページ**: `home_url('/')`
- **サービス**: `home_url('/service')`
- **コンシェルジュ**: `home_url('/concierge')`
- **お問い合わせ**: `home_url('/contact')`
- **求人**: `home_url('/recruit')`
- **ログイン**: `wp_login_url()`
- **新規登録**: `home_url('/signup')`

これらのURLは、WordPressの固定ページやカスタム投稿タイプに合わせて変更してください。

## 🎯 次のステップ

1. メニュー項目を実際のページに合わせて編集
2. サブメニューの内容をカスタマイズ
3. スタイルをサイトのデザインに合わせて調整
4. 必要に応じて追加のメニュー項目を追加

## 📚 関連ドキュメント

- `LIGHTNING_CHILD_FUNCTIONS_PHP.md` - functions.phpの設定
- `LIGHTNING_CHILD_SETUP_GUIDE.md` - 全体的なセットアップガイド

