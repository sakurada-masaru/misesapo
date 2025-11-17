# ヒーローセクション CSS修正ガイド

## 🔍 問題

ヒーローセクションの画像がバラバラに表示されている = CSSが適用されていない

## ✅ 解決方法

### ステップ1: `hero-section.css` ファイルを作成

`public/css/hero-section.css` ファイルを作成しました。このファイルをXserverにアップロードしてください。

**アップロード先:**
```
/lightning-child/assets/css/hero-section.css
```

### ステップ2: `functions.php` を更新

`functions.php` の `misesapo_enqueue_assets` 関数に、`hero-section.css` の読み込みを追加してください。

**追加するコード:**
```php
wp_enqueue_style('misesapo-hero-css', $theme_uri . '/assets/css/hero-section.css', array(), '1.0');
```

**完全なCSS読み込み部分:**
```php
// CSS
wp_enqueue_style('ress-css', 'https://unpkg.com/ress@4.0.0/dist/ress.min.css', array(), '4.0.0');
wp_enqueue_style('google-fonts', 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap', array(), null);
wp_enqueue_style('swiper-css', $theme_uri . '/assets/css/swiper-bundle.min.css', array(), '1.0');
wp_enqueue_style('misesapo-hero-css', $theme_uri . '/assets/css/hero-section.css', array(), '1.0');
wp_enqueue_style('misesapo-style', $theme_uri . '/assets/css/style.css', array(), '1.0');
```

### ステップ3: ファイルをアップロード

1. **`hero-section.css` をアップロード**
   - ローカル: `public/css/hero-section.css`
   - アップロード先: `/lightning-child/assets/css/hero-section.css`

2. **`functions.php` を更新**
   - WordPress管理画面 → **外観** → **テーマファイルエディター**
   - `functions.php` を開く
   - 上記のコードを追加

### ステップ4: 確認

1. ページを再読み込み
2. ブラウザの開発者ツール（F12）で、`hero-section.css` が読み込まれているか確認
3. ヒーローセクションのレイアウトが正しく表示されているか確認

---

## 📝 含まれるCSS

`hero-section.css` には以下のスタイルが含まれています：

- `.fullscreen-image-section` - セクション全体
- `.fullscreen-image-wrapper` - 画像ラッパー
- `.fullscreen-image` - 画像（アニメーション含む）
- `.hero-mask` - マスク画像
- `.hero_scroll_down` - スクロールヒント
- `.cosmetic-header` - 化粧ヘッダー
- `.normal-header` - 通常ヘッダー

---

## 🚨 まだ表示されない場合

1. **ブラウザのキャッシュをクリア**
2. **`functions.php` のバージョン番号を変更**（例：`1.0` → `1.1`）
3. **開発者ツールでエラーがないか確認**


