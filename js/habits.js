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
  function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
  function getMonthName(m) { return ['January','February','March','April','May','June','July','August','September','October','November','December'][m]; }
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
    { id: 'sleep', name: 'Sleep 7-8 hours', emoji: '💤', active: true },
    { id: 'hygiene', name: 'Personal Hygiene', emoji: '🧼', active: true },
    { id: 'healthy_meals', name: 'Eat healthy meals', emoji: '🥗', active: true },
    { id: 'go_outside', name: 'Go outside', emoji: '☀', active: true },
    { id: 'no_fap', name: 'No fap', emoji: '🚫', active: true },
    { id: 'water', name: 'Drink 64 oz. water', emoji: '💧', active: true },
    { id: 'no_alcohol', name: 'No Alcohol', emoji: '🍺', active: true },
    { id: 'exercise', name: 'Exercise', emoji: '🏋🏻‍♀️', active: true },
    { id: 'productive', name: 'Productive Tasks', emoji: '🧹', active: true },
    { id: 'creativity', name: 'Creativity', emoji: '🖋️', active: true },
  ];

  function generateId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  function getDefinitions() {
    let defs = storeGet('habit_definitions');
    if (!defs || !defs.length) {
      defs = DEFAULT_HABITS;
      storeSet('habit_definitions', defs);
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
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#60a5fa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.409 13.017A5 5 0 0 1 22 15c0 3.866-4 7-9 7-4.077 0-8.153-.82-10.371-2.462-.426-.316-.631-.832-.62-1.362C2.118 12.723 2.627 2 10 2a3 3 0 0 1 3 3 2 2 0 0 1-2 2c-1.105 0-1.64-.444-2-1"/><path d="M15 14a5 5 0 0 0-7.584 2"/><path d="M9.964 6.825C8.019 7.977 9.5 13 8 15"/></svg>'
  ];

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
  let moodMonthDate = new Date();
  let emojiPickerCallback = null;
  let lastFocus = null;
  let editorDate = null;

  // ============================================================
  // HABIT TRACKER
  // ============================================================

  function renderWeekView() {
    const monday = getMonday();
    const defs = getDefinitions().filter((d) => d.active);
    const today = todayYMD();

    const hdrEl = $('htWeekHdr');
    if (hdrEl) {
      hdrEl.innerHTML = '';
      const blank = document.createElement('div');
      hdrEl.appendChild(blank);
      for (let d = 0; d < 7; d++) {
        const day = new Date(monday);
        day.setDate(day.getDate() + d);
        const div = document.createElement('div');
        div.textContent = getDayName(day.getDay()) + ' ' + (day.getMonth()+1) + '/' + day.getDate();
        if (dateToYMD(day) === today) div.className = 'ht-week-hdr-today';
        hdrEl.appendChild(div);
      }
    }

    const bodyEl = $('htWeekBody');
    if (bodyEl) {
      bodyEl.innerHTML = '';

      defs.forEach(function(def, idx) {
        const row = document.createElement('div');
        row.className = 'ht-week-row';
        row.style.setProperty('--i', idx);

        const name = document.createElement('div');
        name.className = 'ht-week-name';
        name.textContent = def.emoji + ' ' + def.name;
        row.appendChild(name);

        for (let d = 0; d < 7; d++) {
          const day = new Date(monday);
          day.setDate(day.getDate() + d);
          const ymd = dateToYMD(day);
          const cell = document.createElement('div');
          cell.className = 'ht-week-cell';

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'ht-week-cb';
          const dayData = getDayData(ymd);
          cb.checked = !!(dayData && dayData.entries[def.id]);
          if (ymd === today) cb.classList.add('ht-today-marker');

          cb.addEventListener('change', () => {
            const cur = getDayData(ymd) || { entries: {}, notes: '' };
            cur.entries[def.id] = cb.checked;
            setDayData(ymd, cur);
          });

          cell.appendChild(cb);
          row.appendChild(cell);
        }

        bodyEl.appendChild(row);
      });

    }

    // Notes input
    const notesEl = $('htTodayNotes');
    if (notesEl) {
      const data = getDayData(today) || { entries: {}, notes: '' };
      notesEl.value = data.notes || '';
      notesEl.oninput = () => {
        const cur = getDayData(today) || { entries: {}, notes: '' };
        cur.notes = notesEl.value;
        setDayData(today, cur);
      };
    }
  }

  function renderHabitsView() {
    renderWeekView();
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
      emojiBtn.textContent = def.emoji || '💤';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'ht-set-in';
      nameInput.value = def.name;

      const togBtn = document.createElement('button');
      togBtn.className = 'ht-set-tog' + (def.active !== false ? ' is-on' : '');

      const delBtn = document.createElement('button');
      delBtn.className = 'ht-set-del';
      delBtn.textContent = '×';

      emojiBtn.addEventListener('click', () => {
        lastFocus = document.activeElement;
        emojiPickerCallback = (emoji) => {
          def.emoji = emoji;
          defs[idx] = def;
          setDefinitions(defs);
          renderSettings();
          renderHabitsView();
        };
        $('htEpBg').classList.add('show');
        renderEmojiPicker(def.emoji || '💤');
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

    defs.push({ id, name, emoji: emojiBtn.textContent || '💤', active: true });
    setDefinitions(defs);
    nameInput.value = '';
    renderSettings();
    renderHabitsView();
  }

  // ----------- Emoji Picker -----------
  const EMOJI_LIST = ['💤', '🧼', '🥗', '☀️', '🚫', '💧', '🍺', '🏋️‍♀️', '🧹', '🖋️', '🏃', '📖', '🧘', '💪', '🎯', '✅', '🍎', '🥑', '🏄', '🚴', '⚽', '🎨', '🎵', '📝', '💻', '🌿', '🌅', '😴', '❤️', '🔥', '⭐', '🎭', '✍️', '📚', '🥦', '🍳', '🎸', '🎮', '🏆', '🌟', '🐾', '🍵', '🧠', '💡', '🌈', '🎪', '🧑‍🤝‍🧑', '📱'];

  function renderEmojiPicker(currentEmoji) {
    const grid = $('htEpGrid');
    if (!grid) return;
    grid.innerHTML = '';
    EMOJI_LIST.forEach((em) => {
      const btn = document.createElement('button');
      btn.className = 'ht-ep-cell';
      btn.textContent = em;
      btn.addEventListener('click', () => {
        if (emojiPickerCallback) emojiPickerCallback(em);
        $('htEpBg').classList.remove('show');
        emojiPickerCallback = null;
      });
      grid.appendChild(btn);
    });
  }

  function closeEmojiPicker() {
    $('htEpBg').classList.remove('show');
    emojiPickerCallback = null;
    if (lastFocus) { lastFocus.focus(); lastFocus = null; }
  }

  // ============================================================
  // MOOD TRACKER
  // ============================================================

  function renderMoodCalendar() {
    const year = moodMonthDate.getFullYear();
    const month = moodMonthDate.getMonth();
    const today = todayYMD();
    const daysInMonth = getDaysInMonth(year, month);

    const titleEl = $('mtCalTitle');
    if (titleEl) titleEl.textContent = getMonthName(month) + ' ' + year;

    const hdrEl = $('mtCalHdr');
    if (hdrEl) {
      hdrEl.innerHTML = '';
      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach((day) => {
        const d = document.createElement('div');
        d.textContent = day;
        hdrEl.appendChild(d);
      });
    }

    const gridEl = $('mtGrid');
    if (gridEl) {
      gridEl.innerHTML = '';

      const firstDay = new Date(year, month, 1).getDay();
      const offset = firstDay === 0 ? 6 : firstDay - 1;

      for (let i = 0; i < offset; i++) {
        const spacer = document.createElement('div');
        spacer.className = 'mt-gcell mt-gcell-empty';
        gridEl.appendChild(spacer);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const ymd = dateToYMD(date);
        const cell = document.createElement('div');
        cell.className = 'mt-gcell';
        cell.style.setProperty('--i', day);
        if (ymd === today) cell.classList.add('mt-gcell-today');

        const mood = getMood(ymd);
        const moodDef = mood ? getMoodDef(mood) : null;

        if (moodDef) {
          cell.style.background = moodDef.color + '88';
          cell.style.borderColor = moodDef.color;

          const numEl = document.createElement('span');
          numEl.className = 'mt-gcell-num';
          numEl.textContent = day;
          numEl.style.color = 'white';
          cell.appendChild(numEl);
        } else {
          cell.classList.add('mt-gcell-empty');
          const numEl = document.createElement('span');
          numEl.className = 'mt-gcell-num';
          numEl.textContent = day;
          cell.appendChild(numEl);
        }

        // Habit completion dot
        const habitDefs = getDefinitions().filter((d) => d.active);
        const hDayData = getDayData(ymd);
        let hDone = 0;
        habitDefs.forEach((def) => {
          if (hDayData && hDayData.entries[def.id]) hDone++;
        });
        const pct = habitDefs.length ? Math.round((hDone / habitDefs.length) * 100) : 0;
        if (pct > 0) {
          const dot = document.createElement('span');
          const cls = pct >= 80 ? 'ht-mdot-green' : pct >= 40 ? 'ht-mdot-amber' : 'ht-mdot-red';
          dot.className = 'ht-mdot ' + cls;
          cell.appendChild(dot);
        }

        cell.addEventListener('click', () => openDayEditor(ymd));

        gridEl.appendChild(cell);
      }

    }

    const legendEl = $('mtLeg');
    if (legendEl) {
      legendEl.innerHTML = '';

      const green = document.createElement('div');
      green.className = 'mt-leg-item';
      const gDot = document.createElement('span');
      gDot.className = 'mt-leg-dot';
      gDot.style.background = '#6BE3A4';
      const gLb = document.createElement('span');
      gLb.textContent = '80-100% habits';
      green.appendChild(gDot);
      green.appendChild(gLb);
      legendEl.appendChild(green);

      const amber = document.createElement('div');
      amber.className = 'mt-leg-item';
      const aDot = document.createElement('span');
      aDot.className = 'mt-leg-dot';
      aDot.style.background = '#FF9F1C';
      const aLb = document.createElement('span');
      aLb.textContent = '40-79% habits';
      amber.appendChild(aDot);
      amber.appendChild(aLb);
      legendEl.appendChild(amber);

      const red = document.createElement('div');
      red.className = 'mt-leg-item';
      const rDot = document.createElement('span');
      rDot.className = 'mt-leg-dot';
      rDot.style.background = '#FF6B6B';
      const rLb = document.createElement('span');
      rLb.textContent = '1-39% habits';
      red.appendChild(rDot);
      red.appendChild(rLb);
      legendEl.appendChild(red);
    }
  }

  // ============================================================
  // COMBINED DAY EDITOR
  // ============================================================

  function openDayEditor(ymd) {
    editorDate = ymd;
    const bg = $('deBg');
    bg.classList.add('show');
    setTimeout(() => { const f = bg.querySelector('button, input, textarea'); if (f) f.focus(); }, 60);

    const parts = ymd.split('-');
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const titleEl = $('deTitle');
    if (titleEl) titleEl.textContent = getDayName(d.getDay()) + ', ' + getMonthName(d.getMonth()) + ' ' + d.getDate() + ', ' + d.getFullYear();

    renderDayEditor();
  }

  function closeDayEditor() {
    if (editorDate) {
      const notesEl = $('deNotes');
      if (notesEl) {
        const cur = getDayData(editorDate) || { entries: {}, notes: '' };
        cur.notes = notesEl.value;
        setDayData(editorDate, cur);
      }
    }
    $('deBg').classList.remove('show');
    editorDate = null;
    renderMoodCalendar();
    renderHabitsView();
  }

  function renderDayEditor() {
    if (!editorDate) return;

    // Mood buttons
    const pillsEl = $('dePills');
    if (pillsEl) {
      const currentMood = getMood(editorDate);
      pillsEl.innerHTML = '';
      MOOD_DEFS.forEach((mood) => {
        const btn = document.createElement('button');
        btn.className = 'de-mood-btn' + (currentMood === mood.key ? ' is-on' : '');
        btn.style.color = mood.color;

        const em = document.createElement('img');
        em.className = 'de-mood-em';
        em.src = moodSvgUri(mood.key);
        em.alt = mood.label;

        btn.appendChild(em);

        btn.addEventListener('click', () => {
          const existing = getMood(editorDate);
          if (existing === mood.key) {
            deleteMood(editorDate);
          } else {
            setMood(editorDate, mood.key);
          }
          renderDayEditor();
          renderMoodCalendar();
        });

        pillsEl.appendChild(btn);
      });
    }

    // Habit checkboxes
    const defs = getDefinitions().filter((d) => d.active);
    const data = getDayData(editorDate) || { entries: {}, notes: '' };
    const listEl = $('deHabits');
    if (listEl) {
      listEl.innerHTML = '';
      defs.forEach((def) => {
        const item = document.createElement('div');
        item.className = 'ht-day-item';

        const cb = document.createElement('div');
        cb.className = 'ht-day-cb' + (data.entries[def.id] ? ' is-on' : '');

        const label = document.createElement('span');
        label.className = 'ht-day-label';
        label.textContent = def.emoji + ' ' + def.name;

        item.appendChild(cb);
        item.appendChild(label);

        item.addEventListener('click', () => {
          const cur = getDayData(editorDate) || { entries: {}, notes: '' };
          cur.entries[def.id] = !cur.entries[def.id];
          setDayData(editorDate, cur);
          cb.classList.toggle('is-on');
          renderMoodCalendar();
          renderHabitsView();
        });

        listEl.appendChild(item);
      });
    }

    // Notes
    const notesEl = $('deNotes');
    if (notesEl) {
      notesEl.value = data.notes || '';
    }
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

    // Emoji picker button in settings
    const addEmojiBtn = $('htAddEmoji');
    if (addEmojiBtn) {
      addEmojiBtn.addEventListener('click', () => {
        lastFocus = document.activeElement;
        emojiPickerCallback = (emoji) => {
          addEmojiBtn.textContent = emoji;
        };
        $('htEpBg').classList.add('show');
        renderEmojiPicker(addEmojiBtn.textContent || '💤');
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

    // Day editor
    const deDone = $('deDone');
    if (deDone) deDone.addEventListener('click', closeDayEditor);
    const deBg = $('deBg');
    if (deBg) {
      deBg.addEventListener('click', (e) => {
        if (e.target === deBg) closeDayEditor();
      });
    }

    // Sub-navigation with crossfade
    var _viewSwitchTimer = null;
    document.querySelectorAll('.habit-sub-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.habit-sub-btn').forEach(function(b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');

        var hv = btn.getAttribute('data-habitview');
        var targetId = hv === 'tracker' ? 'habitTracker' : hv === 'mood' ? 'moodTracker' : 'habitActivity';
        var targetView = document.getElementById(targetId);
        if (!targetView) return;

        var currentView = document.querySelector('.habit-view:not([style*="display: none"])');
        if (!currentView || currentView === targetView) return;

        if (_viewSwitchTimer) { clearTimeout(_viewSwitchTimer); _viewSwitchTimer = null; }

        // Clear entering from both
        document.querySelectorAll('.habit-view.is-entering').forEach(function(v) { v.classList.remove('is-entering'); });

        // Fade out current
        currentView.classList.add('is-exiting');
        _viewSwitchTimer = setTimeout(function() {
          currentView.style.display = 'none';
          currentView.classList.remove('is-exiting');

          // Show and fade in target
          targetView.style.display = '';
          targetView.classList.remove('is-entering');
          void targetView.offsetWidth;
          targetView.classList.add('is-entering');
          if (hv === 'activity' && window.renderActivityHeatmap) window.renderActivityHeatmap();
          _viewSwitchTimer = setTimeout(function() {
            targetView.classList.remove('is-entering');
            _viewSwitchTimer = null;
          }, 1200);
        }, 300);
      });
    });

    // Mood navigation
    const mtPrev = $('mtPrevBtn');
    const mtNext = $('mtNextBtn');
    if (mtPrev) mtPrev.addEventListener('click', () => {
      moodMonthDate.setMonth(moodMonthDate.getMonth() - 1);
      renderMoodCalendar();
    });
    if (mtNext) mtNext.addEventListener('click', () => {
      moodMonthDate.setMonth(moodMonthDate.getMonth() + 1);
      renderMoodCalendar();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if ($('htSetBg').classList.contains('show')) { closeSettings(); return; }
      if ($('htEpBg').classList.contains('show')) { closeEmojiPicker(); return; }
      if ($('deBg').classList.contains('show')) { closeDayEditor(); return; }
    });

    // Initial render
    renderHabitsView();
    renderMoodCalendar();
    renderHomeHealthRings();

    // Trigger entrance animation on initial view
    var initView = $('habitTracker');
    if (initView) {
      initView.classList.add('is-entering');
      setTimeout(function() { initView.classList.remove('is-entering'); }, 1200);
    }

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
      html += '<span class="hfr-name">' + def.emoji + ' ' + def.name + '</span>';
      html += '<span class="hfr-sublabel">' + done + '/7 days</span>';
      html += '</div>';
    });

    el.innerHTML = html;
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

  function render() {
    renderHabitsView();
    renderMoodCalendar();

    // Trigger entrance on visible sub-view
    var visibleView = document.querySelector('.habit-view:not([style*="display: none"])');
    if (visibleView) {
      visibleView.classList.remove('is-entering');
      void visibleView.offsetWidth;
      visibleView.classList.add('is-entering');
      setTimeout(function() { visibleView.classList.remove('is-entering'); }, 1200);
    }
  }

  window.renderHabits = render;

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
