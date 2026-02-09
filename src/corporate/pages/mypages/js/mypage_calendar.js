(() => {
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const getToday = () => new Date();
  const pad2 = (value) => String(value).padStart(2, '0');

  let calendarRoot = null;
  let titleEl = null;
  let gridEl = null;
  let navButtons = [];
  let currentDate = null;
  let navBound = false;

  const buildCell = (text, className) => {
    const cell = document.createElement('div');
    cell.className = className;
    cell.textContent = text;
    return cell;
  };

  const ensureCalendar = () => {
    if (calendarRoot) return true;

    const textareaEl = document.getElementById('tab-content-textarea');
    const sectionEl = textareaEl ? textareaEl.closest('.section') : null;
    if (!sectionEl) return false;

    calendarRoot = document.getElementById('tab-content-calendar');
    if (!calendarRoot) {
      calendarRoot = document.createElement('div');
      calendarRoot.id = 'tab-content-calendar';
      calendarRoot.className = 'tab-calendar';
      calendarRoot.hidden = true;
      if (textareaEl) {
        sectionEl.insertBefore(calendarRoot, textareaEl);
      } else {
        sectionEl.appendChild(calendarRoot);
      }
    }

    calendarRoot.innerHTML = `
      <div class="calendar-head">
        <a class="calendar-nav" href="#" data-direction="prev" aria-label="前へ">
          <i class="fa-solid fa-chevron-left"></i>
        </a>
        <h2 class="calendar-title">0000 00</h2>
        <a class="calendar-nav" href="#" data-direction="next" aria-label="次へ">
          <i class="fa-solid fa-chevron-right"></i>
        </a>
      </div>
      <div class="card">
        <div class="calendar-grid"></div>
        <div class="calendar-legend">
          <div class="legend-item"><span class="legend-dot visit"></span>訪問予定日</div>
          <div class="legend-item"><span class="legend-dot end"></span>訪問終了日</div>
        </div>
      </div>
    `;

    titleEl = calendarRoot.querySelector('.calendar-title');
    gridEl = calendarRoot.querySelector('.calendar-grid');
    navButtons = Array.from(calendarRoot.querySelectorAll('.calendar-nav'));

    if (!titleEl || !gridEl) return false;

    if (!navBound) {
      navButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          const direction = button.dataset.direction;
          if (direction === 'prev') {
            shiftMonth(-1);
          } else if (direction === 'next') {
            shiftMonth(1);
          }
        });
      });
      navBound = true;
    }

    return true;
  };

  const renderCalendar = (baseDate) => {
    if (!ensureCalendar()) return;

    const today = getToday();
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    titleEl.textContent = `${year} ${pad2(month + 1)}`;
    gridEl.innerHTML = '';

    dayLabels.forEach((label) => {
      gridEl.appendChild(buildCell(label, 'calendar-cell calendar-day-name'));
    });

    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    for (let i = startOffset; i > 0; i -= 1) {
      const day = prevMonthDays - i + 1;
      gridEl.appendChild(buildCell(day, 'calendar-cell calendar-date disabled'));
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const isToday =
        year === today.getFullYear() &&
        month === today.getMonth() &&
        day === today.getDate();
      const className = isToday
        ? 'calendar-cell calendar-date today'
        : 'calendar-cell calendar-date';
      gridEl.appendChild(buildCell(day, className));
    }

    const totalCells = gridEl.querySelectorAll('.calendar-cell').length;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let day = 1; day <= remaining; day += 1) {
      gridEl.appendChild(buildCell(day, 'calendar-cell calendar-date disabled'));
    }
  };

  const shiftMonth = (delta) => {
    if (!currentDate) {
      const now = getToday();
      currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
    renderCalendar(currentDate);
  };

  const syncToToday = () => {
    const now = getToday();
    currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
    renderCalendar(currentDate);
  };

  const show = () => {
    if (!ensureCalendar()) return;
    calendarRoot.hidden = false;
  };

  const hide = () => {
    if (calendarRoot) {
      calendarRoot.hidden = true;
    }
  };

  const handleVisibility = () => {
    if (!document.hidden) {
      syncToToday();
    }
  };

  syncToToday();

  window.addEventListener('focus', syncToToday);
  document.addEventListener('visibilitychange', handleVisibility);

  window.MypageCalendar = {
    syncToToday,
    show,
    hide,
    ensure: ensureCalendar
  };
})();
