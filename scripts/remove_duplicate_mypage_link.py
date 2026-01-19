#!/usr/bin/env python3
"""
管理ページから不要なsetupMypageLink関数を削除するスクリプト
共通のadmin-sidebar.jsで処理されるため不要
"""
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
PAGES_DIR = SRC / "pages" / "admin"

def remove_duplicate_mypage_link(content):
    """不要なsetupMypageLink関数を削除"""
    # パターン1: 完全なscriptタグ内のsetupMypageLink関数
    pattern1 = re.compile(
        r'<script[^>]*>\s*//\s*マイページリンクを設定\s*async\s+function\s+setupMypageLink\(\)\s*\{.*?\}\s*</script>',
        re.DOTALL
    )
    content = pattern1.sub('', content)
    
    # パターン2: scriptタグ内の不完全な関数（行が切れている場合）
    pattern2 = re.compile(
        r'<script[^>]*>\s*//\s*マイページリンクを設定\s*async\s+.*?setupMypageLink.*?</script>',
        re.DOTALL
    )
    content = pattern2.sub('', content)
    
    # パターン3: 単独のsetupMypageLink関数（scriptタグ外）
    pattern3 = re.compile(
        r'async\s+function\s+setupMypageLink\(\)\s*\{[^}]*const\s+mypageLink[^}]*\}',
        re.DOTALL
    )
    content = pattern3.sub('', content)
    
    # パターン4: より広範囲なパターン（try-catchブロックを含む）
    pattern4 = re.compile(
        r'<script[^>]*>\s*(?://\s*マイページリンクを設定\s*)?async\s+function\s+setupMypageLink\(\)\s*\{.*?catch\s*\([^)]*\)\s*\{[^}]*\}\s*\}\s*</script>',
        re.DOTALL
    )
    content = pattern4.sub('', content)
    
    # パターン5: 不完全な関数定義（行が切れている）
    pattern5 = re.compile(
        r'<script[^>]*>\s*//\s*マイページリンクを設定\s*async\s+[^<]*?</script>',
        re.DOTALL
    )
    content = pattern5.sub('', content)
    
    # エスケープされた引用符も修正
    content = re.sub(r"@include\(\\'partials\.admin-sidebar\\'\)", "@include('partials.admin-sidebar')", content)
    
    # 不要なコメント行を削除
    content = re.sub(r'<!--\s*サイドバー\s*-->\s*\n', '', content)
    
    # 空のscriptタグを削除
    content = re.sub(r'<script[^>]*>\s*</script>', '', content)
    
    # 連続する空行を整理
    content = re.sub(r'\n\s*\n\s*\n+', '\n\n', content)
    
    return content

def fix_file(file_path):
    """ファイルを修正"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        content = remove_duplicate_mypage_link(content)
        
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✓ Updated: {file_path.relative_to(ROOT)}")
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

