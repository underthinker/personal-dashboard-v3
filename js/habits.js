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
    { id: 'journal', name: 'Journal', icon: 'notebook', active: true },
    { id: 'productive', name: 'Productive Tasks', icon: 'list-checks', active: true },
    { id: 'hygiene', name: 'Personal Hygiene', icon: 'sparkles', active: true },
    { id: 'healthy_meals', name: 'Eat healthy meals', icon: 'utensils', active: true },
    { id: 'no_alcohol', name: 'No Alcohol', icon: 'wine', active: true },
    { id: 'go_outside', name: 'Go outside', icon: 'sun', active: true },
    { id: 'creativity', name: 'Creativity', icon: 'pen-tool', active: true },
    { id: 'no_fap', name: 'No fap', icon: 'ban', active: true },
    { id: 'reading', name: 'Reading', icon: 'book', active: true },
  ];

  const ESTIMATED_EFFORT = {
    journal: 2, reading: 5, hygiene: 3, healthy_meals: 5,
    productive: 15, no_alcohol: 1, go_outside: 5, creativity: 15, no_fap: 1,
  };
  const WEEKLY_TARGET_PCT = 0.8;
  const TREND_MIN_PCT = 22; // min ~3/14 days to show directional trend

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

  function flashRefresh(el) {
    if (!el) return;
    el.classList.remove('ht-flash');
    void el.offsetWidth;
    el.classList.add('ht-flash');
    el.addEventListener('animationend', function handler() {
      el.classList.remove('ht-flash');
      el.removeEventListener('animationend', handler);
    });
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
    var today = new Date();
    var todayData = getDayData(dateToYMD(today));
    var todayDone = todayData && todayData.entries && todayData.entries[habitId];
    for (var i = 1; i < 365; i++) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var data = getDayData(dateToYMD(d));
      if (data && data.entries && data.entries[habitId]) { current++; } else { break; }
    }
    if (todayDone) current++;
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
    var MOOD_SCALE = { happy: 10, motivated: 9, calm: 8, tired: 6, anxious: 5, frustrated: 4, numb: 3, sad: 1 };
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

  // ============================================================
  // NEW ANALYTICS HELPERS
  // ============================================================

  function consistencyLastWeek() {
    var monday = getMonday();
    var lastMonday = new Date(monday); lastMonday.setDate(lastMonday.getDate() - 7);
    var defs = getDefinitions().filter(function(d) { return d.active; });
    if (!defs.length) return 0;
    var done = 0, total = 0;
    for (var d = 0; d < 7; d++) {
      var day = new Date(lastMonday); day.setDate(day.getDate() + d);
      var ymd = dateToYMD(day);
      var data = getDayData(ymd);
      defs.forEach(function(def) {
        total++;
        if (data && data.entries && data.entries[def.id]) done++;
      });
    }
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  function weeklySparklinePts(weeks) {
    var defs = getDefinitions().filter(function(d) { return d.active; });
    var pts = [];
    var today = todayYMD();
    for (var w = weeks - 1; w >= 0; w--) {
      var monday = getMonday(); monday.setDate(monday.getDate() - w * 7);
      var done = 0, total = 0;
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
      pts.push(total > 0 ? Math.round((done / total) * 100) : 0);
    }
    return pts;
  }

  function habitSparklinePts(habitId, days) {
    var pts = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var data = getDayData(dateToYMD(d));
      pts.push(data && data.entries && data.entries[habitId] ? 1 : 0);
    }
    return pts;
  }

  function miniSparklineSvg(pts, w, h, color) {
    if (!pts || pts.length < 2) return '';
    var max = Math.max.apply(null, pts);
    var min = Math.min.apply(null, pts);
    var range = max - min || 1;
    var pad = 2;
    var xStep = (w - 2 * pad) / (pts.length - 1);
    var coords = pts.map(function(v, i) {
      return {
        x: (pad + i * xStep).toFixed(1),
        y: (h - pad - ((v - min) / range) * (h - 2 * pad)).toFixed(1)
      };
    });
    var d = coords.map(function(c, i) { return (i === 0 ? 'M' : 'L') + c.x + ',' + c.y; }).join(' ');
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" class="ht-spark-svg"><path d="' + d + '" pathLength="1" class="ht-spark-path" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  // ============================================================
  // RENDER: TOP METRICS ROW
  // ============================================================

  function renderTopMetrics() {
    var el = $('htTopRow');
    if (!el) return;
    var defs = getDefinitions().filter(function(d) { return d.active; });
    var today = todayYMD();

    var weekPct = consistencyForWeek();

    var bestStreakVal = 0, bestStreakDef = null;
    defs.forEach(function(def) {
      var s = streakFor(def.id);
      if (s.current > bestStreakVal) { bestStreakVal = s.current; bestStreakDef = def; }
    });

    var dayData = getDayData(today);
    var doneToday = 0;
    defs.forEach(function(def) { if (dayData && dayData.entries && dayData.entries[def.id]) doneToday++; });
    var todayPct = defs.length > 0 ? Math.round((doneToday / defs.length) * 100) : 0;

    var monday = getMonday();
    var totalPossible = 0, totalDone = 0;
    for (var d = 0; d < 7; d++) {
      var day = new Date(monday); day.setDate(day.getDate() + d);
      var ymd = dateToYMD(day);
      if (ymd > today) continue;
      var data = getDayData(ymd);
      defs.forEach(function(def) {
        totalPossible++;
        if (data && data.entries && data.entries[def.id]) totalDone++;
      });
    }
    var missed = totalPossible - totalDone;

    var lastWeekPct = consistencyLastWeek();
    var trendDiff = weekPct - lastWeekPct;
    var trendSign = trendDiff >= 0 ? '+' : '';
    var trendColor = trendDiff >= 0 ? 'var(--green)' : 'var(--danger)';
    var missedColor = missed === 0 ? 'var(--green)' : missed <= 3 ? 'var(--amber)' : 'var(--danger)';
    var missedLabel = missed === 0 ? 'On track!' : missed <= 3 ? 'Below avg.' : 'Needs work';

    var trendSpark = miniSparklineSvg(weeklySparklinePts(6), 64, 28, trendDiff >= 0 ? 'var(--green)' : 'var(--danger)');

    var dailyPts = [];
    for (var i = 6; i >= 0; i--) {
      var dd = new Date(); dd.setDate(dd.getDate() - i);
      var ddymd = dateToYMD(dd);
      var dddata = getDayData(ddymd);
      var ddDone = 0;
      defs.forEach(function(def) { if (dddata && dddata.entries && dddata.entries[def.id]) ddDone++; });
      dailyPts.push(defs.length > 0 ? ddDone / defs.length : 0);
    }
    var consSpark = miniSparklineSvg(dailyPts, 54, 28, 'var(--accent)');

    var html = '';

    html += '<div class="card ht-mc" data-metric="consistency">' +
      '<div class="ht-mc-head">' + lucideIconHtml('activity', 13) + '<span>HABIT CONSISTENCY</span></div>' +
      '<div class="ht-mc-body">' +
        '<div>' +
          '<div class="ht-mc-num"><span class="ht-mc-val">' + weekPct + '</span><span class="ht-mc-unit">%</span></div>' +
          '<div class="ht-mc-sub">This Week</div>' +
        '</div>' +
        '<div class="ht-mc-visual">' + consSpark + '</div>' +
      '</div>' +
    '</div>';

    html += '<div class="card ht-mc" data-metric="streak">' +
      '<div class="ht-mc-head">' + lucideIconHtml('flame', 13) + '<span>LONGEST STREAK</span></div>' +
      '<div class="ht-mc-body">' +
        '<div>' +
          '<div class="ht-mc-num"><span class="ht-mc-val">' + bestStreakVal + '</span><span class="ht-mc-unit"> days</span></div>' +
          '<div class="ht-mc-sub">' + (bestStreakDef ? escHtml(bestStreakDef.name) : 'None yet') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    html += '<div class="card ht-mc" data-metric="today">' +
      '<div class="ht-mc-head">' + lucideIconHtml('check-circle', 13) + '<span>HABITS COMPLETED TODAY</span></div>' +
      '<div class="ht-mc-body">' +
        '<div>' +
          '<div class="ht-mc-num"><span class="ht-mc-val">' + doneToday + '</span><span class="ht-mc-unit"> / ' + defs.length + '</span></div>' +
          '<div class="ht-mc-sub">' + todayPct + '%</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    html += '<div class="card ht-mc" data-metric="missed">' +
      '<div class="ht-mc-head">' + lucideIconHtml('x-circle', 13) + '<span>MISSED THIS WEEK</span></div>' +
      '<div class="ht-mc-body">' +
        '<div>' +
          '<div class="ht-mc-num"><span class="ht-mc-val">' + missed + '</span></div>' +
          '<div class="ht-mc-sub" style="color:' + missedColor + '">' + escHtml(missedLabel) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    html += '<div class="card ht-mc" data-metric="trend">' +
      '<div class="ht-mc-head">' + lucideIconHtml('trending-up', 13) + '<span>TREND VS LAST WEEK</span></div>' +
      '<div class="ht-mc-body">' +
        '<div>' +
          '<div class="ht-mc-num" style="color:' + trendColor + '"><span class="ht-mc-val">' + trendSign + trendDiff + '</span><span class="ht-mc-unit">%</span></div>' +
          '<div class="ht-mc-sub">Consistency</div>' +
        '</div>' +
        trendSpark +
      '</div>' +
    '</div>';

    el.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function _updateTopMetrics() {
    var el = $('htTopRow');
    if (!el) return;
    var defs = getDefinitions().filter(function(d) { return d.active; });
    var today = todayYMD();

    var weekPct = consistencyForWeek();

    var bestStreakVal = 0, bestStreakDef = null;
    defs.forEach(function(def) {
      var s = streakFor(def.id);
      if (s.current > bestStreakVal) { bestStreakVal = s.current; bestStreakDef = def; }
    });

    var dayData = getDayData(today);
    var doneToday = 0;
    defs.forEach(function(def) { if (dayData && dayData.entries && dayData.entries[def.id]) doneToday++; });
    var todayPct = defs.length > 0 ? Math.round((doneToday / defs.length) * 100) : 0;

    var monday = getMonday();
    var totalPossible = 0, totalDone = 0;
    for (var d = 0; d < 7; d++) {
      var day = new Date(monday); day.setDate(day.getDate() + d);
      var ymd = dateToYMD(day);
      if (ymd > today) continue;
      var data = getDayData(ymd);
      defs.forEach(function(def) {
        totalPossible++;
        if (data && data.entries && data.entries[def.id]) totalDone++;
      });
    }
    var missed = totalPossible - totalDone;

    var lastWeekPct = consistencyLastWeek();
    var trendDiff = weekPct - lastWeekPct;
    var trendSign = trendDiff >= 0 ? '+' : '';
    var trendColor = trendDiff >= 0 ? 'var(--green)' : 'var(--danger)';
    var missedColor = missed === 0 ? 'var(--green)' : missed <= 3 ? 'var(--amber)' : 'var(--danger)';
    var missedLabel = missed === 0 ? 'On track!' : missed <= 3 ? 'Below avg.' : 'Needs work';

    var dailyPts = [];
    for (var i = 6; i >= 0; i--) {
      var dd = new Date(); dd.setDate(dd.getDate() - i);
      var ddymd = dateToYMD(dd);
      var dddata = getDayData(ddymd);
      var ddDone = 0;
      defs.forEach(function(def) { if (dddata && dddata.entries && dddata.entries[def.id]) ddDone++; });
      dailyPts.push(defs.length > 0 ? ddDone / defs.length : 0);
    }
    var consSpark = miniSparklineSvg(dailyPts, 54, 28, 'var(--accent)');
    var trendPts = weeklySparklinePts(6);
    var trendSpark = miniSparklineSvg(trendPts, 64, 28, trendDiff >= 0 ? 'var(--green)' : 'var(--danger)');

    function swapSvg(parent, newSvgStr) {
      if (!parent) return;
      var tmp = document.createElement('div');
      tmp.innerHTML = newSvgStr;
      var ns = tmp.firstElementChild;
      var os = parent.querySelector('svg');
      if (ns && os) os.replaceWith(ns);
      else if (ns) parent.appendChild(ns);
    }

    // Card 1: Consistency
    var c = el.querySelector('[data-metric="consistency"]');
    if (c) {
      c.querySelector('.ht-mc-val').textContent = weekPct;
      swapSvg(c.querySelector('.ht-mc-visual'), consSpark);
    }

    // Card 2: Streak
    c = el.querySelector('[data-metric="streak"]');
    if (c) {
      c.querySelector('.ht-mc-val').textContent = bestStreakVal;
      c.querySelector('.ht-mc-sub').textContent = bestStreakDef ? escHtml(bestStreakDef.name) : 'None yet';
    }

    // Card 3: Today
    c = el.querySelector('[data-metric="today"]');
    if (c) {
      c.querySelector('.ht-mc-val').textContent = doneToday;
      var unit = c.querySelector('.ht-mc-unit');
      if (unit) unit.textContent = ' / ' + defs.length;
      c.querySelector('.ht-mc-sub').textContent = todayPct + '%';
    }

    // Card 4: Missed
    c = el.querySelector('[data-metric="missed"]');
    if (c) {
      c.querySelector('.ht-mc-val').textContent = missed;
      var sub = c.querySelector('.ht-mc-sub');
      if (sub) {
        sub.textContent = missedLabel;
        sub.style.color = missedColor;
      }
    }

    // Card 5: Trend
    c = el.querySelector('[data-metric="trend"]');
    if (c) {
      c.querySelector('.ht-mc-val').textContent = trendSign + trendDiff;
      c.querySelector('.ht-mc-val').style.color = trendColor;
      swapSvg(c.querySelector('.ht-mc-body'), trendSpark);
    }
  }

  // ============================================================
  // RENDER: HABITS OVERVIEW TABLE
  // ============================================================

  var _overviewSortable = null;

  function renderOverviewTable() {
    var el = $('htOverviewBody');
    if (!el) return;
    var defs = getDefinitions().filter(function(d) { return d.active; });

    if (!defs.length) {
      el.innerHTML = '<div class="hm-empty" style="padding:20px 0;text-align:center">No habits. Open settings to add some.</div>';
      return;
    }

    var html = '';
    defs.forEach(function(def) {
      var pct30 = completionPct(def.id, 30);
      var streak = streakFor(def.id).current;

      var pts14 = habitSparklinePts(def.id, 28);
      var recentPct = completionPct(def.id, 14);
      var prevDone = 0;
      for (var k = 14; k < 28; k++) {
        var dd = new Date(); dd.setDate(dd.getDate() - k);
        var dddata = getDayData(dateToYMD(dd));
        if (dddata && dddata.entries && dddata.entries[def.id]) prevDone++;
      }
      var prevPct = Math.round((prevDone / 14) * 100);
      var trendDiff = recentPct - prevPct;
      var trendSuppressed = recentPct < TREND_MIN_PCT && prevPct < TREND_MIN_PCT;
      if (trendSuppressed) trendDiff = 0;
      var trendColor = trendDiff > 0 ? 'var(--green)' : trendDiff < 0 ? 'var(--danger)' : 'var(--muted)';
      var trendArrow = trendDiff > 0 ? '↑' : trendDiff < 0 ? '↓' : '—';
      var trendStr = trendDiff !== 0 ? (trendDiff > 0 ? '+' : '') + trendDiff + '%' : '0%';
      var trendTitle = trendSuppressed ? ' title="Insufficient data (min 3 entries in 14 days)"' : '';
      var sparkColor = trendDiff > 0 ? 'var(--green)' : trendDiff < 0 ? 'var(--danger)' : 'var(--muted)';
      var sparkSvg = miniSparklineSvg(pts14, 56, 20, sparkColor);

      html += '<div class="ht-ov-row" data-habit-id="' + escHtml(def.id) + '">' +
        '<span class="ht-ov-drag">⋮⋮</span>' +
        '<div class="ht-ov-habit">' +
          '<span class="ht-ov-icon">' + lucideIconHtml(def.icon || 'circle', 14) + '</span>' +
          '<span class="ht-ov-name">' + escHtml(def.name) + '</span>' +
        '</div>' +
        '<div class="ht-ov-cons">' +
          '<div class="ht-ov-bar"><div class="ht-ov-bar-fill" style="width:' + pct30 + '%"></div></div>' +
          '<span class="ht-ov-pct">' + pct30 + '%</span>' +
        '</div>' +
        '<div class="ht-ov-streak">' + streak + ' days</div>' +
        '<div class="ht-ov-trend">' + sparkSvg + '<span style="color:' + trendColor + '"' + trendTitle + '>' + trendArrow + ' ' + trendStr + '</span></div>' +
      '</div>';
    });

    el.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    if (window.Sortable && !_overviewSortable) {
      _overviewSortable = Sortable.create(el, {
        handle: '.ht-ov-drag',
        animation: 150,
        ghostClass: 'ht-ov-drag-ghost',
        onEnd: function() {
          var allDefs = getDefinitions();
          var rows = el.querySelectorAll('.ht-ov-row[data-habit-id]');
          var reordered = [];
          rows.forEach(function(r) {
            var d = allDefs.find(function(x) { return x.id === r.dataset.habitId; });
            if (d) reordered.push(d);
          });
          setDefinitions(reordered);
          renderHabitsView();
        }
      });
    }
  }

  // ============================================================
  // RENDER: WEEKLY HEATMAP
  // ============================================================

  function renderWeeklyHeatmap() {
    var el = $('htWeekHeatmapBody');
    if (!el) return;
    var defs = getDefinitions().filter(function(d) { return d.active; });
    var today = todayYMD();

    if (!defs.length) { el.innerHTML = '<div class="hm-empty" style="padding:16px 0">No active habits.</div>'; return; }

    var monday = getMonday();
    var weekDays = [];
    for (var d = 0; d < 7; d++) {
      var day = new Date(monday); day.setDate(day.getDate() + d);
      weekDays.push(dateToYMD(day));
    }

    var DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var checkSvg = '<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var html = '<div class="ht-wk-body"><div class="ht-wk-grid">';

    html += '<div class="ht-wk-row ht-wk-header">';
    html += '<div class="ht-wk-icon-col"></div>';
    DAY_LABELS.forEach(function(name, i) {
      var isToday = weekDays[i] === today;
      html += '<div class="ht-wk-day-label' + (isToday ? ' is-today' : '') + '">' + name + '</div>';
    });
    html += '</div>';

    defs.forEach(function(def) {
      html += '<div class="ht-wk-row">';
      html += '<div class="ht-wk-icon-col">' + lucideIconHtml(def.icon || 'circle', 13) + '</div>';
      weekDays.forEach(function(ymd) {
        var isFuture = ymd > today;
        var data = getDayData(ymd);
        var done = !!(data && data.entries && data.entries[def.id]);
        var isToday = ymd === today;
        var cls = 'ht-wk-cell';
        if (done) cls += ' done';
        if (isToday) cls += ' today';
        if (isFuture) cls += ' future';
        html += '<div class="' + cls + '" data-id="' + def.id + '" data-ymd="' + ymd + '">' +
          (done ? checkSvg : '') + '</div>';
      });
      html += '</div>';
    });

    html += '</div></div>';
    el.innerHTML = html;
    flashRefresh(el);

    el.querySelectorAll('.ht-wk-cell:not(.future)').forEach(function(cell) {
      cell.addEventListener('click', function() {
        var id = cell.getAttribute('data-id');
        var ymd = cell.getAttribute('data-ymd');
        var cur = getDayData(ymd) || { entries: {}, notes: '' };
        cur.entries[id] = !cur.entries[id];
        setDayData(ymd, cur);
        renderWeeklyHeatmap();
        _updateTopMetrics();
        renderOverviewTable();
        renderInsightsCard();
        renderFocusAreas();
      });
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ============================================================
  // RENDER: INSIGHTS CARD
  // ============================================================

  var _COLOR_MAP = {
    green: { icon: 'rgba(95,214,135,0.18)', text: 'var(--green)' },
    amber: { icon: 'rgba(232,163,69,0.18)', text: 'var(--amber)' },
    accent: { icon: 'rgba(var(--accent-rgb),0.18)', text: 'var(--accent)' },
    blue: { icon: 'rgba(91,168,247,0.18)', text: 'var(--blue)' },
    danger: { icon: 'rgba(255,107,107,0.18)', text: 'var(--danger)' }
  };
  var _insTimer = null;
  var _insFadeTimer = null;
  var _insOffset = 0;
  var _allInsights = [];

  function _stopInsTimer() {
    if (_insTimer) { clearInterval(_insTimer); _insTimer = null; }
  }

  function _onDotClick(e) {
    var dot = e.target.closest('.ht-ins-dot');
    if (!dot || !dot.hasAttribute('data-ins')) return;
    var idx = parseInt(dot.getAttribute('data-ins'));
    if (isNaN(idx)) return;
    var el = $('htInsightsBody');
    if (!el) return;
    var leftEl = el.querySelector('.ht-insights-left');
    if (!leftEl) return;
    // Cancel any pending fade so the jump takes effect immediately
    if (_insFadeTimer) { clearTimeout(_insFadeTimer); _insFadeTimer = null; }
    leftEl._fading = false;
    leftEl.style.opacity = '';
    var newOff = idx % _allInsights.length;
    storeSet('habit_ins_offset', newOff);
    _stopInsTimer();
    _insOffset = newOff;
    _renderInsightWindow();
    var total = _allInsights.length;
    var show = 4;
    if (total > show) {
      _insTimer = setInterval(function() {
        _insOffset = (_insOffset + 1) % _allInsights.length;
        _renderInsightWindow();
      }, 720000);
    }
  }

  function renderInsightsCard() {
    _stopInsTimer();
    var el = $('htInsightsBody');
    if (!el) return;
    var defs = getDefinitions().filter(function(d) { return d.active; });
    if (!defs.length) { el.innerHTML = ''; _allInsights = []; return; }

    var DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var MON_SUN = [1, 2, 3, 4, 5, 6, 0];

    var dowDone = [0, 0, 0, 0, 0, 0, 0];
    var dowTotal = [0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < 90; i++) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var dow = d.getDay();
      var data = getDayData(dateToYMD(d));
      defs.forEach(function(def) {
        dowTotal[dow]++;
        if (data && data.entries && data.entries[def.id]) dowDone[dow]++;
      });
    }
    var dowRates = dowDone.map(function(done, i) { return dowTotal[i] > 0 ? done / dowTotal[i] : 0; });

    var bestDow = 0, worstDow = 0;
    for (var j = 1; j < 7; j++) {
      if (dowRates[j] > dowRates[bestDow]) bestDow = j;
      if (dowRates[j] < dowRates[worstDow]) worstDow = j;
    }

    var sortedDows = [0, 1, 2, 3, 4, 5, 6].sort(function(a, b) { return dowRates[b] - dowRates[a]; });
    var top3Names = sortedDows.slice(0, 3).map(function(d) { return DAY_SHORT[d]; });

    var bestStreakVal = 0, bestStreakDef = null;
    defs.forEach(function(def) {
      var s = streakFor(def.id);
      if (s.current > bestStreakVal) { bestStreakVal = s.current; bestStreakDef = def; }
    });

    var perfectHabit = null, perfectStreak = 0;
    defs.forEach(function(def) {
      var p = completionPct(def.id, 30);
      var s = streakFor(def.id).current;
      if (p >= 95 && s > perfectStreak) { perfectStreak = s; perfectHabit = def; }
    });

    var allInsights = [];

    if (perfectHabit) {
      allInsights.push({ color: 'green', lucide: 'check-circle',
        title: escHtml(perfectHabit.name) + ' has been perfect for ' + perfectStreak + ' days',
        sub: 'Amazing consistency!' });
    }

    allInsights.push({ color: 'amber', lucide: 'alert-triangle',
      title: escHtml(DAY_FULL[worstDow]) + ' tends to be your hardest day',
      sub: 'Consider adjusting your schedule' });

    var productiveDef = defs.find(function(d) { return d.id === 'productive'; });
    if (productiveDef) {
      var prodRecent = completionPct(productiveDef.id, 7);
      var prodOlder = completionPct(productiveDef.id, 14);
      var prodChange = prodRecent - prodOlder;
      if (Math.abs(prodChange) >= 3) {
        allInsights.push({ color: prodChange > 0 ? 'green' : 'danger',
          lucide: prodChange > 0 ? 'trending-up' : 'trending-down',
          title: 'Productive tasks are ' + (prodChange > 0 ? 'up' : 'down') + ' ' + Math.abs(Math.round(prodChange)) + '% from last week',
          sub: prodChange > 0 ? 'Great momentum' : 'Try blocking time for tasks' });
      }
    }

    if (bestStreakDef && bestStreakVal > 0) {
      allInsights.push({ color: 'accent', lucide: 'flame',
        title: escHtml(bestStreakDef.name) + ' streak is your longest this month',
        sub: 'Keep nurturing this habit' });
    }

    var outsideDef = defs.find(function(d) { return d.id === 'go_outside'; });
    if (outsideDef) {
      var outsideRecent = completionPct(outsideDef.id, 14);
      if (outsideRecent < 60) {
        allInsights.push({ color: 'danger', lucide: 'sun',
          title: 'Going outside is down ' + (100 - outsideRecent) + '%',
          sub: 'Try pairing it with a habit you already do' });
      }
    }

    // Always add consistent days as a rotatable option
    allInsights.push({ color: 'blue', lucide: 'calendar',
      title: top3Names.join(', ') + ' are your most consistent days',
      sub: 'Schedule key habits on these days' });

    const savedOff = storeGet('habit_ins_offset');
    _insOffset = (savedOff && savedOff >= 0 && savedOff < allInsights.length) ? savedOff : 0;
    _allInsights = allInsights;

    // Render initial window starting from saved offset
    var total = allInsights.length;
    var show = 4;
    var start = _insOffset % total;
    var items = [];
    for (var i = 0; i < show && i < total; i++) {
      items.push(allInsights[(start + i) % total]);
    }
    var insHtml = items.map(function(ins) {
      var c = _COLOR_MAP[ins.color] || _COLOR_MAP.blue;
      return '<div class="ht-ins2-item">' +
        '<div class="ht-ins2-icon" style="background:' + c.icon + ';color:' + c.text + '">' + lucideIconHtml(ins.lucide, 14) + '</div>' +
        '<div class="ht-ins2-text">' +
          '<div class="ht-ins2-title" style="color:' + c.text + '">' + ins.title + '</div>' +
          '<div class="ht-ins2-sub">' + ins.sub + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    var dotsHtml = '';
    if (total > show) {
      dotsHtml = '<div class="ht-ins-dots">';
      for (var i = 0; i < total; i++) {
        dotsHtml += '<span class="ht-ins-dot' + (i === start ? ' active' : '') + '" data-ins="' + i + '"></span>';
      }
      dotsHtml += '</div>';
    }

    var maxRate = Math.max.apply(null, dowRates) || 1;
    function buildBarChart(highlightDow, highlightColor) {
      var h = '<div class="ht-mini-bar-chart">';
      MON_SUN.forEach(function(di) {
        var rate = dowRates[di];
        var hPx = Math.max(2, Math.round((rate / maxRate) * 28));
        var isHL = di === highlightDow;
        var barColor = isHL ? highlightColor : 'rgba(var(--accent-rgb),0.35)';
        h += '<div class="ht-mini-bar-wrap">' +
          '<div class="ht-mini-bar" style="height:' + hPx + 'px;background:' + barColor + '"></div>' +
          '<span class="ht-mini-bar-lbl">' + DAY_SHORT[di][0] + '</span>' +
        '</div>';
      });
      h += '</div>';
      return h;
    }

    var rightHtml =
      '<div class="ht-days-block">' +
        '<div class="ht-days-lbl">BEST DAYS</div>' +
        '<div class="ht-days-val">' + top3Names.join(', ') + '</div>' +
        '<div class="ht-days-sub">Most consistent</div>' +
        buildBarChart(bestDow, 'var(--accent)') +
      '</div>' +
      '<div class="ht-days-block">' +
        '<div class="ht-days-lbl">HARDEST DAY</div>' +
        '<div class="ht-days-val" style="color:var(--amber)">' + DAY_FULL[worstDow] + '</div>' +
        '<div class="ht-days-sub">Lowest consistency</div>' +
        buildBarChart(worstDow, 'var(--amber)') +
      '</div>';

    el.innerHTML = '<div class="ht-insights-left">' + insHtml + dotsHtml + '</div>' +
      '<div class="ht-insights-right">' + rightHtml + '</div>';

    if (typeof lucide !== 'undefined') lucide.createIcons();

    var leftEl = el.querySelector('.ht-insights-left');
    if (leftEl) leftEl.addEventListener('click', _onDotClick);

    // Start rotation timer when there are more insights than slots
    if (total > show) {
      _insTimer = setInterval(function() {
        _insOffset = (_insOffset + 1) % _allInsights.length;
        _renderInsightWindow();
      }, 720000);
    }
  }

  function _renderInsightWindow() {
    var el = $('htInsightsBody');
    if (!el || !_allInsights.length) return;
    var leftEl = el.querySelector('.ht-insights-left');
    if (!leftEl || leftEl._fading) return;

    var total = _allInsights.length;
    var show = 4;
    var start = _insOffset % total;
    var items = [];
    for (var i = 0; i < show; i++) {
      items.push(_allInsights[(start + i) % total]);
    }
    var insHtml = items.map(function(ins) {
      var c = _COLOR_MAP[ins.color] || _COLOR_MAP.blue;
      return '<div class="ht-ins2-item">' +
        '<div class="ht-ins2-icon" style="background:' + c.icon + ';color:' + c.text + '">' + lucideIconHtml(ins.lucide, 14) + '</div>' +
        '<div class="ht-ins2-text">' +
          '<div class="ht-ins2-title" style="color:' + c.text + '">' + ins.title + '</div>' +
          '<div class="ht-ins2-sub">' + ins.sub + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    var dotsHtml = '';
    if (total > show) {
      dotsHtml = '<div class="ht-ins-dots">';
      for (var i = 0; i < total; i++) {
        dotsHtml += '<span class="ht-ins-dot' + (i === start ? ' active' : '') + '" data-ins="' + i + '"></span>';
      }
      dotsHtml += '</div>';
    }

    leftEl._fading = true;
    leftEl.style.opacity = '0';
    _insFadeTimer = setTimeout(function() {
      leftEl.innerHTML = insHtml + dotsHtml;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      leftEl.style.opacity = '';
      leftEl._fading = false;
      _insFadeTimer = null;
    }, 200);
  }

  // ============================================================
  // FOCUS AREAS — COMPUTE
  // ============================================================

  function computeFocusAreas() {
    var defs = getDefinitions().filter(function(d) { return d.active; });
    if (!defs.length) return null;

    var today = todayYMD();

    function lastDoneDays(habitId) {
      for (var i = 0; i < 90; i++) {
        var d = new Date(); d.setDate(d.getDate() - i);
        var data = getDayData(dateToYMD(d));
        if (data && data.entries && data.entries[habitId]) return i;
      }
      return 90;
    }

    function consecMissesSinceLastDone(habitId) {
      var misses = 0;
      for (var i = 0; i < 90; i++) {
        var d = new Date(); d.setDate(d.getDate() - i);
        var data = getDayData(dateToYMD(d));
        if (data && data.entries && data.entries[habitId]) return misses;
        misses++;
      }
      return misses;
    }

    function recentMisses(habitId, days) {
      var count = 0;
      for (var i = 0; i < days; i++) {
        var d = new Date(); d.setDate(d.getDate() - i);
        var data = getDayData(dateToYMD(d));
        if (!(data && data.entries && data.entries[habitId])) count++;
      }
      return count;
    }

    var habitStats = defs.map(function(def) {
      var pct30 = completionPct(def.id, 30);
      var pct14 = completionPct(def.id, 14);
      var pctPrev = 0;
      for (var k = 14; k < 28; k++) {
        var d = new Date(); d.setDate(d.getDate() - k);
        var data = getDayData(dateToYMD(d));
        if (data && data.entries && data.entries[def.id]) pctPrev++;
      }
      pctPrev = Math.round((pctPrev / 14) * 100);
      var trend = pct14 - pctPrev;
      if (pct14 < TREND_MIN_PCT && pctPrev < TREND_MIN_PCT) trend = 0;
      var negativeTrend = trend < 0 ? Math.abs(trend) : 0;
      var rMisses = recentMisses(def.id, 7);
      var impactScore = (100 - pct30) + (negativeTrend * 1.5) + (rMisses * 2);
      var lastDone = lastDoneDays(def.id);

      return {
        def: def,
        pct30: pct30,
        trend: trend,
        negativeTrend: negativeTrend,
        impactScore: impactScore,
        lastDoneDays: lastDone,
        consecMisses: consecMissesSinceLastDone(def.id),
        recentMisses: rMisses,
      };
    });

    habitStats.sort(function(a, b) { return b.impactScore - a.impactScore; });
    var highestImpact = habitStats[0];

    var recoveryPool = habitStats.filter(function(h) { return h.lastDoneDays > 2; });
    recoveryPool.sort(function(a, b) {
      if (a.lastDoneDays !== b.lastDoneDays) return b.lastDoneDays - a.lastDoneDays;
      return b.consecMisses - a.consecMisses;
    });
    var recovery = recoveryPool.slice(0, 3);

    var todayData = getDayData(today);
    function doneToday(id) { return !!(todayData && todayData.entries && todayData.entries[id]); }
    var winPool = habitStats.filter(function(h) { return h.pct30 > 30 && !doneToday(h.def.id); });
    winPool.sort(function(a, b) {
      var ea = ESTIMATED_EFFORT[a.def.id] || 5;
      var eb = ESTIMATED_EFFORT[b.def.id] || 5;
      if (ea !== eb) return ea - eb;
      return b.pct30 - a.pct30;
    });
    if (winPool.length < 3) {
      habitStats.forEach(function(h) {
        if (winPool.length >= 3) return;
        if (winPool.indexOf(h) === -1 && !doneToday(h.def.id)) winPool.push(h);
      });
    }
    var quickWins = winPool.slice(0, 3);

    var monday = getMonday();
    var weeklyCompletions = 0, totalPossible = 0;
    for (var d = 0; d < 7; d++) {
      var day = new Date(monday); day.setDate(day.getDate() + d);
      var ymd = dateToYMD(day);
      if (ymd > today) continue;
      var data = getDayData(ymd);
      defs.forEach(function(def) {
        totalPossible++;
        if (data && data.entries && data.entries[def.id]) weeklyCompletions++;
      });
    }
    var currentPct = totalPossible > 0 ? Math.round((weeklyCompletions / totalPossible) * 100) : 0;
    var targetCompletions = Math.ceil(totalPossible * WEEKLY_TARGET_PCT);
    var completionsNeeded = Math.max(0, targetCompletions - weeklyCompletions);
    var targetPct = Math.round(WEEKLY_TARGET_PCT * 100);

    return {
      highestImpact: highestImpact,
      recovery: recovery,
      quickWins: quickWins,
      weeklyGoal: {
        currentPct: currentPct,
        targetPct: targetPct,
        completionsNeeded: completionsNeeded,
        weeklyCompletions: weeklyCompletions,
        totalPossible: totalPossible,
      },
    };
  }

  // ============================================================
  // RENDER: FOCUS AREAS
  // ============================================================

  function impactExplanation(h) {
    if (h.negativeTrend > 20) return 'Largest declining habit, major opportunity';
    if (h.recentMisses >= 5) return 'Most frequently missed, start small';
    if (h.pct30 < 25) return 'Lowest consistency, biggest gap to close';
    if (h.negativeTrend > 10) return 'Declining fast, intervene now';
    return 'Highest potential impact habit';
  }

  function recoveryExplanation(h) {
    var parts = [];
    if (h.lastDoneDays > 1) parts.push('Last ' + h.lastDoneDays + ' days ago');
    if (h.consecMisses > 0) parts.push('Missed ' + h.consecMisses + ' straight');
    return parts.join(' \u00B7 ');
  }

  function renderFocusAreas() {
    var el = $('htFocusBody');
    if (!el) return;
    var data = computeFocusAreas();
    if (!data) { el.innerHTML = ''; return; }

    var trendArrow = data.highestImpact.trend < 0 ? '↓' : '↑';
    var trendColor = data.highestImpact.trend < 0 ? 'var(--danger)' : 'var(--green)';

    var html = '';

    // Section 1: Highest Impact
    html += '<div class="ht-focus-impact">' +
      '<div class="ht-focus-impact-row">' +
        '<span class="ht-focus-impact-icon">' + lucideIconHtml(data.highestImpact.def.icon || 'circle', 14) + '</span>' +
        '<div class="ht-focus-impact-info">' +
          '<div class="ht-focus-impact-name">' + escHtml(data.highestImpact.def.name) + '</div>' +
          '<div class="ht-focus-impact-pct"><span class="ht-focus-impact-num">' + data.highestImpact.pct30 + '%</span> consistency</div>' +
        '</div>' +
        '<div class="ht-focus-impact-trend" style="color:' + trendColor + '">' + trendArrow + ' ' + Math.abs(data.highestImpact.trend) + '%</div>' +
      '</div>' +
      '<div class="ht-focus-impact-exp">' + impactExplanation(data.highestImpact) + '</div>' +
    '</div>';

    // Section 2: Recovery Candidates
    html += '<div class="ht-focus-divider"></div>' +
      '<div class="ht-focus-section">' +
      '<div class="ht-focus-section-label">NEEDS ATTENTION</div>';

    if (data.recovery.length === 0) {
      html += '<div class="ht-focus-empty">No habits at risk right now</div>';
    } else {
      data.recovery.forEach(function(h) {
        html += '<div class="ht-focus-rec-item">' +
          '<span class="ht-focus-rec-icon">' + lucideIconHtml(h.def.icon || 'circle', 12) + '</span>' +
          '<div class="ht-focus-rec-info">' +
            '<div class="ht-focus-rec-name">' + escHtml(h.def.name) + '</div>' +
            '<div class="ht-focus-rec-meta">' + recoveryExplanation(h) + '</div>' +
          '</div>' +
        '</div>';
      });
    }
    html += '</div>';

    // Section 3: Quick Wins
    html += '<div class="ht-focus-divider"></div>' +
      '<div class="ht-focus-section">' +
      '<div class="ht-focus-section-label">QUICK WINS</div>' +
      '<div class="ht-focus-wins-row">';

    data.quickWins.forEach(function(h) {
      html += '<div class="ht-focus-win-item">' +
        '<span class="ht-focus-win-check">' +
          '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="var(--green)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</span>' +
        '<span class="ht-focus-win-name">' + escHtml(h.def.name) + '</span>' +
      '</div>';
    });

    html += '</div></div>';

    // Section 4: Weekly Goal
    var wg = data.weeklyGoal;
    var goalPct = Math.min(100, wg.totalPossible > 0 ? Math.round((wg.weeklyCompletions / wg.totalPossible) * 100) : 0);
    html += '<div class="ht-focus-divider"></div>' +
      '<div class="ht-focus-goal">' +
      '<div class="ht-focus-goal-row">' +
        '<span class="ht-focus-goal-lbl">Weekly Consistency</span>' +
        '<span class="ht-focus-goal-pcts">' + wg.currentPct + '% → ' + wg.targetPct + '%</span>' +
      '</div>' +
      '<div class="ht-focus-goal-track">' +
        '<div class="ht-focus-goal-fill" style="width:' + goalPct + '%"></div>' +
      '</div>' +
      '<div class="ht-focus-goal-sub">' +
        (wg.completionsNeeded > 0
          ? wg.completionsNeeded + ' more completion' + (wg.completionsNeeded !== 1 ? 's' : '') + ' needed to reach target'
          : 'Target reached, great week!') +
      '</div>' +
    '</div>';

    el.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ============================================================
  // RENDER: MAIN VIEW
  // ============================================================

  function renderHabitsView() {
    renderTopMetrics();
    renderOverviewTable();
    renderWeeklyHeatmap();
    renderInsightsCard();
    renderFocusAreas();

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

    // Add new habit button (main view)
    const addNewBtn = $('htAddNewBtn');
    if (addNewBtn) addNewBtn.addEventListener('click', openSettings);

    // Add habit (inside modal)
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

  // Swappable macro slot (3rd home health ring). All accent-colored so they
  // follow the user's accent preference. Icon strokes use var(--accent).
  // Lucide icon names matching the Health tab macro bars (flame/wheat/droplet/beef).
  var MACRO_SLOTS = [
    { key: 'protein',  label: 'Protein',  totalKey: 'protein_g', goalKey: 'protein_goal_g', unit: 'g', icon: 'beef'    },
    { key: 'calories', label: 'Calories', totalKey: 'calories',  goalKey: 'calorie_goal',   unit: '',  icon: 'flame'   },
    { key: 'carbs',    label: 'Carbs',    totalKey: 'carbs_g',   goalKey: 'carbs_goal_g',   unit: 'g', icon: 'wheat'   },
    { key: 'fat',      label: 'Fat',      totalKey: 'fat_g',     goalKey: 'fat_goal_g',     unit: 'g', icon: 'droplet' }
  ];
  var _homeMacroIdx = 0;
  try { _homeMacroIdx = parseInt(localStorage.getItem('home_macro_slot_v1'), 10) || 0; } catch(e) {}
  if (_homeMacroIdx < 0 || _homeMacroIdx >= MACRO_SLOTS.length) _homeMacroIdx = 0;

  function renderHomeHealthRings(containerId) {
    containerId = containerId || 'habitFullWidget';
    var el = document.getElementById(containerId);
    if (!el) return;

    var ymd = todayYMD();
    var day;
    try { day = JSON.parse(localStorage.getItem('health:' + ymd) || '{}'); } catch(e) { day = {}; }

    var settings = {
      water_goal_oz: 64, sleep_goal_hours: 8,
      protein_goal_g: 118, calorie_goal: 2200, carbs_goal_g: 250, fat_goal_g: 75
    };
    try {
      var s = JSON.parse(localStorage.getItem('health_settings') || '{}');
      if (s.water_goal_oz) settings.water_goal_oz = s.water_goal_oz;
      if (s.sleep_goal_hours) settings.sleep_goal_hours = s.sleep_goal_hours;
      if (s.protein_goal_g) settings.protein_goal_g = s.protein_goal_g;
      if (s.calorie_goal) settings.calorie_goal = s.calorie_goal;
      if (s.carbs_goal_g) settings.carbs_goal_g = s.carbs_goal_g;
      if (s.fat_goal_g) settings.fat_goal_g = s.fat_goal_g;
    } catch(e) {}

    var sleepH = day.sleep_hours || 0;
    var waterOz = day.water_oz || 0;
    var totals = day.nutrition_totals || {};

    var slot = MACRO_SLOTS[_homeMacroIdx];
    var macroVal = totals[slot.totalKey] || 0;
    var macroGoal = settings[slot.goalKey];

    var metrics = [
      {
        label: 'Sleep', color: 'var(--green)', icon: HEALTH_RING_ICONS[0],
        pct: Math.min(100, Math.round(sleepH / settings.sleep_goal_hours * 100)),
        sub: sleepH > 0 ? (Math.floor(sleepH) + 'h ' + Math.round((sleepH % 1) * 60) + 'm / ' + settings.sleep_goal_hours + 'h') : '—',
        tip: function(p) {
          return p < 60 ? 'Sleep is low. Aim for ' + settings.sleep_goal_hours + 'h tonight.' : 'Sleep recovery looks stable.';
        }
      },
      {
        label: 'Water', color: '#60a5fa', icon: HEALTH_RING_ICONS[1],
        pct: Math.min(100, Math.round(waterOz / settings.water_goal_oz * 100)),
        sub: waterOz > 0 ? (Math.round(waterOz) + 'oz / ' + settings.water_goal_oz + 'oz') : '—',
        tip: function(p) {
          if (p < 50) return 'Hydration is low. Aim for ' + Math.round(settings.water_goal_oz - waterOz) + 'oz more.';
          return 'Hydration levels look good.';
        }
      },
      {
        label: slot.label, color: 'var(--accent)', icon: lucideIconHtml(slot.icon), macro: true,
        pct: Math.min(100, Math.round(macroVal / macroGoal * 100)),
        sub: macroVal > 0 ? (Math.round(macroVal) + slot.unit + ' / ' + macroGoal + slot.unit) : '—',
        tip: function(p) {
          if (p < 50) return slot.label + ' is below target. Aim for ' + Math.round(macroGoal - macroVal) + slot.unit + ' more.';
          return slot.label + ' intake is on track.';
        }
      }
    ];

    var html = '';
    metrics.forEach(function(m, i) {
      html += '<div class="rm-h-item' + (m.macro ? ' rm-h-macro' : '') + '"' + (m.macro ? ' title="Click to swap macro"' : '') + '>';
      html += '<div class="rm-h-header">';
      html += '<span class="rm-h-icon"' + (m.macro ? ' style="color:var(--accent)"' : '') + '>' + m.icon + '</span>';
      html += '<span class="rm-h-label">' + m.label + '</span>';
      html += '<span class="rm-h-pct">' + m.pct + '%</span>';
      html += '</div>';
      html += '<div class="rm-h-bar-track"><div class="rm-h-bar-fill" style="width:' + m.pct + '%;background:' + m.color + '"></div></div>';
      html += '<div class="rm-h-sub">' + m.sub + '</div>';
      html += '<div class="rm-h-tip">' + m.tip(m.pct) + '</div>';
      html += '</div>';
    });
    el.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    var macroEl = el.querySelector('.rm-h-macro');
    if (macroEl) {
      macroEl.addEventListener('click', function() {
        _homeMacroIdx = (_homeMacroIdx + 1) % MACRO_SLOTS.length;
        try { localStorage.setItem('home_macro_slot_v1', String(_homeMacroIdx)); } catch(e) {}
        renderHomeHealthRings(containerId);
      });
    }
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
      const MOOD_SCALE = { happy: 10, motivated: 9, calm: 8, tired: 6, anxious: 5, frustrated: 4, numb: 3, sad: 1 };
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
        var y = h - padBottom - ((d.score - 1) / 9) * (h - padBottom - padTop);
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
