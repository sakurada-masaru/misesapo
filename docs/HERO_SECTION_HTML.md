# ヒーローセクション HTMLコード（Elementor直接貼り付け用）

## 📋 概要

ElementorのHTMLウィジェットに直接貼り付けられる完全なHTMLコードです。CSSも含まれているので、そのまま貼り付けるだけで動作します。

## 🚀 使用方法

### ステップ1: ElementorでHTMLコードを貼り付け

1. Elementorでページを編集
2. **ウィジェット** → **HTML** をドラッグ&ドロップ
3. 以下のHTMLコードを貼り付け
4. **更新** をクリック

## 📝 HTMLコード

### アニメーションなし版（推奨）

**⚠️ 重要: 以下のコードブロック内のHTMLコードのみをコピーしてください。**

```html
<style>
/* ヒーローセクション CSS（アニメーションなし版） */
.fullscreen-image-section.no-animation {
    width: 100vw;
    height: auto;
    position: relative;
    overflow: hidden;
    margin-left: calc(50% - 50vw);
    margin-right: calc(50% - 50vw);
    margin-top: 0;
    margin-bottom: 0;
    padding: 0;
    z-index: 1;
}

.fullscreen-image-section.no-animation .fullscreen-image-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

.fullscreen-image-section.no-animation .fullscreen-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
    opacity: 1;
    animation: none;
    transition: none;
    z-index: 1;
}

.fullscreen-image-section.no-animation .fullscreen-image-static {
    opacity: 1;
    transform: scale(1);
    animation: none;
}

.fullscreen-image-section.no-animation .hero-mask {
    position: relative;
    width: 100%;
    max-width: 100%;
    height: auto;
    z-index: 50;
    pointer-events: none;
    margin: 0 auto;
}

.fullscreen-image-section.no-animation .hero-mask-image {
    width: 100%;
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0 auto;
}

.fullscreen-image-section.no-animation .hero_scroll_down {
    display: none;
}
</style>

<!-- ヒーローセクション（アニメーションなし） -->
<section class="fullscreen-image-section no-animation" id="hero">
    <div class="fullscreen-image-wrapper">
        <img src="/wp-content/themes/lightning-child/assets/images/images-admin/hero-image001.png" 
             alt="ヒーロー画像" 
             class="fullscreen-image fullscreen-image-static">
    </div>
    
    <div class="hero-mask">
        <img src="/wp-content/themes/lightning-child/assets/images/images-admin/mask-hero001.png" 
             alt="マスク" 
             class="hero-mask-image">
    </div>
</section>

<script>
(function() {
    function setHeroSectionHeight() {
        const maskImage = document.querySelector('.hero-mask-image');
        const heroSection = document.querySelector('.fullscreen-image-section.no-animation');
        const imageWrapper = document.querySelector('.fullscreen-image-wrapper');
        
        if (maskImage && heroSection && imageWrapper) {
            const maskHeight = maskImage.offsetHeight;
            heroSection.style.height = (maskHeight - 5) + 'px';
            imageWrapper.style.height = maskHeight + 'px';
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setHeroSectionHeight);
    } else {
        setHeroSectionHeight();
    }
    
    window.addEventListener('resize', setHeroSectionHeight);
    
    const maskImage = document.querySelector('.hero-mask-image');
    if (maskImage) {
        if (maskImage.complete) {
            setHeroSectionHeight();
        } else {
            maskImage.addEventListener('load', setHeroSectionHeight);
        }
    }
})();
</script>
```

### アニメーションあり版（3枚の画像がスライドショー）

**⚠️ 重要: 以下のコードブロック内のHTMLコードのみをコピーしてください。**

```html
<style>
/* ヒーローセクション CSS（アニメーションあり版） */
.fullscreen-image-section {
    width: 100vw;
    height: auto;
    position: relative;
    overflow: hidden;
    margin-left: calc(50% - 50vw);
    margin-right: calc(50% - 50vw);
    margin-top: 0;
    margin-bottom: 0;
    padding: 0;
    z-index: 1;
}

.fullscreen-image-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

.fullscreen-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
    opacity: 0;
    animation: fullscreenFade 24s infinite, kenBurnsZoom 24s infinite;
    transition: opacity 2s ease-in-out;
    z-index: 1;
}

.fullscreen-image-1 {
    animation-delay: 0s;
    opacity: 1;
}

.fullscreen-image-2 {
    animation-delay: 8s;
}

.fullscreen-image-3 {
    animation-delay: 16s;
}

@keyframes fullscreenFade {
    0% {
        opacity: 0;
    }
    4% {
        opacity: 1;
    }
    30% {
        opacity: 1;
    }
    34% {
        opacity: 0;
    }
    100% {
        opacity: 0;
    }
}

@keyframes kenBurnsZoom {
    0% {
        transform: scale(1);
    }
    100% {
        transform: scale(1.1);
    }
}

.hero-mask {
    position: relative;
    width: 100%;
    height: auto;
    z-index: 50;
    pointer-events: none;
}

.hero-mask-image {
    width: 100%;
    height: auto;
    display: block;
}

.hero_scroll_down {
    position: fixed !important;
    top: 50% !important;
    left: 0 !important;
    transform: translateY(-50%) !important;
    width: 50px !important;
    z-index: 99999 !important;
    color: #FF008C;
    font-size: 12px;
    letter-spacing: 0.15em;
    writing-mode: vertical-rl;
    text-orientation: upright;
    display: flex !important;
    flex-direction: row !important;
    align-items: center;
    justify-content: center;
    height: auto;
    font-weight: 500;
    gap: 25px;
    margin: 0 !important;
    padding: 0 !important;
}

.scroll-line {
    position: relative;
    width: 1px;
    height: 80px;
    background: rgba(255, 0, 140, 0.5);
    margin: 0;
    margin-top: 2px;
}

.scroll-circle {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 6px;
    height: 6px;
    background: #FF008C;
    border-radius: 50%;
    animation: scroll-circle-move 3s infinite ease-in-out;
}

.hero_scroll_down p {
    margin: 0;
    padding: 0;
    animation: scroll-down 3s infinite ease-in-out;
    line-height: 1.2;
    display: flex;
    align-items: center;
    position: relative;
    transform: translateY(0);
}

@keyframes scroll-down {
    0% {
        opacity: 1;
        transform: translateY(0);
    }
    50% {
        opacity: 0.3;
        transform: translateY(15px);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes scroll-circle-move {
    0% {
        top: 0;
        opacity: 1;
    }
    50% {
        top: calc(100% - 6px);
        opacity: 0.5;
    }
    100% {
        top: 0;
        opacity: 1;
    }
}
</style>

<!-- ヒーローセクション（アニメーションあり） -->
<section class="fullscreen-image-section" id="hero">
    <div class="fullscreen-image-wrapper">
        <img src="/wp-content/themes/lightning-child/assets/images/images-admin/hero-image001.png" 
             alt="ヒーロー画像1" 
             class="fullscreen-image fullscreen-image-1">
        <img src="/wp-content/themes/lightning-child/assets/images/images-admin/hero-image002.png" 
             alt="ヒーロー画像2" 
             class="fullscreen-image fullscreen-image-2">
        <img src="/wp-content/themes/lightning-child/assets/images/images-admin/hero-image003.png" 
             alt="ヒーロー画像3" 
             class="fullscreen-image fullscreen-image-3">
    </div>
    
    <div class="hero-mask">
        <img src="/wp-content/themes/lightning-child/assets/images/images-admin/mask-hero001.png" 
             alt="マスク" 
             class="hero-mask-image">
    </div>
    
    <div class="hero_scroll_down">
        <p>↑  SCROLL  ↓</p>
        <div class="scroll-line">
            <div class="scroll-circle"></div>
        </div>
    </div>
</section>

<script>
(function() {
    function setHeroSectionHeight() {
        const maskImage = document.querySelector('.hero-mask-image');
        const heroSection = document.querySelector('.fullscreen-image-section');
        const imageWrapper = document.querySelector('.fullscreen-image-wrapper');
        
        if (maskImage && heroSection && imageWrapper) {
            const maskHeight = maskImage.offsetHeight;
            heroSection.style.height = (maskHeight - 5) + 'px';
            imageWrapper.style.height = maskHeight + 'px';
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setHeroSectionHeight);
    } else {
        setHeroSectionHeight();
    }
    
    window.addEventListener('resize', setHeroSectionHeight);
    
    const maskImage = document.querySelector('.hero-mask-image');
    if (maskImage) {
        if (maskImage.complete) {
            setHeroSectionHeight();
        } else {
            maskImage.addEventListener('load', setHeroSectionHeight);
        }
    }
})();
</script>
```

## 🔧 カスタマイズ方法

### 画像のパスを変更

画像のパスは、実際のWordPressサイトの構造に合わせて変更してください：

```html
<!-- 現在のパス -->
<img src="/wp-content/themes/lightning-child/assets/images/images-admin/hero-image001.png" 

<!-- 変更例: テーマ名が異なる場合 -->
<img src="/wp-content/themes/your-theme-name/assets/images/images-admin/hero-image001.png" 

<!-- 変更例: 絶対URLを使用 -->
<img src="https://your-site.com/wp-content/themes/lightning-child/assets/images/images-admin/hero-image001.png" 
```

### 表示する画像を変更（アニメーションなし版）

```html
<!-- hero-image001.png を hero-image002.png に変更 -->
<img src="/wp-content/themes/lightning-child/assets/images/images-admin/hero-image002.png" 
```

### スクロールヒントを非表示にする（アニメーションあり版）

アニメーションあり版でスクロールヒントを非表示にする場合、以下の部分を削除：

```html
<!-- この部分を削除 -->
<div class="hero_scroll_down">
    <p>↑  SCROLL  ↓</p>
    <div class="scroll-line">
        <div class="scroll-circle"></div>
    </div>
</div>
```

## ⚠️ 重要な注意事項

### 1. 画像のパス

画像のパスは、実際のWordPressサイトのテーマフォルダ名に合わせて変更してください。

- テーマ名が `lightning-child` の場合: `/wp-content/themes/lightning-child/assets/images/...`
- テーマ名が異なる場合: `/wp-content/themes/your-theme-name/assets/images/...`

### 2. 画像ファイルのアップロード

以下の画像ファイルをアップロードしてください：

- `hero-image001.png`
- `hero-image002.png`（アニメーションあり版のみ）
- `hero-image003.png`（アニメーションあり版のみ）
- `mask-hero001.png`

**アップロード先:**
```
/wp-content/themes/lightning-child/assets/images/images-admin/
```

### 3. 画像が表示されない場合

1. **画像のパスを確認**
   - ブラウザの開発者ツール（F12）で画像のURLを確認
   - 404エラーが出ていないか確認

2. **ファイル名を確認**
   - ファイル名が正確か確認（大文字小文字も含む）

3. **ファイルの権限を確認**
   - ファイルの権限が `644` になっているか確認

## 📝 使用例

### アニメーションなし版を使用

シンプルでパフォーマンスが良いので、通常はこちらを推奨します。

### アニメーションあり版を使用

3枚の画像がスライドショーで切り替わり、スクロールヒントも表示されます。

## 🎯 違い

### アニメーションなし版
- ✅ 最初の画像のみ表示
- ✅ アニメーションなし
- ✅ スクロールヒントなし
- ✅ パフォーマンスが良い

### アニメーションあり版
- ✅ 3枚の画像がスライドショーで切り替わる
- ✅ ケンボーンズ効果（ズームイン）アニメーション
- ✅ スクロールヒントのアニメーション
- ⚠️ パフォーマンスへの影響あり

## 📚 関連ドキュメント

- `HERO_NO_ANIMATION_SETUP.md` - ショートコード版のセットアップガイド
- `FIXED_ORDER_BUTTON_HTML.md` - 固定発注ボタンのHTMLコード

