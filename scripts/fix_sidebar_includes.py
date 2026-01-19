#!/usr/bin/env python3
"""
管理ページのサイドバーインクルードを修正するスクリプト
- エスケープされた引用符を修正
- 不要なsetupMypageLink関数を削除
"""
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
PAGES_DIR = SRC / "pages" / "admin"

# エスケープされた引用符を修正
ESCAPED_INCLUDE_PATTERN = re.compile(r"@include\(\\'partials\.admin-sidebar\\'\)")
CORRECT_INCLUDE = "@include('partials.admin-sidebar')"

# 不要なsetupMypageLink関数を削除
SETUPMYPAGELINK_PATTERN = re.compile(
    r'<script[^>]*>\s*//\s*マイページリンクを設定.*?async\s+function\s+setupMypageLink.*?</script>',
    re.DOTALL
)

# 不要なsetupMypageLink関数（別パターン）
SETUPMYPAGELINK_PATTERN2 = re.compile(
    r'async\s+function\s+setupMypageLink\(\)\s*\{.*?\}',
    re.DOTALL
)

# 不要なコメント行を削除
COMMENT_PATTERN = re.compile(r'<!--\s*サイドバー\s*-->\s*\n', re.MULTILINE)

def fix_file(file_path):
    """ファイルを修正"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        changes = []
        
        # エスケープされた引用符を修正
        if ESCAPED_INCLUDE_PATTERN.search(content):
            content = ESCAPED_INCLUDE_PATTERN.sub(CORRECT_INCLUDE, content)
            changes.append("エスケープされた引用符を修正")
        
        # 不要なsetupMypageLink関数を削除
        if SETUPMYPAGELINK_PATTERN.search(content):
            content = SETUPMYPAGELINK_PATTERN.sub('', content)
            changes.append("不要なsetupMypageLink関数を削除")
        
        if SETUPMYPAGELINK_PATTERN2.search(content):
            content = SETUPMYPAGELINK_PATTERN2.sub('', content)
            changes.append("不要なsetupMypageLink関数を削除（パターン2）")
        
        # 不要なコメント行を削除
        if COMMENT_PATTERN.search(content):
            content = COMMENT_PATTERN.sub('', content)
            changes.append("不要なコメント行を削除")
        
        # 空のscriptタグを削除
        content = re.sub(r'<script[^>]*>\s*</script>', '', content)
        
        # 連続する空行を1つに
        content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)
        
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✓ Updated: {file_path.relative_to(ROOT)}")
            if changes:
                print(f"  Changes: {', '.join(changes)}")
            return True
        else:
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
        if fix_file(html_file):
            updated_count += 1
    
    print("=" * 60)
    print(f"Updated {updated_count} files")

if __name__ == '__main__':
    main()

