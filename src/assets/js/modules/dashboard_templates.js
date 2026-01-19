export const STAFF_DASHBOARD_HTML = `
<style>
    /* Dark Glass Modern Dashboard Styles */
    .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        grid-template-rows: auto 1fr;
        gap: 20px;
        height: 100%;
        max-width: 1400px;
        margin: 0 auto;
        padding-bottom: 80px; /* Space for Dock */
        color: #fff;
    }

    .dashboard-header {
        grid-column: 1 / -1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding: 0 10px;
    }
    .header-title h2 {
        font-size: 1.8rem;
        font-weight: 200;
        letter-spacing: 2px;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 15px;
    }
    .header-title i { color: var(--theme-color); }
    .header-time {
        font-family: 'Inter', monospace;
        font-size: 1.2rem;
        color: rgba(255,255,255,0.6);
        background: rgba(255,255,255,0.05);
        padding: 8px 16px;
        border-radius: 30px;
        border: 1px solid rgba(255,255,255,0.1);
    }

    /* Cards */
    .glass-card {
        background: rgba(20, 20, 30, 0.6);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 20px;
        padding: 24px;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
        transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s;
    }
    .glass-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 15px 50px rgba(0,0,0,0.3);
        border-color: rgba(255,255,255,0.15);
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        padding-bottom: 10px;
    }
    .card-title {
        font-size: 1rem;
        font-weight: 500;
        letter-spacing: 1px;
        color: rgba(255,255,255,0.9);
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .card-title i { color: var(--theme-color); font-size: 1.1rem; }

    /* Layout specific */
    .col-left { grid-column: span 3; display: flex; flex-direction: column; gap: 20px; }
    .col-center { grid-column: span 6; display: flex; flex-direction: column; gap: 20px; }
    .col-right { grid-column: span 3; display: flex; flex-direction: column; gap: 20px; }

    @media (max-width: 1024px) {
        .col-left { grid-column: span 6; }
        .col-center { grid-column: span 12; order: -1; }
        .col-right { grid-column: span 6; }
    }
    @media (max-width: 768px) {
        .dashboard-grid { display: flex; flex-direction: column; }
        .header-time { display: none; }
    }

    /* Components Styles */
    /* Clock */
    .digital-clock-display {
        font-size: 3rem;
        font-weight: 700;
        text-align: center;
        font-family: 'Inter', monospace;
        background: -webkit-linear-gradient(90deg, #fff, rgba(255,255,255,0.5));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 10px 0;
    }
    .date-display {
        text-align: center;
        color: rgba(255,255,255,0.5);
        font-size: 0.9rem;
        margin-bottom: 20px;
    }

    /* Attendance Btn */
    .btn-attendance {
        width: 100%;
        padding: 15px;
        border-radius: 12px;
        border: none;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.3s;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
        background: linear-gradient(135deg, var(--theme-color), #2563eb);
        color: white;
        box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);
    }
    .btn-attendance:hover {
        transform: scale(1.02);
        box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
    }
    .btn-attendance:disabled {
        background: rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.3);
        box-shadow: none;
        cursor: not-allowed;
    }

    /* Daily Report */
    .daily-report-textarea {
        width: 100%;
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 15px;
        color: #fff;
        font-size: 0.95rem;
        line-height: 1.6;
        resize: none;
        min-height: 300px;
        font-family: 'Zen Kaku Gothic New', sans-serif;
        outline: none;
        transition: border-color 0.3s;
    }
    .daily-report-textarea:focus { border-color: var(--theme-color); }
    .report-footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 15px;
    }
    .btn-save {
        background: rgba(255,255,255,0.1);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.2);
        padding: 8px 20px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
    }
    .btn-save:hover { background: var(--theme-color); border-color: var(--theme-color); }

    /* Todo & Announcements */
    .list-item {
        padding: 12px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        color: rgba(255,255,255,0.8);
        font-size: 0.9rem;
    }
    .list-item:last-child { border-bottom: none; }
    .empty-state {
        text-align: center;
        padding: 20px;
        color: rgba(255,255,255,0.3);
        font-size: 0.85rem;
        font-style: italic;
    }
    
    .todo-input-group { display: flex; gap: 10px; margin-bottom: 15px; }
    .todo-input {
        flex: 1;
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 8px 12px;
        color: #fff;
        outline: none;
    }
    .btn-add {
        background: rgba(255,255,255,0.1);
        border: none;
        color: var(--theme-color);
        width: 36px;
        border-radius: 8px;
        cursor: pointer;
    }
    .btn-add:hover { background: rgba(255,255,255,0.2); }

</style>

<div class="dashboard-grid">
    <!-- Header -->
    <div class="dashboard-header">
        <div class="header-title">
            <h2><i class="fas fa-layer-group"></i> WORKSPACE</h2>
        </div>
        <div class="header-time" id="header-time-display">00:00</div>
    </div>

    <!-- Left Column: Quick Actions -->
    <div class="col-left">
        <!-- Attendance -->
        <div class="glass-card">
            <div class="card-header">
                <div class="card-title"><i class="fas fa-clock"></i> ATTENDANCE</div>
            </div>
            <div class="digital-clock-display" id="digital-clock-display">--:--</div>
            <div class="date-display" id="date-display-main">Loading...</div>
            <button class="btn-attendance" id="dashboard-clock-in-btn" onclick="app.clockIn()">
                <i class="fas fa-sign-in-alt"></i> CLOCK IN
            </button>
        </div>

        <!-- Announcements -->
        <div class="glass-card" style="flex: 1;">
             <div class="card-header">
                <div class="card-title"><i class="fas fa-bullhorn"></i> NOTICE</div>
            </div>
            <div id="announcements-list">
                <div class="empty-state">No new announcements</div>
            </div>
        </div>
    </div>

    <!-- Center Column: Main Work (Daily Report) -->
    <div class="col-center">
        <div class="glass-card" style="height: 100%;">
            <div class="card-header">
                <div class="card-title"><i class="fas fa-file-alt"></i> DAILY REPORT</div>
                <div style="font-size: 0.8rem; opacity: 0.6;" id="report-date-display">202X.XX.XX</div>
            </div>
            <textarea id="daily-report-content" class="daily-report-textarea" placeholder="本日の業務内容、成果、課題などを入力してください..."></textarea>
            <div class="report-footer">
                <button class="btn-save" id="daily-report-save-btn"><i class="fas fa-save"></i> SAVE REPORT</button>
            </div>
        </div>
    </div>

    <!-- Right Column: Todo & Tools -->
    <div class="col-right">
        <div class="glass-card" style="height: 100%;">
            <div class="card-header">
                <div class="card-title"><i class="fas fa-check-square"></i> TODO LIST</div>
            </div>
            <div class="todo-input-group">
                <input type="text" class="todo-input" placeholder="New Task..." id="todo-input">
                <button class="btn-add" id="add-todo-btn"><i class="fas fa-plus"></i></button>
            </div>
            <div id="todo-list">
                <!-- <div class="list-item">Design Review <i class="fas fa-check" style="float:right; opacity:0.5;"></i></div> -->
                <div class="empty-state">All tasks completed</div>
            </div>
        </div>
    </div>
</div>
`;
