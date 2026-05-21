(function() {
  'use strict';

  const showConfirm = window.showConfirm;
  const showAlert = window.showAlert;

  const CONFIG = {
    appTitle: "Progressive Overload Coach",
    units: "kg",
    gyms: [
      { id: "home",  name: "Home Gym" },
      { id: "comm",  name: "Commercial Gym" }
    ],
    days: [
      { id: "push", name: "Push" },
      { id: "pull", name: "Pull" },
      { id: "legs", name: "Legs" }
    ],
    splitRotation: ["push", "pull", "legs", "rest"],
    splitAnchor: { date: "2026-05-12", splitId: "rest" },
    upgradeAtReps: 8,
    composition: {
      enabled: true,
      yearsTraining: 1,
      windowDays: 30
    },
    defaultExercises: [
      { name: "Bench press",     gym: "comm", day: "push", repMin: 5, repMax: 8,  step: 2.5, startWeight: 60 },
      { name: "Overhead press",  gym: "comm", day: "push", repMin: 5, repMax: 8,  step: 2.5, startWeight: 35 },
      { name: "Tricep pushdown", gym: "comm", day: "push", repMin: 8, repMax: 12, step: 2.5, startWeight: 25 },
      { name: "Pull-ups",        gym: "both", day: "pull", repMin: 5, repMax: 10, step: 1,   startWeight: 0, bw: true },
      { name: "Barbell row",     gym: "comm", day: "pull", repMin: 6, repMax: 10, step: 2.5, startWeight: 50 },
      { name: "Bicep curl",      gym: "comm", day: "pull", repMin: 8, repMax: 12, step: 1.25,startWeight: 15 },
      { name: "Back squat",      gym: "comm", day: "legs", repMin: 5, repMax: 8,  step: 5,   startWeight: 80 },
      { name: "Romanian deadlift", gym: "comm", day: "legs", repMin: 6, repMax: 10, step: 5, startWeight: 60 },
      { name: "Leg press",       gym: "comm", day: "legs", repMin: 8, repMax: 12, step: 5,   startWeight: 100 }
    ]
  };

  const LS_KEY = 'po_coach_v1';

  function buildDefaultExercises() {
    return CONFIG.defaultExercises.map((e, i) => Object.assign({ id: 'seed_' + i + '_' + Date.now() }, e));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) {}
    return normalize({});
  }

  function normalize(s) {
    s = s || {};
    s.units = s.units || CONFIG.units || 'kg';
    s.gyms  = (Array.isArray(s.gyms)  && s.gyms.length)  ? s.gyms  : CONFIG.gyms.slice();
    s.days  = (Array.isArray(s.days)  && s.days.length)  ? s.days  : CONFIG.days.slice();
    s.exercises = Array.isArray(s.exercises) ? s.exercises : buildDefaultExercises();
    s.logs = (s.logs && typeof s.logs === 'object') ? s.logs : {};
    s.filterGym = s.filterGym || s.gyms[0].id;
    s.filterDay = s.filterDay || s.days[0].id;
    if (!Array.isArray(s.splitRotation) || !s.splitRotation.length) {
      s.splitRotation = (CONFIG.splitRotation || ['Push', 'Pull', 'Legs', 'Rest']).map(x =>
        (CONFIG.days || []).find(d => d.id === x) ? (CONFIG.days.find(d => d.id === x).name) :
        (x === 'rest' ? 'Rest' : x.charAt(0).toUpperCase() + x.slice(1))
      );
    }
    if (!s.splitAnchor || !s.splitAnchor.date || s.splitAnchor.index == null) {
      const oldId = (CONFIG.splitAnchor && CONFIG.splitAnchor.splitId) || null;
      let idx = 0;
      if (oldId) {
        const oldName = (CONFIG.days || []).find(d => d.id === oldId);
        const targetName = oldName ? oldName.name : (oldId === 'rest' ? 'Rest' : oldId);
        const found = s.splitRotation.findIndex(n => n.toLowerCase() === targetName.toLowerCase());
        if (found >= 0) idx = found;
      }
      s.splitAnchor = {
        date: (CONFIG.splitAnchor && CONFIG.splitAnchor.date) || new Date().toISOString().slice(0, 10),
        index: idx
      };
    }
    return s;
  }

  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }

  let state = loadState();

  const $ = (id) => document.getElementById(id);
  function unit() { return state.units; }
  function uid() { return 'ex_' + Date.now() + '_' + Math.floor(Math.random() * 9999); }
  function gymName(id) { const g = state.gyms.find(x => x.id === id); return g ? g.name : id; }
  function dayName(id) { const d = state.days.find(x => x.id === id); return d ? d.name : id; }
  function estimate1RM(w, r) { if (r < 2) return w; return w * (1 + r / 30); }
  function roundToStep(v, s) { return Math.round(v / s) * s; }
  function getFiltered() {
    return state.exercises.filter(e =>
      (e.gym === state.filterGym || e.gym === 'both') && e.day === state.filterDay);
  }
  function getCurrentEx() {
    const f = getFiltered();
    if (!f.length) return null;
    let ex = f.find(e => e.id === state.currentEx);
    if (!ex) { ex = f[0]; state.currentEx = ex.id; saveState(); }
    return ex;
  }
  function getLogs() { return (state.logs[state.currentEx] || []).slice(); }

  function getRx(ex, logs) {
    if (!logs.length) return null;
    const last = logs[logs.length - 1];
    const { weight, reps } = last;
    const { repMin, repMax, step, bw } = ex;
    const upgradeAt = Math.min(CONFIG.upgradeAtReps || 8, repMax);
    let stuck = 0;
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].weight === weight) stuck++; else break;
    }
    if (bw) {
      if (reps >= upgradeAt) return { type: 'up', weight: 0, reps: reps + 1, tag: 'Push for more', reason: reps + ' reps — strong. Push for ' + (reps + 1) + ' next time.', bw: true };
      if (reps >= repMin) return { type: 'hold', weight: 0, reps: reps + 1, tag: 'Add a rep', reason: reps + ' reps. Push for ' + (reps + 1) + ' next session.', bw: true };
      return { type: 'hold', weight: 0, reps: repMin, tag: 'Repeat', reason: reps + ' reps fell short. Repeat until you hit ' + repMin + '+.', bw: true };
    }
    if (stuck >= 3 && reps < repMin) {
      const dl = roundToStep(weight * 0.9, step);
      return { type: 'down', weight: dl, reps: repMax, tag: 'Deload', reason: 'Stuck at ' + weight + unit() + ' for ' + stuck + ' sessions. Drop 10%, reset, build back cleaner.' };
    }
    if (reps >= upgradeAt) return { type: 'up', weight: weight + step, reps: repMin, tag: 'Add weight', reason: 'You hit ' + reps + ' reps — time to add ' + step + unit() + '. Expect ' + repMin + '-' + (repMin + 1) + ' next session.' };
    if (reps >= repMin && reps < upgradeAt) return { type: 'hold', weight: weight, reps: reps + 1, tag: 'Add a rep', reason: reps + ' reps in target. Stay at ' + weight + unit() + ', push for ' + (reps + 1) + '.' };
    return { type: 'hold', weight: weight, reps: repMin, tag: 'Repeat', reason: reps + ' reps short of ' + repMin + '-' + upgradeAt + '. Repeat ' + weight + unit() + ' until you hit ' + repMin + '+ clean.' };
  }

  function renderFilters() {
    $('gymSeg').innerHTML = state.gyms.map(g =>
      '<button class="po-seg-btn ' + (g.id === state.filterGym ? 'active' : '') + '" data-gym="' + g.id + '">' + escHtml(g.name) + '</button>'
    ).join('');
    $('daySeg').innerHTML = state.days.map(d =>
      '<button class="po-seg-btn ' + (d.id === state.filterDay ? 'active' : '') + '" data-day="' + d.id + '">' + escHtml(d.name) + '</button>'
    ).join('');
    $('gymSeg').querySelectorAll('.po-seg-btn').forEach(b => {
      b.addEventListener('click', () => { state.filterGym = b.dataset.gym; state.currentEx = null; saveState(); renderAll(); });
    });
    $('daySeg').querySelectorAll('.po-seg-btn').forEach(b => {
      b.addEventListener('click', () => {
        state.filterDay = b.dataset.day;
        state.currentEx = null;
        state._userPickedDay = true;
        saveState(); renderAll();
      });
    });
  }

  function renderSelect() {
    const sel = $('exSelect');
    const f = getFiltered();
    const noMsg = $('noExMsg');
    const editBtn = $('editExBtn');
    const logBtn = $('logBtn');
    if (!f.length) {
      sel.innerHTML = '<option>—</option>';
      sel.disabled = true; editBtn.disabled = true; logBtn.disabled = true;
      noMsg.style.display = 'block'; state.currentEx = null;
      return;
    }
    sel.disabled = false; editBtn.disabled = false; logBtn.disabled = false;
    noMsg.style.display = 'none';
    if (!f.find(e => e.id === state.currentEx)) state.currentEx = f[0].id;
    sel.innerHTML = f.map(e => {
      const wLbl = e.bw ? ' · BW' : (e.startWeight ? ' · ' + e.startWeight + unit() : '');
      const sh = e.gym === 'both' ? ' ★' : '';
      return '<option value="' + e.id + '"' + (e.id === state.currentEx ? ' selected' : '') + '>' + escHtml(e.name) + wLbl + sh + '</option>';
    }).join('');
  }

  function renderForm() {
    const ex = getCurrentEx();
    const banner = $('bwBanner');
    const wField = $('weightField');
    const oneRmLbl = $('oneRmLabel');
    const grid = $('logGrid');
    $('weightLabel').textContent = 'Weight (' + unit() + ')';
    if (ex && ex.bw) {
      banner.classList.add('show');
      wField.style.display = 'none';
      grid.classList.add('po-bw-mode');
      oneRmLbl.textContent = 'Best reps';
    } else {
      banner.classList.remove('show');
      wField.style.display = '';
      grid.classList.remove('po-bw-mode');
      oneRmLbl.textContent = 'Est. 1RM';
    }
  }

  function renderLastSet() {
    const wrap = $('lastSet');
    const v = $('lastSetValue');
    const m = $('lastSetMeta');
    const ex = getCurrentEx();
    const logs = ex ? getLogs() : [];
    if (!ex || !logs.length) { wrap.classList.remove('show'); return; }
    const last = logs[logs.length - 1];
    const setStr = ex.bw ? (last.reps + ' reps') : (last.weight + unit() + ' × ' + last.reps);
    const d = new Date(last.date);
    const da = Math.floor((Date.now() - d.getTime()) / 86400000);
    const ago = da === 0 ? 'today' : da === 1 ? 'yesterday' : da + ' days ago';
    v.textContent = setStr;
    m.textContent = ago;
    wrap.classList.add('show');
  }

  function renderRx() {
    const wrap = $('rxWrap');
    const ex = getCurrentEx();
    if (!ex) { wrap.innerHTML = '<div class="po-rx-empty">Pick a gym and day above.</div>'; return; }
    const logs = getLogs();
    const rx = getRx(ex, logs);
    if (!rx) {
      const sw = ex.startWeight, sr = ex.repMin;
      const head = ex.bw
        ? '<span class="po-accent">' + sr + '</span> reps'
        : '<span class="po-accent">' + (sw || 0) + unit() + '</span> × ' + sr + ' reps';
      const reason = ex.bw
        ? 'Aim for ' + ex.repMin + '-' + ex.repMax + ' clean reps. Once you hit ' + ex.repMax + '+, push for more.'
        : 'Hit ' + ex.repMin + '-' + ex.repMax + ' reps. Once logged, the coach will start prescribing.';
      wrap.innerHTML = '<div class="po-rx-card"><div class="po-rx-label">' + escHtml(ex.name) + ' · starting point</div><div class="po-rx-headline">' + head + '</div><span class="po-rx-tag hold">Start here</span><p class="po-rx-reason">' + reason + '</p></div>';
      return;
    }
    const head = rx.bw
      ? '<span class="po-accent">' + rx.reps + '</span> reps'
      : '<span class="po-accent">' + rx.weight + unit() + '</span> × ' + rx.reps + ' reps';
    wrap.innerHTML = '<div class="po-rx-card po-rx-' + rx.type + '"><div class="po-rx-label">' + escHtml(ex.name) + '</div><div class="po-rx-headline">' + head + '</div><span class="po-rx-tag ' + rx.type + '">' + rx.tag + '</span><p class="po-rx-reason">' + rx.reason + '</p></div>';
  }

  function renderStats() {
    const ex = getCurrentEx();
    const logs = ex ? getLogs() : [];
    if (!logs.length) {
      $('oneRm').innerHTML = '—<span class="po-unit">' + unit() + '</span>';
      $('bestSet').textContent = '—';
      $('sessionCount').textContent = '—';
      return;
    }
    if (ex.bw) {
      const br = Math.max.apply(null, logs.map(l => l.reps));
      $('oneRm').innerHTML = br + '<span class="po-unit">reps</span>';
    } else {
      const orm = Math.max.apply(null, logs.map(l => estimate1RM(l.weight, l.reps)));
      $('oneRm').innerHTML = Math.round(orm) + '<span class="po-unit">' + unit() + '</span>';
    }
    let best = logs[0];
    logs.forEach(l => {
      const cur = ex.bw ? l.reps : estimate1RM(l.weight, l.reps);
      const bestVal = ex.bw ? best.reps : estimate1RM(best.weight, best.reps);
      if (cur > bestVal) best = l;
    });
    $('bestSet').textContent = ex.bw ? (best.reps + 'r') : (best.weight + '×' + best.reps);
    $('sessionCount').textContent = logs.length;
  }

  function renderSparkline() {
    const svg = $('sparkline');
    const empty = $('sparkEmpty');
    const ex = getCurrentEx();
    const logs = ex ? getLogs().slice(-10) : [];
    if (logs.length < 2) {
      svg.style.display = 'none'; empty.style.display = 'block';
      return;
    }
    svg.style.display = 'block'; empty.style.display = 'none';
    const vals = logs.map(l => ex.bw ? l.reps : estimate1RM(l.weight, l.reps));
    const min = Math.min.apply(null, vals);
    const max = Math.max.apply(null, vals);
    const range = max - min || 1;
    const W = 300, H = 60, pad = 4;
    const pts = vals.map((v, i) => {
      const x = pad + (W - pad * 2) * (i / (vals.length - 1));
      const y = H - pad - (H - pad * 2) * ((v - min) / range);
      return [x, y];
    });
    const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const fillPath = linePath + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + H + ' L' + pts[0][0].toFixed(1) + ' ' + H + ' Z';
    svg.innerHTML = '<defs><linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,0.18)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></linearGradient></defs>'
      + '<path class="po-spark-fill" d="' + fillPath + '"/>'
      + '<path class="po-spark-line" d="' + linePath + '"/>';
  }

  function renderHistory() {
    const wrap = $('historyCard');
    const ex = getCurrentEx();
    const logs = ex ? getLogs().slice().reverse() : [];
    if (!logs.length) {
      wrap.innerHTML = '<div class="po-empty">No logs yet.</div>';
      return;
    }
    wrap.innerHTML = logs.slice(0, 12).map((l, i) => {
      const d = new Date(l.date);
      const dStr = (d.getMonth() + 1) + '/' + d.getDate();
      const setStr = ex.bw ? (l.reps + ' reps') : (l.weight + unit() + ' × ' + l.reps);
      const realIdx = logs.length - 1 - i;
      return '<div class="po-hist-row">'
        + '<div class="po-hist-date">' + dStr + '</div>'
        + '<div class="po-hist-set">' + setStr + '</div>'
        + '<button class="po-hist-del" data-idx="' + realIdx + '" aria-label="Delete">×</button>'
        + '</div>';
    }).join('');
    wrap.querySelectorAll('.po-hist-del').forEach(b => {
      b.addEventListener('click', () => {
        showConfirm('Delete this log?', () => {
          const realIdx = parseInt(b.dataset.idx, 10);
          const arr = state.logs[state.currentEx] || [];
          const origIdx = arr.length - 1 - realIdx;
          arr.splice(origIdx, 1);
          if (!arr.length) delete state.logs[state.currentEx];
          else state.logs[state.currentEx] = arr;
          saveState(); renderAll();
        }, true);
      });
    });
  }

  function todaySplit() {
    try {
      const rot = state.splitRotation;
      if (!rot || !rot.length) return { name: '—', index: 0 };
      const idx = rot.length === 7 ? todayDayOfWeek() : (() => {
        const a = new Date(state.splitAnchor.date);
        const t = new Date();
        a.setHours(0,0,0,0); t.setHours(0,0,0,0);
        const diffDays = Math.round((t - a) / 86400000);
        return ((state.splitAnchor.index + diffDays) % rot.length + rot.length) % rot.length;
      })();
      return { name: rot[idx], index: idx };
    } catch (e) {
      return { name: (state.splitRotation && state.splitRotation[0]) || '—', index: 0 };
    }
  }

  function todayDateLabel() {
    const d = new Date();
    const dows = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const mons = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return dows[d.getDay()] + ', ' + mons[d.getMonth()] + ' ' + d.getDate();
  }

  function isRestName(name) { return /^rest\b/i.test(name || ''); }
  function splitLabel(name) {
    if (!name) return '—';
    return (isRestName(name) ? 'REST DAY' : (name + ' DAY')).toUpperCase();
  }

  function renderDayPill() {
    const split = todaySplit();
    $('dayPillDate').textContent = todayDateLabel();
    const splitEl = $('dayPillSplit');
    splitEl.textContent = splitLabel(split.name);
    splitEl.classList.toggle('is-rest', isRestName(split.name));
  }

  function renderRepsRow() {
    const row = $('repsRow');
    if (!row) return;
    const ex = getCurrentEx();
    let repMin, repMax;
    if (ex) {
      repMin = Math.max(1, parseInt(ex.repMin, 10) || 1);
      repMax = Math.max(repMin, parseInt(ex.repMax, 10) || repMin);
    } else {
      repMin = 4; repMax = 12;
    }
    const upper = Math.max(repMax + 2, repMin + 5);
    const end = Math.min(upper, repMin + 15);
    const prev = parseInt(row.dataset.value, 10);
    const active = (prev >= repMin && prev <= end) ? prev : repMax;
    let html = '';
    for (let i = repMin; i <= end; i++) {
      html += '<button type="button" class="po-reps-pill' +
        (i === active ? ' active' : '') +
        '" data-v="' + i + '">' + i + '</button>';
    }
    row.innerHTML = html;
    row.dataset.value = String(active);
  }

  function renderAll() {
    renderDayPill();
    renderFilters(); renderSelect(); renderForm(); renderLastSet();
    renderRepsRow();
    renderRx(); renderStats(); renderSparkline(); renderHistory();
    renderTodaysWorkout();
    renderPastWorkouts();
    const ex = getCurrentEx();
    if (ex && !ex.bw) {
      const logs = getLogs();
      const w = logs.length ? logs[logs.length - 1].weight : (ex.startWeight || 0);
      $('weightInput').value = w;
    }
  }

  // Today's Workout + Past Workouts
  const WORKOUT_DONE_KEY = 'po_coach_workout_done';
  function loadDoneDays() {
    try { const raw = localStorage.getItem(WORKOUT_DONE_KEY); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }
  function saveDoneDays(d) {
    try { localStorage.setItem(WORKOUT_DONE_KEY, JSON.stringify(d)); } catch (e) {}
  }
  let doneDays = loadDoneDays();

  function wtDateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function logsByDay() {
    const byDay = {};
    state.exercises.forEach(ex => {
      (state.logs[ex.id] || []).forEach(l => {
        const dk = l.date.slice(0, 10);
        if (!byDay[dk]) byDay[dk] = [];
        byDay[dk].push({ ex, log: l });
      });
    });
    return byDay;
  }

  function fmtPastDate(dk) {
    const [y, m, d] = dk.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const dows = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const mons = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return dows[dt.getDay()] + ' ' + mons[dt.getMonth()] + ' ' + dt.getDate();
  }

  function summarizeDay(daySets) {
    const byEx = {};
    daySets.forEach(({ex, log}) => {
      if (!byEx[ex.id]) byEx[ex.id] = { ex, sets: [], vol: 0 };
      byEx[ex.id].sets.push(log);
      byEx[ex.id].vol += (log.weight || 0) * (log.reps || 0);
    });
    const perEx = Object.values(byEx);
    const totalSets = perEx.reduce((s, e) => s + e.sets.length, 0);
    const totalVol = perEx.reduce((s, e) => s + e.vol, 0);
    return { perEx, totalSets, totalVol };
  }

  function renderTodaysWorkout() {
    const todayKey = wtDateKey(new Date());
    const all = logsByDay();
    const todaySets = all[todayKey] || [];
    const sum = summarizeDay(todaySets);
    const u = state.units;

    const eyebrow = $('poTwDateLabel');
    const dows = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const mons = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const d = new Date();
    eyebrow.textContent = 'TODAY · ' + dows[d.getDay()] + ', ' + mons[d.getMonth()] + ' ' + d.getDate();

    $('poTwSetCount').textContent = sum.totalSets;
    $('poTwTotalVol').textContent = Math.round(sum.totalVol).toLocaleString() + ' ' + u + ' lifted';

    const list = $('poTwList');
    const empty = $('poTwEmpty');
    if (sum.totalSets === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      list.innerHTML = sum.perEx.map(e => {
        const top = e.ex.bw
          ? 'top ' + Math.max.apply(null, e.sets.map(s => s.reps)) + ' reps'
          : 'top ' + Math.max.apply(null, e.sets.map(s => s.weight)) + u;
        const meta = e.ex.bw
          ? (e.sets.length + ' set' + (e.sets.length === 1 ? '' : 's') + ' · ' + top)
          : (e.sets.length + ' set' + (e.sets.length === 1 ? '' : 's') + ' · ' + top + ' · ' + Math.round(e.vol) + u + ' total');
        return '<li class="po-tw-row">'
          + '<span class="po-tw-row-name">' + escHtml(e.ex.name) + '</span>'
          + '<span class="po-tw-row-meta">' + meta + '</span>'
          + '</li>';
      }).join('');
    }

    const btn = $('poTwDoneBtn');
    const isDone = !!doneDays[todayKey];
    btn.textContent = isDone ? '✓ Done' : 'Mark workout done';
    btn.classList.toggle('is-done', isDone);
    btn.disabled = sum.totalSets === 0 && !isDone;
    btn.style.opacity = btn.disabled ? '0.4' : '';
  }

  function renderPastWorkouts() {
    const todayKey = wtDateKey(new Date());
    const all = logsByDay();
    const past = Object.entries(all)
      .filter(([dk]) => dk !== todayKey)
      .sort((a, b) => b[0].localeCompare(a[0]));
    $('poTwPastCount').textContent = past.length;
    const body = $('poTwPastBody');
    if (!past.length) {
      body.innerHTML = '<div class="po-tw-past-empty">No past workouts yet.</div>';
      return;
    }
    const u = state.units;
    body.innerHTML = past.slice(0, 30).map(([dk, sets]) => {
      const sum = summarizeDay(sets);
      const isDone = !!doneDays[dk];
      const exNames = sum.perEx.map(e => e.ex.name).slice(0, 3).join(', ')
        + (sum.perEx.length > 3 ? '…' : '');
      return '<div class="po-tw-past-day">'
        + '<div class="po-tw-past-day-h">'
        +   '<span class="po-tw-past-day-date">' + fmtPastDate(dk) + '</span>'
        +   '<span class="po-tw-past-day-summary">'
        +     sum.totalSets + ' sets · ' + Math.round(sum.totalVol).toLocaleString() + ' ' + u
        +     (isDone ? ' <span class="po-tw-past-day-done">DONE</span>' : '')
        +   '</span>'
        + '</div>'
        + '<div class="po-tw-past-day-summary" style="margin-top:6px; font-size:11px; color:var(--text-tertiary);">'
        +   escHtml(exNames)
        + '</div>'
        + '</div>';
    }).join('');
  }

  // Exercise Modal
  let editingExId = null;
  let modalGym = null, modalDay = null;
  let lastFocus = null;

  function renderModalSegs() {
    $('exGymSeg').innerHTML = state.gyms.map(g =>
      '<button data-gym="' + g.id + '" class="' + (modalGym === g.id ? 'active' : '') + '">' + escHtml(g.name) + '</button>'
    ).join('') + '<button data-gym="both" class="' + (modalGym === 'both' ? 'active' : '') + '">Both</button>';
    $('exDaySeg').innerHTML = state.days.map(d =>
      '<button data-day="' + d.id + '" class="' + (modalDay === d.id ? 'active' : '') + '">' + escHtml(d.name) + '</button>'
    ).join('');
    $('exGymSeg').querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        modalGym = b.dataset.gym;
        $('exGymSeg').querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });
    $('exDaySeg').querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        modalDay = b.dataset.day;
        $('exDaySeg').querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });
  }

  function openExModal(mode, ex) {
    lastFocus = document.activeElement;
    editingExId = mode === 'edit' ? ex.id : null;
    $('exModalTitle').textContent = mode === 'edit' ? 'Edit exercise' : 'Add exercise';
    $('exDelete').style.display = mode === 'edit' ? 'block' : 'none';
    if (mode === 'edit') {
      $('exName').value = ex.name;
      modalGym = ex.gym;
      modalDay = ex.day;
      $('exBw').checked = !!ex.bw;
      $('exStartWeight').value = ex.startWeight || 0;
      $('exRepMin').value = ex.repMin;
      $('exRepMax').value = ex.repMax;
      $('exStep').value = ex.step;
    } else {
      $('exName').value = '';
      modalGym = state.filterGym;
      modalDay = state.filterDay;
      $('exBw').checked = false;
      $('exStartWeight').value = 20;
      $('exRepMin').value = 6;
      $('exRepMax').value = 8;
      $('exStep').value = 2.5;
    }
    renderModalSegs();
    toggleBwFields();
    $('exModalBg').classList.add('show');
    setTimeout(() => $('exName').focus(), 60);
  }

  function toggleBwFields() {
    const isBw = $('exBw').checked;
    $('exStartWeightField').style.display = isBw ? 'none' : '';
    $('exStepField').style.display = isBw ? 'none' : '';
  }

  // Rotation editor
  const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let rotDraft = null;
  let rotDraftTodayIdx = 0;

  function todayDayOfWeek() {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }

  function openRotationModal() {
    lastFocus = document.activeElement;
    rotDraft = (state.splitRotation || []).slice();
    if (!rotDraft.length) rotDraft = ['Push', 'Pull', 'Legs', 'Rest', 'Upper', 'Lower', 'Rest'];
    rotDraftTodayIdx = todayDayOfWeek();
    renderRotDaySeg();
    renderRotList();
    $('rotModalBg').classList.add('show');
    setTimeout(() => { const f = $('rotModalBg').querySelector('button, input'); if (f) f.focus(); }, 60);
  }

  function renderRotDaySeg() {
    const seg = $('rotDaySeg');
    seg.innerHTML = DAY_ABBR.map((abbr, i) =>
      '<button class="' + (i === rotDraftTodayIdx ? 'active' : '') + '" data-d="' + i + '">' + abbr + '</button>'
    ).join('');
    seg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        rotDraftTodayIdx = parseInt(btn.dataset.d, 10);
        renderRotDaySeg();
        renderRotList();
      });
    });
  }

  function renderRotList() {
    const list = $('rotList');
    list.innerHTML = rotDraft.map((name, i) => {
      const isToday = (i === rotDraftTodayIdx);
      return '<div class="rot-row ' + (isToday ? 'is-today' : '') + '" data-i="' + i + '">'
        + '<input type="text" value="' + escHtml(name) + '" placeholder="e.g. Arms" maxlength="30">'
        + (isToday
            ? '<span class="rot-today-tag">TODAY</span>'
            : '<button type="button" class="rot-today-btn" data-action="today">' + DAY_ABBR[i] + '</button>')
        + '<button type="button" class="rot-mini" data-action="up"   aria-label="Move up">↑</button>'
        + '<button type="button" class="rot-mini" data-action="down" aria-label="Move down">↓</button>'
        + '</div>';
    }).join('');
    list.querySelectorAll('.rot-row').forEach(row => {
      const i = parseInt(row.dataset.i, 10);
      row.querySelector('input').addEventListener('input', e => { rotDraft[i] = e.target.value; });
      const upBtn = row.querySelector('[data-action="up"]');
      const dnBtn = row.querySelector('[data-action="down"]');
      const todayBtn = row.querySelector('[data-action="today"]');
      if (upBtn) upBtn.addEventListener('click', () => {
        if (i === 0) return;
        [rotDraft[i-1], rotDraft[i]] = [rotDraft[i], rotDraft[i-1]];
        if (rotDraftTodayIdx === i)   rotDraftTodayIdx = i - 1;
        else if (rotDraftTodayIdx === i - 1) rotDraftTodayIdx = i;
        renderRotList();
      });
      if (dnBtn) dnBtn.addEventListener('click', () => {
        if (i >= rotDraft.length - 1) return;
        [rotDraft[i+1], rotDraft[i]] = [rotDraft[i], rotDraft[i+1]];
        if (rotDraftTodayIdx === i)   rotDraftTodayIdx = i + 1;
        else if (rotDraftTodayIdx === i + 1) rotDraftTodayIdx = i;
        renderRotList();
      });
      if (todayBtn) todayBtn.addEventListener('click', () => {
        rotDraftTodayIdx = i;
        renderRotDaySeg();
        renderRotList();
      });
    });
  }

  // Settings modal
  function renderSettings() {
    $('setUnitsSeg').querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.u === state.units);
    });
    $('setGyms').innerHTML = state.gyms.map((g, i) =>
      '<div class="po-set-row" data-i="' + i + '">'
      + '<input type="text" value="' + escHtml(g.name) + '" data-field="name" placeholder="Gym name">'
      + '<button class="po-mini-btn" data-action="del" aria-label="Delete">×</button>'
      + '</div>'
    ).join('');
    $('setDays').innerHTML = state.days.map((d, i) =>
      '<div class="po-set-row" data-i="' + i + '">'
      + '<input type="text" value="' + escHtml(d.name) + '" data-field="name" placeholder="Day name">'
      + '<button class="po-mini-btn" data-action="del" aria-label="Delete">×</button>'
      + '</div>'
    ).join('');
    $('setGyms').querySelectorAll('.po-set-row').forEach(row => {
      const i = parseInt(row.dataset.i, 10);
      row.querySelector('input').addEventListener('input', e => {
        state.gyms[i].name = e.target.value;
        saveState();
      });
      row.querySelector('[data-action="del"]').addEventListener('click', () => {
        if (state.gyms.length <= 1) { showAlert('You need at least one gym.'); return; }
        showConfirm('Remove "' + state.gyms[i].name + '"?', () => {
          state.gyms.splice(i, 1);
          if (!state.gyms.find(g => g.id === state.filterGym)) state.filterGym = state.gyms[0].id;
          saveState(); renderSettings(); renderAll();
        }, true);
      });
    });
    $('setDays').querySelectorAll('.po-set-row').forEach(row => {
      const i = parseInt(row.dataset.i, 10);
      row.querySelector('input').addEventListener('input', e => {
        state.days[i].name = e.target.value;
        saveState();
      });
      row.querySelector('[data-action="del"]').addEventListener('click', () => {
        if (state.days.length <= 1) { showAlert('You need at least one day.'); return; }
        showConfirm('Remove "' + state.days[i].name + '"?', () => {
          state.days.splice(i, 1);
          if (!state.days.find(d => d.id === state.filterDay)) state.filterDay = state.days[0].id;
          saveState(); renderSettings(); renderAll();
        }, true);
      });
    });
  }

  // Auto-select today's split on first load
  (function autoSelectTodaySplit() {
    const s = todaySplit();
    if (!s.name || isRestName(s.name) || state._userPickedDay) return;
    const match = state.days.find(d => d.name.toLowerCase() === s.name.toLowerCase());
    if (match) state.filterDay = match.id;
  })();

  // Event wiring
  $('dayPill').addEventListener('click', () => openRotationModal());

  $('exSelect').addEventListener('change', e => {
    state.currentEx = e.target.value; saveState(); renderAll();
  });
  $('weightDownBtn').addEventListener('click', () => {
    const ex = getCurrentEx(); if (!ex || ex.bw) return;
    const w = parseFloat($('weightInput').value) || 0;
    $('weightInput').value = Math.max(0, w - (ex.step || 2.5));
  });
  $('weightUpBtn').addEventListener('click', () => {
    const ex = getCurrentEx(); if (!ex || ex.bw) return;
    const w = parseFloat($('weightInput').value) || 0;
    $('weightInput').value = w + (ex.step || 2.5);
  });
  $('repsRow').addEventListener('click', (e) => {
    const p = e.target.closest('.po-reps-pill');
    if (!p) return;
    $('repsRow').querySelectorAll('.po-reps-pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    $('repsRow').dataset.value = p.dataset.v;
  });
  $('logBtn').addEventListener('click', () => {
    const ex = getCurrentEx();
    if (!ex) return;
    const reps = parseInt($('repsRow').dataset.value, 10) || 0;
    if (reps <= 0) { showAlert('Pick a rep count.'); return; }
    const w = ex.bw ? 0 : (parseFloat($('weightInput').value) || 0);
    if (!ex.bw && w <= 0) { showAlert('Enter a weight.'); return; }
    const arr = state.logs[ex.id] || [];
    arr.push({ weight: w, reps: reps, date: new Date().toISOString() });
    state.logs[ex.id] = arr;
    saveState(); renderAll();
    if (typeof wtRender === 'function') wtRender();
    const btn = $('logBtn');
    btn.style.transition = 'transform 0.15s';
    btn.style.transform = 'scale(0.96)';
    setTimeout(() => { btn.style.transform = ''; }, 160);
  });

  $('exBw').addEventListener('change', toggleBwFields);
  $('addExBtn').addEventListener('click', () => openExModal('add'));
  $('editExBtn').addEventListener('click', () => {
    const ex = getCurrentEx();
    if (ex) openExModal('edit', ex);
  });
  function closeExModal() {
    $('exModalBg').classList.remove('show');
    if (lastFocus) { lastFocus.focus(); lastFocus = null; }
  }
  function closeRotModal() {
    $('rotModalBg').classList.remove('show');
    rotDraft = null;
    if (lastFocus) { lastFocus.focus(); lastFocus = null; }
  }
  function closeSetModal() {
    $('setModalBg').classList.remove('show');
    renderAll();
    if (lastFocus) { lastFocus.focus(); lastFocus = null; }
  }

  $('exModalCancel').addEventListener('click', closeExModal);
  $('exModalBg').addEventListener('click', (e) => {
    if (e.target === $('exModalBg')) closeExModal();
  });
  $('exModalSave').addEventListener('click', () => {
    const name = $('exName').value.trim();
    if (!name) { showAlert('Name is required.'); return; }
    if (!modalGym) { showAlert('Pick a gym.'); return; }
    if (!modalDay) { showAlert('Pick a day.'); return; }
    const isBw = $('exBw').checked;
    const repMin = parseInt($('exRepMin').value, 10) || 6;
    const repMax = parseInt($('exRepMax').value, 10) || 8;
    const data = {
      name, gym: modalGym, day: modalDay,
      bw: isBw,
      startWeight: isBw ? 0 : (parseFloat($('exStartWeight').value) || 0),
      repMin, repMax,
      step: isBw ? 1 : (parseFloat($('exStep').value) || 2.5)
    };
    if (editingExId) {
      const ex = state.exercises.find(e => e.id === editingExId);
      if (ex) Object.assign(ex, data);
    } else {
      const ex = Object.assign({ id: uid() }, data);
      state.exercises.push(ex);
      state.currentEx = ex.id;
      state.filterGym = (modalGym === 'both') ? state.filterGym : modalGym;
      state.filterDay = modalDay;
    }
    saveState();
    closeExModal();
    renderAll();
  });
  $('exDelete').addEventListener('click', () => {
    if (!editingExId) return;
    showConfirm('Delete this exercise and all its logs?', () => {
      state.exercises = state.exercises.filter(e => e.id !== editingExId);
      delete state.logs[editingExId];
      if (state.currentEx === editingExId) state.currentEx = null;
      editingExId = null;
      saveState();
      closeExModal();
      renderAll();
    }, true);
  });

  $('rotCancel').addEventListener('click', closeRotModal);
  $('rotModalBg').addEventListener('click', (e) => {
    if (e.target === $('rotModalBg')) closeRotModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('exModalBg').classList.contains('show')) { closeExModal(); return; }
    if ($('rotModalBg').classList.contains('show')) { closeRotModal(); return; }
    if ($('setModalBg').classList.contains('show')) { closeSetModal(); return; }
  });
  $('rotSave').addEventListener('click', () => {
    const cleaned = rotDraft.map(s => (s || '').trim());
    while (cleaned.length < 7) cleaned.push('Rest');
    state.splitRotation = cleaned.slice(0, 7);
    state.splitAnchor = {
      date: new Date().toISOString().slice(0, 10),
      index: rotDraftTodayIdx
    };
    saveState();
    closeRotModal();
    renderAll();
  });

  $('settingsBtn').addEventListener('click', () => {
    lastFocus = document.activeElement;
    renderSettings();
    $('setModalBg').classList.add('show');
    setTimeout(() => { const f = $('setModalBg').querySelector('button, input'); if (f) f.focus(); }, 60);
  });
  $('setModalClose').addEventListener('click', closeSetModal);
  $('setModalBg').addEventListener('click', (e) => {
    if (e.target === $('setModalBg')) closeSetModal();
  });
  $('setUnitsSeg').querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      state.units = b.dataset.u; saveState();
      $('setUnitsSeg').querySelectorAll('button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      if (typeof wtRender === 'function') wtRender();
    });
  });
  $('setAddGym').addEventListener('click', () => {
    state.gyms.push({ id: 'g_' + Date.now(), name: '' });
    saveState(); renderSettings();
    const rows = $('setGyms').querySelectorAll('.po-set-row');
    rows[rows.length - 1].querySelector('input').focus();
  });
  $('setAddDay').addEventListener('click', () => {
    state.days.push({ id: 'd_' + Date.now(), name: '' });
    saveState(); renderSettings();
    const rows = $('setDays').querySelectorAll('.po-set-row');
    rows[rows.length - 1].querySelector('input').focus();
  });

  $('setExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'po-coach-data-' + new Date().toISOString().slice(0,10) + '.json';
    a.click(); URL.revokeObjectURL(url);
  });
  $('setImport').addEventListener('click', () => $('setImportFile').click());
  $('setImportFile').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        showConfirm('Replace ALL current data with the imported file? This cannot be undone.', () => {
          state = normalize(parsed);
          saveState(); renderSettings(); renderAll();
        }, true);
      } catch (err) { showAlert('Import failed: ' + err.message); }
    };
    reader.readAsText(file);
  });
  $('setReset').addEventListener('click', () => {
    showConfirm('Delete EVERYTHING (logs, edits, gyms, days)? This cannot be undone.', () => {
      localStorage.removeItem(LS_KEY);
      state = loadState();
      closeSetModal();
    }, true);
  });

  $('poTwDoneBtn').addEventListener('click', () => {
    const todayKey = wtDateKey(new Date());
    if (doneDays[todayKey]) {
      delete doneDays[todayKey];
    } else {
      doneDays[todayKey] = new Date().toISOString();
    }
    saveDoneDays(doneDays);
    renderTodaysWorkout();
    renderPastWorkouts();
  });
  $('poTwPastToggle').addEventListener('click', () => {
    const body = $('poTwPastBody');
    const toggle = $('poTwPastToggle');
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'flex';
    body.style.flexDirection = 'column';
    toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
  });

  // Weight Tracker
  const WT_KEY = 'po_coach_weights';
  const PHOTO_KEY = 'po_coach_photos';

  function wtLoad() {
    try {
      const raw = localStorage.getItem(WT_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.sort((a,b) => a.dateKey.localeCompare(b.dateKey)) : [];
    } catch (e) { return []; }
  }
  function wtSave(arr) {
    try { localStorage.setItem(WT_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function wtParseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function wtSmoothPath(points) {
    if (!points.length) return '';
    if (points.length === 1) return 'M ' + points[0].x + ' ' + points[0].y;
    let d = 'M ' + points[0].x.toFixed(2) + ' ' + points[0].y.toFixed(2);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i-1], curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      d += ' Q ' + cx.toFixed(2) + ' ' + prev.y.toFixed(2) + ', ' + cx.toFixed(2) + ' ' + ((prev.y + curr.y)/2).toFixed(2);
      d += ' T ' + curr.x.toFixed(2) + ' ' + curr.y.toFixed(2);
    }
    return d;
  }

  let wtEntries = wtLoad();

  function wtSaveEntry(weight) {
    const key = wtDateKey(new Date());
    const existing = wtEntries.find(e => e.dateKey === key);
    if (existing) existing.weight = weight;
    else { wtEntries.push({ dateKey: key, weight }); wtEntries.sort((a,b) => a.dateKey.localeCompare(b.dateKey)); }
    wtSave(wtEntries);
    wtRender();
  }

  function wtRender() {
    const last = wtEntries[wtEntries.length - 1] || null;
    const todayKey = wtDateKey(new Date());
    const todayEntry = wtEntries.find(e => e.dateKey === todayKey);
    const u = state.units;

    $('wtUnit').textContent = u;
    $('wtUnitStatic').textContent = u;
    $('wtNum').textContent = last ? last.weight.toFixed(1) : '—';

    if (todayEntry) {
      $('wtEmpty').classList.add('hidden');
      $('wtLockedValue').textContent = todayEntry.weight.toFixed(1) + ' ' + u;
      $('wtLocked').classList.remove('hidden');
      $('wtInputRow').classList.add('hidden');
    } else {
      if (wtEntries.length === 0) $('wtEmpty').classList.remove('hidden');
      else $('wtEmpty').classList.add('hidden');
      $('wtLocked').classList.add('hidden');
      $('wtInputRow').classList.remove('hidden');
      if (last && !$('wtInput').value) $('wtInput').value = last.weight.toFixed(1);
    }

    if (wtEntries.length >= 2) {
      $('wtChartWrap').classList.remove('hidden');
      $('wtLegend').classList.remove('hidden');
      wtRenderChart();
      wtRenderDelta();
      wtRenderComposition();
    } else {
      $('wtChartWrap').classList.add('hidden');
      $('wtLegend').classList.add('hidden');
      $('wtDelta').classList.add('hidden');
      $('wtComp').classList.add('hidden');
    }
    wtRenderStreak();
  }

  function wtRenderStreak() {
    const el = $('wtStreak');
    let streak = 0;
    let cursor = new Date(new Date());
    if (!wtEntries.find(e => e.dateKey === wtDateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (wtEntries.find(e => e.dateKey === wtDateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    if (streak >= 2) {
      $('wtStreakNum').textContent = streak + ' day streak';
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  function wtRenderChart() {
    const recent = wtEntries.slice(-30);
    const weights = recent.map(e => e.weight);
    const min = Math.min.apply(null, weights);
    const max = Math.max.apply(null, weights);
    const pad = Math.max((max - min) * 0.15, 0.5);
    const yMin = min - pad, yMax = max + pad;
    const xLeft = 8, xRight = 312, yTop = 20, yBot = 110;
    const xRange = xRight - xLeft, yRange = yBot - yTop;
    const xFor = (i) => recent.length === 1 ? xRight : xLeft + (i / (recent.length - 1)) * xRange;
    const yFor = (w) => yBot - ((w - yMin) / (yMax - yMin)) * yRange;
    const points = recent.map((e, i) => ({ x: xFor(i), y: yFor(e.weight) }));
    const linePath = wtSmoothPath(points);
    const areaPath = linePath + ' L ' + points[points.length - 1].x.toFixed(2) + ' ' + yBot + ' L ' + points[0].x.toFixed(2) + ' ' + yBot + ' Z';
    const avgPoints = recent.map((_, i) => {
      const start = Math.max(0, i - 6);
      const win = recent.slice(start, i + 1);
      const avg = win.reduce((s, p) => s + p.weight, 0) / win.length;
      return { x: xFor(i), y: yFor(avg) };
    });
    const avgPath = wtSmoothPath(avgPoints);
    let html = '<path class="wt-avg-line" d="' + avgPath + '"></path>'
             + '<path class="wt-area" d="' + areaPath + '"></path>'
             + '<path class="wt-line" filter="url(#wtGlow)" d="' + linePath + '"></path>';
    points.forEach((p, i) => {
      const cls = (i === points.length - 1) ? 'wt-dot-today' : 'wt-dot';
      const r = (i === points.length - 1) ? 5 : 3;
      html += '<circle class="' + cls + '" cx="' + p.x.toFixed(2) + '" cy="' + p.y.toFixed(2) + '" r="' + r + '"/>';
    });
    $('wtChartContent').innerHTML = html;
    $('wtYAxisMax').textContent = yMax.toFixed(1);
    $('wtYAxisMin').textContent = yMin.toFixed(1);
    $('wtMeta').textContent = wtEntries.length + ' ' + (wtEntries.length === 1 ? 'entry' : 'entries') + ' · last ' + recent.length + ' days';
  }

  function wtRenderDelta() {
    const last = wtEntries[wtEntries.length - 1];
    const lastDate = wtParseKey(last.dateKey);
    const cutoff = new Date(lastDate); cutoff.setDate(cutoff.getDate() - 7);
    const baseline = wtEntries.find(e => wtParseKey(e.dateKey) >= cutoff) || wtEntries[0];
    const diff = last.weight - baseline.weight;
    const el = $('wtDelta');
    if (Math.abs(diff) < 0.05) { el.classList.add('hidden'); return; }
    const arrow = diff > 0 ? '↑' : '↓';
    const sign = diff > 0 ? '+' : '−';
    el.textContent = arrow + ' ' + sign + Math.abs(diff).toFixed(1) + ' ' + state.units + ' · last 7d';
    el.classList.toggle('up',   diff > 0);
    el.classList.toggle('down', diff < 0);
    el.classList.remove('hidden');
  }

  function wtRenderComposition() {
    const compEl = $('wtComp');
    if (!CONFIG.composition || !CONFIG.composition.enabled) {
      compEl.classList.add('hidden'); return;
    }
    const window = CONFIG.composition.windowDays || 30;
    if (wtEntries.length < 2) { compEl.classList.add('hidden'); return; }

    const now = wtParseKey(wtEntries[wtEntries.length - 1].dateKey);
    const start = new Date(now); start.setDate(start.getDate() - window);

    const startEntry = wtEntries.find(e => wtParseKey(e.dateKey) >= start);
    const endEntry = wtEntries[wtEntries.length - 1];
    if (!startEntry || startEntry === endEntry) { compEl.classList.add('hidden'); return; }
    const weightDelta = endEntry.weight - startEntry.weight;
    const actualDays = Math.max(1, Math.round((wtParseKey(endEntry.dateKey) - wtParseKey(startEntry.dateKey)) / 86400000));
    const weeks = actualDays / 7;

    let strengthRatios = [];
    let workoutDays = new Set();
    let totalVolumeInWindow = 0;
    state.exercises.forEach(ex => {
      const logs = (state.logs[ex.id] || []).slice();
      if (logs.length < 2 || ex.bw) {
        logs.forEach(l => {
          if (new Date(l.date) >= start) {
            workoutDays.add(l.date.slice(0, 10));
            totalVolumeInWindow += (l.weight || 0) * (l.reps || 0);
          }
        });
        return;
      }
      const inWin  = logs.filter(l => new Date(l.date) >= start);
      const before = logs.filter(l => new Date(l.date) < start);
      inWin.forEach(l => {
        workoutDays.add(l.date.slice(0, 10));
        totalVolumeInWindow += (l.weight || 0) * (l.reps || 0);
      });
      if (!inWin.length || !before.length) return;
      const avg = arr => arr.reduce((s, l) => s + estimate1RM(l.weight, l.reps), 0) / arr.length;
      const a = avg(before), b = avg(inWin);
      if (a <= 0) return;
      strengthRatios.push(b / a);
    });
    const strengthDelta = strengthRatios.length
      ? (strengthRatios.reduce((s, r) => s + r, 0) / strengthRatios.length) - 1
      : 0;
    const sessionsPerWeek = (workoutDays.size / actualDays) * 7;
    const frequencyFactor = Math.max(0.4, Math.min(1.2, sessionsPerWeek / 4));

    const yt = CONFIG.composition.yearsTraining || 1;
    let maxMuscleKgPerWeek;
    if (yt <= 1) maxMuscleKgPerWeek = 0.45;
    else if (yt === 2) maxMuscleKgPerWeek = 0.23;
    else maxMuscleKgPerWeek = 0.11;
    const unitConv = (state.units === 'lb') ? 2.20462 : 1;
    const maxMusclePerWeek = maxMuscleKgPerWeek * unitConv;

    const strengthBoost = Math.max(0.5, Math.min(1.5, 1 + strengthDelta * 4));
    let estMuscle = maxMusclePerWeek * weeks * strengthBoost * frequencyFactor;

    let estFat;
    let headlineCls = '';
    let headline = '';
    if (weightDelta > 0) {
      estMuscle = Math.min(estMuscle, weightDelta);
      estFat = Math.max(0, weightDelta - estMuscle);
      const musclePct = estMuscle / weightDelta;
      if (musclePct >= 0.6 && strengthDelta > 0) {
        headlineCls = 'good';
        headline = '+' + weightDelta.toFixed(1) + ' ' + state.units + ' — mostly muscle, strength up.';
      } else if (musclePct >= 0.35) {
        headlineCls = 'warn';
        headline = '+' + weightDelta.toFixed(1) + ' ' + state.units + ' — mixed. Tighten kcal or push lifts harder.';
      } else {
        headlineCls = 'bad';
        headline = '+' + weightDelta.toFixed(1) + ' ' + state.units + ' — mostly fat. Strength flat. Cut kcal.';
      }
    } else {
      const wDown = Math.abs(weightDelta);
      if (strengthDelta >= 0) {
        estMuscle = Math.min(maxMusclePerWeek * weeks * 0.3, 0.5);
        estFat = wDown + estMuscle;
        headlineCls = 'good';
        headline = '−' + wDown.toFixed(1) + ' ' + state.units + ' — strength holding, fat dropping.';
      } else {
        const lossPct = Math.min(0.4, Math.abs(strengthDelta) * 2);
        estMuscle = -wDown * lossPct;
        estFat = -(wDown + estMuscle);
        headlineCls = 'warn';
        headline = '−' + wDown.toFixed(1) + ' ' + state.units + ' — strength slipping. You may be losing muscle.';
      }
    }

    compEl.classList.remove('hidden');
    $('wtCompWindow').textContent = 'last ' + actualDays + 'd';
    const headlineEl = $('wtCompHeadline');
    headlineEl.textContent = headline;
    headlineEl.className = 'wt-comp-headline ' + headlineCls;

    const totalAbs = Math.abs(estMuscle) + Math.abs(estFat) || 1;
    const musclePct = (Math.abs(estMuscle) / totalAbs) * 100;
    const fatPct = (Math.abs(estFat) / totalAbs) * 100;
    $('wtCompBars').innerHTML =
      '<div class="wt-comp-bar muscle" style="width:' + musclePct.toFixed(1) + '%"></div>' +
      '<div class="wt-comp-bar fat" style="width:' + fatPct.toFixed(1) + '%"></div>';

    const sd = strengthDelta * 100;
    const sdStr = (sd >= 0 ? '+' : '') + sd.toFixed(1) + '%';
    const muscleSign = estMuscle >= 0 ? '+' : '';
    const fatSign = estFat >= 0 ? '+' : '';
    const freqStr = sessionsPerWeek.toFixed(1) + ' sessions/wk';
    $('wtCompFoot').textContent =
      '~' + muscleSign + estMuscle.toFixed(1) + ' ' + state.units + ' muscle · '
      + '~' + fatSign + estFat.toFixed(1) + ' ' + state.units + ' fat · '
      + 'strength ' + sdStr
      + ' · ' + freqStr
      + (strengthRatios.length ? '' : ' (no lift data)');
  }

  $('wtSaveBtn').addEventListener('click', () => {
    const v = parseFloat($('wtInput').value);
    if (isNaN(v) || v <= 0) return;
    wtSaveEntry(v);
  });
  $('wtInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('wtSaveBtn').click();
  });
  $('wtEditBtn').addEventListener('click', () => {
    $('wtLocked').classList.add('hidden');
    $('wtInputRow').classList.remove('hidden');
    const todayEntry = wtEntries.find(e => e.dateKey === wtDateKey(new Date()));
    if (todayEntry) $('wtInput').value = todayEntry.weight.toFixed(1);
    $('wtInput').focus(); $('wtInput').select();
  });

  // Progress Photos
  let photos = [];
  try {
    const raw = localStorage.getItem(PHOTO_KEY);
    if (raw) photos = JSON.parse(raw);
  } catch (e) { photos = []; }

  function photosSave() {
    try {
      localStorage.setItem(PHOTO_KEY, JSON.stringify(photos));
      return true;
    } catch (e) {
      return false;
    }
  }

  function compressPhotoDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 1080;
    quality = quality == null ? 0.75 : quality;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
          else { w = Math.round(w * (maxDim / h)); h = maxDim; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try { resolve(c.toDataURL('image/jpeg', quality)); }
        catch { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function photoFmtDate(key) {
    const d = wtParseKey(key);
    const mons = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return mons[d.getMonth()] + ' ' + d.getDate();
  }

  function photoCurrentWeight() {
    const last = wtEntries[wtEntries.length - 1];
    return last ? (last.weight.toFixed(1) + ' ' + state.units) : '—';
  }

  function photosRender() {
    const grid = $('wtPhotoGrid');
    if (!photos.length) {
      grid.innerHTML = '<div class="wt-photo-empty">No photos yet · tap Take Photo to start</div>';
    } else {
      grid.innerHTML = photos.map(p =>
        '<button class="wt-photo-card" data-id="' + p.id + '" type="button">' +
          '<img src="' + p.dataUrl + '" alt="">' +
          '<div class="wt-photo-overlay"></div>' +
          '<div class="wt-photo-meta">' +
            '<span class="wt-photo-date">' + photoFmtDate(p.dateKey) + '</span>' +
            '<span class="wt-photo-weight">' + (p.weight || '—') + '</span>' +
          '</div>' +
        '</button>'
      ).join('');
      grid.querySelectorAll('.wt-photo-card').forEach(card => {
        card.addEventListener('click', () => openPhoto(card.dataset.id));
      });
    }
    if (!photos.length) $('wtProgressCount').textContent = '0 photos';
    else if (photos.length === 1) $('wtProgressCount').textContent = '1 photo · latest ' + photoFmtDate(photos[0].dateKey);
    else $('wtProgressCount').textContent = photos.length + ' photos · latest ' + photoFmtDate(photos[0].dateKey);
  }

  async function photosAdd(dataUrl) {
    let compressed = dataUrl;
    try { compressed = await compressPhotoDataUrl(dataUrl); } catch {}
    const id = 'p' + Date.now() + '_' + Math.floor(Math.random() * 999);
    const entry = {
      id,
      dataUrl: compressed,
      dateKey: wtDateKey(new Date()),
      weight: photoCurrentWeight()
    };
    photos.unshift(entry);
    if (!photosSave()) {
      try {
        entry.dataUrl = await compressPhotoDataUrl(dataUrl, 800, 0.6);
      } catch {}
      if (!photosSave()) {
        photos.shift();
        showAlert('Phone storage is full — delete some older progress photos before adding a new one.');
        return;
      }
    }
    photosRender();
  }

  function fileToPhoto(file) {
    const r = new FileReader();
    r.onload = (e) => photosAdd(e.target.result);
    r.readAsDataURL(file);
  }

  $('wtProgressLink').addEventListener('click', () => {
    photosRender();
    $('wtOverlay').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  });
  $('wtBack').addEventListener('click', () => {
    $('wtOverlay').classList.remove('is-open');
    document.body.style.overflow = '';
  });

  let camStream = null;
  let camFacing = 'environment';
  async function openCam() {
    $('wtCam').classList.add('is-open');
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: camFacing } }, audio: false
      });
      $('wtCamVideo').srcObject = camStream;
    } catch (e) {
      try {
        camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        $('wtCamVideo').srcObject = camStream;
      } catch (e2) {
        closeCam();
        showAlert('Camera unavailable. Use "From Library" instead.');
        throw e2;
      }
    }
  }
  function closeCam() {
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
    $('wtCamVideo').srcObject = null;
    $('wtCam').classList.remove('is-open');
  }

  $('wtTakePhotoBtn').addEventListener('click', async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try { await openCam(); return; } catch (e) {}
    }
    $('wtFileCamera').click();
  });
  $('wtFileCamera').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) fileToPhoto(f);
    e.target.value = '';
  });
  $('wtFromLibraryBtn').addEventListener('click', () => $('wtFileLibrary').click());
  $('wtFileLibrary').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) fileToPhoto(f);
    e.target.value = '';
  });
  $('wtCamCancel').addEventListener('click', closeCam);
  $('wtCamFlip').addEventListener('click', async () => {
    camFacing = camFacing === 'environment' ? 'user' : 'environment';
    if (camStream) camStream.getTracks().forEach(t => t.stop());
    try { await openCam(); } catch (e) {}
  });
  $('wtCamShutter').addEventListener('click', () => {
    const video = $('wtCamVideo'), canvas = $('wtCamCanvas');
    if (!video.videoWidth) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    closeCam();
    photosAdd(dataUrl);
  });

  // Photo viewer
  let activePhotoId = null;
  let comparePhotoId = null;
  let pvDeleteConfirm = false;

  function openPhoto(id) {
    const p = photos.find(x => x.id === id);
    if (!p) return;
    activePhotoId = id;
    $('wtViewerImg').src = p.dataUrl;
    $('wtViewerDate').textContent = photoFmtDate(p.dateKey).toUpperCase();
    $('wtViewerWeight').textContent = p.weight || '—';
    $('wtViewer').dataset.mode = 'single';
    $('wtViewer').classList.add('is-open');
    pvDeleteConfirm = false;
    $('wtViewerDelete').textContent = 'Delete';
    $('wtViewerDelete').classList.remove('is-confirm');
    $('wtViewerCompare').disabled = photos.length < 2;
    $('wtViewerCompare').style.opacity = photos.length < 2 ? '0.4' : '';
  }

  function closePhoto() {
    $('wtViewer').classList.remove('is-open');
    $('wtViewer').dataset.mode = 'single';
    activePhotoId = null;
    comparePhotoId = null;
  }

  function parseWeightStr(w) {
    if (!w) return null;
    const m = String(w).match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }

  function fmtDelta(diff, units) {
    if (diff == null) return '';
    if (Math.abs(diff) < 0.05) return '· no change';
    const sign = diff > 0 ? '+' : '−';
    return '· ' + sign + Math.abs(diff).toFixed(1) + ' ' + units;
  }

  function defaultCompareFor(activeId) {
    const idx = photos.findIndex(p => p.id === activeId);
    if (idx === -1) return null;
    if (photos[idx + 1]) return photos[idx + 1].id;
    if (photos[idx - 1]) return photos[idx - 1].id;
    return null;
  }

  function openCompare(activeId, otherId) {
    const A = photos.find(p => p.id === activeId);
    const B = photos.find(p => p.id === otherId);
    if (!A || !B) return;
    activePhotoId = activeId;
    comparePhotoId = otherId;
    $('wtCmpImgA').src = A.dataUrl;
    $('wtCmpImgB').src = B.dataUrl;
    $('wtCmpMetaA').textContent = photoFmtDate(A.dateKey) + ' · ' + (A.weight || '—');
    $('wtCmpMetaB').textContent = photoFmtDate(B.dateKey) + ' · ' + (B.weight || '—');
    const wA = parseWeightStr(A.weight);
    const wB = parseWeightStr(B.weight);
    const headEl = $('wtCompareHeadline');
    let cls = 'flat', headline = photoFmtDate(A.dateKey) + ' → ' + photoFmtDate(B.dateKey);
    if (wA != null && wB != null) {
      const diff = wA - wB;
      headline += ' ' + fmtDelta(diff, state.units);
      if (Math.abs(diff) < 0.05) cls = 'flat';
      else if (diff > 0) cls = 'up';
      else cls = 'down';
    }
    headEl.textContent = headline;
    headEl.className = 'wt-compare-headline ' + cls;
    $('wtViewer').dataset.mode = 'compare';
    $('wtViewer').classList.add('is-open');
    pvDeleteConfirm = false;
    $('wtCompareDelete').textContent = 'Delete';
    $('wtCompareDelete').classList.remove('is-confirm');
  }

  function cycleCompareTarget() {
    if (!activePhotoId) return;
    const others = photos.filter(p => p.id !== activePhotoId);
    if (!others.length) return;
    const curIdx = others.findIndex(p => p.id === comparePhotoId);
    const nextIdx = (curIdx + 1) % others.length;
    openCompare(activePhotoId, others[nextIdx].id);
  }

  function deleteActivePhoto(deleteBtn) {
    if (!activePhotoId) return;
    if (!pvDeleteConfirm) {
      pvDeleteConfirm = true;
      deleteBtn.textContent = 'Confirm delete?';
      deleteBtn.classList.add('is-confirm');
      setTimeout(() => {
        pvDeleteConfirm = false;
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.remove('is-confirm');
      }, 3000);
      return;
    }
    photos = photos.filter(p => p.id !== activePhotoId);
    photosSave();
    photosRender();
    closePhoto();
  }

  $('wtViewerClose').addEventListener('click', closePhoto);
  $('wtCompareClose').addEventListener('click', closePhoto);
  $('wtViewerDelete').addEventListener('click', () => deleteActivePhoto($('wtViewerDelete')));
  $('wtCompareDelete').addEventListener('click', () => deleteActivePhoto($('wtCompareDelete')));
  $('wtViewerCompare').addEventListener('click', () => {
    if (!activePhotoId) return;
    const otherId = defaultCompareFor(activePhotoId);
    if (!otherId) { showAlert('Need at least one other photo to compare.'); return; }
    openCompare(activePhotoId, otherId);
  });
  $('wtCompareBack').addEventListener('click', () => {
    if (activePhotoId) {
      $('wtViewer').dataset.mode = 'single';
    } else {
      closePhoto();
    }
  });
  $('wtCmpSideB').addEventListener('click', cycleCompareTarget);

  // ========== Paystub Importer ==========
  // Runs Tesseract.js OCR locally in the browser. No API key, no upload, no AI service.
  var PS_MAX_BYTES = 8 * 1024 * 1024;
  var psExtracted = null;

  function psQ(id) { return document.getElementById(id); }

  function psShowStatus(msg, isError) {
    var el = psQ('psStatus'); if (!el) return;
    el.innerHTML = msg;
    el.className = 'ps-status show' + (isError ? ' is-error' : '');
  }
  function psHideStatus() {
    var el = psQ('psStatus'); if (el) el.className = 'ps-status';
  }

  function psReset() {
    psExtracted = null;
    var preview = psQ('psPreview');
    if (preview) { preview.hidden = true; preview.src = ''; }
    var review = psQ('psReview');
    if (review) { review.classList.remove('show'); review.innerHTML = ''; }
    var confirmBtn = psQ('psConfirmBtn');
    if (confirmBtn) confirmBtn.disabled = true;
    var input = psQ('psFileInput');
    if (input) input.value = '';
    psHideStatus();
  }

  function psOpenModal() {
    var bg = psQ('psModalBg'); if (!bg) return;
    psReset();
    bg.classList.add('show');
  }
  function psCloseModal() {
    var bg = psQ('psModalBg'); if (bg) bg.classList.remove('show');
    psReset();
  }

  function psEscape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function psNormalizeDate(s) {
    if (!s) return null;
    var m = String(s).match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (!m) return null;
    var mo = parseInt(m[1], 10), d = parseInt(m[2], 10), y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return y + '-' + (mo < 10 ? '0' + mo : mo) + '-' + (d < 10 ? '0' + d : d);
  }

  function psFindAmount(text, patterns) {
    for (var i = 0; i < patterns.length; i++) {
      var rx = new RegExp(
        '(?:^|[^A-Za-z])' + patterns[i] +
        '[^\\n\\r]{0,80}?' +
        '(?:\\$\\s*)?' +
        '(' +
          '[0-9]{1,3}(?:,[0-9]{3})+(?:\\.[0-9]{2})?' +
          '|' +
          '[0-9]+\\.[0-9]{2}' +
        ')',
        'i'
      );
      var m = text.match(rx);
      if (m) {
        var n = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(n) && n > 0 && n < 1000000) return n;
      }
    }
    return 0;
  }

  function psParseText(rawText) {
    var lines = rawText.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    var text = rawText.replace(/[ \t]+/g, ' ');

    var netPay = psFindAmount(text, ['net\\s*pay', 'net\\s*amount', 'take\\s*home', 'net\\s*check', 'net\\s*earnings', 'net\\s*deposit']);
    var grossPay = psFindAmount(text, ['gross\\s*pay', 'gross\\s*earnings', 'total\\s*earnings', 'gross\\s*wages', 'total\\s*gross']);

    var taxes = [];
    var fed = psFindAmount(text, ['federal\\s*income\\s*tax', 'federal\\s*tax', 'fed\\s*w/?h', 'fed\\s*tax', '\\bfit\\b', '\\bfwt\\b']);
    if (fed) taxes.push({label: 'Federal Tax', amount: fed});
    var ss = psFindAmount(text, ['social\\s*security', 'oasdi', 'fica[\\s\\-]{0,3}ss', 'ss\\s*tax', 'soc\\s*sec']);
    if (ss) taxes.push({label: 'Social Security', amount: ss});
    var med = psFindAmount(text, ['medicare', 'fica[\\s\\-]{0,3}med', 'med\\s*tax']);
    if (med) taxes.push({label: 'Medicare', amount: med});
    var state = psFindAmount(text, ['state\\s*income\\s*tax', 'state\\s*tax', 'state\\s*w/?h', '\\bsit\\b', '\\bswt\\b']);
    if (state) taxes.push({label: 'State Tax', amount: state});
    var local = psFindAmount(text, ['local\\s*tax', 'city\\s*tax', 'local\\s*w/?h']);
    if (local) taxes.push({label: 'Local Tax', amount: local});
    var sdi = psFindAmount(text, ['\\bsdi\\b', 'disability\\s*ins', 'state\\s*disability']);
    if (sdi) taxes.push({label: 'SDI', amount: sdi});

    var deductions = [];
    var retire = psFindAmount(text, ['401\\s*\\(?k\\)?', '\\b401k\\b', '403\\s*\\(?b\\)?', 'retirement', 'roth\\s*401']);
    if (retire) deductions.push({label: '401(k)', amount: retire});
    var health = psFindAmount(text, ['health\\s*insurance', 'medical\\s*ins', 'health\\s*ins', '\\bhsa\\b', 'medical\\s*prem']);
    if (health) deductions.push({label: 'Health Insurance', amount: health});
    var dental = psFindAmount(text, ['dental\\s*insurance', 'dental\\s*ins', '\\bdental\\b']);
    if (dental) deductions.push({label: 'Dental', amount: dental});
    var vision = psFindAmount(text, ['vision\\s*insurance', 'vision\\s*ins', '\\bvision\\b']);
    if (vision) deductions.push({label: 'Vision', amount: vision});
    var life = psFindAmount(text, ['life\\s*insurance', 'life\\s*ins', 'group\\s*life']);
    if (life) deductions.push({label: 'Life Insurance', amount: life});

    var payDate = null;
    var dateLabels = ['pay\\s*date', 'check\\s*date', 'paid\\s*on', 'pay\\s*end(?:ing)?', 'period\\s*end(?:ing)?', 'deposit\\s*date'];
    for (var di = 0; di < dateLabels.length; di++) {
      var drx = new RegExp(dateLabels[di] + '[^\\n\\r]*?(\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{2,4})', 'i');
      var dm = text.match(drx);
      if (dm) { payDate = psNormalizeDate(dm[1]); if (payDate) break; }
    }
    if (!payDate) {
      var anyDate = text.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/);
      if (anyDate) payDate = psNormalizeDate(anyDate[0]);
    }

    var employer = null;
    var skipEmployer = /pay\s*stub|paystub|earnings\s*statement|earnings\s*&\s*deductions|pay\s*period|employee\s*(id|name|number)|to\s*the\s*(right|left|side)|this\s*is|please|note:|information\s*which|shows\s*your|total\s*wages|year[\s\-]to[\s\-]date|year[\s\-]end/i;
    for (var li = 0; li < Math.min(10, lines.length); li++) {
      var s = lines[li];
      if (s.length < 3 || s.length > 50) continue;
      if (!/[A-Za-z]/.test(s)) continue;
      if (/^\d/.test(s)) continue;
      if (skipEmployer.test(s)) continue;
      if (/[.!?]$/.test(s)) continue;
      if ((s.match(/\s/g) || []).length > 5) continue;
      var cleaned = s.replace(/[^\w\s&'.,\-]/g, '').trim().slice(0, 60);
      if (cleaned.length >= 3) { employer = cleaned; break; }
    }

    return {
      pay_date: payDate,
      pay_period_start: null,
      pay_period_end: null,
      employer: employer,
      gross_pay: grossPay,
      net_pay: netPay,
      taxes: taxes,
      deductions: deductions,
      raw_text: rawText
    };
  }

  function psResolveUrl(rel) {
    try { return new URL(rel, location.href).href; } catch(e) { return rel; }
  }

  function psPdfLib() {
    return (typeof pdfjsLib !== 'undefined') ? pdfjsLib
         : (typeof window !== 'undefined' && window['pdfjs-dist/build/pdf']) ? window['pdfjs-dist/build/pdf']
         : null;
  }

  function psPdfToCanvases(file) {
    var lib = psPdfLib();
    if (!lib) return Promise.reject(new Error('PDF library failed to load. Check vendor/pdfjs/ exists alongside this file.'));
    try { lib.GlobalWorkerOptions.workerSrc = psResolveUrl('vendor/pdfjs/pdf.worker.min.js'); } catch(e) {}

    return file.arrayBuffer().then(function(buf) {
      return lib.getDocument({ data: buf }).promise;
    }).then(function(pdf) {
      var pages = [];
      function renderOne(i) {
        return pdf.getPage(i).then(function(page) {
          var base = page.getViewport({ scale: 1 });
          var targetWidth = 2400;
          var scale = Math.max(2.0, Math.min(4.0, targetWidth / base.width));
          var viewport = page.getViewport({ scale: scale });
          var canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          var ctx = canvas.getContext('2d');
          return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() { return canvas; });
        });
      }
      var chain = Promise.resolve();
      for (var i = 1; i <= pdf.numPages; i++) {
        (function(pageNum) {
          chain = chain.then(function() {
            psShowStatus('<span class="ps-spinner"></span>Rendering PDF page ' + pageNum + '/' + pdf.numPages + '…');
            return renderOne(pageNum).then(function(c) { pages.push(c); });
          });
        })(i);
      }
      return chain.then(function() { return pages; });
    });
  }

  function psImageFileToCanvas(file) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function() {
        var scale = img.width < 1500 ? Math.min(3, 1800 / img.width) : 1;
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = scale > 1;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Failed to load image.')); };
      img.src = url;
    });
  }

  function psPreprocessCanvas(canvas) {
    try {
      var ctx = canvas.getContext('2d');
      var w = canvas.width, h = canvas.height;
      if (!w || !h) return canvas;
      var img = ctx.getImageData(0, 0, w, h);
      var d = img.data;
      var count = d.length / 4;
      var sum = 0;
      for (var i = 0; i < d.length; i += 4) {
        sum += (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114);
      }
      var avg = sum / count;
      var threshold = Math.max(110, Math.min(200, avg * 0.88));
      for (var j = 0; j < d.length; j += 4) {
        var gray = (d[j] * 0.299 + d[j+1] * 0.587 + d[j+2] * 0.114);
        var v = gray < threshold ? 0 : 255;
        d[j] = v; d[j+1] = v; d[j+2] = v;
      }
      ctx.putImageData(img, 0, 0);
    } catch(e) {}
    return canvas;
  }

  function psOcrSource(source, pageLabel) {
    return Tesseract.recognize(source, 'eng', {
      workerPath: psResolveUrl('vendor/tesseract/worker.min.js'),
      corePath: psResolveUrl('vendor/tesseract/'),
      langPath: psResolveUrl('vendor/tesseract/'),
      logger: function(m) {
        if (!m) return;
        if (m.status === 'recognizing text') {
          var pct = Math.round((m.progress || 0) * 100);
          psShowStatus('<span class="ps-spinner"></span>Reading' + pageLabel + '… ' + pct + '%');
        } else if (m.status) {
          var label = m.status.charAt(0).toUpperCase() + m.status.slice(1);
          psShowStatus('<span class="ps-spinner"></span>' + label + pageLabel + '…');
        }
      }
    }).then(function(result) {
      return (result && result.data && result.data.text) || '';
    });
  }

  function psRunOCR(file) {
    if (typeof Tesseract === 'undefined') {
      return Promise.reject(new Error('OCR library failed to load. Check that vendor/tesseract/ exists alongside this file.'));
    }
    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    var canvasesPromise = isPdf
      ? psPdfToCanvases(file)
      : psImageFileToCanvas(file).then(function(c) { return [c]; });

    return canvasesPromise.then(function(canvases) {
      if (!canvases.length) throw new Error('No pages to read.');
      psShowStatus('<span class="ps-spinner"></span>Preprocessing image…');
      for (var k = 0; k < canvases.length; k++) {
        psPreprocessCanvas(canvases[k]);
      }
      var preview = psQ('psPreview');
      if (preview && canvases[0]) {
        try {
          preview.src = canvases[0].toDataURL('image/png');
          preview.hidden = false;
        } catch(e) {}
      }
      var allText = '';
      var chain = Promise.resolve();
      for (var i = 0; i < canvases.length; i++) {
        (function(idx) {
          var label = canvases.length > 1 ? ' page ' + (idx + 1) + '/' + canvases.length : '';
          chain = chain.then(function() {
            return psOcrSource(canvases[idx], label).then(function(t) { allText += t + '\n'; });
          });
        })(i);
      }
      return chain.then(function() {
        if (!allText.trim()) throw new Error('OCR found no readable text. Try a clearer image or higher-resolution PDF.');
        var parsed = psParseText(allText);
        parsed._no_amounts = !parsed.net_pay && !parsed.gross_pay;
        parsed._doc_type = psDetectDocType(allText);
        return parsed;
      });
    });
  }

  function psDetectDocType(text) {
    if (/\bW[\s\-]?2\b|wage\s+and\s+tax\s+statement|department\s+of\s+the\s+treasury/i.test(text)) return 'w2';
    if (/\b1099\b/i.test(text)) return '1099';
    if (/pay\s*stub|earnings\s*statement|pay\s*period|net\s*pay|gross\s*pay/i.test(text)) return 'paystub';
    return 'unknown';
  }

  function psRenderReview(d) {
    psExtracted = d;
    var review = psQ('psReview');
    if (!review) return;

    var payDate = d.pay_date || (new Date().toISOString().slice(0, 10));
    var employer = d.employer || 'Paycheck';
    var net = Number(d.net_pay) || 0;
    var taxes = Array.isArray(d.taxes) ? d.taxes : [];
    var deductions = Array.isArray(d.deductions) ? d.deductions : [];

    var html = '';
    if (d._doc_type === 'w2') {
      html += '<div class="ps-warn">This looks like a <strong>W-2 tax form</strong>, not a per-period paystub. W-2s show annual totals — you can still import the wages and withholdings below, but the parser is tuned for paystub labels and may need manual entry.</div>';
    } else if (d._doc_type === '1099') {
      html += '<div class="ps-warn">This looks like a <strong>1099 form</strong>. The parser is tuned for paystub labels and may need manual entry.</div>';
    } else if (d._no_amounts) {
      html += '<div class="ps-warn">OCR ran, but no pay amounts matched known labels. Likely causes: low-resolution scan, an unusual paystub layout, or this is a different document type. Check the raw text at the bottom and fill fields manually.</div>';
    }
    html += '<div class="ps-review-section-h">Paystub</div>';
    html += '<div class="ps-meta-row">';
    html += '<div><label>Employer</label><input type="text" id="psEmployer" value="' + psEscape(employer) + '"></div>';
    html += '<div><label>Pay date</label><input type="text" id="psPayDate" value="' + psEscape(payDate) + '" placeholder="YYYY-MM-DD"></div>';
    html += '</div>';

    html += '<div class="ps-review-section-h">Income (net pay)</div>';
    html += '<div class="ps-row ps-row-head"><div>Source</div><div>Amount</div><div></div></div>';
    html += '<div class="ps-row is-income">';
    html += '<input type="text" id="psNetSource" value="' + psEscape(employer + ' (paycheck)') + '">';
    html += '<input type="number" step="0.01" id="psNetAmount" value="' + net.toFixed(2) + '">';
    html += '<input type="checkbox" id="psNetCheck" checked>';
    html += '</div>';

    var allDeductions = taxes.concat(deductions);
    if (allDeductions.length) {
      html += '<div class="ps-review-section-h">Deductions (logged as expenses)</div>';
      html += '<div class="ps-row ps-row-head"><div>Label</div><div>Amount</div><div></div></div>';
      for (var i = 0; i < allDeductions.length; i++) {
        var ded = allDeductions[i] || {};
        var label = ded.label || 'Deduction';
        var amt = Number(ded.amount) || 0;
        html += '<div class="ps-row is-expense">';
        html += '<input type="text" data-ps-ded-label="' + i + '" value="' + psEscape(label) + '">';
        html += '<input type="number" step="0.01" data-ps-ded-amount="' + i + '" value="' + amt.toFixed(2) + '">';
        html += '<input type="checkbox" data-ps-ded-check="' + i + '" checked>';
        html += '</div>';
      }
    }

    if (d.raw_text) {
      var openAttr = (d._no_amounts || d._doc_type === 'w2' || d._doc_type === '1099') ? ' open' : '';
      html += '<details class="ps-rawocr"' + openAttr + '><summary>View raw OCR text</summary><pre>' + psEscape(d.raw_text) + '</pre></details>';
    }

    review.innerHTML = html;
    review.classList.add('show');
    var confirmBtn = psQ('psConfirmBtn');
    if (confirmBtn) confirmBtn.disabled = false;
  }

  function psCommitReview() {
    if (!psExtracted) return false;
    var payDateEl = psQ('psPayDate');
    var payDate = payDateEl ? payDateEl.value.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate)) {
      psShowStatus('Pay date must be YYYY-MM-DD.', true);
      return false;
    }
    var data = loadData();
    var added = 0;

    var netCheck = psQ('psNetCheck');
    if (netCheck && netCheck.checked) {
      var srcEl = psQ('psNetSource');
      var amtEl = psQ('psNetAmount');
      var src = ((srcEl && srcEl.value) || 'Paycheck').trim();
      var amt = Number(amtEl && amtEl.value) || 0;
      if (amt > 0) {
        data.income.push({
          id: uid(),
          source: src,
          amount: amt,
          tags: ['Salary'],
          date: payDate
        });
        added++;
      }
    }

    var allLen = ((psExtracted.taxes || []).length) + ((psExtracted.deductions || []).length);
    for (var i = 0; i < allLen; i++) {
      var c = document.querySelector('[data-ps-ded-check="' + i + '"]');
      if (!c || !c.checked) continue;
      var l = document.querySelector('[data-ps-ded-label="' + i + '"]');
      var a = document.querySelector('[data-ps-ded-amount="' + i + '"]');
      var label = ((l && l.value) || 'Deduction').trim();
      var amount = Number(a && a.value) || 0;
      if (amount <= 0) continue;
      data.expenses.push({
        id: uid(),
        source: label,
        amount: amount,
        tags: ['Paycheck Deduction'],
        date: payDate
      });
      added++;
    }

    if (added === 0) {
      psShowStatus('Nothing selected to import.', true);
      return false;
    }
    saveData(data);
    renderFinances();
    return true;
  }

  function psHandleFile(file) {
    if (!file) return;
    if (file.size > PS_MAX_BYTES) {
      psShowStatus('File too large (max 8 MB).', true);
      return;
    }
    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    var isImage = (file.type || '').indexOf('image/') === 0;
    if (!isPdf && !isImage) {
      psShowStatus('Only images (PNG, JPG, WebP) and PDFs are supported.', true);
      return;
    }

    var preview = psQ('psPreview');
    if (preview) {
      if (isImage) {
        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
      } else {
        preview.hidden = true;
        preview.src = '';
      }
    }

    var review = psQ('psReview');
    if (review) { review.classList.remove('show'); review.innerHTML = ''; }
    var confirmBtn = psQ('psConfirmBtn');
    if (confirmBtn) confirmBtn.disabled = true;
    psShowStatus('<span class="ps-spinner"></span>' + (isPdf ? 'Opening PDF…' : 'Starting OCR…'));

    psRunOCR(file).then(function(extracted) {
      psHideStatus();
      psRenderReview(extracted);
    }).catch(function(err) {
      try { console.error('Paystub OCR error:', err); } catch(e) {}
      var msg = (err && (err.message || err.name)) || (err && String(err)) || 'OCR failed.';
      psShowStatus('OCR failed: ' + psEscape(msg), true);
    });
  }

  function psWire() {
    var importBtn = psQ('psImportBtn');
    var bg = psQ('psModalBg');
    var drop = psQ('psDrop');
    var fileInput = psQ('psFileInput');
    var cancelBtn = psQ('psCancelBtn');
    var confirmBtn = psQ('psConfirmBtn');
    if (!importBtn || !bg || !drop || !fileInput || !cancelBtn || !confirmBtn) return;

    importBtn.addEventListener('click', psOpenModal);
    cancelBtn.addEventListener('click', psCloseModal);
    bg.addEventListener('click', function(e) { if (e.target === bg) psCloseModal(); });

    drop.addEventListener('click', function() { fileInput.click(); });
    drop.addEventListener('dragover', function(e) {
      e.preventDefault(); drop.classList.add('is-drag');
    });
    drop.addEventListener('dragleave', function() { drop.classList.remove('is-drag'); });
    drop.addEventListener('drop', function(e) {
      e.preventDefault();
      drop.classList.remove('is-drag');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) psHandleFile(f);
    });

    fileInput.addEventListener('change', function() {
      var f = fileInput.files && fileInput.files[0];
      if (f) psHandleFile(f);
    });

    confirmBtn.addEventListener('click', function() {
      if (psCommitReview()) psCloseModal();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && bg.classList.contains('show')) psCloseModal();
    });
  }

  psWire();

  // Boot
  renderAll();
  wtRender();
  photosRender();

})();
