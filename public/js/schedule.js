(function() {
  // Load data
  const scheduleData = JSON.parse(document.getElementById('schedule-data').textContent);
  const clientsData = JSON.parse(document.getElementById('clients-data').textContent);
  
  // Store schedules in memory
  let schedules = scheduleData.schedules || [];
  
  // Calendar state
  let currentDate = new Date();
  let currentView = 'month';
  let selectedDate = null;
  
  // Calendar types
  const calendarTypes = [
    { id: '見積もり提出', name: '見積もり提出', color: '#FFB3D1', visible: true },
    { id: '商談', name: '商談', color: '#FFD4A3', visible: true },
    { id: '定期訪問', name: '定期訪問', color: '#B5E5CF', visible: true },
    { id: '清掃状況確認', name: '清掃状況確認', color: '#FFB3B3', visible: true },
    { id: 'その他', name: 'その他', color: '#D4C5F9', visible: true }
  ];
  
  // Drag & Drop state
  let dragState = {
    isDragging: false,
    isResizing: false,
    scheduleId: null,
    scheduleElement: null,
    startX: 0,
    startY: 0,
    startDate: null,
    startTime: null,
    resizeType: null,
    startTop: 0,
    startHeight: 0,
    currentView: null
  };
  
  // Global mouse move handler
  let mouseMoveHandler = null;
  let mouseUpHandler = null;
  
  // Initialize
  init();
  
  function init() {
    // Render calendar list
    renderCalendarList();
    
    // View tabs
    document.querySelectorAll('.view-tab-sidebar').forEach(tab => {
      tab.addEventListener('click', () => {
        switchView(tab.dataset.view);
      });
    });
    
    // Navigation
    document.getElementById('prev-btn').addEventListener('click', () => navigate(-1));
    document.getElementById('next-btn').addEventListener('click', () => navigate(1));
    document.getElementById('today-btn').addEventListener('click', () => {
      currentDate = new Date();
      renderCurrentView();
    });
    
    // Menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.calendar-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarClose = document.getElementById('sidebar-close');
    
    function openSidebar() {
      sidebar.classList.add('open');
      if (sidebarOverlay) {
        sidebarOverlay.classList.add('active');
      }
    }
    
    function closeSidebar() {
      sidebar.classList.remove('open');
      if (sidebarOverlay) {
        sidebarOverlay.classList.remove('active');
      }
    }
    
    if (menuToggle) {
      menuToggle.addEventListener('click', () => {
        if (sidebar.classList.contains('open')) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
    }
    
    if (sidebarClose) {
      sidebarClose.addEventListener('click', closeSidebar);
    }
    
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    // Create button
    document.querySelector('.create-btn').addEventListener('click', () => {
      openScheduleModal();
    });
    
    // Modal
    document.getElementById('modal-close').addEventListener('click', closeScheduleModal);
    document.getElementById('modal-cancel').addEventListener('click', closeScheduleModal);
    document.getElementById('schedule-form').addEventListener('submit', handleScheduleSubmit);
    document.getElementById('modal-delete').addEventListener('click', handleScheduleDelete);
    
    // Populate client select
    populateClientSelect();
    
    // Initial render
    renderCurrentView();
  }
  
  function renderCalendarList() {
    const container = document.getElementById('calendar-list-items');
    container.innerHTML = '';
    
    calendarTypes.forEach(type => {
      const item = document.createElement('div');
      item.className = `calendar-item ${type.visible ? '' : 'hidden'}`;
      item.innerHTML = `
        <div class="calendar-color purpose-${type.id}" style="background: ${type.color}"></div>
        <span class="calendar-name">${type.name}</span>
        <div class="calendar-toggle"></div>
      `;
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('calendar-toggle') || e.target.closest('.calendar-toggle')) {
          type.visible = !type.visible;
          item.classList.toggle('hidden');
          renderCurrentView();
        }
      });
      container.appendChild(item);
    });
  }
  
  function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view-tab-sidebar').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === view);
    });
    document.querySelectorAll('.calendar-view').forEach(v => {
      v.classList.add('hidden');
    });
    document.getElementById(`${view}-view`).classList.remove('hidden');
    renderCurrentView();
  }
  
  function navigate(direction) {
    if (currentView === 'month') {
      currentDate.setMonth(currentDate.getMonth() + direction);
    } else if (currentView === 'week') {
      currentDate.setDate(currentDate.getDate() + (direction * 7));
    } else if (currentView === 'day') {
      currentDate.setDate(currentDate.getDate() + direction);
    }
    renderCurrentView();
  }
  
  function renderCurrentView() {
    if (currentView === 'month') {
      renderMonthView();
    } else if (currentView === 'week') {
      renderWeekView();
    } else if (currentView === 'day') {
      renderDayView();
    }
    updateDateTitle();
  }
  
  function updateDateTitle() {
    const titleEl = document.getElementById('current-date-title');
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    
    if (currentView === 'month') {
      titleEl.textContent = `${year}年${month}月`;
    } else if (currentView === 'week') {
      const startOfWeek = getStartOfWeek(currentDate);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      titleEl.textContent = `${formatDateDisplay(startOfWeek)} - ${formatDateDisplay(endOfWeek)}`;
    } else if (currentView === 'day') {
      titleEl.textContent = `${year}年${month}月${day}日`;
    }
  }
  
  function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const container = document.getElementById('calendar-days-month');
    container.innerHTML = '';
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      container.appendChild(createDayElement(dayNum, true, dateStr));
    }
    
    // Current month days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayEl = createDayElement(i, false, dateStr);
      if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
        dayEl.classList.add('today');
      }
      container.appendChild(dayEl);
    }
    
    // Next month days
    const remainingDays = 42 - (startingDayOfWeek + daysInMonth);
    for (let i = 1; i <= remainingDays; i++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      container.appendChild(createDayElement(i, true, dateStr));
    }
  }
  
  function createDayElement(dayNumber, isOtherMonth, dateStr) {
    const day = document.createElement('div');
    day.className = 'calendar-day-month';
    if (isOtherMonth) {
      day.classList.add('other-month');
    }
    day.dataset.date = dateStr;
    
    const dayNumberEl = document.createElement('div');
    dayNumberEl.className = 'day-number';
    dayNumberEl.textContent = dayNumber;
    day.appendChild(dayNumberEl);
    
    // Get visible schedules for this day
    const daySchedules = schedules.filter(s => {
      if (s.date !== dateStr || s.status === 'completed') return false;
      const calendarType = calendarTypes.find(t => t.id === s.purpose);
      return calendarType && calendarType.visible;
    });
    
    if (daySchedules.length > 0) {
      daySchedules.sort((a, b) => a.time.localeCompare(b.time));
      const eventsDiv = document.createElement('div');
      eventsDiv.className = 'day-events';
      
      const maxVisible = 3;
      daySchedules.slice(0, maxVisible).forEach(schedule => {
        const eventEl = document.createElement('div');
        eventEl.className = `day-event purpose-${schedule.purpose}`;
        eventEl.textContent = `${schedule.time} ${schedule.client_name || schedule.purpose}`;
        eventEl.addEventListener('click', (e) => {
          e.stopPropagation();
          openScheduleModal(null, schedule.id);
        });
        eventsDiv.appendChild(eventEl);
      });
      
      if (daySchedules.length > maxVisible) {
        const moreEl = document.createElement('div');
        moreEl.className = 'day-event-more';
        moreEl.textContent = `+${daySchedules.length - maxVisible}件`;
        eventsDiv.appendChild(moreEl);
      }
      
      day.appendChild(eventsDiv);
    }
    
    day.addEventListener('click', (e) => {
      if (!e.target.closest('.day-event')) {
        openScheduleModal(dateStr);
      }
    });
    
    return day;
  }
  
  function renderWeekView() {
    const startOfWeek = getStartOfWeek(currentDate);
    const today = new Date();
    
    // Render time slots (hourly)
    const timeSlots = document.getElementById('time-slots-week');
    timeSlots.innerHTML = '';
    for (let hour = 0; hour < 24; hour++) {
      // Hour mark (00:00) - represents full hour (40px)
      const hourSlot = document.createElement('div');
      hourSlot.className = 'time-slot hour-mark';
      hourSlot.textContent = `${String(hour).padStart(2, '0')}:00`;
      timeSlots.appendChild(hourSlot);
    }
    
    // Render day headers
    const daysHeader = document.getElementById('days-header-week');
    daysHeader.innerHTML = '';
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dateStr = formatDate(day);
      const header = document.createElement('div');
      header.className = 'day-header';
      if (formatDate(day) === formatDate(today)) {
        header.classList.add('today');
      }
      header.innerHTML = `
        <div class="day-header-name">${dayNames[i]}</div>
        <div class="day-header-number">${day.getDate()}</div>
      `;
      daysHeader.appendChild(header);
    }
    
    // Render day columns
    const daysContent = document.getElementById('days-content-week');
    daysContent.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dateStr = formatDate(day);
      
      const dayColumn = document.createElement('div');
      dayColumn.className = 'day-column-week';
      
      for (let hour = 0; hour < 24; hour++) {
        // Hour slot (00:00)
        const hourSlot = document.createElement('div');
        hourSlot.className = 'day-time-slot hour-mark';
        hourSlot.dataset.date = dateStr;
        hourSlot.dataset.hour = hour;
        hourSlot.dataset.minute = 0;
        
        // Find schedules for this day and hour
        const hourSchedules = schedules.filter(s => {
          if (s.date !== dateStr || s.status === 'completed') return false;
          const scheduleHour = parseInt(s.time.split(':')[0]);
          if (scheduleHour !== hour) return false;
          const calendarType = calendarTypes.find(t => t.id === s.purpose);
          return calendarType && calendarType.visible;
        });
        
        // Optimize overlapping events
        const optimizedSchedules = optimizeOverlappingEvents(hourSchedules);
        
        // Add events to appropriate slot
        optimizedSchedules.forEach(scheduleData => {
          const [scheduleHour, scheduleMin] = scheduleData.schedule.time.split(':').map(Number);
          // Events should be placed in the hour slot (which represents the full hour)
          // The top position will be calculated based on minutes within the hour
          const eventEl = createWeekEvent(scheduleData.schedule, dateStr, hour, scheduleData);
          hourSlot.appendChild(eventEl);
        });
        
        // Click handler for hour slot
        hourSlot.addEventListener('click', (e) => {
          if (!e.target.closest('.week-event')) {
            const rect = hourSlot.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;
            const minutes = Math.round((relativeY / 40) * 60);
            const clampedMinutes = Math.max(0, Math.min(59, minutes));
            const defaultTime = `${String(hour).padStart(2, '0')}:${String(clampedMinutes).padStart(2, '0')}`;
            openScheduleModal(dateStr, null, defaultTime);
          }
        });
        
        dayColumn.appendChild(hourSlot);
        // Don't append halfHourSlot - it's hidden and hourSlot covers the full hour
      }
      
      daysContent.appendChild(dayColumn);
    }
    
    // Sync scroll between time slots and days content
    // Wait for DOM to be fully rendered
    setTimeout(() => {
      const timeSlots = document.getElementById('time-slots-week');
      const daysContent = document.getElementById('days-content-week');
      const dayColumns = daysContent?.querySelectorAll('.day-column-week');
      const timeColumn = timeSlots?.closest('.time-column');
      const daysColumn = daysContent?.closest('.days-column');
      
      if (timeSlots && daysContent && dayColumns && timeColumn && daysColumn) {
        // Content height: 24 hours × 40px = 960px (all 24 hours)
        const contentHeight = 24 * 40; // 960px
        
        // Get available height (parent height minus headers)
        const timeHeader = timeColumn.querySelector('.time-header');
        const daysHeader = daysColumn.querySelector('.days-header');
        const timeHeaderHeight = timeHeader ? timeHeader.offsetHeight : 48;
        const daysHeaderHeight = daysHeader ? daysHeader.offsetHeight : 48;
        
        // Calculate scrollable area height (parent height - header height)
        const timeColumnHeight = timeColumn.offsetHeight;
        const daysColumnHeight = daysColumn.offsetHeight;
        const scrollableHeight = Math.min(
          timeColumnHeight - timeHeaderHeight,
          daysColumnHeight - daysHeaderHeight
        );
        
        // Set scrollable container height to fit screen
        // This makes the viewport responsive to screen size
        timeSlots.style.height = `${scrollableHeight}px`;
        
        // Set content height to 960px (all 24 hours) for scrolling
        // This ensures all hours are accessible via scroll
        const timeSlotContainer = timeSlots;
        const timeSlotElements = timeSlotContainer.querySelectorAll('.time-slot.hour-mark');
        if (timeSlotElements.length > 0) {
          // Content is already 960px (24 slots × 40px), just ensure it's scrollable
        }
        
        // Verify all slots are present
        dayColumns.forEach(dayColumn => {
          const daySlots = dayColumn.querySelectorAll('.day-time-slot.hour-mark');
          if (daySlots.length !== 24) {
            console.warn(`Day column has ${daySlots.length} slots, expected 24`);
          }
        });
        
        // Debug: Log actual heights
        console.log('Week View Heights:');
        console.log('Content height (24 hours):', contentHeight, 'px');
        console.log('Scrollable height (viewport):', scrollableHeight, 'px');
        console.log('Time slots viewport height:', timeSlots.offsetHeight, 'px');
        console.log('Days content viewport height:', daysContent.offsetHeight, 'px');
        console.log('Day columns count:', dayColumns.length);
        if (dayColumns.length > 0) {
          const slots = dayColumns[0].querySelectorAll('.day-time-slot.hour-mark');
          console.log('Time slots in day column:', slots.length);
          if (slots.length > 0) {
            console.log('Last slot hour:', slots[slots.length - 1].dataset.hour);
          }
        }
      }
      
      syncWeekScroll();
    }, 0);
  }
  
  // Store scroll sync handlers to prevent duplicates
  let weekScrollHandlers = null;
  let dayScrollHandlers = null;
  
  function syncWeekScroll() {
    const timeSlots = document.getElementById('time-slots-week');
    const daysContent = document.getElementById('days-content-week');
    const daysColumn = daysContent?.closest('.days-column');
    
    if (!timeSlots || !daysContent || !daysColumn) return;
    
    // Remove existing handlers if any
    if (weekScrollHandlers) {
      if (weekScrollHandlers.timeHandler) {
        timeSlots.removeEventListener('scroll', weekScrollHandlers.timeHandler);
      }
      if (weekScrollHandlers.contentHandler) {
        daysContent.removeEventListener('scroll', weekScrollHandlers.contentHandler);
      }
      if (weekScrollHandlers.columnHandler) {
        daysColumn.removeEventListener('scroll', weekScrollHandlers.columnHandler);
      }
      if (weekScrollHandlers.scrollTimeout) {
        clearTimeout(weekScrollHandlers.scrollTimeout);
      }
    }
    
    // Shared state to prevent infinite loop
    const scrollState = {
      isScrolling: false,
      scrollTimeout: null
    };
    
    // Sync days column scroll to time slots (main scroll handler)
    const columnHandler = () => {
      if (scrollState.isScrolling) return;
      scrollState.isScrolling = true;
      // Sync time slots to match days column scroll
      timeSlots.scrollTop = daysColumn.scrollTop;
      if (scrollState.scrollTimeout) clearTimeout(scrollState.scrollTimeout);
      scrollState.scrollTimeout = setTimeout(() => {
        scrollState.isScrolling = false;
      }, 10);
    };
    
    // Sync time slots scroll to days column (backup handler)
    const timeHandler = () => {
      if (scrollState.isScrolling) return;
      scrollState.isScrolling = true;
      daysColumn.scrollTop = timeSlots.scrollTop;
      if (scrollState.scrollTimeout) clearTimeout(scrollState.scrollTimeout);
      scrollState.scrollTimeout = setTimeout(() => {
        scrollState.isScrolling = false;
      }, 10);
    };
    
    // Sync days content scroll to days column (backup handler)
    const contentHandler = () => {
      if (scrollState.isScrolling) return;
      scrollState.isScrolling = true;
      daysColumn.scrollTop = daysContent.scrollTop;
      if (scrollState.scrollTimeout) clearTimeout(scrollState.scrollTimeout);
      scrollState.scrollTimeout = setTimeout(() => {
        scrollState.isScrolling = false;
      }, 10);
    };
    
    // Main scroll handler on days column
    daysColumn.addEventListener('scroll', columnHandler, { passive: true });
    // Backup handlers in case child elements still scroll
    timeSlots.addEventListener('scroll', timeHandler, { passive: true });
    daysContent.addEventListener('scroll', contentHandler, { passive: true });
    
    // Store handlers and state for cleanup
    weekScrollHandlers = { timeHandler, contentHandler, columnHandler, scrollState };
    
    // Initial sync - ensure all are at the same scroll position
    requestAnimationFrame(() => {
      const scrollTop = Math.max(timeSlots.scrollTop, daysContent.scrollTop, daysColumn.scrollTop);
      scrollState.isScrolling = true;
      timeSlots.scrollTop = scrollTop;
      daysContent.scrollTop = scrollTop;
      daysColumn.scrollTop = scrollTop;
      setTimeout(() => {
        scrollState.isScrolling = false;
      }, 50);
    });
  }
  
  function optimizeOverlappingEvents(schedules) {
    if (schedules.length === 0) return [];
    
    // Sort by time
    const sorted = [...schedules].sort((a, b) => a.time.localeCompare(b.time));
    
    // Group overlapping events
    const groups = [];
    let currentGroup = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const [prevHour, prevMin] = prev.time.split(':').map(Number);
      const [currHour, currMin] = curr.time.split(':').map(Number);
      
      // Check if events overlap (within 30 minutes)
      const prevMinutes = prevHour * 60 + prevMin;
      const currMinutes = currHour * 60 + currMin;
      
      if (currMinutes - prevMinutes < 30) {
        currentGroup.push(curr);
      } else {
        groups.push(currentGroup);
        currentGroup = [curr];
      }
    }
    groups.push(currentGroup);
    
    // Calculate positions for each group
    const result = [];
    groups.forEach(group => {
      const groupWidth = 100 / group.length;
      group.forEach((schedule, index) => {
        result.push({
          schedule: schedule,
          left: (index * groupWidth),
          width: groupWidth - 1
        });
      });
    });
    
    return result;
  }
  
  function createWeekEvent(schedule, dateStr, hour, positionData = null) {
    const eventEl = document.createElement('div');
    eventEl.className = `week-event purpose-${schedule.purpose}`;
    eventEl.dataset.scheduleId = schedule.id;
    const [scheduleHour, scheduleMinute] = schedule.time.split(':').map(Number);
    // Calculate top position: each hour has 2 slots (00 and 30), each 20px
    // So 1 hour = 40px total, position is based on minutes within that hour
    const topPercent = (scheduleMinute / 60) * 100;
    eventEl.style.top = `${topPercent}%`;
    
    if (positionData) {
      eventEl.style.left = `${positionData.left}%`;
      eventEl.style.width = `${positionData.width}%`;
    }
    
    eventEl.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 2px;">${schedule.time}</div>
      <div style="font-size: 0.7rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${schedule.client_name || schedule.purpose}</div>
      <div class="resize-handle resize-handle-top"></div>
      <div class="resize-handle"></div>
    `;
    
    eventEl.addEventListener('click', (e) => {
      if (!dragState.isDragging && !dragState.isResizing) {
        e.stopPropagation();
        openScheduleModal(null, schedule.id);
      }
    });
    
    // Setup drag handlers
    setupDragHandlers(eventEl, schedule, 'week');
    
    return eventEl;
  }
  
  function renderDayView() {
    const dateStr = formatDate(currentDate);
    const today = new Date();
    
    // Render time slots (hourly)
    const timeSlots = document.getElementById('time-slots-day');
    timeSlots.innerHTML = '';
    for (let hour = 0; hour < 24; hour++) {
      // Hour mark (00:00) - represents full hour (40px)
      const hourSlot = document.createElement('div');
      hourSlot.className = 'time-slot hour-mark';
      hourSlot.textContent = `${String(hour).padStart(2, '0')}:00`;
      timeSlots.appendChild(hourSlot);
    }
    
    // Render day header
    const dayHeader = document.getElementById('day-header-day');
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayName = dayNames[currentDate.getDay()];
    dayHeader.innerHTML = `
      <div class="day-header-name">${dayName}</div>
      <div class="day-header-number">${currentDate.getDate()}</div>
    `;
    if (formatDate(currentDate) === formatDate(today)) {
      dayHeader.classList.add('today');
    }
    
    // Render day content
    const dayContent = document.getElementById('day-content-day');
    dayContent.innerHTML = '';
    
    const daySchedules = schedules.filter(s => {
      if (s.date !== dateStr || s.status === 'completed') return false;
      const calendarType = calendarTypes.find(t => t.id === s.purpose);
      return calendarType && calendarType.visible;
    });
    daySchedules.sort((a, b) => a.time.localeCompare(b.time));
    
    for (let hour = 0; hour < 24; hour++) {
      // Hour slot (represents full hour, 40px)
      const hourSlot = document.createElement('div');
      hourSlot.className = 'day-time-slot hour-mark';
      hourSlot.dataset.hour = hour;
      hourSlot.dataset.minute = 0;
      
      const hourSchedules = daySchedules.filter(s => {
        const scheduleHour = parseInt(s.time.split(':')[0]);
        return scheduleHour === hour;
      });
      
      if (hourSchedules.length > 0) {
        hourSchedules.forEach(schedule => {
          const eventEl = createDayEvent(schedule);
          hourSlot.appendChild(eventEl);
        });
      }
      
      // Click handler for hour slot
      hourSlot.addEventListener('click', (e) => {
        if (!e.target.closest('.day-event')) {
          const rect = hourSlot.getBoundingClientRect();
          const relativeY = e.clientY - rect.top;
          const minutes = Math.round((relativeY / 40) * 60);
          const clampedMinutes = Math.max(0, Math.min(59, minutes));
          const defaultTime = `${String(hour).padStart(2, '0')}:${String(clampedMinutes).padStart(2, '0')}`;
          openScheduleModal(dateStr, null, defaultTime);
        }
      });
      
      dayContent.appendChild(hourSlot);
      // Don't append halfHourSlot - it's hidden and hourSlot covers the full hour
    }
    
    // Sync scroll between time slots and day content
    // Wait for DOM to be fully rendered
    setTimeout(() => {
      const timeSlots = document.getElementById('time-slots-day');
      const dayContent = document.getElementById('day-content-day');
      const timeColumn = timeSlots?.closest('.time-column');
      const dayColumn = dayContent?.closest('.day-column');
      
      if (timeSlots && dayContent && timeColumn && dayColumn) {
        // Content height: 24 hours × 40px = 960px (all 24 hours)
        const contentHeight = 24 * 40; // 960px
        
        // Get available height (parent height minus headers)
        const timeHeader = timeColumn.querySelector('.time-header');
        const dayHeader = dayColumn.querySelector('.day-header-day');
        const timeHeaderHeight = timeHeader ? timeHeader.offsetHeight : 48;
        const dayHeaderHeight = dayHeader ? dayHeader.offsetHeight : 48;
        
        // Calculate scrollable area height (parent height - header height)
        const timeColumnHeight = timeColumn.offsetHeight;
        const dayColumnHeight = dayColumn.offsetHeight;
        const scrollableHeight = Math.min(
          timeColumnHeight - timeHeaderHeight,
          dayColumnHeight - dayHeaderHeight
        );
        
        // Set scrollable container height to fit screen
        // This makes the viewport responsive to screen size
        timeSlots.style.height = `${scrollableHeight}px`;
        
        // Verify all slots are present
        const daySlots = dayContent.querySelectorAll('.day-time-slot.hour-mark');
        if (daySlots.length !== 24) {
          console.warn(`Day content has ${daySlots.length} slots, expected 24`);
        }
        
        // Debug: Log actual heights
        console.log('Day View Heights:');
        console.log('Content height (24 hours):', contentHeight, 'px');
        console.log('Scrollable height (viewport):', scrollableHeight, 'px');
        console.log('Time slots viewport height:', timeSlots.offsetHeight, 'px');
        console.log('Day content viewport height:', dayContent.offsetHeight, 'px');
        console.log('Time slots in day content:', daySlots.length);
        if (daySlots.length > 0) {
          console.log('Last slot hour:', daySlots[daySlots.length - 1].dataset.hour);
        }
      }
      
      syncDayScroll();
    }, 0);
  }
  
  function syncDayScroll() {
    const timeSlots = document.getElementById('time-slots-day');
    const dayContent = document.getElementById('day-content-day');
    const dayColumn = dayContent?.closest('.day-column');
    
    if (!timeSlots || !dayContent || !dayColumn) return;
    
    // Remove existing handlers if any
    if (dayScrollHandlers) {
      if (dayScrollHandlers.timeHandler) {
        timeSlots.removeEventListener('scroll', dayScrollHandlers.timeHandler);
      }
      if (dayScrollHandlers.contentHandler) {
        dayContent.removeEventListener('scroll', dayScrollHandlers.contentHandler);
      }
      if (dayScrollHandlers.columnHandler) {
        dayColumn.removeEventListener('scroll', dayScrollHandlers.columnHandler);
      }
      if (dayScrollHandlers.scrollTimeout) {
        clearTimeout(dayScrollHandlers.scrollTimeout);
      }
    }
    
    // Shared state to prevent infinite loop
    const scrollState = {
      isScrolling: false,
      scrollTimeout: null
    };
    
    // Sync day column scroll to time slots (main scroll handler)
    const columnHandler = () => {
      if (scrollState.isScrolling) return;
      scrollState.isScrolling = true;
      // Sync time slots to match day column scroll
      timeSlots.scrollTop = dayColumn.scrollTop;
      if (scrollState.scrollTimeout) clearTimeout(scrollState.scrollTimeout);
      scrollState.scrollTimeout = setTimeout(() => {
        scrollState.isScrolling = false;
      }, 10);
    };
    
    // Sync time slots scroll to day column (backup handler)
    const timeHandler = () => {
      if (scrollState.isScrolling) return;
      scrollState.isScrolling = true;
      dayColumn.scrollTop = timeSlots.scrollTop;
      if (scrollState.scrollTimeout) clearTimeout(scrollState.scrollTimeout);
      scrollState.scrollTimeout = setTimeout(() => {
        scrollState.isScrolling = false;
      }, 10);
    };
    
    // Sync day content scroll to day column (backup handler)
    const contentHandler = () => {
      if (scrollState.isScrolling) return;
      scrollState.isScrolling = true;
      dayColumn.scrollTop = dayContent.scrollTop;
      if (scrollState.scrollTimeout) clearTimeout(scrollState.scrollTimeout);
      scrollState.scrollTimeout = setTimeout(() => {
        scrollState.isScrolling = false;
      }, 10);
    };
    
    // Main scroll handler on day column
    dayColumn.addEventListener('scroll', columnHandler, { passive: true });
    // Backup handlers in case child elements still scroll
    timeSlots.addEventListener('scroll', timeHandler, { passive: true });
    dayContent.addEventListener('scroll', contentHandler, { passive: true });
    
    // Store handlers and state for cleanup
    dayScrollHandlers = { timeHandler, contentHandler, columnHandler, scrollState };
    
    // Initial sync - ensure all are at the same scroll position
    requestAnimationFrame(() => {
      const scrollTop = Math.max(timeSlots.scrollTop, dayContent.scrollTop, dayColumn.scrollTop);
      scrollState.isScrolling = true;
      timeSlots.scrollTop = scrollTop;
      dayContent.scrollTop = scrollTop;
      dayColumn.scrollTop = scrollTop;
      setTimeout(() => {
        scrollState.isScrolling = false;
      }, 50);
    });
  }
  
  function createDayEvent(schedule) {
    const eventEl = document.createElement('div');
    eventEl.className = `day-event purpose-${schedule.purpose}`;
    eventEl.dataset.scheduleId = schedule.id;
    const [scheduleHour, scheduleMinute] = schedule.time.split(':').map(Number);
    // Calculate top position within the hour slot (40px = 60 minutes)
    const topPercent = (scheduleMinute / 60) * 100;
    eventEl.style.top = `${topPercent}%`;
    eventEl.style.position = 'absolute';
    eventEl.style.left = '0';
    eventEl.style.right = '0';
    eventEl.innerHTML = `
      <div class="day-schedule-time">${schedule.time}</div>
      <div class="day-schedule-title">${schedule.client_name}</div>
      ${schedule.store_name ? `<div class="day-schedule-details">${schedule.store_name}</div>` : ''}
      <div class="day-schedule-details">${schedule.purpose}</div>
    `;
    
    eventEl.addEventListener('click', (e) => {
      if (!dragState.isDragging) {
        e.stopPropagation();
        openScheduleModal(null, schedule.id);
      }
    });
    
    // Setup drag handlers
    setupDragHandlers(eventEl, schedule, 'day');
    
    return eventEl;
  }
  
  function setupDragHandlers(element, schedule, view) {
    // Drag start
    element.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('resize-handle') || e.target.closest('.resize-handle')) {
        dragState.isResizing = true;
        const handle = e.target.closest('.resize-handle') || e.target;
        dragState.resizeType = handle.classList.contains('resize-handle-top') ? 'top' : 'bottom';
        dragState.startTop = parseFloat(element.style.top) || 0;
        dragState.startHeight = element.offsetHeight;
      } else {
        dragState.isDragging = true;
      }
      dragState.scheduleId = schedule.id;
      dragState.scheduleElement = element;
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;
      dragState.startDate = schedule.date;
      dragState.startTime = schedule.time;
      dragState.currentView = view;
      element.classList.add('dragging');
      e.preventDefault();
      e.stopPropagation();
      
      // Add global handlers
      if (!mouseMoveHandler) {
        mouseMoveHandler = handleMouseMove.bind(null, schedule);
        mouseUpHandler = handleMouseUp.bind(null, schedule);
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
      }
    });
  }
  
  function handleMouseMove(schedule, e) {
    if (!dragState.isDragging && !dragState.isResizing) return;
    
    if (dragState.isDragging) {
      handleDragMove(e, schedule);
    } else if (dragState.isResizing) {
      handleResizeMove(e, schedule);
    }
  }
  
  function handleDragMove(e, schedule) {
    if (!dragState.scheduleElement) return;
    
    const element = dragState.scheduleElement;
    const deltaY = e.clientY - dragState.startY;
    const deltaX = e.clientX - dragState.startX;
    
    if (dragState.currentView === 'week') {
      // Find the time slot under the mouse
      const timeSlot = document.elementFromPoint(e.clientX, e.clientY)?.closest('.day-time-slot');
      if (timeSlot) {
        const targetDate = timeSlot.dataset.date;
        const targetHour = parseInt(timeSlot.dataset.hour);
        const rect = timeSlot.getBoundingClientRect();
        // Calculate position within the hour slot (40px = 60 minutes)
        const relativeY = e.clientY - rect.top;
        const minutes = Math.round((relativeY / 40) * 60);
        const clampedMinutes = Math.max(0, Math.min(59, minutes));
        const newTime = `${String(targetHour).padStart(2, '0')}:${String(clampedMinutes).padStart(2, '0')}`;
        
        // Move element to correct hour slot if different
        const currentParent = element.parentElement;
        if (currentParent !== timeSlot) {
          timeSlot.appendChild(element);
        }
        
        // Update visual position
        const topPercent = (clampedMinutes / 60) * 100;
        element.style.top = `${topPercent}%`;
        
        // Store target date and time for update on mouseup
        dragState.targetDate = targetDate;
        dragState.targetTime = newTime;
      }
    } else if (dragState.currentView === 'day') {
      // For day view, find the time slot
      const timeSlot = document.elementFromPoint(e.clientX, e.clientY)?.closest('.day-time-slot');
      if (timeSlot) {
        const targetHour = parseInt(timeSlot.dataset.hour);
        const rect = timeSlot.getBoundingClientRect();
        // Calculate position within the hour slot (40px = 60 minutes)
        const relativeY = e.clientY - rect.top;
        const minutes = Math.round((relativeY / 40) * 60);
        const clampedMinutes = Math.max(0, Math.min(59, minutes));
        const newTime = `${String(targetHour).padStart(2, '0')}:${String(clampedMinutes).padStart(2, '0')}`;
        
        // Move element to correct hour slot if different
        const currentParent = element.parentElement;
        if (currentParent !== timeSlot) {
          timeSlot.appendChild(element);
        }
        const topPercent = (clampedMinutes / 60) * 100;
        element.style.top = `${topPercent}%`;
        
        dragState.targetTime = newTime;
      }
    }
  }
  
  function handleResizeMove(e, schedule) {
    if (!dragState.scheduleElement) return;
    
    const element = dragState.scheduleElement;
    const deltaY = e.clientY - dragState.startY;
    const hourSlotHeight = 40; // Height of hour slot (2 x 20px slots)
    
    if (dragState.currentView === 'week') {
      const hourSlot = element.parentElement;
      if (hourSlot && hourSlot.classList.contains('day-time-slot')) {
        const rect = hourSlot.getBoundingClientRect();
        const currentTop = parseFloat(element.style.top) || 0;
        const currentHeight = element.offsetHeight;
        
        if (dragState.resizeType === 'bottom') {
          // Resize from bottom
          const newHeight = Math.max(20, dragState.startHeight + deltaY);
          element.style.height = `${newHeight}px`;
        } else {
          // Resize from top
          // Calculate new top position based on hour slot height (40px)
          const hourSlotHeight = 40;
          const topDeltaPercent = (deltaY / hourSlotHeight) * 100;
          const newTopPercent = Math.max(0, dragState.startTop + topDeltaPercent);
          const newHeight = Math.max(20, dragState.startHeight - deltaY);
          element.style.top = `${newTopPercent}%`;
          element.style.height = `${newHeight}px`;
        }
      }
    }
  }
  
  function handleMouseUp(schedule, e) {
    if (dragState.isDragging) {
      // Update schedule date and time
      if (dragState.targetDate && dragState.targetTime) {
        const scheduleIndex = schedules.findIndex(s => s.id === dragState.scheduleId);
        if (scheduleIndex !== -1) {
          schedules[scheduleIndex].date = dragState.targetDate;
          schedules[scheduleIndex].time = dragState.targetTime;
          renderCurrentView();
        }
      }
    } else if (dragState.isResizing) {
      // Calculate new end time based on height
      if (dragState.scheduleElement) {
        const element = dragState.scheduleElement;
        const timeSlot = element.closest('.day-time-slot');
        if (timeSlot) {
          const startTime = dragState.startTime;
          const [startHour, startMin] = startTime.split(':').map(Number);
          const height = element.offsetHeight;
          const timeSlotHeight = 40;
          const durationMinutes = Math.round((height / timeSlotHeight) * 60);
          
          const startDate = new Date(`2000-01-01T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`);
          const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
          const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
          
          // Update schedule (in real app, would update end time field)
          const scheduleIndex = schedules.findIndex(s => s.id === dragState.scheduleId);
          if (scheduleIndex !== -1) {
            // Store end time if needed
            schedules[scheduleIndex].endTime = endTime;
            renderCurrentView();
          }
        }
      }
    }
    
    // Cleanup
    dragState.isDragging = false;
    dragState.isResizing = false;
    if (dragState.scheduleElement) {
      dragState.scheduleElement.classList.remove('dragging');
    }
    dragState.scheduleElement = null;
    dragState.targetDate = null;
    dragState.targetTime = null;
    
    // Remove global handlers
    if (mouseMoveHandler) {
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
      mouseMoveHandler = null;
      mouseUpHandler = null;
    }
  }
  
  function openScheduleModal(dateStr = null, scheduleId = null, defaultTime = null) {
    const modal = document.getElementById('schedule-modal');
    const form = document.getElementById('schedule-form');
    const modalTitle = document.getElementById('modal-title');
    const deleteBtn = document.getElementById('modal-delete');
    
    form.reset();
    document.getElementById('schedule-id').value = '';
    
    if (scheduleId) {
      const schedule = schedules.find(s => s.id === scheduleId);
      if (schedule) {
        modalTitle.textContent = 'スケジュールを編集';
        deleteBtn.classList.remove('hidden');
        document.getElementById('schedule-id').value = schedule.id;
        document.getElementById('schedule-title').value = schedule.client_name || '';
        document.getElementById('schedule-date').value = schedule.date;
        const [startHour, startMin] = schedule.time.split(':');
        document.getElementById('schedule-time-start').value = `${startHour}:${startMin}`;
        // Assume 1 hour duration
        const endTime = new Date(`2000-01-01T${startHour}:${startMin}`);
        endTime.setHours(endTime.getHours() + 1);
        document.getElementById('schedule-time-end').value = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
        document.getElementById('schedule-calendar-type').value = schedule.purpose;
        document.getElementById('schedule-client').value = schedule.client_id || '';
        document.getElementById('schedule-store').value = schedule.store_name || '';
        document.getElementById('schedule-address').value = schedule.address || '';
        document.getElementById('schedule-notes').value = schedule.notes || '';
      }
    } else {
      modalTitle.textContent = 'スケジュールを作成';
      deleteBtn.classList.add('hidden');
      if (dateStr) {
        document.getElementById('schedule-date').value = dateStr;
      }
      if (defaultTime) {
        document.getElementById('schedule-time-start').value = defaultTime;
        const [hour, min] = defaultTime.split(':');
        const endTime = new Date(`2000-01-01T${hour}:${min}`);
        endTime.setHours(endTime.getHours() + 1);
        document.getElementById('schedule-time-end').value = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
      }
    }
    
    modal.classList.remove('hidden');
  }
  
  function closeScheduleModal() {
    document.getElementById('schedule-modal').classList.add('hidden');
  }
  
  function handleScheduleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const scheduleId = formData.get('id');
    
    const schedule = {
      id: scheduleId || `schedule-${Date.now()}`,
      date: formData.get('date'),
      time: formData.get('time_start'),
      client_id: formData.get('client_id'),
      client_name: getClientName(formData.get('client_id')) || formData.get('title'),
      store_name: formData.get('store_name'),
      purpose: formData.get('calendar_type'),
      address: formData.get('address'),
      notes: formData.get('notes'),
      status: 'upcoming'
    };
    
    if (scheduleId) {
      const index = schedules.findIndex(s => s.id === scheduleId);
      if (index !== -1) {
        schedules[index] = schedule;
      }
    } else {
      schedules.push(schedule);
    }
    
    closeScheduleModal();
    renderCurrentView();
    alert('スケジュールを保存しました');
  }
  
  function handleScheduleDelete() {
    const scheduleId = document.getElementById('schedule-id').value;
    if (!scheduleId) return;
    
    if (confirm('このスケジュールを削除しますか？')) {
      schedules = schedules.filter(s => s.id !== scheduleId);
      closeScheduleModal();
      renderCurrentView();
      alert('スケジュールを削除しました');
    }
  }
  
  function populateClientSelect() {
    const select = document.getElementById('schedule-client');
    select.innerHTML = '<option value="">選択してください</option>';
    
    if (clientsData.clients) {
      clientsData.clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.company_name;
        select.appendChild(option);
      });
    }
  }
  
  function getClientName(clientId) {
    if (!clientsData.clients) return '';
    const client = clientsData.clients.find(c => c.id === clientId);
    return client ? client.company_name : '';
  }
  
  function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }
  
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  function formatDateDisplay(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  }
})();

