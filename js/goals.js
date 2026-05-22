(function(){
  'use strict';

  const ANTHROPIC_API_KEY = '';

  // ----------- Storage helpers -----------
  function storeGet(key) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? null : JSON.parse(v);
    } catch (e) { return null; }
  }
  function storeSet(key, value) {
    if (Array.isArray(value)) {
      value = value.filter(function(g) { return g && typeof g === 'object'; });
    }
    localStorage.setItem(key, JSON.stringify(value));
    if (typeof key === 'string' && key.startsWith('goals:')) {
      window.dispatchEvent(new CustomEvent('goals-changed'));
    }
  }
  function storeDelete(key) { localStorage.removeItem(key); }
  function storeListKeys(prefix) {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
    return out;
  }

  // Confirmation modal
  function showConfirm(message, onConfirm, isDanger) {
    const overlay = $('confirmOverlay');
    const okBtn = $('confirmOk');
    const cancelBtn = $('confirmCancel');
    const _focus = document.activeElement;
    $('confirmMessage').textContent = message;
    okBtn.classList.toggle('is-danger', !!isDanger);
    overlay.classList.add('show');
    setTimeout(() => cancelBtn.focus(), 60);
    const cleanup = () => {
      overlay.classList.remove('show');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      if (_focus) _focus.focus();
    };
    okBtn.onclick = () => { cleanup(); onConfirm(); };
    cancelBtn.onclick = cleanup;
  }
  window.showConfirm = showConfirm;

  function showAlert(msg) {
    const overlay = $('confirmOverlay');
    const cancelBtn = $('confirmCancel');
    const okBtn = $('confirmOk');
    const _focus = document.activeElement;
    $('confirmMessage').textContent = msg;
    okBtn.classList.remove('is-danger');
    cancelBtn.style.display = 'none';
    overlay.classList.add('show');
    setTimeout(() => okBtn.focus(), 60);
    okBtn.onclick = () => {
      overlay.classList.remove('show');
      cancelBtn.style.display = '';
      okBtn.onclick = null;
      if (_focus) _focus.focus();
    };
  }
  window.showAlert = showAlert;

  // ----------- Date helpers -----------
  function dateToYMD(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function getActiveDateString() {
    return dateToYMD(new Date());
  }
  function getTomorrowDateString() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return dateToYMD(d);
  }
  const WEEKDAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function formatDate(ymd) {
    const parts = ymd.split('-').map(Number);
    const d = new Date(parts[0], parts[1]-1, parts[2]);
    return WEEKDAY_SHORT[d.getDay()] + ', ' + MONTH_SHORT[d.getMonth()] + ' ' + d.getDate();
  }

  // ----------- Streak -----------
  const STREAK_KEY = 'goal_streak_v1';
  var FOCUS_SESSION_KEY = 'focus_session_v1';
  function checkStreak() {
    const activeDate = getActiveDateString();
    const state = storeGet(STREAK_KEY) || { count: 0, lastProcessedDate: null };
    const keys = storeListKeys('goals:')
      .map(k => k.slice('goals:'.length))
      .filter(d => d < activeDate)
      .sort();

    let count = state.count;
    let last = state.lastProcessedDate;
    for (const d of keys) {
      if (last && d <= last) continue;
      const arr = storeGet('goals:' + d) || [];
      if (arr.length === 0) {
        last = d;
        continue;
      }
      const allDone = arr.every(g => g && typeof g === 'object' && g.done);
      count = allDone ? count + 1 : 0;
      last = d;
    }
    storeSet(STREAK_KEY, { count, lastProcessedDate: last });
    return { count };
  }

  // ----------- DOM refs -----------
  const $ = (id) => document.getElementById(id);
  const todayLabel = $('todayLabel');
  const tomorrowLabel = $('tomorrowLabel');
  const gmStreak = $('gmStreak');
  const gmStreakNum = $('gmStreakNum');
  const goalList = $('goalList');
  const emptyState = $('emptyState');
  const goalInput = $('goalInput');
  const goalAddBtn = $('goalAddBtn');
  const goalPolishBtn = $('goalPolishBtn');
  const polishStatus = $('polishStatus');
  const gmPushBtn = $('gmPushBtn');
  const gmCardToday = $('gmCardToday');

  const tomorrowList = $('tomorrowList');
  const tomorrowEmpty = $('tomorrowEmpty');
  const tomorrowInput = $('tomorrowInput');
  const tomorrowAddBtn = $('tomorrowAddBtn');
  const tomorrowPolishBtn = $('tomorrowPolishBtn');
  const tomorrowStatus = $('tomorrowStatus');
  const gmTomorrowCount = $('gmTomorrowCount');
  const priorityPill = $('priorityPill');
  const priorityPillText = $('priorityPillText');

  // ----------- Inline edit -----------
  function makeInlineEdit(textEl, getGoals, idx, key, reload) {
    textEl.addEventListener('click', () => {
      if (textEl.getAttribute('contenteditable') === 'true') return;
      textEl.setAttribute('contenteditable', 'true');
      textEl.focus();
      const range = document.createRange();
      range.selectNodeContents(textEl);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    let cancelled = false;
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); textEl.blur(); }
      else if (e.key === 'Escape') { cancelled = true; textEl.blur(); }
    });
    textEl.addEventListener('blur', () => {
      textEl.removeAttribute('contenteditable');
      const newText = textEl.textContent.trim();
      const goals = getGoals();
      if (cancelled) {
        cancelled = false;
        textEl.textContent = goals[idx] ? goals[idx].text : '';
        return;
      }
      if (!newText) {
        textEl.textContent = goals[idx] ? goals[idx].text : '';
        return;
      }
      if (goals[idx] && newText !== goals[idx].text) {
        goals[idx].text = newText;
        storeSet(key, goals);
        reload();
      }
    });
  }

  // ----------- Drag (reorder + cross-list) -----------
  function getDragData(e) {
    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  function wireDragReorder(li, dragHandle, idx, key, reload) {
    li.draggable = false;
    dragHandle.addEventListener('mousedown', () => { li.draggable = true; });
    dragHandle.addEventListener('mouseup', () => { li.draggable = false; });
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ key, idx }));
      e.dataTransfer.effectAllowed = 'move';
      li.style.opacity = '0.1';
    });
    li.addEventListener('dragend', () => {
      li.style.opacity = '';
      li.draggable = false;
    });
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      li.classList.add('is-dragover');
    });
    li.addEventListener('dragleave', () => {
      li.classList.remove('is-dragover');
    });
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      li.classList.remove('is-dragover');
      const data = getDragData(e);
      if (!data) return;
      const fromKey = data.key;
      const fromIdx = data.idx;
      const toKey = key;
      const toIdx = idx;
      if (fromKey === toKey && fromIdx === toIdx) return;
      const fromGoals = storeGet(fromKey) || [];
      if (!fromGoals[fromIdx]) return;
      const [moved] = fromGoals.splice(fromIdx, 1);
      storeSet(fromKey, fromGoals);
      const toGoals = storeGet(toKey) || [];
      toGoals.splice(toIdx, 0, moved);
      storeSet(toKey, toGoals);
      loadToday();
      loadTomorrow();
    });
  }

  // ----------- Container drop (for drops on empty list area) -----------
  function makeDropHandler(getTargetKey) {
    return function(e) {
      e.preventDefault();
      var data = getDragData(e);
      if (!data) return;
      var targetKey = getTargetKey();
      if (data.key === targetKey) return;
      var fromGoals = storeGet(data.key) || [];
      if (!fromGoals[data.idx]) return;
      var moved = fromGoals.splice(data.idx, 1)[0];
      storeSet(data.key, fromGoals);
      var toGoals = storeGet(targetKey) || [];
      toGoals.push(moved);
      storeSet(targetKey, toGoals);
      loadToday();
      loadTomorrow();
    };
  }

  function initDragContainers() {
    try {
      var pairs = [
        [goalList,     emptyState,   function() { return 'goals:' + getActiveDateString(); }],
        [tomorrowList, tomorrowEmpty, function() { return 'goals:' + getTomorrowDateString(); }],
      ];
      pairs.forEach(function(pair) {
        var list = pair[0], emptyEl = pair[1], getKey = pair[2];
        var handler = makeDropHandler(getKey);
        [list, emptyEl].forEach(function(el) {
          if (!el) return;
          el.addEventListener('dragover', function(e) { e.preventDefault(); });
          el.addEventListener('drop', handler);
        });
      });
    } catch (e) { /* drag containers not available */ }
  }

  // ----------- Build a goal row -----------
  function buildGoalRow(goal, idx, key, reload, readOnly) {
    const li = document.createElement('li');
    li.className = 'goal-item';
    if (goal.done) li.classList.add('is-done');
    if (goal.queued) li.classList.add('is-queued');

    const drag = document.createElement('span');
    drag.className = 'goal-drag';
    drag.textContent = '⋮⋮';
    drag.title = 'Drag to reorder';
    li.appendChild(drag);

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'goal-checkbox';
    cb.checked = !!goal.done;
    cb.addEventListener('change', () => {
      const goals = storeGet(key) || [];
      if (!goals[idx]) return;
      goals[idx].done = cb.checked;
      if (cb.checked) goals[idx].doneAt = Date.now();
      else delete goals[idx].doneAt;
      storeSet(key, goals);
      reload();
      checkStreak();
      renderStreak();
    });
    li.appendChild(cb);

    const KEYWORD_ICONS = [
      { keys: ['gym','workout','lift','chest','legs','arms','back','cardio','run','push','pull','squat'], icon: '💪' },
      { keys: ['standup','meeting','call','sync','review','interview','zoom','teams','slack'], icon: '👥' },
      { keys: ['budget','report','finance','invoice','billing','expense','tax','accounting'], icon: '📋' },
      { keys: ['grocery','shopping','store','market','buy','costco','trader'], icon: '🛒' },
      { keys: ['read','book','study','learn','course','lecture','class'], icon: '📚' },
      { keys: ['doctor','dentist','appointment','health','clinic','pharmacy'], icon: '🏥' },
      { keys: ['code','deploy','pr','commit','ticket','jira','debug','fix'], icon: '💻' },
      { keys: ['cook','meal','dinner','lunch','breakfast','recipe'], icon: '🍳' },
    ];
    var goalIconEl = null;
    var lowerText = (goal.text || '').toLowerCase();
    for (var ki = 0; ki < KEYWORD_ICONS.length; ki++) {
      if (KEYWORD_ICONS[ki].keys.some(function(k) { return lowerText.indexOf(k) !== -1; })) {
        goalIconEl = document.createElement('span');
        goalIconEl.className = 'goal-kw-icon';
        goalIconEl.textContent = KEYWORD_ICONS[ki].icon;
        li.appendChild(goalIconEl);
        break;
      }
    }

    const text = document.createElement('div');
    text.className = 'goal-text';
    text.textContent = goal.text;
    li.appendChild(text);
    makeInlineEdit(text, () => storeGet(key) || [], idx, key, reload);

    const queueBtn = document.createElement('button');
    queueBtn.className = 'gm-queue-btn';
    queueBtn.type = 'button';
    queueBtn.textContent = '⚡';
    queueBtn.title = 'Queue for productivity window';
    if (goal.queued) queueBtn.classList.add('is-active');
    if (readOnly) queueBtn.disabled = true;
    queueBtn.addEventListener('click', () => {
      if (readOnly) return;
      const goals = storeGet(key) || [];
      if (!goals[idx]) return;
      goals[idx].queued = !goals[idx].queued;
      storeSet(key, goals);
      queueBtn.classList.remove('is-popping');
      void queueBtn.offsetWidth;
      queueBtn.classList.add('is-popping');
      queueBtn.addEventListener('animationend', () => queueBtn.classList.remove('is-popping'), { once: true });
      const heroEl = document.getElementById('priorityPillTextHero');
      if (heroEl) {
        heroEl.classList.remove('is-flashing');
        void heroEl.offsetWidth;
        heroEl.classList.add('is-flashing');
        heroEl.addEventListener('animationend', () => heroEl.classList.remove('is-flashing'), { once: true });
      }
      setTimeout(() => { reload(); }, 460);
    });
    li.appendChild(queueBtn);

    const del = document.createElement('button');
    del.className = 'goal-delete';
    del.type = 'button';
    del.textContent = '×';
    del.title = 'Delete';
    del.addEventListener('click', () => {
      li.classList.add('is-removing');
      setTimeout(() => {
        const goals = storeGet(key) || [];
        goals.splice(idx, 1);
        storeSet(key, goals);
        reload();
      }, 280);
    });
    li.appendChild(del);

    wireDragReorder(li, drag, idx, key, reload);

    return li;
  }

  // ----------- Today header / streak -----------
  function renderTodayHeader() {
    const key = 'goals:' + getActiveDateString();
    const goals = storeGet(key) || [];

    const undone = goals.filter(g => !g.done).length;
    gmPushBtn.style.display = undone > 0 ? 'block' : 'none';
  }

  function renderStreak() {
    const state = storeGet(STREAK_KEY) || { count: 0 };
    const todayKey = 'goals:' + getActiveDateString();
    const today = storeGet(todayKey) || [];
    const todayAllDone = today.length > 0 && today.every(g => g && typeof g === 'object' && g.done);
    const streak = state.count + (todayAllDone ? 1 : 0);
    gmStreakNum.textContent = String(streak);
    if (streak > 0) gmStreak.classList.add('gm-streak-active');
    else gmStreak.classList.remove('gm-streak-active');
  }

  function renderTomorrowCount() {
    const key = 'goals:' + getTomorrowDateString();
    const goals = storeGet(key) || [];
    gmTomorrowCount.textContent = goals.length + ' planned';
    tomorrowLabel.textContent = 'Tomorrow — ' + formatDate(getTomorrowDateString());
  }

  // ----------- Render list with show-more -----------
  function renderListInto(goals, listEl, emptyEl, key, readOnly) {
    listEl.innerHTML = '';
    if (!goals || goals.length === 0) {
      emptyEl.style.display = 'flex';
    } else {
      emptyEl.style.display = 'none';
      const reload = readOnly ? loadTomorrow : loadToday;
      const limit = 5;
      const visible = goals.length > limit ? limit : goals.length;
      for (let i = 0; i < visible; i++) {
        listEl.appendChild(buildGoalRow(goals[i], i, key, reload, readOnly));
      }
      if (goals.length > limit) {
        const expanded = listEl.dataset.expanded === '1';
        if (expanded) {
          for (let i = limit; i < goals.length; i++) {
            listEl.appendChild(buildGoalRow(goals[i], i, key, reload, readOnly));
          }
        }
        const toggle = document.createElement('button');
        toggle.className = 'gm-show-more';
        toggle.type = 'button';
        toggle.textContent = expanded
          ? 'Show less ▴'
          : ('Show ' + (goals.length - limit) + ' more ▾');
        toggle.addEventListener('click', () => {
          listEl.dataset.expanded = expanded ? '0' : '1';
          renderListInto(goals, listEl, emptyEl, key, readOnly);
        });
        listEl.appendChild(toggle);
      }
    }
    if (readOnly) renderTomorrowCount();
    else renderTodayHeader();
  }

  function cleanGoals(arr) {
    return (arr || []).filter(function(g) { return g && typeof g === 'object'; });
  }
  function loadToday() {
    const key = 'goals:' + getActiveDateString();
    const goals = cleanGoals(storeGet(key));
    renderListInto(goals, goalList, emptyState, key, false);
  }
  function loadTomorrow() {
    const key = 'goals:' + getTomorrowDateString();
    const goals = cleanGoals(storeGet(key));
    renderListInto(goals, tomorrowList, tomorrowEmpty, key, true);
  }

  // ----------- Push remaining -----------
  gmPushBtn.addEventListener('click', () => {
    showConfirm('Move all unchecked goals to tomorrow?', () => {
      const todayKey = 'goals:' + getActiveDateString();
      const tomorrowKey = 'goals:' + getTomorrowDateString();
      const today = storeGet(todayKey) || [];
      const tomorrow = storeGet(tomorrowKey) || [];
      const tomorrowTexts = new Set(tomorrow.map(g => g.text));
      const remaining = today.filter(g => !g.done);
      for (const g of remaining) {
        if (!tomorrowTexts.has(g.text)) {
          tomorrow.push({ text: g.text, done: false });
          tomorrowTexts.add(g.text);
        }
      }
      const kept = today.filter(g => g.done);
      storeSet(todayKey, kept);
      storeSet(tomorrowKey, tomorrow);
      loadToday();
      loadTomorrow();
    });
  });

  // ----------- Add handlers -----------
  function makeAddHandlers(input, addBtn, getKey, reload) {
    function doAdd(text) {
      const t = text.trim();
      if (!t) return;
      const key = getKey();
      const goals = storeGet(key) || [];
      goals.push({ text: t, done: false });
      storeSet(key, goals);
      input.value = '';
      reload();
    }
    addBtn.addEventListener('click', () => doAdd(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doAdd(input.value); }
    });
  }

  makeAddHandlers(goalInput, goalAddBtn,
    () => 'goals:' + getActiveDateString(), loadToday);
  makeAddHandlers(tomorrowInput, tomorrowAddBtn,
    () => 'goals:' + getTomorrowDateString(), loadTomorrow);

  // ============ TICKER ============
  const tickerStage = $('goalTickerStage');
  const tickerMeta = $('goalTickerMeta');
  let cycleIdx = 0;
  let tickerInterval = null;
  let firstRender = true;
  let isTransitioning = false;

  function buildTickerItems() {
    const key = 'goals:' + getActiveDateString();
    const goals = storeGet(key) || [];
    const total = goals.length;
    const done = goals.filter(g => g.done).length;
    let items;
    if (total === 0) {
      items = [{ status: 'empty', text: 'No goals set for today — add one to get rolling.' }];
    } else if (done === total) {
      items = [{ status: 'done', text: ' All goals done — good shit.' }];
    } else {
      items = goals.filter(g => !g.done).map(g => ({ status: 'pending', text: g.text }));
    }
    return { items, done, total };
  }

  function makeTickerRowEl(item) {
    const row = document.createElement('div');
    row.className = 'goal-ticker-row';
    const st = document.createElement('span');
    st.className = 'goal-ticker-status';
    st.setAttribute('data-status', item.status || '');
    if (item.status === 'done') st.textContent = '✓';
    else if (item.status === 'pending') st.textContent = '○';
    else st.textContent = '·';
    const tx = document.createElement('span');
    tx.className = 'goal-ticker-text';
    tx.textContent = item.text;
    row.appendChild(st);
    row.appendChild(tx);
    return row;
  }

  function tick() {
    if (isTransitioning) return;
    if (!tickerStage) return;

    const { items, done, total } = buildTickerItems();
    if (cycleIdx >= items.length) cycleIdx = 0;
    const item = items[cycleIdx];

    tickerMeta.textContent = done + '/' + total;

    const existing = tickerStage.querySelector('.goal-ticker-row');
    const fresh = makeTickerRowEl(item);

    if (firstRender || !existing) {
      tickerStage.innerHTML = '';
      tickerStage.appendChild(fresh);
      firstRender = false;
      cycleIdx = (cycleIdx + 1) % items.length;
      return;
    }

    isTransitioning = true;
    existing.classList.add('is-leaving');

    let finished = false;
    function finishTransition() {
      if (finished) return;
      finished = true;
      isTransitioning = false;
      existing.remove();
      fresh.classList.add('is-entering');
      tickerStage.appendChild(fresh);
      cycleIdx = (cycleIdx + 1) % items.length;
    }

    existing.addEventListener('animationend', function onLeave() {
      existing.removeEventListener('animationend', onLeave);
      finishTransition();
    });
    setTimeout(finishTransition, 500);
  }

  function startTicker() {
    if (!tickerStage) return;
    tick();
    tickerInterval = setInterval(tick, 5000);
  }

  window.addEventListener('goals-changed', () => {
    cycleIdx = 0;
    tick();
    updateDayBar();
  });

  // ============ DAY RING ============
  const RING_R = 52;
  const RING_C = 2 * Math.PI * RING_R;
  const BLOCKS_KEY = 'day_ring_blocks_v1';

  const BLOCKS_DEFAULT = [
    { name: 'Morning',   start: 6,  end: 12, color: '#D4A373' },
    { name: 'Afternoon', start: 12, end: 17, color: '#F2A65A' },
    { name: 'Evening',   start: 17, end: 21, color: '#E25D7A' },
    { name: 'Night',     start: 21, end: 24, color: '#7B5CB8' },
    { name: 'Sleep',     start: 0,  end: 6,  color: '#5555AA' }
  ];

  const BLOCK_STATUS = {
    Morning:   ['☀️', 'Morning — fresh start'],
    Afternoon: ['⚡',  'Afternoon — keep moving'],
    Evening:   ['🔥', 'Evening — push it'],
    Night:     ['🌙', 'Night — wind down'],
    Sleep:     ['😴', 'Sleep — rest up']
  };

  const dayRingFill = $('dayRingFill');
  const dayRingPercent = $('dayRingPercent');
  const dayRingPhase = $('dayRingPhase');
  const dayRingStatus = $('dayRingStatus');
  const dayRingRange = $('dayRingRange');

  dayRingFill.setAttribute('stroke-dasharray', String(RING_C));
  dayRingFill.setAttribute('stroke-dashoffset', String(RING_C));

  let _cachedBlocks = null;

  function loadBlocks() {
    if (_cachedBlocks) return _cachedBlocks;
    let blocks = storeGet(BLOCKS_KEY);
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      blocks = BLOCKS_DEFAULT;
      storeSet(BLOCKS_KEY, blocks);
    }
    _cachedBlocks = blocks;
    return blocks;
  }

  function saveBlocks(blocks) {
    _cachedBlocks = null;
    storeSet(BLOCKS_KEY, blocks);
  }

  function formatBlockTime(hours) {
    if (hours >= 24) hours = 0;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    let h = Math.floor(hours) % 12;
    if (h === 0) h = 12;
    const m = pad2(Math.round((hours - Math.floor(hours)) * 60));
    return h + ':' + m + ' ' + ampm;
  }

  function hoursToTimeInput(h) {
    if (h >= 24) h = 0;
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return pad2(hh) + ':' + pad2(mm);
  }

  function timeInputToHours(val) {
    const parts = val.split(':');
    return Number(parts[0]) + Number(parts[1]) / 60;
  }

  function findCurrentBlock(blocks, hours) {
    for (const b of blocks) {
      if (hours >= b.start && hours < b.end) return b;
    }
    return blocks[0];
  }

  function updateDayBar() {
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

    const blocks = loadBlocks();
    const block = findCurrentBlock(blocks, hours);

    const percent = (hours / 24) * 100;
    const offset = RING_C * (1 - percent / 100);
    dayRingFill.setAttribute('stroke-dashoffset', String(offset));
    dayRingFill.style.stroke = block.color;
    dayRingPercent.textContent = Math.floor(percent) + '%';
    dayRingPhase.textContent = block.name.toUpperCase();

    const meta = BLOCK_STATUS[block.name] || ['•', block.name];
    dayRingStatus.textContent = meta[0] + ' ' + meta[1];

    dayRingRange.textContent = formatBlockTime(block.start) + ' – ' + formatBlockTime(block.end);
  }

  // ============ DAY RING SETTINGS MODAL ============
  const drModalBg = $('drModalBg');
  const drModalBody = $('drModalBody');
  const drSettingsBtn = $('drSettingsBtn');
  const drModalX = $('drModalX');

  let drLastFocus = null;

  function closeDrModal() {
    drModalBg.classList.remove('show');
    if (drLastFocus) { drLastFocus.focus(); drLastFocus = null; }
  }

  function openDrModal() {
    const blocks = loadBlocks();
    drModalBody.innerHTML = '';
    blocks.forEach((b, i) => {
      const row = document.createElement('div');
      row.className = 'dr-block';

      const name = document.createElement('div');
      name.className = 'dr-block-name';
      name.textContent = b.name;
      row.appendChild(name);

      const startIn = document.createElement('input');
      startIn.type = 'time';
      startIn.className = 'dr-time-input';
      startIn.value = hoursToTimeInput(b.start);
      startIn.addEventListener('change', function onChange() {
        const updated = loadBlocks();
        updated[i].start = timeInputToHours(this.value);
        saveBlocks(updated);
        updateDayBar();
      });
      row.appendChild(startIn);

      const arrow = document.createElement('span');
      arrow.className = 'dr-block-to';
      arrow.textContent = '→';
      row.appendChild(arrow);

      const endIn = document.createElement('input');
      endIn.type = 'time';
      endIn.className = 'dr-time-input';
      endIn.value = hoursToTimeInput(b.end);
      endIn.addEventListener('change', function onChange() {
        const updated = loadBlocks();
        updated[i].end = timeInputToHours(this.value);
        saveBlocks(updated);
        updateDayBar();
      });
      row.appendChild(endIn);

      const colorWrap = document.createElement('div');
      colorWrap.className = 'dr-color-wrap';
      const colorIn = document.createElement('input');
      colorIn.type = 'color';
      colorIn.value = b.color;
      colorIn.addEventListener('input', function onChange() {
        const updated = loadBlocks();
        updated[i].color = this.value;
        saveBlocks(updated);
        updateDayBar();
      });
      colorWrap.appendChild(colorIn);
      row.appendChild(colorWrap);

      drModalBody.appendChild(row);
    });
    drModalBg.classList.add('show');
    setTimeout(() => { const f = drModalBg.querySelector('button, input'); if (f) f.focus(); }, 60);
  }

  drSettingsBtn.addEventListener('click', () => { drLastFocus = document.activeElement; openDrModal(); });
  drModalX.addEventListener('click', closeDrModal);
  drModalBg.addEventListener('click', function onBg(e) {
    if (e.target === drModalBg) closeDrModal();
  });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key !== 'Escape') return;
    if ($('confirmOverlay').classList.contains('show')) {
      const cancelBtn = $('confirmCancel');
      if (cancelBtn.onclick) {
        cancelBtn.onclick();
      } else {
        $('confirmOk').onclick && $('confirmOk').onclick();
      }
    } else if (drModalBg.classList.contains('show')) {
      closeDrModal();
    }
  });

  // ============ GREETING ============
  function updateGreeting() {
    const periodEl = $('greetPeriod');
    const subtitleEl = $('greetSubtitle');
    if (!periodEl && !subtitleEl) return;

    const now = new Date();
    const h = now.getHours();
    let period;
    if (h >= 5 && h < 12) period = 'morning';
    else if (h >= 12 && h < 17) period = 'afternoon';
    else if (h >= 17 && h < 21) period = 'evening';
    else period = 'night';

    if (periodEl) periodEl.textContent = period;

    if (subtitleEl) {
      const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
      const blocks = loadBlocks();
      const block = findCurrentBlock(blocks, hours);
      if (block) {
        const total = block.end - block.start;
        const elapsed = hours - block.start;
        const pct = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;
        subtitleEl.textContent = 'You\'re ' + pct + '% through your ' + block.name.toLowerCase() + ' session.';
      }
    }
  }
  window.updateGreeting = updateGreeting;

  // ============ PERFORMANCE OVERVIEW PANEL ============
  function renderStatsPanel() {
    var now = new Date();
    if (now.getHours() < 6) now.setDate(now.getDate() - 1);
    var todayYmd = now.getFullYear() + '-' + pad2(now.getMonth()+1) + '-' + pad2(now.getDate());

    // ── Focus time (today + live session) ──
    var health = {};
    try { health = JSON.parse(localStorage.getItem('health:' + todayYmd) || '{}'); } catch(e) {}
    var focusMin = Math.round(health.focus_min || 0);
    try {
      var fs = JSON.parse(localStorage.getItem(FOCUS_SESSION_KEY) || '{}');
      if (fs.running && fs.startedAt) focusMin += Math.floor((Date.now() - fs.startedAt) / 60000);
    } catch(e) {}
    var focusStr = focusMin >= 60 ? Math.floor(focusMin/60) + 'h ' + (focusMin%60) + 'm' : focusMin + 'm';

    var focusEl = $('perfFocusTime');
    if (focusEl) focusEl.textContent = focusStr;

    // ── Trend vs yesterday ──
    var yd = new Date(now); yd.setDate(yd.getDate() - 1);
    var ydYmd = yd.getFullYear() + '-' + pad2(yd.getMonth()+1) + '-' + pad2(yd.getDate());
    var ydHealth = {};
    try { ydHealth = JSON.parse(localStorage.getItem('health:' + ydYmd) || '{}'); } catch(e) {}
    var ydMin = Math.round(ydHealth.focus_min || 0);
    var trendEl = $('perfTrend');
    if (trendEl) {
      if (ydMin === 0 || focusMin === 0) {
        trendEl.textContent = '';
        trendEl.className = 'po-trend-val';
      } else {
        var diff = focusMin - ydMin;
        var pct = Math.abs(Math.round((diff / ydMin) * 100));
        trendEl.textContent = (diff >= 0 ? '↑ ' : '↓ ') + pct + '%';
        trendEl.className = diff >= 0 ? 'po-trend-val' : 'po-trend-val negative';
      }
    }

    // ── Weekly bars: Mon–Sun of current week ──
    var dow = now.getDay(); // 0=Sun
    var mondayOffset = dow === 0 ? -6 : 1 - dow;
    var monday = new Date(now); monday.setDate(monday.getDate() + mondayOffset);
    var todayWeekIdx = dow === 0 ? 6 : dow - 1; // 0=Mon, 6=Sun

    var weekFocusMins = [];
    var weekDoneFlags = [];
    for (var wi = 0; wi < 7; wi++) {
      var wd = new Date(monday); wd.setDate(monday.getDate() + wi);
      var wymd = wd.getFullYear() + '-' + pad2(wd.getMonth()+1) + '-' + pad2(wd.getDate());
      var wh = {}; try { wh = JSON.parse(localStorage.getItem('health:' + wymd) || '{}'); } catch(e) {}
      weekFocusMins.push(Math.round(wh.focus_min || 0));
      var wg = storeGet('goals:' + wymd) || [];
      weekDoneFlags.push(wg.length > 0 && wg.some(function(g) { return g && g.done; }));
    }

    var maxFocus = Math.max.apply(null, weekFocusMins) || 1;
    var barsEl = $('perfWeekBars');
    if (barsEl) {
      barsEl.innerHTML = weekFocusMins.map(function(min, i) {
        var h = min > 0 ? Math.max(10, Math.round((min / maxFocus) * 46)) : 3;
        var cls = 'po-week-bar' + (min > 0 ? ' has-data' : '') + (i === todayWeekIdx ? ' is-today' : '');
        return '<div class="' + cls + '" style="height:' + h + 'px"></div>';
      }).join('');
    }
    document.querySelectorAll('.po-week-labels span').forEach(function(s, i) {
      s.classList.toggle('is-today', i === todayWeekIdx);
    });

    // ── Task completion ──
    var todayGoals = storeGet('goals:' + todayYmd) || [];
    var totalTasks = todayGoals.length;
    var doneTasks = todayGoals.filter(function(g) { return g && g.done; }).length;
    var taskRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    var taskRateEl = $('perfTaskRate'); if (taskRateEl) taskRateEl.textContent = taskRate + '%';
    var taskSubEl = $('perfTaskSub'); if (taskSubEl) taskSubEl.textContent = doneTasks + ' / ' + totalTasks + ' tasks';
    var taskFillEl = $('perfTaskFill'); if (taskFillEl) taskFillEl.style.width = taskRate + '%';

    // ── Readiness (derived from logged health data) ──
    var settings = {}; try { settings = JSON.parse(localStorage.getItem('health_settings') || '{}'); } catch(e) {}
    var sleepGoal = settings.sleep_goal_hours || 8;
    var factors = [];
    if (health.sleep_hours != null) factors.push(Math.min(health.sleep_hours / sleepGoal, 1));
    if (health.energy_score != null) factors.push((health.energy_score - 1) / 4);
    var readinessScore = factors.length > 0 ? Math.round((factors.reduce(function(a,b){return a+b;},0) / factors.length) * 100) : null;
    var readinessLabel = readinessScore == null ? '—' : readinessScore >= 80 ? 'Strong' : readinessScore >= 60 ? 'Good' : readinessScore >= 40 ? 'Fair' : 'Low';

    var readEl = $('perfReadiness'); if (readEl) readEl.textContent = readinessScore != null ? readinessScore : '—';
    var readSubEl = $('perfReadinessSub'); if (readSubEl) readSubEl.textContent = readinessLabel;
    var readFillEl = $('perfReadinessFill'); if (readFillEl) readFillEl.style.width = (readinessScore || 0) + '%';

    // ── Weekly consistency dots ──
    var consistencyCount = weekDoneFlags.filter(Boolean).length;
    var countEl = $('perfConsistencyCount'); if (countEl) countEl.textContent = consistencyCount + ' of 7 days';

    var DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    var dotsEl = $('perfDots');
    if (dotsEl) {
      dotsEl.innerHTML = weekDoneFlags.map(function(done, i) {
        var wrapCls = 'po-dot-wrap' + (done ? ' done' : '') + (i === todayWeekIdx ? ' today' : '');
        return '<div class="' + wrapCls + '"><div class="po-dot"></div><span class="po-dot-label">' + DAY_LABELS[i] + '</span></div>';
      }).join('');
    }

    var copyEl = $('perfMicrocopy');
    if (copyEl) {
      var remaining = 7 - consistencyCount;
      copyEl.textContent = consistencyCount === 7 ? 'Perfect week. That\'s elite.'
        : consistencyCount >= 5 ? 'Keep it up! You\'re building momentum.'
        : consistencyCount >= 3 ? (remaining === 1 ? 'One more day to close the week strong.' : remaining + ' days left to build a strong week.')
        : consistencyCount >= 1 ? 'You\'re building momentum. Keep going.'
        : 'Start building momentum today.';
    }

    // ── Legacy optional refs (health tab hero display) ──
    var heroTime = $('focusStatTime'); if (heroTime) heroTime.textContent = focusStr;
    var heroDone = $('focusStatDone'); if (heroDone) heroDone.textContent = String(doneTasks);
    var heroStreak = $('focusStatStreak');
    if (heroStreak) {
      var ss = storeGet(STREAK_KEY) || { count: 0 };
      var todayAllDone = totalTasks > 0 && todayGoals.every(function(g) { return g && g.done; });
      heroStreak.textContent = ss.count + (todayAllDone ? 1 : 0);
    }
  }
  window.renderStatsPanel = renderStatsPanel;

  // ============ CALENDAR ============
  var calState = (function() { var d = new Date(); return { year: d.getFullYear(), month: d.getMonth(), dir: null }; })();

  function renderCalendar(year, month) {
    year = year || calState.year;
    month = (month !== undefined) ? month : calState.month;
    calState.year = year;
    calState.month = month;

    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var labelEl = $('calMonthLabel');
    if (labelEl) {
      if (calState.dir) {
        labelEl.classList.add('is-changing');
        setTimeout(function() {
          labelEl.textContent = months[month] + ' ' + year;
          labelEl.classList.remove('is-changing');
        }, 80);
      } else {
        labelEl.textContent = months[month] + ' ' + year;
      }
    }

    var grid = $('calGrid');
    if (!grid) return;

    var today = new Date();
    var todayYMD = today.getFullYear() + '-' + pad2(today.getMonth() + 1) + '-' + pad2(today.getDate());

    var firstDay = new Date(year, month, 1).getDay();
    var offset = firstDay === 0 ? 6 : firstDay - 1;
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    var html = '';

    var dayHeaders = ['Mo','Tu','We','Th','Fr','Sa','Su'];
    dayHeaders.forEach(function(d) {
      html += '<div class="cal-dow">' + d + '</div>';
    });

    var prevMonthDays = new Date(year, month, 0).getDate();
    for (var i = offset - 1; i >= 0; i--) {
      html += '<div class="cal-day out">' + (prevMonthDays - i) + '</div>';
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var ymd = year + '-' + pad2(month + 1) + '-' + pad2(day);
      var isToday = ymd === todayYMD;
      var goals = storeGet('goals:' + ymd);
      var hasGoals = goals && goals.length > 0;

      html += '<div class="cal-day' + (isToday ? ' is-today' : '') + '">' + day;
      if (hasGoals) html += '<span class="cal-dot"></span>';
      html += '</div>';
    }

    var remaining = 49 - 7 - offset - daysInMonth;
    var nextMonthDay = 1;
    for (var i = 0; i < remaining; i++) {
      html += '<div class="cal-day out">' + nextMonthDay + '</div>';
      nextMonthDay++;
    }

    grid.classList.remove('anim-next', 'anim-prev');
    grid.innerHTML = html;

    if (calState.dir) {
      var animClass = calState.dir === 'next' ? 'anim-next' : 'anim-prev';
      requestAnimationFrame(function() { grid.classList.add(animClass); });
    }
  }
  window.renderCalendar = renderCalendar;

  function initCalendar() {
    var prevBtn = $('calPrev');
    var nextBtn = $('calNext');
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        calState.dir = 'prev';
        calState.month--;
        if (calState.month < 0) { calState.month = 11; calState.year--; }
        renderCalendar(calState.year, calState.month);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        calState.dir = 'next';
        calState.month++;
        if (calState.month > 11) { calState.month = 0; calState.year++; }
        renderCalendar(calState.year, calState.month);
      });
    }
  }

  // ============ FOCUS TIMER ============
  var _focusTimerInterval = null;

  function getFocusSession() {
    try { return JSON.parse(localStorage.getItem(FOCUS_SESSION_KEY)) || { running: false, startedAt: null, accumulatedMin: 0 }; }
    catch(e) { return { running: false, startedAt: null, accumulatedMin: 0 }; }
  }

  function saveFocusSession(s) { localStorage.setItem(FOCUS_SESSION_KEY, JSON.stringify(s)); }

  function _updateFocusStatUI() {
    var toggle = $('focusStatToggle');
    var dot = $('focusRunningDot');
    if (!toggle) return;
    var session = getFocusSession();
    if (session.running) {
      toggle.classList.add('is-running');
      if (dot) dot.style.display = '';
    } else {
      toggle.classList.remove('is-running');
      if (dot) dot.style.display = 'none';
    }
  }

  function _stopFocusSession() {
    clearInterval(_focusTimerInterval);
    var s = getFocusSession();
    var sessionMin = (Date.now() - s.startedAt) / 60000;
    s.running = false;
    s.startedAt = null;
    saveFocusSession(s);
    var td = new Date();
    if (td.getHours() < 6) td.setDate(td.getDate() - 1);
    var ymd = td.getFullYear() + '-' + pad2(td.getMonth()+1) + '-' + pad2(td.getDate());
    try {
      var health = JSON.parse(localStorage.getItem('health:' + ymd) || '{}');
      health.focus_min = (health.focus_min || 0) + Math.round(sessionMin);
      localStorage.setItem('health:' + ymd, JSON.stringify(health));
    } catch(e) {}
    window.dispatchEvent(new CustomEvent('focus-updated'));
    renderStatsPanel();
    _updateFocusStatUI();
  }

  function _startFocusSession() {
    var s = getFocusSession();
    s.running = true;
    s.startedAt = Date.now();
    saveFocusSession(s);
    _focusTimerInterval = setInterval(function() { _updateFocusStatUI(); }, 1000);
    _updateFocusStatUI();
  }

  function initFocusTimer() {
    var toggle = $('focusStatToggle');
    if (!toggle) return;

    var session = getFocusSession();
    if (session.running) {
      _focusTimerInterval = setInterval(function() { _updateFocusStatUI(); }, 1000);
    }
    _updateFocusStatUI();

    toggle.addEventListener('click', function() {
      var s = getFocusSession();
      if (s.running) _stopFocusSession();
      else _startFocusSession();
    });
  }

  // ============ FOCUS DATA FIX + EDIT ============
  function _migrateFocusCarryover() {
    if (localStorage.getItem('focus_migrated_v1')) return;
    var td = new Date();
    if (td.getHours() < 6) td.setDate(td.getDate() - 1);
    var todayYmd = td.getFullYear() + '-' + pad2(td.getMonth()+1) + '-' + pad2(td.getDate());
    var yd = new Date(td);
    yd.setDate(yd.getDate() - 1);
    var yesterdayYmd = yd.getFullYear() + '-' + pad2(yd.getMonth()+1) + '-' + pad2(yd.getDate());
    try {
      var todayHealth = JSON.parse(localStorage.getItem('health:' + todayYmd) || '{}');
      var carryover = Math.round(todayHealth.focus_min || 0);
      if (carryover > 0) {
        var yesterdayHealth = JSON.parse(localStorage.getItem('health:' + yesterdayYmd) || '{}');
        yesterdayHealth.focus_min = (yesterdayHealth.focus_min || 0) + carryover;
        localStorage.setItem('health:' + yesterdayYmd, JSON.stringify(yesterdayHealth));
        todayHealth.focus_min = 0;
        localStorage.setItem('health:' + todayYmd, JSON.stringify(todayHealth));
      }
    } catch(e) {}
    localStorage.setItem('focus_migrated_v1', '1');
  }

  function _initFocusEdit() {
    var btn = $('focusEditBtn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var td = new Date();
      if (td.getHours() < 6) td.setDate(td.getDate() - 1);
      var ymd = td.getFullYear() + '-' + pad2(td.getMonth()+1) + '-' + pad2(td.getDate());
      try {
        var health = JSON.parse(localStorage.getItem('health:' + ymd) || '{}');
        var current = Math.round(health.focus_min || 0);
        var input = prompt('Edit focus minutes for today:', current);
        if (input === null) return;
        var val = parseInt(input, 10);
        if (isNaN(val) || val < 0) return;
        health.focus_min = val;
        localStorage.setItem('health:' + ymd, JSON.stringify(health));
        renderStatsPanel();
        window.dispatchEvent(new CustomEvent('focus-updated'));
      } catch(e) {}
    });
  }

  // ============ INIT ============
  _migrateFocusCarryover();
  checkStreak();
  loadToday();
  loadTomorrow();
  initDragContainers();
  renderStreak();
  updateDayBar();
  updateGreeting();
  renderStatsPanel();
  renderCalendar();
  initCalendar();
  initFocusTimer();
  _initFocusEdit();
  setInterval(updateDayBar, 60 * 1000);

  startTicker();

})();
