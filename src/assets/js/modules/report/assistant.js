/**
 * Misogi Report Assistant
 * integrated into Report Creation Page
 */
export class ReportAssistant {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/staff';
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
