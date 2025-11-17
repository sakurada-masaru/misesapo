# スクロールヒントアニメーション ショートコード

## 📋 概要

スクロールヒントアニメーションを独立したショートコードとして作成しました。

## ✅ 作成したファイル

### 1. テンプレートファイル

**ファイル名:** `scroll-hint.php`  
**場所:** `wordpress-templates/scroll-hint.php`

### 2. ショートコード

**ショートコード名:** `[misesapo_scroll_hint]`

---

## 📝 使用方法

### Elementorで使用する場合

1. Elementorエディターで、**「HTML」** または **「Code」** ウィジェットを追加
2. ウィジェット内に以下のショートコードを入力：

```
[misesapo_scroll_hint]
```

3. **「更新」** をクリック

---

## 🔧 functions.php への追加

`functions.php` に以下のコードを追加してください：

```php
// ============================================
// ショートコード: スクロールヒントアニメーション
// ============================================
function misesapo_scroll_hint_shortcode($atts) {
    ob_start();
    $template_path = get_stylesheet_directory() . '/templates/scroll-hint.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    } else {
        echo '<!-- テンプレートファイルが見つかりません: ' . $template_path . ' -->';
    }
    
    return ob_get_clean();
}
add_shortcode('misesapo_scroll_hint', 'misesapo_scroll_hint_shortcode');
```

---

## 📤 アップロード手順

### ステップ1: テンプレートファイルをアップロード

1. ローカルファイル: `wordpress-templates/scroll-hint.php`
2. アップロード先: `/lightning-child/templates/scroll-hint.php`

### ステップ2: functions.php を更新

1. WordPress管理画面 → **外観** → **テーマファイルエディター**
2. `functions.php` を開く
3. 上記のコードを追加
4. **「ファイルを更新」** をクリック

---

## 🎯 表示される内容

- 左側に縦書きで「↑  SCROLL  ↓」のテキスト
- テキストが上下にアニメーション
- 線に沿って円が上下にアニメーション

---

## 📝 注意事項

- `hero-section.css` が読み込まれている必要があります（スクロールヒントのCSSが含まれています）
- ヒーローセクションとは独立して使用できます
- 複数の場所に配置することも可能です

---

## 🔍 確認方法

1. ショートコードを追加したページを表示
2. 左側にスクロールヒントが表示されるか確認
3. アニメーションが正しく動作しているか確認


