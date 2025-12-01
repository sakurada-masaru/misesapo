#!/usr/bin/env python3
"""
全管理ページのマイページリンクとsetupMypageLink関数を修正するスクリプト
"""
import os
import re
from pathlib import Path

# 修正対象のファイル
FILES_TO_FIX = [
    'src/pages/admin/customers/index.html',
    'src/pages/admin/estimates/index.html',
    'src/pages/admin/services/index.html',
    'src/pages/admin/analytics/index.html',
    'src/pages/admin/images/index.html',
    'src/pages/admin/orders.html',
    'src/pages/admin/partners.html',
]

def fix_script_tag(content):
    """<script src>タグの中のsetupMypageLink関数を別の<script>タグに移動"""
    # <script src="...">の中にsetupMypageLink関数がある場合を修正
    pattern = r'(<script src="[^"]+">)\s*// マイページリンクを設定\s*async function setupMypageLink\(\)[^<]+</script>'
    
    def replace_func(match):
        script_src_tag = match.group(1)
        # setupMypageLink関数を抽出
        func_match = re.search(r'async function setupMypageLink\(\)[^<]+', match.group(0), re.DOTALL)
        if func_match:
            func_code = func_match.group(0)
            # デバッグログを追加
            if 'console.log' not in func_code:
                func_code = func_code.replace(
                    'mypageLink.style.display = \'flex\';',
                    'mypageLink.style.display = \'flex\';\n        console.log(\'[Admin] Mypage link set:\', mypageLink.href);'
                )
                func_code = func_code.replace(
                    '} catch (error) {',
                    '} else {\n        console.warn(\'[Admin] No email found for mypage link\');\n      }\n    } catch (error) {'
                )
            return f'{script_src_tag}</script>\n<script>\n  {func_code}\n</script>'
        return match.group(0)
    
    content = re.sub(pattern, replace_func, content, flags=re.DOTALL)
    return content

def ensure_setup_mypage_link_call(content):
    """setupMypageLink()の呼び出しを確実に追加"""
    # DOMContentLoadedイベントリスナーを探す
    if 'document.addEventListener(\'DOMContentLoaded\'' in content:
        # 既にsetupMypageLink()が呼び出されているか確認
        dom_content_loaded_pattern = r'document\.addEventListener\([\'"]DOMContentLoaded[\'"],\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[^}]*?\}'
        match = re.search(dom_content_loaded_pattern, content, re.DOTALL)
        if match and 'setupMypageLink();' not in match.group(0):
            # setupMypageLink()を追加
            content = re.sub(
                r'(document\.addEventListener\([\'"]DOMContentLoaded[\'"],\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[^}]*?)(\})',
                r'\1    setupMypageLink();\n  \2',
                content,
                flags=re.DOTALL,
                count=1
            )
    # IIFEパターン
    elif '})();' in content:
        if 'setupMypageLink();' not in content:
            content = re.sub(
                r'(\}\)\(\);)(\s*</script>)',
                r'  setupMypageLink();\n\1\2',
                content,
                count=1
            )
    
    return content

def fix_css_selectors(content):
    """CSSセレクタの欠損を修正"""
    # .sidebar-header
    if '.sidebar.collapsed .sidebar-toggle i' in content and '.sidebar-header {' not in content:
        content = re.sub(
            r'(\.sidebar\.collapsed \.sidebar-toggle i\s*\{[^}]*\})',
            r'\1\n  .sidebar-header {',
            content
        )
        # その後、padding: 16px; などのプロパティを追加
        if 'padding: 16px;' in content and '.sidebar-header {' in content:
            # 既に存在する場合はスキップ
            pass
        else:
            content = re.sub(
                r'(\.sidebar-header \{)',
                r'\1\n    padding: 16px;\n    border-bottom: 1px solid #e5e7eb;\n    min-height: 56px;\n    display: flex;\n    align-items: center;\n  }',
                content
            )
    
    # 同様に他のセレクタも修正
    fixes = [
        (r'\.sidebar-role \{', r'padding: 6px 16px;\n    border-bottom: 1px solid #e5e7eb;\n    transition: opacity 0.3s ease;\n  }'),
        (r'\.sidebar-role \.role-badge \{', r'display: inline-block;\n    padding: 3px 10px;\n    background: #e0e7ff;\n    color: #3730a3;\n    border-radius: 4px;\n    font-size: 0.75rem;\n    font-weight: 500;\n    white-space: nowrap;\n  }'),
        (r'\.sidebar-nav \{', r'flex: 1;\n    padding: 8px;\n    display: flex;\n    flex-direction: column;\n    gap: 1px;\n    overflow-y: auto;\n  }'),
        (r'\.nav-item \{', r'display: flex;\n    align-items: center;\n    gap: 10px;\n    padding: 8px 10px;\n    color: #6b7280;\n    text-decoration: none;\n    border-radius: 8px;\n    transition: all 0.2s;\n    white-space: nowrap;\n    font-size: 0.8125rem;\n  }'),
        (r'\.nav-item i \{', r'width: 18px;\n    text-align: center;\n    flex-shrink: 0;\n    font-size: 0.875rem;\n  }'),
    ]
    
    return content

def add_primary_variable(content):
    """--primary CSS変数を追加"""
    if ':root {' in content and '--primary:' not in content:
        content = re.sub(
            r'(:root\s*\{[^}]*)(\})',
            r'\1    --primary: #3b82f6;\n  \2',
            content,
            flags=re.DOTALL,
            count=1
        )
    return content

def process_file(filepath):
    """ファイルを処理"""
    if not os.path.exists(filepath):
        print(f"⚠️  ファイルが見つかりません: {filepath}")
        return False
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # <script src>タグの問題を修正
    content = fix_script_tag(content)
    
    # setupMypageLink()の呼び出しを確実に追加
    content = ensure_setup_mypage_link_call(content)
    
    # CSSセレクタを修正
    content = fix_css_selectors(content)
    
    # --primary変数を追加
    content = add_primary_variable(content)
    
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ 更新完了: {filepath}")
        return True
    else:
        print(f"⏭️  変更なし: {filepath}")
        return False

def main():
    """メイン処理"""
    base_dir = Path(__file__).parent.parent
    updated_count = 0
    
    for filepath in FILES_TO_FIX:
        full_path = base_dir / filepath
        if process_file(str(full_path)):
            updated_count += 1
    
    print(f"\n✅ {updated_count}個のファイルを更新しました。")

if __name__ == '__main__':
    main()

