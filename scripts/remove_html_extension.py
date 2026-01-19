#!/usr/bin/env python3
"""
HTMLファイル内のリンクから.html拡張子を削除するスクリプト
"""
import re
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

def should_skip_link(href):
    """スキップすべきリンクかどうかを判定"""
    if not href:
        return True
    # 外部リンク
    if href.startswith('http://') or href.startswith('https://') or href.startswith('//'):
        return True
    # アンカー
    if href.startswith('#'):
        return True
    # JavaScript
    if href.startswith('javascript:'):
        return True
    # メール
    if href.startswith('mailto:'):
        return True
    # 電話
    if href.startswith('tel:'):
        return True
    return False

def remove_html_from_href(match):
    """href属性から.htmlを削除"""
    prefix = match.group(1)  # href=" または href='
    quote = match.group(2)   # " または '
    path = match.group(3)    # パス部分
    
    if should_skip_link(path):
        return match.group(0)  # 変更しない
    
    # .htmlを削除（アンカーリンクも対応）
    if '.html' in path:
        # アンカーリンクの場合（例: /lp.html#voice）
        if '#' in path:
            new_path = path.replace('.html#', '#')  # .html# を # に置換
        else:
            new_path = path.replace('.html', '')  # .htmlを削除
        
        # index.htmlは / に変換
        if new_path.endswith('/index'):
            new_path = new_path[:-6]  # /indexを削除
            if not new_path:
                new_path = '/'
        elif new_path == '/index':
            new_path = '/'
        
        return f'{prefix}{quote}{new_path}{quote}'
    
    return match.group(0)  # 変更しない

def process_file(file_path):
    """ファイルを処理"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # href="/xxx.html" または href='/xxx.html' または href="/xxx.html#anchor" を置換
        # 絶対パス（/で始まる）
        pattern1 = r'(href=)(["\'])(/[^"\']*\.html[^"\']*)(["\'])'
        content = re.sub(pattern1, remove_html_from_href, content)
        
        # src="/xxx.html" または src='/xxx.html' も置換（念のため）
        pattern2 = r'(src=)(["\'])(/[^"\']*\.html[^"\']*)(["\'])'
        content = re.sub(pattern2, remove_html_from_href, content)
        
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
    html_files = list(SRC.rglob("*.html"))
    print(f"Found {len(html_files)} HTML files")
    
    modified_count = 0
    for html_file in html_files:
        if process_file(html_file):
            modified_count += 1
            print(f"Modified: {html_file.relative_to(ROOT)}")
    
    print(f"\nModified {modified_count} files")

if __name__ == "__main__":
    main()

