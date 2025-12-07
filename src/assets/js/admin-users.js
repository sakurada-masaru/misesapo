(function() {
  'use strict';
  
  // ============================================
  // セクション1: 定数・設定
  // ============================================
  const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
  const perPage = 15;
  
  // ============================================
  // セクション2: グローバル変数
  // ============================================
  let allUsers = [];           // 全従業員リスト（絶対に保持）
  let filteredUsers = [];      // フィルター後のリスト
  let currentPage = 1;
  let deleteTargetId = null;
  let attendanceRecords = {};  // 出退勤データ

  // DOM要素の参照
  const tbody = document.getElementById('users-tbody');
  const userDialog = document.getElementById('user-dialog');
  const deleteDialog = document.getElementById('delete-dialog');
  const userForm = document.getElementById('user-form');
  
  // ============================================
  // セクション3: 初期化
  // ============================================
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[UserManagement] 初期化開始');
    
    // 出退勤データの読み込み
    loadAttendanceRecords();
    
    // ユーザー詳細画面から戻ってきた場合、リロードする
    const needsReload = sessionStorage.getItem('users_list_needs_reload');
    const updatedUserId = sessionStorage.getItem('users_list_updated_user_id');
    
    if (needsReload === 'true') {
      // フラグをクリア
      sessionStorage.removeItem('users_list_needs_reload');
      sessionStorage.removeItem('users_list_updated_user_id');
      
      // リロード前に少し待つ（DynamoDBの反映を待つ）
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 従業員リストの読み込み（最重要）
    await loadUsers();
    
    // 更新されたユーザーが特定されている場合、そのユーザーを個別取得APIで最新データに更新
    if (updatedUserId) {
      try {
        const timestamp = new Date().getTime();
        const individualResponse = await fetch(`${API_BASE}/workers/${updatedUserId}?t=${timestamp}&_=${Date.now()}`, {
          cache: 'no-store'
        });
        if (individualResponse.ok) {
          const latestWorker = await individualResponse.json();
          // allUsers内の該当ユーザーを更新
          const userIndex = allUsers.findIndex(u => String(u.id) === String(updatedUserId));
          if (userIndex !== -1) {
            // ロールの判定
            let role = latestWorker.role || 'staff';
            if (latestWorker.role_code !== undefined) {
              role = getRoleFromCode(latestWorker.role_code);
            }
            
            // ユーザー情報を更新
            allUsers[userIndex] = {
              ...allUsers[userIndex],
              name: (latestWorker.name || latestWorker.display_name || '').trim() || '名前未設定',
              email: (latestWorker.email || latestWorker.email_address || '').trim() || '-',
              phone: (latestWorker.phone || latestWorker.phone_number || '').trim() || '-',
              role: role,
              department: (latestWorker.department || latestWorker.team || '').trim() || '-',
              status: latestWorker.status || 'active',
              updated_at: latestWorker.updated_at
            };
            
            // フィルタリングとテーブルを再描画
            applyFilters();
            renderTable();
            updateStats();
            console.log(`Updated user ${updatedUserId} with latest data from API`);
          }
        }
      } catch (error) {
        console.warn(`Failed to update user ${updatedUserId} with latest data:`, error);
      }
    }
    
    // イベントリスナーの設定
    setupEventListeners();
    
    // 各セクションのレンダリング
    renderAllSections();
    
    console.log('[UserManagement] 初期化完了');
  });
  
  // ============================================
  // セクション4: 全セクションのレンダリング
  // ============================================
  function renderAllSections() {
    updateStats();
    filterAndRender();
    renderAttendanceSections();
  }
  
  // ============================================
  // セクション5: 従業員データの読み込み（最重要）
  // ============================================

  // ユーザー読み込み
  async function loadUsers() {
    try {
      // キャッシュを無効化するためにタイムスタンプを追加
      const timestamp = new Date().getTime();
      
      // 全ユーザー取得APIを使用（強整合性読み取りだが、更新直後は古いデータの可能性がある）
      const response = await fetch(`${API_BASE}/workers?t=${timestamp}&_=${Date.now()}`, {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const workers = await response.json();
      
      // レスポンスが配列でない場合の処理
      let workersArray = Array.isArray(workers) ? workers : (workers.items || workers.workers || []);
      
      // データの整合性を確保するため、各ユーザーを個別取得APIで最新データに更新
      // （全ユーザー取得APIが古いデータを返す可能性があるため）
      console.log('[UserManagement] 全ユーザー取得APIから取得:', workersArray.length, '名');
      const updatedWorkers = [];
      for (const worker of workersArray) {
        const workerId = String(worker.id || worker.user_id || '').trim();
        if (!workerId || workerId === 'N/A' || workerId === '9999') {
          continue;
        }
        
        try {
          // 個別取得APIで最新データを取得（強整合性読み取り）
          const individualResponse = await fetch(`${API_BASE}/workers/${workerId}?t=${timestamp}&_=${Date.now()}`, {
            cache: 'no-store'
          });
          if (individualResponse.ok) {
            const latestWorker = await individualResponse.json();
            updatedWorkers.push(latestWorker);
          } else {
            // 個別取得に失敗した場合は、全ユーザー取得APIのデータを使用
            console.warn(`[UserManagement] 個別取得に失敗: ${workerId}`, individualResponse.status);
            updatedWorkers.push(worker);
          }
        } catch (error) {
          console.warn(`[UserManagement] 個別取得エラー: ${workerId}`, error);
          // エラーが発生した場合は、全ユーザー取得APIのデータを使用
          updatedWorkers.push(worker);
        }
      }
      
      workersArray = updatedWorkers;
      console.log('[UserManagement] 個別取得APIで更新後:', workersArray.length, '名');
      
      // 新しいデータ構造に対応
      allUsers = workersArray
        .filter(w => {
          // お客様（customer）を除外（従業員のみを表示）
          const role = w.role || (w.role_code !== undefined ? getRoleFromCode(w.role_code) : 'staff');
          if (role === 'customer') return false;
          
          // IDが存在する場合は表示（必須）
          const workerId = String(w.id || w.user_id || '').trim();
          if (workerId && workerId !== 'N/A' && workerId !== '') {
            // 無効なID（9999など）を除外
            if (workerId === '9999') {
              console.warn(`[UserManagement] 無効なIDを除外: ${workerId}`);
              return false;
            }
            return true;
          }
          
          return false;
        })
        .map(w => {
          // roleの判定（roleフィールドを優先、存在しない場合のみrole_codeから変換）
          let role = w.role;
          if (!role || role === '') {
            if (w.role_code !== undefined && w.role_code !== null) {
              role = getRoleFromCode(w.role_code);
            } else {
              role = 'staff';
            }
          }
          
          // IDを正規化（文字列として扱う）
          const workerId = String(w.id || w.user_id || '').trim();
          
          return {
            id: workerId,
            name: (w.name || w.display_name || '').trim() || '名前未設定',
            email: (w.email || w.email_address || '').trim() || '-',
            phone: (w.phone || w.phone_number || '').trim() || '-',
            role: role,
            department: (w.department || w.team || '').trim() || '-',
            team: w.team || '-',
            status: w.status || (w.active !== undefined ? (w.active ? 'active' : 'inactive') : 'active'),
            created_at: w.created_at || w.created_date,
            updated_at: w.updated_at,
            // マイページリンク用の情報を保持
            cognito_sub: w.cognito_sub,
            firebase_uid: w.firebase_uid,
            // 元のIDを保持（編集・削除時に使用）
            originalId: workerId || null
          };
        })
        .filter(u => u !== null && u.id && u.id !== 'N/A' && u.id.trim() !== '') // nullとIDがないものを除外
        .sort((a, b) => {
          // IDでソート（W001, W002...の順）
          const aId = a.id;
          const bId = b.id;
          
          // Wで始まるIDの場合
          if (aId.startsWith('W') && bId.startsWith('W')) {
            const aNum = parseInt(aId.substring(1)) || 0;
            const bNum = parseInt(bId.substring(1)) || 0;
            return aNum - bNum;
          }
          
          // 通常の文字列比較
          return aId.localeCompare(bId);
        });
      
      console.log('Users loaded:', allUsers.length);
      console.log('Sample user:', allUsers[0]);
      console.log('All user IDs:', allUsers.map(u => u.id));
      
      if (allUsers.length === 0) {
        console.warn('No users found. API response:', workers);
        const loadingEl = document.getElementById('loading-users');
        if (loadingEl) {
          loadingEl.style.display = 'block';
          loadingEl.textContent = 'ユーザーが見つかりませんでした';
        }
        // 出退勤セクションも空にする
        renderAttendanceSections();
        return;
      }
      
      updateStats();
      filterAndRender();
      renderAttendanceSections();
    } catch (error) {
      console.error('Failed to load users:', error);
      console.error('Error details:', error.message, error.stack);
      const loadingEl = document.getElementById('loading-users');
      if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.textContent = `読み込みに失敗しました: ${error.message}`;
      }
      // エラー時も出退勤セクションを表示（空の状態）
      renderAttendanceSections();
    }
  }

  function getRoleFromCode(code) {
    if (code === '1' || code === 1) return 'admin';
    if (code === '2' || code === 2) return 'sales';
    if (code === '3' || code === 3) return 'office';
    if (code === '4' || code === 4) return 'staff';
    if (code === '5' || code === 5) return 'developer';
    if (code === '6' || code === 6) return 'designer';
    if (code === '7' || code === 7) return 'general_affairs';
    if (code === '8' || code === 8) return 'operation';
    if (code === '9' || code === 9) return 'contractor';
    if (code === '10' || code === 10) return 'accounting';
    if (code === '11' || code === 11) return 'human_resources';
    if (code === '12' || code === 12) return 'special_advisor';
    if (code === '13' || code === 13) return 'field_sales';
    if (code === '14' || code === 14) return 'inside_sales';
    if (code === '15' || code === 15) return 'mechanic';
    if (code === '16' || code === 16) return 'engineer';
    if (code === '17' || code === 17) return 'part_time';
    return 'staff';
  }

  // 部署をセクションに割り当て
  function getSectionForDepartment(department) {
    const dept = (department || '').trim();
    
    // フロントオフィス: 営業
    if (dept === '営業') {
      return 'front-office';
    }
    
    // ミドルオフィス: 営業事務、現場清掃、清掃
    if (dept === '営業事務' || dept === '現場清掃' || dept === '清掃') {
      return 'middle-office';
    }
    
    // バックオフィス: 開発、事務
    if (dept === '開発' || dept === '事務') {
      return 'back-office';
    }
    
    // 運営本部: 人事、総務、スペシャルバイザー、経理、取締役、経営本部、運営
    if (dept === '人事' || dept === '総務' || dept === 'スペシャルバイザー' || 
        dept === '経理' || dept === '取締役' || dept === '経営本部' || dept === '運営') {
      return 'board';
    }
    
    // デフォルトはバックオフィス
    return 'back-office';
  }

  // 権限の優先順位（数値が小さいほど権限が大きい）
  function getRolePriority(role) {
    const priorities = {
      'admin': 1,
      'special_advisor': 2,
      'operation': 3,
      'human_resources': 4,
      'accounting': 5,
      'general_affairs': 6,
      'developer': 7,
      'designer': 8,
      'engineer': 9,
      'sales': 10,
      'office': 11,
      'staff': 12,
      'contractor': 13,
      'part_time': 14
    };
    return priorities[role] || 99;
  }

  function updateStats() {
    document.getElementById('stat-total').textContent = allUsers.length;
    document.getElementById('stat-staff').textContent = allUsers.filter(u => u.role === 'cleaning').length;
    document.getElementById('stat-sales').textContent = allUsers.filter(u => u.role === 'sales').length;
    document.getElementById('stat-office').textContent = allUsers.filter(u => u.role === 'office').length;
    document.getElementById('stat-developer').textContent = allUsers.filter(u => u.role === 'public_relations').length;
    document.getElementById('stat-admin').textContent = allUsers.filter(u => u.role === 'admin').length;
    document.getElementById('stat-operation').textContent = allUsers.filter(u => u.role === 'director').length;
  }

  function filterAndRender() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const roleFilter = document.getElementById('role-filter').value;
    const statusFilter = document.getElementById('status-filter').value;

    filteredUsers = allUsers.filter(u => {
      const matchSearch = !search || 
        (u.name && u.name.toLowerCase().includes(search)) ||
        (u.email && u.email.toLowerCase().includes(search)) ||
        (u.id && u.id.toLowerCase().includes(search));
      const matchRole = !roleFilter || u.role === roleFilter;
      const matchStatus = !statusFilter || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });

    currentPage = 1;
    renderTable();
    // ページネーションは新しいレイアウトでは不要
    // renderPagination();
  }

  function renderTable() {
    // 新しいレイアウト: 4セクション構造
    renderOrganizationLayout();
  }

  function renderOrganizationLayout() {
    const loadingEl = document.getElementById('loading-users');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }

    // ユーザーを部署ごとにグループ化
    const usersByDepartment = {};
    for (const user of filteredUsers) {
      const dept = user.department || '未分類';
      if (!usersByDepartment[dept]) {
        usersByDepartment[dept] = [];
      }
      usersByDepartment[dept].push(user);
    }

    // 各部署内のユーザーを権限の大きい順にソート
    for (const dept in usersByDepartment) {
      usersByDepartment[dept].sort((a, b) => {
        const priorityA = getRolePriority(a.role);
        const priorityB = getRolePriority(b.role);
        return priorityA - priorityB; // 数値が小さいほど権限が大きい
      });
    }

    // セクションごとに部署を分類
    const sections = {
      'front-office': [],
      'middle-office': [],
      'back-office': [],
      'board': [] // 運営本部
    };

    for (const dept in usersByDepartment) {
      const section = getSectionForDepartment(dept);
      sections[section].push({
        name: dept,
        users: usersByDepartment[dept]
      });
    }

    // 各セクションをレンダリング
    renderSection('front-office-departments', sections['front-office']);
    renderSection('middle-office-departments', sections['middle-office']);
    renderSection('back-office-departments', sections['back-office']);
    renderSection('board-departments', sections['board']);
  }

  function renderSection(containerId, departments) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (departments.length === 0) {
      container.innerHTML = '<p class="no-departments">部署がありません</p>';
      return;
    }

    container.innerHTML = departments.map(dept => {
      const userCards = dept.users.map(user => {
        // マイページリンクを生成
        let mypageUrl = '/staff/mypage.html';
        if (user.id && user.id !== 'N/A' && !user.id.startsWith('temp_')) {
          mypageUrl = `/staff/mypage.html?id=${encodeURIComponent(user.id)}`;
        } else if (user.email && user.email !== '-') {
          mypageUrl = `/staff/mypage.html?email=${encodeURIComponent(user.email)}`;
        }

        return `
          <div class="user-card" data-role="${user.role}">
            <div class="user-card-header">
              <div class="user-avatar-large">${(user.name || '?')[0]}</div>
              <div class="user-card-info">
                <h4 class="user-name">
                  <a href="/admin/users/detail?id=${encodeURIComponent(user.id)}">${escapeHtml(user.name || '-')}</a>
                </h4>
                <div class="user-id">${escapeHtml(user.id)}</div>
              </div>
            </div>
            <div class="user-card-body">
              <div class="user-detail">
                <i class="fas fa-envelope"></i>
                <span>${escapeHtml(user.email || '-')}</span>
              </div>
              <div class="user-detail">
                <i class="fas fa-phone"></i>
                <span>${escapeHtml(user.phone || '-')}</span>
              </div>
              <div class="user-card-footer">
                <span class="role-badge role-${user.role}">${getRoleLabel(user.role)}</span>
                <span class="status-badge status-${user.status || 'active'}">${user.status === 'inactive' ? '無効' : '有効'}</span>
              </div>
            </div>
            <div class="user-card-actions">
              <a href="/admin/users/detail?id=${encodeURIComponent(user.id)}" class="btn-icon" title="詳細">
                <i class="fas fa-eye"></i>
              </a>
              <a href="${mypageUrl}" class="btn-icon" title="マイページ" target="_blank">
                <i class="fas fa-external-link-alt"></i>
              </a>
              <button class="btn-icon" title="編集" onclick="editUser('${user.id}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-icon delete" title="削除" onclick="confirmDelete('${user.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="department-group">
          <h3 class="department-title">${escapeHtml(dept.name)} <span class="user-count">(${dept.users.length}名)</span></h3>
          <div class="users-grid">
            ${userCards}
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getRoleLabel(role) {
    const labels = {
      admin: '管理者',
      sales: '営業',
      office: '事務',
      cleaning: '清掃',
      staff: '清掃員',
      developer: '開発者',
      public_relations: '広報',
      designer: 'デザイナー',
      general_affairs: '総務',
      director: '取締役',
      operation: '運営',
      contractor: '外部委託',
      accounting: '経理',
      human_resources: '人事',
      special_advisor: 'スペシャルバイザー',
      field_sales: 'フィールドセールス',
      inside_sales: 'インサイドセールス',
      mechanic: 'メカニック',
      engineer: 'エンジニア',
      part_time: 'アルバイト',
      other: 'その他'
    };
    return labels[role] || role;
  }

  function renderPagination() {
    const totalPages = Math.ceil(filteredUsers.length / perPage);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let html = `<button ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">前</button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
        html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
      } else if (i === currentPage - 3 || i === currentPage + 3) {
        html += `<span style="padding:8px">...</span>`;
      }
    }
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">次</button>`;
    pagination.innerHTML = html;
  }

  window.goToPage = function(page) {
    currentPage = page;
    renderTable();
    renderPagination();
  };

  function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', filterAndRender);
    document.getElementById('role-filter').addEventListener('change', filterAndRender);
    document.getElementById('status-filter').addEventListener('change', filterAndRender);
    document.getElementById('reset-filters').addEventListener('click', () => {
      document.getElementById('search-input').value = '';
      document.getElementById('role-filter').value = '';
      document.getElementById('status-filter').value = '';
      filterAndRender();
    });

    // 新規追加
    document.getElementById('add-user-btn').addEventListener('click', () => {
      document.getElementById('dialog-title').textContent = '新規ユーザー登録';
      userForm.reset();
      document.getElementById('user-id').value = '';
      document.getElementById('password-required').style.display = 'inline';
      document.getElementById('user-password').required = true;
      document.getElementById('form-status').textContent = '';
      userDialog.showModal();
    });

    // メールアドレスのバリデーション（現状は個人メールアドレスも許可）
    function validateEmail(email) {
      if (!email) {
        return { valid: false, message: 'メールアドレスは必須です。' };
      }
      
      // 基本的なメールアドレス形式のチェック
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          valid: false,
          message: '有効なメールアドレスを入力してください。'
        };
      }
      
      // 現状は個人メールアドレスも許可
      // 将来的には企業用メールアドレス（@misesapo.app）への移行を推奨
      return { valid: true };
    }

    // フォーム送信
    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('user-id').value;
      const isNew = !id;
      
      const email = document.getElementById('user-email').value;
      const emailValidation = validateEmail(email);
      
      if (!emailValidation.valid) {
        document.getElementById('form-status').textContent = emailValidation.message;
        document.getElementById('form-status').style.color = 'red';
        return;
      }
      
      const data = {
        name: document.getElementById('user-name').value,
        email: email,
        phone: document.getElementById('user-phone').value,
        role: document.getElementById('user-role').value,
        department: document.getElementById('user-department').value,
        status: document.getElementById('user-status').value
      };

      const password = document.getElementById('user-password').value;
      if (password) {
        data.password = password;
      }

      if (isNew) {
        // 新規作成時: IDはバックエンドで生成されるため、ここでは指定しない
        // data.id = 'W' + Date.now(); // 削除: バックエンドで生成
        data.created_at = new Date().toISOString();
        
        // ロールコードを設定
        const roleCodeMap = {
          'admin': '1',
          'sales': '2',
          'office': '3',
          'cleaning': '4',
          'public_relations': '5',
          'designer': '6',
          'general_affairs': '7',
          'director': '8',
          'contractor': '9',
          'accounting': '10',
          'human_resources': '11',
          'special_advisor': '12',
          'field_sales': '13',
          'inside_sales': '14',
          'mechanic': '15',
          'engineer': '16',
          'part_time': '17'
        };
        data.role_code = roleCodeMap[data.role] || '4';
        
        // 新規作成時はFirebaseユーザーも作成する
        if (!password) {
          alert('新規ユーザー作成にはパスワードが必要です。');
          return;
        }
        
        try {
          document.getElementById('form-status').textContent = 'AWS Cognitoユーザーを作成中...';
          
          // AWS Cognitoにユーザーを作成（Lambda関数経由）
          const apiBaseUrl = API_BASE || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
          const cognitoResponse = await fetch(`${apiBaseUrl}/admin/cognito/users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: data.email,
              password: password,
              name: data.name,
              role: data.role,
              department: data.department
            })
          });
          
          if (!cognitoResponse.ok) {
            const errorData = await cognitoResponse.json();
            throw new Error(errorData.error || 'Cognitoユーザーの作成に失敗しました');
          }
          
          const cognitoResult = await cognitoResponse.json();
          data.cognito_sub = cognitoResult.sub;  // Cognito User Sub
          
          document.getElementById('form-status').textContent = 'ユーザー情報を保存中...';
        } catch (cognitoError) {
          console.error('Cognito user creation error:', cognitoError);
          let errorMessage = 'AWS Cognitoユーザーの作成に失敗しました。';
          if (cognitoError.message.includes('already exists') || cognitoError.message.includes('既に存在')) {
            errorMessage = 'このメールアドレスは既に使用されています。';
          } else if (cognitoError.message.includes('invalid') || cognitoError.message.includes('無効')) {
            errorMessage = '無効なメールアドレスです。';
          } else if (cognitoError.message.includes('password') || cognitoError.message.includes('パスワード')) {
            errorMessage = 'パスワードが弱すぎます。8文字以上で、大文字・小文字・数字・特殊文字を含めてください。';
          } else {
            errorMessage = cognitoError.message || 'AWS Cognitoユーザーの作成に失敗しました。';
          }
          document.getElementById('form-status').textContent = errorMessage;
          document.getElementById('form-status').style.color = 'red';
          return;
        }
      } else {
        // 既存ユーザーの更新時: 既存の情報を取得して保持
        // originalIdがあればそれを使用、なければidを使用
        const updateId = allUsers.find(u => String(u.id) === String(id))?.originalId || id;
        data.id = updateId;
        
        try {
          // 既存ユーザー情報を取得
          const existingUserResponse = await fetch(`${API_BASE}/workers/${encodeURIComponent(updateId)}`);
          if (existingUserResponse.ok) {
            const existingUser = await existingUserResponse.json();
            
            // 既存の情報を保持（更新されないフィールド）
            if (existingUser.created_at) {
              data.created_at = existingUser.created_at;
            }
            if (existingUser.cognito_sub) {
              data.cognito_sub = existingUser.cognito_sub;
            }
            if (existingUser.firebase_uid) {
              data.firebase_uid = existingUser.firebase_uid;
            }
            // スケジュール関連の情報も保持
            if (existingUser.scheduled_start_time) {
              data.scheduled_start_time = existingUser.scheduled_start_time;
            }
            if (existingUser.scheduled_end_time) {
              data.scheduled_end_time = existingUser.scheduled_end_time;
            }
            if (existingUser.scheduled_work_hours !== undefined) {
              data.scheduled_work_hours = existingUser.scheduled_work_hours;
            }
            
            // ロールコードを設定（ロールが変更された場合に備えて）
            const roleCodeMap = {
              'admin': '1',
              'sales': '2',
              'office': '3',
              'cleaning': '4',
              'public_relations': '5',
              'designer': '6',
              'general_affairs': '7',
              'director': '8',
              'contractor': '9',
              'accounting': '10',
              'human_resources': '11',
              'special_advisor': '12',
              'field_sales': '13',
              'inside_sales': '14',
              'mechanic': '15',
              'engineer': '16',
              'part_time': '17'
            };
            data.role_code = roleCodeMap[data.role] || existingUser.role_code || '4';
          } else {
            // 既存ユーザーが見つからない場合、ロールコードのみ設定
            const roleCodeMap = {
              'admin': '1',
              'sales': '2',
              'office': '3',
              'cleaning': '4',
              'public_relations': '5',
              'designer': '6',
              'general_affairs': '7',
              'director': '8',
              'contractor': '9',
              'accounting': '10',
              'human_resources': '11',
              'special_advisor': '12',
              'field_sales': '13',
              'inside_sales': '14',
              'mechanic': '15',
              'engineer': '16',
              'part_time': '17'
            };
            data.role_code = roleCodeMap[data.role] || '4';
          }
        } catch (fetchError) {
          console.warn('既存ユーザー情報の取得に失敗しましたが、更新を続行します:', fetchError);
          // ロールコードのみ設定
          const roleCodeMap = {
            'admin': '1',
            'sales': '2',
            'office': '3',
            'cleaning': '4',
            'public_relations': '5',
            'designer': '6',
            'general_affairs': '7',
            'director': '8',
            'contractor': '9',
            'accounting': '10',
            'human_resources': '11',
            'special_advisor': '12',
            'field_sales': '13',
            'inside_sales': '14',
            'mechanic': '15',
            'engineer': '16',
            'part_time': '17',
            'staff': '4',
            'developer': '5',
            'operation': '8'
          };
          data.role_code = roleCodeMap[data.role] || '4';
        }
      }
      data.updated_at = new Date().toISOString();

      try {
        if (!isNew) {
          document.getElementById('form-status').textContent = '保存中...';
        }
        
        // workersテーブルに保存
        // 更新時はupdateIdを使用（既にdata.idに設定済み）
        const url = `${API_BASE}/workers${isNew ? '' : '/' + encodeURIComponent(data.id)}`;
        const response = await fetch(url, {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          const responseData = await response.json().catch(() => ({}));
          document.getElementById('form-status').textContent = '保存しました';
          document.getElementById('form-status').className = 'form-status success';
          
          // 少し待ってからダイアログを閉じてリストを更新（DynamoDBの反映を待つ）
          setTimeout(async () => {
            userDialog.close();
            // 少し待ってからキャッシュを無効化してリストを更新
            await new Promise(resolve => setTimeout(resolve, 300));
            await loadUsers();
          }, 500);
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || errorData.message || `保存に失敗しました (ステータス: ${response.status})`;
          throw new Error(errorMessage);
        }
      } catch (error) {
        console.error('Update error:', error);
        document.getElementById('form-status').textContent = error.message || '保存に失敗しました';
        document.getElementById('form-status').className = 'form-status error';
      }
    });

    // 削除確認
    document.getElementById('confirm-delete').addEventListener('click', async () => {
      if (!deleteTargetId) return;
      
      const confirmBtn = document.getElementById('confirm-delete');
      const originalText = confirmBtn.textContent;
      confirmBtn.disabled = true;
      confirmBtn.textContent = '削除中...';
      
      // IDを文字列として正規化
      const normalizedId = String(deleteTargetId);
      
      console.log('Attempting to delete worker with ID:', normalizedId);
      console.log('ID type:', typeof normalizedId);
      console.log('All available user IDs:', allUsers.map(u => ({ id: u.id, originalId: u.originalId, type: typeof u.id })));
      
      try {
        // まず、削除対象のユーザー情報を取得して確認
        const targetUser = allUsers.find(u => String(u.id) === normalizedId);
        if (!targetUser) {
          alert('削除対象のユーザーが見つかりません。ページを更新してください。');
          deleteDialog.close();
          deleteTargetId = null;
          confirmBtn.disabled = false;
          confirmBtn.textContent = originalText;
          await loadUsers(); // リストを更新
          return;
        }
        
        // originalIdがあればそれを使用、なければidを使用
        const deleteId = targetUser.originalId || targetUser.id;
        
        const response = await fetch(`${API_BASE}/workers/${encodeURIComponent(deleteId)}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const responseData = await response.json().catch(() => ({}));
          console.log('Delete successful:', responseData);
          
          deleteDialog.close();
          deleteTargetId = null; // 削除対象IDをリセット
          
          // 少し待ってからユーザー一覧を再読み込み（DynamoDBの反映を待つ）
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadUsers();
          
          // 削除が成功したか確認
          await new Promise(resolve => setTimeout(resolve, 500));
          const verifyResponse = await fetch(`${API_BASE}/workers`);
          const verifyData = await verifyResponse.json();
          const verifyWorkers = Array.isArray(verifyData) ? verifyData : (verifyData.items || verifyData.workers || []);
          const stillExists = verifyWorkers.some(u => String(u.id) === normalizedId);
          
          if (stillExists) {
            alert('削除リクエストは送信されましたが、ユーザーがまだ存在している可能性があります。\n\nページを更新して確認してください。');
          } else {
            alert('ユーザーを削除しました');
          }
        } else {
          const errorText = await response.text();
          let errorMessage = '削除に失敗しました';
          
          // エラーレスポンスをパース
          let errorData = {};
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            // JSONパースに失敗した場合はそのまま使用
          }
          
          // CORSエラーの場合
          if (response.status === 0 || errorText.includes('CORS') || errorText.includes('Access-Control')) {
            errorMessage = 'CORSエラー: API Gateway側でCORS設定が必要です。\n\n' +
                          'AWS API Gatewayコンソールで、/workers/{id} リソースのDELETEメソッドにCORSを設定してください。\n\n' +
                          '詳細: ブラウザのコンソールを確認してください。';
          } else if (response.status === 404) {
            // 404の場合は、実際に存在するか確認
            const checkResponse = await fetch(`${API_BASE}/workers`);
            const checkData = await checkResponse.json();
            const checkWorkers = Array.isArray(checkData) ? checkData : (checkData.items || checkData.workers || []);
            const exists = checkWorkers.some(u => String(u.id) === normalizedId);
            
            if (exists) {
              errorMessage = `削除に失敗しました（404エラー）。\n\n` +
                           `ユーザーID: ${normalizedId}\n` +
                           `ユーザー名: ${targetUser.name || 'N/A'}\n\n` +
                           `APIがユーザーを見つけられない可能性があります。\n` +
                           `AWS DynamoDBコンソールから直接削除するか、\n` +
                           `ページを更新して再度お試しください。\n\n` +
                           `エラー詳細: ${errorData.error || errorText}`;
            } else {
              errorMessage = 'ユーザーは既に削除されています。';
              // リストを更新
              await loadUsers();
            }
          } else if (response.status === 401 || response.status === 403) {
            errorMessage = '権限がありません';
          } else {
            errorMessage = `削除に失敗しました (ステータス: ${response.status})\n\n` +
                         `エラー: ${errorData.error || errorData.message || errorText}`;
          }
          
          console.error('Delete error:', response.status, errorText);
          alert(errorMessage);
        }
      } catch (error) {
        console.error('Delete error:', error);
        let errorMessage = '削除に失敗しました';
        
        // CORSエラーの場合
        if (error.message.includes('CORS') || error.message.includes('Access-Control') || error.name === 'TypeError') {
          errorMessage = 'CORSエラーが発生しました。\n\n' +
                        '原因: API Gateway側でDELETEメソッドのCORS設定が不足しています。\n\n' +
                        '解決方法:\n' +
                        '1. AWS API Gatewayコンソールにアクセス\n' +
                        '2. /workers/{id} リソースのDELETEメソッドを選択\n' +
                        '3. 「アクション」→「CORSを有効にする」をクリック\n' +
                        '4. アクセス制御を許可するメソッドに「DELETE」を追加\n' +
                        '5. デプロイを実行\n\n' +
                        '詳細: ブラウザのコンソール（F12）を確認してください。';
        } else {
          errorMessage = `削除に失敗しました: ${error.message}`;
        }
        
        alert(errorMessage);
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
        deleteTargetId = null; // エラー時もリセット
      }
    });
  }

  // 編集
  window.editUser = async function(id) {
    // IDを文字列として正規化
    const normalizedId = String(id);
    
    // まずローカルのallUsersから検索
    let user = allUsers.find(u => String(u.id) === normalizedId);
    
    // 見つからない場合、APIから直接取得
    if (!user) {
      try {
        document.getElementById('form-status').textContent = 'ユーザー情報を読み込み中...';
        const response = await fetch(`${API_BASE}/workers/${encodeURIComponent(normalizedId)}`);
        if (response.ok) {
          user = await response.json();
        } else {
          document.getElementById('form-status').textContent = 'ユーザーが見つかりませんでした';
          document.getElementById('form-status').className = 'form-status error';
          return;
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        document.getElementById('form-status').textContent = 'ユーザー情報の取得に失敗しました';
        document.getElementById('form-status').className = 'form-status error';
        return;
      }
    }
    
    if (!user) {
      alert('ユーザーが見つかりませんでした。ページを更新してください。');
      return;
    }

    document.getElementById('dialog-title').textContent = 'ユーザー編集';
    // originalIdがあればそれを使用、なければidを使用
    const editId = user.originalId || user.id;
    document.getElementById('user-id').value = editId;
    document.getElementById('user-name').value = user.name || '';
    document.getElementById('user-email').value = user.email || '';
    document.getElementById('user-phone').value = user.phone || '';
    document.getElementById('user-role').value = user.role || 'staff';
    document.getElementById('user-department').value = user.department || '';
    document.getElementById('user-status').value = user.status || 'active';
    document.getElementById('user-password').value = '';
    document.getElementById('password-required').style.display = 'none';
    document.getElementById('user-password').required = false;
    document.getElementById('form-status').textContent = '';
    document.getElementById('form-status').className = '';
    userDialog.showModal();
  };

  // 削除確認
  window.confirmDelete = function(id) {
    deleteTargetId = id;
    deleteDialog.showModal();
  };

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // 出退勤記録の読み込み
  function loadAttendanceRecords() {
    try {
      const stored = localStorage.getItem('attendanceRecords');
      if (stored) {
        attendanceRecords = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load attendance records:', error);
      attendanceRecords = {};
    }
  }

  // 出退勤記録の保存
  function saveAttendanceRecords() {
    try {
      localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
    } catch (error) {
      console.error('Failed to save attendance records:', error);
    }
  }

  // 今日の日付を取得（YYYY-MM-DD形式）
  function getTodayDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ユーザーの出退勤状態を取得
  function getUserAttendanceStatus(userId) {
    const today = getTodayDate();
    const key = `${userId}_${today}`;
    return attendanceRecords[key] || { clockedIn: false, clockInTime: null, clockOutTime: null };
  }

  // 出退勤トグルスイッチのレンダリング
  function renderAttendanceSections() {
    // 部署別にユーザーをグループ化
    const activeUsers = allUsers.filter(u => u.status === 'active');
    const usersByDepartment = {};
    
    activeUsers.forEach(user => {
      const department = (user.department || user.team || '').trim() || '未設定';
      if (!usersByDepartment[department]) {
        usersByDepartment[department] = [];
      }
      usersByDepartment[department].push(user);
    });
    
    // 部署名でソート（未設定を最後に）
    const sortedDepartments = Object.keys(usersByDepartment).sort((a, b) => {
      if (a === '未設定') return 1;
      if (b === '未設定') return -1;
      return a.localeCompare(b, 'ja');
    });
    
    // 出退勤セクションのコンテナを取得
    const attendanceSectionsContainer = document.querySelector('.attendance-sections');
    if (!attendanceSectionsContainer) return;
    
    // 既存のセクションをクリア（ロールベースのセクションを削除）
    attendanceSectionsContainer.innerHTML = '';
    
    // 各部署のセクションを動的に生成
    sortedDepartments.forEach(department => {
      const users = usersByDepartment[department];
      if (users.length === 0) return;
      
      // 部署名をID用にエンコード（特殊文字を置換）
      const departmentId = department.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_');
      
      // セクションHTMLを生成
      const sectionHtml = `
        <div class="attendance-section" id="attendance-section-${departmentId}">
          <div class="attendance-section-header">
            <h3>
              <i class="fas fa-building"></i>
              ${escapeHtml(department)}
              <span class="attendance-count" id="${departmentId}-attendance-count">0名</span>
            </h3>
          </div>
          <div class="attendance-grid" id="attendance-grid-${departmentId}">
            <!-- ユーザーのトグルスイッチがここに表示されます -->
          </div>
        </div>
      `;
      
      attendanceSectionsContainer.insertAdjacentHTML('beforeend', sectionHtml);
      
      // セクションをレンダリング
      renderAttendanceSection(departmentId, department, users);
    });
  }

  // 特定の部署の出退勤セクションをレンダリング
  function renderAttendanceSection(departmentId, departmentName, users) {
    const container = document.getElementById(`attendance-grid-${departmentId}`);
    const countEl = document.getElementById(`${departmentId}-attendance-count`);
    const sectionEl = document.getElementById(`attendance-section-${departmentId}`);
    
    if (!container) return;
    
    if (users.length === 0) {
      // ユーザーがいない場合はセクションを非表示
      if (sectionEl) {
        sectionEl.style.display = 'none';
      }
      if (countEl) countEl.textContent = '0名';
      return;
    }
    
    // ユーザーがいる場合はセクションを表示
    if (sectionEl) {
      sectionEl.style.display = 'block';
    }

    if (countEl) {
      const clockedInCount = users.filter(u => {
        const status = getUserAttendanceStatus(u.id);
        return status.clockedIn;
      }).length;
      countEl.textContent = `${clockedInCount}/${users.length}名`;
    }

    container.innerHTML = users.map(user => {
      const status = getUserAttendanceStatus(user.id);
      const isClockedIn = status.clockedIn;
      const clockInTime = status.clockInTime ? new Date(status.clockInTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null;
      const clockOutTime = status.clockOutTime ? new Date(status.clockOutTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null;
      
      return `
        <div class="attendance-item ${isClockedIn ? 'clocked-in' : ''}">
          <span class="attendance-status-badge ${isClockedIn ? 'working' : 'off-duty'}">
            ${isClockedIn ? '勤務中' : '退勤済み'}
          </span>
          <div class="attendance-item-info">
            <div class="attendance-item-avatar">${(user.name || '?')[0]}</div>
            <div class="attendance-item-details">
              <div class="attendance-item-name">${escapeHtml(user.name || '-')}</div>
              <div class="attendance-item-time ${isClockedIn ? 'clocked-in' : ''}">
                ${isClockedIn ? `<i class="fas fa-clock"></i> 出勤: ${clockInTime}` : (clockOutTime ? `<i class="fas fa-clock"></i> 退勤: ${clockOutTime}` : '<i class="fas fa-minus-circle"></i> 未出勤')}
              </div>
            </div>
          </div>
          <button class="attendance-button ${isClockedIn ? 'clock-out' : 'clock-in'}" 
                  onclick="toggleAttendance('${user.id}', ${!isClockedIn})"
                  ${user.status !== 'active' ? 'disabled' : ''}>
            <i class="fas ${isClockedIn ? 'fa-sign-out-alt' : 'fa-sign-in-alt'}"></i>
            ${isClockedIn ? '退勤する' : '出勤する'}
          </button>
        </div>
      `;
    }).join('');
  }

  // 出退勤のトグル
  window.toggleAttendance = async function(userId, isClockedIn) {
    const today = getTodayDate();
    const key = `${userId}_${today}`;
    const now = new Date().toISOString();
    
    if (isClockedIn) {
      // 出勤
      attendanceRecords[key] = {
        clockedIn: true,
        clockInTime: now,
        clockOutTime: null
      };
      
      // APIに送信（将来実装）
      try {
        await fetch(`${API_BASE}/attendance/clock-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            date: today,
            clock_in: now
          })
        }).catch(() => {
          // APIが未実装の場合はローカルストレージのみ保存
        });
      } catch (error) {
        console.error('Failed to record clock-in:', error);
      }
    } else {
      // 退勤
      const current = attendanceRecords[key];
      attendanceRecords[key] = {
        clockedIn: false,
        clockInTime: current?.clockInTime || null,
        clockOutTime: now
      };
      
      // APIに送信（将来実装）
      try {
        await fetch(`${API_BASE}/attendance/clock-out`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            date: today,
            clock_out: now
          })
        }).catch(() => {
          // APIが未実装の場合はローカルストレージのみ保存
        });
      } catch (error) {
        console.error('Failed to record clock-out:', error);
      }
    }
    
    saveAttendanceRecords();
    renderAttendanceSections();
  };

  // 一括ロール割り当て
  let bulkRoleTarget = null;
  let bulkRoleUsers = [];

  window.bulkAssignRole = function(role) {
    // 現在そのロールに設定されているユーザーを取得
    const roleUsers = allUsers.filter(u => {
      if (role === 'admin') {
        return (u.role === 'admin' || u.role === 'other') && u.status === 'active';
      }
      return u.role === role && u.status === 'active';
    });

    if (roleUsers.length === 0) {
      alert('このロールに設定するユーザーがいません');
      return;
    }

    bulkRoleTarget = role;
    bulkRoleUsers = roleUsers;

    const roleNames = {
      staff: '清掃員',
      sales: '営業',
      admin: '管理者'
    };

    document.getElementById('bulk-role-name').textContent = roleNames[role] || role;
    document.getElementById('bulk-role-message').textContent = `選択した${roleUsers.length}名のユーザーを${roleNames[role] || role}に設定しますか？`;

    // ユーザーリストを表示
    const usersList = document.getElementById('bulk-role-users-list');
    usersList.innerHTML = roleUsers.map(u => `
      <div style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
        <strong>${escapeHtml(u.name || '-')}</strong>
      </div>
    `).join('');

    document.getElementById('bulk-role-dialog').showModal();
  };

  // 一括ロール割り当ての確認
  document.getElementById('confirm-bulk-role').addEventListener('click', async () => {
    if (!bulkRoleTarget || bulkRoleUsers.length === 0) return;

    try {
      const roleCodeMap = {
        admin: '1',
        sales: '2',
        office: '3',
        cleaning: '4',
        public_relations: '5',
        designer: '6',
        general_affairs: '7',
        director: '8',
        contractor: '9',
        accounting: '10',
        human_resources: '11',
        special_advisor: '12',
        field_sales: '13',
        inside_sales: '14',
        mechanic: '15',
        engineer: '16',
        part_time: '17'
      };

      const roleCode = roleCodeMap[bulkRoleTarget] || '99';
      let successCount = 0;
      let errorCount = 0;

      // 各ユーザーのロールを更新
      for (const user of bulkRoleUsers) {
        try {
          const data = {
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            role: bulkRoleTarget,
            role_code: roleCode,
            department: user.department || '',
            status: user.status || 'active',
            updated_at: new Date().toISOString()
          };

          const response = await fetch(`${API_BASE}/workers/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
            console.error(`Failed to update user ${user.id}:`, response.status);
          }
        } catch (error) {
          errorCount++;
          console.error(`Error updating user ${user.id}:`, error);
        }
      }

      document.getElementById('bulk-role-dialog').close();

      if (successCount > 0) {
        alert(`${successCount}名のユーザーのロールを更新しました${errorCount > 0 ? `\n${errorCount}名の更新に失敗しました` : ''}`);
        loadUsers(); // ユーザーリストを再読み込み
      } else {
        alert('ロールの更新に失敗しました');
      }
    } catch (error) {
      console.error('Bulk role assignment error:', error);
      alert('エラーが発生しました: ' + error.message);
    }
  });
})();
