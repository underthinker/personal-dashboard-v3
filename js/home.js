/* ═══ HOME TAB WIDGETS ═══
   Extracted from index.html inline script. Loaded last so it can call into
   render* helpers exported by goals/habits/health. */
(function(){
  const $ = id => document.getElementById(id);

  /* ─── Timeline v2 (range blocks, inline edit, drag sort, undo delete) ─── */
  const TL_KEY_V1 = 'timeline_blocks_v1';
  const TL_KEY    = 'timeline_blocks_v2';

  const DEFAULT_BLOCKS = [
    { id:'d1', start:'6:00',  end:'7:00',  label:'Morning routine', sub:'Wake up, stretch, coffee' },
    { id:'d2', start:'7:00',  end:'9:00',  label:'Deep work',       sub:'Focus session' },
    { id:'d3', start:'9:00',  end:'9:30',  label:'Team sync',       sub:'Standup' },
    { id:'d4', start:'10:00', end:'12:00', label:'Project work',    sub:'Main task block' },
    { id:'d5', start:'12:00', end:'13:00', label:'Lunch',           sub:'Break' },
    { id:'d6', start:'13:00', end:'15:00', label:'Deep work II',    sub:'Second session' },
    { id:'d7', start:'15:00', end:'17:00', label:'Admin',           sub:'Email, planning' },
    { id:'d8', start:'17:00', end:'18:00', label:'Wind down',       sub:'Review, plan tomorrow' },
  ];

  function tlUid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }

  function parseMin(t) {
    const p = String(t || '').split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  function normalizeTime(t) {
    const p = String(t || '').split(':');
    const h = Math.max(0, Math.min(23, parseInt(p[0], 10) || 0));
    const m = Math.max(0, Math.min(59, parseInt(p[1], 10) || 0));
    return h + ':' + String(m).padStart(2, '0');
  }

  function fmtDur(start, end) {
    const d = parseMin(end) - parseMin(start);
    if (d <= 0) return '';
    const h = Math.floor(d / 60), m = d % 60;
    return h && m ? h + 'h ' + m + 'm' : h ? h + 'h' : m + 'm';
  }

  /* v1 → v2 migration (runs once) */
  (function() {
    const raw = localStorage.getItem(TL_KEY_V1);
    if (!raw || localStorage.getItem(TL_KEY)) return;
    try {
      const v1 = JSON.parse(raw);
      if (!Array.isArray(v1)) return;
      const v2 = v1.map(function(b) {
        const start = normalizeTime(b.t || '0:00');
        const em = Math.min(parseMin(start) + 60, 23 * 60 + 59);
        return { id: tlUid(), start: start, end: normalizeTime(Math.floor(em / 60) + ':' + (em % 60)), label: b.label || '', sub: b.sub || '' };
      });
      localStorage.setItem(TL_KEY, JSON.stringify(v2));
      localStorage.removeItem(TL_KEY_V1);
    } catch(e) {}
  })();

  function getBlocks() {
    try {
      const raw = localStorage.getItem(TL_KEY);
      if (raw == null) return DEFAULT_BLOCKS.map(function(b) { return Object.assign({}, b); });
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : DEFAULT_BLOCKS.map(function(b) { return Object.assign({}, b); });
    } catch(e) { return DEFAULT_BLOCKS.map(function(b) { return Object.assign({}, b); }); }
  }

  function saveBlocks(blocks) { localStorage.setItem(TL_KEY, JSON.stringify(blocks)); }

  function sortedBlocks() {
    const blocks = getBlocks();
    const hasOrder = blocks.some(function(b) { return b.sortOrder != null; });
    return blocks.slice().sort(function(a, b) {
      return hasOrder
        ? (a.sortOrder == null ? 9999 : a.sortOrder) - (b.sortOrder == null ? 9999 : b.sortOrder)
        : parseMin(a.start) - parseMin(b.start);
    });
  }

  function updateResetBtn() {
    const btn = $('tlResetSort');
    if (!btn) return;
    btn.style.display = getBlocks().some(function(b) { return b.sortOrder != null; }) ? '' : 'none';
  }

  /* ─── Undo delete ─── */
  var _undoTimer = null, _undoBlock = null;

  function deleteBlockUndo(blockId) {
    clearTimeout(_undoTimer);
    const blocks = getBlocks();
    const idx = blocks.findIndex(function(b) { return b.id === blockId; });
    if (idx === -1) return;
    _undoBlock = blocks.splice(idx, 1)[0];
    saveBlocks(blocks);
    renderTimeline();
    showToast('Block deleted', function() {
      clearTimeout(_undoTimer);
      const cur = getBlocks();
      cur.push(_undoBlock);
      saveBlocks(cur);
      _undoBlock = null;
      clearToast();
      renderTimeline();
    });
    _undoTimer = setTimeout(function() { _undoBlock = null; clearToast(); }, 3000);
  }

  function showToast(msg, undoFn) {
    clearToast();
    const card = document.querySelector('.a-timeline');
    if (!card) return;
    const t = document.createElement('div');
    t.className = 'tl-toast'; t.id = 'tlToast';
    t.innerHTML = window.escHtml(msg) + ' <button class="tl-toast-undo">Undo</button>';
    t.querySelector('.tl-toast-undo').addEventListener('click', undoFn);
    card.appendChild(t);
  }

  function clearToast() { const t = $('tlToast'); if (t) t.remove(); }

  /* ─── Time popover ─── */
  var _timePop = null;

  function openTimePop(anchor, blockId) {
    closeTimePop();
    const blocks = getBlocks();
    const b = blocks.find(function(x) { return x.id === blockId; });
    if (!b) return;
    const esc = window.escHtml;
    const pop = document.createElement('div');
    pop.className = 'tl-time-pop'; pop.id = 'tlTimePop';
    pop.innerHTML =
      '<label>Start<input type="text" class="tl-pop-start" value="' + esc(b.start) + '"></label>' +
      '<label>End<input type="text" class="tl-pop-end" value="' + esc(b.end) + '"></label>' +
      '<button class="tl-pop-done">Done</button>';
    document.body.appendChild(pop);
    const rect = anchor.getBoundingClientRect();
    pop.style.top  = (rect.bottom + 6 + window.scrollY) + 'px';
    pop.style.left = Math.max(4, rect.left) + 'px';
    pop.querySelector('.tl-pop-done').addEventListener('click', function() {
      const ns = normalizeTime(pop.querySelector('.tl-pop-start').value);
      const ne = normalizeTime(pop.querySelector('.tl-pop-end').value);
      const bks = getBlocks();
      const bl = bks.find(function(x) { return x.id === blockId; });
      if (bl) { bl.start = ns; bl.end = ne; saveBlocks(bks); }
      closeTimePop(); renderTimeline();
    });
    _timePop = pop;
    requestAnimationFrame(function() { document.addEventListener('click', _tlOutsidePop); });
  }

  function _tlOutsidePop(e) {
    if (_timePop && !_timePop.contains(e.target)) {
      document.removeEventListener('click', _tlOutsidePop);
      closeTimePop();
    }
  }

  function closeTimePop() {
    document.removeEventListener('click', _tlOutsidePop);
    if (_timePop) { _timePop.remove(); _timePop = null; }
  }

  /* ─── Inline editing ─── */
  var _edit = null; // { el, blockId, field, orig }

  function startEdit(el, blockId, field) {
    if (_edit) commitEdit();
    _edit = { el: el, blockId: blockId, field: field, orig: el.textContent };
    el.contentEditable = 'true';
    el.classList.add('tl-editing');
    el.focus();
    var r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  function commitEdit() {
    if (!_edit) return;
    var d = _edit; _edit = null;
    d.el.contentEditable = 'false';
    d.el.classList.remove('tl-editing');
    var val = d.el.textContent.trim();
    if (val === d.orig) return;
    var blocks = getBlocks();
    var b = blocks.find(function(x) { return x.id === d.blockId; });
    if (b) { b[d.field] = val; saveBlocks(blocks); renderTimeline(); }
  }

  function revertEdit() {
    if (!_edit) return;
    var d = _edit; _edit = null;
    d.el.contentEditable = 'false';
    d.el.classList.remove('tl-editing');
    d.el.textContent = d.orig;
  }

  /* ─── Quick-add ─── */
  function submitQuickAdd() {
    const el = $('timelineWidget');
    if (!el) return;
    const qaLabel = el.querySelector('.tl-qa-label');
    const qaStart = el.querySelector('.tl-qa-start');
    if (!qaLabel) return;
    const label = qaLabel.value.trim();
    if (!label) return;
    const startVal = (qaStart && qaStart.value.trim()) ? normalizeTime(qaStart.value.trim()) : '';
    const em = startVal ? Math.min(parseMin(startVal) + 60, 23 * 60 + 59) : 0;
    const end = startVal ? normalizeTime(Math.floor(em / 60) + ':' + (em % 60)) : '';
    const bks = getBlocks();
    bks.push({ id: tlUid(), start: startVal, end: end, label: label, sub: '' });
    saveBlocks(bks);
    renderTimeline();
    setTimeout(function() {
      const lbl = $('timelineWidget') && $('timelineWidget').querySelector('.tl-qa-label');
      if (lbl) lbl.focus();
    }, 0);
  }

  /* ─── Render ─── */
  function renderTimeline() {
    const el = $('timelineWidget');
    if (!el) return;
    const esc = window.escHtml;
    const blocks = sortedBlocks();
    const nowMin = (new Date()).getHours() * 60 + (new Date()).getMinutes();

    const rows = blocks.map(function(b, i) {
      const isActive = nowMin >= parseMin(b.start) && nowMin < parseMin(b.end);
      const isLast   = i === blocks.length - 1;
      const dur = fmtDur(b.start, b.end);
      return (
        '<div class="tl-row' + (isActive ? ' tl-row-active' : '') + (isLast ? ' tl-row-last' : '') + '" data-tl-id="' + esc(b.id) + '">' +
          '<div class="tl-time-col">' +
            '<span class="tl-start' + (isActive ? ' active' : '') + '" data-tl-time>' + esc(b.start) + '</span>' +
          '</div>' +
          '<div class="tl-dot-col"><div class="tl-line"></div><div class="tl-dot' + (isActive ? ' active' : '') + '"></div></div>' +
          '<div class="tl-content' + (isActive ? ' active' : '') + '">' +
            '<div class="tl-title-row">' +
              '<span class="tl-title" data-tl-label>' + esc(b.label) + '</span>' +
              (dur ? '<span class="tl-dur">' + esc(dur) + '</span>' : '') +
            '</div>' +
            (b.sub ? '<div class="tl-sub" data-tl-sub>' + esc(b.sub) + '</div>' : '') +
          '</div>' +
          '<button class="tl-del-btn" data-tl-del="' + esc(b.id) + '" aria-label="Delete block">×</button>' +
        '</div>'
      );
    }).join('');

    el.innerHTML = rows +
      '<div class="tl-quick-add">' +
        '<input class="tl-qa-start" type="text" placeholder="9:00" autocomplete="off">' +
        '<input class="tl-qa-label" type="text" placeholder="Add block…" autocomplete="off">' +
        '<button class="tl-qa-btn" type="button">+</button>' +
      '</div>';

    const activeRow = el.querySelector('.tl-row-active');
    if (activeRow) el.scrollTop = activeRow.offsetTop - el.clientHeight / 2 + activeRow.offsetHeight / 2;

    updateResetBtn();
  }

  /* ─── Delegated event handlers (registered once at load) ─── */
  document.addEventListener('click', function(e) {
    const delBtn = e.target.closest('[data-tl-del]');
    if (delBtn) { e.stopPropagation(); deleteBlockUndo(delBtn.getAttribute('data-tl-del')); return; }

    if (e.target.closest('.tl-qa-btn')) { submitQuickAdd(); return; }

    const timeEl = e.target.closest('[data-tl-time]');
    if (timeEl) {
      e.stopPropagation();
      const row = timeEl.closest('[data-tl-id]');
      if (row) openTimePop(timeEl, row.getAttribute('data-tl-id'));
      return;
    }

    const labelEl = e.target.closest('[data-tl-label]');
    if (labelEl && labelEl.contentEditable !== 'true') {
      const row = labelEl.closest('[data-tl-id]');
      if (row) { startEdit(labelEl, row.getAttribute('data-tl-id'), 'label'); return; }
    }

    const subEl = e.target.closest('[data-tl-sub]');
    if (subEl && subEl.contentEditable !== 'true') {
      const row = subEl.closest('[data-tl-id]');
      if (row) { startEdit(subEl, row.getAttribute('data-tl-id'), 'sub'); return; }
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.target.matches && e.target.matches('.tl-qa-label') && e.key === 'Enter') { submitQuickAdd(); return; }
    if (!_edit) return;
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    else if (e.key === 'Escape') { revertEdit(); }
  });

  document.addEventListener('blur', function(e) {
    if (_edit && e.target === _edit.el) {
      var held = _edit;
      setTimeout(function() { if (_edit === held) commitEdit(); }, 0);
    }
  }, true);

  const resetBtn = $('tlResetSort');
  if (resetBtn) resetBtn.addEventListener('click', function() {
    const bks = getBlocks();
    bks.forEach(function(b) { delete b.sortOrder; });
    saveBlocks(bks);
    renderTimeline();
  });

  /* ─── Activity heatmap (also called from Habits tab) ─── */
  window.renderActivityHeatmap = function() {
    const el = document.getElementById('heatmapWidget');
    if (!el) return;
    const DAYS = 7, gap = 3;

    const goalMap = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (/^goals:\d{4}-\d{2}-\d{2}$/.test(k)) {
          const arr = JSON.parse(localStorage.getItem(k) || '[]');
          if (arr.length > 0) {
            const done = arr.filter(g => g.done).length;
            goalMap[k.slice(6)] = done / arr.length;
          }
        }
      }
    } catch(e) {}

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const WEEKS = 52;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - startDate.getDay() - 51 * 7);

    const availWidth = el.clientWidth - 34;
    const cellSize = Math.max(6, Math.floor((availWidth - (WEEKS - 1) * gap) / WEEKS));
    const gridCols = 'repeat(' + WEEKS + ', ' + cellSize + 'px)';
    const gridRows = 'repeat(7, ' + cellSize + 'px)';

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const firstWeekOf = {};
    for (let w = 0; w < WEEKS; w++) {
      for (let d = 0; d < DAYS; d++) {
        const cd = new Date(startDate);
        cd.setDate(cd.getDate() + w * 7 + d);
        const key = cd.getFullYear() + '-' + String(cd.getMonth()).padStart(2, '0');
        if (firstWeekOf[key] == null) firstWeekOf[key] = w;
      }
    }
    let monthHtml = '', lastLabelCol = -99;
    Object.keys(firstWeekOf).sort().forEach(key => {
      const col = firstWeekOf[key];
      if (col - lastLabelCol < 4) return;
      const mo = parseInt(key.split('-')[1]);
      monthHtml += '<span style="grid-column: ' + (col + 1) + '">' + MONTHS[mo] + '</span>';
      lastLabelCol = col;
    });

    let cellHtml = '';
    for (let w = 0; w < WEEKS; w++) {
      for (let d = 0; d < DAYS; d++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(cellDate.getDate() + w * 7 + d);
        const ymd = window.dateToYMD(cellDate);
        const ratio = goalMap[ymd];
        let lvl = '';
        if (ratio != null && ratio > 0) {
          if (ratio < 0.26) lvl = 'l1';
          else if (ratio < 0.51) lvl = 'l2';
          else if (ratio < 0.76) lvl = 'l3';
          else lvl = 'l4';
        }
        const isFuture = cellDate > today;
        const isToday = cellDate.toDateString() === today.toDateString();
        cellHtml += '<div class="hm-cell ' + lvl + (isFuture ? ' hm-act-future' : '') + (isToday ? ' hm-today' : '') + '" title="' + ymd + '"></div>';
      }
    }

    const monthBar = '<div class="hm-act-month-lbl" style="grid-template-columns:' + gridCols + '">' + monthHtml + '</div>';
    const grid = '<div class="hm-act-grid" style="grid-template-columns:' + gridCols + ';grid-template-rows:' + gridRows + '">' + cellHtml + '</div>';
    const dow = '<div class="hm-act-days" style="grid-template-rows:' + gridRows + '"><span style="grid-row:2">Mon</span><span style="grid-row:4">Wed</span><span style="grid-row:6">Fri</span></div>';
    const legend = '<div class="hm-act-legend"><div class="hm-act-legend-cells"><span>Less</span><span class="hm-act-cell"></span><span class="hm-act-cell l1"></span><span class="hm-act-cell l2"></span><span class="hm-act-cell l3"></span><span class="hm-act-cell l4"></span><span>More</span></div><button class="hm-act-view-link">View full activity →</button></div>';

    el.innerHTML = '<div class="hm-act-outer"><div></div>' + monthBar + dow + grid + '</div>' + legend;
  };

  /* ─── Weather ─── */
  const WEATHER_CONFIG_KEY = 'weather_config_v1';
  const WEATHER_CACHE_KEY = 'weather_cache_v1';
  const OWM_ICON_MAP = { '01':'☀️','02':'🌤️','03':'⛅','04':'☁️','09':'🌧️','10':'🌦️','11':'⛈️','13':'❄️','50':'🌫️' };
  function owmIcon(icon) { return OWM_ICON_MAP[icon.slice(0,2)] || '🌡️'; }

  function renderWeatherData(data) {
    const el = $('weatherWidget');
    if (!el || !data) return;
    const temp = Math.round(data.main.temp);
    const feelsLike = Math.round(data.main.feels_like);
    const humidity = data.main.humidity;
    const hi = Math.round(data.main.temp_max);
    const lo = Math.round(data.main.temp_min);
    const icon = owmIcon(data.weather[0].icon);
    const desc = data.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());
    const cond = data.weather[0].main;
    const h = (new Date()).getHours();
    let sunHtml = '';
    if (data.sys && data.sys.sunrise && data.sys.sunset) {
      const sr = new Date(data.sys.sunrise * 1000);
      const ss = new Date(data.sys.sunset * 1000);
      const fmt = d => window.pad2(d.getHours()) + ':' + window.pad2(d.getMinutes());
      sunHtml = '<div class="weather-sun-row"><span>↑ ' + fmt(sr) + '</span><span>↓ ' + fmt(ss) + '</span></div>';
    }
    let rec;
    if (cond === 'Clear' && temp > 20) rec = 'Great conditions for an outdoor break.';
    else if (cond === 'Clear' && h >= 17 && h < 21) rec = 'Evening walk recommended.';
    else if (cond === 'Clouds' || cond === 'Rain' || cond === 'Drizzle' || cond === 'Thunderstorm') rec = 'Great weather for indoor focus.';
    else if (temp > 28) rec = 'Stay hydrated in the heat.';
    else if (temp < 5) rec = 'Bundle up — cold day ahead.';
    else rec = 'Conditions look good for a balanced day.';
    el.innerHTML =
      '<div class="weather-row"><span class="weather-icon">' + icon + '</span><span class="weather-temp">' + temp + '°C</span></div>' +
      '<div class="weather-cond">' + desc + '</div>' +
      '<div class="weather-meta-row"><span>Feels like ' + feelsLike + '°C</span><span>' + humidity + '% humidity</span></div>' +
      '<div class="weather-hl"><span>↑ ' + hi + '°</span><span>↓ ' + lo + '°</span></div>' +
      sunHtml +
      '<div class="weather-rec">' + rec + '</div>' +
      '<button class="weather-cfg-btn" onclick="renderWeatherSetup(true)">⚙</button>';
  }

  function renderWeatherSetup(forceShow) {
    const el = $('weatherWidget');
    if (!el) return;
    el.innerHTML =
      '<form class="weather-form" onsubmit="saveWeatherConfig(event)">' +
        '<input id="wxApiKey" type="text" placeholder="OpenWeatherMap API key" autocomplete="off">' +
        '<input id="wxCity" type="text" placeholder="City (e.g. San Francisco)">' +
        '<button type="submit" class="weather-save-btn">Save</button>' +
      '</form>';
    const cfg = JSON.parse(localStorage.getItem(WEATHER_CONFIG_KEY) || '{}');
    if (cfg.apiKey) el.querySelector('#wxApiKey').value = cfg.apiKey;
    if (cfg.city) el.querySelector('#wxCity').value = cfg.city;
  }
  function saveWeatherConfig(e) {
    e.preventDefault();
    const apiKey = document.getElementById('wxApiKey').value.trim();
    const city = document.getElementById('wxCity').value.trim();
    if (!apiKey || !city) return;
    localStorage.setItem(WEATHER_CONFIG_KEY, JSON.stringify({ apiKey, city }));
    localStorage.removeItem(WEATHER_CACHE_KEY);
    renderWeather();
  }
  function renderWeather() {
    const el = $('weatherWidget');
    if (!el) return;
    const cfg = JSON.parse(localStorage.getItem(WEATHER_CONFIG_KEY) || '{}');
    if (!cfg.apiKey || !cfg.city) { renderWeatherSetup(); return; }
    const cache = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
    if (cache && cache.fetchedAt && (Date.now() - cache.fetchedAt) < 30 * 60 * 1000) {
      renderWeatherData(cache.data);
      return;
    }
    const url = 'https://api.openweathermap.org/data/2.5/weather?q=' + encodeURIComponent(cfg.city) + '&appid=' + cfg.apiKey + '&units=metric';
    el.innerHTML = '<div class="weather-loading">Loading…</div>';
    fetch(url).then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(data => {
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }));
      renderWeatherData(data);
    }).catch(() => {
      if (cache) { renderWeatherData(cache.data); return; }
      el.innerHTML = '<div class="weather-error">Weather unavailable. <button class="weather-cfg-btn" onclick="renderWeatherSetup(true)">Configure →</button></div>';
    });
  }
  window.renderWeatherSetup = renderWeatherSetup;
  window.saveWeatherConfig = saveWeatherConfig;
  window.renderWeather = renderWeather;

  /* ─── Hero "Current Focus" + badge ─── */
  function updateHeroNextUp() {
    const taskEl = $('cfTaskText');
    if (!taskEl) return;
    try {
      const key = 'goals:' + window.getTodayYmd();
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      const q = data.find(g => g.queued && !g.done);
      taskEl.textContent = q ? q.text : '—';
      const nextEl = $('cfNextTask');
      if (nextEl) {
        const nextGoal = data.find(g => !g.queued && !g.done);
        nextEl.textContent = nextGoal ? nextGoal.text : '—';
      }
    } catch(e) { taskEl.textContent = ''; }
  }

  function updateHomeBadge() {
    const badge = $('homeBadge');
    if (!badge) return;
    try {
      const key = 'goals:' + window.getTodayYmd();
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      const undone = data.filter(g => !g.done).length;
      badge.textContent = undone;
    } catch(e) { badge.textContent = '0'; }
  }

  window.renderTimeline = renderTimeline;
  window.updateHeroNextUp = updateHeroNextUp;
  window.updateHomeBadge = updateHomeBadge;

  /* ─── Init ─── */
  renderTimeline();

  /* SortableJS drag-to-reorder (init once; innerHTML replacement keeps instance valid) */
  if (window.Sortable) {
    var _tlEl = $('timelineWidget');
    if (_tlEl) Sortable.create(_tlEl, {
      draggable: '.tl-row',
      handle: '.tl-dot-col',
      animation: 150,
      ghostClass: 'tl-drag-ghost',
      onEnd: function() {
        var rows = _tlEl.querySelectorAll('.tl-row[data-tl-id]');
        var bks = getBlocks();
        rows.forEach(function(row, idx) {
          var b = bks.find(function(x) { return x.id === row.getAttribute('data-tl-id'); });
          if (b) b.sortOrder = idx;
        });
        saveBlocks(bks);
        updateResetBtn();
      }
    });
  }

  window.renderHomeInsights && window.renderHomeInsights();
  renderWeather();
  updateHeroNextUp();
  updateHomeBadge();
  window.renderHomeHealthRings ? window.renderHomeHealthRings() : (window.renderHabitFullRings && window.renderHabitFullRings());

  /* Re-render that previously sat in a separate inline block: if home tab is
     already visible at load, kick the insights + mood widgets so they paint
     immediately instead of waiting for a tab switch. */
  if (document.getElementById('tab-main')?.classList.contains('is-visible')) {
    window.renderHomeInsights && window.renderHomeInsights();
    window.renderHomeMood && window.renderHomeMood();
  }

  document.querySelectorAll('.view-habits').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) {
        const navItem = document.querySelector('.nav-item[data-tab="' + tab + '"]');
        if (navItem) navItem.click();
      }
    });
  });

  window.addEventListener('goals-changed', () => {
    updateHeroNextUp();
    updateHomeBadge();
    window.renderStatsPanel && window.renderStatsPanel();
    window.renderSidebarAtAGlance && window.renderSidebarAtAGlance();
    window.renderHomeInsights && window.renderHomeInsights();
  });
  window.addEventListener('focus-updated', () => {
    window.renderHomeHealthRings && window.renderHomeHealthRings();
  });
  window.addEventListener('nutrition-updated', () => {
    window.renderHomeHealthRings && window.renderHomeHealthRings();
  });

  setInterval(renderTimeline, 60000);
})();
