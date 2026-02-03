/**
 * Misogi Report Assistant
 * integrated into Report Creation Page
 */
export class ReportAssistant {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isOpen = false;
    }

    init() {
        console.log('[ReportAssistant] Initializing...');
        this.renderUI();
        this.bindEvents();
    }

    renderUI() {
        // FAB
        const fab = document.createElement('div');
        fab.className = 'report-assistant-fab';
        fab.id = 'report-assistant-fab';
        fab.innerHTML = `
            <img src="/images/misogi-logo-icon.svg" alt="AI">
            <div class="notification-dot"></div>
        `;
        document.body.appendChild(fab);

        // Overlay
        const overlay = document.createElement('div');
        overlay.className = 'report-assistant-overlay';
        overlay.id = 'report-assistant-overlay';
        overlay.innerHTML = `
            <div class="assistant-header">
                <div class="assistant-title">
                    <img src="/images/misogi-logo-icon.svg" alt="icon">
                    <span>M.I.S.O.G.I. Assistant</span>
                </div>
                <button class="assistant-close-btn" id="assistant-close-btn"><i class="fas fa-times"></i></button>
            </div>
            
            <div class="assistant-chat-area" id="assistant-chat-area">
                <div class="chat-message ai">
                    <div class="avatar ai"><img src="/images/misogi-logo-icon.svg"></div>
                    <div class="bubble">
                        お疲れ様です。レポート作成のお手伝いをします。<br>
                        「床清掃を追加して」「写真を見てコメントを考えて」など、お気軽にご相談ください。
                    </div>
                </div>
            </div>

            <div class="assistant-input-area">
                <div class="preview-area" id="assistant-preview-area"></div>
                <div class="input-wrapper">
                    <button class="action-btn" id="assistant-attach-btn"><i class="fas fa-plus"></i></button>
                    <input type="text" id="assistant-input" placeholder="メッセージを入力..." autocomplete="off">
                    <button class="action-btn mic-btn" id="assistant-mic-btn"><i class="fas fa-microphone"></i></button>
                    <button class="action-btn send-btn" id="assistant-send-btn"><i class="fas fa-paper-plane"></i></button>
                </div>
                <!-- Hidden file input -->
                <input type="file" id="assistant-file-input" accept="image/*" style="display: none;">
            </div>
        `;
        document.body.appendChild(overlay);

        this.elements = {
            fab: document.getElementById('report-assistant-fab'),
            overlay: document.getElementById('report-assistant-overlay'),
            closeBtn: document.getElementById('assistant-close-btn'),
            chatArea: document.getElementById('assistant-chat-area'),
            input: document.getElementById('assistant-input'),
            sendBtn: document.getElementById('assistant-send-btn'),
            micBtn: document.getElementById('assistant-mic-btn'),
            attachBtn: document.getElementById('assistant-attach-btn'),
            fileInput: document.getElementById('assistant-file-input'),
            previewArea: document.getElementById('assistant-preview-area')
        };
    }

    bindEvents() {
        const els = this.elements;
        if (!els.fab) return;

        // Toggle Open/Close
        els.fab.addEventListener('click', () => this.toggleOpen(true));
        els.closeBtn.addEventListener('click', () => this.toggleOpen(false));

        // Input Handling
        els.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSend();
        });
        els.sendBtn.addEventListener('click', () => this.handleSend());

        // Attach
        els.attachBtn.addEventListener('click', () => els.fileInput.click());
        els.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Mic
        els.micBtn.addEventListener('click', () => this.toggleRecording());
    }

    toggleOpen(isOpen) {
        this.isOpen = isOpen;
        const els = this.elements;
        if (isOpen) {
            els.overlay.classList.add('active');
            els.fab.style.display = 'none';
        } else {
            els.overlay.classList.remove('active');
            setTimeout(() => els.fab.style.display = 'flex', 300);
        }
    }

    appendMessage(role, text, mediaHtml = '') {
        const div = document.createElement('div');
        div.className = `chat-message ${role}`;

        let content = '';
        if (role === 'ai') {
            content = `
                <div class="avatar ai"><img src="/images/misogi-logo-icon.svg"></div>
                <div class="bubble">${text}${mediaHtml}</div>
            `;
        } else {
            content = `
                <div class="bubble">${text}${mediaHtml}</div>
                <div class="avatar user"><i class="fas fa-user"></i></div>
            `;
        }
        div.innerHTML = content;
        this.elements.chatArea.appendChild(div);
        this.elements.chatArea.scrollTop = this.elements.chatArea.scrollHeight;
        return div;
    }

    toggleLoading(show) {
        if (show) {
            this.loadingDiv = this.appendMessage('ai', '<i class="fas fa-spinner fa-spin"></i> 考え中...');
        } else {
            if (this.loadingDiv) this.loadingDiv.remove();
        }
    }

    // --- File Handling ---
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Show preview
        const reader = new FileReader();
        reader.onload = (evt) => {
            this.elements.previewArea.innerHTML = `
                <div class="preview-item">
                    <img src="${evt.target.result}">
                    <button class="preview-remove"><i class="fas fa-times"></i></button>
                </div>
            `;
            this.elements.previewArea.classList.add('has-content');

            // Remove handler
            this.elements.previewArea.querySelector('.preview-remove').onclick = () => {
                this.elements.previewArea.innerHTML = '';
                this.elements.previewArea.classList.remove('has-content');
                this.elements.fileInput.value = '';
            };
        };
        reader.readAsDataURL(file);
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // --- Auth ---
    getHeaders() {
        const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // --- Core Logic ---
    async handleSend(audioBlob = null) {
        const text = this.elements.input.value.trim();
        const file = this.elements.fileInput.files[0];

        if (!text && !file && !audioBlob) return;

        // UI Updates
        let mediaHtml = '';
        let imageBase64 = null;
        let imageMime = null;
        let audioBase64 = null;

        // Process Inputs
        if (file) {
            try {
                imageBase64 = await this.fileToBase64(file);
                imageMime = file.type;
                mediaHtml += `<br><img src="${URL.createObjectURL(file)}" style="max-width:100px; border-radius:8px; margin-top:8px;">`;

                // Clear Preview interaction
                this.elements.previewArea.innerHTML = '';
                this.elements.previewArea.classList.remove('has-content');
                this.elements.fileInput.value = '';
            } catch (e) { console.error(e); }
        }

        if (audioBlob) {
            mediaHtml += `<br><div style="font-size:0.8rem; color:#eee;">(音声入力)</div>`;
            try {
                audioBase64 = await this.blobToBase64(audioBlob);
            } catch (e) { console.error(e); }
        }

        // Show User Message
        const displayMessage = text || (audioBlob ? '...' : '');
        this.appendMessage('user', displayMessage, mediaHtml);
        this.elements.input.value = '';

        // API Call
        this.toggleLoading(true);

        try {
            const body = {
                action: 'report_assistant',
                text: audioBlob ? '' : text
            };

            if (audioBase64) {
                body.audio = audioBase64;
                body.mime_type = 'audio/webm';
            }
            if (imageBase64) {
                body.image = imageBase64;
                body.image_mime = imageMime;
                // If text is empty but image exists, provide a default instruction
                if (!body.text) body.text = "この画像を解析してレポート項目を提案してください。";
            }

            const response = await fetch(`${this.API_BASE}/ai/process`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();

            let result = data.result;
            // Handle parsing if result comes as string (should be object if JSON mode works, but safe to check)
            if (typeof result === 'string') {
                try {
                    // Try to extract JSON from markdown code blocks or raw text
                    const jsonMatch = result.match(/\{[\s\S]*\}/);
                    if (jsonMatch) result = JSON.parse(jsonMatch[0]);
                } catch (e) { /* ignore */ }
            }

            if (result.reply || result.actions) {
                this.handleAIResponse(result);
            } else {
                this.appendMessage('ai', typeof result === 'string' ? result : JSON.stringify(result));
            }

        } catch (e) {
            console.error(e);
            this.appendMessage('ai', 'エラーが発生しました。');
        } finally {
            this.toggleLoading(false);
        }
    }

    handleAIResponse(data) {
        const reply = data.reply || "承知しました。";
        this.appendMessage('ai', reply);

        if (data.actions && Array.isArray(data.actions)) {
            data.actions.forEach(action => {
                if (action.type === 'addSection') {
                    // Map AI section types to Report types
                    // 'cleaning' -> 'cleaning'
                    // 'image_before_after' -> 'image' (with layoutMode)

                    if (action.sectionType === 'cleaning') {
                        this.stateManager.addSection(this.stateManager.state.activeTab, {
                            type: 'cleaning',
                            item_name: action.data.item_name || '新規項目',
                            comments: action.data.comments || [],
                            haccp_info: action.data.haccp_info || {}
                        });
                    } else if (action.sectionType === 'image_before_after') {
                        const sectionId = this.stateManager.addSection(this.stateManager.state.activeTab, {
                            type: 'image',
                            item_name: '作業写真',
                            layoutMode: 'before_after'
                        });
                        // If AI provided image data to add, we would handle it here, but usually it just creates the section container
                    } else if (action.sectionType === 'image_completed') {
                        this.stateManager.addSection(this.stateManager.state.activeTab, {
                            type: 'image',
                            item_name: '完了写真',
                            layoutMode: 'completed'
                        });
                    }
                }
            });
        }
    }

    // --- Audio ---
    async toggleRecording() {
        if (this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.elements.micBtn.classList.remove('active');
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.mediaRecorder = new MediaRecorder(stream);
                this.audioChunks = [];

                this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
                this.mediaRecorder.onstop = () => {
                    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    this.handleSend(blob);
                };

                this.mediaRecorder.start();
                this.isRecording = true;
                this.elements.micBtn.classList.add('active');
            } catch (e) {
                console.error(e);
                alert('マイクを使用できません');
            }
        }
    }
}

/**
 * Schedule Assistant - スケジュール管理用AIアシスタント
 * Draggable overlay with visualizer (球体/粒子/波形)
 */
export class ScheduleAssistant {
    constructor(apiBase) {
        this.API_BASE = apiBase || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
        this.isOpen = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.currentStatus = 'normal'; // normal / warning / danger
        this.animationFrame = null;
        this.canvas = null;
        this.ctx = null;
    }

    init() {
        console.log('[ScheduleAssistant] Initializing...');
        this.renderUI();
        this.bindEvents();
        this.initVisualizer();
    }

    renderUI() {
        // Draggable Overlay
        const overlay = document.createElement('div');
        overlay.className = 'schedule-assistant-overlay';
        overlay.id = 'schedule-assistant-overlay';
        overlay.innerHTML = `
            <div class="schedule-assistant-header" id="schedule-assistant-header">
                <div class="schedule-assistant-title">
                    <span class="schedule-assistant-icon">⚡</span>
                    <span class="schedule-assistant-name">守護霊</span>
                </div>
                <button class="schedule-assistant-close-btn" id="schedule-assistant-close-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="schedule-assistant-visualizer-container">
                <canvas id="schedule-assistant-canvas" class="schedule-assistant-canvas"></canvas>
            </div>
            <div class="schedule-assistant-message" id="schedule-assistant-message">
                静かに見守っています...
            </div>
        `;
        document.body.appendChild(overlay);

        this.elements = {
            overlay: document.getElementById('schedule-assistant-overlay'),
            header: document.getElementById('schedule-assistant-header'),
            closeBtn: document.getElementById('schedule-assistant-close-btn'),
            canvas: document.getElementById('schedule-assistant-canvas'),
            message: document.getElementById('schedule-assistant-message')
        };
    }

    bindEvents() {
        const els = this.elements;
        if (!els.overlay) return;

        // Toggle Open/Close
        els.closeBtn.addEventListener('click', () => this.toggleOpen(false));

        // Dragging
        els.header.addEventListener('mousedown', (e) => this.startDrag(e));
        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('mouseup', () => this.endDrag());
    }

    startDrag(e) {
        this.isDragging = true;
        const rect = this.elements.overlay.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        this.elements.overlay.style.cursor = 'grabbing';
    }

    onDrag(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;
        this.elements.overlay.style.left = `${x}px`;
        this.elements.overlay.style.top = `${y}px`;
    }

    endDrag() {
        this.isDragging = false;
        if (this.elements.overlay) {
            this.elements.overlay.style.cursor = 'grab';
        }
    }

    initVisualizer() {
        this.canvas = this.elements.canvas;
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.animate();
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    animate() {
        if (!this.ctx || !this.canvas) return;
        this.animationFrame = requestAnimationFrame(() => this.animate());
        this.drawVisualizer();
    }

    drawVisualizer() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        ctx.clearRect(0, 0, width, height);

        const time = Date.now() * 0.001;
        const centerX = width / 2;
        const centerY = height / 2;

        // Status-based colors
        let color1, color2, particleColor;
        if (this.currentStatus === 'danger') {
            color1 = 'rgba(255, 80, 80, 0.3)';
            color2 = 'rgba(255, 120, 120, 0.2)';
            particleColor = 'rgba(255, 100, 100, 0.6)';
        } else if (this.currentStatus === 'warning') {
            color1 = 'rgba(255, 200, 80, 0.3)';
            color2 = 'rgba(255, 220, 120, 0.2)';
            particleColor = 'rgba(255, 210, 100, 0.6)';
        } else {
            color1 = 'rgba(100, 150, 255, 0.3)';
            color2 = 'rgba(120, 170, 255, 0.2)';
            particleColor = 'rgba(110, 160, 255, 0.6)';
        }

        // Sphere (球体)
        const sphereRadius = Math.min(width, height) * 0.15;
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sphereRadius);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, sphereRadius, 0, Math.PI * 2);
        ctx.fill();

        // Particles (粒子)
        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2 + time * 0.5;
            const radius = sphereRadius * 1.5;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            ctx.fillStyle = particleColor;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Waveform (波形)
        const waveAmplitude = 10;
        const waveFrequency = 2;
        ctx.strokeStyle = color2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < width; x += 2) {
            const y = centerY + Math.sin((x / width) * Math.PI * waveFrequency + time * 2) * waveAmplitude;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    toggleOpen(isOpen) {
        this.isOpen = isOpen;
        const els = this.elements;
        if (isOpen) {
            els.overlay.classList.add('active');
        } else {
            els.overlay.classList.remove('active');
        }
    }

    updateStatus(status) {
        this.currentStatus = status || 'normal';
        const els = this.elements;
        if (els.overlay) {
            els.overlay.className = `schedule-assistant-overlay status-${this.currentStatus}`;
        }
    }

    updateMessage(text) {
        const els = this.elements;
        if (els.message) {
            els.message.textContent = text || '静かに見守っています...';
        }
    }

    getHeaders() {
        const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    async processSchedule(selectedSchedule, rollingDays, visibleSchedules) {
        try {
            const body = {
                action: 'schedule_assistant',
                selected_schedule: selectedSchedule,
                rolling_days: rollingDays,
                visible_schedules: visibleSchedules
            };

            const response = await fetch(`${this.API_BASE}/ai/process`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            const result = data.result || {};

            // Update UI based on result
            this.updateStatus(result.status || 'normal');
            this.updateMessage(result.message || result.notes_summary || '静かに見守っています...');

            return result;
        } catch (e) {
            console.error('[ScheduleAssistant] Error:', e);
            this.updateStatus('normal');
            this.updateMessage('接続に失敗しました...');
            return null;
        }
    }

    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.elements.overlay) {
            this.elements.overlay.remove();
        }
    }
}
