(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);

  // ----------- Storage helpers -----------
  function storeGet(key) {
    try { const v = localStorage.getItem(key); return v == null ? null : JSON.parse(v); }
    catch (e) { return null; }
  }
  function storeSet(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function storeDelete(key) { localStorage.removeItem(key); }
  function storeListKeys(prefix) {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
    return out;
  }

  // Confirmation modal (shared from goals.js, but safe to re-expose)
  function showConfirm(message, onConfirm, isDanger) {
    const overlay = $('confirmOverlay');
    if (!overlay) { onConfirm(); return; }
    const msgEl = $('confirmMessage');
    const okBtn = $('confirmOk');
    const cancelBtn = $('confirmCancel');
    msgEl.textContent = message;
    okBtn.classList.toggle('is-danger', !!isDanger);
    overlay.classList.add('show');
    const cleanup = () => { overlay.classList.remove('show'); okBtn.onclick = null; cancelBtn.onclick = null; };
    okBtn.onclick = () => { cleanup(); onConfirm(); };
    cancelBtn.onclick = cleanup;
  }

  // ----------- Date helpers -----------
  function dateToYMD(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayYMD() { return dateToYMD(new Date()); }
  function getDayName(d) { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]; }

  // Get Monday of current week
  function getMonday() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff);
  }

  // ----------- Default habit definitions -----------
  const DEFAULT_HABITS = [
    { id: 'sleep', name: 'Sleep 7-8 hours', icon: 'moon', active: true },
    { id: 'hygiene', name: 'Personal Hygiene', icon: 'sparkles', active: true },
    { id: 'healthy_meals', name: 'Eat healthy meals', icon: 'utensils', active: true },
    { id: 'go_outside', name: 'Go outside', icon: 'sun', active: true },
    { id: 'no_fap', name: 'No fap', icon: 'ban', active: true },
    { id: 'water', name: 'Drink 64 oz. water', icon: 'droplet', active: true },
    { id: 'no_alcohol', name: 'No Alcohol', icon: 'wine', active: true },
    { id: 'exercise', name: 'Exercise', icon: 'dumbbell', active: true },
    { id: 'productive', name: 'Productive Tasks', icon: 'list-checks', active: true },
    { id: 'creativity', name: 'Creativity', icon: 'pen-tool', active: true },
  ];

  function generateId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  const EMOJI_TO_ICON = {
    '💤': 'moon', '🧼': 'sparkles', '🥗': 'utensils', '☀': 'sun',
    '☀️': 'sun', '🚫': 'ban', '💧': 'droplet', '🍺': 'beer',
    '🏋🏻‍♀️': 'dumbbell', '🏋️‍♀️': 'dumbbell', '🧹': 'list-checks',
    '🖋️': 'pen-tool', '🏃': 'running', '📖': 'book', '🧘': 'leaf',
    '💪': 'zap', '🎯': 'target', '✅': 'check', '🍎': 'apple',
    '🥑': 'leaf', '🏄': 'waves', '🚴': 'bike', '⚽': 'circle',
    '🎨': 'palette', '🎵': 'music', '📝': 'pen-line', '💻': 'monitor',
    '🌿': 'leaf', '🌅': 'sunrise', '😴': 'moon', '❤️': 'heart',
    '🔥': 'flame', '⭐': 'star', '🎭': 'theater', '✍️': 'pen-tool',
    '📚': 'book', '🥦': 'apple', '🍳': 'cooking-pot', '🎸': 'music',
    '🎮': 'gamepad-2', '🏆': 'trophy', '🌟': 'star', '🐾': 'paw-print',
    '🍵': 'coffee', '🧠': 'brain', '💡': 'lightbulb', '🌈': 'rainbow',
    '🎪': 'circus', '🧑‍🤝‍🧑': 'users', '📱': 'smartphone'
  };

  function getDefinitions() {
    let defs = storeGet('habit_definitions');
    if (!defs || !defs.length) {
      defs = DEFAULT_HABITS;
      storeSet('habit_definitions', defs);
    } else {
      let migrated = false;
      defs.forEach(function(d) {
        if (d.emoji && !d.icon) {
          d.icon = EMOJI_TO_ICON[d.emoji] || 'circle';
          delete d.emoji;
          migrated = true;
        }
      });
      if (migrated) storeSet('habit_definitions', defs);
    }
    return defs;
  }

  function setDefinitions(defs) {
    storeSet('habit_definitions', defs);
  }

  function getDayData(ymd) {
    return storeGet('habits:' + ymd) || null;
  }

  function setDayData(ymd, data) {
    storeSet('habits:' + ymd, { date: ymd, entries: data.entries || {}, notes: data.notes || '' });
  }

  // ----------- Mood definitions -----------
  const MOOD_DEFS = [
    { key: 'happy',      label: 'Happy',      emoji: '🌻', color: '#FFD166' },
    { key: 'calm',       label: 'Calm',       emoji: '🌿', color: '#4EA8DE' },
    { key: 'motivated',  label: 'Motivated',  emoji: '🚀', color: '#FF9F1C' },
    { key: 'tired',      label: 'Tired',      emoji: '😴', color: '#B5179E' },
    { key: 'anxious',    label: 'Anxious',    emoji: '😟', color: '#4361EE' },
    { key: 'frustrated', label: 'Frustrated', emoji: '😤', color: '#F72585' },
    { key: 'sad',        label: 'Sad',        emoji: '🌧️', color: '#3A0CA3' },
    { key: 'numb',       label: 'Numb',       emoji: '😑', color: '#6C757D' },
  ];

  const MOOD_SVGS = {
    happy:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#FFD166"/><circle cx="12" cy="15" r="2.5" fill="#7A5200"/><circle cx="24" cy="15" r="2.5" fill="#7A5200"/><circle cx="13" cy="14" r="1" fill="white"/><circle cx="25" cy="14" r="1" fill="white"/><path d="M11 21 Q18 28 25 21" stroke="#7A5200" stroke-width="2.5" fill="none" stroke-linecap="round"/><ellipse cx="9" cy="22" rx="3" ry="1.8" fill="#FF8A65" opacity="0.5"/><ellipse cx="27" cy="22" rx="3" ry="1.8" fill="#FF8A65" opacity="0.5"/></svg>',
    calm:       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#4EA8DE"/><path d="M11 15 Q14 12 17 15" stroke="#1A5F8A" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M19 15 Q22 12 25 15" stroke="#1A5F8A" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M12 21 Q18 26 24 21" stroke="#1A5F8A" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    motivated:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#FF9F1C"/><path d="M10 15 Q13 12 16 15" stroke="#A85800" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M20 15 Q23 12 26 15" stroke="#A85800" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M10 21 Q18 30 26 21" fill="#A85800"/><path d="M10.5 21 Q18 27 25.5 21" fill="white"/><ellipse cx="8" cy="22" rx="3" ry="1.8" fill="#E07B00" opacity="0.45"/><ellipse cx="28" cy="22" rx="3" ry="1.8" fill="#E07B00" opacity="0.45"/></svg>',
    tired:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#B5179E"/><ellipse cx="13" cy="17" rx="2.5" ry="2" fill="#6A0060"/><ellipse cx="23" cy="17" rx="2.5" ry="2" fill="#6A0060"/><path d="M10 15 Q13 18 16 15" fill="#B5179E" stroke="#6A0060" stroke-width="0.5"/><path d="M20 15 Q23 18 26 15" fill="#B5179E" stroke="#6A0060" stroke-width="0.5"/><path d="M14 24 Q18 22 22 24" stroke="#6A0060" stroke-width="1.5" fill="none" stroke-linecap="round"/><text x="26" y="12" font-size="6" fill="#6A0060" font-weight="bold" font-family="Arial,sans-serif">z</text><text x="29" y="8" font-size="4" fill="#6A0060" font-weight="bold" font-family="Arial,sans-serif">z</text></svg>',
    anxious:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#4361EE"/><path d="M10 13 Q13 11 16 13" stroke="#1430A0" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M20 13 Q23 11 26 13" stroke="#1430A0" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="13" cy="17" r="2.5" fill="white"/><circle cx="23" cy="17" r="2.5" fill="white"/><circle cx="13" cy="17" r="1.5" fill="#1430A0"/><circle cx="23" cy="17" r="1.5" fill="#1430A0"/><path d="M13 23 Q15.5 21 17 23 Q18.5 25 21 23" stroke="#1430A0" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M27 8 Q29 5 31 9 Q31 12 28.5 12 Q26 12 27 8Z" fill="#C5CAF9"/></svg>',
    frustrated: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#F72585"/><path d="M10 14 Q13 17 16 13" stroke="#8C0049" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M20 13 Q23 17 26 14" stroke="#8C0049" stroke-width="2.5" fill="none" stroke-linecap="round"/><ellipse cx="13" cy="19" rx="2.5" ry="1.8" fill="#8C0049"/><ellipse cx="23" cy="19" rx="2.5" ry="1.8" fill="#8C0049"/><path d="M13 24 Q18 22 23 24" stroke="#8C0049" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M5 15 Q7 12 9 15" stroke="#FFB3D1" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M27 15 Q29 12 31 15" stroke="#FFB3D1" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
    sad:        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#3A0CA3"/><circle cx="13" cy="15" r="2.5" fill="#C4B5F4"/><circle cx="23" cy="15" r="2.5" fill="#C4B5F4"/><path d="M12 25 Q18 22 24 25" stroke="#C4B5F4" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
    numb:       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#6C757D"/><circle cx="13" cy="17" r="2" fill="#2C3034"/><circle cx="23" cy="17" r="2" fill="#2C3034"/><line x1="13" y1="23" x2="23" y2="23" stroke="#2C3034" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  // Health ring SVG icons for renderHomeHealthRings
  const HEALTH_RING_ICONS = [
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>',
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#60a5fa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z"/><path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0"/></svg>',
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.409 13.017A5 5 0 0 1 22 15c0 3.866-4 7-9 7-4.077 0-8.153-.82-10.371-2.462-.426-.316-.631-.832-.62-1.362C2.118 12.723 2.627 2 10 2a3 3 0 0 1 3 3 2 2 0 0 1-2 2c-1.105 0-1.64-.444-2-1"/><path d="M15 14a5 5 0 0 0-7.584 2"/><path d="M9.964 6.825C8.019 7.977 9.5 13 8 15"/></svg>'
  ];

  function lucideIconHtml(name, size) {
    size = size || 14;
    return '<i data-lucide="' + name + '" width="' + size + '" height="' + size + '"></i>';
  }

  function moodSvgUri(key) {
    const svg = MOOD_SVGS[key];
    return svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) : '';
  }

  function getMood(ymd) { return storeGet('mood:' + ymd); }
  function setMood(ymd, key) { storeSet('mood:' + ymd, key); }
  function deleteMood(ymd) { storeDelete('mood:' + ymd); }

  function getMoodDef(key) {
    for (let i = 0; i < MOOD_DEFS.length; i++) {
      if (MOOD_DEFS[i].key === key) return MOOD_DEFS[i];
    }
    return null;
  }

  // ----------- State -----------
  let emojiPickerCallback = null;
  let lastFocus = null;
  let _newHabitIcon = 'moon';

  // ============================================================
  // ANALYTICS COMPUTE HELPERS
  // ============================================================

  function streakFor(habitId) {
    var current = 0, best = 0, run = 0;
    for (var i = 0; i < 365; i++) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var data = getDayData(dateToYMD(d));
      if (data && data.entries && data.entries[habitId]) { current++; } else { break; }
    }
    for (var i = 0; i < 365; i++) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var data = getDayData(dateToYMD(d));
      if (data && data.entries && data.entries[habitId]) { run++; if (run > best) best = run; } else { run = 0; }
    }
    return { current: current, best: best };
  }

  function consistencyForWeek() {
    var monday = getMonday();
    var defs = getDefinitions().filter(function(d) { return d.active; });
    if (!defs.length) return 0;
    var done = 0, total = 0, today = todayYMD();
    for (var d = 0; d < 7; d++) {
      var day = new Date(monday); day.setDate(day.getDate() + d);
      var ymd = dateToYMD(day);
      if (ymd > today) continue;
      var data = getDayData(ymd);
      defs.forEach(function(def) {
        total++;
        if (data && data.entries && data.entries[def.id]) done++;
      });
    }
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  function completionPct(habitId, days) {
    var done = 0;
    for (var i = 0; i < days; i++) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var data = getDayData(dateToYMD(d));
      if (data && data.entries && data.entries[habitId]) done++;
    }
    return Math.round((done / days) * 100);
  }

  function moodHabitCorrelation() {
    var MOOD_SCALE = { motivated: 5, happy: 5, calm: 4, numb: 2, tired: 2, anxious: 2, frustrated: 2, sad: 1 };
    var defs = getDefinitions().filter(function(d) { return d.active; });
    if (!defs.length) return null;
    var bestCorr = null, bestDiff = 0;
    defs.forEach(function(def) {
      var sumDone = 0, countDone = 0, sumNot = 0, countNot = 0;
      for (var i = 1; i <= 30; i++) {
        var d = new Date(); d.setDate(d.getDate() - i);
        var ymd = dateToYMD(d);
        var data = getDayData(ymd);
        var mk = getMood(ymd);
        if (!mk || MOOD_SCALE[mk] == null) continue;
        var score = MOOD_SCALE[mk];
        if (data && data.entries && data.entries[def.id]) { sumDone += score; countDone++; }
        else { sumNot += score; countNot++; }
      }
      if (countDone < 3) return;
      var avgDone = sumDone / countDone;
      var avgNot = countNot > 0 ? sumNot / countNot : avgDone;
      var diff = avgDone - avgNot;
      if (Math.abs(diff) > Math.abs(bestDiff)) { bestDiff = diff; bestCorr = { def: def, diff: diff }; }
    });
    return bestCorr;
  }

  // ============================================================
  // HABIT TRACKER — ANALYTICS RENDERERS
  // ============================================================

  function renderHabitsSummary() {
    var el = $('htSummaryBody');
    if (!el) return;
    var defs = getDefinitions().filter(function(d) { return d.active; });
    var pillEl = $('htStreakPill');
    if (!defs.length) {
      el.innerHTML = '<div class="hm-empty">No habits defined. Click ⚙ to add one.</div>';
      if (pillEl) { pillEl.textContent = ''; pillEl.classList.remove('gm-streak-active'); }
      return;
    }
    var weekPct = consistencyForWeek();
    var bestStreakVal = 0, bestStreakDef = null, activeStreaks = 0;
    defs.forEach(function(def) {
      var s = streakFor(def.id);
      if (s.current > 0) activeStreaks++;
      if (s.current > bestStreakVal) { bestStreakVal = s.current; bestStreakDef = def; }
    });
    if (pillEl) {
      if (bestStreakVal > 0) { pillEl.textContent = '🔥 ' + bestStreakVal + 'd'; pillEl.classList.add('gm-streak-active'); }
      else { pillEl.textContent = 'No streak'; pillEl.classList.remove('gm-streak-active'); }
    }
    el.innerHTML =
      '<div style="display:flex;gap:16px;flex-wrap:wrap;padding:4px 0 2px;">' +
        '<div class="po-metric">' +
          '<div class="po-metric-title">This Week</div>' +
          '<div class="po-metric-val">' + weekPct + '<span style="font-size:14px;font-weight:500;color:var(--muted)">%</span></div>' +
          '<div class="po-bar" style="margin-top:6px"><div class="po-bar-fill po-bar-green" style="width:' + weekPct + '%"></div></div>' +
          '<div class="po-metric-sub">consistency</div>' +
        '</div>' +
        '<div class="po-metric-sep"></div>' +
        '<div class="po-metric">' +
          '<div class="po-metric-title">On Streak</div>' +
          '<div class="po-metric-val">' + activeStreaks + '<span style="font-size:14px;font-weight:500;color:var(--muted)">/' + defs.length + '</span></div>' +
          '<div class="po-metric-sub">active habits</div>' +
        '</div>' +
        '<div class="po-metric-sep"></div>' +
        '<div class="po-metric">' +
          '<div class="po-metric-title">Best Streak</div>' +
          '<div class="po-metric-val">' + bestStreakVal + '<span style="font-size:14px;font-weight:500;color:var(--muted)">d</span></div>' +
          '<div class="po-metric-sub">' + (bestStreakDef ? escHtml(bestStreakDef.name) : '—') + '</div>' +
        '</div>' +
      '</div>';
  }

  function renderTodayChips() {
    var el = $('htChipRow');
    if (!el) return;
    var defs = getDefinitions().filter(function(d) { return d.active; });
    var today = todayYMD();
    if (!defs.length) { el.innerHTML = '<div class="hm-empty">No active habits.</div>'; return; }
    el.innerHTML = defs.map(function(def) {
      var data = getDayData(today);
      var done = !!(data && data.entries && data.entries[def.id]);
      return '<button class="ht-chip' + (done ? ' is-done' : '') + '" data-id="' + def.id + '">' +
        lucideIconHtml(def.icon || 'circle', 14) + ' ' + escHtml(def.name) + '</button>';
    }).join('');
    el.querySelectorAll('.ht-chip').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-id');
        var cur = getDayData(today) || { entries: {}, notes: '' };
        cur.entries[id] = !cur.entries[id];
        setDayData(today, cur);
        renderTodayChips();
        renderHabitHeatmaps();
        renderHabitsSummary();
        renderHabitRings();
        renderHabitTrend();
      });
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function renderHabitHeatmaps() {
    var el = $('htHeatmapBody');
    if (!el) return;
    var defs = getDefinitions().filter(function(d) { return d.active; });
    var today = todayYMD();
    if (!defs.length) { el.innerHTML = '<div class="hm-empty">No active habits.</div>'; return; }
    var dates = [];
    for (var i = 27; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      dates.push(dateToYMD(d));
    }
    var html = '';
    defs.forEach(function(def) {
      html += '<div class="ht-hm-row"><div class="ht-hm-label">' +
        lucideIconHtml(def.icon || 'circle', 13) + '<span>' + escHtml(def.name) + '</span></div><div class="ht-hm-cells">';
      dates.forEach(function(ymd) {
        var data = getDayData(ymd);
        var done = !!(data && data.entries && data.entries[def.id]);
        var cls = 'ht-hm-cell' + (done ? ' done' : '') + (ymd === today ? ' today' : '') + (ymd > today ? ' future' : '');
        html += '<div class="' + cls + '" data-id="' + def.id + '" data-ymd="' + ymd + '" title="' + ymd + '"></div>';
      });
      html += '</div></div>';
    });
    el.innerHTML = html;
    el.querySelectorAll('.ht-hm-cell:not(.future)').forEach(function(cell) {
      cell.addEventListener('click', function() {
        var id = cell.getAttribute('data-id');
        var ymd = cell.getAttribute('data-ymd');
        var cur = getDayData(ymd) || { entries: {}, notes: '' };
        cur.entries[id] = !cur.entries[id];
        setDayData(ymd, cur);
        renderHabitHeatmaps();
        renderTodayChips();
        renderHabitsSummary();
        renderHabitRings();
        renderHabitTrend();
      });
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function renderHabitRings() {
    var el = $('htRingsBody');
    if (!el) return;
    var defs = getDefinitions().filter(function(d) { return d.active; });
    if (!defs.length) { el.innerHTML = '<div class="hm-empty">No active habits.</div>'; return; }
    var today = new Date();
    var weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 6);
    var html = '';
    defs.forEach(function(def) {
      var done = 0;
      for (var d = new Date(weekAgo); d <= today; d.setDate(d.getDate() + 1)) {
        var data = getDayData(dateToYMD(d));
        if (data && data.entries && data.entries[def.id]) done++;
      }
      var pct = Math.round((done / 7) * 100);
      var r = 31, c = 2 * Math.PI * r;
      html += '<div class="hfr-item"><div class="hfr-ring"><svg viewBox="0 0 72 72">' +
        '<circle class="hfr-track" cx="36" cy="36" r="' + r + '"/>' +
        '<circle class="hfr-fill" cx="36" cy="36" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - pct / 100)).toFixed(1) + '"/>' +
        '</svg><span class="hfr-pct">' + pct + '%</span></div>' +
        '<span class="hfr-name">' + lucideIconHtml(def.icon || 'circle', 14) + ' ' + escHtml(def.name) + '</span>' +
        '<span class="hfr-sublabel">' + done + '/7 days</span></div>';
    });
    el.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function renderHabitTrend() {
    var el = $('htTrendSvg');
    if (!el) return;
    var defs = getDefinitions().filter(function(d) { return d.active; });
    if (!defs.length) { el.innerHTML = ''; return; }
    var pts = [];
    for (var i = 29; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var ymd = dateToYMD(d);
      var data = getDayData(ymd);
      var done = 0;
      defs.forEach(function(def) { if (data && data.entries && data.entries[def.id]) done++; });
      pts.push({ ymd: ymd, pct: Math.round((done / defs.length) * 100) });
    }
    var W = 300, H = 80, pX = 8, pY = 10;
    var xOf = function(i) { return pX + (i / 29) * (W - 2 * pX); };
    var yOf = function(p) { return H - pY - (p / 100) * (H - 2 * pY); };
    var pathD = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + xOf(i).toFixed(1) + ',' + yOf(p.pct).toFixed(1); }).join(' ');
    var circles = pts.map(function(p, i) {
      return '<circle cx="' + xOf(i).toFixed(1) + '" cy="' + yOf(p.pct).toFixed(1) + '" r="3" data-tip="' + p.ymd + ': ' + p.pct + '%"/>';
    }).join('');
    el.innerHTML = '<path d="' + pathD + '"/>' + circles;
  }

  function renderHabitInsights() {
    var el = $('htInsightsBody');
    if (!el) return;
    var defs = getDefinitions().filter(function(d) { return d.active; });
    if (!defs.length) { el.innerHTML = ''; return; }
    var DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var dowC = [0,0,0,0,0,0,0], dowT = [0,0,0,0,0,0,0];
    for (var i = 0; i < 90; i++) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var dow = d.getDay(); var data = getDayData(dateToYMD(d));
      defs.forEach(function(def) {
        dowT[dow]++;
        if (data && data.entries && data.entries[def.id]) dowC[dow]++;
      });
    }
    var bestDow = 0, bestRate = 0;
    for (var j = 0; j < 7; j++) {
      var rate = dowT[j] > 0 ? dowC[j] / dowT[j] : 0;
      if (rate > bestRate) { bestRate = rate; bestDow = j; }
    }
    var bestStreakVal = 0, bestStreakDef = null;
    defs.forEach(function(def) {
      var s = streakFor(def.id);
      if (s.current > bestStreakVal) { bestStreakVal = s.current; bestStreakDef = def; }
    });
    var slipDef = null, slipDrop = 0;
    defs.forEach(function(def) {
      var recent = completionPct(def.id, 14);
      var oldDone = 0;
      for (var k = 30; k < 60; k++) {
        var dd = new Date(); dd.setDate(dd.getDate() - k);
        var ddata = getDayData(dateToYMD(dd));
        if (ddata && ddata.entries && ddata.entries[def.id]) oldDone++;
      }
      var old = Math.round((oldDone / 30) * 100);
      var drop = old - recent;
      if (old >= 40 && drop > slipDrop) { slipDrop = drop; slipDef = def; }
    });
    var corr = moodHabitCorrelation();
    var ins = function(icon, bg, title, sub) {
      return '<div class="ins-card"><div class="ins-icon" style="background:' + bg + '">' + lucideIconHtml(icon, 16) + '</div>' +
        '<div style="min-width:0"><div class="ins-title">' + title + '</div><div class="ins-sub">' + sub + '</div></div></div>';
    };
    var html = ins('calendar', 'rgba(var(--accent-rgb),0.15)', 'Best Day', DAY_NAMES[bestDow] + ' — ' + Math.round(bestRate * 100) + '%');
    html += (bestStreakVal > 0 && bestStreakDef)
      ? ins('flame', 'rgba(255,159,28,0.15)', 'Top Streak', bestStreakVal + 'd — ' + escHtml(bestStreakDef.name))
      : ins('flame', 'rgba(255,159,28,0.15)', 'Top Streak', 'Start one today!');
    html += slipDef
      ? ins('trending-down', 'rgba(247,37,133,0.15)', 'Needs Attention', escHtml(slipDef.name) + ' (' + slipDrop + '% drop)')
      : ins('trending-up', 'rgba(95,214,135,0.15)', 'All Steady', 'No habits slipping');
    html += corr
      ? ins('brain', 'rgba(67,97,238,0.15)', escHtml(corr.def.name), corr.diff > 0 ? '→ better mood days' : '→ lower mood days')
      : ins('brain', 'rgba(67,97,238,0.15)', 'Mood Link', 'Log mood to see patterns');
    el.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function renderHabitsView() {
    renderHabitsSummary();
    renderTodayChips();
    renderHabitHeatmaps();
    renderHabitRings();
    renderHabitTrend();
    renderHabitInsights();
    var notesEl = $('htTodayNotes');
    var today = todayYMD();
    if (notesEl) {
      var data = getDayData(today) || { entries: {}, notes: '' };
      notesEl.value = data.notes || '';
      notesEl.oninput = function() {
        var cur = getDayData(today) || { entries: {}, notes: '' };
        cur.notes = notesEl.value;
        setDayData(today, cur);
      };
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ----------- Habit Settings Modal -----------
  function renderSettings() {
    const defs = getDefinitions();
    const listEl = $('htSetList');
    if (!listEl) return;
    listEl.innerHTML = '';

    defs.forEach((def, idx) => {
      const row = document.createElement('div');
      row.className = 'ht-set-item';

      const emojiBtn = document.createElement('button');
      emojiBtn.className = 'ht-set-eb';
      emojiBtn.innerHTML = lucideIconHtml(def.icon || 'moon', 15);

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'ht-set-in';
      nameInput.value = def.name;

      const togBtn = document.createElement('button');
      togBtn.className = 'ht-set-tog' + (def.active !== false ? ' is-on' : '');

      const delBtn = document.createElement('button');
      delBtn.className = 'ht-set-del';
      delBtn.innerHTML = lucideIconHtml('trash-2', 13);

      emojiBtn.addEventListener('click', () => {
        lastFocus = document.activeElement;
        emojiPickerCallback = (iconName) => {
          def.icon = iconName;
          defs[idx] = def;
          setDefinitions(defs);
          renderSettings();
          renderHabitsView();
        };
        $('htEpBg').classList.add('show');
        renderEmojiPicker(def.icon || 'moon');
        setTimeout(() => { const f = $('htEpBg').querySelector('button'); if (f) f.focus(); }, 60);
      });

      nameInput.addEventListener('blur', () => {
        const newName = nameInput.value.trim();
        if (newName && newName !== def.name) {
          const newId = generateId(newName);
          if (defs.some((d, i) => i !== idx && d.id === newId)) {
            nameInput.value = def.name;
            return;
          }
          const oldId = def.id;
          def.name = newName;
          def.id = newId;
          defs[idx] = def;
          setDefinitions(defs);

          const keys = storeListKeys('habits:');
          keys.forEach((key) => {
            const data = storeGet(key);
            if (data && data.entries && data.entries[oldId] !== undefined) {
              data.entries[newId] = data.entries[oldId];
              delete data.entries[oldId];
              storeSet(key, data);
            }
          });
          renderHabitsView();
        }
      });

      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nameInput.blur();
      });

      togBtn.addEventListener('click', () => {
        def.active = !def.active;
        defs[idx] = def;
        setDefinitions(defs);
        renderSettings();
        renderHabitsView();
      });

      delBtn.addEventListener('click', () => {
        showConfirm('Delete "' + def.name + '"? This cannot be undone.', () => {
          defs.splice(idx, 1);
          setDefinitions(defs);
          const keys = storeListKeys('habits:');
          keys.forEach((key) => {
            const data = storeGet(key);
            if (data && data.entries) {
              delete data.entries[def.id];
              storeSet(key, data);
            }
          });
          renderSettings();
          renderHabitsView();
        }, true);
      });

      row.appendChild(emojiBtn);
      row.appendChild(nameInput);
      row.appendChild(togBtn);
      row.appendChild(delBtn);
      listEl.appendChild(row);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function openSettings() {
    lastFocus = document.activeElement;
    renderSettings();
    $('htSetBg').classList.add('show');
    setTimeout(() => { const f = $('htSetBg').querySelector('button, input'); if (f) f.focus(); }, 60);
  }

  function closeSettings() {
    $('htSetBg').classList.remove('show');
    renderHabitsView();
    if (lastFocus) { lastFocus.focus(); lastFocus = null; }
  }

  function handleAddHabit() {
    const nameInput = $('htAddName');
    const emojiBtn = $('htAddEmoji');
    const name = nameInput.value.trim();
    if (!name) return;

    const id = generateId(name);
    const defs = getDefinitions();
    if (defs.some((d) => d.id === id)) {
      nameInput.value = '';
      return;
    }

    defs.push({ id, name, icon: _newHabitIcon, active: true });
    setDefinitions(defs);
    nameInput.value = '';
    renderSettings();
    renderHabitsView();
  }

  // ----------- Icon Picker -----------
  const ICON_LIST = [
    'moon', 'sparkles', 'sun', 'ban', 'droplet', 'dumbbell', 'pen-tool', 'list-checks',
    'utensils', 'book', 'music', 'bike', 'heart', 'star', 'brain', 'coffee',
    'code', 'palette', 'camera', 'smile', 'zap', 'target', 'compass', 'clock',
    'calendar', 'leaf', 'eye', 'flag', 'gift', 'home', 'key', 'tree-pine',
    'cloud', 'mountain', 'users', 'feather', 'search', 'plus', 'cross', 'apple',
    'wine', 'beer', 'droplets', 'paw-print', 'ruler', 'bell', 'refresh-cw', 'check'
  ];

  function renderEmojiPicker(currentIcon) {
    const grid = $('htEpGrid');
    if (!grid) return;
    grid.innerHTML = '';
    ICON_LIST.forEach(function(iconName) {
      const btn = document.createElement('button');
      btn.className = 'ht-ep-cell';
      btn.innerHTML = lucideIconHtml(iconName, 20);
      if (iconName === currentIcon) btn.classList.add('is-on');
      btn.addEventListener('click', function() {
        if (emojiPickerCallback) emojiPickerCallback(iconName);
        $('htEpBg').classList.remove('show');
        emojiPickerCallback = null;
      });
      grid.appendChild(btn);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function closeEmojiPicker() {
    $('htEpBg').classList.remove('show');
    emojiPickerCallback = null;
    if (lastFocus) { lastFocus.focus(); lastFocus = null; }
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    // Settings
    const settingsBtn = $('htSettingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    const closeBtn = $('htCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);
    const setBg = $('htSetBg');
    if (setBg) {
      setBg.addEventListener('click', (e) => {
        if (e.target === setBg) closeSettings();
      });
    }

    // Add habit
    const addBtn = $('htAddBtn');
    if (addBtn) addBtn.addEventListener('click', handleAddHabit);
    const addNameInput = $('htAddName');
    if (addNameInput) addNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAddHabit();
    });

    // Icon picker button for new habit
    const addEmojiBtn = $('htAddEmoji');
    if (addEmojiBtn) {
      addEmojiBtn.innerHTML = lucideIconHtml(_newHabitIcon, 16);
      addEmojiBtn.addEventListener('click', () => {
        lastFocus = document.activeElement;
        emojiPickerCallback = (iconName) => {
          _newHabitIcon = iconName;
          addEmojiBtn.innerHTML = lucideIconHtml(iconName, 16);
          if (typeof lucide !== 'undefined') lucide.createIcons();
        };
        $('htEpBg').classList.add('show');
        renderEmojiPicker(_newHabitIcon);
        setTimeout(() => { const f = $('htEpBg').querySelector('button'); if (f) f.focus(); }, 60);
      });
    }

    const epClose = $('htEpClose');
    if (epClose) epClose.addEventListener('click', closeEmojiPicker);
    const epBg = $('htEpBg');
    if (epBg) {
      epBg.addEventListener('click', (e) => {
        if (e.target === epBg) closeEmojiPicker();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if ($('htSetBg').classList.contains('show')) { closeSettings(); return; }
      if ($('htEpBg').classList.contains('show')) { closeEmojiPicker(); return; }
    });

    // Initial render
    renderHabitsView();
    renderHomeHealthRings();
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Clear note and re-render when calendar day changes
    let _lastDay = todayYMD();
    setInterval(() => {
      const d = todayYMD();
      if (d !== _lastDay) { _lastDay = d; renderHabitsView(); }
    }, 60000);
  }

  // ============ HOME TAB FULL HABIT RINGS ============
  function renderHabitFullRings(containerId) {
    containerId = containerId || 'habitFullWidget';
    var el = $(containerId);
    if (!el) return;

    var defs = getDefinitions().filter(function(d) { return d.active; });
    var top3 = defs.slice(0, 3);

    var today = new Date();
    var weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);

    var html = '';
    top3.forEach(function(def) {
      var done = 0;
      var total = 0;
      for (var d = new Date(weekAgo); d <= today; d.setDate(d.getDate() + 1)) {
        total++;
        var ymd = dateToYMD(d);
        var data = getDayData(ymd);
        if (data && data.entries[def.id]) done++;
      }

      var pct = total > 0 ? Math.round((done / total) * 100) : 0;
      var r = 31;
      var c = 2 * Math.PI * r;
      var offset = c * (1 - pct / 100);

      html += '<div class="hfr-item">';
      html += '<div class="hfr-ring">';
      html += '<svg viewBox="0 0 72 72">';
      html += '<circle class="hfr-track" cx="36" cy="36" r="' + r + '"/>';
      html += '<circle class="hfr-fill" cx="36" cy="36" r="' + r + '" stroke-dasharray="' + c + '" stroke-dashoffset="' + offset + '"/>';
      html += '</svg>';
      html += '<span class="hfr-pct">' + pct + '%</span>';
      html += '</div>';
      html += '<span class="hfr-name">' + lucideIconHtml(def.icon || 'circle', 14) + ' ' + def.name + '</span>';
      html += '<span class="hfr-sublabel">' + done + '/7 days</span>';
      html += '</div>';
    });

    el.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  window.renderHabitFullRings = renderHabitFullRings;

  function renderHomeHealthRings(containerId) {
    containerId = containerId || 'habitFullWidget';
    var el = document.getElementById(containerId);
    if (!el) return;

    var ymd = getTodayYmd();
    var day = getHealthData(ymd);

    var settings = { water_goal_oz: 64, sleep_goal_hours: 8, protein_goal_g: 118 };
    try {
      var s = JSON.parse(localStorage.getItem('health_settings') || '{}');
      if (s.water_goal_oz) settings.water_goal_oz = s.water_goal_oz;
      if (s.sleep_goal_hours) settings.sleep_goal_hours = s.sleep_goal_hours;
      if (s.protein_goal_g) settings.protein_goal_g = s.protein_goal_g;
    } catch(e) {}

    var sleepH = day.sleep_hours || 0;
    var waterOz = day.water_oz || 0;
    var proteinG = (day.nutrition_totals && day.nutrition_totals.protein_g) || 0;

    var metrics = [
      {
        label: 'Sleep', color: 'var(--green)',
        pct: Math.min(100, Math.round(sleepH / settings.sleep_goal_hours * 100)),
        sub: sleepH > 0 ? (Math.floor(sleepH) + 'h ' + Math.round((sleepH % 1) * 60) + 'm / ' + settings.sleep_goal_hours + 'h') : '—',
        tip: function(p) {
          return p < 60 ? 'Sleep is low. Aim for ' + settings.sleep_goal_hours + 'h tonight.' : 'Sleep recovery looks stable.';
        }
      },
      {
        label: 'Water', color: '#60a5fa',
        pct: Math.min(100, Math.round(waterOz / settings.water_goal_oz * 100)),
        sub: waterOz > 0 ? (Math.round(waterOz) + 'oz / ' + settings.water_goal_oz + 'oz') : '—',
        tip: function(p) {
          if (p < 50) return 'Hydration is low. Aim for ' + Math.round(settings.water_goal_oz - waterOz) + 'oz more.';
          return 'Hydration levels look good.';
        }
      },
      {
        label: 'Protein', color: 'var(--accent)',
        pct: Math.min(100, Math.round(proteinG / settings.protein_goal_g * 100)),
        sub: proteinG > 0 ? (Math.round(proteinG) + 'g / ' + settings.protein_goal_g + 'g') : '—',
        tip: function(p) {
          if (p < 50) return 'Protein is below target. Aim for ' + Math.round(settings.protein_goal_g - proteinG) + 'g more.';
          return 'Protein intake is on track.';
        }
      }
    ];

    var html = '';
    metrics.forEach(function(m, i) {
      html += '<div class="rm-h-item">';
      html += '<div class="rm-h-header">';
      html += '<span class="rm-h-icon">' + HEALTH_RING_ICONS[i] + '</span>';
      html += '<span class="rm-h-label">' + m.label + '</span>';
      html += '<span class="rm-h-pct">' + m.pct + '%</span>';
      html += '</div>';
      html += '<div class="rm-h-bar-track"><div class="rm-h-bar-fill" style="width:' + m.pct + '%;background:' + m.color + '"></div></div>';
      html += '<div class="rm-h-sub">' + m.sub + '</div>';
      html += '<div class="rm-h-tip">' + m.tip(m.pct) + '</div>';
      html += '</div>';
    });
    el.innerHTML = html;
  }
  window.renderHomeHealthRings = renderHomeHealthRings;

  function renderHomeMood() {
    var el = document.getElementById('moodWidget');
    if (!el) return;

    var ymd = dateToYMD(new Date());
    var currentKey = getMood(ymd);
    var def = currentKey ? getMoodDef(currentKey) : null;

    const MOOD_NOTES = {
      happy: 'Riding high today.', calm: 'Steady and balanced.',
      motivated: 'Crushing it!', tired: 'Rest when you can.',
      anxious: 'Take a breath.', frustrated: 'Hang in there.',
      sad: 'Be kind to yourself.', numb: 'Just getting through it.'
    };

    var heroHtml = def
      ? '<div class="mood-current">' +
          '<img class="mood-svg-lg" src="' + moodSvgUri(def.key) + '" alt="' + def.label + '">' +
          '<div class="mood-info"><div class="mood-name">' + def.label + '</div><div class="mood-note">' + (MOOD_NOTES[def.key] || '') + '</div></div>' +
        '</div>'
      : '<div class="mood-current">' +
          '<div class="mood-svg-placeholder">·</div>' +
          '<div class="mood-info"><div class="mood-name">—</div><div class="mood-note">How are you feeling?</div></div>' +
        '</div>';

    var pickerHtml = '<div class="mood-picker">' +
      MOOD_DEFS.map(function(m) {
        return '<button class="mood-pick' + (m.key === currentKey ? ' active' : '') +
          '" data-mood-key="' + m.key + '" title="' + m.label + '">' +
          '<img class="mood-pick-icon" src="' + moodSvgUri(m.key) + '" alt="' + m.label + '"></button>';
      }).join('') +
    '</div>';

    el.innerHTML = heroHtml + pickerHtml;

    el.querySelectorAll('.mood-pick').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var k = btn.getAttribute('data-mood-key');
        if (k === currentKey) deleteMood(ymd);
        else setMood(ymd, k);
        renderHomeMood();
      });
    });

    // Sparkline
    var sparkEl = document.getElementById('moodSparkline');
    if (sparkEl) {
      const MOOD_SCALE = { motivated: 5, happy: 5, calm: 4, numb: 2, tired: 2, anxious: 2, frustrated: 2, sad: 1 };
      const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const mk = getMood(dateToYMD(d));
        const def = mk ? getMoodDef(mk) : null;
        const score = mk && MOOD_SCALE[mk] != null ? MOOD_SCALE[mk] : -1;
        days.push({ score: score, def: def, date: d });
      }
      const w = 200, h = 89, padX = 16, padTop = 0, padBottom = 41, r = 6, labelY = 68;
      var lines = '';
      var circles = '';
      var labels = '';
      var prev = null;
      days.forEach(function(d, vi) {
        var x = padX + (vi / 6) * (w - 2 * padX);
        var dayLbl = DAY_NAMES[d.date.getDay()][0];
        labels += '<text x="' + Math.round(x) + '" y="' + labelY + '">' + dayLbl + '</text>';
        if (d.score < 0) { prev = null; return; }
        var y = h - padBottom - ((d.score - 1) / 4) * (h - padBottom - padTop);
        if (prev) {
          lines += '<line x1="' + Math.round(prev.x) + '" y1="' + Math.round(prev.y) + '" x2="' + Math.round(x) + '" y2="' + Math.round(y) + '"/>';
        }
        prev = { x: x, y: y };
        var tipLabel = (d.date.getMonth() + 1) + '/' + d.date.getDate();
        var tip = d.def ? tipLabel + ' \u2014 ' + d.def.label : tipLabel;
        circles += '<circle cx="' + Math.round(x) + '" cy="' + Math.round(y) + '" r="' + r + '" fill="var(--accent)" data-tip="' + tip + '"/>';
      });
      sparkEl.innerHTML = '<g>' + lines + circles + labels + '</g>';

      if (!sparkEl._moodTip) {
        sparkEl._moodTip = document.createElement('div');
        sparkEl._moodTip.className = 'mood-tip';
        document.body.appendChild(sparkEl._moodTip);
        sparkEl.addEventListener('mouseover', function(e) {
          var c = e.target.closest('circle');
          var tip = sparkEl._moodTip;
          if (!c) { tip.style.display = 'none'; return; }
          var t = c.getAttribute('data-tip');
          if (t) { tip.textContent = t; tip.style.display = 'block'; }
        });
        sparkEl.addEventListener('mousemove', function(e) {
          var tip = sparkEl._moodTip;
          if (tip.style.display !== 'block') return;
          tip.style.left = (e.clientX + 10) + 'px';
          tip.style.top = (e.clientY - 28) + 'px';
        });
        sparkEl.addEventListener('mouseout', function(e) {
          if (e.target.closest('circle')) sparkEl._moodTip.style.display = 'none';
        });
      }
    }
  }
  window.renderHomeMood = renderHomeMood;
  window.moodSvgUri = moodSvgUri;
  window.MOOD_DEFS = MOOD_DEFS;
  window.getMood = getMood;
  window.setMood = setMood;
  window.deleteMood = deleteMood;

  function render() {
    renderHabitsView();
  }

  window.renderHabits = render;

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
