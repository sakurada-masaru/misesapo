#!/usr/bin/env python3
"""
ダッシュボードのサイドバーを全ページに適用するスクリプト
"""
import os
import re
from pathlib import Path

# 標準サイドバーのHTML（ダッシュボードのサイドバー）
STANDARD_SIDEBAR = '''    <nav class="sidebar-nav">
      <a href="/admin/dashboard.html" class="nav-item">
        <i class="fas fa-history"></i>
        <span class="nav-label">アクティビティ</span>
      </a>
      <a href="/admin/schedules/" class="nav-item">
        <i class="fas fa-calendar-alt"></i>
        <span class="nav-label">スケジュール</span>
      </a>
      <a href="/admin/customers/" class="nav-item">
        <i class="fas fa-store"></i>
        <span class="nav-label">顧客管理</span>
      </a>
      <a href="/admin/reports/" class="nav-item">
        <i class="fas fa-file-alt"></i>
        <span class="nav-label">レポート</span>
      </a>
      <a href="/admin/estimates/" class="nav-item">
        <i class="fas fa-file-invoice-dollar"></i>
        <span class="nav-label">見積もり</span>
      </a>
      <a href="/admin/orders.html" class="nav-item">
        <i class="fas fa-shopping-cart"></i>
        <span class="nav-label">発注管理</span>
      </a>
      <a href="/admin/partners.html" class="nav-item">
        <i class="fas fa-handshake"></i>
        <span class="nav-label">パートナー企業</span>
      </a>
      <a href="/admin/users/" class="nav-item">
        <i class="fas fa-users"></i>
        <span class="nav-label">ユーザー</span>
      </a>
      <a href="/admin/attendance/errors.html" class="nav-item">
        <i class="fas fa-exclamation-triangle"></i>
        <span class="nav-label">出退勤エラー</span>
      </a>
      <a href="/admin/services/" class="nav-item">
        <i class="fas fa-cog"></i>
        <span class="nav-label">サービス管理</span>
      </a>
      <a href="/admin/analytics/" class="nav-item">
        <i class="fas fa-chart-bar"></i>
        <span class="nav-label">分析</span>
      </a>
      <a href="/admin/images/" class="nav-item">
        <i class="fas fa-images"></i>
        <span class="nav-label">メディア</span>
      </a>
      <div class="nav-divider"></div>
      <a href="#" class="nav-item" id="sidebar-mypage-link" style="display: none;">
        <i class="fas fa-user-circle"></i>
        <span class="nav-label">マイページ</span>
      </a>
      <a href="/wiki" class="nav-item">
        <i class="fas fa-book-open"></i>
        <span class="nav-label">WIKI</span>
      </a>
      <a href="/admin/settings/" class="nav-item">
        <i class="fas fa-sliders-h"></i>
        <span class="nav-label">設定</span>
      </a>
      <a href="/admin/sitemap.html" class="nav-item">
        <i class="fas fa-sitemap"></i>
        <span class="nav-label">サイトマップ</span>
      </a>
      <button class="nav-item nav-item-button" onclick="window.Auth && window.Auth.logout()">
        <i class="fas fa-sign-out-alt"></i>
        <span class="nav-label">ログアウト</span>
      </button>
    </nav>'''

# サイドバーがあるファイルのリスト（ダッシュボードを除く）
SIDEBAR_FILES = [
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

def get_active_nav_item(filepath):
    """ファイルパスからアクティブなnav-itemを判定"""
    if 'dashboard' in filepath:
        return '/admin/dashboard.html'
    elif 'users' in filepath and 'detail' not in filepath:
        return '/admin/users/'
    elif 'schedules' in filepath:
        return '/admin/schedules/'
    elif 'customers' in filepath:
        return '/admin/customers/'
    elif 'reports' in filepath:
        return '/admin/reports/'
    elif 'estimates' in filepath:
        return '/admin/estimates/'
    elif 'orders' in filepath:
        return '/admin/orders.html'
    elif 'partners' in filepath:
        return '/admin/partners.html'
    elif 'services' in filepath:
        return '/admin/services/'
    elif 'analytics' in filepath:
        return '/admin/analytics/'
    elif 'images' in filepath:
        return '/admin/images/'
    elif 'attendance/errors' in filepath:
        return '/admin/attendance/errors.html'
    elif 'attendance/history' in filepath:
        return '/admin/attendance/history.html'
    elif 'attendance/requests' in filepath:
        return '/admin/attendance/requests.html'
    elif 'wiki' in filepath:
        return '/wiki'
    elif 'settings' in filepath:
        return '/admin/settings/'
    elif 'sitemap' in filepath:
        return '/admin/sitemap.html'
    return None

def update_sidebar(content, active_path):
    """サイドバーを標準サイドバーに置き換え、アクティブな項目を設定"""
    # nav要素を検索して置き換え
    pattern = r'<nav class="sidebar-nav">.*?</nav>'
    
    # アクティブな項目を設定
    sidebar_html = STANDARD_SIDEBAR
    if active_path:
        sidebar_html = re.sub(
            rf'(<a href="{re.escape(active_path)}" class="nav-item)(">)',
            r'\1 active\2',
            sidebar_html
        )
    
    # 既存のnav要素を置き換え
    content = re.sub(pattern, sidebar_html, content, flags=re.DOTALL)
    
    return content

def ensure_setup_mypage_link(content):
    """setupMypageLink関数とその呼び出しを確実に追加"""
    # setupMypageLink関数が既に存在するか確認
    if 'async function setupMypageLink()' not in content:
        # スクリプトタグの最後に追加
        setup_function = '''
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

      // Firebase認証からメールアドレスを取得（フォールバック）
      if (!email) {
        const authData = window.Auth?.getAuthData?.();
        if (authData) {
          email = authData.user?.email || authData.email;
        }
      }

      if (email) {
        mypageLink.href = `/staff/mypage.html?email=${encodeURIComponent(email)}`;
        mypageLink.style.display = 'flex';
        console.log('[Sidebar] Mypage link set:', mypageLink.href);
      } else {
        console.warn('[Sidebar] No email found for mypage link');
      }
    } catch (error) {
      console.error('Error setting up mypage link:', error);
    }
  }
'''
        # </script>の前に追加
        content = re.sub(r'(</script>)', setup_function + r'\1', content, count=1)
    
    # DOMContentLoadedまたはIIFE内でsetupMypageLink()を呼び出す
    # DOMContentLoadedパターン
    if 'document.addEventListener(\'DOMContentLoaded\'' in content:
        if 'setupMypageLink();' not in re.search(r'document\.addEventListener\([\'"]DOMContentLoaded[\'"].*?\}', content, re.DOTALL).group(0):
            content = re.sub(
                r'(document\.addEventListener\([\'"]DOMContentLoaded[\'"],\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[^}]*?)(\})',
                r'\1    setupMypageLink();\n  \2',
                content,
                flags=re.DOTALL
            )
    # IIFEパターン
    elif '})();' in content:
        if 'setupMypageLink();' not in re.search(r'\(function\(\)\s*\{.*?\}\)\(\);', content, re.DOTALL).group(0):
            content = re.sub(
                r'(\}\)\(\);)(\s*</script>)',
                r'  setupMypageLink();\n\1\2',
                content
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
    
    # アクティブなnav-itemを判定
    active_path = get_active_nav_item(filepath)
    
    # サイドバーを更新
    content = update_sidebar(content, active_path)
    
    # setupMypageLink関数を確実に追加
    content = ensure_setup_mypage_link(content)
    
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

