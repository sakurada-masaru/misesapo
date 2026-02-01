#!/usr/bin/env python3
"""
全サイドバーにマイページリンクを追加し、CSSを調整するスクリプト
"""
import os
import re
from pathlib import Path

# サイドバーがあるファイルのリスト
SIDEBAR_FILES = [
    'src/pages/admin/dashboard.html',
    'src/pages/admin/users/index.html',
    'src/pages/admin/users/detail.html',
    'src/pages/admin/reports/index.html',
    'src/pages/admin/analytics/index.html',
    'src/pages/admin/services/index.html',
    'src/pages/admin/orders.html',
    'src/pages/admin/partners.html',
    'src/pages/admin/schedules/index.html',
    'src/pages/admin/sitemap.html',
    'src/pages/admin/estimates/index.html',
    'src/pages/admin/images/index.html',
    'src/pages/admin/customers/index.html',
    'src/pages/admin/attendance/errors.html',
    'src/pages/admin/attendance/history.html',
    'src/pages/admin/attendance/requests.html',
    'src/pages/wiki/index.html',
]

def add_mypage_link(content):
    """マイページリンクを追加"""
    # nav-dividerの後にマイページリンクを追加
    pattern = r'(<div class="nav-divider"></div>\s*)(<a href="/wiki")'
    replacement = r'\1<a href="#" class="nav-item" id="sidebar-mypage-link" style="display: none;">\n        <i class="fas fa-user-circle"></i>\n        <span class="nav-label">マイページ</span>\n      </a>\n      \2'
    
    if re.search(pattern, content):
        content = re.sub(pattern, replacement, content)
    
    return content

def update_css(content):
    """CSSを調整"""
    # .sidebar-nav の padding と gap を調整
    content = re.sub(
        r'\.sidebar-nav\s*\{[^}]*padding:\s*12px;',
        '.sidebar-nav {\n      flex: 1;\n      padding: 8px;',
        content,
        flags=re.DOTALL
    )
    content = re.sub(
        r'\.sidebar-nav\s*\{[^}]*gap:\s*2px;',
        '      gap: 1px;',
        content,
        flags=re.DOTALL
    )
    
    # .nav-item の padding, gap, font-size を調整
    content = re.sub(
        r'\.nav-item\s*\{[^}]*padding:\s*10px\s+12px;',
        '      padding: 8px 10px;',
        content,
        flags=re.DOTALL
    )
    content = re.sub(
        r'\.nav-item\s*\{[^}]*gap:\s*12px;',
        '      gap: 10px;',
        content,
        flags=re.DOTALL
    )
    
    # .nav-item に font-size を追加（まだない場合）
    if '.nav-item {' in content and 'font-size:' not in re.search(r'\.nav-item\s*\{[^}]*\}', content, re.DOTALL).group(0):
        content = re.sub(
            r'(\.nav-item\s*\{[^}]*white-space:\s*nowrap;)',
            r'\1\n      font-size: 0.8125rem;',
            content,
            flags=re.DOTALL
        )
    
    # .nav-item i の width と font-size を調整
    content = re.sub(
        r'\.nav-item i\s*\{[^}]*width:\s*20px;',
        '      width: 18px;',
        content,
        flags=re.DOTALL
    )
    if '.nav-item i {' in content and 'font-size:' not in re.search(r'\.nav-item i\s*\{[^}]*\}', content, re.DOTALL).group(0):
        content = re.sub(
            r'(\.nav-item i\s*\{[^}]*flex-shrink:\s*0;)',
            r'\1\n      font-size: 0.875rem;',
            content,
            flags=re.DOTALL
        )
    
    # .nav-label に font-size を追加（まだない場合）
    if '.nav-label {' in content and 'font-size:' not in re.search(r'\.nav-label\s*\{[^}]*\}', content, re.DOTALL).group(0):
        content = re.sub(
            r'(\.nav-label\s*\{[^}]*white-space:\s*nowrap;)',
            r'\1\n      font-size: 0.8125rem;',
            content,
            flags=re.DOTALL
        )
    
    # .sidebar-header の padding を調整
    content = re.sub(
        r'\.sidebar-header\s*\{[^}]*padding:\s*20px;',
        '      padding: 16px;',
        content,
        flags=re.DOTALL
    )
    content = re.sub(
        r'\.sidebar-header\s*\{[^}]*min-height:\s*64px;',
        '      min-height: 56px;',
        content,
        flags=re.DOTALL
    )
    
    # .sidebar-role の padding を調整
    content = re.sub(
        r'\.sidebar-role\s*\{[^}]*padding:\s*8px\s+20px;',
        '      padding: 6px 16px;',
        content,
        flags=re.DOTALL
    )
    
    # .sidebar-role .role-badge の padding と font-size を調整
    content = re.sub(
        r'\.sidebar-role \.role-badge\s*\{[^}]*padding:\s*4px\s+12px;',
        '      padding: 3px 10px;',
        content,
        flags=re.DOTALL
    )
    content = re.sub(
        r'\.sidebar-role \.role-badge\s*\{[^}]*font-size:\s*0\.875rem;',
        '      font-size: 0.75rem;',
        content,
        flags=re.DOTALL
    )
    
    return content

def add_setup_script(content):
    """setupMypageLink関数を追加"""
    # DOMContentLoadedイベントリスナーを探す
    pattern = r'(document\.addEventListener\([\'"]DOMContentLoaded[\'"],\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[^}]*)(\}\))'
    
    if re.search(pattern, content):
        # 既存のDOMContentLoadedにsetupMypageLink()を追加
        content = re.sub(
            r'(document\.addEventListener\([\'"]DOMContentLoaded[\'"],\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[^}]*?)(\})',
            r'\1    setupMypageLink();\n  \2',
            content,
            flags=re.DOTALL
        )
    else:
        # DOMContentLoadedイベントリスナーがない場合、追加
        if '</script>' in content:
            setup_script = '''
  // マイページリンクを設定
  async function setupMypageLink() {
    const mypageLink = document.getElementById('sidebar-mypage-link');
    if (!mypageLink) return;

    try {
      let email = null;

      // Cognito認証からメールアドレスを取得
      if (window.CognitoAuth && window.CognitoAuth.isAuthenticated()) {
        const cognitoUser = await window.CognitoAuth.getCurrentUser();
        if (cognitoUser && cognitoUser.email) {
          email = cognitoUser.email;
        }
      }

      // Cognito認証からメールアドレスを取得（フォールバック）
      if (!email) {
        const authData = window.Auth?.getAuthData?.();
        if (authData) {
          email = authData.user?.email || authData.email;
        }
      }

      if (email) {
        mypageLink.href = `/staff/mypage.html?email=${encodeURIComponent(email)}`;
        mypageLink.style.display = 'flex';
      }
    } catch (error) {
      console.error('Error setting up mypage link:', error);
    }
  }
'''
            content = content.replace('</script>', setup_script + '\n</script>', 1)
    
    # setupMypageLink関数が既に存在するか確認
    if 'function setupMypageLink()' not in content:
        # スクリプトタグの最後に追加
        if '</script>' in content:
            setup_script = '''
  // マイページリンクを設定
  async function setupMypageLink() {
    const mypageLink = document.getElementById('sidebar-mypage-link');
    if (!mypageLink) return;

    try {
      let email = null;

      // Cognito認証からメールアドレスを取得
      if (window.CognitoAuth && window.CognitoAuth.isAuthenticated()) {
        const cognitoUser = await window.CognitoAuth.getCurrentUser();
        if (cognitoUser && cognitoUser.email) {
          email = cognitoUser.email;
        }
      }

      // Cognito認証からメールアドレスを取得（フォールバック）
      if (!email) {
        const authData = window.Auth?.getAuthData?.();
        if (authData) {
          email = authData.user?.email || authData.email;
        }
      }

      if (email) {
        mypageLink.href = `/staff/mypage.html?email=${encodeURIComponent(email)}`;
        mypageLink.style.display = 'flex';
      }
    } catch (error) {
      console.error('Error setting up mypage link:', error);
    }
  }
'''
            content = content.replace('</script>', setup_script + '\n</script>', 1)
    
    return content

def process_file(filepath):
    """ファイルを処理"""
    if not os.path.exists(filepath):
        print(f"⚠️  ファイルが見つかりません: {filepath}")
        return False
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # マイページリンクを追加
    content = add_mypage_link(content)
    
    # CSSを調整
    content = update_css(content)
    
    # setupMypageLink関数を追加
    content = add_setup_script(content)
    
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
    
    for filepath in SIDEBAR_FILES:
        full_path = base_dir / filepath
        if process_file(str(full_path)):
            updated_count += 1
    
    print(f"\n✅ {updated_count}個のファイルを更新しました。")

if __name__ == '__main__':
    main()

