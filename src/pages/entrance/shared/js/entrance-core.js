/**
 * Entrance Core Module
 * 共通機能: 認証、チャットログ、AI通信、ビジュアライザー
 */

// ========================================
// API Configuration
// ========================================
const EntranceCore = {
    API_BASE: 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod',

    // Job Types Configuration
    JOB_TYPES: {
        cleaning: { label: '清掃', color: '#10b981', icon: 'fa-broom' },
        office: { label: '事務', color: '#3b82f6', icon: 'fa-briefcase' },
        sales: { label: '営業', color: '#8b5cf6', icon: 'fa-handshake' },
        hr: { label: '人事', color: '#ec4899', icon: 'fa-users' },
        accounting: { label: '経理', color: '#eab308', icon: 'fa-calculator' },
        admin: { label: '管理', color: '#ffffff', icon: 'fa-cog' },
        dev: { label: '開発', color: '#ef4444', icon: 'fa-code' }
    },

    // Chat Channels Configuration
    CHAT_CHANNELS: {
        misesapo: { label: 'Misesapo', color: '#3b82f6' },
        cleaning: { label: '清掃', color: '#10b981' },
        office: { label: '事務', color: '#64748b' },
        sales: { label: '営業', color: '#8b5cf6' },
        hr: { label: '人事', color: '#ec4899' },
        accounting: { label: '経理', color: '#eab308' },
        admin: { label: '管理', color: '#6366f1' },
        dev: { label: '開発', color: '#ef4444' }
    },

    // State
    currentJobType: null,
    currentMode: 'chat',
    chatLogData: {
        messages: [],
        visible: true,
        filter: 'general',
        currentChannel: 'misesapo'
    },

    getCurrentJobFromUrl() {
        const path = window.location.pathname;
        if (path.includes('/cleaning/')) return 'cleaning';
        if (path.includes('/office/')) return 'office';
        if (path.includes('/sales/')) return 'sales';
        if (path.includes('/hr/')) return 'hr';
        if (path.includes('/accounting/')) return 'accounting';
        if (path.includes('/admin/')) return 'admin';
        if (path.includes('/dev/')) return 'dev';
        return null;
    },

    // ========================================
    // Authentication Functions
    // ========================================

    /**
     * 毎朝7時に認証をリセットする
     * ログイン時に last_auth_date を記録し、
     * 翌日の7時以降にアクセスした場合は強制ログアウト
     */
    checkDailyAuthReset() {
        const RESET_HOUR = 7; // 朝7時にリセット
        const lastAuthDate = localStorage.getItem('last_auth_date');
        const token = localStorage.getItem('cognito_id_token');

        if (!token) return false; // トークンがなければ何もしない

        const now = new Date();
        const currentHour = now.getHours();

        if (lastAuthDate) {
            const lastDate = new Date(lastAuthDate);
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());

            // 日付が変わり、かつ現在時刻が7時以降の場合
            if (today > lastDay && currentHour >= RESET_HOUR) {
                console.log('[EntranceCore] Daily auth reset triggered - forcing logout');
                this.forceLogout();
                return true;
            }
        }

        return false;
    },

    /**
     * 認証日時を記録
     */
    recordAuthDate() {
        localStorage.setItem('last_auth_date', new Date().toISOString());
    },

    /**
     * 強制ログアウト
     */
    forceLogout() {
        // すべての認証関連データを削除
        localStorage.removeItem('cognito_id_token');
        localStorage.removeItem('cognito_access_token');
        localStorage.removeItem('cognito_refresh_token');
        localStorage.removeItem('cognito_user');
        localStorage.removeItem('id_token');
        localStorage.removeItem('last_auth_date');
        localStorage.removeItem('current_job_type');
        localStorage.removeItem('currentAttendanceRecord');

        // ページをリロードしてログイン画面を表示
        window.location.reload();
    },

    ensureAuthOrRedirect() {
        // まず日次リセットをチェック
        if (this.checkDailyAuthReset()) {
            return null;
        }

        const token = localStorage.getItem('cognito_id_token');
        if (!token) {
            return null;
        }
        return token;
    },

    getUser() {
        return JSON.parse(localStorage.getItem('cognito_user') || '{}');
    },

    getToken() {
        return localStorage.getItem('cognito_id_token');
    },

    async performLogin(onSuccess) {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) return;

        const loginBtn = document.querySelector('.login-submit-btn');
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 認証中...';
        loginBtn.disabled = true;

        try {
            if (window.CognitoAuth) {
                const result = await window.CognitoAuth.login(email, password);
                if (result.success) {
                    // 認証日時を記録（毎朝7時リセット用）
                    this.recordAuthDate();
                    document.getElementById('login-form').style.display = 'none';
                    if (onSuccess) await onSuccess();
                } else {
                    throw new Error(result.message);
                }
            } else {
                throw new Error('認証システムが読み込まれていません');
            }
        } catch (err) {
            alert('ログインに失敗しました: ' + err.message);
            loginBtn.innerHTML = '認証';
            loginBtn.disabled = false;
        }
    },

    // ========================================
    // Attendance Functions
    // ========================================

    async performClockIn(onJobSelect) {
        const btn = document.getElementById('active-attendance-btn');
        if (btn) btn.disabled = true;

        const user = this.getUser();
        const token = this.getToken();

        if (!user.id || !token) {
            this.appendChatMessage('ai', 'エラー：ログイン情報が見つかりません。再ログインしてください。');
            return;
        }

        this.appendChatMessage('user', '出勤します');

        try {
            const today = new Date().toLocaleDateString('sv-SE');
            const now = new Date().toISOString();

            const response = await fetch(`${this.API_BASE}/attendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    staff_id: user.id || user.sub,
                    staff_name: user.name || user.username,
                    date: today,
                    clock_in: now
                })
            });

            if (response.ok) {
                this.appendChatMessage('ai', `${user.name || 'ユーザー'}様、出勤を記録しました。`);
                if (onJobSelect) onJobSelect();
                if (btn) btn.innerHTML = '<i class="fas fa-check"></i> 出勤済み';
            } else {
                const err = await response.json();
                throw new Error(err.message || 'API Error');
            }
        } catch (err) {
            console.error('Attendance Error:', err);
            this.appendChatMessage('ai', 'エラーが発生しました：' + err.message);
            if (btn) btn.disabled = false;
        }
    },

    async performBreakStart() {
        if (!confirm('休憩に入りますか？')) return;
        const user = this.getUser();
        const token = this.getToken();
        const now = new Date().toISOString();

        try {
            const response = await fetch(`${this.API_BASE}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    staff_id: user.id || user.sub,
                    date: new Date().toLocaleDateString('sv-SE'),
                    break_start: now
                })
            });
            if (response.ok) {
                this.appendChatMessage('ai', '休憩を記録しました。ゆっくりお休みください。');
            }
        } catch (e) { console.error(e); }
    },

    async performBreakEnd() {
        const user = this.getUser();
        const token = this.getToken();
        const now = new Date().toISOString();

        try {
            const response = await fetch(`${this.API_BASE}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    staff_id: user.id || user.sub,
                    date: new Date().toLocaleDateString('sv-SE'),
                    break_end: now
                })
            });
            if (response.ok) {
                this.appendChatMessage('ai', 'お帰りなさいませ。業務の再開を記録しました。');
            }
        } catch (e) { console.error(e); }
    },

    async performClockOut() {
        if (!confirm('本日の業務を終了し、退勤しますか？')) return;
        const user = this.getUser();
        const token = this.getToken();
        const now = new Date().toISOString();

        try {
            const response = await fetch(`${this.API_BASE}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    staff_id: user.id || user.sub,
                    date: new Date().toLocaleDateString('sv-SE'),
                    clock_out: now
                })
            });
            if (response.ok) {
                this.appendChatMessage('ai', 'お疲れ様でした。退勤を記録しました。また明日もお待ちしております。');
                localStorage.removeItem('current_job_type');
            }
        } catch (e) { console.error(e); }
    },

    // ========================================
    // Chat Message Functions
    // ========================================

    appendChatMessage(role, text) {
        const latestContainer = document.getElementById('latest-message-container');
        const chatHistory = document.getElementById('chat-history');

        if (latestContainer && latestContainer.children.length > 0) {
            const oldMessage = latestContainer.firstElementChild;
            const oldRole = oldMessage.dataset.role;
            const oldText = oldMessage.innerHTML;

            const historyBubble = document.createElement('div');
            historyBubble.className = `chat-bubble ${oldRole}`;
            historyBubble.innerHTML = oldText;
            chatHistory.appendChild(historyBubble);
        }

        if (!latestContainer) return;
        latestContainer.innerHTML = '';

        const newBubble = document.createElement('div');
        newBubble.className = `latest-message-bubble ${role}`;
        newBubble.dataset.role = role;
        newBubble.innerHTML = text.replace(/\n/g, '<br>');
        latestContainer.appendChild(newBubble);

        if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;

        const sender = role === 'ai' ? 'misogi' : 'you';
        this.writeLog(sender, text.replace(/<[^>]*>/g, '').replace(/\n/g, ' '), 'misogi');
    },

    // ========================================
    // Chat Log Functions (FF14-style)
    // ========================================

    writeLog(sender, message, type = 'misogi') {
        const logEntry = {
            sender: sender,
            message: message,
            type: type,
            time: new Date(),
            channel: this.chatLogData.currentChannel
        };

        this.chatLogData.messages.push(logEntry);
        this.renderChatLog();
    },

    renderChatLog() {
        const logContainer = document.getElementById('chat-history');
        if (!logContainer) return;

        const filter = this.chatLogData.filter;
        let entries = this.chatLogData.messages;

        if (filter === 'event') {
            entries = entries.filter(e => e.type === 'misogi');
        } else if (filter === 'call') {
            entries = entries.filter(e => e.type === 'team');
        }

        const recentEntries = entries.slice(-50);

        logContainer.innerHTML = recentEntries.map(entry => {
            const senderClass = `sender-${entry.sender}`;
            let senderLabel;
            if (entry.sender === 'misogi') senderLabel = 'MISOGI';
            else if (entry.sender === 'you') senderLabel = 'YOU';
            else if (entry.sender === 'team') senderLabel = entry.senderName || 'TEAM';
            else senderLabel = 'SYSTEM';

            return `<div class="chat-log-line"><span class="${senderClass}">${senderLabel}>></span> ${entry.message}</div>`;
        }).join('');

        logContainer.scrollTop = logContainer.scrollHeight;
    },

    filterChatLog(filter) {
        this.chatLogData.filter = filter;

        document.querySelectorAll('.chat-log-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
        });

        this.renderChatLog();
    },

    toggleChatLog() {
        const container = document.getElementById('chat-log-container');
        if (!container) return;

        this.chatLogData.visible = !this.chatLogData.visible;
        container.classList.toggle('hidden', !this.chatLogData.visible);
    },

    // ========================================
    // UI Helper Functions
    // ========================================

    switchMode(mode) {
        this.currentMode = mode;
        const btnVoice = document.getElementById('btn-voice-mode');
        const btnChat = document.getElementById('btn-chat-mode');
        const chatContainer = document.getElementById('chat-container');
        const voiceContent = document.getElementById('voice-content');
        const visualizer = document.querySelector('.visualizer-container');
        const textInput = document.getElementById('text-input');

        if (mode === 'voice') {
            if (btnVoice) btnVoice.classList.add('active');
            if (btnChat) btnChat.classList.remove('active');
            if (chatContainer) chatContainer.classList.remove('active');
            if (voiceContent) {
                voiceContent.classList.remove('hidden');
                voiceContent.style.display = 'flex';
            }
            if (visualizer) visualizer.style.transform = 'translate(-50%, -50%) scale(1)';
        } else {
            if (btnChat) btnChat.classList.add('active');
            if (btnVoice) btnVoice.classList.remove('active');
            if (voiceContent) voiceContent.classList.add('hidden');
            if (chatContainer) chatContainer.classList.add('active');
            if (textInput) textInput.focus();
            if (visualizer) visualizer.style.transform = 'translate(-50%, -50%) scale(0.8)';
        }
    },

    renderActionButtons(buttons, containerId = 'action-buttons-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = buttons.map(btn => {
            const style = btn.style || 'background: linear-gradient(135deg, var(--accent-color), #2563eb);';
            return `
                <button onclick="${btn.action}" style="${style} color: #fff; border: none; border-radius: 12px; padding: 12px 24px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px var(--accent-glow); transition: all 0.3s;">
                    ${btn.icon ? `<i class="fas ${btn.icon}"></i>` : ''}
                    ${btn.label}
                </button>
            `;
        }).join('');
    },

    // ========================================
    // Job Type Functions
    // ========================================

    setJobType(jobKey) {
        this.currentJobType = jobKey;
        localStorage.setItem('current_job_type', jobKey);

        // Remove all job classes
        document.body.classList.remove('job-cleaning', 'job-office', 'job-sales', 'job-hr', 'job-accounting', 'job-admin', 'job-dev');
        // Add new job class
        document.body.classList.add(`job-${jobKey}`);

        // Update floating button
        const floatingLabel = document.getElementById('floating-job-label');
        if (floatingLabel && this.JOB_TYPES[jobKey]) {
            floatingLabel.textContent = this.JOB_TYPES[jobKey].label;
        }
    },

    filterSidebar(jobKey) {
        const sidebar = document.getElementById('admin-sidebar');
        if (!sidebar) return;

        sidebar.style.display = 'flex';
        const menuItems = sidebar.querySelectorAll('.sidebar-item, .sidebar-sub-item');

        menuItems.forEach(item => {
            const allowedJobs = item.dataset.jobs;
            if (!allowedJobs) {
                item.style.display = '';
            } else {
                const jobs = allowedJobs.split(',');
                item.style.display = jobs.includes(jobKey) ? '' : 'none';
            }
        });
    },

    /**
     * Cinematic Job Transition
     * 1. Hide contents 2. Flicker label 3. Glitch 4. CRT Blackout 5. Redirect
     */
    performJobTransition(jobKey, basePath = '../', targetUrl = '') {
        console.log('[EntranceCore] TRANSITION TRIGGERED:', jobKey);
        const job = this.JOB_TYPES[jobKey];
        if (!job) return;

        localStorage.setItem('current_job_type', jobKey);

        const overlay = document.getElementById('job-change-overlay');
        const label = document.getElementById('job-change-label');
        const mainContent = document.getElementById('main') || document.querySelector('.main-content');
        const visualizerContainer = document.querySelector('.visualizer-container');

        // --- 1. Content Alpha-Out (0s) ---
        const uiElements = [
            document.getElementById('admin-sidebar'),
            document.querySelector('.admin-sidebar'),
            document.querySelector('.chat-log-container'),
            document.querySelector('.mode-switch-container'),
            document.querySelector('.latest-message-container'),
            document.getElementById('action-buttons-container'),
            document.getElementById('chat-input-wrapper'),
            document.getElementById('floating-job-btn')
        ];
        uiElements.forEach(el => {
            if (el) {
                el.classList.add('transitioning-out');
                console.log('[EntranceCore] Hiding UI element:', el.id || el.className);
            }
        });

        // Focus Visualizer
        if (visualizerContainer) {
            visualizerContainer.style.transform = 'translate(-50%, -50%) scale(1.1)';
            visualizerContainer.style.filter = 'brightness(1.5)';
            visualizerContainer.style.transition = 'all 2s cubic-bezier(0.16, 1, 0.3, 1)';
        }

        // --- 2. CHANGE JOB entry after a pause (1.0s) ---
        setTimeout(() => {
            if (overlay && label) {
                console.log('[EntranceCore] Showing label flicker animation');
                overlay.classList.add('active');
                overlay.style.background = 'transparent'; // CRITICAL: Keep transparent to see CRT
                label.textContent = 'CHANGE JOB';
                label.classList.add('flicker');
                setTimeout(() => {
                    console.log('[EntranceCore] Activating secondary vibration');
                    label.classList.add('flicker-active');
                }, 800);
            } else {
                console.error('[EntranceCore] Overlay or Label elements not found!');
            }
        }, 1000);

        // --- 3. Digital Glitch & Scanline reinforcement (2.2s) ---
        setTimeout(() => {
            console.log('[EntranceCore] Triggering digital glitch/scanlines');
            const glitch = document.createElement('div');
            glitch.className = 'glitch-overlay glitch-active';
            document.body.appendChild(glitch);
            if (visualizerContainer) visualizerContainer.style.filter = 'hue-rotate(180deg) brightness(2)';
            setTimeout(() => glitch.remove(), 800);
        }, 2200);

        // --- 4. CRT Blackout (3.0s Start - プツン) ---
        setTimeout(() => {
            console.log('[EntranceCore] CRT COLLAPSE START');
            if (mainContent) {
                mainContent.classList.add('crt-off');
            } else {
                console.warn('[EntranceCore] Main content not found for CRT collapse');
            }

            // Wait for crt-off to almost finish before painting background black
            setTimeout(() => {
                if (overlay) {
                    overlay.style.background = '#000';
                    console.log('[EntranceCore] BLACKOUT PAINTED');
                }
            }, 550);

            if (label) {
                label.classList.remove('flicker', 'flicker-active');
                label.style.opacity = '0';
            }
        }, 3000);

        // --- 5. Transition (4.0s) ---
        setTimeout(() => {
            console.log('[EntranceCore] REDIRECTING NOW');
            window.location.href = targetUrl || `${basePath}entrance/${jobKey}/`;
        }, 4000);
    },

    initFadeIn() {
        console.log('[EntranceCore] INITIALIZING FADE-IN');
        document.body.classList.add('fade-in-entrance');
    },

    // ========================================
    // Status UI (Attendance + Menu)
    // ========================================

    initStatusUI() {
        // Sync job type from URL
        const urlJob = this.getCurrentJobFromUrl();
        if (urlJob) {
            this.setJobType(urlJob);
        } else {
            // If on main entrance, we might want to clear or handle differently
            // but for now, let it be null or from storage if needed.
            const saved = localStorage.getItem('current_job_type');
            if (saved) this.setJobType(saved);
        }

        // Create attendance indicator
        this.createAttendanceIndicator();
        // Create menu button
        this.createMenuButton();
        // Check attendance status
        this.checkAndUpdateAttendance();
    },

    createAttendanceIndicator() {
        if (document.getElementById('attendance-status-tag')) return;

        const tag = document.createElement('div');
        tag.id = 'attendance-status-tag';
        tag.className = 'attendance-status-tag';
        tag.innerHTML = `
            <div class="tag-dot"></div>
            <span class="tag-text">未出勤</span>
        `;
        document.body.appendChild(tag);
    },

    createMenuButton() {
        if (document.getElementById('entrance-menu-btn')) return;

        const menuBtn = document.createElement('button');
        menuBtn.id = 'entrance-menu-btn';
        menuBtn.className = 'entrance-menu-btn';
        menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        menuBtn.onclick = () => this.toggleMenuOverlay();
        document.body.appendChild(menuBtn);

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'entrance-menu-overlay';
        overlay.className = 'entrance-menu-overlay';
        overlay.innerHTML = `
            <div class="entrance-menu-container">
                <div class="entrance-menu-header">
                    <div class="entrance-menu-tabs">
                        <button class="entrance-menu-tab active" data-tab="daily-report" onclick="EntranceCore.switchMenuTab('daily-report')">
                            <i class="fas fa-clipboard-list"></i> 日報
                        </button>
                        <button class="entrance-menu-tab" data-tab="todos" onclick="EntranceCore.switchMenuTab('todos')">
                            <i class="fas fa-tasks"></i> TODO
                        </button>
                    </div>
                    <button class="entrance-menu-close" onclick="EntranceCore.closeMenuOverlay()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="entrance-menu-content">
                    <div id="menu-tab-daily-report" class="entrance-menu-tab-content active">
                        <div class="menu-loading"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>
                    </div>
                    <div id="menu-tab-todos" class="entrance-menu-tab-content">
                        <div class="menu-loading"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>
                    </div>
                </div>
            </div>
        `;
        overlay.onclick = (e) => {
            if (e.target === overlay) this.closeMenuOverlay();
        };
        document.body.appendChild(overlay);

        // Add styles
        this.injectStatusStyles();
    },

    injectStatusStyles() {
        if (document.getElementById('entrance-status-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'entrance-status-styles';
        styles.textContent = `
            /* Attendance Status Tag - 16x16 non-interactive */
            .attendance-status-tag {
                position: fixed;
                top: 8px;
                left: 8px;
                z-index: 1500;
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(107, 114, 128, 0.5);
                border-radius: 3px;
                font-size: 9px;
                font-weight: 700;
                color: rgba(255, 255, 255, 0.6);
                pointer-events: none;
            }
            .attendance-status-tag.clocked-in {
                background: rgba(16, 185, 129, 0.6);
                color: #fff;
            }
            .attendance-status-tag.on-break {
                background: rgba(245, 158, 11, 0.6);
                color: #fff;
            }

            /* Menu Button - Compact */
            .entrance-menu-btn {
                position: fixed;
                top: 10px;
                right: 12px;
                z-index: 1500;
                width: 28px;
                height: 28px;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 50%;
                color: rgba(255, 255, 255, 0.7);
                font-size: 0.75rem;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .entrance-menu-btn:hover {
                background: rgba(0, 0, 0, 0.8);
                border-color: rgba(255, 255, 255, 0.2);
                color: #fff;
            }

            /* Menu Overlay */
            .entrance-menu-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                z-index: 2000;
                display: none;
                align-items: center;
                justify-content: center;
            }
            .entrance-menu-overlay.active {
                display: flex;
            }
            .entrance-menu-container {
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                background: #1a1a2e;
                border-radius: 16px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .entrance-menu-header {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                background: rgba(0, 0, 0, 0.3);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .entrance-menu-tabs {
                display: flex;
                gap: 8px;
                flex: 1;
            }
            .entrance-menu-tab {
                padding: 8px 16px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                color: #888;
                cursor: pointer;
                font-size: 0.85rem;
                transition: all 0.2s;
            }
            .entrance-menu-tab:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }
            .entrance-menu-tab.active {
                background: var(--accent-color, #3b82f6);
                border-color: var(--accent-color, #3b82f6);
                color: #fff;
            }
            .entrance-menu-close {
                background: none;
                border: none;
                color: #888;
                font-size: 1.2rem;
                cursor: pointer;
                padding: 8px;
            }
            .entrance-menu-close:hover {
                color: #fff;
            }
            .entrance-menu-content {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }
            .entrance-menu-tab-content {
                display: none;
            }
            .entrance-menu-tab-content.active {
                display: block;
            }
            .menu-loading {
                text-align: center;
                color: rgba(255, 255, 255, 0.5);
                padding: 40px;
            }
            .menu-item {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 14px;
                margin-bottom: 10px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .menu-item:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.2);
            }
            .menu-item-title {
                font-weight: 600;
                color: #fff;
                margin-bottom: 4px;
            }
            .menu-item-meta {
                font-size: 0.75rem;
                color: rgba(255, 255, 255, 0.5);
            }
            .todo-checkbox {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                border: 2px solid rgba(255, 255, 255, 0.3);
                margin-right: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }
            .todo-checkbox.completed {
                background: #10b981;
                border-color: #10b981;
            }
            .todo-item {
                display: flex;
                align-items: center;
            }
            .todo-item.completed .menu-item-title {
                text-decoration: line-through;
                opacity: 0.5;
            }
            .empty-state {
                text-align: center;
                color: rgba(255, 255, 255, 0.4);
                padding: 40px 20px;
            }
            .empty-state i {
                font-size: 2rem;
                margin-bottom: 12px;
                opacity: 0.3;
            }

            @media (max-width: 768px) {
                .attendance-status-indicator {
                    top: 12px;
                    right: 56px;
                    padding: 6px 10px;
                    font-size: 0.7rem;
                }
                .entrance-menu-btn {
                    top: 12px;
                    right: 12px;
                    width: 32px;
                    height: 32px;
                }
            }
        `;
        document.head.appendChild(styles);
    },

    async checkAndUpdateAttendance() {
        const user = this.getUser();
        const token = this.getToken();
        if (!user.id || !token) return;

        try {
            const response = await fetch(`${this.API_BASE}/attendance?staff_id=${user.id || user.sub}&limit=1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const records = Array.isArray(data) ? data : (data.attendance || data.items || []);
                const latest = records[0];

                if (latest && latest.clock_in && !latest.clock_out) {
                    this.updateAttendanceIndicator('clocked-in', latest.clock_in);
                    window.currentAttendanceRecord = latest;
                } else {
                    this.updateAttendanceIndicator('not-clocked');
                }
            }
        } catch (e) {
            console.error('Attendance check failed:', e);
        }
    },

    updateAttendanceIndicator(status, clockInTime) {
        const tag = document.getElementById('attendance-status-tag');
        if (!tag) return;

        tag.classList.remove('clocked-in', 'on-break');

        if (status === 'clocked-in') {
            tag.classList.add('clocked-in');
            tag.querySelector('.tag-text').textContent = '出勤中';
        } else if (status === 'on-break') {
            tag.classList.add('on-break');
            tag.querySelector('.tag-text').textContent = '休憩中';
        } else {
            tag.querySelector('.tag-text').textContent = '未出勤';
        }
    },

    toggleAttendanceMenu() {
        // For now, just show a simple info
        alert('出勤管理機能はMISOGIに話しかけてください。');
    },

    toggleMenuOverlay() {
        const overlay = document.getElementById('entrance-menu-overlay');
        if (overlay) {
            overlay.classList.add('active');
            this.loadDailyReports();
            this.loadTodos();
        }
    },

    closeMenuOverlay() {
        const overlay = document.getElementById('entrance-menu-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    switchMenuTab(tab) {
        document.querySelectorAll('.entrance-menu-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        document.querySelectorAll('.entrance-menu-tab-content').forEach(c => {
            c.classList.toggle('active', c.id === `menu-tab-${tab}`);
        });
    },

    async loadDailyReports() {
        const container = document.getElementById('menu-tab-daily-report');
        if (!container) return;

        const user = this.getUser();
        const token = this.getToken();

        try {
            const response = await fetch(`${this.API_BASE}/daily-reports?staff_id=${user.id || user.sub}&limit=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                const reports = Array.isArray(data) ? data : (data.reports || data.items || []);

                if (reports.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-clipboard-list"></i>
                            <div>日報がありません</div>
                        </div>
                    `;
                } else {
                    container.innerHTML = reports.map(r => `
                        <div class="menu-item" onclick="window.open('/admin/daily-reports/${r.id}', '_blank')">
                            <div class="menu-item-title">${r.date || r.report_date || '日付不明'}</div>
                            <div class="menu-item-meta">${r.summary || r.content?.substring(0, 50) || '内容なし'}...</div>
                        </div>
                    `).join('');
                }
            } else {
                container.innerHTML = '<div class="empty-state">読み込みに失敗しました</div>';
            }
        } catch (e) {
            console.error('Failed to load daily reports:', e);
            container.innerHTML = '<div class="empty-state">読み込みに失敗しました</div>';
        }
    },

    async loadTodos() {
        const container = document.getElementById('menu-tab-todos');
        if (!container) return;

        const user = this.getUser();
        const token = this.getToken();

        try {
            const response = await fetch(`${this.API_BASE}/todos?staff_id=${user.id || user.sub}&limit=20`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                const todos = Array.isArray(data) ? data : (data.todos || data.items || []);

                if (todos.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-tasks"></i>
                            <div>TODOがありません</div>
                        </div>
                    `;
                } else {
                    container.innerHTML = todos.map(t => `
                        <div class="menu-item todo-item ${t.completed || t.status === 'completed' ? 'completed' : ''}" onclick="EntranceCore.toggleTodo('${t.id}')">
                            <div class="todo-checkbox ${t.completed || t.status === 'completed' ? 'completed' : ''}">
                                ${t.completed || t.status === 'completed' ? '<i class="fas fa-check" style="color:#fff;font-size:0.7rem;"></i>' : ''}
                            </div>
                            <div>
                                <div class="menu-item-title">${t.title || t.content || 'タイトルなし'}</div>
                                <div class="menu-item-meta">${t.due_date ? `期限: ${t.due_date}` : ''}</div>
                            </div>
                        </div>
                    `).join('');
                }
            } else {
                container.innerHTML = '<div class="empty-state">読み込みに失敗しました</div>';
            }
        } catch (e) {
            console.error('Failed to load todos:', e);
            container.innerHTML = '<div class="empty-state">読み込みに失敗しました</div>';
        }
    },

    async toggleTodo(todoId) {
        const token = this.getToken();
        try {
            await fetch(`${this.API_BASE}/todos/${todoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ completed: true })
            });
            this.loadTodos();
        } catch (e) {
            console.error('Failed to toggle todo:', e);
        }
    },

    toggleChatLog() {
        const container = document.getElementById('chat-log-container');
        if (container) {
            container.classList.toggle('hidden');
            const isHidden = container.classList.contains('hidden');
            localStorage.setItem('chatLogHidden', isHidden);

            // Toggle active state on the button
            const btn = document.getElementById('chat-toggle-btn');
            if (btn) {
                btn.style.background = isHidden ? 'var(--panel-bg)' : 'var(--accent-color)';
                btn.style.color = isHidden ? 'var(--text-primary)' : '#fff';
            }
        }
    }
};

// Export for global access
window.EntranceCore = EntranceCore;

// Auto-initialize status UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.EntranceCore) {
            window.EntranceCore.initStatusUI();
        }
    }, 500);
});
