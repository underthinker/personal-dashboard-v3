(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const GREEN = '#6BE3A4';
  const RED = '#FF6B6B';

  function monthDotColor(income, expenses) {
    return (income - expenses) > 0 ? GREEN : RED;
  }

  function fmt(n) { return '$' + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function fmtK(n) {
    if (n >= 1000) return '$' + (n/1000).toFixed(1) + 'K';
    return '$' + n.toFixed(0);
  }

  const FINANCES_KEY = 'finances_data_v1';

  // --- Storage & data helpers ---

  function defaultData() {
    return { income: [], expenses: [] };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(FINANCES_KEY);
      if (!raw) { return seedData(); }
      const d = JSON.parse(raw);
      if (!d.income && !d.expenses) { return seedData(); }
      return d;
    } catch(e) { return seedData(); }
  }

  function saveData(data) {
    localStorage.setItem(FINANCES_KEY, JSON.stringify(data));
  }

  function seedData() {
    const y = new Date().getFullYear();
    const d = { income: [], expenses: [] };
    d.income.push({id:1, source:'Acme Inc.', amount:5000, tags:['Salary'], date: y + '-01-09'});
    d.income.push({id:2, source:'Design Agency', amount:1000, tags:['Freelance'], date: y + '-01-09'});
    d.income.push({id:3, source:'Brokerage Account', amount:500, tags:['Salary'], date: y + '-01-09'});
    d.income.push({id:4, source:'Acme Inc.', amount:5000, tags:['Salary'], date: y + '-02-02'});
    d.income.push({id:5, source:'Digital Store', amount:1000, tags:['Freelance'], date: y + '-02-02'});
    d.income.push({id:6, source:'Acme Inc.', amount:5000, tags:['Salary'], date: y + '-03-09'});
    d.income.push({id:7, source:'Design Agency', amount:2500, tags:['Freelance'], date: y + '-03-09'});
    d.expenses.push({id:1, source:"Joe's Pizza", amount:25, tags:['Dining Out'], date: y + '-01-09'});
    d.expenses.push({id:2, source:'Mortgage', amount:2500, tags:['Rent/Mortgage'], date: y + '-01-09'});
    d.expenses.push({id:3, source:'Hydro Inc.', amount:120, tags:['Utilities'], date: y + '-01-09'});
    d.expenses.push({id:4, source:'Gym Clothes', amount:200, tags:['Retail'], date: y + '-01-09'});
    d.expenses.push({id:5, source:'Mortgage', amount:2500, tags:['Rent/Mortgage'], date: y + '-02-09'});
    saveData(d);
    return d;
  }

  function uid() { return Date.now() + Math.floor(Math.random()*1000); }

  // --- Date & formatting utilities ---

  function monthIdx(dateStr) {
    if (!dateStr) return new Date().getMonth();
    return parseInt(dateStr.split('-')[1], 10) - 1;
  }

  function monthSum(items, mi) {
    let s = 0;
    for (let i = 0; i < items.length; i++) {
      if (monthIdx(items[i].date) === mi) s += items[i].amount;
    }
    return s;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const y = parts[0];
    return MONTH_NAMES[m] + ' ' + d + ', ' + y;
  }

  function parseDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-').map(Number);
    return new Date(parts[0], parts[1]-1, parts[2]);
  }

  function sortByDate(items) {
    return items.slice().sort((a, b) => parseDate(a.date) - parseDate(b.date));
  }

  const tableSortState = { income: { col: 'date', dir: 'desc' }, expenses: { col: 'date', dir: 'desc' } };

  function getSortItems(items, scope) {
    const s = tableSortState[scope];
    if (!s) return sortByDate(items);
    const dir = s.dir === 'asc' ? 1 : -1;
    return items.slice().sort((a, b) => {
      if (s.col === 'date') {
        return (parseDate(a.date) - parseDate(b.date)) * dir;
      }
      if (s.col === 'amount') {
        return ((a.amount || 0) - (b.amount || 0)) * dir;
      }
      if (s.col === 'source') {
        const sa = (a.source || '').toLowerCase();
        const sb = (b.source || '').toLowerCase();
        if (sa < sb) return -1 * dir;
        if (sa > sb) return 1 * dir;
        return 0;
      }
      if (s.col === 'tags') {
        const ta = (a.tags && a.tags.length) ? a.tags[0].toLowerCase() : '';
        const tb = (b.tags && b.tags.length) ? b.tags[0].toLowerCase() : '';
        if (ta < tb) return -1 * dir;
        if (ta > tb) return 1 * dir;
        return 0;
      }
      return 0;
    });
  }

  function cycleSort(scope, col) {
    const s = tableSortState[scope];
    if (s.col !== col) {
      s.col = col;
      s.dir = col === 'date' ? 'desc' : 'asc';
    } else {
      s.dir = s.dir === 'asc' ? 'desc' : 'asc';
    }
  }

  function sortIcon(scope, col) {
    const s = tableSortState[scope];
    if (s.col !== col) return '<span class="fin-sort-icon">&#9650;</span>';
    return '<span class="fin-sort-icon' + (s.dir === 'desc' ? ' is-desc' : '') + '">&#9650;</span>';
  }

  const INCOME_TAGS = [
    { label: 'Salary', color: '#6BE3A4' },
    { label: 'Bonus', color: '#56d490' },
    { label: 'Freelance', color: '#88B0FF' },
    { label: 'Investment Income', color: '#BE88FF' },
    { label: 'Gifts/Reimbursements', color: '#7AA0EE' },
    { label: 'Miscellaneous', color: '#C8C8C8' }
  ];

  const EXPENSE_TAGS = [
    { label: 'Rent/Mortgage', color: '#FF6B6B' },
    { label: 'Utilities', color: '#BE88FF' },
    { label: 'Groceries', color: '#AE78EE' },
    { label: 'Dining Out', color: '#88B0FF' },
    { label: 'Healthcare', color: '#56d490' },
    { label: 'Auto/Car', color: '#F2C063' },
    { label: 'Insurance', color: '#D2A05A' },
    { label: 'Merchandise', color: '#C8984E' },
    { label: 'Subscriptions', color: '#C8C8C8' }
  ];

  // --- Tag system (colors, custom tags, renames, picker) ---

  function getBuiltInTags(scope) {
    return scope === 'income' ? INCOME_TAGS : EXPENSE_TAGS;
  }

  function loadCustomTagColors(scope) {
    const key = 'fin_tag_colors_' + scope;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
  }

  function saveCustomTagColor(scope, tagName, color) {
    const key = 'fin_tag_colors_' + scope;
    const colors = loadCustomTagColors(scope);
    colors[tagName] = color;
    localStorage.setItem(key, JSON.stringify(colors));
  }

  function resetTagColor(scope, tagName) {
    const key = 'fin_tag_colors_' + scope;
    const colors = loadCustomTagColors(scope);
    delete colors[tagName];
    localStorage.setItem(key, JSON.stringify(colors));
  }

  function getTagColor(tagName, scope) {
    const custom = loadCustomTagColors(scope);
    if (custom[tagName]) return custom[tagName];
    const builtIn = getBuiltInTags(scope);
    for (let i = 0; i < builtIn.length; i++) {
      if (builtIn[i].label === tagName) return builtIn[i].color;
    }
    return '#76746E';
  }

  function tagColorStyle(color) {
    return 'background:' + color + '2e; color:' + color + '; border-color:' + color + '40;';
  }

  let tagPickerState = { scope: '', id: 0, cell: null, currentTags: [], activeColorTag: null };

  function showTagPicker(cell, scope, id, currentTags) {
    const picker = $('finTagPicker');
    tagPickerState = { scope, id, cell, currentTags: currentTags.slice(), activeColorTag: null };
    renderPickerView();
    const rect = cell.getBoundingClientRect();
    picker.style.top = (rect.bottom + 6) + 'px';
    picker.style.left = Math.min(rect.left, window.innerWidth - 310) + 'px';
    picker.style.bottom = 'auto';
    picker.classList.add('is-visible');
    const pickerRect = picker.getBoundingClientRect();
    if (pickerRect.bottom > window.innerHeight) {
      picker.style.top = 'auto';
      picker.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
    }
  }

  function renderPickerView() {
    const picker = $('finTagPicker');
    const allTags = getBuiltInTags(tagPickerState.scope);
    const currentTags = tagPickerState.currentTags;
    const scope = tagPickerState.scope;
    let selectedHtml = '';
    for (let i = 0; i < currentTags.length; i++) {
      const color = getTagColor(currentTags[i], scope);
      const displayName = getTagDisplayName(currentTags[i], scope);
      selectedHtml += '<span class="fin-tag" style="' + tagColorStyle(color) + '">' + escHtml(displayName) + '<button class="fin-tag-remove" data-picker-remove="' + i + '">&times;</button></span>';
    }
    let optionsHtml = '';
    for (let i = 0; i < allTags.length; i++) {
      const isSel = currentTags.indexOf(allTags[i].label) !== -1;
      const color = getTagColor(allTags[i].label, scope);
      const displayName = getTagDisplayName(allTags[i].label, scope);
      optionsHtml += '<button class="fin-tag-picker-option' + (isSel ? ' is-selected' : '') + '" data-picker-toggle="' + escHtml(allTags[i].label) + '">';
      optionsHtml += '<span class="fin-tag-picker-option-dot" style="background:' + color + '"></span>';
      optionsHtml += '<span class="fin-tag-picker-option-text">' + escHtml(displayName) + '</span>';
      optionsHtml += '<span class="fin-tag-picker-option-check">\u2713</span>';
      optionsHtml += '</button>';
    }
    picker.innerHTML =
      '<div class="fin-tag-picker-header"><div class="fin-tag-picker-selected">' + selectedHtml + '</div></div>' +
      '<div class="fin-tag-picker-hint">Select tags to apply</div>' +
      '<div class="fin-tag-picker-options">' + optionsHtml + '</div>';
    wirePickerEvents(picker);
  }

  function wirePickerEvents(picker) {
    picker.querySelectorAll('[data-picker-remove]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-picker-remove'));
        tagPickerState.currentTags.splice(idx, 1);
        savePickerTags();
        renderPickerView();
      });
    });
    picker.querySelectorAll('[data-picker-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const label = btn.getAttribute('data-picker-toggle');
        const idx = tagPickerState.currentTags.indexOf(label);
        if (idx === -1) tagPickerState.currentTags.push(label);
        else tagPickerState.currentTags.splice(idx, 1);
        savePickerTags();
        renderPickerView();
      });
    });
  }

  function savePickerTags() {
    const data = loadData();
    const key = tagPickerState.scope === 'income' ? 'income' : 'expenses';
    const items = data[key];
    for (let i = 0; i < items.length; i++) {
      if (items[i].id === tagPickerState.id) {
        items[i].tags = tagPickerState.currentTags.slice();
        break;
      }
    }
    saveData(data);
  }

  function hideTagPicker() {
    const picker = $('finTagPicker');
    picker.classList.remove('is-visible');
    tagPickerState = { scope: '', id: 0, cell: null, currentTags: [], activeColorTag: null };
  }

  document.addEventListener('mousedown', (e) => {
    const picker = $('finTagPicker');
    if (!picker.classList.contains('is-visible')) return;
    if (picker.contains(e.target)) return;
    if (e.target.classList.contains('fin-cell-inner')) return;
    hideTagPicker();
    renderFinances();
  });

  function loadCustomTags(scope) {
    const key = 'fin_custom_tags_' + scope;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function saveCustomTags(scope, tags) {
    const key = 'fin_custom_tags_' + scope;
    localStorage.setItem(key, JSON.stringify(tags));
  }

  function loadTagRenames(scope) {
    const key = 'fin_tag_renames_' + scope;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
  }

  function saveTagRenames(scope, renames) {
    const key = 'fin_tag_renames_' + scope;
    localStorage.setItem(key, JSON.stringify(renames));
  }

  function getTagDisplayName(label, scope) {
    const renames = loadTagRenames(scope);
    return renames[label] || label;
  }

  function getAllTags(scope) {
    const builtIn = getBuiltInTags(scope);
    const custom = loadCustomTags(scope);
    const all = builtIn.slice();
    for (let i = 0; i < custom.length; i++) {
      if (!all.some((t) => t.label === custom[i].label)) {
        all.push(custom[i]);
      }
    }
    return all;
  }

  function addCustomTag(scope, label, color) {
    const custom = loadCustomTags(scope);
    if (custom.some((t) => t.label.toLowerCase() === label.toLowerCase())) return false;
    custom.push({ label, color: color || '#76746E' });
    saveCustomTags(scope, custom);
    return true;
  }

  function renameTag(scope, originalLabel, newLabel) {
    const isBuiltIn = getBuiltInTags(scope).some((t) => t.label === originalLabel);
    if (isBuiltIn) {
      // Built-in tags: rename is display-only. Entries always keep the canonical label.
      // The renames map (canonical → display) drives all label rendering throughout the app.
      // Do NOT rename entries or mutate INCOME_TAGS/EXPENSE_TAGS — neither is persistent.
      const renames = loadTagRenames(scope);
      if (newLabel === originalLabel) {
        delete renames[originalLabel];
      } else {
        renames[originalLabel] = newLabel;
      }
      saveTagRenames(scope, renames);
    } else {
      // Custom tags: the label IS the canonical key — rename it everywhere.
      const colors = loadCustomTagColors(scope);
      if (colors[originalLabel]) {
        colors[newLabel] = colors[originalLabel];
        delete colors[originalLabel];
        localStorage.setItem('fin_tag_colors_' + scope, JSON.stringify(colors));
      }
      const custom = loadCustomTags(scope);
      for (let i = 0; i < custom.length; i++) {
        if (custom[i].label === originalLabel) { custom[i].label = newLabel; break; }
      }
      saveCustomTags(scope, custom);
      renameTagInEntries(scope, originalLabel, newLabel);
      // renameTagInEntries propagates to goal plans for expense scope
    }
  }

  function renameGoalPlanTag(oldName, newName) {
    const goalsState = loadGoals();
    let changed = false;
    goalsState.goals.forEach((goal) => {
      if (goal.plan && goal.plan[oldName]) {
        goal.plan[newName] = goal.plan[oldName];
        delete goal.plan[oldName];
        changed = true;
      }
    });
    if (changed) saveGoals(goalsState);
  }

  function deleteGoalPlanTag(tagName) {
    const goalsState = loadGoals();
    let changed = false;
    goalsState.goals.forEach((goal) => {
      if (goal.plan && goal.plan[tagName]) {
        delete goal.plan[tagName];
        changed = true;
      }
    });
    if (changed) saveGoals(goalsState);
  }

  function renameTagInEntries(scope, oldName, newName) {
    const data = loadData();
    const key = scope === 'income' ? 'income' : 'expenses';
    const items = data[key] || [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].tags) {
        for (let j = 0; j < items[i].tags.length; j++) {
          if (items[i].tags[j] === oldName) {
            items[i].tags[j] = newName;
          }
        }
      }
    }
    saveData(data);
    if (scope === 'expense') renameGoalPlanTag(oldName, newName);
  }

  function deleteTagFromEntries(scope, tagName) {
    const data = loadData();
    const key = scope === 'income' ? 'income' : 'expenses';
    const items = data[key] || [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].tags) {
        items[i].tags = items[i].tags.filter((t) => t !== tagName);
      }
    }
    saveData(data);
    if (scope === 'expense') deleteGoalPlanTag(tagName);
  }

  function deleteCustomTag(scope, tagName) {
    const custom = loadCustomTags(scope);
    const filtered = custom.filter((t) => t.label !== tagName);
    saveCustomTags(scope, filtered);
    const colors = loadCustomTagColors(scope);
    delete colors[tagName];
    localStorage.setItem('fin_tag_colors_' + scope, JSON.stringify(colors));
    deleteTagFromEntries(scope, tagName);
  }

  function updateCustomTagColor(scope, tagName, color) {
    saveCustomTagColor(scope, tagName, color);
  }

  // --- Tag Manager modal ---

  let tmScope = 'income';
  let lastFocus = null;

  function openTagManager() {
    lastFocus = document.activeElement;
    tmScope = 'income';
    document.querySelectorAll('.fin-tm-scope-btn').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-scope') === 'income');
    });
    const bg = $('finTmBg');
    bg.classList.add('show');
    renderTagManagerList();
    bindTagManagerEvents();
    setTimeout(() => { const f = bg.querySelector('button, input'); if (f) f.focus(); }, 60);
  }

  function closeTagManager() {
    $('finTmBg').classList.remove('show');
    renderFinances();
    renderDashboard(loadData());
    if (lastFocus) { lastFocus.focus(); lastFocus = null; }
  }

  let tmToastTimer = null;
  function showTagToast(message, color) {
    const toast = $('finTmToast');
    if (!toast) return;
    clearTimeout(tmToastTimer);
    const dotHtml = color ? '<span class="toast-dot" style="background:' + color + '"></span>' : '';
    toast.innerHTML = dotHtml + escHtml(message);
    toast.classList.add('is-visible');
    tmToastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 1800);
  }

  function renderTagManagerList() {
    const list = $('finTmList');
    const allTags = getAllTags(tmScope);
    const builtIn = getBuiltInTags(tmScope);
    const builtInLabels = {};
    for (let i = 0; i < builtIn.length; i++) builtInLabels[builtIn[i].label] = true;
    if (allTags.length === 0) {
      list.innerHTML = '<div class="fin-tm-empty">No tags yet. Add one below.</div>';
      return;
    }
    let html = '';
    for (let i = 0; i < allTags.length; i++) {
      const tag = allTags[i];
      const color = getTagColor(tag.label, tmScope);
      const isBuiltIn = builtInLabels[tag.label];
      const displayName = getTagDisplayName(tag.label, tmScope);
      html += '<div class="fin-tm-row" data-tm-label="' + escHtml(tag.label) + '">';
      html += '<span class="fin-tm-dot" style="background:' + color + '"></span>';
      html += '<input type="text" class="fin-tm-name" value="' + escHtml(displayName) + '">';
      html += '<label class="fin-tm-color-btn" style="background:' + color + '"><input type="color" value="' + color + '"></label>';
      if (!isBuiltIn) {
        html += '<button class="fin-tm-del-btn" title="Delete tag">&times;</button>';
      }
      html += '</div>';
    }
    list.innerHTML = html;
    bindTagManagerRowEvents(list);
  }

  function bindTagManagerRowEvents(list) {
    list.querySelectorAll('.fin-tm-row').forEach((row) => {
      const nameInput = row.querySelector('.fin-tm-name');
      const colorBtn = row.querySelector('.fin-tm-color-btn input[type="color"]');
      const delBtn = row.querySelector('.fin-tm-del-btn');
      const originalLabel = row.getAttribute('data-tm-label');
      const isBuiltIn = getBuiltInTags(tmScope).some((t) => t.label === originalLabel);
      nameInput.addEventListener('change', () => {
        const newName = nameInput.value.trim();
        const currentDisplay = getTagDisplayName(originalLabel, tmScope);
        if (!newName || newName === currentDisplay) { nameInput.value = currentDisplay; return; }
        const allExistingLabels = getAllTags(tmScope).map((t) => t.label.toLowerCase());
        if (allExistingLabels.indexOf(newName.toLowerCase()) !== -1 && newName.toLowerCase() !== originalLabel.toLowerCase()) {
          alert('A tag with this name already exists.');
          nameInput.value = currentDisplay;
          return;
        }
        const oldColor = getTagColor(originalLabel, tmScope);
        renameTag(tmScope, originalLabel, newName);
        renderTagManagerList();
        showTagToast(currentDisplay + ' \u2192 ' + newName, oldColor);
      });
      colorBtn.addEventListener('input', () => {
        updateCustomTagColor(tmScope, originalLabel, colorBtn.value);
        colorBtn.parentElement.style.background = colorBtn.value;
        row.querySelector('.fin-tm-dot').style.background = colorBtn.value;
        showTagToast(originalLabel + ' color updated', colorBtn.value);
      });
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          const tagName = row.getAttribute('data-tm-label');
          const oldColor = getTagColor(tagName, tmScope);
          deleteCustomTag(tmScope, tagName);
          renderTagManagerList();
          showTagToast(tagName + ' deleted', oldColor);
        });
      }
    });
  }

  let tmEventsBound = false;

  function bindTagManagerEvents() {
    if (tmEventsBound) return;
    tmEventsBound = true;
    const scopeSeg = $('finTmScopeSeg');
    scopeSeg.querySelectorAll('.fin-tm-scope-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        scopeSeg.querySelectorAll('.fin-tm-scope-btn').forEach((b) => { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        tmScope = btn.getAttribute('data-scope');
        renderTagManagerList();
      });
    });
    const addBtn = $('finTmAddBtn');
    const addInput = $('finTmAddInput');
    addBtn.onclick = () => {
      const name = addInput.value.trim();
      if (!name) return;
      if (getAllTags(tmScope).some((t) => t.label.toLowerCase() === name.toLowerCase())) {
        alert('A tag with this name already exists.');
        return;
      }
      addCustomTag(tmScope, name, '#76746E');
      addInput.value = '';
      renderTagManagerList();
      showTagToast(name + ' added', '#76746E');
    };
    addInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); }
    });
    $('finTmCloseBtn').onclick = closeTagManager;
  }

  $('finManageTagsBtn').addEventListener('click', openTagManager);
  $('finTmBg').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeTagManager();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('finTmBg').classList.contains('show')) closeTagManager();
  });

  // --- Chart rendering (waterfall, area, donuts) ---

  let activePeriod = 'all';
  let _savingsDocClickHandler = null;
  let explodedSlice = { income: null, expense: null };
  let donutContext = { income: { items: [], total: 0 }, expense: { items: [], total: 0 } };

  function periodMonths(p) {
    if (p === 'all') return [0,1,2,3,4,5,6,7,8,9,10,11];
    if (p === 'q1') return [0,1,2];
    if (p === 'q2') return [3,4,5];
    if (p === 'q3') return [6,7,8];
    if (p === 'q4') return [9,10,11];
    if (p && p.charAt(0) === 'm') return [parseInt(p.slice(1), 10)];
    return [0,1,2,3,4,5,6,7,8,9,10,11];
  }

  function periodLabel(p) {
    if (p === 'all') return 'All Year';
    if (p === 'q1') return 'Q1 (Jan\u2013Mar)';
    if (p === 'q2') return 'Q2 (Apr\u2013Jun)';
    if (p === 'q3') return 'Q3 (Jul\u2013Sep)';
    if (p === 'q4') return 'Q4 (Oct\u2013Dec)';
    if (p && p.charAt(0) === 'm') return MONTH_NAMES[parseInt(p.slice(1), 10)];
    return 'All Year';
  }

  function periodShortLabel(p) {
    if (p === 'all') return 'All Year';
    if (p.charAt(0) === 'q') return p.toUpperCase();
    if (p.charAt(0) === 'm') return MONTH_NAMES[parseInt(p.slice(1), 10)];
    return p;
  }

  function filterByPeriod(items, p) {
    const months = periodMonths(p);
    const set = {};
    for (let i = 0; i < months.length; i++) set[months[i]] = true;
    const out = [];
    for (let i = 0; i < items.length; i++) {
      if (set[monthIdx(items[i].date)]) out.push(items[i]);
    }
    return out;
  }

  function setCardSubtitle(id, text) {
    const el = $(id);
    if (!el) return;
    if (activePeriod === 'all') {
      el.hidden = true;
      el.textContent = '';
    } else {
      el.textContent = text;
      el.hidden = false;
    }
  }

  function renderMonthlyWaterfall(data, bar) {
    const svg = $('yearlySavingsChart');
    if (!svg) return;
    const W = 480, H = 260;
    const padL = 40, padR = 40, padT = 16, padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const inc = bar.income, exp = bar.expense, sav = bar.savings;
    let maxVal = Math.max(inc, exp, sav < 0 ? Math.abs(sav) : 0);
    if (maxVal === 0) maxVal = 1000;
    const niceMax = Math.ceil(maxVal / 1000) * 1000;
    const displayMax = niceMax + niceMax * 0.15;
    const displayMin = sav < 0 ? -Math.ceil(Math.abs(sav) / 1000) * 1000 : 0;
    const displayRange = displayMax - displayMin;
    function yScale(v) { return padT + plotH - ((v - displayMin) / displayRange) * plotH; }
    const barW = 80, gap = 48;
    const totalW = barW * 2 + gap;
    const startX = padL + (plotW - totalW) / 2;
    const incX = startX;
    const expX = startX + barW + gap;
    const savX = startX + barW * 2 + gap * 2;
    const incTop = yScale(inc), incBot = yScale(0);
    const incH = incBot - incTop;
    const expTop = yScale(exp), expBot = yScale(0);
    const expH = expBot - expTop;
    function roundedRect(x, y, w, h, r) {
      if (h < 2) return '';
      if (r > h / 2) r = h / 2;
      if (r > w / 2) r = w / 2;
      return 'M' + (x + r) + ',' + y + 'h' + (w - 2*r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + 'v' + (h - 2*r) + 'a' + r + ',' + r + ' 0 0 1 ' + (-r) + ',' + r + 'h' + (2*r - w) + 'a' + r + ',' + r + ' 0 0 1 ' + (-r) + ',' + (-r) + 'v' + (2*r - h) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + (-r) + 'z';
    }
    let html = '';
    html += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="none"/>';
    html += '<path d="' + roundedRect(incX, incTop, barW, incH, 6) + '" class="savings-waterfall-income"/>';
    html += '<text x="' + (incX + barW/2) + '" y="' + (incTop - 12) + '" class="savings-waterfall-amount savings-waterfall-amount-income">' + fmt(inc) + '</text>';
    html += '<text x="' + (incX + barW/2) + '" y="' + (incTop - 40) + '" class="savings-waterfall-label">Income</text>';
    html += '<path d="' + roundedRect(expX, expTop, barW, expH, 6) + '" class="savings-waterfall-expense"/>';
    html += '<text x="' + (expX + barW/2) + '" y="' + (expTop - 12) + '" class="savings-waterfall-amount savings-waterfall-amount-expense">' + fmt(exp) + '</text>';
    html += '<text x="' + (expX + barW/2) + '" y="' + (expTop - 40) + '" class="savings-waterfall-label">Expenses</text>';
    html += '<line x1="' + padL + '" y1="' + yScale(0) + '" x2="' + (W - padR) + '" y2="' + yScale(0) + '" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="4,3"/>';
    html += '<text x="' + (W/2) + '" y="' + (H - 6) + '" class="savings-waterfall-month-label">' + MONTH_NAMES[bar.month] + '</text>';
    svg.innerHTML = html;
    svg.classList.add('savings-waterfall-entrance');
    setTimeout(() => { svg.classList.remove('savings-waterfall-entrance'); }, 1200);
    const tooltip = $('savingsTooltip');
    if (tooltip) tooltip.classList.remove('is-visible');

  }

  function renderYearlySavings(data) {
    const titleEl = $('savingsCardTitle');
    if (titleEl) {
      const first = activePeriod.charAt(0);
      if (first === 'q') titleEl.textContent = 'Quarterly Savings';
      else if (first === 'm') titleEl.textContent = 'Monthly Savings';
      else titleEl.textContent = 'Yearly Savings';
    }
    const svg = $('yearlySavingsChart');
    if (!svg) return;
    svg.onclick = null;
    const W = 480, H = 260;
    const padL = 52, padR = 12, padT = 12, padB = 28;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const months = periodMonths(activePeriod);
    const bars = [];
    for (let mi = 0; mi < months.length; mi++) {
      const m = months[mi];
      const inc = monthSum(data.income, m);
      const exp = monthSum(data.expenses, m);
      bars.push({month: m, income: inc, expense: exp, savings: inc - exp});
    }
    let periodNet = 0;
    for (let i = 0; i < bars.length; i++) periodNet += bars[i].savings;
    const totalEl = $('savingsTotal');
    if (totalEl) {
      totalEl.className = 'savings-total ' + (periodNet >= 0 ? 'is-positive' : 'is-negative');
      if (_prevSavingsTotal !== periodNet) {
        tweenSavingsTotal(totalEl, periodNet);
      } else {
        totalEl.textContent = (periodNet < 0 ? '-' : '') + fmt(Math.abs(periodNet));
      }
    }
    if (months.length === 1) { renderMonthlyWaterfall(data, bars[0]); return; }
    let maxVal = 0, minVal = 0;
    for (let i = 0; i < bars.length; i++) {
      if (bars[i].income > maxVal) maxVal = bars[i].income;
      if (bars[i].expense > maxVal) maxVal = bars[i].expense;
      if (bars[i].savings < minVal) minVal = bars[i].savings;
    }
    let range = maxVal - minVal;
    if (range === 0) { maxVal = 1000; minVal = 0; range = 1000; }
    const niceRange = Math.ceil(range / 1000) * 1000;
    const padding = niceRange * 0.15;
    const displayMax = maxVal + padding;
    const displayMin = Math.min(0, minVal - padding);
    const displayRange = displayMax - displayMin;
    const step = displayRange <= 2000 ? 500 : displayRange <= 5000 ? 1000 : displayRange <= 10000 ? 2000 : displayRange <= 20000 ? 5000 : 10000;
    function yScale(v) { return padT + plotH - ((v - displayMin) / displayRange) * plotH; }
    const zeroY = yScale(0);
    const barCount = bars.length;
    const groupW = plotW / barCount;
    const pointX = [];
    for (let i = 0; i < barCount; i++) pointX.push(padL + groupW * i + groupW / 2);
    function buildAreaPath(points, topVals, bottomVal) {
      const n = points.length;
      if (n === 0) return '';
      let topPath = 'M' + points[0] + ',' + yScale(topVals[0]);
      for (let i = 1; i < n; i++) {
        const prevX = points[i-1], curX = points[i];
        const cpX = (prevX + curX) / 2;
        topPath += ' C' + cpX + ',' + yScale(topVals[i-1]) + ',' + cpX + ',' + yScale(topVals[i]) + ',' + curX + ',' + yScale(topVals[i]);
      }
      topPath += ' L' + points[n-1] + ',' + yScale(bottomVal);
      for (let i = n - 2; i >= 0; i--) {
        const curX = points[i], nextX = points[i+1];
        const cpX = (curX + nextX) / 2;
        topPath += ' C' + cpX + ',' + yScale(bottomVal) + ',' + cpX + ',' + yScale(bottomVal) + ',' + curX + ',' + yScale(bottomVal);
      }
      topPath += ' Z';
      return topPath;
    }
    function buildLinePath(points, vals) {
      const n = points.length;
      if (n === 0) return '';
      let path = 'M' + points[0] + ',' + yScale(vals[0]);
      for (let i = 1; i < n; i++) {
        const prevX = points[i-1], curX = points[i];
        const cpX = (prevX + curX) / 2;
        path += ' C' + cpX + ',' + yScale(vals[i-1]) + ',' + cpX + ',' + yScale(vals[i]) + ',' + curX + ',' + yScale(vals[i]);
      }
      return path;
    }
    const incomeVals = [], expenseVals = [];
    for (let i = 0; i < bars.length; i++) {
      incomeVals.push(bars[i].income);
      expenseVals.push(bars[i].expense);
    }
    let html = '';
    html += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="none"/>';
    html += '<defs>';
    html += '<linearGradient id="savingsIncomeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(107,227,164,0.30)"/><stop offset="100%" stop-color="rgba(107,227,164,0.02)"/></linearGradient>';
    html += '<linearGradient id="savingsExpenseGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,107,107,0.25)"/><stop offset="100%" stop-color="rgba(255,107,107,0.02)"/></linearGradient>';
    html += '</defs>';
    for (let gv = Math.ceil(displayMin / step) * step; gv <= displayMax; gv += step) {
      const yPos = yScale(gv);
      if (yPos < padT - 1 || yPos > padT + plotH + 1) continue;
      const isZero = Math.abs(gv) < step * 0.01;
      html += '<line x1="' + padL + '" y1="' + yPos + '" x2="' + (W - padR) + '" y2="' + yPos + '" class="' + (isZero ? 'savings-zero-line' : 'savings-grid-line') + '"/>';
      html += '<text x="' + (padL - 8) + '" y="' + (yPos + 3) + '" class="savings-axis-label">' + fmtAxis(gv) + '</text>';
    }
    html += '<path d="' + buildAreaPath(pointX, incomeVals, displayMin) + '" class="savings-area-income"/>';
    html += '<path d="' + buildAreaPath(pointX, expenseVals, displayMin) + '" class="savings-area-expense"/>';
    html += '<path d="' + buildLinePath(pointX, incomeVals) + '" class="savings-line-income"/>';
    html += '<path d="' + buildLinePath(pointX, expenseVals) + '" class="savings-line-expense"/>';
    for (let i = 0; i < bars.length; i++) {
      const cx = pointX[i];
      const d = bars[i];
      html += '<circle cx="' + cx + '" cy="' + yScale(d.income) + '" r="4" class="savings-dot-income"/>';
      html += '<circle cx="' + cx + '" cy="' + yScale(d.expense) + '" r="4" class="savings-dot-expense"/>';
    }
    for (let i = 0; i < bars.length; i++) {
      const cx = pointX[i];
      const b = bars[i];
      if (barCount <= 6) {
        html += '<text x="' + cx + '" y="' + (H - 8) + '" class="savings-label">' + MONTH_NAMES[b.month].substring(0, 3) + '</text>';
      } else if (barCount <= 12) {
        if (i % 3 === 0 || i === barCount - 1) html += '<text x="' + cx + '" y="' + (H - 8) + '" class="savings-label">' + MONTH_NAMES[b.month].substring(0, 3) + '</text>';
      } else {
        const qm = Math.floor(i / 3);
        if (i % 3 === 1) html += '<text x="' + cx + '" y="' + (H - 8) + '" class="savings-label">Q' + (qm + 1) + '</text>';
      }
    }
    for (let i = 0; i < bars.length; i++) {
      const cx = pointX[i];
      const zoneW = Math.min(groupW * 0.8, 40);
      const zoneX = cx - zoneW / 2;
      html += '<rect class="savings-hover-zone" x="' + zoneX + '" y="' + padT + '" width="' + zoneW + '" height="' + plotH + '" data-hi="' + i + '"/>';
    }
    html += '<line id="savingsHoverLine" class="savings-hover-line" x1="0" y1="' + padT + '" x2="0" y2="' + (padT + plotH) + '" style="opacity:0"/>';
    html += '<circle id="savingsHoverDotInc" cx="0" cy="0" r="6" fill="#6BE3A4" stroke="#0f0f0f" stroke-width="2" style="opacity:0;pointer-events:none"/>';
    html += '<circle id="savingsHoverDotExp" cx="0" cy="0" r="6" fill="#FF6B6B" stroke="#0f0f0f" stroke-width="2" style="opacity:0;pointer-events:none"/>';
    svg.innerHTML = html;
    svg.classList.remove('savings-entrance');
    void svg.offsetHeight;
    svg.classList.add('savings-entrance');
    // Line draw animation
    const linePaths = svg.querySelectorAll('.savings-line-income, .savings-line-expense');
    if (linePaths.length) {
      linePaths.forEach((p) => { const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len; });
      void svg.offsetHeight;
      linePaths.forEach((p, i) => { p.style.transition = 'stroke-dashoffset 1s var(--ease-out) ' + (i * 0.15) + 's'; p.style.strokeDashoffset = '0'; });
    }
    wireSavingsInteractions(svg, bars, pointX, yScale, displayMin, displayRange, plotH, padT, W, padR, data);
  }

  function wireSavingsInteractions(svg, bars, pointX, yScale, displayMin, displayRange, plotH, padT, W, padR, data) {
    const tooltip = $('savingsTooltip');
    const hoverLine = $('savingsHoverLine');
    const hoverDotInc = $('savingsHoverDotInc');
    const hoverDotExp = $('savingsHoverDotExp');
    const detailPanel = $('savingsDetailPanel');
    let currentHoverIdx = -1;
    function showTooltip(idx, svgX) {
      const b = bars[idx];
      const netSign = b.savings < 0 ? '-' : '';
      tooltip.innerHTML = '<div class="savings-tooltip-month">' + MONTH_NAMES[b.month] + '</div><div class="savings-tooltip-row"><span class="savings-tooltip-label"><span class="savings-tooltip-dot" style="background:#6BE3A4"></span>Income</span><span class="savings-tooltip-value">' + fmt(b.income) + '</span></div><div class="savings-tooltip-row"><span class="savings-tooltip-label"><span class="savings-tooltip-dot" style="background:#FF6B6B"></span>Expenses</span><span class="savings-tooltip-value">' + fmt(b.expense) + '</span></div><div class="savings-tooltip-divider"></div><div class="savings-tooltip-row savings-tooltip-savings"><span class="savings-tooltip-label">Savings</span><span class="savings-tooltip-value" style="color:' + (b.savings >= 0 ? '#6BE3A4' : '#FF6B6B') + '">' + netSign + fmt(Math.abs(b.savings)) + '</span></div>';
      const rect = svg.getBoundingClientRect();
      const svgW = rect.width;
      const relX = (svgX / W) * svgW;
      let ttLeft = relX - 80;
      if (ttLeft < 0) ttLeft = 8;
      if (ttLeft + 170 > svgW) ttLeft = svgW - 178;
      tooltip.style.left = ttLeft + 'px';
      tooltip.style.top = '8px';
      tooltip.classList.add('is-visible');
    }
    function hideTooltip() {
      tooltip.classList.remove('is-visible');
      if (hoverLine) hoverLine.style.opacity = '0';
      if (hoverDotInc) hoverDotInc.style.opacity = '0';
      if (hoverDotExp) hoverDotExp.style.opacity = '0';
      currentHoverIdx = -1;
    }
    function showHover(idx) {
      if (idx === currentHoverIdx) return;
      currentHoverIdx = idx;
      const cx = pointX[idx];
      const b = bars[idx];
      if (hoverLine) { hoverLine.setAttribute('x1', cx); hoverLine.setAttribute('x2', cx); hoverLine.style.opacity = '1'; }
      if (hoverDotInc) { hoverDotInc.setAttribute('cx', cx); hoverDotInc.setAttribute('cy', yScale(b.income)); hoverDotInc.style.opacity = '1'; }
      if (hoverDotExp) { hoverDotExp.setAttribute('cx', cx); hoverDotExp.setAttribute('cy', yScale(b.expense)); hoverDotExp.style.opacity = '1'; }
      showTooltip(idx, cx);
    }
    const detailSortState = { income: 'desc', expenses: 'desc' };
    function sortItems(items, dir) { return items.slice().sort((a, z) => dir === 'desc' ? z.amount - a.amount : a.amount - z.amount); }
    function renderDetailList(items, cls) {
      if (items.length === 0) return '<div class="savings-detail-empty">No transactions</div>';
      let html = '';
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        html += '<div class="savings-detail-item"><span class="savings-detail-item-name">' + escHtml(it.source || '\u2014') + '</span><span class="savings-detail-item-amount ' + cls + '">' + fmt(it.amount) + '</span></div>';
      }
      return html;
    }
    function buildDetail(b, monthName, incItems, expItems) {
      const sortArrow = (dir) => dir === 'desc' ? '\u25BC' : '\u25B2';
      const sortedInc = sortItems(incItems, detailSortState.income);
      const sortedExp = sortItems(expItems, detailSortState.expenses);
      const netSign = b.savings < 0 ? '-' : '';
      let html = '';
      html += '<div class="savings-detail-header"><div class="savings-detail-title">' + monthName + ' \u2014 ' + netSign + fmt(Math.abs(b.savings)) + ' savings</div><button class="savings-detail-close" id="savingsDetailClose">&times;</button></div>';
      html += '<div class="savings-detail-grid"><div><div class="savings-detail-col-title income-title">Income (' + incItems.length + ') <button class="savings-detail-sort-btn" data-type="income">' + sortArrow(detailSortState.income) + '</button></div><div class="savings-detail-list">' + renderDetailList(sortedInc, 'income-amount') + '</div></div>';
      html += '<div><div class="savings-detail-col-title expense-title">Expenses (' + expItems.length + ') <button class="savings-detail-sort-btn" data-type="expenses">' + sortArrow(detailSortState.expenses) + '</button></div><div class="savings-detail-list">' + renderDetailList(sortedExp, 'expense-amount') + '</div></div></div>';
      detailPanel.innerHTML = html;
      detailPanel.classList.add('is-visible');
      const closeBtn = detailPanel.querySelector('#savingsDetailClose');
      if (closeBtn) { closeBtn.addEventListener('click', () => { detailPanel.classList.remove('is-visible'); setTimeout(() => { detailPanel.innerHTML = ''; }, 350); }); }
      detailPanel.removeEventListener('click', detailPanel._sortHandler);
      detailPanel._sortHandler = (e) => {
        const btn = e.target.closest('.savings-detail-sort-btn');
        if (btn) { e.stopPropagation(); e.preventDefault(); const type = btn.getAttribute('data-type'); detailSortState[type] = detailSortState[type] === 'desc' ? 'asc' : 'desc'; buildDetail(b, monthName, incItems, expItems); }
      };
      detailPanel.addEventListener('click', detailPanel._sortHandler);
    }
    function handleDetailClick(idx) {
      const b = bars[idx];
      buildDetail(b, MONTH_NAMES[b.month], filterByPeriod(data.income, 'm' + b.month), filterByPeriod(data.expenses, 'm' + b.month));
    }
    const hoverZones = svg.querySelectorAll('.savings-hover-zone');
    for (let i = 0; i < hoverZones.length; i++) {
      (function(zone, idx) {
        zone.addEventListener('mouseenter', () => { showHover(idx); });
        zone.addEventListener('mousemove', () => { showHover(idx); });
        zone.addEventListener('mouseleave', () => { hideTooltip(); });
        zone.addEventListener('click', () => { handleDetailClick(idx); });
      })(hoverZones[i], parseInt(hoverZones[i].getAttribute('data-hi')));
    }
    if (_savingsDocClickHandler) document.removeEventListener('click', _savingsDocClickHandler);
    _savingsDocClickHandler = (e) => {
      if (e.target.closest('.savings-detail-sort-btn')) return;
      if (!detailPanel.contains(e.target) && !e.target.closest('.savings-hover-zone')) {
        if (detailPanel.classList.contains('is-visible')) { detailPanel.classList.remove('is-visible'); setTimeout(() => { detailPanel.innerHTML = ''; }, 350); }
      }
    };
    document.addEventListener('click', _savingsDocClickHandler);
  }

  let _prevSavingsTotal = 0;
  let _prevDonutTotals = { income: 0, expense: 0 };

  function tweenDonutText(el, from, to) {
    if (el._tween) cancelAnimationFrame(el._tween);
    if (from === to) { el.textContent = fmtK(to); return; }
    const start = performance.now();
    const dur = 400;
    function step(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtK(from + (to - from) * eased);
      if (p < 1) el._tween = requestAnimationFrame(step);
      else el.textContent = fmtK(to);
    }
    el._tween = requestAnimationFrame(step);
  }

  function tweenSavingsTotal(el, target) {
    const from = _prevSavingsTotal;
    _prevSavingsTotal = target;
    if (el._tweenId) cancelAnimationFrame(el._tweenId);
    const start = performance.now();
    const dur = 500;
    function step(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (target - from) * eased;
      el.textContent = (v < 0 ? '-' : '') + fmt(Math.abs(v));
      if (p < 1) el._tweenId = requestAnimationFrame(step);
      else el.textContent = (target < 0 ? '-' : '') + fmt(Math.abs(target));
    }
    el._tweenId = requestAnimationFrame(step);
  }

  function fmtAxis(v) {
    if (v === 0) return '$0';
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1) + 'K';
    return sign + '$' + abs;
  }

  function renderIncomeDonut(data) {
    const items = filterByPeriod(data.income, activePeriod);
    const tagMap = {};
    let periodTotal = 0;
    for (let i = 0; i < items.length; i++) {
      const tags = items[i].tags || [];
      const amt = items[i].amount;
      periodTotal += amt;
      for (let t = 0; t < tags.length; t++) { const tag = tags[t]; tagMap[tag] = (tagMap[tag] || 0) + amt; }
    }
    let total = 0;
    const labels = [];
    const keys = Object.keys(tagMap);
    for (let i = 0; i < keys.length; i++) { total += tagMap[keys[i]]; labels.push({tag: keys[i], amount: tagMap[keys[i]]}); }
    donutContext.income = { items, total: periodTotal, tagTotal: total };
    setCardSubtitle('incomeSubtitle', periodLabel(activePeriod));
    renderDonut('incomeDonut', 'incomeDonutLegend', labels, total, 'income');
  }

  function renderExpenseDonut(data) {
    const items = filterByPeriod(data.expenses, activePeriod);
    const tagMap = {};
    let periodTotal = 0;
    for (let i = 0; i < items.length; i++) {
      const tags = items[i].tags || [];
      const amt = items[i].amount;
      periodTotal += amt;
      for (let t = 0; t < tags.length; t++) { const tag = tags[t]; tagMap[tag] = (tagMap[tag] || 0) + amt; }
    }
    let total = 0;
    const labels = [];
    const keys = Object.keys(tagMap);
    for (let i = 0; i < keys.length; i++) { total += tagMap[keys[i]]; labels.push({tag: keys[i], amount: tagMap[keys[i]]}); }
    donutContext.expense = { items, total: periodTotal, tagTotal: total };
    setCardSubtitle('expenseSubtitle', periodLabel(activePeriod));
    renderDonut('expenseDonut', 'expenseDonutLegend', labels, total, 'expense');
  }

  function renderDonut(svgId, legendId, labels, total, scope) {
    const svg = $(svgId);
    const legend = $(legendId);
    if (!svg || !legend) return;
    const cx = 130, cy = 130, r = 100, sw = 22;
    let html = '';
    hideDonutDetail(scope);
    explodedSlice[scope] = null;
    if (total === 0 || labels.length === 0) {
      html += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="' + sw + '"/>';
      html += '<text x="' + cx + '" y="' + (cy - 8) + '" text-anchor="middle" fill="#FAFAFA" font-size="28" font-weight="700">$0</text>';
      html += '<text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" fill="#76746E" font-size="18">Total Amount</text>';
      svg.innerHTML = html;
      legend.innerHTML = '<div class="fin-legend-item"><span style="color:#76746E">No data</span></div>';
      bindDonutClick(svg, scope);
      return;
    }
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    for (let i = 0; i < labels.length; i++) {
      const pct = labels[i].amount / total;
      const dashLen = pct * circumference;
      const gap = circumference - dashLen;
      const color = getTagColor(labels[i].tag, scope);
      const midArc = offset + dashLen / 2;
      const midAngle = midArc / r;
      html += '<g transform="rotate(-90 ' + cx + ' ' + cy + ')">';
      html += '<circle class="fin-donut-slice" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + sw + '" stroke-dasharray="' + dashLen + ' ' + gap + '" stroke-dashoffset="' + (-offset) + '" data-index="' + i + '" data-label="' + escHtml(labels[i].tag) + '" data-amount="' + labels[i].amount + '" data-mid-angle="' + midAngle + '" />';
      html += '</g>';
      offset += dashLen;
    }
    html += '<text class="fin-donut-val" x="' + cx + '" y="' + (cy - 8) + '" text-anchor="middle" fill="#FAFAFA" font-size="28" font-weight="700">' + fmtK(total) + '</text>';
    html += '<text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" fill="#76746E" font-size="18">Total Amount</text>';
    svg.innerHTML = html;
    // Staggered slice entrance
    const slices = svg.querySelectorAll('.fin-donut-slice');
    slices.forEach((s, i) => { s.style.animationDelay = (i * 0.06) + 's'; });
    // Tween center text
    const donutScope = svgId === 'incomeDonut' ? 'income' : 'expense';
    const prevTotal = _prevDonutTotals[donutScope];
    _prevDonutTotals[donutScope] = total;
    if (prevTotal !== 0 && prevTotal !== total) {
      const valEl = svg.querySelector('.fin-donut-val');
      if (valEl) tweenDonutText(valEl, prevTotal, total);
    }
    svg.classList.remove('fin-donut-entrance');
    void svg.offsetHeight;
    svg.classList.add('fin-donut-entrance');
    let legendHtml = '';
    for (let i = 0; i < labels.length; i++) {
      const displayName = getTagDisplayName(labels[i].tag, scope);
      legendHtml += '<div class="fin-legend-item"><span class="fin-legend-dot" style="background:' + getTagColor(labels[i].tag, scope) + '"></span>' + displayName + '</div>';
    }
    legend.innerHTML = legendHtml;
    bindDonutClick(svg, scope);
  }

  function bindDonutClick(svg, scope) {
    if (svg._sliceClickBound) return;
    svg._sliceClickBound = true;
    svg.addEventListener('click', (e) => {
      const slice = e.target.closest && e.target.closest('.fin-donut-slice');
      if (!slice) return;
      const label = slice.getAttribute('data-label');
      const current = explodedSlice[scope];
      if (current && current === label) { collapseDonut(svg, scope); return; }
      explodeDonutSlice(svg, scope, slice);
    });
  }

  function collapseDonut(svg, scope) {
    const slices = svg.querySelectorAll('.fin-donut-slice');
    for (let i = 0; i < slices.length; i++) { slices[i].style.transform = ''; slices[i].classList.remove('is-exploded'); slices[i].classList.remove('is-dimmed'); }
    explodedSlice[scope] = null;
    hideDonutDetail(scope);
  }

  function explodeDonutSlice(svg, scope, slice) {
    const slices = svg.querySelectorAll('.fin-donut-slice');
    const midAngle = parseFloat(slice.getAttribute('data-mid-angle'));
    const dx = Math.cos(midAngle) * 12;
    const dy = Math.sin(midAngle) * 12;
    for (let i = 0; i < slices.length; i++) {
      if (slices[i] === slice) { slices[i].style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; slices[i].classList.add('is-exploded'); slices[i].classList.remove('is-dimmed'); }
      else { slices[i].style.transform = ''; slices[i].classList.remove('is-exploded'); slices[i].classList.add('is-dimmed'); }
    }
    explodedSlice[scope] = slice.getAttribute('data-label');
    showDonutDetail(scope, slice.getAttribute('data-label'), slice.style.stroke || slice.getAttribute('stroke'), parseFloat(slice.getAttribute('data-amount')));
  }

  function hideDonutDetail(scope) {
    const detail = $((scope === 'income' ? 'income' : 'expense') + 'DonutDetail');
    if (!detail) return;
    if (detail._hideHandler) { detail.removeEventListener('transitionend', detail._hideHandler); }
    detail.style.maxHeight = detail.scrollHeight + 'px';
    detail.style.opacity = '1';
    detail.style.transform = 'translateY(0)';
    detail.style.padding = '10px 12px';
    requestAnimationFrame(() => { requestAnimationFrame(() => { detail.style.maxHeight = '0'; detail.style.opacity = '0'; detail.style.transform = 'translateY(-4px)'; detail.style.padding = '0 12px'; }); });
    detail._hideHandler = (e) => {
      if (e.propertyName === 'max-height' && e.target === detail) {
        detail.removeEventListener('transitionend', detail._hideHandler);
        detail._hideHandler = null; detail.hidden = true; detail.innerHTML = '';
        detail.style.maxHeight = ''; detail.style.opacity = ''; detail.style.transform = ''; detail.style.padding = '';
      }
    };
    detail.addEventListener('transitionend', detail._hideHandler);
  }

  function showDonutDetail(scope, label, color, amount) {
    const detail = $((scope === 'income' ? 'income' : 'expense') + 'DonutDetail');
    if (!detail) return;
    if (detail._hideHandler) { detail.removeEventListener('transitionend', detail._hideHandler); detail._hideHandler = null; detail.style.opacity = ''; detail.style.transform = ''; detail.style.padding = ''; }
    const ctx = donutContext[scope];
    const matching = [];
    for (let i = 0; i < ctx.items.length; i++) { if ((ctx.items[i].tags || []).indexOf(label) !== -1) matching.push(ctx.items[i]); }
    const sorted = sortByDate(matching).slice().reverse();
    const pct = ctx.total > 0 ? (amount / ctx.total * 100) : 0;
    const resolvedColor = color || getTagColor(label, scope);
    let html = '';
    html += '<div class="fin-donut-detail-header"><span class="fin-donut-detail-dot" style="background:' + resolvedColor + '"></span><span>' + escHtml(getTagDisplayName(label, scope)) + '</span></div>';
    html += '<div class="fin-donut-detail-stats"><span><strong>' + fmt(amount) + '</strong></span><span>' + pct.toFixed(1) + '% of ' + periodShortLabel(activePeriod) + '</span></div>';
    if (sorted.length === 0) { html += '<div class="fin-donut-detail-empty">No transactions in this period.</div>'; }
    else {
      html += '<div class="fin-donut-detail-list">';
      for (let i = 0; i < sorted.length; i++) { html += '<div class="fin-donut-detail-row"><span>' + formatDate(sorted[i].date) + ' &middot; ' + escHtml(sorted[i].source) + '</span><span><strong>' + fmt(sorted[i].amount) + '</strong></span></div>'; }
      html += '</div>';
    }
    const wasVisible = !detail.hidden;
    detail.innerHTML = html;
    const setHeight = () => { requestAnimationFrame(() => { requestAnimationFrame(() => { detail.style.maxHeight = detail.scrollHeight + 'px'; }); }); };
    if (wasVisible) setHeight();
    else { detail.style.maxHeight = '0'; detail.hidden = false; setHeight(); }
  }

  // --- Table rendering (income, expense, cell editing) ---

  function renderTable(data, scope, q) {
    const isIncome = scope === 'income';
    const container = $(isIncome ? 'incomeTable' : 'expenseTable');
    if (!container) return;
    const months = periodMonths(q);
    const items = isIncome ? data.income : data.expenses;
    const dataKey = isIncome ? 'income' : 'expenses';
    const tagScope = isIncome ? 'income' : 'expense';
    const delAttr = isIncome ? 'data-del-income' : 'data-del-expense';
    const addAttr = isIncome ? 'data-add-income-month' : 'data-add-expense-month';
    const tableScope = isIncome ? 'income' : 'expenses';
    const wireScope = isIncome ? 'income' : 'expense';
    const s = tableSortState[tableScope];
    const activeCls = (col) => s.col === col ? ' is-sortable is-active' : ' is-sortable';
    const thSource = '<th style="text-align:left" class="' + activeCls('source') + '" data-sort-col="source" data-sort-scope="' + tableScope + '">Source' + sortIcon(tableScope, 'source') + '</th>';
    const thAmount = '<th class="' + activeCls('amount') + '" data-sort-col="amount" data-sort-scope="' + tableScope + '">Amount' + sortIcon(tableScope, 'amount') + '</th>';
    const thTags = '<th class="' + activeCls('tags') + '" data-sort-col="tags" data-sort-scope="' + tableScope + '">Tags' + sortIcon(tableScope, 'tags') + '</th>';
    const thDate = '<th class="' + activeCls('date') + '" data-sort-col="date" data-sort-scope="' + tableScope + '">Date' + sortIcon(tableScope, 'date') + '</th>';
    let html = '';
    for (let mi = 0; mi < months.length; mi++) {
      const m = months[mi];
      const filtered = getSortItems(items.filter((item) => monthIdx(item.date) === m), tableScope);
      let sum = 0;
      for (let i = 0; i < filtered.length; i++) sum += filtered[i].amount;
      html += '<div class="fin-table-group" data-month="' + m + '">';
      html += '<div class="fin-table-group-header" data-toggle-group="true"><span class="fin-group-arrow">&#9660;</span>' + (m+1) + '. ' + MONTH_NAMES[m] + '<span class="fin-table-group-count">' + filtered.length + '</span></div>';
      html += '<table class="fin-table"><thead><tr>' + thSource + thAmount + thTags + thDate + '<th style="width:30px"></th></tr></thead><tbody>';
      for (let i = 0; i < filtered.length; i++) {
        html += '<tr><td style="text-align:left"><div class="fin-cell-inner" data-field="source" data-id="' + filtered[i].id + '">' + escHtml(filtered[i].source) + '</div></td>';
        html += '<td><div class="fin-cell-inner" data-field="amount" data-id="' + filtered[i].id + '">' + fmt(filtered[i].amount) + '</div></td>';
        html += '<td><div class="fin-cell-inner" data-field="tags" data-id="' + filtered[i].id + '">' + tagsHtml(filtered[i].tags, tagScope) + '</div></td>';
        html += '<td><div class="fin-cell-inner" data-field="date" data-id="' + filtered[i].id + '" data-dateval="' + filtered[i].date + '">' + formatDate(filtered[i].date) + '</div></td>';
        html += '<td style="width:30px"><button class="fin-del-btn" ' + delAttr + '="' + filtered[i].id + '">&times;</button></td></tr>';
      }
      html += '</tbody></table>';
      html += '<div class="fin-table-group-sum">' + fmt(sum) + '</div>';
      html += '<button class="fin-add-row-btn" ' + addAttr + '="' + m + '">&#43; Add</button></div>';
    }
    container.innerHTML = html;
    const rows = container.querySelectorAll('.fin-table tbody tr');
    rows.forEach((r, i) => { r.style.animation = 'row-entrance 0.35s var(--ease-out) both'; r.style.animationDelay = (i * 0.025) + 's'; });
    wireTableEdit(container, wireScope);
  }

  function renderIncomeTable(data, q) { renderTable(data, 'income', q); }
  function renderExpenseTable(data, q) { renderTable(data, 'expense', q); }

  function wireTableEdit(container, scope) {
    container.querySelectorAll('.fin-cell-inner').forEach((cell) => {
      cell.addEventListener('click', () => { if (cell.querySelector('input')) return; activateCell(cell, scope); });
    });
    container.querySelectorAll('.fin-del-btn[data-del-income]').forEach((btn) => {
      btn.addEventListener('click', () => { deleteIncome(parseInt(btn.getAttribute('data-del-income'))); });
    });
    container.querySelectorAll('.fin-del-btn[data-del-expense]').forEach((btn) => {
      btn.addEventListener('click', () => { deleteExpense(parseInt(btn.getAttribute('data-del-expense'))); });
    });
    container.querySelectorAll('.fin-add-row-btn[data-add-income-month]').forEach((btn) => {
      btn.addEventListener('click', () => { addIncomeRow(parseInt(btn.getAttribute('data-add-income-month'))); });
    });
    container.querySelectorAll('.fin-add-row-btn[data-add-expense-month]').forEach((btn) => {
      btn.addEventListener('click', () => { addExpenseRow(parseInt(btn.getAttribute('data-add-expense-month'))); });
    });
    container.querySelectorAll('th.is-sortable').forEach((th) => {
      th.addEventListener('click', () => { const col = th.getAttribute('data-sort-col'); const sc = th.getAttribute('data-sort-scope'); cycleSort(sc, col); renderFinances(); });
    });
    container.querySelectorAll('[data-toggle-group]').forEach((header) => {
      header.addEventListener('click', () => { window.toggleGroup(header); });
    });
  }

  function activateCell(cell, scope) {
    const field = cell.getAttribute('data-field');
    const id = parseInt(cell.getAttribute('data-id'));
    const data = loadData();
    const items = data[scope === 'income' ? 'income' : 'expenses'];
    let item = null;
    for (let i = 0; i < items.length; i++) { if (items[i].id === id) { item = items[i]; break; } }
    if (!item) return;
    if (field === 'date') {
      const input = document.createElement('input');
      input.type = 'date'; input.className = 'fin-cell-date-input'; input.value = cell.getAttribute('data-dateval');
      cell.textContent = ''; cell.appendChild(input); cell.classList.add('is-editing');
      input.focus(); input.showPicker && input.showPicker();
      input.addEventListener('blur', () => { if (input.value) { item.date = input.value; saveData(data); } renderFinances(); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (input.value) { item.date = input.value; saveData(data); } moveNextRow(cell); } else if (e.key === 'Escape') { e.preventDefault(); input.value = cell.getAttribute('data-dateval'); input.blur(); } });
    } else if (field === 'tags') {
      showTagPicker(cell, scope, id, item.tags || []);
    } else {
      const input = document.createElement('input');
      input.type = field === 'amount' ? 'number' : 'text'; input.className = 'fin-cell-input';
      input.step = field === 'amount' ? '0.01' : ''; input.min = field === 'amount' ? '0' : '';
      if (field === 'amount') input.value = item.amount;
      else input.value = item.source || '';
      cell.textContent = ''; cell.appendChild(input); cell.classList.add('is-editing');
      input.focus(); input.select && input.select();
      function saveAndClose() {
        const val = input.value.trim();
        if (field === 'source') {
          if (!val) { data[scope === 'income' ? 'income' : 'expenses'] = data[scope === 'income' ? 'income' : 'expenses'].filter((x) => x.id !== id); saveData(data); renderFinances(); return; }
          item.source = val;
        } else if (field === 'amount') { let num = parseFloat(val); if (isNaN(num) || num < 0) num = 0; item.amount = num; }
        saveData(data); renderFinances();
      }
      input.addEventListener('blur', saveAndClose);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); input.value = field === 'amount' ? item.amount : item.source; input.blur(); }
        else if (e.key === 'Tab') {
          e.preventDefault(); input.blur();
          const tr = cell.closest('tr');
          const cells = Array.prototype.slice.call(tr.querySelectorAll('.fin-cell-inner'));
          const ci = cells.indexOf(cell);
          let next = e.shiftKey ? cells[ci - 1] : cells[ci + 1];
          if (!next && !e.shiftKey) { const nextTr = tr.nextElementSibling; if (nextTr) { const nextCell = nextTr.querySelector('.fin-cell-inner[data-field="source"]'); if (nextCell) setTimeout(() => { activateCell(nextCell, scope); }, 20); } }
          if (next) setTimeout(() => { activateCell(next, scope); }, 20);
        }
      });
    }
  }

  function moveNextRow(cell) {
    const tr = cell.closest('tr');
    const colIdx = Array.prototype.slice.call(tr.children).indexOf(cell.parentElement);
    const nextTr = tr.nextElementSibling;
    if (nextTr && nextTr.querySelector('.fin-cell-inner')) {
      const cells = Array.prototype.slice.call(nextTr.querySelectorAll('.fin-cell-inner'));
      const target = cells[colIdx] || cells[0];
      const sc = target.getAttribute('data-field') ? (target.closest('#incomeTable') ? 'income' : 'expense') : 'income';
      setTimeout(() => { activateCell(target, sc); }, 20);
    }
  }

  function tagsHtml(tags, scope) {
    if (!tags || tags.length === 0) return '';
    let html = '';
    for (let i = 0; i < tags.length; i++) { const color = getTagColor(tags[i], scope); html += '<span class="fin-tag" style="' + tagColorStyle(color) + '">' + escHtml(getTagDisplayName(tags[i], scope)) + '</span> '; }
    return html;
  }



  // --- Period/quarter controls ---

  let activeQuarters = { savings: 'all', income: 'q' + (Math.floor(new Date().getMonth() / 3) + 1), expense: 'q' + (Math.floor(new Date().getMonth() / 3) + 1) };

  function getCurrentQuarter() { const m = new Date().getMonth(); if (m < 3) return 'q1'; if (m < 6) return 'q2'; if (m < 9) return 'q3'; return 'q4'; }

  let quarterBtnsBound = false;

  function bindQuarterBtns() {
    const btns = document.querySelectorAll('.fin-qbtn');
    btns.forEach((btn) => { const scope = btn.parentElement.getAttribute('data-scope'); if (scope === 'finance-period') return; btn.classList.toggle('is-active', activeQuarters[scope] === btn.getAttribute('data-q')); });
    if (quarterBtnsBound) return;
    quarterBtnsBound = true;
    btns.forEach((btn) => {
      const scope = btn.parentElement.getAttribute('data-scope');
      if (scope === 'finance-period') return;
      btn.addEventListener('click', () => {
        const data = loadData();
        const q = btn.getAttribute('data-q');
        activeQuarters[scope] = q;
        if (scope === 'income') renderIncomeTable(data, q);
        else if (scope === 'expense') renderExpenseTable(data, q);
        btn.parentElement.querySelectorAll('.fin-qbtn').forEach((b) => { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
      });
    });
  }

  function closeOtherGroups(currentGroup) {
    const bar = $('financePeriodBar');
    if (!bar) return;
    bar.querySelectorAll('.fin-period-group').forEach((otherGroup) => {
      if (otherGroup !== currentGroup) { otherGroup.querySelector('.fin-period-group-toggle').classList.remove('is-open'); otherGroup.querySelector('.fin-period-group-children').classList.remove('is-visible'); }
    });
  }

  function togglePeriodGroup(toggleBtn) {
    const group = toggleBtn.parentElement;
    const children = group.querySelector('.fin-period-group-children');
    const isOpen = toggleBtn.classList.toggle('is-open');
    children.classList.toggle('is-visible', isOpen);
    if (isOpen) closeOtherGroups(group);
  }

  let periodBtnsBound = false;

  function switchPeriod(period, bar) {
    activePeriod = period;
    explodedSlice.income = null; explodedSlice.expense = null;
    hideDonutDetail('income'); hideDonutDetail('expense');
    bar.querySelectorAll('.fin-qbtn').forEach((b) => { b.classList.remove('is-active'); });
    const target = bar.querySelector('[data-period="' + period + '"]');
    if (target) target.classList.add('is-active');
    const overview = $('finOverview');
    if (!overview) { renderDashboard(loadData()); return; }
    overview.style.transition = 'opacity 0.15s ease';
    overview.style.opacity = '0';
    setTimeout(() => {
      renderDashboard(loadData());
      overview.style.transition = 'opacity 0.35s ease';
      requestAnimationFrame(() => {
        overview.style.opacity = '1';
        const newCards = overview.querySelectorAll('.fin-card');
        newCards.forEach((c, i) => { c.style.setProperty('--i', i); c.classList.add('is-entering'); });
        const maxDelay = newCards.length * 100;
        setTimeout(() => { newCards.forEach((c) => c.classList.remove('is-entering')); }, maxDelay + 600);
      });
    }, 150);
  }

  function bindPeriodBtns() {
    const bar = $('financePeriodBar');
    if (!bar) return;
    const btns = bar.querySelectorAll('.fin-qbtn');
    btns.forEach((btn) => { btn.classList.toggle('is-active', activePeriod === btn.getAttribute('data-period')); });
    if (periodBtnsBound) return;
    periodBtnsBound = true;
    bar.querySelectorAll('.fin-period-group-toggle').forEach((toggleBtn) => {
      toggleBtn.addEventListener('click', () => togglePeriodGroup(toggleBtn));
    });
    const monthsGroup = bar.querySelector('.fin-period-group');
    if (activePeriod.indexOf('m') === 0 && monthsGroup) {
      togglePeriodGroup(monthsGroup.querySelector('.fin-period-group-toggle'));
    }
    // Flat pill buttons (direct children of bar, not inside .fin-period-group)
    bar.querySelectorAll(':scope > .fin-qbtn').forEach((btn) => {
      btn.addEventListener('click', () => { switchPeriod(btn.getAttribute('data-period'), bar); });
    });
    // Month buttons inside the group
    bar.querySelectorAll('.fin-period-group .fin-qbtn').forEach((btn) => {
      btn.addEventListener('click', () => { switchPeriod(btn.getAttribute('data-period'), bar); });
    });
  }

  window.toggleGroup = function(header) {
    header.classList.toggle('collapsed');
    const group = header.parentElement;
    const table = group.querySelector('.fin-table');
    const sum = group.querySelector('.fin-table-group-sum');
    if (table) table.style.display = header.classList.contains('collapsed') ? 'none' : '';
    if (sum) sum.style.display = header.classList.contains('collapsed') ? 'none' : '';
  };

  window.deleteIncome = function(id) { const data = loadData(); data.income = data.income.filter((item) => item.id !== id); saveData(data); renderFinances(); };
  window.deleteExpense = function(id) { const data = loadData(); data.expenses = data.expenses.filter((item) => item.id !== id); saveData(data); renderFinances(); };

  function addIncomeRow(m) { const data = loadData(); const now = new Date(); data.income.push({id: uid(), source: '', amount: 0, tags: [], date: now.getFullYear() + '-' + pad2(m+1) + '-' + pad2(now.getDate())}); saveData(data); renderFinances(); }
  function addExpenseRow(m) { const data = loadData(); const now = new Date(); data.expenses.push({id: uid(), source: '', amount: 0, tags: [], date: now.getFullYear() + '-' + pad2(m+1) + '-' + pad2(now.getDate())}); saveData(data); renderFinances(); }

  function renderFinances() { const data = loadData(); renderDashboard(data); renderIncomeTable(data, activeQuarters.income); renderExpenseTable(data, activeQuarters.expense); bindQuarterBtns(); bindPeriodBtns(); renderGoals(); }
  function renderDashboard(data) { renderYearlySavings(data); renderIncomeDonut(data); renderExpenseDonut(data); }

  const GOALS_KEY = 'finance_goals_v1';

  function loadGoals() { try { const raw = localStorage.getItem(GOALS_KEY); if (!raw) return { goals: [], activeGoalId: null, showDetail: false }; const d = JSON.parse(raw); if (!d.goals) d.goals = []; if (d.showDetail === undefined) d.showDetail = false; return d; } catch(e) { return { goals: [], activeGoalId: null, showDetail: false }; } }
  function saveGoals(g) { localStorage.setItem(GOALS_KEY, JSON.stringify(g)); }

  function gtActiveGoal(state) { if (!state.goals.length) return null; for (let i = 0; i < state.goals.length; i++) { if (state.goals[i].id === state.activeGoalId) return state.goals[i]; } return state.goals[0]; }

  function gtMonthKey(dateStr) { if (!dateStr) { const n = new Date(); return n.getFullYear() * 12 + n.getMonth(); } const p = dateStr.split('-'); return parseInt(p[0], 10) * 12 + (parseInt(p[1], 10) - 1); }

  function gtMonthsPresent(data) { const s = {}; data.income.forEach((it) => { s[gtMonthKey(it.date)] = true; }); data.expenses.forEach((it) => { s[gtMonthKey(it.date)] = true; }); return Object.keys(s).map(Number).sort((a,b) => a - b); }

  function gtNetForMonth(data, mi) { let inc = 0, exp = 0; data.income.forEach((it) => { if (gtMonthKey(it.date) === mi) inc += Number(it.amount) || 0; }); data.expenses.forEach((it) => { if (gtMonthKey(it.date) === mi) exp += Number(it.amount) || 0; }); return inc - exp; }

  function gtBaselineRate(data) { const m = gtMonthsPresent(data); if (!m.length) return { rate: 0, months: 0 }; const win = m.slice(-3); let sum = 0; win.forEach((mi) => { sum += gtNetForMonth(data, mi); }); return { rate: sum / win.length, months: win.length }; }

  function gtCategoryAvgs(data) { const s = {}; data.expenses.forEach((e) => { s[gtMonthKey(e.date)] = true; }); const em = Object.keys(s).map(Number).sort((a,b) => a - b); if (!em.length) return {}; const win = em.slice(-3); const N = win.length; const byCat = {}; data.expenses.forEach((e) => { const mi = gtMonthKey(e.date); if (win.indexOf(mi) === -1) return; const tags = (e.tags && e.tags.length) ? e.tags : ['Uncategorized']; tags.forEach((t) => { byCat[t] = (byCat[t] || 0) + (Number(e.amount) || 0); }); }); const out = {}; Object.keys(byCat).forEach((k) => { out[k] = byCat[k] / N; }); return out; }

  function gtPlanSavings(goal, catAvgs) { let sum = 0; Object.keys(catAvgs).forEach((c) => { const p = goal.plan && goal.plan[c]; if (!p || p.mode === 'keep') return; if (p.mode === 'cut') sum += catAvgs[c]; else if (p.mode === 'reduce') sum += catAvgs[c] * (Math.max(0, Math.min(100, p.reducePct || 0)) / 100); }); return sum; }

  function gtEtaMonths(remaining, rate) { if (remaining <= 0) return 0; if (rate <= 0) return Infinity; return Math.ceil(remaining / rate); }

  function gtEtaDateLabel(months) { if (!isFinite(months)) return 'never at current rate'; if (months <= 0) return 'goal reached'; if (months > 600) return '50+ years'; const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + months); return MONTH_NAMES[d.getMonth()].slice(0,3) + ' ' + d.getFullYear(); }

  function gtMonthsLabel(months) { if (!isFinite(months)) return '\u221E'; if (months <= 0) return '0 mo'; if (months > 600) return '50+ yr'; if (months < 12) return months + ' mo'; const y = Math.floor(months / 12), m = months % 12; return y + 'y' + (m ? ' ' + m + 'mo' : ''); }

  function gtTween(el, from, to, fmtFn) { if (el._tween) cancelAnimationFrame(el._tween); const start = performance.now(), dur = 300; function step(t) { const p = Math.min(1, (t - start) / dur); const eased = 1 - Math.pow(1 - p, 3); el.textContent = fmtFn(from + (to - from) * eased); if (p < 1) el._tween = requestAnimationFrame(step); } el._tween = requestAnimationFrame(step); }

  const gtEscape = window.escHtml;

  let gtPrevPlanEta = null;
  let gtPrevShowDetail = false;
  let _gtDocClickHandler = null;

  // --- Monetary Goal Tracker ---

  function renderGoals() {
    const root = $('gtRoot');
    if (!root) return;
    const state = loadGoals();
    const data = loadData();
    const baseline = gtBaselineRate(data);
    const catAvgs = gtCategoryAvgs(data);
    const goal = gtActiveGoal(state);
    let html = '<div class="gt-chips">';
    state.goals.forEach((g) => {
      const pct = g.target > 0 ? Math.max(0, Math.min(100, (g.saved / g.target) * 100)) : 0;
      html += '<div class="gt-chip ' + (goal && g.id === goal.id && state.showDetail ? 'is-active' : '') + '" data-gid="' + g.id + '"><div class="gt-chip-name">' + gtEscape(g.name) + '</div><div class="gt-chip-bar"><div class="gt-chip-bar-fill" style="width:' + pct.toFixed(1) + '%"></div></div><div class="gt-chip-meta"><span>' + fmtK(g.saved) + ' / ' + fmtK(g.target) + '</span><span>' + pct.toFixed(0) + '%</span></div></div>';
    });
    html += '</div><div id="gtAddForm" style="display:none;"></div>';
    if (!goal) { html += '<div class="gt-card card is-expanded gt-empty"><div class="gt-card-inner"><div>No goals yet. Add your first monetary goal to start tracking.</div><button class="gt-btn primary" id="gtEmptyAdd">+ Add a goal</button></div></div>'; root.innerHTML = html; gtBindEvents(state, data, baseline, catAvgs); return; }
    const pct = goal.target > 0 ? Math.max(0, Math.min(100, (goal.saved / goal.target) * 100)) : 0;
    const remaining = Math.max(0, goal.target - goal.saved);
    const R = 86, C = 2 * Math.PI * R;
    const offset = C * (1 - pct / 100);
    const planSavings = gtPlanSavings(goal, catAvgs);
    const planRate = baseline.rate + planSavings;
    const baseEta = gtEtaMonths(remaining, baseline.rate);
    const planEta = gtEtaMonths(remaining, planRate);
    const monthsSaved = (isFinite(baseEta) && isFinite(planEta)) ? Math.max(0, baseEta - planEta) : 0;
    html += '<div class="gt-card card' + (gtPrevShowDetail ? ' is-expanded' : '') + '"><div class="gt-card-inner"><div class="gt-detail"><div class="gt-ring"><svg viewBox="0 0 200 200"><defs><filter id="gtRingGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle class="gt-ring-track" cx="100" cy="100" r="' + R + '"/><circle class="gt-ring-fill" cx="100" cy="100" r="' + R + '" transform="rotate(-90 100 100)" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + offset.toFixed(2) + '"/></svg><div class="gt-ring-text"><div class="gt-ring-pct">' + pct.toFixed(0) + '%</div><div class="gt-ring-sub">saved</div></div></div>';
    html += '<div class="gt-info" id="gtInfo"><div class="gt-name-row"><div class="gt-name" id="gtName" title="Click to edit">' + gtEscape(goal.name) + '</div><div class="gt-actions"><button class="gt-btn" id="gtEdit">Edit</button><button class="gt-btn danger" id="gtDelete">Delete</button><button class="gt-btn primary" id="gtAddAnother">+ Goal</button></div></div>';
    html += '<div class="gt-figures"><div class="gt-fig"><div class="gt-fig-lbl">Saved</div><div class="gt-fig-val">' + fmt(goal.saved) + '</div></div><div class="gt-fig"><div class="gt-fig-lbl">Target</div><div class="gt-fig-val">' + fmt(goal.target) + '</div></div><div class="gt-fig"><div class="gt-fig-lbl">Remaining</div><div class="gt-fig-val">' + fmt(remaining) + '</div></div>';
    if (goal.deadline) html += '<div class="gt-fig"><div class="gt-fig-lbl">Deadline</div><div class="gt-fig-val">' + formatDate(goal.deadline) + '</div></div>';
    html += '</div>';
    const savedStep = Math.max(10, Math.round((goal.target / 100) / 10) * 10);
    const savedNum = Number(goal.saved) || 0;
    html += '<div class="gt-saved-edit"><button class="gt-btn" data-delta="' + (-savedStep) + '">\u2212' + fmtK(savedStep) + '</button><input class="gt-input num" id="gtSavedInput" type="number" step="1" value="' + savedNum + '"/><button class="gt-btn" data-delta="' + savedStep + '">+' + fmtK(savedStep) + '</button><button class="gt-btn primary" id="gtSavedApply">Set</button></div>';
    if (baseline.months === 0) html += '<div class="gt-rate"><span class="gt-rate-val">No data</span><span class="gt-rate-note">Add income/expenses to compute ETA.</span></div>';
    else if (baseline.rate <= 0) html += '<div class="gt-rate"><span class="gt-rate-val" style="color:var(--danger);">' + fmt(baseline.rate) + '/mo</span><span class="gt-rate-note">Negative savings \u2014 reduce spending below to make progress.</span></div>';
    else html += '<div class="gt-rate"><span class="gt-rate-val">' + fmt(baseline.rate) + '/mo</span><span class="gt-rate-note">Monthly savings rate \u00b7 based on last ' + baseline.months + ' month' + (baseline.months === 1 ? '' : 's') + '</span></div>';
    html += '<div class="gt-etas"><div class="gt-eta"><div class="gt-eta-lbl">Baseline ETA</div><div class="gt-eta-val">' + gtMonthsLabel(baseEta) + '</div><div class="gt-eta-sub">' + gtEtaDateLabel(baseEta) + '</div></div>';
    html += '<div class="gt-eta plan"><div class="gt-eta-lbl">With plan</div><div class="gt-eta-val" id="gtPlanEta">' + gtMonthsLabel(planEta) + '</div><div class="gt-eta-sub" id="gtPlanEtaSub">' + gtEtaDateLabel(planEta) + '</div>';
    if (monthsSaved > 0) html += '<div class="gt-eta-saved" id="gtTimeSaved">Time saved: ' + monthsSaved + ' mo</div>';
    else html += '<div class="gt-eta-saved" id="gtTimeSaved" style="opacity:0.5;">\u2014</div>';
    html += '</div></div></div>';
    if (goal.deadline && remaining > 0) {
      const dl = parseDate(goal.deadline);
      const now = new Date(); now.setDate(1);
      const monthsTo = (dl.getFullYear() - now.getFullYear()) * 12 + (dl.getMonth() - now.getMonth());
      let cls, msg;
      if (monthsTo <= 0) { cls = 'bad'; msg = 'Deadline has passed.'; }
      else if (isFinite(baseEta) && baseEta <= monthsTo) { cls = 'ok'; msg = 'On track \u2014 ' + (monthsTo - baseEta) + ' mo buffer at current rate.'; }
      else if (isFinite(planEta) && planEta <= monthsTo) { cls = 'warn'; msg = 'Behind at current rate, but your plan would meet the deadline.'; }
      else if (isFinite(baseEta)) { cls = 'bad'; msg = 'Impossible at current rate \u2014 needs ' + (baseEta - monthsTo) + ' more mo.'; }
      else { cls = 'bad'; msg = 'Impossible at current rate (no savings).'; }
      html += '<div class="gt-deadline ' + cls + '">' + msg + '</div>';
    }
    html += '</div>';
    const cats = Object.keys(catAvgs).sort((a,b) => catAvgs[b] - catAvgs[a]);
    if (cats.length) {
      html += '<div class="gt-plan"><div class="gt-plan-title"><span>Optimize your plan</span><button class="gt-btn" id="gtResetPlan">Reset plan</button></div>';
      cats.forEach((cat) => {
        const avg = catAvgs[cat];
        const p = (goal.plan && goal.plan[cat]) || { mode: 'keep', reducePct: 50 };
        const color = getTagColor(cat, 'expense');
        const saveAmt = p.mode === 'cut' ? avg : (p.mode === 'reduce' ? avg * ((p.reducePct||0)/100) : 0);
        html += '<div class="gt-cat-row" data-cat="' + gtEscape(cat) + '"><div class="gt-cat-dot" style="background:' + color + '"></div><div class="gt-cat-main"><div class="gt-cat-line"><span class="gt-cat-name">' + gtEscape(cat) + '</span><span class="gt-cat-amt">' + fmt(avg) + '/mo</span></div>';
        html += '<div class="gt-slider-wrap ' + (p.mode === 'reduce' ? 'show' : '') + '"><input type="range" min="0" max="100" step="5" value="' + (p.reducePct||50) + '" class="gt-slider"/><span class="gt-slider-pct">' + (p.reducePct||50) + '%</span><span class="gt-slider-save">saving ' + fmt(saveAmt) + '/mo</span></div>';
        if (p.mode === 'cut') html += '<div class="gt-cat-amt" style="color:var(--success);">cutting \u00b7 saves ' + fmt(avg) + '/mo</div>';
        html += '</div><div class="gt-seg">';
        ['keep','reduce','cut'].forEach((mode) => { html += '<button type="button" data-mode="' + mode + '" class="' + (p.mode === mode ? 'is-active' : '') + '">' + mode.charAt(0).toUpperCase() + mode.slice(1) + '</button>'; });
        html += '</div></div>';
      });
      html += '<div class="gt-plan-summary"><span>Plan saves <span class="v">' + fmt(planSavings) + '/mo</span></span><span>Finish <span class="v">' + monthsSaved + ' month' + (monthsSaved === 1 ? '' : 's') + '</span> earlier</span></div></div>';
    } else { html += '<div class="gt-empty" style="padding:18px;">No expense data yet \u2014 add expenses in the tables above to optimize your plan.</div>'; }
    html += '</div></div>';
    root.innerHTML = html;
    if (state.showDetail) {
      const card = root.querySelector('.gt-card');
      if (!card) return;
      const inner = card.querySelector('.gt-card-inner');
      card.classList.add('is-expanded');
      if (inner) requestAnimationFrame(() => { card.style.maxHeight = inner.scrollHeight + 'px'; });
    } else {
      const card = root.querySelector('.gt-card');
      if (card) {
        const inner = card.querySelector('.gt-card-inner');
        if (inner) {
          card.style.transition = 'none';
          card.style.maxHeight = inner.scrollHeight + 'px';
          void card.offsetHeight;
          card.style.transition = '';
        }
        card.style.maxHeight = '0';
        card.classList.remove('is-expanded');
      }
    }
    gtPrevShowDetail = state.showDetail;
    gtPrevPlanEta = planEta;
    gtBindEvents(state, data, baseline, catAvgs);
  }

  function gtOpenAddForm(state) {
    const form = $('gtAddForm');
    if (!form) return;
    form.style.display = '';
    form.innerHTML = '<div class="gt-addform"><input class="gt-input" id="gtNewName" placeholder="Goal name" maxlength="60"/><input class="gt-input num" id="gtNewTarget" type="number" placeholder="Target $" min="1"/><input class="gt-input" id="gtNewDeadline" type="date"/><button class="gt-btn primary" id="gtNewSave">Save</button><button class="gt-btn" id="gtNewCancel">Cancel</button></div>';
    const nameEl = $('gtNewName');
    if (nameEl) nameEl.focus();
    $('gtNewCancel').addEventListener('click', (e) => { e.stopPropagation(); form.style.display = 'none'; form.innerHTML = ''; });
    $('gtNewSave').addEventListener('click', () => {
      const name = $('gtNewName').value.trim();
      const target = parseFloat($('gtNewTarget').value);
      const deadline = $('gtNewDeadline').value || null;
      if (!name || !target || target <= 0) return;
      const g = { id: Date.now() + Math.floor(Math.random()*1000), name, target, saved: 0, deadline, createdAt: new Date().toISOString(), plan: {} };
      state.goals.push(g); state.activeGoalId = g.id; saveGoals(state); renderGoals();
    });
  }

  function gtOpenEditForm(state, goal) {
    const info = $('gtInfo');
    if (!info) return;
    info.innerHTML = '<div class="gt-addform"><input class="gt-input" id="gtEditName" value="' + gtEscape(goal.name) + '" maxlength="60"/><input class="gt-input num" id="gtEditTarget" type="number" value="' + goal.target + '" min="1"/><input class="gt-input" id="gtEditDeadline" type="date" value="' + (goal.deadline || '') + '"/><button class="gt-btn primary" id="gtEditSave">Save</button><button class="gt-btn" id="gtEditCancel">Cancel</button></div>';
    const nameEl = $('gtEditName');
    if (nameEl) nameEl.focus();
    $('gtEditCancel').addEventListener('click', (e) => { e.stopPropagation(); renderGoals(); });
    $('gtEditSave').addEventListener('click', () => {
      const name = $('gtEditName').value.trim();
      const target = parseFloat($('gtEditTarget').value);
      const deadline = $('gtEditDeadline').value || null;
      if (!name || !target || target <= 0) return;
      goal.name = name; goal.target = target; goal.deadline = deadline; saveGoals(state); renderGoals();
    });
  }

  function gtBindEvents(state, data, baseline, catAvgs) {
    const root = $('gtRoot');
    if (!root) return;
    root.querySelectorAll('.gt-chip[data-gid]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const gid = Number(el.getAttribute('data-gid'));
        if (state.activeGoalId === gid && state.showDetail) {
          state.showDetail = false;
          gtPrevShowDetail = false;
          saveGoals(state);
          el.classList.remove('is-active');
          const card = root.querySelector('.gt-card');
          if (card) {
            const inner = card.querySelector('.gt-card-inner');
            if (inner) { card.style.transition = 'none'; card.style.maxHeight = inner.scrollHeight + 'px'; void card.offsetHeight; card.style.transition = ''; }
            card.style.maxHeight = '0';
            card.classList.remove('is-expanded');
          }
        } else {
          if (state.activeGoalId !== gid) {
            state.activeGoalId = gid;
            state.showDetail = true;
            gtPrevShowDetail = false;
            saveGoals(state);
            renderGoals();
          } else {
            state.showDetail = true;
            gtPrevShowDetail = true;
            saveGoals(state);
            el.classList.add('is-active');
            const card = root.querySelector('.gt-card');
            if (card) {
              const inner = card.querySelector('.gt-card-inner');
              card.classList.add('is-expanded');
              if (inner) card.style.maxHeight = inner.scrollHeight + 'px';
            }
          }
        }
      });
    });
    if (_gtDocClickHandler) document.removeEventListener('click', _gtDocClickHandler);
    _gtDocClickHandler = (e) => {
      if (!e.target.closest('.gt-card') && !e.target.closest('.gt-chip') && !e.target.closest('.gt-modal-overlay') && state.showDetail) {
        state.showDetail = false;
        gtPrevShowDetail = false;
        saveGoals(state);
        const ac = root.querySelector('.gt-chip.is-active');
        if (ac) ac.classList.remove('is-active');
        const card = root.querySelector('.gt-card');
        if (card) {
          const inner = card.querySelector('.gt-card-inner');
          if (inner) { card.style.transition = 'none'; card.style.maxHeight = inner.scrollHeight + 'px'; void card.offsetHeight; card.style.transition = ''; }
          card.style.maxHeight = '0';
          card.classList.remove('is-expanded');
        }
      }
    };
    document.addEventListener('click', _gtDocClickHandler);
    const emptyAdd = $('gtEmptyAdd');
    if (emptyAdd) emptyAdd.addEventListener('click', () => { gtOpenAddForm(state); });
    const goal = gtActiveGoal(state);
    if (!goal) return;
    const nameEl = $('gtName');
    if (nameEl) nameEl.addEventListener('click', () => { const v = prompt('Goal name:', goal.name); if (v === null) return; const trimmed = v.trim(); if (!trimmed) return; goal.name = trimmed; saveGoals(state); renderGoals(); });
    const delBtn = $('gtDelete');
    if (delBtn) delBtn.addEventListener('click', () => { gtConfirmDelete(state, goal); });
    function gtConfirmDelete(state, goal) {
      const overlay = document.createElement('div');
      overlay.className = 'gt-modal-overlay';
      overlay.innerHTML = '<div class="gt-modal"><div class="gt-modal-title">Delete goal "' + gtEscape(goal.name) + '"?</div><div class="gt-modal-actions"><button class="gt-btn" id="gtModalCancel">Cancel</button><button class="gt-btn danger" id="gtModalConfirm">Delete</button></div></div>';
      document.body.appendChild(overlay);
      $('gtModalConfirm').addEventListener('click', () => { document.body.removeChild(overlay); state.goals = state.goals.filter((x) => x.id !== goal.id); state.activeGoalId = state.goals.length ? state.goals[0].id : null; saveGoals(state); renderGoals(); });
      $('gtModalCancel').addEventListener('click', () => { document.body.removeChild(overlay); });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
    }
    const addBtn = $('gtAddAnother');
    if (addBtn) addBtn.addEventListener('click', (e) => { e.stopPropagation(); gtOpenAddForm(state); });
    const editBtn = $('gtEdit');
    if (editBtn) editBtn.addEventListener('click', (e) => { e.stopPropagation(); gtOpenEditForm(state, goal); });
    function commitSaved(val) { val = Math.max(0, Math.round(val * 100) / 100); goal.saved = val; saveGoals(state); renderGoals(); }
    root.querySelectorAll('[data-delta]').forEach((b) => { b.addEventListener('click', () => { commitSaved((goal.saved || 0) + Number(b.getAttribute('data-delta'))); }); });

    const savedInput = $('gtSavedInput');
    const applyBtn = $('gtSavedApply');
    function tryCommitSavedFromInput() { const raw = (savedInput.value || '').trim(); if (raw === '') { savedInput.value = goal.saved; return; } const v = parseFloat(raw); if (!isFinite(v)) { savedInput.value = goal.saved; return; } commitSaved(v); }
    if (applyBtn) applyBtn.addEventListener('click', tryCommitSavedFromInput);
    if (savedInput) savedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryCommitSavedFromInput(); });
    root.querySelectorAll('.gt-cat-row').forEach((row) => {
      const cat = row.getAttribute('data-cat');
      row.querySelectorAll('.gt-seg button').forEach((btn) => { btn.addEventListener('click', () => { const mode = btn.getAttribute('data-mode'); goal.plan = goal.plan || {}; const existing = goal.plan[cat] || { mode: 'keep', reducePct: 50 }; existing.mode = mode; if (mode === 'keep') delete goal.plan[cat]; else goal.plan[cat] = existing; saveGoals(state); renderGoals(); }); });
      const slider = row.querySelector('.gt-slider');
      if (slider) {
        slider.addEventListener('input', () => {
          const pct = Number(slider.value);
          goal.plan = goal.plan || {};
          const p = goal.plan[cat] || { mode: 'reduce', reducePct: pct };
          p.reducePct = pct; p.mode = 'reduce'; goal.plan[cat] = p;
          const pctLbl = row.querySelector('.gt-slider-pct');
          const saveLbl = row.querySelector('.gt-slider-save');
          const avg = catAvgs[cat];
          if (pctLbl) pctLbl.textContent = pct + '%';
          if (saveLbl) saveLbl.textContent = 'saving ' + fmt(avg * pct / 100) + '/mo';
          gtLiveUpdate(state, baseline, catAvgs);
        });
        slider.addEventListener('change', () => { saveGoals(state); });
      }
    });
    const resetBtn = $('gtResetPlan');
    if (resetBtn) resetBtn.addEventListener('click', () => { goal.plan = {}; saveGoals(state); renderGoals(); });
  }

  function gtLiveUpdate(state, baseline, catAvgs) {
    const goal = gtActiveGoal(state); if (!goal) return;
    const remaining = Math.max(0, goal.target - goal.saved);
    const planSavings = gtPlanSavings(goal, catAvgs);
    const planRate = baseline.rate + planSavings;
    const baseEta = gtEtaMonths(remaining, baseline.rate);
    const planEta = gtEtaMonths(remaining, planRate);
    const planEtaEl = $('gtPlanEta');
    const planSubEl = $('gtPlanEtaSub');
    const savedEl = $('gtTimeSaved');
    if (planEtaEl) { const prev = (gtPrevPlanEta == null || !isFinite(gtPrevPlanEta)) ? planEta : gtPrevPlanEta; if (isFinite(planEta) && isFinite(prev)) { gtTween(planEtaEl, prev, planEta, (v) => gtMonthsLabel(Math.round(v))); } else { planEtaEl.textContent = gtMonthsLabel(planEta); } gtPrevPlanEta = planEta; }
    if (planSubEl) planSubEl.textContent = gtEtaDateLabel(planEta);
    if (savedEl) { const diff = (isFinite(baseEta) && isFinite(planEta)) ? Math.max(0, baseEta - planEta) : 0; if (diff > 0) { savedEl.textContent = 'Time saved: ' + diff + ' mo'; savedEl.style.opacity = ''; } else { savedEl.textContent = '\u2014'; savedEl.style.opacity = '0.5'; } }
    const sumEl = document.querySelector('.gt-plan-summary');
    if (sumEl) { const monthsSaved = (isFinite(baseEta) && isFinite(planEta)) ? Math.max(0, baseEta - planEta) : 0; sumEl.innerHTML = '<span>Plan saves <span class="v">' + fmt(planSavings) + '/mo</span></span><span>Finish <span class="v">' + monthsSaved + ' month' + (monthsSaved === 1 ? '' : 's') + '</span> earlier</span>'; }
  }

  // --- Window-exposed functions ---

  window.renderGoals = renderGoals;
  window.renderFinances = renderFinances;

  // --- Sub-view switching (overview / details) ---
  document.querySelector('.fin-sub-nav')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.fin-sub-btn');
    if (!btn) return;
    const view = btn.getAttribute('data-finview');
    document.querySelectorAll('.fin-sub-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    document.querySelectorAll('.fin-view').forEach((v) => v.style.display = 'none');
    const target = document.getElementById('fin' + view.charAt(0).toUpperCase() + view.slice(1));
    if (target) target.style.display = '';
  });

})();