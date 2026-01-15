/**
 * Entrance Common Menu Module
 * 共通メニュー機能（設定、TODO、日報、出退勤）
 */

(function () {
    'use strict';

    const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

    // ========================================
    // Menu HTML Templates
    // ========================================
    const menuHTML = `
<!-- Entrance Header -->
<header class="entrance-header">
    <div class="header-controls" id="entrance-header-controls">
        <!-- Job button will be moved here by JS -->
        <button class="floating-btn" id="menu-toggle-btn" onclick="EntranceMenu.toggle()" title="メニュー">
            <i class="fas fa-bars"></i>
        </button>
    </div>
</header>

<!-- Main Menu Overlay -->
<div id="entrance-menu-overlay">
    <button class="entrance-menu-close" onclick="EntranceMenu.toggle()">
        <i class="fas fa-times"></i>
    </button>
    
    <!-- Main Menu Panel -->
    <div id="main-menu-panel" class="entrance-menu-items">
        <div class="entrance-menu-item">
            <button onclick="EntranceMenu.showSettings()">
                <i class="fas fa-cog"></i>
                <span>設定</span>
            </button>
        </div>
        <div class="entrance-menu-item">
            <button onclick="EntranceMenu.openTodo()">
                <i class="fas fa-tasks"></i>
                <span>TODO</span>
            </button>
        </div>
        <div class="entrance-menu-item">
            <button onclick="EntranceMenu.openDailyReport()">
                <i class="fas fa-file-alt"></i>
                <span>日報</span>
            </button>
        </div>
        <div class="entrance-menu-item">
            <button onclick="EntranceMenu.openAttendance()">
                <i class="fas fa-clock"></i>
                <span>出退勤</span>
            </button>
        </div>
    </div>
    
    <!-- Settings Panel -->
    <div id="settings-panel" style="display: none;">
        <div class="settings-header">
            <button class="settings-back-btn" onclick="EntranceMenu.hideSettings()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2>設定</h2>
        </div>
        <div class="settings-content">
            <div class="settings-item">
                <div class="settings-label">
                    <i class="fas fa-moon"></i>
                    <span>ダークモード</span>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="theme-toggle-switch" onchange="EntranceMenu.toggleTheme()" checked>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="settings-item">
                <div class="settings-label">
                    <i class="fas fa-globe"></i>
                    <span>言語</span>
                </div>
                <select id="language-select" class="settings-select" onchange="EntranceMenu.changeLanguage()">
                    <option value="ja">日本語</option>
                    <option value="en">English</option>
                    <option value="pt">Português</option>
                </select>
            </div>
        </div>
    </div>
</div>

<!-- TODO Overlay -->
<div id="todo-overlay" class="feature-overlay">
    <div class="feature-overlay-content">
        <div class="feature-overlay-header">
            <button class="feature-overlay-back" onclick="EntranceMenu.closeTodo()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2><i class="fas fa-tasks"></i> TODO</h2>
            <button class="feature-overlay-add" onclick="EntranceMenu.showAddTodoForm()">
                <i class="fas fa-plus"></i>
            </button>
        </div>
        
        <div id="add-todo-form" class="feature-form" style="display: none;">
            <input type="text" id="new-todo-title" placeholder="TODOのタイトル..." class="feature-input">
            <div class="feature-form-actions">
                <button onclick="EntranceMenu.hideAddTodoForm()" class="feature-btn-cancel">キャンセル</button>
                <button onclick="EntranceMenu.submitNewTodo()" class="feature-btn-submit">追加</button>
            </div>
        </div>
        
        <div class="feature-filter-tabs" id="todo-filter-tabs">
            <button class="feature-filter-btn active" data-filter="all" onclick="EntranceMenu.filterTodos('all')">すべて</button>
            <button class="feature-filter-btn" data-filter="active" onclick="EntranceMenu.filterTodos('active')">未完了</button>
            <button class="feature-filter-btn" data-filter="completed" onclick="EntranceMenu.filterTodos('completed')">完了</button>
        </div>
        
        <div id="todo-list-container" class="feature-list">
            <div class="feature-loading"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>
        </div>
    </div>
</div>

<!--Daily Report Overlay-- >
<div id="daily-report-overlay" class="feature-overlay">
    <div class="feature-overlay-content">
        <div class="feature-overlay-header">
            <button class="feature-overlay-back" onclick="EntranceMenu.closeDailyReport()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2><i class="fas fa-file-alt"></i> 日報</h2>
            <button class="feature-overlay-add" onclick="EntranceMenu.showAddReportForm()">
                <i class="fas fa-plus"></i>
            </button>
        </div>
        
        <div id="add-report-form" class="feature-form" style="display: none;">
            <input type="date" id="new-report-date" class="feature-input">
            <textarea id="new-report-content" placeholder="本日の業務内容・成果・課題など..." class="feature-textarea" rows="5"></textarea>
            <div class="feature-form-actions">
                <button onclick="EntranceMenu.hideAddReportForm()" class="feature-btn-cancel">キャンセル</button>
                <button onclick="EntranceMenu.askMisogiToWrite()" class="feature-btn-ai"><i class="fas fa-robot"></i> MISOGIに書かせる</button>
                <button onclick="EntranceMenu.submitNewReport()" class="feature-btn-submit">保存</button>
            </div>
        </div>
        
        <div id="report-list-container" class="feature-list">
            <div class="feature-loading"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>
        </div>
    </div>
</div>

<!--Chat Toggle Button-- >
        <button class="floating-btn" id="chat-toggle-btn" onclick="EntranceCore.toggleChatLog()" title="チャットログ">
            <i class="fas fa-comment-alt"></i>
        </button>
    `;

    // ========================================
    // State
    // ========================================
    let currentTodoFilter = 'all';
    let cachedTodos = [];

    // ========================================
    // Helper Functions
    // ========================================
    function getToken() {
        if (window.EntranceCore && typeof window.EntranceCore.getToken === 'function') {
            return window.EntranceCore.getToken();
        }
        return localStorage.getItem('cognito_id_token');
    }

    function getUser() {
        if (window.EntranceCore && typeof window.EntranceCore.getUser === 'function') {
            return window.EntranceCore.getUser();
        }
        try {
            return JSON.parse(localStorage.getItem('cognito_user') || '{}');
        } catch {
            return {};
        }
    }

    function appendChatMessage(type, message) {
        if (typeof window.appendChatMessage === 'function') {
            window.appendChatMessage(type, message);
        } else {
            console.log(`[${type}] ${message} `);
        }
    }

    // ========================================
    // Menu Functions
    // ========================================
    const EntranceMenu = {
        init() {
            // Insert menu HTML into page
            document.body.insertAdjacentHTML('beforeend', menuHTML);

            // Initialize theme from storage
            const savedTheme = localStorage.getItem('entrance-theme');
            if (savedTheme === 'light') {
                document.body.classList.add('light-mode');
                const themeSwitch = document.getElementById('theme-toggle-switch');
                if (themeSwitch) themeSwitch.checked = false;
            }

            // Initialize language from storage
            const savedLang = localStorage.getItem('entrance-language') || localStorage.getItem('user_language') || 'ja';
            const langSelect = document.getElementById('language-select');
            if (langSelect) langSelect.value = savedLang;

            // Move existing job button into header if present
            this.moveControlsToHeader();

            console.log('[EntranceMenu] Initialized with Header');
        },

        moveControlsToHeader() {
            const headerControls = document.getElementById('entrance-header-controls');
            const jobBtn = document.getElementById('floating-job-btn');

            if (headerControls && jobBtn) {
                // Prepend job button so menu is on the right
                headerControls.insertBefore(jobBtn, document.getElementById('menu-toggle-btn'));
                // Remove fixed positioning from job btn to let it flow in header
                jobBtn.style.position = 'static';
                jobBtn.style.margin = '0';
            }
        },

        toggle() {
            const overlay = document.getElementById('entrance-menu-overlay');
            if (overlay) {
                overlay.classList.toggle('visible');
                if (!overlay.classList.contains('visible')) {
                    this.hideSettings();
                }
            }
        },

        showSettings() {
            const mainMenu = document.getElementById('main-menu-panel');
            const settingsPanel = document.getElementById('settings-panel');
            if (mainMenu) mainMenu.style.display = 'none';
            if (settingsPanel) settingsPanel.style.display = 'block';

            const themeSwitch = document.getElementById('theme-toggle-switch');
            if (themeSwitch) {
                themeSwitch.checked = !document.body.classList.contains('light-mode');
            }

            const langSelect = document.getElementById('language-select');
            const savedLang = localStorage.getItem('entrance-language') || 'ja';
            if (langSelect) langSelect.value = savedLang;
        },

        hideSettings() {
            const mainMenu = document.getElementById('main-menu-panel');
            const settingsPanel = document.getElementById('settings-panel');
            if (mainMenu) mainMenu.style.display = 'block';
            if (settingsPanel) settingsPanel.style.display = 'none';
        },

        toggleTheme() {
            const themeSwitch = document.getElementById('theme-toggle-switch');
            if (themeSwitch && themeSwitch.checked) {
                document.body.classList.remove('light-mode');
                localStorage.setItem('entrance-theme', 'dark');
            } else {
                document.body.classList.add('light-mode');
                localStorage.setItem('entrance-theme', 'light');
            }
        },

        changeLanguage() {
            const langSelect = document.getElementById('language-select');
            if (langSelect) {
                const lang = langSelect.value;
                localStorage.setItem('entrance-language', lang);
                localStorage.setItem('user_language', lang);

                const messages = {
                    ja: '言語を日本語に設定しました。',
                    en: 'Language has been changed to English.',
                    pt: 'Idioma alterado para Português.'
                };
                appendChatMessage('ai', messages[lang] || messages.ja);
            }
        },

        // ========================================
        // TODO Functions
        // ========================================
        openTodo() {
            this.toggle();
            const overlay = document.getElementById('todo-overlay');
            if (overlay) {
                overlay.classList.add('visible');
                this.loadTodoList();
            }
        },

        closeTodo() {
            const overlay = document.getElementById('todo-overlay');
            if (overlay) overlay.classList.remove('visible');
            this.hideAddTodoForm();
        },

        showAddTodoForm() {
            document.getElementById('add-todo-form').style.display = 'block';
            document.getElementById('new-todo-title').focus();
        },

        hideAddTodoForm() {
            const form = document.getElementById('add-todo-form');
            const input = document.getElementById('new-todo-title');
            if (form) form.style.display = 'none';
            if (input) input.value = '';
        },

        filterTodos(filter) {
            currentTodoFilter = filter;
            document.querySelectorAll('#todo-filter-tabs .feature-filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === filter);
            });
            this.renderFilteredTodos();
        },

        renderFilteredTodos() {
            const container = document.getElementById('todo-list-container');
            let filtered = cachedTodos;

            if (currentTodoFilter === 'active') {
                filtered = cachedTodos.filter(t => !t.completed && t.status !== 'completed');
            } else if (currentTodoFilter === 'completed') {
                filtered = cachedTodos.filter(t => t.completed || t.status === 'completed');
            }

            if (filtered.length === 0) {
                const msg = currentTodoFilter === 'all' ? 'TODOがありません<br>＋ボタンで追加してください' :
                    currentTodoFilter === 'active' ? '未完了のTODOはありません' : '完了したTODOはありません';
                container.innerHTML = `< div class="feature-empty" ><i class="fas fa-tasks"></i><div>${msg}</div></div > `;
            } else {
                container.innerHTML = filtered.map(t => {
                    const isCompleted = t.completed || t.status === 'completed';
                    return `
        < div class="feature-item ${isCompleted ? 'completed' : ''}" onclick = "EntranceMenu.toggleTodoItem('${t.id}', ${isCompleted})" style = "display: flex; align-items: center;" >
                            <div class="feature-item-checkbox ${isCompleted ? 'checked' : ''}">
                                ${isCompleted ? '<i class="fas fa-check" style="color:#fff;font-size:0.7rem;"></i>' : ''}
                            </div>
                            <div style="flex:1;">
                                <div class="feature-item-title">${t.text || t.title || t.content || 'タイトルなし'}</div>
                                <div class="feature-item-meta">${t.created_at ? `作成: ${new Date(t.created_at).toLocaleDateString('ja-JP')}` : ''}</div>
                            </div>
                        </div >
        `;
                }).join('');
            }
        },

        async loadTodoList() {
            const container = document.getElementById('todo-list-container');
            container.innerHTML = '<div class="feature-loading"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>';

            const token = getToken();
            const user = getUser();
            if (!user || !user.id) {
                container.innerHTML = '<div class="feature-empty"><i class="fas fa-lock"></i><div>ログインが必要です</div></div>';
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/todos?staff_id=${user.id || user.sub}&limit=50`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    cachedTodos = Array.isArray(data) ? data : (data.todos || data.items || []);
                    this.renderFilteredTodos();
                } else {
                    container.innerHTML = '<div class="feature-empty"><i class="fas fa-exclamation-triangle"></i><div>読み込みに失敗しました</div></div>';
                }
            } catch (e) {
                console.error('Failed to load todos:', e);
                container.innerHTML = '<div class="feature-empty"><i class="fas fa-exclamation-triangle"></i><div>読み込みに失敗しました</div></div>';
            }
        },

        async toggleTodoItem(todoId, currentlyCompleted) {
            const token = getToken();
            try {
                await fetch(`${API_BASE}/todos/${todoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ completed: !currentlyCompleted })
                });
                this.loadTodoList();
            } catch (e) {
                console.error('Failed to toggle todo:', e);
            }
        },

        async submitNewTodo() {
            const titleInput = document.getElementById('new-todo-title');
            const title = titleInput ? titleInput.value.trim() : '';

            if (!title) {
                alert('タイトルを入力してください');
                return;
            }

            const token = getToken();
            const user = getUser();

            try {
                const response = await fetch(`${API_BASE}/todos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        staff_id: user.id || user.sub,
                        text: title,
                        completed: false
                    })
                });

                if (response.ok) {
                    this.hideAddTodoForm();
                    this.loadTodoList();
                    appendChatMessage('ai', `✅ TODOを追加しました：「${title}」`);
                } else {
                    alert('追加に失敗しました');
                }
            } catch (e) {
                console.error('Failed to create todo:', e);
                alert('追加に失敗しました');
            }
        },

        // ========================================
        // Daily Report Functions
        // ========================================
        openDailyReport() {
            this.toggle();
            const overlay = document.getElementById('daily-report-overlay');
            if (overlay) {
                overlay.classList.add('visible');
                document.getElementById('new-report-date').value = new Date().toISOString().split('T')[0];
                this.loadReportList();
            }
        },

        closeDailyReport() {
            const overlay = document.getElementById('daily-report-overlay');
            if (overlay) overlay.classList.remove('visible');
            this.hideAddReportForm();
        },

        showAddReportForm() {
            document.getElementById('add-report-form').style.display = 'block';
        },

        hideAddReportForm() {
            const form = document.getElementById('add-report-form');
            const content = document.getElementById('new-report-content');
            if (form) form.style.display = 'none';
            if (content) content.value = '';
        },

        async loadReportList() {
            const container = document.getElementById('report-list-container');
            container.innerHTML = '<div class="feature-loading"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>';

            const token = getToken();
            const user = getUser();
            if (!user || !user.id) {
                container.innerHTML = '<div class="feature-empty"><i class="fas fa-lock"></i><div>ログインが必要です</div></div>';
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/daily-reports?staff_id=${user.id || user.sub}&limit=15`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    const reports = Array.isArray(data) ? data : (data.reports || data.items || []);

                    if (reports.length === 0) {
                        container.innerHTML = '<div class="feature-empty"><i class="fas fa-file-alt"></i><div>日報がありません<br>＋ボタンで作成してください</div></div>';
                    } else {
                        container.innerHTML = reports.map(r => `
                            <div class="feature-item">
                                <div class="feature-item-title">${r.date || r.report_date || '日付不明'}</div>
                                <div class="feature-item-meta">${r.summary || (r.content ? r.content.substring(0, 60) + '...' : '内容なし')}</div>
                            </div>
                        `).join('');
                    }
                } else {
                    container.innerHTML = '<div class="feature-empty"><i class="fas fa-exclamation-triangle"></i><div>読み込みに失敗しました</div></div>';
                }
            } catch (e) {
                console.error('Failed to load daily reports:', e);
                container.innerHTML = '<div class="feature-empty"><i class="fas fa-exclamation-triangle"></i><div>読み込みに失敗しました</div></div>';
            }
        },

        async submitNewReport() {
            const date = document.getElementById('new-report-date').value;
            const content = document.getElementById('new-report-content').value.trim();

            if (!content) {
                alert('内容を入力してください');
                return;
            }

            const token = getToken();
            const user = getUser();

            try {
                const response = await fetch(`${API_BASE}/daily-reports`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        staff_id: user.id || user.sub,
                        date: date,
                        content: content,
                        summary: content.substring(0, 50),
                        status: 'submitted'
                    })
                });

                if (response.ok) {
                    this.hideAddReportForm();
                    this.loadReportList();
                    appendChatMessage('ai', `✅ 日報を保存しました（${date}）`);
                } else {
                    alert('保存に失敗しました');
                }
            } catch (e) {
                console.error('Failed to create report:', e);
                alert('保存に失敗しました');
            }
        },

        askMisogiToWrite() {
            this.closeDailyReport();
            appendChatMessage('ai', '日報の作成をお手伝いします。<br><br>今日行った業務を教えてください。例えば：<br>• どんな作業をしましたか？<br>• 成果はありましたか？<br>• 課題や気づきはありましたか？<br><br>お話しいただければ、日報の形にまとめます。');
        },

        // ========================================
        // Attendance Functions
        // ========================================
        openAttendance() {
            this.toggle();
            const attendance = window.currentAttendanceRecord;
            if (attendance) {
                if (attendance.on_break) {
                    appendChatMessage('ai', '現在は【休憩中】です。<br><br><button class="attendance-btn" onclick="performBreakEnd()"><i class="fas fa-play"></i> 休憩終了</button> <button class="attendance-btn" style="background: linear-gradient(135deg, #ef4444, #dc2626);" onclick="performClockOut()"><i class="fas fa-sign-out-alt"></i> 退勤</button>');
                } else {
                    appendChatMessage('ai', '現在は【出勤中】です。<br><br><button class="attendance-btn" style="background: linear-gradient(135deg, #f59e0b, #d97706);" onclick="performBreakStart()"><i class="fas fa-coffee"></i> 休憩開始</button> <button class="attendance-btn" style="background: linear-gradient(135deg, #ef4444, #dc2626);" onclick="performClockOut()"><i class="fas fa-sign-out-alt"></i> 退勤</button>');
                }
            } else {
                appendChatMessage('ai', '現在は【未出勤】です。出勤するには「出勤」ボタンを押してください。<br><br><button class="attendance-btn" onclick="performClockIn()"><i class="fas fa-sign-in-alt"></i> 出勤</button>');
            }
        }
    };

    // Export to global scope
    window.EntranceMenu = EntranceMenu;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => EntranceMenu.init());
    } else {
        EntranceMenu.init();
    }
})();
