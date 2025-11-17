# お問い合わせボタンセクション ショートコード追加

## functions.php に追加するコード

`misesapo_problem_section_shortcode` のショートコード定義の**後**に、以下を追加してください：

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

## 使用方法

ElementorのカスタムHTMLウィジェットで、以下のショートコードを使用：

```
[misesapo_contact_box]
```

## テンプレートファイル

テンプレートファイルは以下に配置：
- `/wp-content/themes/cocoon-child-master/templates/contact-box-section.php`

## 完成したテンプレート

✅ `wordpress-templates/contact-box-section.php` を作成済み


