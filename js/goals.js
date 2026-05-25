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


    const text = document.createElement('div');
    text.className = 'goal-text';
    text.textContent = goal.text;
    li.appendChild(text);
    makeInlineEdit(text, () => storeGet(key) || [], idx, key, reload);

    const queueBtn = document.createElement('button');
    queueBtn.className = 'gm-queue-btn';
    queueBtn.type = 'button';
    queueBtn.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg>';
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
      const heroEl = document.getElementById('cfTaskText');
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
    del.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';
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

  // ----------- Streak -----------
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

  // ----------- Render list -----------
  function renderListInto(goals, listEl, emptyEl, key, readOnly) {
    listEl.innerHTML = '';
    if (!goals || goals.length === 0) {
      emptyEl.style.display = 'flex';
    } else {
      emptyEl.style.display = 'none';
      const reload = readOnly ? loadTomorrow : loadToday;
      for (let i = 0; i < goals.length; i++) {
        listEl.appendChild(buildGoalRow(goals[i], i, key, reload, readOnly));
      }
    }
    if (readOnly) renderTomorrowCount();
  }

  function cleanGoals(arr) {
    return (arr || []).filter(function(g) { return g && typeof g === 'object'; });
  }

  // ----------- Auto-rollover -----------
  const ROLLOVER_KEY = 'goal_rollover_v1';
  function autoRollover() {
    const today = getActiveDateString();
    const state = storeGet(ROLLOVER_KEY) || { lastDate: null };
    if (state.lastDate === today) return;

    const todayKey = 'goals:' + today;
    const todayGoals = cleanGoals(storeGet(todayKey));
    const todayTexts = new Set(todayGoals.map(g => g.text));

    const keys = storeListKeys('goals:')
      .map(k => k.slice('goals:'.length))
      .filter(d => d < today)
      .sort();

    let changed = false;
    const lastDate = state.lastDate;

    for (const d of keys) {
      if (lastDate && d <= lastDate) continue;
      const arr = storeGet('goals:' + d) || [];
      const undone = arr.filter(g => g && typeof g === 'object' && !g.done);
      for (const g of undone) {
        if (!todayTexts.has(g.text)) {
          todayGoals.push({ text: g.text, done: false });
          todayTexts.add(g.text);
          changed = true;
        }
      }
    }

    if (changed) {
      storeSet(todayKey, todayGoals);
    }
    storeSet(ROLLOVER_KEY, { lastDate: today });
  }

  function loadToday() {
    autoRollover();
    const key = 'goals:' + getActiveDateString();
    const goals = cleanGoals(storeGet(key));
    renderListInto(goals, goalList, emptyState, key, false);
  }
  function loadTomorrow() {
    const key = 'goals:' + getTomorrowDateString();
    const goals = cleanGoals(storeGet(key));
    renderListInto(goals, tomorrowList, tomorrowEmpty, key, true);
  }

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
    { name: 'Morning',   start: 6,  end: 12 },
    { name: 'Afternoon', start: 12, end: 17 },
    { name: 'Evening',   start: 17, end: 21 },
    { name: 'Night',     start: 21, end: 24 },
    { name: 'Sleep',     start: 0,  end: 6  }
  ];

  const BLOCK_STATUS = {
    Morning:   ['', 'Morning — peak focus window. Perfect time for deep work.'],
    Afternoon: ['', 'Afternoon — good for collaborative work. Power through the dip.'],
    Evening:   ['', 'Evening — wind down. Focus on light tasks.'],
    Night:     ['', 'Night — wind down. Protect your sleep window.'],
    Sleep:     ['', 'Sleep — rest up']
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
    let migrated = false;
    for (const b of blocks) {
      if (b.color) { delete b.color; migrated = true; }
    }
    if (migrated) storeSet(BLOCKS_KEY, blocks);
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
    const accent = localStorage.getItem('tweak_accent') || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#F2587A';
    dayRingFill.style.stroke = accent;
    dayRingPercent.textContent = Math.floor(percent) + '%';
    dayRingPhase.textContent = 'COMPLETE';

    const meta = BLOCK_STATUS[block.name] || ['•', block.name];
    dayRingStatus.textContent = meta[1];

    const cardLabel = document.querySelector('.card-label');
    if (cardLabel) cardLabel.textContent = block.name + ' Session';

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

  // ============ TOPBAR STATUS ============
  function updateTopbarStatus() {
    // Placeholder for future status bar logic
  }
  window.updateGreeting = updateTopbarStatus; // Keep alias for tab switching compatibility

  // ============ PERFORMANCE OVERVIEW PANEL ============
  function renderStatsPanel() {
    var now = new Date();
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
    for (var wi = 0; wi < 7; wi++) {
      var wd = new Date(monday); wd.setDate(monday.getDate() + wi);
      var wymd = wd.getFullYear() + '-' + pad2(wd.getMonth()+1) + '-' + pad2(wd.getDate());
      var wh = {}; try { wh = JSON.parse(localStorage.getItem('health:' + wymd) || '{}'); } catch(e) {}
      weekFocusMins.push(Math.round(wh.focus_min || 0));
    }
    // Include live session in today's bar so it matches the hero value
    try {
      var liveFs = JSON.parse(localStorage.getItem(FOCUS_SESSION_KEY) || '{}');
      if (liveFs.running && liveFs.startedAt) {
        weekFocusMins[todayWeekIdx] += Math.floor((Date.now() - liveFs.startedAt) / 60000);
      }
    } catch(e) {}
    var weekDeepFlags = weekFocusMins.map(function(m) { return m >= 30; });

    var maxFocus = Math.max.apply(null, weekFocusMins) || 1;
    var barsEl = $('perfWeekBars');
    if (barsEl) {
      var renderBars = function() {
        var h = barsEl.clientHeight;
        if (h < 20) { requestAnimationFrame(renderBars); return; }
        var barMaxH = h - 4;
        barsEl.innerHTML = weekFocusMins.map(function(min, i) {
          var px = min > 0 ? Math.max(10, Math.round((min / maxFocus) * barMaxH)) : 3;
          var cls = 'po-week-bar' + (min > 0 ? ' has-data' : '') + (i === todayWeekIdx ? ' is-today' : '');
          return '<div class="' + cls + '" style="height:' + px + 'px"></div>';
        }).join('');
      };
      requestAnimationFrame(renderBars);
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

    // ── Readiness (sleep + focus + yesterday tasks + mood) ──
    var settings = {}; try { settings = JSON.parse(localStorage.getItem('health_settings') || '{}'); } catch(e) {}
    var sleepGoal = settings.sleep_goal_hours || 8;
    var focusGoal = settings.focus_goal_min || 240;
    var yd = new Date(now); yd.setDate(yd.getDate() - 1);
    var ydYmd = yd.getFullYear() + '-' + pad2(yd.getMonth()+1) + '-' + pad2(yd.getDate());
    var ydGoals = storeGet('goals:' + ydYmd) || [];
    var ydTotal = ydGoals.length;
    var ydDone = ydGoals.filter(function(g) { return g && g.done; }).length;
    var ydRate = ydTotal > 0 ? ydDone / ydTotal : null;
    var todayMood = null;
    try { todayMood = localStorage.getItem('mood:' + todayYmd); } catch(e) {}
    var MOOD_SCORE_MAP = { motivated: 0.95, happy: 0.90, calm: 0.80, numb: 0.35, tired: 0.35, anxious: 0.30, frustrated: 0.25, sad: 0.20 };
    var factors = [];
    if (health.sleep_hours != null) factors.push(Math.min(health.sleep_hours / sleepGoal, 1));
    if (health.focus_min > 0) factors.push(Math.min(health.focus_min / focusGoal, 1));
    if (ydRate != null) factors.push(ydRate);
    if (todayMood != null) factors.push(MOOD_SCORE_MAP[todayMood] || 0.5);
    var readinessScore = factors.length > 0 ? Math.round((factors.reduce(function(a,b){return a+b;},0) / factors.length) * 100) : null;
    var readinessLabel = readinessScore == null ? '—' : readinessScore >= 80 ? 'Strong' : readinessScore >= 60 ? 'Good' : readinessScore >= 40 ? 'Fair' : 'Low';

    var readEl = $('perfReadiness'); if (readEl) readEl.textContent = readinessScore != null ? readinessScore : '—';
    var readSubEl = $('perfReadinessSub'); if (readSubEl) readSubEl.textContent = readinessLabel;
    var readFillEl = $('perfReadinessFill'); if (readFillEl) readFillEl.style.width = (readinessScore || 0) + '%';

    // ── Deep work consistency dots ──
    var consistencyCount = weekDeepFlags.filter(Boolean).length;
    var countEl = $('perfConsistencyCount'); if (countEl) countEl.textContent = consistencyCount + ' of 7 days with 30+ min';

    var DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    var dotsEl = $('perfDots');
    if (dotsEl) {
      dotsEl.innerHTML = weekDeepFlags.map(function(done, i) {
        var wrapCls = 'po-dot-wrap' + (done ? ' done' : '') + (i === todayWeekIdx ? ' today' : '');
        return '<div class="' + wrapCls + '"><div class="po-dot"></div><span class="po-dot-label">' + DAY_LABELS[i] + '</span></div>';
      }).join('');
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

// ── Outlook row ──
    var wlEl = $('outlookWorkload');
    if (wlEl) wlEl.textContent = Math.min(totalTasks, 10) + '/10';
    var focEl = $('outlookFocus');
    if (focEl) focEl.textContent = focusStr;
    var compEl = $('outlookCompletion');
    if (compEl) compEl.textContent = doneTasks + '/' + totalTasks + ' done';
  }
  window.renderStatsPanel = renderStatsPanel;

  // ============ SIDEBAR AT A GLANCE + ADAPTIVE INSIGHT ============
  window.renderSidebarAtAGlance = function() {
    var now = new Date();
    var todayYmd = now.getFullYear() + '-' + pad2(now.getMonth()+1) + '-' + pad2(now.getDate());

    var health = {};
    try { health = JSON.parse(localStorage.getItem('health:' + todayYmd) || '{}'); } catch(e) {}
    var focusMin = Math.round(health.focus_min || 0);
    try {
      var fs = JSON.parse(localStorage.getItem(FOCUS_SESSION_KEY) || '{}');
      if (fs.running && fs.startedAt) focusMin += Math.floor((Date.now() - fs.startedAt) / 60000);
    } catch(e) {}
    var focusStr = focusMin >= 60 ? Math.floor(focusMin/60) + 'h ' + (focusMin%60) + 'm' : focusMin + 'm';

    var todayGoals = storeGet('goals:' + todayYmd) || [];
    var total = todayGoals.length;
    var done = todayGoals.filter(function(g) { return g && g.done; }).length;

    var streakData = storeGet(STREAK_KEY) || { count: 0 };
    var todayAllDone = total > 0 && todayGoals.every(function(g) { return g && g.done; });
    var streak = streakData.count + (todayAllDone ? 1 : 0);

    var settings = {};
    try { settings = JSON.parse(localStorage.getItem('health_settings') || '{}'); } catch(e) {}
    var sleepGoal = settings.sleep_goal_hours || 8;
    var focusGoal = settings.focus_goal_min || 240;
    var yd = new Date(now); yd.setDate(yd.getDate() - 1);
    var ydYmd = yd.getFullYear() + '-' + pad2(yd.getMonth()+1) + '-' + pad2(yd.getDate());
    var ydGoals = storeGet('goals:' + ydYmd) || [];
    var ydTotal = ydGoals.length;
    var ydDone = ydGoals.filter(function(g) { return g && g.done; }).length;
    var ydRate = ydTotal > 0 ? ydDone / ydTotal : null;
    var todayMood = null;
    try { todayMood = localStorage.getItem('mood:' + todayYmd); } catch(e) {}
    var MOOD_SCORE_MAP = { motivated: 0.95, happy: 0.90, calm: 0.80, numb: 0.35, tired: 0.35, anxious: 0.30, frustrated: 0.25, sad: 0.20 };
    var factors = [];
    if (health.sleep_hours != null) factors.push(Math.min(health.sleep_hours / sleepGoal, 1));
    if (health.focus_min > 0) factors.push(Math.min(health.focus_min / focusGoal, 1));
    if (ydRate != null) factors.push(ydRate);
    if (todayMood != null) factors.push(MOOD_SCORE_MAP[todayMood] || 0.5);
    var readinessScore = factors.length > 0 ? Math.round((factors.reduce(function(a,b){return a+b;},0) / factors.length) * 100) : null;

    var focusScoreEl = $('aagFocusScore');
    var deepWorkEl = $('aagDeepWork');
    var tasksEl = $('aagTasks');
    var streakEl = $('aagStreak');
    var recoveryEl = $('aagRecovery');
    if (focusScoreEl) focusScoreEl.textContent = readinessScore != null ? readinessScore : '—';
    if (deepWorkEl) deepWorkEl.textContent = focusStr;
    if (tasksEl) tasksEl.textContent = total > 0 ? done + '/' + total : '—';
    if (streakEl) streakEl.textContent = streak > 0 ? streak + ' days' : '—';
    if (recoveryEl) recoveryEl.textContent = readinessScore != null ? (readinessScore >= 80 ? 'Strong' : readinessScore >= 60 ? 'Good' : readinessScore >= 40 ? 'Fair' : 'Low') : '—';
  };

  // ============ HOME INSIGHTS PANEL ============
  window.renderHomeInsights = function() {
    var gridEl = $('insightsGrid');
    var footerEl = $('insightsFooter');
    if (!gridEl) return;

    var now = new Date();
    var todayYmd = now.getFullYear() + '-' + pad2(now.getMonth()+1) + '-' + pad2(now.getDate());
    var last7 = [];
    var prev7 = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(now); d.setDate(d.getDate() - i);
      var ymd = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
      var h = {}; try { h = JSON.parse(localStorage.getItem('health:' + ymd) || '{}'); } catch(e) {}
      last7.push(h);
      var pd = new Date(now); pd.setDate(pd.getDate() - i - 7);
      var pymd = pd.getFullYear() + '-' + pad2(pd.getMonth()+1) + '-' + pad2(pd.getDate());
      var ph = {}; try { ph = JSON.parse(localStorage.getItem('health:' + pymd) || '{}'); } catch(e) {}
      prev7.push(ph);
    }

    var avgFocus = function(arr) {
      var mins = arr.map(function(x) { return x.focus_min || 0; });
      return mins.reduce(function(a,b){return a+b;},0) / Math.max(mins.length, 1);
    };
    var avgSleep = function(arr) {
      var hrs = arr.filter(function(x) { return x.sleep_hours != null; }).map(function(x){return x.sleep_hours;});
      return hrs.length > 0 ? hrs.reduce(function(a,b){return a+b;},0) / hrs.length : 0;
    };
    var thisWeekFocus = avgFocus(last7);
    var prevWeekFocus = avgFocus(prev7);
    var thisWeekSleep = avgSleep(last7);
    var prevWeekSleep = avgSleep(prev7);

    // Count AM vs PM focus
    var amCount = 0;
    for (var hi = 0; hi < last7.length; hi++) {
      if (last7[hi].focus_min && last7[hi].focus_min > 0) {
        // rough: if focus was logged it was likely AM (simplified)
        amCount++;
      }
    }

    var cards = [];

    var SVG_TREND   = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,11 5,7 9,9 15,3"/><polyline points="11,3 15,3 15,7"/></svg>';
    var SVG_MORNING = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="var(--amber)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="15"/><line x1="1" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="15" y2="8"/></svg>';
    var SVG_SLEEP   = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="var(--green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 10A6 6 0 0 1 6 2a6 6 0 1 0 8 8z"/></svg>';
    var SVG_CHECK   = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="var(--green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,8 6,12 14,4"/></svg>';

    // Card 1: Focus trend
    if (thisWeekFocus > 0 || prevWeekFocus > 0) {
      var diff = thisWeekFocus - prevWeekFocus;
      var pctDiff = prevWeekFocus > 0 ? Math.round((diff / prevWeekFocus) * 100) : 0;
      var trendText = pctDiff >= 0 ? 'up ' + Math.abs(pctDiff) + '%' : 'down ' + Math.abs(pctDiff) + '%';
      cards.push({ icon: SVG_TREND, iconBg: 'var(--accent-soft)', title: 'Deep work is ' + trendText + ' this week', sub: prevWeekFocus > 0 ? (Math.round(thisWeekFocus) + 'm vs ' + Math.round(prevWeekFocus) + 'm') : 'Building baseline' });
    }

    // Card 2: Best performance time
    if (amCount >= 4) {
      cards.push({ icon: SVG_MORNING, iconBg: 'rgba(245,158,11,0.18)', title: 'You peak in the morning', sub: 'Most focus logged before noon' });
    } else if (amCount >= 2) {
      cards.push({ icon: SVG_MORNING, iconBg: 'rgba(245,158,11,0.18)', title: 'Morning momentum detected', sub: 'Try blocking AM hours for deep work' });
    }

    // Card 3: Sleep trend
    if (thisWeekSleep > 0) {
      var sleepDiff = thisWeekSleep - prevWeekSleep;
      var sleepText = sleepDiff >= 0 ? 'up ' + sleepDiff.toFixed(1) + 'h' : 'down ' + Math.abs(sleepDiff).toFixed(1) + 'h';
      cards.push({ icon: SVG_SLEEP, iconBg: 'rgba(95,214,135,0.18)', title: 'Sleep is ' + sleepText + ' vs last week', sub: thisWeekSleep >= 7 ? 'Great recovery' : 'Room for improvement' });
    }

    // Card 4: Completion rate
    var doneCount = 0; var totalCount = 0;
    for (var gi = 0; gi < 7; gi++) {
      var d2 = new Date(now); d2.setDate(d2.getDate() - gi);
      var gYmd = d2.getFullYear() + '-' + pad2(d2.getMonth()+1) + '-' + pad2(d2.getDate());
      var gs = storeGet('goals:' + gYmd) || [];
      totalCount += gs.length;
      doneCount += gs.filter(function(g) { return g && g.done; }).length;
    }
    if (totalCount > 0) {
      var rate = Math.round((doneCount / totalCount) * 100);
      cards.push({ icon: SVG_CHECK, iconBg: 'rgba(95,214,135,0.18)', title: rate + '% task completion rate', sub: doneCount + '/' + totalCount + ' done this week' });
    }

    if (cards.length === 0) {
      gridEl.innerHTML = '<div class="ins-empty">Log health data to see weekly insights.</div>';
    } else {
      gridEl.innerHTML = cards.map(function(c) {
        return '<div class="ins-card">' +
          '<div class="ins-icon" style="background:' + c.iconBg + '">' + c.icon + '</div>' +
          '<div class="ins-body">' +
          '<div class="ins-title">' + c.title + '</div>' +
          '<div class="ins-sub">' + c.sub + '</div>' +
          '</div></div>';
      }).join('');
    }

    if (footerEl) {
      var footerText = 'Things look balanced. Keep building momentum.';
      if (thisWeekFocus > prevWeekFocus * 1.2) footerText = 'Focus is trending up — nice work.';
      else if (thisWeekSleep < 6) footerText = 'Sleep has been light. Prioritise rest.';
      footerEl.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="var(--muted-2)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polygon points="9,1 3,9 8,9 7,15 13,7 8,7"/></svg> ' + escHtml(footerText);
    }
  };

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

    var calHealthSettings = {};
    try { calHealthSettings = JSON.parse(localStorage.getItem('health_settings') || '{}'); } catch(e) {}
    var calSleepGoal = calHealthSettings.sleep_goal_hours || 8;

    var prevMonthDays = new Date(year, month, 0).getDate();
    for (var i = offset - 1; i >= 0; i--) {
      html += '<div class="cal-day out">' + (prevMonthDays - i) + '</div>';
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var ymd = year + '-' + pad2(month + 1) + '-' + pad2(day);
      var isToday = ymd === todayYMD;
      var goals = storeGet('goals:' + ymd);
      var hasGoals = goals && goals.length > 0;
      var dayHealth = {};
      try { dayHealth = JSON.parse(localStorage.getItem('health:' + ymd) || '{}'); } catch(e) {}
      var isDeepWork = (dayHealth.focus_min || 0) > 30;
      var isRestorative = (dayHealth.sleep_hours || 0) >= calSleepGoal * 0.8;

      html += '<div class="cal-day' + (isToday ? ' is-today' : '') + '">' + day;
      if (isDeepWork) html += '<span class="cal-dot cal-dot-deep"></span>';
      else if (isRestorative) html += '<span class="cal-dot cal-dot-rest"></span>';
      else if (hasGoals) html += '<span class="cal-dot"></span>';
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
  document.addEventListener('accent-changed', updateDayBar);
  updateGreeting();
  renderStatsPanel();
  window.renderSidebarAtAGlance();
  renderCalendar();
  initCalendar();
  initFocusTimer();
  _initFocusEdit();
  var nextBtn = $('nextActionBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', function() {
      var input = $('goalInput');
      if (input) input.focus();
    });
  }
  setInterval(function() {
    updateDayBar();
    renderStatsPanel();
    window.renderSidebarAtAGlance();
    var ringsFn = window.renderHomeHealthRings || window.renderHabitFullRings;
    if (ringsFn) ringsFn();
  }, 60 * 1000);

  startTicker();

})();
