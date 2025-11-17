# WordPress 完全セットアップガイド

## 📋 全体の流れ

1. WordPressの基本設定
2. 子テーマの有効化
3. functions.php にコードを追加
4. フォルダ構造の作成
5. アセットファイルのアップロード
6. テンプレートファイルのアップロード
7. Elementorでページ作成
8. 動作確認

---

## ステップ1: WordPressの基本設定

### 1-1. WordPress管理画面にログイン
- ブラウザで `https://misesapo.site/wp-admin/` にアクセス
- ユーザー名とパスワードでログイン

### 1-2. 基本設定の確認
- 「設定」→「一般」で、サイトタイトルやURLが正しいか確認

---

## ステップ2: 子テーマの有効化

### 2-1. テーマの確認
1. WordPress管理画面 → 「外観」→「テーマ」
2. 「Cocoon Child」または「cocoon-child-master」が表示されているか確認
3. 表示されていない場合は、子テーマをインストール

### 2-2. 子テーマを有効化
1. 「Cocoon Child」テーマの上にマウスを乗せる
2. 「有効化」をクリック

---

## ステップ3: functions.php にコードを追加

### 3-1. functions.php を開く
1. WordPress管理画面 → 「外観」→「テーマファイルエディター」
2. 右側の「テーマファイル」から「functions.php」を選択
3. または、Xserverのファイルマネージャーで直接編集：
   ```
   /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/functions.php
   ```

### 3-2. コードを追加
`functions.php` の「//以下に子テーマ用の関数を書く」の**下**に、以下のコードをコピー&ペースト：

```php
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
    wp_enqueue_script('misesapo-auth', $theme_uri . '/assets/js/auth.js', array('jquery'), '1.0', true);
}
add_action('wp_enqueue_scripts', 'misesapo_enqueue_assets', 20);

// ============================================
// 画像パス用のヘルパー関数
// ============================================
function misesapo_image_url($path) {
    // 先頭のスラッシュを削除
    $path = ltrim($path, '/');
    
    // WordPressのコンテキスト内で実行されている場合
    if (function_exists('get_stylesheet_directory_uri')) {
        $theme_uri = get_stylesheet_directory_uri();
        // 空でないことを確認し、http://またはhttps://で始まることを確認
        if (!empty($theme_uri) && (strpos($theme_uri, 'http://') === 0 || strpos($theme_uri, 'https://') === 0)) {
            return trailingslashit($theme_uri) . 'assets/images/' . $path;
        }
    }
    
    // フォールバック: home_url()を使用（より確実）
    if (function_exists('home_url')) {
        return home_url('/wp-content/themes/cocoon-child-master/assets/images/' . $path);
    }
    
    // フォールバック: site_url()を使用
    if (function_exists('site_url')) {
        return site_url('/wp-content/themes/cocoon-child-master/assets/images/' . $path);
    }
    
    // 最終フォールバック: プロトコル相対URL
    if (isset($_SERVER['HTTP_HOST'])) {
        return '//' . $_SERVER['HTTP_HOST'] . '/wp-content/themes/cocoon-child-master/assets/images/' . $path;
    }
    
    // 最後の手段: 相対パス（非推奨）
    return '/wp-content/themes/cocoon-child-master/assets/images/' . $path;
}

// ============================================
// ショートコード: ヒーローセクション
// ============================================
function misesapo_hero_section_shortcode($atts) {
    ob_start();
    $template_path = get_stylesheet_directory() . '/templates/hero-section.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    } else {
        echo '<!-- テンプレートファイルが見つかりません: ' . $template_path . ' -->';
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
// ショートコード: お問い合わせボタンセクション
// ============================================
function misesapo_contact_box_section_shortcode($atts) {
    ob_start();
    $template_path = get_stylesheet_directory() . '/templates/contact-box-section.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    } else {
        echo '<!-- テンプレートファイルが見つかりません: ' . $template_path . ' -->';
    }
    
    return ob_get_clean();
}
add_shortcode('misesapo_contact_box', 'misesapo_contact_box_section_shortcode');

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

### 3-3. 保存
- 「ファイルを更新」をクリック
- エラーが出ないか確認

---

## ステップ4: フォルダ構造の作成

### 4-1. Xserverのファイルマネージャーにログイン
1. Xserverのサーバーパネルにログイン
2. 「ファイルマネージャー」を開く

### 4-2. フォルダを作成
以下のパスに移動：
```
/misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/
```

以下のフォルダを作成（「新規作成」→「フォルダを作成」）：
1. `assets` フォルダ
2. `assets/css` フォルダ
3. `assets/js` フォルダ
4. `assets/images` フォルダ
5. `assets/images/images-admin` フォルダ
6. `assets/images/images-service` フォルダ
7. `assets/images/images-material` フォルダ
8. `templates` フォルダ

---

## ステップ5: アセットファイルのアップロード

### 5-1. CSSファイルのアップロード
**アップロード元（ローカル）:**
- `public/css/style.css`
- `public/css/swiper-bundle.min.css`

**アップロード先:**
- `/wp-content/themes/cocoon-child-master/assets/css/style.css`
- `/wp-content/themes/cocoon-child-master/assets/css/swiper-bundle.min.css`

### 5-2. JavaScriptファイルのアップロード
**アップロード元（ローカル）:**
- `public/js/script.js`
- `public/js/navigation.js`
- `public/js/auth.js`
- `public/js/swiper-bundle.min.js`

**アップロード先:**
- `/wp-content/themes/cocoon-child-master/assets/js/script.js`
- `/wp-content/themes/cocoon-child-master/assets/js/navigation.js`
- `/wp-content/themes/cocoon-child-master/assets/js/auth.js`
- `/wp-content/themes/cocoon-child-master/assets/js/swiper-bundle.min.js`

### 5-3. 画像ファイルのアップロード
**アップロード元（ローカル）:**
- `public/images-admin/` フォルダ内の全ファイル
- `public/images-service/` フォルダ内の全ファイル
- `public/images-material/` フォルダ内の全ファイル

**アップロード先:**
- `/wp-content/themes/cocoon-child-master/assets/images/images-admin/`
- `/wp-content/themes/cocoon-child-master/assets/images/images-service/`
- `/wp-content/themes/cocoon-child-master/assets/images/images-material/`

**方法:**
1. 各フォルダを開く
2. 「アップロード」ボタンをクリック
3. ファイルを選択してアップロード
4. パーミッションを `644` に設定（画像ファイル）

---

## ステップ6: テンプレートファイルのアップロード

### 6-1. テンプレートファイルをアップロード
**アップロード元（ローカル）:**
- `wordpress-templates/hero-section.php`
- `wordpress-templates/problem-section.php`
- `wordpress-templates/contact-box-section.php`

**アップロード先:**
- `/wp-content/themes/cocoon-child-master/templates/hero-section.php`
- `/wp-content/themes/cocoon-child-master/templates/problem-section.php`
- `/wp-content/themes/cocoon-child-master/templates/contact-box-section.php`

---

## ステップ7: Elementorでページを作成

### 7-1. Elementorのインストール（未インストールの場合）
1. WordPress管理画面 → 「プラグイン」→「新規追加」
2. 「Elementor」を検索
3. 「今すぐインストール」→「有効化」

### 7-2. 固定ページを作成
1. WordPress管理画面 → 「固定ページ」→「新規追加」
2. タイトルを入力（例：「トップページ」）
3. 「Elementorで編集」をクリック

### 7-3. ショートコードを追加
1. 左側のウィジェットパネルから「HTML」または「Code」ウィジェットをドラッグ&ドロップ
2. ウィジェット内に以下のショートコードを入力：

```
[misesapo_hero]
```

3. 同様に、もう2つのHTMLウィジェットを追加：

```
[misesapo_contact_box]
```

```
[misesapo_problem]
```

### 7-4. ページを公開
1. 「公開」ボタンをクリック
2. フロントエンドで表示確認

---

## ステップ8: 動作確認

### 8-1. 表示確認
1. 作成したページを表示
2. 以下を確認：
   - ✅ ヒーローセクションが表示される
   - ✅ 画像が正しく表示される
   - ✅ ボタンが正しく表示される
   - ✅ CSSが適用されている

### 8-2. エラーの確認
- ブラウザの開発者ツール（F12）でエラーがないか確認
- WordPressのエラーログを確認

---

## 🔍 トラブルシューティング

### 画像が表示されない
- 画像ファイルが正しい場所にアップロードされているか確認
- パーミッションが `644` になっているか確認
- ブラウザで直接URLにアクセスして確認

### CSSが適用されない
- `functions.php` のコードが正しく追加されているか確認
- CSSファイルが正しい場所にアップロードされているか確認
- ブラウザのキャッシュをクリア

### ショートコードが動作しない
- `functions.php` にショートコードが正しく追加されているか確認
- テンプレートファイルが正しい場所にアップロードされているか確認
- ファイル名が正しいか確認

---

## 📝 チェックリスト

- [ ] WordPressにログイン
- [ ] 子テーマを有効化
- [ ] `functions.php` にコードを追加
- [ ] フォルダ構造を作成
- [ ] CSSファイルをアップロード
- [ ] JavaScriptファイルをアップロード
- [ ] 画像ファイルをアップロード
- [ ] テンプレートファイルをアップロード
- [ ] Elementorでページを作成
- [ ] ショートコードを追加
- [ ] 動作確認

---

## 次のステップ

動作確認が完了したら：
1. 残りのセクションのテンプレート化
2. 求人関連ページのテンプレート化
3. その他のページの移行


