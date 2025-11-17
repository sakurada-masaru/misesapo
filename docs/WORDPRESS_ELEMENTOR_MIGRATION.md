# WordPress + Elementor 移行ガイド

## 概要
現在の静的HTMLサイトをWordPress + Elementorに移行する際、既存のコード資産を最大限活用する方法をまとめます。

## 移行戦略の選択肢

### 方法1: ハイブリッド移行（推奨）
**既存のHTML/CSS/JSをそのままElementorで埋め込む方法**

#### メリット
- 既存のコードを完全に保持できる
- 段階的な移行が可能
- 複雑なカスタム機能をそのまま使用可能

#### 実装手順

##### 1. WordPressテーマの準備
```php
// functions.php に追加
function misesapo_enqueue_assets() {
    // 既存のCSSを読み込み
    wp_enqueue_style('misesapo-style', get_template_directory_uri() . '/assets/css/style.css');
    wp_enqueue_style('swiper-css', get_template_directory_uri() . '/assets/css/swiper-bundle.min.css');
    
    // 既存のJSを読み込み
    wp_enqueue_script('swiper-js', get_template_directory_uri() . '/assets/js/swiper-bundle.min.js', array(), '1.0', true);
    wp_enqueue_script('misesapo-script', get_template_directory_uri() . '/assets/js/script.js', array('jquery'), '1.0', true);
    wp_enqueue_script('misesapo-navigation', get_template_directory_uri() . '/assets/js/navigation.js', array('jquery'), '1.0', true);
}
add_action('wp_enqueue_scripts', 'misesapo_enqueue_assets');
```

##### 2. Elementorでの実装方法

**A. カスタムHTMLウィジェットを使用**
- Elementorの「HTML」ウィジェットまたは「Code」ウィジェットを使用
- 既存のHTMLをそのまま貼り付け
- インラインCSSも含めて貼り付け可能

**B. ショートコード化**
```php
// functions.php に追加
function misesapo_hero_section() {
    ob_start();
    include get_template_directory() . '/templates/hero-section.php';
    return ob_get_clean();
}
add_shortcode('misesapo_hero', 'misesapo_hero_section');
```
Elementorで `[misesapo_hero]` ショートコードを使用

**C. Elementorウィジェットとして登録**
```php
// カスタムElementorウィジェットを作成
class Misesapo_Hero_Widget extends \Elementor\Widget_Base {
    public function get_name() {
        return 'misesapo_hero';
    }
    
    public function get_title() {
        return 'Misesapo Hero Section';
    }
    
    protected function render() {
        include get_template_directory() . '/templates/hero-section.php';
    }
}
```

##### 3. アセットファイルの配置
```
wp-content/themes/your-theme/
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   └── swiper-bundle.min.css
│   ├── js/
│   │   ├── script.js
│   │   ├── navigation.js
│   │   └── swiper-bundle.min.js
│   └── images/
│       ├── images-admin/
│       ├── images-service/
│       └── ...
└── templates/
    ├── hero-section.php
    ├── problem-section.php
    └── ...
```

##### 4. パスの調整
既存のHTML内のパスをWordPress用に調整：
- `/images/` → `<?php echo get_template_directory_uri(); ?>/assets/images/`
- または、WordPressのメディアライブラリにアップロードしてURLを取得

### 方法2: 段階的再構築
**Elementorで再構築しつつ、既存コードを参考にする方法**

#### メリット
- Elementorの機能を最大限活用
- 将来的なメンテナンスが容易
- レスポンシブ対応が簡単

#### 実装手順

##### 1. 既存CSSの分析と再利用
- 既存のCSS変数やユーティリティクラスを抽出
- Elementorのグローバルカラー/フォント設定に反映
- カスタムCSSとして追加

##### 2. カスタムCSSの追加
Elementorの設定 > カスタムCSS または テーマの `style.css` に追加：
```css
/* 既存のスタイルをそのまま貼り付け */
.cosmetic-header { ... }
.hero-section { ... }
/* など */
```

##### 3. カスタムJavaScriptの統合
```php
// functions.php
function misesapo_custom_scripts() {
    wp_add_inline_script('elementor-frontend', '
        // 既存のJavaScriptコードをここに追加
        // または外部ファイルとして読み込み
    ');
}
add_action('wp_enqueue_scripts', 'misesapo_custom_scripts');
```

### 方法3: 完全なHTMLインポート
**既存のHTMLをElementorテンプレートとしてインポート**

#### 手順
1. 既存のHTMLをElementorの「テンプレート」として保存
2. Elementorの「テンプレートライブラリ」からインポート
3. 必要に応じて編集

## 具体的な移行手順（推奨：方法1）

### ステップ1: WordPress環境のセットアップ
1. WordPressをインストール
2. Elementor（無料版またはPro版）をインストール
3. 子テーマを作成（推奨）

### ステップ2: アセットの移行
```bash
# 既存のファイルをWordPressテーマにコピー
cp -r public/css wp-content/themes/your-theme/assets/
cp -r public/js wp-content/themes/your-theme/assets/
cp -r public/images* wp-content/themes/your-theme/assets/
```

### ステップ3: ページごとの移行

#### index.html（トップページ）の移行例

**A. ヘッダー部分**
- Elementorの「Header」テンプレートとして作成
- 既存のHTMLをカスタムHTMLウィジェットに貼り付け
- CSSはテーマの `style.css` に追加

**B. ヒーローセクション**
- Elementorの「Section」を作成
- カスタムHTMLウィジェットで既存のHTMLを貼り付け
- JavaScriptは `functions.php` で読み込み

**C. 各セクション**
- 「こんなお悩みありませんか？」セクション
- 「ミセサポとは」セクション
- など、各セクションを個別に移行

### ステップ4: JavaScriptの統合

#### 既存のJavaScriptをWordPress用に調整

```javascript
// 既存のコードをWordPress用にラップ
(function($) {
    'use strict';
    
    $(document).ready(function() {
        // 既存のJavaScriptコードをここに配置
        // jQueryは既にWordPressに含まれている
    });
    
    // スクロールイベントなど
    $(window).on('scroll', function() {
        // 既存のスクロール処理
    });
    
})(jQuery);
```

### ステップ5: パスの調整

#### 画像パスの調整方法

**方法A: ショートコードを使用**
```php
function misesapo_image_url($path) {
    return get_template_directory_uri() . '/assets' . $path;
}
```

**方法B: 検索置換**
既存のHTML内の `/images/` を `<?php echo get_template_directory_uri(); ?>/assets/images/` に置換

**方法C: WordPressメディアライブラリに移行**
- 画像をWordPressのメディアライブラリにアップロード
- Elementorの画像ウィジェットを使用

## 注意点とベストプラクティス

### 1. パフォーマンス
- 既存のCSS/JSを最小化・圧縮
- 不要なコードを削除
- 画像の最適化（WebP対応など）

### 2. レスポンシブ対応
- Elementorのレスポンシブモードを活用
- 既存のメディアクエリを確認・調整

### 3. SEO
- WordPressのSEOプラグイン（Yoast SEO等）を活用
- メタタグの設定
- 構造化データの追加

### 4. セキュリティ
- WordPressのセキュリティプラグインを導入
- 不要なファイルへのアクセスを制限

### 5. バックアップ
- 移行前に既存サイトの完全バックアップを取得
- 段階的に移行し、各段階でテスト

## 推奨プラグイン

1. **Elementor** - ページビルダー
2. **Elementor Pro** - 高度な機能（条件付き表示など）
3. **Yoast SEO** - SEO最適化
4. **WP Rocket** - キャッシュ・パフォーマンス
5. **Wordfence** - セキュリティ
6. **UpdraftPlus** - バックアップ

## 移行チェックリスト

- [ ] WordPress環境のセットアップ
- [ ] Elementorのインストール
- [ ] 子テーマの作成
- [ ] アセットファイルの移行
- [ ] 既存CSSの統合
- [ ] 既存JavaScriptの統合
- [ ] 画像パスの調整
- [ ] 各ページの移行
- [ ] レスポンシブ対応の確認
- [ ] パフォーマンステスト
- [ ] SEO設定
- [ ] セキュリティ設定
- [ ] バックアップ設定

## トラブルシューティング

### よくある問題

1. **CSSが適用されない**
   - Elementorの「高度な設定」でカスタムCSSクラスを追加
   - `!important` を使用（一時的な解決策）

2. **JavaScriptが動作しない**
   - jQueryの読み込み順序を確認
   - `DOMContentLoaded` イベントを使用

3. **画像が表示されない**
   - パスの確認
   - WordPressのメディアライブラリにアップロード

4. **パフォーマンスが低下**
   - キャッシュプラグインの導入
   - 画像の最適化
   - 不要なプラグインの削除

## 次のステップ

1. テスト環境で移行を実施
2. 本番環境への移行計画を立てる
3. 段階的にページを移行
4. 既存サイトと並行運用（必要に応じて）

## 参考リソース

- [Elementor公式ドキュメント](https://elementor.com/help/)
- [WordPress Codex](https://codex.wordpress.org/)
- [Elementorカスタムウィジェット開発](https://developers.elementor.com/docs/widgets/)


