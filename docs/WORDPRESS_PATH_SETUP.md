# WordPress パス設定ガイド

## 確認されたパス構造

```
/misesapo.site/public_html/corporate/
├── wp-content/
│   └── themes/
│       └── cocoon-child-master/    ← 子テーマフォルダ
│           └── tmp-user/           ← 一時フォルダ？
```

## 正しいファイル配置場所

### テーマフォルダの構造

```
/misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/
├── style.css                    ← 既存
├── functions.php                ← 既存（編集済み）
├── assets/                      ← 新規作成
│   ├── css/
│   │   ├── style.css
│   │   └── swiper-bundle.min.css
│   ├── js/
│   │   ├── script.js
│   │   ├── navigation.js
│   │   └── auth.js
│   └── images/
│       ├── images-admin/
│       ├── images-service/
│       └── images-material/
└── templates/                   ← 新規作成
    ├── hero-section.php
    └── problem-section.php
```

## ファイル配置手順

### 方法1: FTP/SSHで直接アップロード

#### ステップ1: フォルダを作成

```
/misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/
/misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/css/
/misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/js/
/misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/images/
/misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/templates/
```

#### ステップ2: ファイルをアップロード

**CSSファイル:**
```
現在のプロジェクト: public/css/style.css
→ /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/css/style.css

現在のプロジェクト: public/css/swiper-bundle.min.css
→ /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/css/swiper-bundle.min.css
```

**JavaScriptファイル:**
```
現在のプロジェクト: public/js/script.js
→ /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/js/script.js

現在のプロジェクト: public/js/navigation.js
→ /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/js/navigation.js

現在のプロジェクト: public/js/auth.js
→ /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/js/auth.js
```

**画像ファイル:**
```
現在のプロジェクト: public/images-admin/
→ /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/images/images-admin/

現在のプロジェクト: public/images-service/
→ /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/images/images-service/

現在のプロジェクト: public/images-material/
→ /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/images/images-material/
```

### 方法2: SSHでコピー（サーバー上で実行）

サーバーにSSH接続できる場合：

```bash
# 現在のプロジェクトをサーバーにアップロード後、以下のコマンドを実行

# テーマフォルダに移動
cd /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/

# フォルダを作成
mkdir -p assets/css assets/js assets/images templates

# ファイルをコピー（アップロードした場所から）
# 例: /tmp/misesapo-main/public/ にアップロードした場合
cp /tmp/misesapo-main/public/css/*.css assets/css/
cp /tmp/misesapo-main/public/js/*.js assets/js/
cp -r /tmp/misesapo-main/public/images* assets/images/
```

### 方法3: WordPress管理画面から（制限あり）

1. **メディアライブラリに画像をアップロード**
   - 外観 > メディア > 新規追加
   - ただし、CSS/JSは直接アップロードできないため、FTP/SSHが必要

2. **テーマファイルエディターでテンプレートを作成**
   - 外観 > テーマファイルエディター
   - ただし、新規ファイルの作成は制限される場合がある

## パスの確認

### functions.php のパスが正しいか確認

現在の `functions.php` で使用しているパス：
```php
get_stylesheet_directory_uri()  // 子テーマのURL
get_stylesheet_directory()      // 子テーマのパス
```

これらは自動的に以下を指します：
- URL: `https://your-domain.com/wp-content/themes/cocoon-child-master/`
- パス: `/misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/`

### 実際のパスを確認する方法

WordPress管理画面で一時的に以下を追加して確認：

```php
// functions.php に一時的に追加（確認後は削除）
function debug_paths() {
    echo '<pre>';
    echo 'Stylesheet Directory URI: ' . get_stylesheet_directory_uri() . "\n";
    echo 'Stylesheet Directory: ' . get_stylesheet_directory() . "\n";
    echo 'CSS Path: ' . get_stylesheet_directory_uri() . '/assets/css/style.css' . "\n";
    echo '</pre>';
}
add_action('wp_footer', 'debug_paths');
```

## ファイル配置のチェックリスト

- [ ] `assets/css/` フォルダを作成
- [ ] `style.css` をアップロード
- [ ] `swiper-bundle.min.css` をアップロード
- [ ] `assets/js/` フォルダを作成
- [ ] `script.js` をアップロード
- [ ] `navigation.js` をアップロード
- [ ] `auth.js` をアップロード
- [ ] `assets/images/` フォルダを作成
- [ ] `images-admin/` フォルダと画像をアップロード
- [ ] `images-service/` フォルダと画像をアップロード
- [ ] `images-material/` フォルダと画像をアップロード
- [ ] `templates/` フォルダを作成
- [ ] `hero-section.php` を作成
- [ ] `problem-section.php` を作成

## パーミッションの設定

ファイルをアップロード後、適切なパーミッションを設定：

```bash
# フォルダのパーミッション
chmod 755 assets/
chmod 755 assets/css/
chmod 755 assets/js/
chmod 755 assets/images/
chmod 755 templates/

# ファイルのパーミッション
chmod 644 assets/css/*.css
chmod 644 assets/js/*.js
chmod 644 assets/images/**/*
chmod 644 templates/*.php
```

## 動作確認

### 1. ブラウザで確認

以下のURLにアクセスして、ファイルが読み込まれているか確認：

```
https://your-domain.com/wp-content/themes/cocoon-child-master/assets/css/style.css
https://your-domain.com/wp-content/themes/cocoon-child-master/assets/js/script.js
```

### 2. 開発者ツールで確認

ブラウザの開発者ツール（F12）で：
- NetworkタブでCSS/JSファイルが読み込まれているか確認
- 404エラーが出ていないか確認

### 3. WordPress管理画面で確認

- サイトが正常に表示されるか確認
- エラーメッセージが出ていないか確認

## トラブルシューティング

### ファイルが見つからないエラー

1. **パスを確認**
   ```php
   // functions.php で確認
   echo get_stylesheet_directory_uri() . '/assets/css/style.css';
   ```

2. **ファイルが存在するか確認**
   ```bash
   ls -la /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/css/
   ```

3. **パーミッションを確認**
   ```bash
   ls -l /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/assets/css/style.css
   ```

### 403 Forbidden エラー

- パーミッションを確認（644または755）
- `.htaccess` でアクセスが制限されていないか確認

### 404 Not Found エラー

- ファイルパスが正しいか確認
- ファイル名の大文字小文字を確認
- ファイルが実際に存在するか確認

## 次のステップ

1. ✅ functions.php にコードを追加（完了）
2. ⬜ アセットファイルを配置
3. ⬜ テンプレートファイルを作成
4. ⬜ Elementorでテスト


