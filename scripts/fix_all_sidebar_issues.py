#!/usr/bin/env python3
"""
管理ページのサイドバー関連の問題を全て修正するスクリプト
"""
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
PAGES_DIR = SRC / "pages" / "admin"

def fix_file(file_path):
    """ファイルを修正"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # 1. エスケープされた引用符を修正
        content = re.sub(r"@include\(\\'partials\.admin-sidebar\\'\)", "@include('partials.admin-sidebar')", content)
        
        # 2. 不完全なsetupMypageLink関数を削除（複数のパターンに対応）
        # パターン1: async で始まる不完全な関数
        content = re.sub(r'<script[^>]*>\s*//\s*マイページリンクを設定\s*async\s+[^<]*?</script>', '', content, flags=re.DOTALL)
        
        # パターン2: 不完全な関数定義を含むscriptタグ全体
        content = re.sub(r'<script[^>]*>\s*async\s+[^<]*?}\s*}\s*</script>', '', content, flags=re.DOTALL)
        
        # パターン3: 不完全な関数定義（行が切れている）
        content = re.sub(r'<script[^>]*>\s*//\s*マイページリンクを設定\s*async\s+.*?}\s*</script>', '', content, flags=re.DOTALL)
        
        # パターン4: より広範囲な不完全なコード
        content = re.sub(r'<script[^>]*>\s*async\s+.*?console\.(log|warn|error).*?</script>', '', content, flags=re.DOTALL)
        
        # 3. 不要なコメント行を削除
        content = re.sub(r'<!--\s*サイドバー\s*-->\s*\n', '', content)
        
        # 4. 空のscriptタグを削除
        content = re.sub(r'<script[^>]*>\s*</script>', '', content)
        
        # 5. 連続する空行を整理
        content = re.sub(r'\n\s*\n\s*\n+', '\n\n', content)
        
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

