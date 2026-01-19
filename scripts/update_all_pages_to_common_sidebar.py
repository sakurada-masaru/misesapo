#!/usr/bin/env python3
"""
全管理ページのサイドバーを共通パーシャルに置き換えるスクリプト
"""
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
PAGES_DIR = SRC / "pages" / "admin"

# サイドバーHTMLのパターン（開始）
SIDEBAR_START_PATTERN = re.compile(
    r'<aside\s+class="sidebar"[^>]*>.*?<div\s+class="sidebar-header">',
    re.DOTALL
)

# サイドバーHTMLのパターン（終了）
SIDEBAR_END_PATTERN = re.compile(
    r'</aside>',
    re.DOTALL
)

# サイドバーCSSのパターン
SIDEBAR_CSS_PATTERN = re.compile(
    r'/\*\s*サイドバー\s*\*/.*?\.sidebar-toggle\s+i\s*\{[^}]*\}',
    re.DOTALL
)

# サイドバーJSのパターン（サイドバー関連の関数）
SIDEBAR_JS_PATTERNS = [
    re.compile(r'//\s*サイドバー開閉機能.*?localStorage\.setItem\([\'"]sidebar-collapsed[\'"]', re.DOTALL),
    re.compile(r'function\s+updateRoleBadge\(\)\s*\{.*?\}', re.DOTALL),
    re.compile(r'function\s+setupMypageLink\(\)\s*\{.*?\}', re.DOTALL),
    re.compile(r'const\s+sidebar\s*=.*?sidebarToggle\.addEventListener', re.DOTALL),
]

def replace_sidebar_html(content):
    """サイドバーHTMLを@includeに置き換え"""
    # <aside class="sidebar" から </aside> までを検索
    pattern = re.compile(
        r'<aside\s+class="sidebar"[^>]*>.*?</aside>',
        re.DOTALL
    )
    
    if pattern.search(content):
        # メインコンテンツの前に@includeを挿入
        main_pattern = re.compile(r'(<main[^>]*>)\s*')
        replacement = r'\1\n  @include(\'partials.admin-sidebar\')\n'
        content = main_pattern.sub(replacement, content, count=1)
        
        # 既存のサイドバーHTMLを削除
        content = pattern.sub('', content)
    
    return content

def remove_sidebar_css(content):
    """サイドバー関連のCSSを削除"""
    # サイドバーCSSブロックを削除
    patterns = [
        re.compile(r'/\*\s*サイドバー\s*\*/.*?\.sidebar-toggle\s+i\s*\{[^}]*\}', re.DOTALL),
        re.compile(r'\.sidebar\s*\{[^}]*\}', re.DOTALL),
        re.compile(r'\.sidebar-header\s*\{[^}]*\}', re.DOTALL),
        re.compile(r'\.sidebar-role\s*\{[^}]*\}', re.DOTALL),
        re.compile(r'\.sidebar-nav\s*\{[^}]*\}', re.DOTALL),
        re.compile(r'\.nav-item[^{]*\{[^}]*\}', re.DOTALL),
        re.compile(r'\.sidebar-toggle[^{]*\{[^}]*\}', re.DOTALL),
    ]
    
    for pattern in patterns:
        content = pattern.sub('', content)
    
    # main-contentのmargin-left関連を削除（共通CSSで処理）
    content = re.sub(
        r'\.main-content\s*\{[^}]*margin-left[^}]*\}',
        '.main-content {\n      padding: 24px;\n      background: #f9fafb;\n    }',
        content,
        flags=re.DOTALL
    )
    
    return content

def remove_sidebar_js(content):
    """サイドバー関連のJavaScriptを削除"""
    for pattern in SIDEBAR_JS_PATTERNS:
        content = pattern.sub('', content)
    
    # 個別の関数呼び出しも削除
    content = re.sub(r'updateRoleBadge\(\);', '', content)
    content = re.sub(r'setupMypageLink\(\);', '', content)
    
    return content

def process_file(file_path):
    """ファイルを処理"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # サイドバーHTMLを置き換え
        if '<aside class="sidebar"' in content:
            content = replace_sidebar_html(content)
        
        # サイドバーCSSを削除
        if '/* サイドバー */' in content or '.sidebar {' in content:
            content = remove_sidebar_css(content)
        
        # サイドバーJSを削除
        if 'sidebar-toggle' in content or 'updateRoleBadge' in content:
            content = remove_sidebar_js(content)
        
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✓ Updated: {file_path.relative_to(ROOT)}")
            return True
        else:
            print(f"- Skipped: {file_path.relative_to(ROOT)} (no changes)")
            return False
    
    except Exception as e:
        print(f"✗ Error processing {file_path}: {e}")
        return False

def main():
    """メイン処理"""
    html_files = list(PAGES_DIR.rglob('*.html'))
    
    print(f"Found {len(html_files)} HTML files in admin pages")
    print("=" * 60)
    
    updated_count = 0
    for html_file in html_files:
        if process_file(html_file):
            updated_count += 1
    
    print("=" * 60)
    print(f"Updated {updated_count} files")

if __name__ == '__main__':
    main()

