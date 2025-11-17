# WordPress セットアップ チェックリスト

## ✅ 準備済みテンプレート

1. ✅ `hero-section.php` - ヒーローセクション
2. ✅ `problem-section.php` - 「こんなお悩みありませんか？」セクション
3. ✅ `contact-box-section.php` - 「まずは無料で相談してみませんか？」セクション

## 📋 セットアップ手順

### ステップ1: functions.php にショートコードを追加

Xserverの `functions.php` に、以下のショートコードを追加してください：

```php
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
```

**追加位置**: `misesapo_problem_section_shortcode` のショートコード定義の**後**

### ステップ2: テンプレートファイルをアップロード

以下の3つのテンプレートファイルをアップロード：

1. `wordpress-templates/hero-section.php`
   → `/wp-content/themes/cocoon-child-master/templates/hero-section.php`

2. `wordpress-templates/problem-section.php`
   → `/wp-content/themes/cocoon-child-master/templates/problem-section.php`

3. `wordpress-templates/contact-box-section.php`
   → `/wp-content/themes/cocoon-child-master/templates/contact-box-section.php`

### ステップ3: アセットファイルの確認

以下のファイルがアップロードされているか確認：

- ✅ CSS: `assets/css/style.css`
- ✅ JavaScript: `assets/js/script.js`, `navigation.js`, `auth.js`
- ✅ 画像: `assets/images/images-admin/`, `images-service/`, `images-material/`

### ステップ4: Elementorでページを作成

1. WordPress管理画面 → 「固定ページ」→ 「新規追加」
2. Elementorで編集
3. カスタムHTMLウィジェットを追加
4. 以下のショートコードを順番に追加：

```
[misesapo_hero]
[misesapo_contact_box]
[misesapo_problem]
```

### ステップ5: 動作確認

1. ページを公開
2. フロントエンドで表示確認
3. 各セクションが正しく表示されるか確認
4. 画像が正しく表示されるか確認
5. ボタンが正しく動作するか確認

## 🔍 トラブルシューティング

### 画像が表示されない場合
- 画像ファイルが正しい場所にアップロードされているか確認
- パーミッションが `644` になっているか確認
- `functions.php` の `misesapo_image_url` 関数が正しく動作しているか確認

### ショートコードが動作しない場合
- `functions.php` にショートコードが正しく追加されているか確認
- テンプレートファイルが正しい場所にアップロードされているか確認
- WordPressのエラーログを確認

### CSSが適用されない場合
- `functions.php` の `misesapo_enqueue_assets` 関数が正しく動作しているか確認
- CSSファイルが正しい場所にアップロードされているか確認
- ブラウザのキャッシュをクリア

## 📝 次のステップ

動作確認が完了したら：
1. 残りのセクションのテンプレート化
2. 求人関連ページのテンプレート化
3. その他のページの移行


