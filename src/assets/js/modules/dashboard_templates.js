export const STAFF_DASHBOARD_HTML = `
<div class="mypage-main-grid-container" style="flex: 1; overflow: hidden; min-height: 0;">
  <div class="mypage-main-grid" id="mypage-grid">
    <!-- 左カラム -->
    <div class="mypage-column mypage-column-left">
      <!-- 出退勤セクション -->
      <section id="attendance">
        <div class="container-section">
          <div class="container-header">
            <h2 class="container-title drag-handle">
              <i class="fas fa-grip-vertical"></i>
              <i class="fas fa-clock"></i>
              出退勤
            </h2>
          </div>
          <div class="card accordion-content">
            <!-- 時計（簡易版） -->
            <div class="digital-clock-card" style="background: transparent; padding-bottom: 16px; margin-bottom: 16px;">
              <div class="digital-clock-display" id="digital-clock-display">--:--:--</div>
            </div>
            <!-- 出勤ボタン -->
            <div class="attendance-action-box">
                <button class="btn-attendance btn-clock-in" onclick="performClockIn()" id="dashboard-clock-in-btn">
                    <i class="fas fa-sign-in-alt"></i> 出勤
                </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 業務連絡通知セクション -->
      <section id="announcements">
        <div class="container-section">
          <div class="container-header">
            <h2 class="container-title drag-handle">
              <i class="fas fa-bullhorn"></i> 業務連絡
            </h2>
          </div>
          <div class="card announcements-card accordion-content">
            <div id="announcements-list">
              <div class="empty-state">業務連絡はありません</div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 中央カラム -->
    <div class="mypage-column mypage-column-center">
      <!-- 日報 -->
      <section id="daily-reports">
        <div class="container-section">
          <div class="container-header">
            <h2 class="container-title">
              <i class="fas fa-file-alt"></i> 日報
            </h2>
          </div>
          <div class="card daily-reports-card accordion-content">
            <div class="daily-report-form-section">
              <div class="daily-report-form-header">
                <span class="daily-report-date-label">本日の作業内容</span>
                <span class="daily-report-date" id="daily-report-today-date"></span>
              </div>
              <textarea id="daily-report-content" class="daily-report-textarea" placeholder="今日の作業内容を入力してください..." rows="6"></textarea>
              <div class="daily-report-actions">
                <button class="btn btn-primary btn-sm" id="daily-report-save-btn">保存</button>
              </div>
            </div>
          </div>
          </div>
      </section>
    </div>

    <!-- 右カラム -->
    <div class="mypage-column mypage-column-right">
      <!-- TODOリスト -->
      <section id="todo">
        <div class="container-section">
          <div class="container-header">
            <h2 class="container-title">
              <i class="fas fa-tasks"></i> TODOリスト
            </h2>
          </div>
          <div class="card todo-card accordion-content">
            <div class="todo-input-wrapper">
              <input type="text" id="todo-input" class="todo-input" placeholder="新しいタスクを追加..." />
              <button class="btn btn-primary btn-sm" id="add-todo-btn">追加</button>
            </div>
            <ul id="todo-list" class="todo-list">
                <!-- Items will be injected -->
                <li class="todo-item">タスク管理機能は準備中です</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  </div>
</div>
`;
