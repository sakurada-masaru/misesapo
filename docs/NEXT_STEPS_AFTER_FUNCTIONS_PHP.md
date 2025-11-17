# functions.php 追加後の次のステップ

## ✅ 完了したこと
- functions.php にコードを追加
- サイトが正常に表示される

## 次のステップ

### ステップ1: アセットファイルの配置

既存のファイルをWordPressテーマにコピーします。

#### ファイル構成

```
wp-content/themes/cocoon-child/
├── style.css
├── functions.php          ← ✅ 完了
├── assets/                ← ここに配置
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
└── templates/             ← 後で作成
    ├── hero-section.php
    └── problem-section.php
```

#### コピー元とコピー先

現在のプロジェクトからWordPressテーマへ：

```bash
# ローカルで実行する場合の例
# 現在のプロジェクト: /Users/sakuradamasaru/Desktop/misesapo-main/public/
# WordPressテーマ: wp-content/themes/cocoon-child/

# CSSファイル
cp public/css/*.css wp-content/themes/cocoon-child/assets/css/

# JavaScriptファイル
cp public/js/*.js wp-content/themes/cocoon-child/assets/js/

# 画像ファイル
cp -r public/images* wp-content/themes/cocoon-child/assets/
```

#### FTP/SSHでアップロードする場合

1. **FTPクライアント（FileZilla等）を使用**
   - `public/css/` → `wp-content/themes/cocoon-child/assets/css/`
   - `public/js/` → `wp-content/themes/cocoon-child/assets/js/`
   - `public/images*/` → `wp-content/themes/cocoon-child/assets/`

2. **WordPress管理画面から（制限あり）**
   - メディアライブラリに画像をアップロード
   - CSS/JSは直接アップロードできないため、FTP/SSHを使用

### ステップ2: テンプレートファイルの作成

#### 2-1. templates フォルダを作成

```
wp-content/themes/cocoon-child/templates/
```

#### 2-2. hero-section.php を作成

`wp-content/themes/cocoon-child/templates/hero-section.php` を作成：

```php
<?php
/**
 * ヒーローセクション テンプレート
 */

if (!function_exists('misesapo_image_url')) {
    function misesapo_image_url($path) {
        $path = ltrim($path, '/');
        return get_stylesheet_directory_uri() . '/assets/images/' . $path;
    }
}
?>

<!-- ヒーローセクション -->
<section class="fullscreen-image-section" id="hero">
    <div class="fullscreen-image-wrapper">
        <img src="<?php echo esc_url(misesapo_image_url('images-admin/hero-image001.png')); ?>" 
             alt="ヒーロー画像1" 
             class="hero-img hero-img-1">
        <img src="<?php echo esc_url(misesapo_image_url('images-admin/hero-image002.png')); ?>" 
             alt="ヒーロー画像2" 
             class="hero-img hero-img-2">
        <img src="<?php echo esc_url(misesapo_image_url('images-admin/hero-image003.png')); ?>" 
             alt="ヒーロー画像3" 
             class="hero-img hero-img-3">
    </div>
    
    <!-- マスク画像 -->
    <div class="hero-mask">
        <img src="<?php echo esc_url(misesapo_image_url('images-admin/mask-hero001.png')); ?>" 
             alt="マスク" 
             class="hero-mask-image">
    </div>
    
    <!-- スクロールヒント -->
    <div class="hero-scroll-hint">
        <p>↑ SCROLL ↓</p>
    </div>
</section>

<script>
// ヒーローセクションの高さ調整
(function() {
    function setHeroSectionHeight() {
        const maskImage = document.querySelector('.hero-mask-image');
        const heroSection = document.querySelector('.fullscreen-image-section');
        const imageWrapper = document.querySelector('.fullscreen-image-wrapper');
        
        if (maskImage && heroSection && imageWrapper) {
            const maskHeight = maskImage.offsetHeight;
            heroSection.style.height = (maskHeight - 5) + 'px';
            imageWrapper.style.height = (maskHeight - 5) + 'px';
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setHeroSectionHeight);
    } else {
        setHeroSectionHeight();
    }
    
    window.addEventListener('resize', setHeroSectionHeight);
})();
</script>
```

#### 2-3. problem-section.php を作成

`wp-content/themes/cocoon-child/templates/problem-section.php` を作成：

```php
<?php
/**
 * お悩みセクション テンプレート
 */

if (!function_exists('misesapo_image_url')) {
    function misesapo_image_url($path) {
        $path = ltrim($path, '/');
        return get_stylesheet_directory_uri() . '/assets/images/' . $path;
    }
}
?>

<article id="problem" class="problem-bg section-box">
    <div class="wrapper problem-box">
        <h2 class="h2-title problem-h2 border-line fadeUp">こんなお悩みありませんか？</h2>
        <ul class="fadeUp">
            <li>
                <span class="problem-icon"></span>
                清掃作業に負担がかかり、本業に集中できない
            </li>
            <li>
                <span class="problem-icon"></span>
                清掃作業の外注は、シンプルに済ませたい
            </li>
            <li>
                <span class="problem-icon"></span>
                従業員の満足度を、さらに上げていきたい
            </li>
            <li>
                <span class="problem-icon"></span>
                「これもホントはやってほしいんだけど・・・」に答えるサービスがあると便利
            </li>
        </ul>
        <img class="fadeUp" 
             src="<?php echo esc_url(misesapo_image_url('images/problem-illust.png')); ?>" 
             alt="悩んでいる2人の店舗従業員のイラスト">
    </div>
</article>
```

### ステップ3: Elementorでの使用方法

#### 3-1. ショートコードを使用

1. **Elementorでページを編集**
2. **「ショートコード」ウィジェットを追加**
3. **ショートコードを入力**：
   - `[misesapo_hero]` - ヒーローセクション
   - `[misesapo_problem]` - お悩みセクション

#### 3-2. カスタムHTMLウィジェットを使用

1. **Elementorで「HTML」ウィジェットを追加**
2. **既存のHTMLを貼り付け**
3. **画像パスを調整**：
   ```php
   <!-- 変更前 -->
   <img src="/images-admin/hero-image001.png">
   
   <!-- 変更後 -->
   <img src="<?php echo esc_url(misesapo_image_url('images-admin/hero-image001.png')); ?>">
   ```

#### 3-3. テンプレートファイルを直接読み込む

Elementorの「HTML」ウィジェットで：

```php
<?php
include get_stylesheet_directory() . '/templates/hero-section.php';
?>
```

### ステップ4: 動作確認

#### 確認項目

1. **CSSが読み込まれているか**
   - ブラウザの開発者ツール（F12）で確認
   - NetworkタブでCSSファイルが読み込まれているか確認

2. **JavaScriptが動作しているか**
   - コンソールでエラーが出ていないか確認
   - スクロール処理などが動作しているか確認

3. **画像が表示されているか**
   - 画像パスが正しいか確認
   - 画像ファイルが存在するか確認

4. **ショートコードが動作しているか**
   - Elementorで `[misesapo_hero]` を入力
   - プレビューで表示されるか確認

### ステップ5: トラブルシューティング

#### CSSが適用されない場合

1. **ファイルパスを確認**
   ```php
   // functions.php で確認
   echo get_stylesheet_directory_uri() . '/assets/css/style.css';
   ```

2. **ブラウザのキャッシュをクリア**
   - Ctrl+Shift+R（Windows/Linux）
   - Cmd+Shift+R（Mac）

3. **Cocoonのスタイルと競合している場合**
   - `style.css` で `!important` を使用
   - または、より具体的なセレクタを使用

#### JavaScriptが動作しない場合

1. **jQueryが読み込まれているか確認**
   ```javascript
   console.log(typeof jQuery); // "function" と表示されればOK
   ```

2. **エラーを確認**
   - ブラウザのコンソール（F12）でエラーメッセージを確認

3. **読み込み順序を確認**
   - functions.php で `array('jquery')` を指定しているか確認

#### 画像が表示されない場合

1. **ファイルパスを確認**
   ```php
   // 実際のパスを確認
   echo misesapo_image_url('images-admin/hero-image001.png');
   ```

2. **ファイルが存在するか確認**
   - FTP/SSHでファイルが存在するか確認
   - ファイル名の大文字小文字を確認

3. **パーミッションを確認**
   - ファイルの読み取り権限があるか確認

## チェックリスト

- [x] functions.php にコードを追加
- [x] サイトが正常に表示される
- [ ] アセットファイル（CSS/JS/画像）を配置
- [ ] テンプレートファイルを作成
- [ ] Elementorでショートコードをテスト
- [ ] CSSが正しく読み込まれているか確認
- [ ] JavaScriptが動作しているか確認
- [ ] 画像が表示されているか確認

## 次のアクション

1. **アセットファイルを配置**（ステップ1）
2. **テンプレートファイルを作成**（ステップ2）
3. **Elementorでテスト**（ステップ3）

質問があれば、お気軽にお聞きください！

