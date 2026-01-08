
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
            const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const clockEl = document.getElementById('digital-clock-display');
            if (clockEl) clockEl.textContent = timeStr;

            // Also update todo clock if it exists
            const todoClock = document.getElementById('todo-clock-display');
            if (todoClock) todoClock.textContent = timeStr;
        };
        update();
        setInterval(update, 1000);
    }

    updateDateDisplay() {
        const dateEl = document.getElementById('daily-report-today-date');
        if (dateEl) {
            const now = new Date();
            const dateStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
            dateEl.textContent = dateStr;
        }
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
            listEl.innerHTML = '<li class="todo-item empty">タスクはありません</li>';
            return;
        }

        listEl.innerHTML = '';
        this.todoList.forEach(item => {
            const li = document.createElement('li');
            li.className = `todo-item ${item.completed ? 'completed' : ''}`;
            li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;';

            li.innerHTML = `
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1;">
                    <input type="checkbox" ${item.completed ? 'checked' : ''}>
                    <span style="font-size: 0.95rem; color: #333;">${this.escapeHtml(item.text)}</span>
                </label>
                <button class="delete-btn" style="background: none; border: none; color: #ccc; cursor: pointer; padding: 4px;">
                    <i class="fas fa-times"></i>
                </button>
            `;

            // Events
            const checkbox = li.querySelector('input');
            checkbox.onchange = () => this.toggleTodoItem(item.id);

            const delBtn = li.querySelector('.delete-btn');
            delBtn.onclick = () => this.deleteTodoItem(item.id);

            listEl.appendChild(li);
        });

        // Update count if exists
        const countEl = document.getElementById('todo-count');
        if (countEl) countEl.textContent = this.todoList.filter(t => !t.completed).length;
    }

    // --- Daily Report Logic (Mock/Simple) ---
    saveDailyReport() {
        const content = document.getElementById('daily-report-content')?.value;
        if (!content) return;

        // In a real app, send to API. Here we just show a toast or message.
        // We can hook into the global 'appendChatMessage' if available to show AI confirmation
        if (window.appendChatMessage) {
            window.appendChatMessage('ai', '日報を下書き保存しました。（※実際の送信機能は実装中です）');
        } else {
            alert('日報を保存しました');
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }
}
