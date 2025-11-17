# functions.php への具体的な追加手順

## 現在の状態
- functions.php を開いている
- 何を追加すればいいかわからない

## ステップバイステップ手順

### ステップ1: 最小限のコードから始める

functions.php が空の場合、または基本的なコードしかない場合、以下をコピー&ペーストしてください：

```php
<?php
/**
 * Cocoon Child Theme functions.php
 */

// セキュリティ: 直接アクセスを防ぐ
if (!defined('ABSPATH')) {
    exit;
}

// ============================================
// 親テーマのスタイルを読み込む
// ============================================
function cocoon_child_enqueue_styles() {
    // 親テーマのスタイル
    wp_enqueue_style('parent-style', get_template_directory_uri() . '/style.css');
    
    // 子テーマのスタイル
    wp_enqueue_style('child-style', 
        get_stylesheet_directory_uri() . '/style.css',
        array('parent-style'),
        wp_get_theme()->get('Version')
    );
}
add_action('wp_enqueue_scripts', 'cocoon_child_enqueue_styles');
```

**これを保存して、サイトが正常に表示されるか確認してください。**

---

### ステップ2: MisesapoのCSS/JSを読み込む

ステップ1が成功したら、以下のコードを追加します：

```php
// ============================================
// Misesapo アセットファイルの読み込み
// ============================================
function misesapo_enqueue_assets() {
    $theme_uri = get_stylesheet_directory_uri(); // 子テーマのURI
    
    // CSS
    wp_enqueue_style('ress-css', 'https://unpkg.com/ress@4.0.0/dist/ress.min.css', array(), '4.0.0');
    wp_enqueue_style('google-fonts', 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap', array(), null);
    wp_enqueue_style('swiper-css', $theme_uri . '/assets/css/swiper-bundle.min.css', array(), '1.0');
    wp_enqueue_style('misesapo-style', $theme_uri . '/assets/css/style.css', array(), '1.0');
    
    // JavaScript
    wp_enqueue_script('swiper-js', $theme_uri . '/assets/js/swiper-bundle.min.js', array(), '1.0', true);
    wp_enqueue_script('misesapo-script', $theme_uri . '/assets/js/script.js', array('jquery'), '1.0', true);
    wp_enqueue_script('misesapo-navigation', $theme_uri . '/assets/js/navigation.js', array('jquery'), '1.0', true);
}
add_action('wp_enqueue_scripts', 'misesapo_enqueue_assets', 20);
```

**注意**: この時点で、まだファイルが存在しない場合はエラーになります。まずはファイルを配置してから追加してください。

---

### ステップ3: 画像パスのヘルパー関数を追加

```php
// ============================================
// 画像パス用のヘルパー関数
// ============================================
function misesapo_image_url($path) {
    // 先頭のスラッシュを削除
    $path = ltrim($path, '/');
    return get_stylesheet_directory_uri() . '/assets/images/' . $path;
}
```

この関数は、ElementorのカスタムHTMLウィジェットで使用します：
```php
<?php echo misesapo_image_url('images-admin/hero-image001.png'); ?>
```

---

### ステップ4: ショートコードを追加（Elementorで使用）

```php
// ============================================
// ショートコード: ヒーローセクション
// ============================================
function misesapo_hero_section_shortcode($atts) {
    ob_start();
    $template_path = get_stylesheet_directory() . '/templates/hero-section.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    } else {
        echo '<!-- テンプレートファイルが見つかりません -->';
    }
    
    return ob_get_clean();
}
add_shortcode('misesapo_hero', 'misesapo_hero_section_shortcode');
```

Elementorで `[misesapo_hero]` と入力すると、ヒーローセクションが表示されます。

---

## 完全な functions.php の例（コピー&ペースト用）

以下をそのままコピー&ペーストして使用できます：

```php
<?php
/**
 * Cocoon Child Theme functions.php
 * Misesapo カスタム機能
 */

// セキュリティ: 直接アクセスを防ぐ
if (!defined('ABSPATH')) {
    exit;
}

// ============================================
// 親テーマのスタイルを読み込む
// ============================================
function cocoon_child_enqueue_styles() {
    // 親テーマのスタイル
    wp_enqueue_style('parent-style', get_template_directory_uri() . '/style.css');
    
    // 子テーマのスタイル
    wp_enqueue_style('child-style', 
        get_stylesheet_directory_uri() . '/style.css',
        array('parent-style'),
        wp_get_theme()->get('Version')
    );
}
add_action('wp_enqueue_scripts', 'cocoon_child_enqueue_styles');

// ============================================
// Misesapo アセットファイルの読み込み
// ============================================
function misesapo_enqueue_assets() {
    $theme_uri = get_stylesheet_directory_uri();
    
    // CSS
    wp_enqueue_style('ress-css', 'https://unpkg.com/ress@4.0.0/dist/ress.min.css', array(), '4.0.0');
    wp_enqueue_style('google-fonts', 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap', array(), null);
    wp_enqueue_style('swiper-css', $theme_uri . '/assets/css/swiper-bundle.min.css', array(), '1.0');
    wp_enqueue_style('misesapo-style', $theme_uri . '/assets/css/style.css', array(), '1.0');
    
    // JavaScript
    wp_enqueue_script('swiper-js', $theme_uri . '/assets/js/swiper-bundle.min.js', array(), '1.0', true);
    wp_enqueue_script('misesapo-script', $theme_uri . '/assets/js/script.js', array('jquery'), '1.0', true);
    wp_enqueue_script('misesapo-navigation', $theme_uri . '/assets/js/navigation.js', array('jquery'), '1.0', true);
}
add_action('wp_enqueue_scripts', 'misesapo_enqueue_assets', 20);

// ============================================
// 画像パス用のヘルパー関数
// ============================================
function misesapo_image_url($path) {
    $path = ltrim($path, '/');
    return get_stylesheet_directory_uri() . '/assets/images/' . $path;
}

// ============================================
// ショートコード: ヒーローセクション
// ============================================
function misesapo_hero_section_shortcode($atts) {
    ob_start();
    $template_path = get_stylesheet_directory() . '/templates/hero-section.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    }
    
    return ob_get_clean();
}
add_shortcode('misesapo_hero', 'misesapo_hero_section_shortcode');

// ============================================
// ショートコード: お悩みセクション
// ============================================
function misesapo_problem_section_shortcode($atts) {
    ob_start();
    $template_path = get_stylesheet_directory() . '/templates/problem-section.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    }
    
    return ob_get_clean();
}
add_shortcode('misesapo_problem', 'misesapo_problem_section_shortcode');

// ============================================
// インラインJavaScript（ヘッダースクロール処理など）
// ============================================
function misesapo_inline_scripts() {
    ?>
    <script>
    (function($) {
        'use strict';
        
        $(document).ready(function() {
            // ヘッダーのスクロール処理
            const SCROLL_THRESHOLD = 150;
            const cosmeticHeader = $('.cosmetic-header');
            const normalHeader = $('.normal-header');
            let ticking = false;

            if (cosmeticHeader.length && normalHeader.length) {
                function updateHeaderState(scrollY) {
                    if (scrollY > SCROLL_THRESHOLD) {
                        cosmeticHeader.addClass('hidden');
                        normalHeader.removeClass('hidden');
                    } else {
                        cosmeticHeader.removeClass('hidden');
                        normalHeader.addClass('hidden');
                    }
                }

                $(window).on('scroll', function() {
                    if (!ticking) {
                        window.requestAnimationFrame(function() {
                            updateHeaderState($(window).scrollTop());
                            ticking = false;
                        });
                        ticking = true;
                    }
                });
            }
        });
        
    })(jQuery);
    </script>
    <?php
}
add_action('wp_footer', 'misesapo_inline_scripts');
```

---

## 実際の作業手順

### 1. functions.php を開く
- WordPress管理画面: **外観 > テーマファイルエディター > functions.php**
- またはFTP/SSHで直接編集

### 2. 既存のコードを確認
- 既にコードがある場合は、その下に追加
- 空の場合は、上記の完全なコードをコピー&ペースト

### 3. コードを貼り付ける
- 上記の「完全な functions.php の例」をコピー
- functions.php に貼り付け
- **ファイルを更新** をクリック

### 4. エラーチェック
- サイトが正常に表示されるか確認
- エラーが出た場合は、エラーメッセージを確認
- よくあるエラー:
  - **Parse error**: 構文エラー（セミコロンや引用符を確認）
  - **Fatal error**: 関数の重複やファイルが見つからない

### 5. ファイルを配置
以下のフォルダ構成でファイルを配置：

```
wp-content/themes/cocoon-child/
├── style.css
├── functions.php          ← 今編集しているファイル
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   └── swiper-bundle.min.css
│   ├── js/
│   │   ├── script.js
│   │   └── navigation.js
│   └── images/
│       ├── images-admin/
│       └── images-service/
└── templates/
    ├── hero-section.php
    └── problem-section.php
```

---

## トラブルシューティング

### エラーが出た場合

1. **構文エラー（Parse error）**
   - セミコロン（;）が抜けていないか確認
   - 引用符（' や "）が正しく閉じられているか確認
   - 括弧（() や {}）が正しく閉じられているか確認

2. **ファイルが見つからない（Warning: include）**
   - ファイルパスを確認
   - ファイルが実際に存在するか確認
   - パーミッションを確認

3. **サイトが真っ白になった（White Screen of Death）**
   - functions.php の最後の行に `?>` がある場合は削除
   - エラーログを確認: `wp-content/debug.log`
   - バックアップから復元

### 安全にテストする方法

1. **バックアップを取る**
   ```bash
   cp functions.php functions.php.backup
   ```

2. **少しずつ追加**
   - まず最小限のコードだけ追加
   - 動作確認してから次を追加

3. **コメントアウトで無効化**
   ```php
   /*
   function test_function() {
       // コード
   }
   */
   ```

---

## 次のステップ

1. ✅ functions.php にコードを追加
2. ⬜ アセットファイル（CSS/JS/画像）を配置
3. ⬜ テンプレートファイルを作成
4. ⬜ Elementorでショートコードをテスト

---

## よくある質問

**Q: 既存のコードがある場合はどうする？**
A: 既存のコードの下（最後）に追加してください。`?>` がある場合は、その前に追加します。

**Q: エラーが出た場合は？**
A: エラーメッセージを確認し、該当箇所を修正してください。わからない場合は、バックアップから復元して、少しずつ追加し直してください。

**Q: ファイルが存在しないエラーが出る**
A: まずはファイルを配置してから、functions.php にコードを追加してください。または、ファイルが存在しない場合の処理を追加してください。

