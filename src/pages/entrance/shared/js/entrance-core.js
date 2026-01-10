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

    // ========================================
    // Authentication Functions
    // ========================================

    ensureAuthOrRedirect() {
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
    performJobTransition(jobKey, basePath = '../') {
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
                overlay.style.display = 'flex';
                overlay.style.opacity = '1';
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
            window.location.href = `${basePath}entrance/${jobKey}/`;
        }, 4000);
    },

    initFadeIn() {
        console.log('[EntranceCore] INITIALIZING FADE-IN');
        document.body.classList.add('fade-in-entrance');
    }
};

// Export for global access
window.EntranceCore = EntranceCore;
