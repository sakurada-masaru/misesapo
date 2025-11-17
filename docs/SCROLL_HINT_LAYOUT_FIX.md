# スクロールヒントレイアウト修正

## 🔍 問題

スクロールヒントとヒーローセクションが垂直方向に横並びになっている

## ✅ 原因

ElementorやWordPressのテーマのCSSが、スクロールヒントの `position: fixed` を上書きしている可能性があります。

## 🔧 修正内容

`hero-section.css` のスクロールヒントのCSSに `!important` を追加して、他のCSSの影響を受けないようにしました。

### 変更点

- `position: fixed !important;`
- `top: 50% !important;`
- `left: 0 !important;`
- `transform: translateY(-50%) !important;`
- `z-index: 99999 !important;`
- `display: flex !important;`
- `flex-direction: row !important;`
- `margin: 0 !important;`
- `padding: 0 !important;`

---

## 📝 更新手順

### ステップ1: 修正した `hero-section.css` をアップロード

1. ローカルファイル: `public/css/hero-section.css`（修正済み）
2. アップロード先: `/lightning-child/assets/css/hero-section.css`
3. 既存ファイルを上書き

### ステップ2: 確認

1. ページを再読み込み
2. ブラウザのキャッシュをクリア（Ctrl+Shift+R または Cmd+Shift+R）
3. スクロールヒントが画面左側に固定されているか確認

---

## 🎯 期待される動作

- スクロールヒントが画面左側に固定表示される
- ヒーローセクションとは独立して表示される
- スクロールしても位置が変わらない

---

## 🚨 まだ横並びになっている場合

### オプション1: Elementorのレイアウトを確認

Elementorで、スクロールヒントのショートコードが含まれているウィジェットの設定を確認：
- **「高度な設定」** → **「カスタムCSS」** で、以下のCSSを追加：

```css
.hero_scroll_down {
    position: fixed !important;
    left: 0 !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
}
```

### オプション2: ウィジェットの幅を確認

Elementorのウィジェットの幅設定を確認：
- **「レイアウト」** → **「幅」** を **「フル幅」** に設定

### オプション3: ページテンプレートを確認

WordPressのページテンプレートが、Elementorのレイアウトを制限していないか確認

---

## 📝 確認方法

1. ブラウザの開発者ツール（F12）を開く
2. スクロールヒントの要素（`.hero_scroll_down`）を選択
3. **「Computed」** タブで、以下のプロパティが正しく適用されているか確認：
   - `position: fixed`
   - `left: 0`
   - `top: 50%`
   - `transform: translateY(-50%)`


