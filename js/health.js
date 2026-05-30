(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  // ---- Storage ----
  function loadDay(date) {
    try { const v = localStorage.getItem('health:' + date); return v ? JSON.parse(v) : {}; }
    catch (e) { return {}; }
  }
  function saveDay(date, data) { localStorage.setItem('health:' + date, JSON.stringify(data)); }

  function getSettings() {
    try {
      const v = localStorage.getItem('health_settings');
      return v ? Object.assign(defaultSettings(), JSON.parse(v)) : defaultSettings();
    } catch (e) { return defaultSettings(); }
  }
  function defaultSettings() {
    return { water_goal_oz: 64, sleep_goal_hours: 8, calorie_goal: 2200, carbs_goal_g: 250, fat_goal_g: 75, protein_goal_g: 118, time_format_12h: false, focus_goal_min: 240 };
  }

  window.getFocusMinToday = function() {
    const day = loadDay(getActiveDate());
    return day.focus_min || 0;
  };

  window.addFocusMin = function(minutes) {
    const date = getActiveDate();
    const day = loadDay(date);
    day.focus_min = (day.focus_min || 0) + minutes;
    saveDay(date, day);
  };

  // ---- Time format helpers ----
  function _to12h(h, m) {
    const ampm = h < 12 ? 'AM' : 'PM';
    return { hour: h % 12 || 12, min: m, ampm };
  }
  function _to24h(h12, m, ampm) {
    if (ampm === 'AM' && h12 === 12) return { hour: 0, min: m };
    if (ampm === 'PM' && h12 !== 12) return { hour: h12 + 12, min: m };
    return { hour: h12, min: m };
  }
  function _fmtTime(h, m, use12h) {
    if (use12h) { const t = _to12h(h, m); return t.hour + ':' + pad2(t.min) + ' ' + t.ampm; }
    return pad2(h) + ':' + pad2(m);
  }
  function _fmtDisplay(timeStr, use12h) {
    if (!timeStr) return '—';
    if (!use12h) return timeStr;
    const [h, m] = timeStr.split(':').map(Number);
    const t = _to12h(h, m);
    return t.hour + ':' + pad2(t.min) + ' ' + t.ampm;
  }

  // ---- Sleep modal state ----
  let _spField, _spH, _spM, _spDate, _spDay, _spSettings;

  // ---- Date helpers ----
  function dateToYMD(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function getActiveDate() {
    const now = new Date();
    return dateToYMD(now);
  }

  // ---- View date state ----
  let _viewDate = null;
  function _resolveViewDate() { return _viewDate || getActiveDate(); }
  function _setViewDate(dateStr) { _viewDate = dateStr || null; }

  // ---- Cross-tab reads ----
  function getMoodToday(date) { try { const v = localStorage.getItem('mood:' + date); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function getExerciseDoneToday(date) {
    try { const d = JSON.parse(localStorage.getItem('po_coach_workout_done') || '{}'); return !!d[date]; }
    catch (e) { return false; }
  }

  // Mirrors habits.js MOOD_DEFS
  const MOOD_MAP = {
    happy:      { label: 'Happy',      emoji: '🌻' },
    calm:       { label: 'Calm',       emoji: '🌿' },
    motivated:  { label: 'Motivated',  emoji: '🚀' },
    tired:      { label: 'Tired',      emoji: '😴' },
    anxious:    { label: 'Anxious',    emoji: '😟' },
    frustrated: { label: 'Frustrated', emoji: '😤' },
    sad:        { label: 'Sad',        emoji: '🌧️' },
    numb:       { label: 'Numb',       emoji: '😑' },
  };

  // Mirrors habits.js MOOD_SVGS
  const MOOD_SVGS = {
    happy:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#FFCD42"/><circle cx="12" cy="15" r="2.5" fill="#5D4037"/><circle cx="24" cy="15" r="2.5" fill="#5D4037"/><circle cx="13" cy="14" r="1" fill="white"/><circle cx="25" cy="14" r="1" fill="white"/><path d="M11 21 Q18 28 25 21" stroke="#5D4037" stroke-width="2.5" fill="none" stroke-linecap="round"/><ellipse cx="9" cy="22" rx="3" ry="1.8" fill="#FF8A65" opacity="0.5"/><ellipse cx="27" cy="22" rx="3" ry="1.8" fill="#FF8A65" opacity="0.5"/></svg>',
    calm:       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#4CAF7A"/><path d="M11 15 Q14 12 17 15" stroke="#1B5E3A" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M19 15 Q22 12 25 15" stroke="#1B5E3A" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M12 21 Q18 26 24 21" stroke="#1B5E3A" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    motivated:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#FF6B6B"/><path d="M18 6 C14 12 13 19 13 23 L23 23 C23 19 22 12 18 6Z" fill="white" opacity="0.95"/><path d="M13 15 Q18 6 23 15" fill="#D32F2F"/><circle cx="18" cy="18" r="3.5" fill="#42A5F5" stroke="#1565C0" stroke-width="1"/><path d="M13 23 L10 28 L14 25 Z" fill="#D32F2F"/><path d="M23 23 L26 28 L22 25 Z" fill="#D32F2F"/><path d="M15 23 Q18 31 21 23" fill="#FFCD42"/><path d="M16.5 23 Q18 28 19.5 23" fill="#FF9800"/></svg>',
    tired:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#9B7DFF"/><ellipse cx="13" cy="17" rx="2.5" ry="2" fill="#5C35CC"/><ellipse cx="23" cy="17" rx="2.5" ry="2" fill="#5C35CC"/><path d="M10 15 Q13 18 16 15" fill="#9B7DFF" stroke="#5C35CC" stroke-width="0.5"/><path d="M20 15 Q23 18 26 15" fill="#9B7DFF" stroke="#5C35CC" stroke-width="0.5"/><path d="M14 24 Q18 22 22 24" stroke="#5C35CC" stroke-width="1.5" fill="none" stroke-linecap="round"/><text x="26" y="12" font-size="6" fill="#5C35CC" font-weight="bold" font-family="Arial,sans-serif">z</text><text x="29" y="8" font-size="4" fill="#5C35CC" font-weight="bold" font-family="Arial,sans-serif">z</text></svg>',
    anxious:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#5A9BFF"/><path d="M10 13 Q13 11 16 13" stroke="#1A56CC" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M20 13 Q23 11 26 13" stroke="#1A56CC" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="13" cy="17" r="2.5" fill="white"/><circle cx="23" cy="17" r="2.5" fill="white"/><circle cx="13" cy="17" r="1.5" fill="#1A56CC"/><circle cx="23" cy="17" r="1.5" fill="#1A56CC"/><path d="M13 23 Q15.5 21 17 23 Q18.5 25 21 23" stroke="#1A56CC" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M27 8 Q29 5 31 9 Q31 12 28.5 12 Q26 12 27 8Z" fill="#BBDEFB"/></svg>',
    frustrated: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#FF5252"/><path d="M10 14 Q13 17 16 13" stroke="#B71C1C" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M20 13 Q23 17 26 14" stroke="#B71C1C" stroke-width="2.5" fill="none" stroke-linecap="round"/><ellipse cx="13" cy="19" rx="2.5" ry="1.8" fill="#B71C1C"/><ellipse cx="23" cy="19" rx="2.5" ry="1.8" fill="#B71C1C"/><path d="M13 24 Q18 22 23 24" stroke="#B71C1C" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M5 15 Q7 12 9 15" stroke="#FFCDD2" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M27 15 Q29 12 31 15" stroke="#FFCDD2" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
    sad:        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#4C7DAA"/><circle cx="13" cy="16" r="5.5" fill="#BBDEFB" opacity="0.9"/><circle cx="22" cy="14" r="5" fill="#BBDEFB" opacity="0.9"/><ellipse cx="18" cy="18" rx="9.5" ry="6" fill="#BBDEFB" opacity="0.9"/><ellipse cx="13.5" cy="16.5" rx="1.5" ry="1.5" fill="#546E7A"/><ellipse cx="22" cy="15.5" rx="1.5" ry="1.5" fill="#546E7A"/><path d="M15 20 Q18 18 21 20" stroke="#546E7A" stroke-width="1.5" fill="none" stroke-linecap="round"/><line x1="13" y1="24" x2="12" y2="29" stroke="#90CAF9" stroke-width="1.5" stroke-linecap="round"/><line x1="18" y1="24" x2="17" y2="29" stroke="#90CAF9" stroke-width="1.5" stroke-linecap="round"/><line x1="23" y1="24" x2="22" y2="29" stroke="#90CAF9" stroke-width="1.5" stroke-linecap="round"/></svg>',
    numb:       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#9E9E9E"/><circle cx="13" cy="17" r="2" fill="#424242"/><circle cx="23" cy="17" r="2" fill="#424242"/><line x1="13" y1="23" x2="23" y2="23" stroke="#424242" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  function moodSvgImg(key) {
    const svg = MOOD_SVGS[key];
    return svg ? '<img src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '" alt="" class="hl-mood-svg">' : null;
  }

  // Mood → readiness score (0–1)
  const MOOD_SCORES = {
    motivated: 0.95, happy: 0.90, calm: 0.80,
    numb: 0.35, tired: 0.35, anxious: 0.30, frustrated: 0.25, sad: 0.20,
  };

  // Consecutive prior days with any health data logged (capped at 7)
  function getConsistencyStreak(currentDate) {
    const [y, mo, d] = currentDate.split('-').map(Number);
    let streak = 0;
    for (let i = 1; i <= 7; i++) {
      const data = loadDay(dateToYMD(new Date(y, mo - 1, d - i)));
      if (Object.keys(data).length > 0) streak++;
      else break;
    }
    return streak;
  }

  // ---- Readiness score — Phase 2: 7-factor weighted formula ----
  // All factors always included; missing data defaults to neutral (0.5).
  // Returns null only when no health data has been logged at all.
  function calcReadiness(date, day, settings) {
    const N = 0.5; // neutral default

    const hasAnyData = day.sleep_hours != null
      || (day.water_oz > 0)
      || (day.recovery && Object.values(day.recovery).some(v => v != null))
      || (day.nutrition_totals && day.nutrition_totals.calories > 0);
    const streak = getConsistencyStreak(date);
    if (!hasAnyData && streak === 0) return null;

    // sleep hours relative to goal × 0.20
    const sleepScore = day.sleep_hours != null ? Math.min(day.sleep_hours / settings.sleep_goal_hours, 1) : N;

    // hydration × 0.15
    const hydration = day.water_oz > 0 ? Math.min(day.water_oz / settings.water_goal_oz, 1) : N;

    // mood × 0.1875
    const mood = getMoodToday(date);
    const moodScore = mood != null ? (MOOD_SCORES[mood] ?? N) : N;

    // nutrition adherence × 0.10
    let nutrition = N;
    if (day.nutrition_totals && day.nutrition_totals.calories > 0) {
      const calR = day.nutrition_totals.calories / settings.calorie_goal;
      const calScore = calR >= 0.85 && calR <= 1.10 ? 1 : Math.max(0, 1 - Math.abs(calR - 1) * 2);
      const protScore = day.nutrition_totals.protein_g
        ? Math.min(day.nutrition_totals.protein_g / settings.protein_goal_g, 1) : N;
      nutrition = (calScore + protScore) / 2;
    }

    // recovery avg × 0.10
    let recovery = N;
    if (day.recovery) {
      const r = day.recovery;
      const scores = [];
      if (r.soreness       != null) scores.push(1 - (r.soreness - 1) / 6);
      if (r.stress         != null) scores.push(1 - (r.stress - 1) / 6);
      if (r.burnout        != null) scores.push(1 - (r.burnout - 1) / 6);
      if (r.mental_fatigue != null) scores.push(1 - (r.mental_fatigue - 1) / 6);
      if (r.social_battery != null) scores.push((r.social_battery - 1) / 6);
      if (r.motivation     != null) scores.push((r.motivation - 1) / 6);
      if (scores.length) recovery = scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    // energy level × 0.10
    const energy = (day.recovery && day.recovery.energy != null)
      ? (day.recovery.energy - 1) / 6 : N;

    return Math.round((
      sleepScore  * 0.25 +
      hydration   * 0.15 +
      moodScore   * 0.1875 +
      nutrition   * 0.125 +
      recovery    * 0.125 +
      energy      * 0.125
    ) * 100);
  }

  function calcFactors(date, day, settings) {
    const N = 0.5;
    const sleepScore = day.sleep_hours != null ? Math.min(day.sleep_hours / settings.sleep_goal_hours, 1) : N;
    const hydration = day.water_oz > 0 ? Math.min(day.water_oz / settings.water_goal_oz, 1) : N;
    const mood = getMoodToday(date);
    const moodScore = mood != null ? (MOOD_SCORES[mood] ?? N) : N;
    let nutrition = N;
    if (day.nutrition_totals && day.nutrition_totals.calories > 0) {
      const calR = day.nutrition_totals.calories / settings.calorie_goal;
      const calScore = calR >= 0.85 && calR <= 1.10 ? 1 : Math.max(0, 1 - Math.abs(calR - 1) * 2);
      const protScore = day.nutrition_totals.protein_g ? Math.min(day.nutrition_totals.protein_g / settings.protein_goal_g, 1) : N;
      nutrition = (calScore + protScore) / 2;
    }
    let recovery = N;
    if (day.recovery) {
      const r = day.recovery;
      const scores = [];
      if (r.soreness       != null) scores.push(1 - (r.soreness - 1) / 6);
      if (r.stress         != null) scores.push(1 - (r.stress - 1) / 6);
      if (r.burnout        != null) scores.push(1 - (r.burnout - 1) / 6);
      if (r.mental_fatigue != null) scores.push(1 - (r.mental_fatigue - 1) / 6);
      if (r.social_battery != null) scores.push((r.social_battery - 1) / 6);
      if (r.motivation     != null) scores.push((r.motivation - 1) / 6);
      if (scores.length) recovery = scores.reduce((a, b) => a + b, 0) / scores.length;
    }
    const energy = (day.recovery && day.recovery.energy != null)
      ? (day.recovery.energy - 1) / 6 : N;
    return {
      Sleep:       Math.round(sleepScore * 100),
      Hydration:   Math.round(hydration * 100),
      Mood:        Math.round(moodScore * 100),
      Nutrition:   Math.round(nutrition * 100),
      Recovery:    Math.round(recovery * 100),
      Energy:      Math.round(energy * 100),
    };
  }

  // ---- Snapshot ----
  function renderSnapshot(date, day, settings) {
    const el = $('hlSnapshotBody');
    if (!el) return;

    const readiness = calcReadiness(date, day, settings);

    // Ring SVG
    const R = 48, CX = 62, CY = 62, CIRC = 2 * Math.PI * R;
    const pct = readiness != null ? readiness / 100 : 0;
    const ringColor = readiness == null ? 'rgba(255,255,255,0.06)' : 'var(--accent)';
    const ringSvg = `<svg class="hl-ring-svg" viewBox="0 0 124 124" aria-hidden="true">
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="9"/>
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${ringColor}" stroke-width="9"
        stroke-dasharray="${(pct * CIRC).toFixed(2)} ${CIRC.toFixed(2)}"
        stroke-linecap="round" transform="rotate(-90 ${CX} ${CY})"/>
    </svg>
    <div class="hl-ring-label">
      <div class="hl-ring-pct">${readiness != null ? readiness + '%' : '—'}</div>
      <div class="hl-ring-word">Readiness</div>
    </div>`;

    const factors = calcFactors(date, day, settings);
    const factorBarsHtml = Object.entries(factors).map(([name, pct]) => {
      const color = pct >= 80 ? 'var(--success, #5fd687)' : pct >= 60 ? 'var(--amber, #F2C063)' : 'var(--danger, #ff6b6b)';
      return `<div class="hl-factor-row">
        <span class="hl-factor-label">${name}</span>
        <div class="hl-factor-bar"><div class="hl-factor-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="hl-factor-pct">${pct}%</span>
      </div>`;
    }).join('');

    el.innerHTML = `<div class="hl-snap-inner">
      <div class="hl-ring-wrap">${ringSvg}</div>
      <div class="hl-factors">${factorBarsHtml}</div>
    </div>`;
  }

  // ---- Throttled render (water rapid-click guard) ----
  let _lastRender = 0;
  function _throttledRender() {
    const now = Date.now();
    if (now - _lastRender > 200) { _lastRender = now; renderHealth(); }
  }

  // ---- Quick Log ----
  const RECOVERY_SLIDERS = [
    { key: 'soreness',       label: 'Soreness',       lo: 'Fresh',     hi: 'Wrecked'     },
    { key: 'stress',         label: 'Stress',         lo: 'Calm',      hi: 'Overwhelmed' },
    { key: 'burnout',        label: 'Burnout',        lo: 'Energized', hi: 'Empty'       },
    { key: 'energy',         label: 'Energy',         lo: 'Drained',   hi: 'Charged'     },
    { key: 'mental_fatigue', label: 'Mental Fatigue', lo: 'Sharp',     hi: 'Foggy'       },
    { key: 'social_battery', label: 'Social Battery', lo: 'Drained',   hi: 'Full'        },
    { key: 'motivation',     label: 'Motivation',     lo: 'Zero',      hi: 'Fire'        },
  ];

  // ---- Log (merged: sleep + water + recovery) ----
  function renderLog(date, day, settings) {
    const el = $('hlLogCard');
    if (!el) return;

    const sleepBed = day.sleep_bedtime || '';
    const sleepWake = day.sleep_waketime || '';
    const waterOz = day.water_oz || 0;
    const waterMax = settings.water_goal_oz * 1.3;
    const waterPct = Math.min(waterOz / waterMax * 100, 100);
    const waterGoalPct = (settings.water_goal_oz / waterMax * 100).toFixed(1);
    const rec = day.recovery || {};

    const slidersHtml = RECOVERY_SLIDERS.map(s => {
      const val = rec[s.key] != null ? rec[s.key] : 4;
      return `<div class="rc-slider-row">
        <div class="rc-slider-meta">
          <span class="rc-slider-label">${s.label}</span>
          <span class="rc-slider-val" id="rcSv-${s.key}">${val}</span>
        </div>
        <div class="rc-slider-range-row">
          <span class="rc-slider-bound">${s.lo}</span>
          <input type="range" class="rc-slider" min="1" max="7" value="${val}" data-recovery="${s.key}" id="rcSl-${s.key}">
          <span class="rc-slider-bound rc-slider-bound-hi">${s.hi}</span>
        </div>
      </div>`;
    }).join('');

    el.innerHTML = `
      <button type="button" class="hl-settings-toggle" id="hlSettingsToggle" aria-label="Health settings">⚙</button>
      <div class="hl-log-section">
        <div class="ql-row">
          <label class="ql-label">Sleep</label>
          <div class="ql-sleep-wrap">
            <div class="ql-sleep-sub">
              <span class="ql-sleep-sub-label">Bed</span>
              <button type="button" class="ql-sleep-time-disp" data-sleep-field="bed">${_fmtDisplay(sleepBed, false)}</button>
            </div>
            <div class="ql-sleep-sub">
              <span class="ql-sleep-sub-label">Wake</span>
              <button type="button" class="ql-sleep-time-disp" data-sleep-field="wake">${_fmtDisplay(sleepWake, false)}</button>
            </div>
          </div>
        </div>
        <div class="ql-row">
          <label class="ql-label">Water</label>
          <div class="ql-water-wrap">
            <div class="ql-water-top">
              <div class="ql-water-bar">
                <div class="ql-water-fill" style="width:${waterPct.toFixed(1)}%"></div>
                <div class="ql-water-goal-tick" style="left:${waterGoalPct}%"></div>
              </div>
              <span class="ql-water-val"><span id="qlWaterNum">${waterOz}</span> / ${settings.water_goal_oz} oz</span>
            </div>
            <div class="ql-water-btns">
              <button type="button" class="ql-water-btn" data-add="8">+8</button>
              <button type="button" class="ql-water-btn" data-add="16">+16</button>
              <button type="button" class="ql-water-btn" data-add="32">+32</button>
              <button type="button" class="ql-water-btn ql-water-sub" data-add="-8">−8</button>
              <input type="number" class="ql-water-custom" id="qlWaterCustom" min="0" placeholder="oz">
            </div>
          </div>
        </div>
      </div>
      <div class="hl-log-divider"></div>
      <div class="hl-log-section">
        <div class="hl-log-section-label">Recovery</div>
        <div class="rc-sliders">${slidersHtml}</div>
      </div>`;

    const settingsBtn = $('hlSettingsToggle');
    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);

    el.querySelectorAll('.ql-sleep-time-disp').forEach(btn => {
      btn.addEventListener('click', () => openSleepModal(btn.dataset.sleepField, date, day, settings));
    });

    el.querySelectorAll('.ql-water-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        day.water_oz = Math.max(0, (day.water_oz || 0) + parseInt(btn.dataset.add, 10));
        saveDay(date, day);
        _throttledRender();
      });
    });

    const customInput = $('qlWaterCustom');
    if (customInput) {
      function _addCustomWater() {
        const val = parseInt(customInput.value, 10);
        if (!val || val <= 0) return;
        day.water_oz = Math.max(0, (day.water_oz || 0) + val);
        saveDay(date, day);
        customInput.value = '';
        renderHealth();
      }
      customInput.addEventListener('blur', _addCustomWater);
      customInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); _addCustomWater(); } });
    }

    el.querySelectorAll('.rc-slider').forEach(slider => {
      slider.addEventListener('input', () => {
        const key = slider.dataset.recovery;
        const val = parseInt(slider.value, 10);
        if (!day.recovery) day.recovery = {};
        day.recovery[key] = val;
        const valEl = $('rcSv-' + key);
        if (valEl) valEl.textContent = val;
        saveDay(date, day);
        renderSnapshot(date, day, getSettings());
      });
    });
  }

  // ---- Sleep modal ----
  let _spEscHandler = null;

  function openSleepModal(field, date, day, settings) {
    const bg = $('sleepModalBg');
    if (!bg) return;

    const val = day[field === 'bed' ? 'sleep_bedtime' : 'sleep_waketime'] || '';
    let h24 = 22, m = 0;
    if (val) {
      const p = val.split(':');
      h24 = parseInt(p[0], 10);
      m = parseInt(p[1], 10);
    }

    _spField = field;
    _spDate = date;
    _spDay = day;
    _spSettings = settings;
    _spH = h24;
    _spM = m;

    const use12h = settings.time_format_12h;
    const title = 'Set ' + (field.charAt(0).toUpperCase() + field.slice(1)) + ' Time';

    let hourVal, ampmHtml = '';
    if (use12h) {
      const t = _to12h(h24, m);
      hourVal = t.hour;
      ampmHtml = `<div class="sleep-picker-col" id="spAmpmCol">
        <button type="button" class="sleep-picker-arrow" data-sp-adj="ap">▲</button>
        <div class="sleep-picker-val" id="spAmpm">${t.ampm}</div>
        <button type="button" class="sleep-picker-arrow" data-sp-adj="ap">▼</button>
      </div>`;
    } else {
      hourVal = pad2(h24);
    }

    bg.innerHTML = `<div class="nt-modal glass">
      <div class="nt-modal-title">${title}</div>
      <div class="nt-modal-body">
        <div class="sleep-picker">
          <div class="sleep-picker-col">
            <button type="button" class="sleep-picker-arrow" data-sp-adj="h+1">▲</button>
            <div class="sleep-picker-val" id="spHour">${hourVal}</div>
            <button type="button" class="sleep-picker-arrow" data-sp-adj="h-1">▼</button>
          </div>
          <div class="sleep-picker-sep">:</div>
          <div class="sleep-picker-col">
            <button type="button" class="sleep-picker-arrow" data-sp-adj="m+1">▲</button>
            <div class="sleep-picker-val" id="spMin">${pad2(m)}</div>
            <button type="button" class="sleep-picker-arrow" data-sp-adj="m-1">▼</button>
          </div>
          ${ampmHtml}
        </div>
      </div>
      <div class="nt-modal-foot">
        <button type="button" class="nt-modal-cancel" id="spCancel">Cancel</button>
        <button type="button" class="nt-modal-save" id="spSave">Save</button>
      </div>
    </div>`;

    bg.hidden = false;

    bg.querySelectorAll('[data-sp-adj]').forEach(btn => {
      btn.addEventListener('click', () => {
        const adj = btn.dataset.spAdj;
        const type = adj[0];
        const delta = parseInt(adj.slice(1), 10);
        _spAdjust(type, delta);
      });
    });

    $('spCancel').addEventListener('click', closeSleepModal);
    $('spSave').addEventListener('click', () => {
      const timeStr = pad2(_spH) + ':' + pad2(_spM);
      const key = _spField === 'bed' ? 'sleep_bedtime' : 'sleep_waketime';
      _spDay[key] = timeStr;

      const b = _spDay.sleep_bedtime, w = _spDay.sleep_waketime;
      if (b && w) {
        const [bh, bm] = b.split(':').map(Number);
        const [wh, wm] = w.split(':').map(Number);
        let hours = (wh + wm / 60) - (bh + bm / 60);
        if (hours < 0) hours += 24;
        _spDay.sleep_hours = Math.round(hours * 100) / 100;
      } else {
        delete _spDay.sleep_hours;
        if (!b) delete _spDay.sleep_bedtime;
        if (!w) delete _spDay.sleep_waketime;
      }
      saveDay(_spDate, _spDay);
      closeSleepModal();
      renderHealth();
    });

    bg.addEventListener('click', e => { if (e.target === bg) closeSleepModal(); });

    if (_spEscHandler) document.removeEventListener('keydown', _spEscHandler);
    _spEscHandler = e => { if (e.key === 'Escape') closeSleepModal(); };
    document.addEventListener('keydown', _spEscHandler);
  }

  function _spAdjust(type, delta) {
    if (type === 'h') {
      if (_spSettings.time_format_12h) {
        const t = _to12h(_spH, _spM);
        t.hour = ((t.hour - 1 + delta + 12) % 12) + 1;
        _spH = _to24h(t.hour, _spM, t.ampm).hour;
      } else {
        _spH = (_spH + delta + 24) % 24;
      }
    } else if (type === 'm') {
      _spM = (_spM + delta + 60) % 60;
    } else if (type === 'a') {
      const t = _to12h(_spH, _spM);
      t.ampm = t.ampm === 'AM' ? 'PM' : 'AM';
      _spH = _to24h(t.hour, _spM, t.ampm).hour;
    }
    _spRefreshDisplay();
  }

  function _spRefreshDisplay() {
    const hEl = $('spHour');
    const mEl = $('spMin');
    const apEl = $('spAmpm');
    if (_spSettings.time_format_12h) {
      const t = _to12h(_spH, _spM);
      if (hEl) hEl.textContent = t.hour;
      if (apEl) apEl.textContent = t.ampm;
    } else {
      if (hEl) hEl.textContent = pad2(_spH);
    }
    if (mEl) mEl.textContent = pad2(_spM);
  }

  function closeSleepModal() {
    const bg = $('sleepModalBg');
    if (bg) { bg.hidden = true; bg.innerHTML = ''; }
    if (_spEscHandler) { document.removeEventListener('keydown', _spEscHandler); _spEscHandler = null; }
  }

  // ---- Insights (Phase 5) ----
  function getExtendedHistory(currentDate, n) {
    const [y, mo, d] = currentDate.split('-').map(Number);
    const result = [];
    for (let i = n - 1; i >= 0; i--) {
      const date = dateToYMD(new Date(y, mo - 1, d - i));
      const day = loadDay(date);
      result.push({ date, day, mood: getMoodToday(date), exercise: getExerciseDoneToday(date) });
    }
    return result;
  }

  function pearson(xs, ys) {
    const n = xs.length;
    if (n < 5) return null;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
    }
    const denom = Math.sqrt(dx2 * dy2);
    return denom < 1e-10 ? null : num / denom;
  }

  function generateInsights(date, settings) {
    const all = getExtendedHistory(date, 30);
    const h14 = all.slice(-14);
    const h7  = all.slice(-7);
    const insights = [];

    // Consistency streak
    const streak = getConsistencyStreak(date);
    if (streak >= 5) {
      insights.push({ type: 'positive', text: `${streak}-day logging streak — great consistency.` });
    }

    // Readiness trend (last 7 days)
    const readinessVals = h7.map(h => calcReadiness(h.date, h.day, settings)).filter(v => v != null);
    if (readinessVals.length >= 4) {
      const half = Math.floor(readinessVals.length / 2);
      const earlyAvg = readinessVals.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const lateAvg  = readinessVals.slice(-half).reduce((a, b) => a + b, 0) / half;
      if (lateAvg - earlyAvg >= 8) {
        insights.push({ type: 'positive', text: 'Readiness is trending up this week — keep it going.' });
      } else if (earlyAvg - lateAvg >= 8) {
        insights.push({ type: 'warn', text: 'Readiness is trending down. Check sleep and recovery.' });
      }
    }

    // Sleep deficit streak (consecutive days at tail of h7)
    let sleepStreak = 0;
    for (let i = h7.length - 1; i >= 0; i--) {
      const v = h7[i].day.sleep_hours;
      if (v != null && v < settings.sleep_goal_hours * 0.875) sleepStreak++;
      else break;
    }
    if (sleepStreak >= 2) {
      insights.push({ type: 'warn', text: `Undersleeping for ${sleepStreak} nights in a row.` });
    }

    // Hydration deficit streak
    let waterStreak = 0;
    for (let i = h7.length - 1; i >= 0; i--) {
      const v = h7[i].day.water_oz || 0;
      if (v > 0 && v < settings.water_goal_oz) waterStreak++;
      else break;
    }
    if (waterStreak >= 2) {
      insights.push({ type: 'warn', text: `Hydration below goal for ${waterStreak} days running.` });
    }

    // Gym → mood comparison (14 days)
    const moodedDays = h14.filter(h => h.mood != null);
    if (moodedDays.length >= 5) {
      const gymDays   = moodedDays.filter(h => h.exercise);
      const noGymDays = moodedDays.filter(h => !h.exercise);
      if (gymDays.length >= 2 && noGymDays.length >= 2) {
        const gymAvg   = gymDays.reduce((s, h)   => s + (MOOD_SCORES[h.mood] ?? 0.5), 0) / gymDays.length;
        const noGymAvg = noGymDays.reduce((s, h) => s + (MOOD_SCORES[h.mood] ?? 0.5), 0) / noGymDays.length;
        if (gymAvg - noGymAvg >= 0.15) {
          insights.push({ type: 'info', text: 'Mood is consistently better on gym days.' });
        } else if (noGymAvg - gymAvg >= 0.15) {
          insights.push({ type: 'info', text: 'Mood tends to be higher on rest days — possible overtraining.' });
        }
      }
    }

    // Protein vs prior week
    const lastWk  = h7.filter(h => h.day.nutrition_totals && h.day.nutrition_totals.protein_g > 0);
    const priorWk = all.slice(-14, -7).filter(h => h.day.nutrition_totals && h.day.nutrition_totals.protein_g > 0);
    if (lastWk.length >= 3 && priorWk.length >= 3) {
      const lastP  = lastWk.reduce((s, h)  => s + h.day.nutrition_totals.protein_g, 0) / lastWk.length;
      const priorP = priorWk.reduce((s, h) => s + h.day.nutrition_totals.protein_g, 0) / priorWk.length;
      const pct = (lastP - priorP) / priorP * 100;
      if (pct >= 15) {
        insights.push({ type: 'positive', text: `Protein up ${Math.round(pct)}% vs last week (avg ${Math.round(lastP)}g/day).` });
      } else if (pct <= -15) {
        insights.push({ type: 'warn', text: `Protein down ${Math.round(Math.abs(pct))}% vs last week (avg ${Math.round(lastP)}g/day).` });
      }
    }

    return insights.slice(0, 6);
  }

  function renderInsights(date, settings) {
    const el = $('hiCard');
    if (!el) return;

    const insights = generateInsights(date, settings);
    if (insights.length === 0) {
      el.innerHTML = '<div class="hi-empty">Keep logging — personalized insights appear after a few days of data.</div>';
      return;
    }

    const iconMap = { positive: '↑', warn: '▲', info: '◆' };
    el.innerHTML = `<div class="hi-list">${
      insights.map(ins => `<div class="hi-item hi-${ins.type}">
        <span class="hi-icon">${iconMap[ins.type]}</span>
        <span class="hi-text">${ins.text}</span>
      </div>`).join('')
    }</div>`;
  }

  // ---- Trends (Phase 4) ----
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function getHistory(currentDate, n) {
    const [y, mo, d] = currentDate.split('-').map(Number);
    const result = [];
    for (let i = n - 1; i >= 0; i--) {
      const date = dateToYMD(new Date(y, mo - 1, d - i));
      result.push({ date, day: loadDay(date) });
    }
    return result;
  }

  function htLinePath(pts) {
    if (pts.length === 0) return '';
    let p = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const cpX = (pts[i-1][0] + pts[i][0]) / 2;
      p += ` C${cpX},${pts[i-1][1]},${cpX},${pts[i][1]},${pts[i][0]},${pts[i][1]}`;
    }
    return p;
  }

  function htSegments(pointX, yVals) {
    const segs = [];
    let seg = [];
    yVals.forEach((v, i) => {
      if (v != null) { seg.push([pointX[i], v]); }
      else if (seg.length) { segs.push(seg); seg = []; }
    });
    if (seg.length) segs.push(seg);
    return segs;
  }

  function htDayLabel(date) {
    const [y, mo, d] = date.split('-').map(Number);
    return DAY_SHORT[new Date(y, mo - 1, d).getDay()];
  }

  function buildReadinessChart(history, settings) {
    const W = 480, H = 130;
    const padL = 8, padR = 8, padT = 16, padB = 22;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = history.length;
    const pointX = history.map((_, i) => padL + (n > 1 ? i / (n - 1) : 0.5) * plotW);
    function yScale(v) { return padT + plotH - (v / 100) * plotH; }

    const readinessVals = history.map(h => calcReadiness(h.date, h.day, settings));
    let html = `<svg viewBox="0 0 ${W} ${H}" class="htrend-svg" aria-hidden="true">`;

    // Zone bands
    const y80 = yScale(80), y60 = yScale(60);
    html += `<rect x="${padL}" y="${padT}" width="${plotW}" height="${(y60 - padT).toFixed(1)}" fill="rgba(255,107,107,0.06)"/>`;
    html += `<rect x="${padL}" y="${y60.toFixed(1)}" width="${plotW}" height="${(y80 - y60).toFixed(1)}" fill="rgba(242,192,99,0.06)"/>`;
    html += `<rect x="${padL}" y="${y80.toFixed(1)}" width="${plotW}" height="${(padT + plotH - y80).toFixed(1)}" fill="rgba(107,227,164,0.06)"/>`;

    // Zone boundary lines
    html += `<line x1="${padL}" y1="${y60.toFixed(1)}" x2="${W-padR}" y2="${y60.toFixed(1)}" stroke="rgba(242,192,99,0.25)" stroke-width="1" stroke-dasharray="3,3"/>`;
    html += `<line x1="${padL}" y1="${y80.toFixed(1)}" x2="${W-padR}" y2="${y80.toFixed(1)}" stroke="rgba(107,227,164,0.25)" stroke-width="1" stroke-dasharray="3,3"/>`;

    // Readiness line
    const yVals = readinessVals.map(v => v != null ? yScale(v) : null);
    htSegments(pointX, yVals).forEach(seg => {
      if (seg.length >= 2) html += `<path d="${htLinePath(seg)}" class="htrend-line-readiness"/>`;
    });

    // Dots + value labels
    readinessVals.forEach((v, i) => {
      if (v == null) return;
      const color = v >= 80 ? 'var(--success, #5fd687)' : v >= 60 ? 'var(--amber, #F2C063)' : 'var(--danger, #ff6b6b)';
      const cy = yScale(v);
      html += `<circle cx="${pointX[i]}" cy="${cy}" r="4" fill="${color}" stroke="rgba(0,0,0,0.6)" stroke-width="1.5"/>`;
      html += `<text x="${pointX[i]}" y="${cy - 8}" class="htrend-dot-val">${v}</text>`;
    });

    // Day labels
    history.forEach((h, i) => {
      html += `<text x="${pointX[i]}" y="${H - 4}" class="htrend-axis-label">${htDayLabel(h.date)}</text>`;
    });

    html += '</svg>';
    return html;
  }

  function buildSleepEnergyChart(history, settings) {
    const W = 240, H = 120;
    const padL = 8, padR = 8, padT = 12, padB = 22;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = history.length;
    const groupW = plotW / n;
    const barW = Math.max(4, Math.floor(groupW * 0.5));
    const pointX = history.map((_, i) => padL + groupW * i + groupW / 2);
    const maxSleep = Math.max(12, settings.sleep_goal_hours * 1.25);
    function ySleep(v) { return padT + plotH - Math.min(v / maxSleep, 1) * plotH; }

    let html = `<svg viewBox="0 0 ${W} ${H}" class="htrend-svg" aria-hidden="true">`;

    // Sleep goal dashed line
    const goalY = ySleep(settings.sleep_goal_hours);
    html += `<line x1="${padL}" y1="${goalY.toFixed(1)}" x2="${W-padR}" y2="${goalY.toFixed(1)}" stroke="rgba(255,255,255,0.18)" stroke-width="1" stroke-dasharray="3,2"/>`;

    // Sleep bars
    history.forEach((h, i) => {
      const v = h.day.sleep_hours;
      if (v == null) return;
      const top = ySleep(v);
      const barH = Math.max(2, (padT + plotH) - top);
      const color = v >= settings.sleep_goal_hours * 0.875 ? 'rgba(107,227,164,0.65)' : 'rgba(255,107,107,0.55)';
      html += `<rect x="${(pointX[i] - barW/2).toFixed(1)}" y="${top.toFixed(1)}" width="${barW}" height="${barH.toFixed(1)}" rx="2" fill="${color}"/>`;
    });

    // Day labels
    history.forEach((h, i) => {
      html += `<text x="${pointX[i]}" y="${H - 4}" class="htrend-axis-label">${htDayLabel(h.date)}</text>`;
    });

    html += '</svg>';
    return html;
  }

  function buildHydrationChart(history, settings) {
    const W = 240, H = 120;
    const padL = 8, padR = 8, padT = 12, padB = 22;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = history.length;
    const groupW = plotW / n;
    const barW = Math.max(4, Math.floor(groupW * 0.5));
    const pointX = history.map((_, i) => padL + groupW * i + groupW / 2);
    const maxWater = settings.water_goal_oz * 1.3;
    function yWater(v) { return padT + plotH - Math.min(v / maxWater, 1) * plotH; }

    let html = `<svg viewBox="0 0 ${W} ${H}" class="htrend-svg" aria-hidden="true">`;

    // Goal line
    const goalY = yWater(settings.water_goal_oz);
    html += `<line x1="${padL}" y1="${goalY.toFixed(1)}" x2="${W-padR}" y2="${goalY.toFixed(1)}" stroke="rgba(255,255,255,0.18)" stroke-width="1" stroke-dasharray="3,2"/>`;

    // Water bars
    history.forEach((h, i) => {
      const v = h.day.water_oz || 0;
      if (v === 0) return;
      const top = yWater(v);
      const barH = Math.max(2, (padT + plotH) - top);
      const color = v >= settings.water_goal_oz ? 'rgba(162,210,255,0.80)' : 'rgba(162,210,255,0.38)';
      html += `<rect x="${(pointX[i] - barW/2).toFixed(1)}" y="${top.toFixed(1)}" width="${barW}" height="${barH.toFixed(1)}" rx="2" fill="${color}"/>`;
    });

    // Day labels
    history.forEach((h, i) => {
      html += `<text x="${pointX[i]}" y="${H - 4}" class="htrend-axis-label">${htDayLabel(h.date)}</text>`;
    });

    html += '</svg>';
    return html;
  }

  function renderTrends(date, settings) {
    const el = $('htrendCard');
    if (!el) return;

    const history = getHistory(date, 7);
    const hasAnyData = history.some(h => Object.keys(h.day).length > 0);

    if (!hasAnyData) {
      el.innerHTML = '<div class="htrend-empty">Log a few days of health data to see trends.</div>';
      return;
    }

    el.innerHTML = `
      <div class="htrend-section">
        <div class="htrend-chart-label">Readiness (7 days)</div>
        ${buildReadinessChart(history, settings)}
      </div>
      <div class="htrend-row2">
        <div class="htrend-section">
          <div class="htrend-chart-label">Sleep &amp; Energy</div>
          ${buildSleepEnergyChart(history, settings)}
        </div>
        <div class="htrend-section">
          <div class="htrend-chart-label">Hydration</div>
          ${buildHydrationChart(history, settings)}
        </div>
      </div>`;
  }

  // ---- Nutrition ----
  function renderNutrition(date, day, settings) {
    const el = $('ntCard');
    if (!el) return;

    const meals = day.meals || [];
    const totals = day.nutrition_totals || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    const recentMeals = getRecentMeals(date);

    function macroBar(label, val, goal, unit, color) {
      const pct = goal > 0 ? Math.min(val / goal * 100, 100) : 0;
      return `<div class="nt-macro-row">
        <span class="nt-macro-label">${label}</span>
        <div class="nt-macro-bar"><div class="nt-macro-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
        <span class="nt-macro-val">${val}<span class="nt-macro-goal">/${goal}${unit}</span></span>
      </div>`;
    }

    const GROUPS = ['breakfast', 'lunch', 'dinner', 'snacks'];
    const grouped = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    meals.forEach((m, i) => {
      grouped[GROUPS.includes(m.group) ? m.group : 'snacks'].push({ ...m, _i: i });
    });

    const mealListHtml = meals.length === 0
      ? '<div class="nt-empty">No meals logged yet.</div>'
      : GROUPS.filter(g => grouped[g].length > 0).map(g =>
          `<div class="nt-group">
            <div class="nt-group-label">${g.charAt(0).toUpperCase() + g.slice(1)}</div>
            ${grouped[g].map(m =>
              `<div class="nt-meal-row">
                <span class="nt-meal-time">${escHtml(m.time || '')}</span>
                <span class="nt-meal-name">${escHtml(m.name)}</span>
                <span class="nt-meal-cals">${m.calories || 0} cal</span>
                <button type="button" class="nt-meal-edit" data-edit="${m._i}" aria-label="Edit">✎</button>
                <button type="button" class="nt-meal-del" data-del="${m._i}" aria-label="Remove">×</button>
              </div>`).join('')}
          </div>`).join('');

    const recentHtml = recentMeals.length > 0
      ? `<div class="nt-recent-head">Quick Add</div>
         <div class="nt-recent-list">
           ${recentMeals.map((m, i) =>
             `<button type="button" class="nt-recent-btn" data-recent="${i}">
               <span class="nt-recent-name">${escHtml(m.name)}</span>
               <span class="nt-recent-cal">${m.calories || 0} cal</span>
             </button>`).join('')}
         </div>`
      : '';

    el.innerHTML = `
      <div class="nt-macros">
        ${macroBar('Calories', totals.calories  || 0, settings.calorie_goal,   '',  'var(--amber, #F2C063)')}
        ${macroBar('Carbs',    totals.carbs_g   || 0, settings.carbs_goal_g,   'g', '#A2D2FF')}
        ${macroBar('Fat',      totals.fat_g     || 0, settings.fat_goal_g,     'g', '#FFB5C2')}
        ${macroBar('Protein',  totals.protein_g || 0, settings.protein_goal_g, 'g', 'var(--success, #6BE3A4)')}
      </div>
      <div class="nt-meal-list">${mealListHtml}</div>
      ${recentHtml}
      <button type="button" class="nt-add-btn" id="ntAddBtn">+ Log Meal</button>`;

    const addBtn = $('ntAddBtn');
    if (addBtn) addBtn.addEventListener('click', () => openMealModal(date, day, settings));

    el.querySelectorAll('.nt-meal-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.del, 10);
        day.meals = (day.meals || []).filter((_, i) => i !== idx);
        recalcTotals(day);
        saveDay(date, day);
        window.dispatchEvent(new CustomEvent('nutrition-updated'));
        renderHealth();
      });
    });

    el.querySelectorAll('.nt-meal-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.edit, 10);
        openMealModal(date, day, settings, null, idx);
      });
    });

    el.querySelectorAll('.nt-recent-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = recentMeals[parseInt(btn.dataset.recent, 10)];
        if (m) openMealModal(date, day, settings, m);
      });
    });
  }

  function getRecentMeals(currentDate) {
    const seen = new Set();
    const result = [];
    const [y, mo, d] = currentDate.split('-').map(Number);
    for (let i = 1; i <= 7 && result.length < 6; i++) {
      const past = new Date(y, mo - 1, d - i);
      const dayData = loadDay(dateToYMD(past));
      (dayData.meals || []).forEach(m => {
        if (m.name && !seen.has(m.name.toLowerCase())) {
          seen.add(m.name.toLowerCase());
          result.push(m);
        }
      });
    }
    return result;
  }

  function recalcTotals(day) {
    const meals = day.meals || [];
    day.nutrition_totals = {
      calories:  meals.reduce((s, m) => s + (m.calories  || 0), 0),
      carbs_g:   meals.reduce((s, m) => s + (m.carbs_g   || 0), 0),
      fat_g:     meals.reduce((s, m) => s + (m.fat_g     || 0), 0),
      protein_g: meals.reduce((s, m) => s + (m.protein_g || 0), 0),
    };
  }

  // ---- Meal modal ----
  let _escHandler = null;

  function openMealModal(date, day, settings, prefill, editIndex) {
    const bg = $('ntModalBg');
    if (!bg) return;

    const editing = editIndex != null && day.meals && day.meals[editIndex];
    const src = editing ? day.meals[editIndex] : prefill;

    const GROUPS = ['breakfast', 'lunch', 'dinner', 'snacks'];
    const now = new Date();
    const defaultTime = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    const h = now.getHours();
    const defaultGroup = h < 10 ? 'breakfast' : h < 13 ? 'lunch' : h < 17 ? 'dinner' : 'snacks';
    const selGroup = src ? (src.group || defaultGroup) : defaultGroup;

    bg.innerHTML = `<div class="nt-modal glass">
      <div class="nt-modal-title">${editing ? 'Edit Meal' : prefill ? 'Quick Add' : 'Log Meal'}</div>
      <div class="nt-modal-body">
        <div class="nt-form-row">
          <label class="nt-form-label" for="ntfName">Name</label>
          <input type="text" class="nt-form-input" id="ntfName"
            value="${src ? escHtml(src.name) : ''}" placeholder="e.g. Oatmeal + banana" autocomplete="off">
        </div>
        <div class="nt-form-2col">
          <div class="nt-form-row">
            <label class="nt-form-label" for="ntfTime">Time</label>
            <input type="time" class="nt-form-input" id="ntfTime"
              value="${src ? (src.time || defaultTime) : defaultTime}">
          </div>
          <div class="nt-form-row">
            <label class="nt-form-label" for="ntfGroup">Meal</label>
            <select class="nt-form-select" id="ntfGroup">
              ${GROUPS.map(g =>
                `<option value="${g}"${g === selGroup ? ' selected' : ''}>${g.charAt(0).toUpperCase() + g.slice(1)}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="nt-form-4col">
          <div class="nt-form-row">
            <label class="nt-form-label" for="ntfCal">Calories</label>
            <input type="number" class="nt-form-input" id="ntfCal" min="0"
              value="${src ? (src.calories || '') : ''}" placeholder="0">
          </div>
          <div class="nt-form-row">
            <label class="nt-form-label" for="ntfCarbs">Carbs g</label>
            <input type="number" class="nt-form-input" id="ntfCarbs" min="0" step="0.1"
              value="${src ? (src.carbs_g || '') : ''}" placeholder="0">
          </div>
          <div class="nt-form-row">
            <label class="nt-form-label" for="ntfFat">Fat g</label>
            <input type="number" class="nt-form-input" id="ntfFat" min="0" step="0.1"
              value="${src ? (src.fat_g || '') : ''}" placeholder="0">
          </div>
          <div class="nt-form-row">
            <label class="nt-form-label" for="ntfProt">Protein g</label>
            <input type="number" class="nt-form-input" id="ntfProt" min="0" step="0.1"
              value="${src ? (src.protein_g || '') : ''}" placeholder="0">
          </div>
        </div>
      </div>
      <div class="nt-modal-foot">
        <button type="button" class="nt-modal-cancel" id="ntfCancel">Cancel</button>
        <button type="button" class="nt-modal-save" id="ntfSave">Save</button>
      </div>
    </div>`;

    bg.hidden = false;
    setTimeout(() => { const n = $('ntfName'); if (n) n.focus(); }, 50);

    $('ntfCancel').addEventListener('click', closeMealModal);
    bg.addEventListener('click', e => { if (e.target === bg) closeMealModal(); });

    $('ntfSave').addEventListener('click', () => {
      const name = ($('ntfName').value || '').trim();
      if (!name) { $('ntfName').focus(); return; }
      const meal = {
        time:      $('ntfTime').value,
        group:     $('ntfGroup').value,
        name,
        calories:  parseInt($('ntfCal').value,    10) || 0,
        carbs_g:   parseFloat($('ntfCarbs').value) || 0,
        fat_g:     parseFloat($('ntfFat').value)   || 0,
        protein_g: parseFloat($('ntfProt').value)  || 0,
      };
      if (!day.meals) day.meals = [];
      if (editing) { day.meals[editIndex] = meal; } else { day.meals.push(meal); }
      recalcTotals(day);
      saveDay(date, day);
      window.dispatchEvent(new CustomEvent('nutrition-updated'));
      closeMealModal();
      renderHealth();
    });

    if (_escHandler) document.removeEventListener('keydown', _escHandler);
    _escHandler = e => { if (e.key === 'Escape') closeMealModal(); };
    document.addEventListener('keydown', _escHandler);
  }

  function closeMealModal() {
    const bg = $('ntModalBg');
    if (bg) { bg.hidden = true; bg.innerHTML = ''; }
    if (_escHandler) { document.removeEventListener('keydown', _escHandler); _escHandler = null; }
  }

  // ---- Settings modal ----
  let _hsEscHandler = null;

  function openSettingsModal() {
    const bg = $('hlSettingsModalBg');
    if (!bg) return;

    const settings = getSettings();
    const fields = [
      { key: 'water_goal_oz',    label: 'Water (oz)',    min: 0 },
      { key: 'sleep_goal_hours', label: 'Sleep (hrs)',   min: 0, step: 0.5 },
      { key: 'calorie_goal',     label: 'Calories',      min: 0 },
      { key: 'carbs_goal_g',     label: 'Carbs (g)',     min: 0 },
      { key: 'fat_goal_g',       label: 'Fat (g)',       min: 0 },
      { key: 'protein_goal_g',   label: 'Protein (g)',   min: 0 },
      { key: 'focus_goal_min',   label: 'Focus (min)',   min: 0 },
    ];

    bg.innerHTML = `<div class="setup-modal">
      <div class="setup-header">
        <span class="setup-wordmark">Health Goals</span>
        <p class="setup-sub">Adjust your daily health targets.</p>
      </div>
      <div class="hl-settings-modal-grid">
        ${fields.map(f => `
          <div class="setup-field">
            <label class="setup-label">${f.label}</label>
            <input type="number" class="setup-input hl-settings-mono-input" data-key="${f.key}"
              value="${settings[f.key]}" min="${f.min}"${f.step ? ` step="${f.step}"` : ''}>
          </div>`).join('')}
      </div>
      <div class="setup-actions" style="justify-content:flex-end">
        <button type="button" class="setup-skip" id="hlSettingsCancel">Cancel</button>
        <button type="button" class="setup-save" id="hlSettingsSave">Done</button>
      </div>
    </div>`;

    bg.hidden = false;

    bg.querySelectorAll('.hl-settings-mono-input').forEach(input => {
      input.addEventListener('change', () => {
        const s = getSettings();
        s[input.dataset.key] = parseFloat(input.value) || 0;
        localStorage.setItem('health_settings', JSON.stringify(s));
        renderHealth();
      });
    });

    $('hlSettingsCancel').addEventListener('click', closeSettingsModal);
    $('hlSettingsSave').addEventListener('click', closeSettingsModal);

    bg.addEventListener('click', e => { if (e.target === bg) closeSettingsModal(); });

    if (_hsEscHandler) document.removeEventListener('keydown', _hsEscHandler);
    _hsEscHandler = e => { if (e.key === 'Escape') closeSettingsModal(); };
    document.addEventListener('keydown', _hsEscHandler);
  }

  function closeSettingsModal() {
    const bg = $('hlSettingsModalBg');
    if (bg) { bg.hidden = true; bg.innerHTML = ''; }
    if (_hsEscHandler) { document.removeEventListener('keydown', _hsEscHandler); _hsEscHandler = null; }
  }

  function initSettings() {
    const toggle = $('hlSettingsToggle');
    if (!toggle) return;
    toggle.addEventListener('click', openSettingsModal);
  }

  // ---- Date nav ----
  function renderDateNav() {
    const viewDate = _resolveViewDate();
    const today = getActiveDate();
    const displayEl = $('hlDateDisplay');
    const pickerEl = $('hlDatePicker');
    const nextBtn = $('hlDateNext');
    if (!displayEl) return;
    if (viewDate === today) {
      displayEl.textContent = 'Today';
    } else {
      const d = new Date(viewDate + 'T00:00:00');
      displayEl.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    if (pickerEl) pickerEl.value = viewDate;
    if (nextBtn) nextBtn.disabled = viewDate >= today;
  }

  function initDateNav() {
    const prev = $('hlDatePrev');
    const next = $('hlDateNext');
    const picker = $('hlDatePicker');
    const todayBtn = $('hlDateToday');
    if (!prev) return;

    prev.addEventListener('click', () => {
      const d = new Date(_resolveViewDate() + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      _setViewDate(dateToYMD(d));
      renderHealth();
    });

    next.addEventListener('click', () => {
      const d = new Date(_resolveViewDate() + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      const newDate = dateToYMD(d);
      if (newDate <= getActiveDate()) { _setViewDate(newDate); renderHealth(); }
    });

    picker.addEventListener('input', () => {
      if (picker.value && picker.value <= getActiveDate()) {
        _setViewDate(picker.value);
        renderHealth();
      }
    });

    todayBtn.addEventListener('click', () => {
      _setViewDate(null);
      renderHealth();
    });
  }

  // ---- Main render ----
  function renderHealth() {
    const date = _resolveViewDate();
    const day = loadDay(date);
    const settings = getSettings();
    renderDateNav();
    renderSnapshot(date, day, settings);
    renderLog(date, day, settings);
    renderNutrition(date, day, settings);
    renderTrends(date, settings);
    renderInsights(date, settings);
  }

  // ---- Export / Import ----
  function exportHealthData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('health:') || key === 'health_settings') {
        try { data[key] = JSON.parse(localStorage.getItem(key)); }
        catch (e) { data[key] = localStorage.getItem(key); }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'health-export-' + getActiveDate() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importHealthData(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid');
        let count = 0;
        Object.entries(data).forEach(([key, val]) => {
          if (key.startsWith('health:') || key === 'health_settings') {
            localStorage.setItem(key, JSON.stringify(val));
            count++;
          }
        });
        renderHealth();
        if (window.showAlert) window.showAlert(count + ' entries imported.');
        else alert(count + ' entries imported.');
      } catch (err) {
        if (window.showAlert) window.showAlert('Import failed: invalid JSON file.');
        else alert('Import failed: invalid JSON file.');
      }
    };
    reader.readAsText(file);
  }

  function initExportImport() {
    const exportBtn = $('hlExportBtn');
    const importFile = $('hlImportFile');
    if (exportBtn) exportBtn.addEventListener('click', exportHealthData);
    if (importFile) importFile.addEventListener('change', () => {
      if (importFile.files[0]) { importHealthData(importFile.files[0]); importFile.value = ''; }
    });
  }

  window.renderHealth = renderHealth;
  window.calcReadiness = calcReadiness;
  window.getSettings = getSettings;
  window.renderStatsPanel && window.renderStatsPanel();

  document.addEventListener('DOMContentLoaded', () => { initDateNav(); initSettings(); initExportImport(); });
})();
