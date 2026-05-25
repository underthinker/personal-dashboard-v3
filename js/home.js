/* ═══ HOME TAB WIDGETS ═══
   Extracted from index.html inline script. Loaded last so it can call into
   render* helpers exported by goals/habits/health. */
(function(){
  const $ = id => document.getElementById(id);

  /* ─── Timeline (editable, persisted) ─── */
  const TIMELINE_KEY = 'timeline_blocks_v1';
  const DEFAULT_BLOCKS = [
    { t: '6:00',  label: 'Morning routine', sub: 'Wake up, stretch, coffee' },
    { t: '7:00',  label: 'Deep work',       sub: 'Focus session' },
    { t: '9:00',  label: 'Team sync',       sub: 'Standup' },
    { t: '10:00', label: 'Project work',    sub: 'Main task block' },
    { t: '12:00', label: 'Lunch',           sub: 'Break' },
    { t: '13:00', label: 'Deep work II',    sub: 'Second session' },
    { t: '15:00', label: 'Admin',           sub: 'Email, planning' },
    { t: '17:00', label: 'Wind down',       sub: 'Review, plan tomorrow' },
  ];

  function parseBlockTime(t) {
    const parts = String(t).split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  }
  function normalizeTime(t) {
    const parts = String(t).split(':');
    const h = Math.max(0, Math.min(23, parseInt(parts[0], 10) || 0));
    const m = Math.max(0, Math.min(59, parseInt(parts[1], 10) || 0));
    return h + ':' + (m < 10 ? '0' + m : m);
  }
  function getTimelineBlocks() {
    try {
      const raw = localStorage.getItem(TIMELINE_KEY);
      if (raw == null) return DEFAULT_BLOCKS.slice();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : DEFAULT_BLOCKS.slice();
    } catch(e) { return DEFAULT_BLOCKS.slice(); }
  }
  function saveTimelineBlocks(blocks) {
    blocks.sort((a, b) => parseBlockTime(a.t) - parseBlockTime(b.t));
    localStorage.setItem(TIMELINE_KEY, JSON.stringify(blocks));
  }

  function renderTimeline() {
    const el = $('timelineWidget');
    if (!el) return;
    const esc = window.escHtml;
    const blocks = getTimelineBlocks().slice().sort((a, b) => parseBlockTime(a.t) - parseBlockTime(b.t));
    const nowMin = (new Date()).getHours() * 60 + (new Date()).getMinutes();
    let activeIdx = -1;
    for (let i = 0; i < blocks.length; i++) {
      if (parseBlockTime(blocks[i].t) <= nowMin) activeIdx = i;
    }
    el.innerHTML = blocks.map((b, i) => {
      const active = i === activeIdx;
      return '<div class="tl-row' + (active ? ' tl-row-active' : '') + '">' +
        '<div class="tl-time' + (active ? ' active' : '') + '">' + esc(b.t) + '</div>' +
        '<div class="tl-dot-col"><div class="tl-line"></div><div class="tl-dot' + (active ? ' active' : '') + '"></div></div>' +
        '<div class="tl-content' + (active ? ' active' : '') + '"><div class="tl-title">' + esc(b.label) + '</div>' +
        (b.sub ? '<div class="tl-sub">' + esc(b.sub) + '</div>' : '') +
        '</div>' +
        '<button class="tl-del-btn" data-tl-del="' + i + '" aria-label="Delete">×</button>' +
        '</div>';
    }).join('');
    const activeRow = el.querySelector('.tl-row-active');
    if (activeRow) el.scrollTop = activeRow.offsetTop - el.clientHeight / 2 + activeRow.offsetHeight / 2;
  }

  function openTimelineAddForm() {
    const el = $('timelineWidget');
    if (!el) return;
    el.innerHTML =
      '<form class="tl-form" id="tlAddForm">' +
        '<input id="tlTime"  type="text" placeholder="Time (e.g. 9:30)" autocomplete="off" required>' +
        '<input id="tlLabel" type="text" placeholder="Title" autocomplete="off" required>' +
        '<input id="tlSub"   type="text" placeholder="Subtitle (optional)" autocomplete="off">' +
        '<div class="tl-form-row">' +
          '<button type="button" class="tl-form-cancel" id="tlCancel">Cancel</button>' +
          '<button type="submit" class="tl-form-save">Add</button>' +
        '</div>' +
      '</form>';
    const timeInput = $('tlTime');
    if (timeInput) timeInput.focus();
    $('tlCancel').addEventListener('click', renderTimeline);
    $('tlAddForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const t = normalizeTime($('tlTime').value.trim());
      const label = $('tlLabel').value.trim();
      const sub = $('tlSub').value.trim();
      if (!label) return;
      const blocks = getTimelineBlocks();
      blocks.push({ t: t, label: label, sub: sub });
      saveTimelineBlocks(blocks);
      renderTimeline();
    });
  }

  function deleteTimelineBlock(idx) {
    const blocks = getTimelineBlocks();
    if (idx < 0 || idx >= blocks.length) return;
    blocks.splice(idx, 1);
    saveTimelineBlocks(blocks);
    renderTimeline();
  }

  /* Delegated click handler for delete buttons */
  document.addEventListener('click', function(e) {
    const t = e.target;
    if (t && t.matches && t.matches('[data-tl-del]')) {
      e.stopPropagation();
      deleteTimelineBlock(parseInt(t.getAttribute('data-tl-del'), 10));
    }
  });

  const addBtn = $('timelineAddBtn');
  if (addBtn) addBtn.addEventListener('click', openTimelineAddForm);

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
