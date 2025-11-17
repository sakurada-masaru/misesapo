# スクロールヒントアニメーション修正

## 🔍 問題

スクロールヒントのアニメーションが正しく動作していない

## ✅ 修正内容

`hero-section.css` のスクロールヒントアニメーションを修正しました。

### 変更点

1. `.hero_scroll_down p` に `position: relative` と `transform: translateY(0)` を追加
2. `@keyframes scroll-down` で `transform: translateY()` を使用（`margin-top` から変更）

これにより、親要素の `transform` との競合を避け、アニメーションが正しく動作するようになります。

---

## 📝 更新手順

### ステップ1: 修正した `hero-section.css` をアップロード

1. ローカルファイル: `public/css/hero-section.css`（修正済み）
2. アップロード先: `/lightning-child/assets/css/hero-section.css`
3. 既存ファイルを上書き

### ステップ2: 確認

1. ページを再読み込み
2. ブラウザのキャッシュをクリア（Ctrl+Shift+R または Cmd+Shift+R）
3. スクロールヒントのアニメーションが正しく動作しているか確認

---

## 🎯 期待される動作

- テキスト（「↑  SCROLL  ↓」）が上下にアニメーション
- 円（`.scroll-circle`）が線に沿って上下にアニメーション
- アニメーションがスムーズに繰り返される

---

## 🚨 まだ動作しない場合

1. **ブラウザのキャッシュを完全にクリア**
2. **`functions.php` で `hero-section.css` のバージョン番号を変更**（例：`1.0` → `1.1`）
3. **開発者ツールでエラーがないか確認**


