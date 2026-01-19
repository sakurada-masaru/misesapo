
export class DashboardController {
    constructor() {
        this.todoList = [];
        this.STORAGE_KEY_TODO = 'misesapo_todo_list';
    }

    init() {
        this.initClock();
        this.loadTodoList();
        this.setupEventListeners();
        this.updateDateDisplay();
    }

    initClock() {
        const update = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

            const clockEl = document.getElementById('digital-clock-display');
            if (clockEl) clockEl.textContent = timeStr;

            const headerTimeEl = document.getElementById('header-time-display');
            if (headerTimeEl) headerTimeEl.textContent = timeStr;
        };
        update();
        setInterval(update, 1000);
    }

    updateDateDisplay() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

        // Target main card date
        const dateEl = document.getElementById('date-display-main');
        if (dateEl) dateEl.textContent = dateStr;

        // Target report header date
        const reportDateEl = document.getElementById('report-date-display');
        if (reportDateEl) reportDateEl.textContent = dateStr;
    }

    setupEventListeners() {
        // Todo Add Button
        const addTodoBtn = document.getElementById('add-todo-btn');
        const todoInput = document.getElementById('todo-input');

        if (addTodoBtn && todoInput) {
            const addHandler = () => {
                const text = todoInput.value.trim();
                if (text) {
                    this.addTodoItem(text);
                    todoInput.value = '';
                }
            };
            addTodoBtn.onclick = addHandler;
            todoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addHandler();
            });
        }

        // Daily Report Save
        const saveReportBtn = document.getElementById('daily-report-save-btn');
        if (saveReportBtn) {
            saveReportBtn.onclick = () => this.saveDailyReport();
        }
    }

    // --- TODO Logic ---
    loadTodoList() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY_TODO);
            this.todoList = stored ? JSON.parse(stored) : [];
            this.renderTodoList();
        } catch (e) {
            console.error("Failed to load todos", e);
        }
    }

    saveTodoList() {
        localStorage.setItem(this.STORAGE_KEY_TODO, JSON.stringify(this.todoList));
        this.renderTodoList();
    }

    addTodoItem(text) {
        this.todoList.push({
            id: Date.now().toString(),
            text: text,
            completed: false,
            created_at: new Date().toISOString()
        });
        this.saveTodoList();
    }

    toggleTodoItem(id) {
        const item = this.todoList.find(t => t.id === id);
        if (item) {
            item.completed = !item.completed;
            this.saveTodoList();
        }
    }

    deleteTodoItem(id) {
        this.todoList = this.todoList.filter(t => t.id !== id);
        this.saveTodoList();
    }

    renderTodoList() {
        const listEl = document.getElementById('todo-list');
        if (!listEl) return;

        if (this.todoList.length === 0) {
            listEl.innerHTML = '<div class="empty-state">All tasks completed</div>';
            return;
        }

        listEl.innerHTML = '';
        this.todoList.forEach(item => {
            const div = document.createElement('div');
            div.className = `list-item ${item.completed ? 'completed' : ''}`;
            // Use flex layout matching the new CSS
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; opacity: ' + (item.completed ? '0.5' : '1');

            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer;">
                    <i class="far ${item.completed ? 'fa-check-square' : 'fa-square'}" style="color:var(--theme-color);"></i>
                    <span style="${item.completed ? 'text-decoration: line-through;' : ''}">${this.escapeHtml(item.text)}</span>
                </div>
                <button class="delete-btn" style="background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer;">
                    <i class="fas fa-times"></i>
                </button>
            `;

            // Events
            const labelArea = div.querySelector('div');
            labelArea.onclick = () => this.toggleTodoItem(item.id);

            const delBtn = div.querySelector('.delete-btn');
            delBtn.onclick = () => this.deleteTodoItem(item.id);

            listEl.appendChild(div);
        });
    }

    // --- Daily Report Logic ---
    saveDailyReport() {
        const content = document.getElementById('daily-report-content')?.value;
        if (!content) return;

        // Mock feedback
        // If app.addMessage is available globally (via entrance.html scope), we could use it, 
        // but this controller is a module. The user will see a simple alert for now or we can try to find the 'app' object if attached to window.

        // Try to verify if we can access the global app object
        // But since app is defined in a non-module script in entrance.html, it is on window.
        // Wait, app is defined in <script> in entrance.html.

        if (content) {
            const btn = document.getElementById('daily-report-save-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> SAVED';
            setTimeout(() => { btn.innerHTML = originalText; }, 2000);
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }
}
