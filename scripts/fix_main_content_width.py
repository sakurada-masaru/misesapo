#!/usr/bin/env python3
"""
全管理ページの.main-contentスタイルにmargin-leftを追加するスクリプト
共通サイドバーを使用しているため、各ページでmargin-leftを設定する必要がある
"""

import os
import re
from pathlib import Path

# 修正対象のディレクトリ
ADMIN_PAGES_DIR = Path('src/pages/admin')

def fix_main_content_style(file_path):
    """ファイル内の.main-contentスタイルを修正"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # .main-content { ... } のパターンを検索
        # paddingだけが設定されている場合にmargin-leftを追加
        pattern = r'(\.main-content\s*\{[^}]*?)(padding:\s*24px;[^}]*?)(\})'
        
        def replace_main_content(match):
            opening = match.group(1)
            padding_block = match.group(2)
            closing = match.group(3)
            
            # 既にmargin-leftが設定されている場合はスキップ
            if 'margin-left' in padding_block:
                return match.group(0)
            
            # flex: 1が設定されているかチェック
            has_flex = 'flex:' in padding_block or 'flex:' in opening
            
            # margin-leftを追加
            if has_flex:
                # flex: 1がある場合は、その後にmargin-leftを追加
                new_block = padding_block.rstrip() + '\n      margin-left: var(--sidebar-width);\n      transition: margin-left 0.3s ease;'
            else:
                # flex: 1がない場合は、paddingの前に追加
                new_block = 'margin-left: var(--sidebar-width);\n      ' + padding_block.lstrip() + '\n      transition: margin-left 0.3s ease;'
            
            return opening + new_block + closing
        
        content = re.sub(pattern, replace_main_content, content, flags=re.DOTALL)
        
        # .sidebar.collapsed ~ .main-content のパターンも修正
        collapsed_pattern = r'(\.sidebar\.collapsed\s*~\s*\.main-content[^}]*?\{[^}]*?)(padding:\s*24px;[^}]*?)(\})'
        
        def replace_collapsed_main_content(match):
            opening = match.group(1)
            padding_block = match.group(2)
            closing = match.group(3)
            
            # 既にmargin-leftが設定されている場合はスキップ
            if 'margin-left' in padding_block:
                return match.group(0)
            
            # margin-leftを追加
            new_block = padding_block.rstrip() + '\n      margin-left: var(--sidebar-width-collapsed);'
            
            return opening + new_block + closing
        
        content = re.sub(collapsed_pattern, replace_collapsed_main_content, content, flags=re.DOTALL)
        
        # 変更があった場合のみファイルを更新
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
    
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """メイン処理"""
    fixed_files = []
    
    # 全HTMLファイルを検索
    for html_file in ADMIN_PAGES_DIR.rglob('*.html'):
        if fix_main_content_style(html_file):
            fixed_files.append(str(html_file))
            print(f"Fixed: {html_file}")
    
    if fixed_files:
        print(f"\n{len(fixed_files)} files fixed:")
        for f in fixed_files:
            print(f"  - {f}")
    else:
        print("No files needed fixing.")

if __name__ == '__main__':
    main()

