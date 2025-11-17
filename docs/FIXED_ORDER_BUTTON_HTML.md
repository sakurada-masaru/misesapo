# 固定発注ボタン HTMLコード（Elementor直接貼り付け用）

## 📋 概要

ElementorのHTMLウィジェットに直接貼り付けられる完全なHTMLコードです。CSSも含まれているので、そのまま貼り付けるだけで動作します。

## 🚀 使用方法

### ステップ1: ElementorでHTMLコードを貼り付け

1. Elementorでページを編集
2. **ウィジェット** → **HTML** をドラッグ&ドロップ
3. 以下のHTMLコードを貼り付け
4. **更新** をクリック

## 📝 完全なHTMLコード（CSS込み）

**⚠️ 重要: 以下のコードブロック内のHTMLコードのみをコピーしてください。説明文はコピーしないでください。**

```html
<style>
/* 固定発注ボタン CSS */
.fixed-order-button {
    position: fixed;
    bottom: 50px;
    right: 50px;
    width: 150px;
    height: 150px;
    z-index: 10000;
    cursor: pointer;
    transition: transform 0.3s ease;
}

.fixed-order-button:hover {
    transform: scale(1.1);
}

.fixed-order-button-link {
    display: block;
    width: 100%;
    height: 100%;
    text-decoration: none;
    position: relative;
}

.fixed-order-button__circle {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #FF008C;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    box-shadow: 0 4px 12px rgba(255, 0, 140, 0.4);
    z-index: 2;
}

.fixed-order-button__circle::before {
    content: '';
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    bottom: 8px;
    border: 3px solid #fff;
    border-radius: 50%;
    pointer-events: none;
}

.fixed-order-button__text {
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    text-align: center;
    line-height: 1.3;
    z-index: 3;
    position: relative;
}

.fixed-order-button__rotating-text {
    position: absolute;
    width: 190px;
    height: 190px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: rotate-text 20s infinite linear;
    z-index: 1;
    pointer-events: none;
}

.fixed-order-button__rotating-text svg {
    width: 100%;
    height: 100%;
}

.fixed-order-button__rotating-text text {
    fill: #FF008C;
    font-size: 12px;
    font-weight: 600;
    font-family: Arial, sans-serif;
}

@keyframes rotate-text {
    0% {
        transform: translate(-50%, -50%) rotate(0deg);
    }
    100% {
        transform: translate(-50%, -50%) rotate(360deg);
    }
}

@media screen and (max-width: 768px) {
    .fixed-order-button {
        width: 120px;
        height: 120px;
        bottom: 30px;
        right: 30px;
    }

    .fixed-order-button__rotating-text {
        width: 150px;
        height: 150px;
    }

    .fixed-order-button__text {
        font-size: 12px;
    }

    .fixed-order-button__rotating-text text {
        font-size: 10px;
    }
}

@media screen and (min-width: 769px) and (max-width: 1024px) {
    .fixed-order-button {
        width: 135px;
        height: 135px;
        bottom: 40px;
        right: 40px;
    }

    .fixed-order-button__rotating-text {
        width: 170px;
        height: 170px;
    }
}
</style>

<!-- 固定発注ボタン -->
<div class="fixed-order-button">
    <a href="/service" class="fixed-order-button-link">
        <!-- 円形回転テキスト -->
        <div class="fixed-order-button__rotating-text">
            <svg viewBox="0 0 190 190">
                <defs>
                    <path id="circle-path-order" d="M 95, 95 m -85, 0 a 85,85 0 1,1 170,0 a 85,85 0 1,1 -170,0" />
                </defs>
                <text>
                    <textPath href="#circle-path-order" startOffset="0%">
                        Welcome to Misesapo! To place an order, click here. For any questions, please contact us!
                    </textPath>
                </text>
            </svg>
        </div>
        
        <!-- 円形ボタン -->
        <div class="fixed-order-button__circle">
            <div class="fixed-order-button__text">
                発注は<br>こちらから
            </div>
        </div>
    </a>
</div>
```

## 🔧 カスタマイズ方法

### リンク先を変更

`href="/service"` の部分を変更：

```html
<a href="/cart" class="fixed-order-button-link">
```

### ボタンテキストを変更

`発注は<br>こちらから` の部分を変更：

```html
<div class="fixed-order-button__text">
    お問い合わせ
</div>
```

### 回転テキストを変更

`Welcome to Misesapo!...` の部分を変更：

```html
<textPath href="#circle-path-order" startOffset="0%">
    ミセサポへようこそ！発注はこちらから。
</textPath>
```

### 位置を変更

`.fixed-order-button` の `bottom` と `right` を変更：

```html
.fixed-order-button {
    bottom: 30px;  /* 変更 */
    right: 30px;   /* 変更 */
    ...
}
```

## ⚠️ 重要な注意事項

### 1. SVGのIDは一意にする

複数のボタンを同じページに配置する場合、SVGの`id`を変更してください：

```html
<!-- 1つ目のボタン -->
<path id="circle-path-1" ... />
<textPath href="#circle-path-1" ... />

<!-- 2つ目のボタン -->
<path id="circle-path-2" ... />
<textPath href="#circle-path-2" ... />
```

### 2. リンク先のURL

WordPressの固定ページや投稿へのリンクの場合：

```html
<!-- 固定ページの場合 -->
<a href="/page-slug" class="fixed-order-button-link">

<!-- 投稿の場合 -->
<a href="/post-slug" class="fixed-order-button-link">

<!-- 外部リンクの場合 -->
<a href="https://example.com" class="fixed-order-button-link" target="_blank">
```

### 3. 複数のボタンを配置する場合

同じページに複数のボタンを配置する場合は、各ボタンのSVGの`id`を変更してください。

## 📝 使用例

### 例1: カートページへのリンク

```html
<!-- 上記のHTMLコードの <a href="/service" ...> を以下に変更 -->
<a href="/cart" class="fixed-order-button-link">
```

### 例2: お問い合わせページへのリンク

```html
<!-- リンク先とテキストを変更 -->
<a href="/contact" class="fixed-order-button-link">
    ...
    <div class="fixed-order-button__text">
        お問い合わせ
    </div>
    ...
</a>
```

## 🎯 メリット

- ✅ **簡単**: HTMLコードをコピー&ペーストするだけ
- ✅ **独立**: functions.phpの編集が不要
- ✅ **柔軟**: 各ページで異なる設定が可能
- ✅ **完全**: CSSも含まれているので、そのまま動作

## 📚 関連ドキュメント

- `FIXED_ORDER_BUTTON_SETUP.md` - ショートコード版のセットアップガイド
- `LIGHTNING_CHILD_FUNCTIONS_PHP.md` - functions.phpの設定
