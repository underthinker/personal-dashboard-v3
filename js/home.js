/* ═══ HOME TAB WIDGETS ═══
   Extracted from index.html inline script. Loaded last so it can call into
   render* helpers exported by goals/habits/health. */
(function(){
  const $ = id => document.getElementById(id);

  /* ─── Timeline v2 (range blocks, inline edit, drag sort, undo delete) ─── */
  const TL_KEY_V1  = 'timeline_blocks_v1';
  const TL_KEY     = 'timeline_blocks_v2';
  const RECUR_KEY  = 'recurring_blocks_v1';
  const TMPL_KEY   = 'schedule_templates_v1';
  const ACTIVE_TMPL_KEY = 'tl_active_template';

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

  /* ─── Recurring blocks ─── */
  function getRecurBlocks() {
    try { var r = localStorage.getItem(RECUR_KEY); return r ? JSON.parse(r) : []; } catch(e) { return []; }
  }
  function saveRecurBlocks(b) { localStorage.setItem(RECUR_KEY, JSON.stringify(b)); }

  function getRecurBlocksForToday() {
    var ymd = window.getTodayYmd ? window.getTodayYmd() : new Date().toISOString().slice(0, 10);
    var dow = new Date(ymd + 'T12:00:00').getDay();
    return getRecurBlocks().filter(function(b) {
      if (!b.recurrence) return false;
      if (b.recurrence.until && ymd > b.recurrence.until) return false;
      var f = b.recurrence.freq;
      if (f === 'daily') return true;
      if (f === 'weekdays') return dow >= 1 && dow <= 5;
      if (f === 'weekly') return b.recurrence.daysOfWeek ? b.recurrence.daysOfWeek.includes(dow) : false;
      return false;
    }).map(function(b) { return Object.assign({}, b, { _isRecurring: true }); });
  }

  /* ─── Templates ─── */
  function getTemplates() {
    try { var r = localStorage.getItem(TMPL_KEY); return r ? JSON.parse(r) : []; } catch(e) { return []; }
  }
  function saveTemplates(t) { localStorage.setItem(TMPL_KEY, JSON.stringify(t)); }

  function updateTemplateSelect() {
    var sel = $('tlTemplateSelect');
    if (!sel) return;
    var tmpls = getTemplates();
    sel.innerHTML = '<option value="">Default</option>' +
      tmpls.map(function(t, i) {
        return '<option value="' + i + '">' + window.escHtml(t.name) + (t.autoApply ? ' ★' : '') + '</option>';
      }).join('') +
      (tmpls.length ? '<option value="__manage">Manage…</option>' : '');
  }

  /* ─── Recurrence popover ─── */
  var _recurPop = null;

  function openRecurPop(anchor, blockId, isRecurring) {
    closeRecurPop();
    var source = isRecurring ? getRecurBlocks() : getBlocks();
    var b = source.find(function(x) { return x.id === blockId; });
    if (!b) return;
    var esc = window.escHtml;
    var curFreq = (b.recurrence && b.recurrence.freq) || '';
    var curUntil = (b.recurrence && b.recurrence.until) || '';
    var pop = document.createElement('div');
    pop.className = 'tl-recur-pop'; pop.id = 'tlRecurPop';
    pop.innerHTML =
      '<div class="tl-recur-pop-title">Repeat</div>' +
      '<label class="tl-pop-lbl">Frequency' +
        '<select class="tl-recur-freq">' +
          '<option value=""'   + (!curFreq ? ' selected' : '') + '>Never</option>' +
          '<option value="daily"'    + (curFreq === 'daily'    ? ' selected' : '') + '>Every day</option>' +
          '<option value="weekdays"' + (curFreq === 'weekdays' ? ' selected' : '') + '>Weekdays</option>' +
          '<option value="weekly"'   + (curFreq === 'weekly'   ? ' selected' : '') + '>Every week</option>' +
        '</select>' +
      '</label>' +
      '<label class="tl-pop-lbl">Until (optional)<input type="date" class="tl-recur-until" value="' + esc(curUntil) + '"></label>' +
      '<div class="tl-pop-row"><button class="tl-recur-cancel">Cancel</button><button class="tl-pop-done tl-recur-save">Save</button></div>';
    document.body.appendChild(pop);
    var rect = anchor.getBoundingClientRect();
    pop.style.top  = (rect.bottom + 6 + window.scrollY) + 'px';
    pop.style.left = Math.max(4, rect.left) + 'px';
    pop.querySelector('.tl-recur-cancel').addEventListener('click', closeRecurPop);
    pop.querySelector('.tl-recur-save').addEventListener('click', function() {
      var freq  = pop.querySelector('.tl-recur-freq').value;
      var until = pop.querySelector('.tl-recur-until').value;
      saveRecurrence(blockId, isRecurring, freq, until);
      closeRecurPop();
    });
    _recurPop = pop;
    requestAnimationFrame(function() { document.addEventListener('click', _recurOutside); });
  }

  function _recurOutside(e) {
    if (_recurPop && !_recurPop.contains(e.target)) {
      document.removeEventListener('click', _recurOutside);
      closeRecurPop();
    }
  }

  function closeRecurPop() {
    document.removeEventListener('click', _recurOutside);
    if (_recurPop) { _recurPop.remove(); _recurPop = null; }
  }

  function saveRecurrence(blockId, wasRecurring, freq, until) {
    if (freq) {
      var ymd = window.getTodayYmd ? window.getTodayYmd() : new Date().toISOString().slice(0, 10);
      var dow = new Date(ymd + 'T12:00:00').getDay();
      var recurrence = { freq: freq };
      if (freq === 'weekly') recurrence.daysOfWeek = [dow];
      if (until) recurrence.until = until;
      if (wasRecurring) {
        var rbs = getRecurBlocks();
        var rb = rbs.find(function(x) { return x.id === blockId; });
        if (rb) { rb.recurrence = recurrence; saveRecurBlocks(rbs); }
      } else {
        var bks = getBlocks();
        var idx = bks.findIndex(function(x) { return x.id === blockId; });
        if (idx !== -1) {
          var moved = bks.splice(idx, 1)[0];
          moved.recurrence = recurrence;
          saveBlocks(bks);
          var rbs2 = getRecurBlocks(); rbs2.push(moved); saveRecurBlocks(rbs2);
        }
      }
    } else if (wasRecurring) {
      var rbs3 = getRecurBlocks();
      var ri = rbs3.findIndex(function(x) { return x.id === blockId; });
      if (ri !== -1) {
        var back = rbs3.splice(ri, 1)[0];
        delete back.recurrence;
        saveRecurBlocks(rbs3);
        var bks2 = getBlocks(); bks2.push(back); saveBlocks(bks2);
      }
    }
    renderTimeline();
  }

  /* ─── Template popovers ─── */
  var _tmplPop = null;

  function openSaveTemplatePop() {
    if (_tmplPop) { _tmplPop.remove(); _tmplPop = null; return; }
    var btn = $('tlSaveTemplate');
    if (!btn) return;
    var pop = document.createElement('div');
    pop.className = 'tl-tmpl-pop'; pop.id = 'tlTemplatePop';
    pop.innerHTML =
      '<label class="tl-pop-lbl">Name<input type="text" class="tl-tmpl-name-in" placeholder="e.g. Work day" autocomplete="off"></label>' +
      '<label class="tl-tmpl-auto-lbl"><input type="checkbox" class="tl-tmpl-auto"> Auto-apply when empty</label>' +
      '<div class="tl-pop-row"><button class="tl-recur-cancel">Cancel</button><button class="tl-pop-done tl-tmpl-ok">Save</button></div>';
    document.body.appendChild(pop);
    var rect = btn.getBoundingClientRect();
    pop.style.top  = (rect.bottom + 6 + window.scrollY) + 'px';
    pop.style.left = Math.max(4, rect.right - 200) + 'px';
    var nameIn = pop.querySelector('.tl-tmpl-name-in');
    nameIn.focus();
    pop.querySelector('.tl-recur-cancel').addEventListener('click', function() { pop.remove(); _tmplPop = null; });
    pop.querySelector('.tl-tmpl-ok').addEventListener('click', function() {
      var name = nameIn.value.trim();
      if (!name) { nameIn.focus(); return; }
      var autoApply = pop.querySelector('.tl-tmpl-auto').checked;
      var blocks = getBlocks().map(function(b) { return { start: b.start, end: b.end, label: b.label, sub: b.sub || '' }; });
      var tmpls = getTemplates(); tmpls.push({ name: name, blocks: blocks, autoApply: autoApply });
      saveTemplates(tmpls); updateTemplateSelect();
      pop.remove(); _tmplPop = null;
      showToast('Template “' + name + '” saved');
    });
    _tmplPop = pop;
    requestAnimationFrame(function() {
      document.addEventListener('click', function _tmplOut(e) {
        if (_tmplPop && !_tmplPop.contains(e.target) && e.target !== btn) {
          document.removeEventListener('click', _tmplOut);
          if (_tmplPop) { _tmplPop.remove(); _tmplPop = null; }
        }
      });
    });
  }

  function openManageTemplates() {
    var esc = window.escHtml;
    var tmpls = getTemplates();
    if (!tmpls.length) return;
    var btn = $('tlTemplateSelect');
    var pop = document.createElement('div');
    pop.className = 'tl-tmpl-pop'; pop.id = 'tlManagePop';
    pop.innerHTML = '<div class="tl-recur-pop-title">Manage Templates</div>' +
      tmpls.map(function(t, i) {
        return '<div class="tl-tmpl-item"><span>' + esc(t.name) + (t.autoApply ? ' ★' : '') + '</span>' +
          '<button class="tl-tmpl-del" data-idx="' + i + '">\xd7</button></div>';
      }).join('') +
      '<button class="tl-recur-cancel" style="margin-top:6px;width:100%">Close</button>';
    document.body.appendChild(pop);
    if (btn) {
      var rect = btn.getBoundingClientRect();
      pop.style.top  = (rect.bottom + 6 + window.scrollY) + 'px';
      pop.style.left = Math.max(4, rect.right - 200) + 'px';
    }
    pop.querySelector('.tl-recur-cancel').addEventListener('click', function() { pop.remove(); });
    pop.querySelectorAll('.tl-tmpl-del').forEach(function(b) {
      b.addEventListener('click', function() {
        var idx = parseInt(b.getAttribute('data-idx'), 10);
        var t = getTemplates(); t.splice(idx, 1); saveTemplates(t); updateTemplateSelect(); pop.remove();
        var active = localStorage.getItem(ACTIVE_TMPL_KEY);
        if (active != null) {
          var a = parseInt(active, 10);
          if (a === idx) localStorage.removeItem(ACTIVE_TMPL_KEY);
          else if (a > idx) localStorage.setItem(ACTIVE_TMPL_KEY, a - 1);
        }
      });
    });
  }

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
    if (undoFn) {
      t.innerHTML = window.escHtml(msg) + ' <button class="tl-toast-undo">Undo</button>';
      t.querySelector('.tl-toast-undo').addEventListener('click', undoFn);
    } else {
      t.textContent = msg;
      setTimeout(clearToast, 3000);
    }
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
    bks.push({ id: tlUid(), start: startVal, end: end, label: label, sub: '-' });
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
    const nowMin = (new Date()).getHours() * 60 + (new Date()).getMinutes();

    // Load time-blocked goals for today
    const gKey = 'goals:' + (window.getTodayYmd ? window.getTodayYmd() : '');
    var goalEntries = [];
    try {
      var todayGoals = JSON.parse(localStorage.getItem(gKey) || '[]');
      todayGoals.forEach(function(g, i) {
        if (g && g.timeSlot && g.timeSlot.start) {
          goalEntries.push({ _isGoal: true, start: g.timeSlot.start, end: g.timeSlot.end || '', label: g.text || '', done: !!g.done, _gKey: gKey, _gIdx: i });
        }
      });
    } catch(e) {}

    // Merge blocks, goal entries, and recurring entries
    var recurEntries = getRecurBlocksForToday();
    var blocks = sortedBlocks().map(function(b) { return Object.assign({ _isGoal: false, _isRecurring: false }, b); });
    var allEntries;
    if (goalEntries.length > 0 || recurEntries.length > 0) {
      allEntries = blocks.concat(goalEntries).concat(recurEntries);
      allEntries.sort(function(a, b) { return parseMin(a.start || '0:00') - parseMin(b.start || '0:00'); });
    } else {
      allEntries = blocks;
    }

    const rows = allEntries.map(function(b, i) {
      const isActive = nowMin >= parseMin(b.start) && nowMin < parseMin(b.end);
      const isLast   = i === allEntries.length - 1;
      const dur = fmtDur(b.start, b.end);

      if (b._isRecurring) {
        var freq = b.recurrence && b.recurrence.freq ? b.recurrence.freq : '';
        return (
          '<div class="tl-row tl-recur-row' + (isActive ? ' tl-row-active' : '') + (isLast ? ' tl-row-last' : '') + '" data-tl-rid="' + esc(b.id) + '">' +
            '<div class="tl-time-col"><span class="tl-start' + (isActive ? ' active' : '') + '">' + esc(b.start) + '</span></div>' +
            '<div class="tl-dot-col"><div class="tl-line"></div><div class="tl-dot' + (isActive ? ' active' : '') + '"></div></div>' +
            '<div class="tl-content' + (isActive ? ' active' : '') + '">' +
              '<div class="tl-title-row">' +
                '<span class="tl-title">' + esc(b.label) + '</span>' +
                '<span class="tl-recur-badge" data-tl-recur-edit="' + esc(b.id) + '" title="Edit recurrence">↻ ' + esc(freq) + '</span>' +
                (dur ? '<span class="tl-dur">' + esc(dur) + '</span>' : '') +
              '</div>' +
              (b.sub ? '<div class="tl-sub">' + esc(b.sub) + '</div>' : '') +
            '</div>' +
            '<button class="tl-del-btn" data-tl-rdel="' + esc(b.id) + '" aria-label="Delete block"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>' +
          '</div>'
        );
      }

      if (b._isGoal) {
        return (
          '<div class="tl-row tl-goal-row' + (isActive ? ' tl-row-active' : '') + (isLast ? ' tl-row-last' : '') + '"' +
              ' data-tl-gkey="' + esc(b._gKey) + '" data-tl-gidx="' + b._gIdx + '">' +
            '<div class="tl-time-col"><span class="tl-start' + (isActive ? ' active' : '') + '">' + esc(b.start) + '</span></div>' +
            '<div class="tl-dot-col"><div class="tl-line"></div><div class="tl-dot' + (isActive ? ' active' : '') + '"></div></div>' +
            '<div class="tl-content' + (isActive ? ' active' : '') + '">' +
              '<div class="tl-title-row">' +
                '<input type="checkbox" class="tl-goal-check"' + (b.done ? ' checked' : '') + ' aria-label="Mark done">' +
                '<span class="tl-title' + (b.done ? ' tl-goal-done' : '') + '">' + esc(b.label) + '</span>' +
                (dur ? '<span class="tl-dur">' + esc(dur) + '</span>' : '') +
              '</div>' +
            '</div>' +
          '</div>'
        );
      }

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
          '<button class="tl-recur-btn" data-tl-recur-new="' + esc(b.id) + '" title="Set recurrence" aria-label="Set recurrence"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg></button>' +
          '<button class="tl-del-btn" data-tl-del="' + esc(b.id) + '" aria-label="Delete block"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>' +
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
    // Goal checkbox on timeline
    if (e.target.matches && e.target.matches('.tl-goal-check')) {
      var row = e.target.closest('[data-tl-gkey]');
      if (row) {
        var gk = row.getAttribute('data-tl-gkey');
        var gi = parseInt(row.getAttribute('data-tl-gidx'), 10);
        try {
          var gs = JSON.parse(localStorage.getItem(gk) || '[]');
          if (gs[gi]) {
            gs[gi].done = e.target.checked;
            if (e.target.checked) { gs[gi].doneAt = Date.now(); delete gs[gi].queued; } else delete gs[gi].doneAt;
            localStorage.setItem(gk, JSON.stringify(gs));
            window.dispatchEvent(new CustomEvent('goals-changed'));
          }
        } catch(ex) {}
      }
      return;
    }

    const delBtn = e.target.closest('[data-tl-del]');
    if (delBtn) { e.stopPropagation(); deleteBlockUndo(delBtn.getAttribute('data-tl-del')); return; }

    const rdelBtn = e.target.closest('[data-tl-rdel]');
    if (rdelBtn) {
      e.stopPropagation();
      var rdelId = rdelBtn.getAttribute('data-tl-rdel');
      var rbs = getRecurBlocks(); var ri = rbs.findIndex(function(x) { return x.id === rdelId; });
      if (ri !== -1) { rbs.splice(ri, 1); saveRecurBlocks(rbs); renderTimeline(); }
      return;
    }

    const recurEditEl = e.target.closest('[data-tl-recur-edit]');
    if (recurEditEl) {
      e.stopPropagation();
      openRecurPop(recurEditEl, recurEditEl.getAttribute('data-tl-recur-edit'), true);
      return;
    }

    const recurNewEl = e.target.closest('[data-tl-recur-new]');
    if (recurNewEl) {
      e.stopPropagation();
      openRecurPop(recurNewEl, recurNewEl.getAttribute('data-tl-recur-new'), false);
      return;
    }

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

  /* ─── Weather ─── */
  const WEATHER_CONFIG_KEY = 'weather_config_v1';
  const WEATHER_CACHE_KEY = 'weather_cache_v1';
  const WEATHER_TTL = 5 * 60 * 1000; // 5 min cache — weather can shift fast
  const WEATHER_REFRESH_INTERVAL = 5 * 60 * 1000; // re-check every 5 min
  let weatherRefreshTimer = null;
  const WX_ICONS = {
    '01':'<svg viewBox="0 0 56 48" xmlns="http://www.w3.org/2000/svg">  <defs>    <filter id="blur" x="-.34167" y="-.34167" width="1.6833" height="1.85">      <feGaussianBlur in="SourceAlpha" stdDeviation="3" />      <feOffset dx="0" dy="4" result="offsetblur" />      <feComponentTransfer>        <feFuncA slope="0.05" type="linear" />      </feComponentTransfer>      <feMerge>        <feMergeNode />        <feMergeNode in="SourceGraphic" />      </feMerge>    </filter>    <style type="text/css">      <![CDATA[      /*** SUN*/      @keyframes am-weather-sun {        0% {          -webkit-transform: rotate(0deg);          -moz-transform: rotate(0deg);          -ms-transform: rotate(0deg);          transform: rotate(0deg);        }        100% {          -webkit-transform: rotate(360deg);          -moz-transform: rotate(360deg);          -ms-transform: rotate(360deg);          transform: rotate(360deg);        }      }      .am-weather-sun {        -webkit-animation-name: am-weather-sun;        -moz-animation-name: am-weather-sun;        -ms-animation-name: am-weather-sun;        animation-name: am-weather-sun;        -webkit-animation-duration: 9s;        -moz-animation-duration: 9s;        -ms-animation-duration: 9s;        animation-duration: 9s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      @keyframes am-weather-sun-shiny {        0% {          stroke-dasharray: 3px 10px;          stroke-dashoffset: 0px;        }        50% {          stroke-dasharray: 0.1px 10px;          stroke-dashoffset: -1px;        }        100% {          stroke-dasharray: 3px 10px;          stroke-dashoffset: 0px;        }      }      .am-weather-sun-shiny line {        -webkit-animation-name: am-weather-sun-shiny;        -moz-animation-name: am-weather-sun-shiny;        -ms-animation-name: am-weather-sun-shiny;        animation-name: am-weather-sun-shiny;        -webkit-animation-duration: 2s;        -moz-animation-duration: 2s;        -ms-animation-duration: 2s;        animation-duration: 2s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      ]]>    </style>  </defs>  <g transform="translate(16,-2)" filter="url(#blur)">    <g transform="translate(0,16)">      <g class="am-weather-sun"        style="-moz-animation-duration:9s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-sun;-moz-animation-timing-function:linear;-ms-animation-duration:9s;-ms-animation-iteration-count:infinite;-ms-animation-name:am-weather-sun;-ms-animation-timing-function:linear;-webkit-animation-duration:9s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-sun;-webkit-animation-timing-function:linear">        <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round" stroke-width="2" />        <g transform="rotate(45)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(90)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(135)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="scale(-1)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(225)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(-90)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(-45)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <circle r="5" fill="#ffa500" stroke="#ffa500" stroke-width="2" />      </g>    </g>  </g></svg>',
    '02':'<svg viewBox="0 0 56 48" xmlns="http://www.w3.org/2000/svg">  <defs>    <filter id="blur" x="-.20655" y="-.28472" width="1.403" height="1.6944">      <feGaussianBlur in="SourceAlpha" stdDeviation="3" />      <feOffset dx="0" dy="4" result="offsetblur" />      <feComponentTransfer>        <feFuncA slope="0.05" type="linear" />      </feComponentTransfer>      <feMerge>        <feMergeNode />        <feMergeNode in="SourceGraphic" />      </feMerge>    </filter>    <style type="text/css">      <![CDATA[      /*** CLOUDS*/      @keyframes am-weather-cloud-2 {        0% {          -webkit-transform: translate(0px, 0px);          -moz-transform: translate(0px, 0px);          -ms-transform: translate(0px, 0px);          transform: translate(0px, 0px);        }        50% {          -webkit-transform: translate(2px, 0px);          -moz-transform: translate(2px, 0px);          -ms-transform: translate(2px, 0px);          transform: translate(2px, 0px);        }        100% {          -webkit-transform: translate(0px, 0px);          -moz-transform: translate(0px, 0px);          -ms-transform: translate(0px, 0px);          transform: translate(0px, 0px);        }      }      .am-weather-cloud-2 {        -webkit-animation-name: am-weather-cloud-2;        -moz-animation-name: am-weather-cloud-2;        animation-name: am-weather-cloud-2;        -webkit-animation-duration: 3s;        -moz-animation-duration: 3s;        animation-duration: 3s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      /*** SUN*/      @keyframes am-weather-sun {        0% {          -webkit-transform: rotate(0deg);          -moz-transform: rotate(0deg);          -ms-transform: rotate(0deg);          transform: rotate(0deg);        }        100% {          -webkit-transform: rotate(360deg);          -moz-transform: rotate(360deg);          -ms-transform: rotate(360deg);          transform: rotate(360deg);        }      }      .am-weather-sun {        -webkit-animation-name: am-weather-sun;        -moz-animation-name: am-weather-sun;        -ms-animation-name: am-weather-sun;        animation-name: am-weather-sun;        -webkit-animation-duration: 9s;        -moz-animation-duration: 9s;        -ms-animation-duration: 9s;        animation-duration: 9s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      @keyframes am-weather-sun-shiny {        0% {          stroke-dasharray: 3px 10px;          stroke-dashoffset: 0px;        }        50% {          stroke-dasharray: 0.1px 10px;          stroke-dashoffset: -1px;        }        100% {          stroke-dasharray: 3px 10px;          stroke-dashoffset: 0px;        }      }      .am-weather-sun-shiny line {        -webkit-animation-name: am-weather-sun-shiny;        -moz-animation-name: am-weather-sun-shiny;        -ms-animation-name: am-weather-sun-shiny;        animation-name: am-weather-sun-shiny;        -webkit-animation-duration: 2s;        -moz-animation-duration: 2s;        -ms-animation-duration: 2s;        animation-duration: 2s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      ]]>    </style>  </defs>  <g transform="translate(16,-2)" filter="url(#blur)">    <g transform="translate(0,16)">      <g class="am-weather-sun"        style="-moz-animation-duration:9s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-sun;-moz-animation-timing-function:linear;-ms-animation-duration:9s;-ms-animation-iteration-count:infinite;-ms-animation-name:am-weather-sun;-ms-animation-timing-function:linear;-webkit-animation-duration:9s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-sun;-webkit-animation-timing-function:linear">        <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round" stroke-width="2" />        <g transform="rotate(45)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(90)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(135)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="scale(-1)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(225)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(-90)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(-45)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <circle r="5" fill="#ffa500" stroke="#ffa500" stroke-width="2" />      </g>    </g>    <g class="am-weather-cloud-2"      style="-moz-animation-duration:3s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-cloud-2;-moz-animation-timing-function:linear;-webkit-animation-duration:3s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-cloud-2;-webkit-animation-timing-function:linear">      <path transform="translate(-20,-11)"        d="m47.7 35.4c0-4.6-3.7-8.2-8.2-8.2-1 0-1.9 0.2-2.8 0.5-0.3-3.4-3.1-6.2-6.6-6.2-3.7 0-6.7 3-6.7 6.7 0 0.8 0.2 1.6 0.4 2.3-0.3-0.1-0.7-0.1-1-0.1-3.7 0-6.7 3-6.7 6.7 0 3.6 2.9 6.6 6.5 6.7h17.2c4.4-0.5 7.9-4 7.9-8.4z"        fill="#c6deff" stroke="#fff" stroke-linejoin="round" stroke-width="1.2" />    </g>  </g></svg>',
    '03':'<svg viewBox="0 0 56 48" xmlns="http://www.w3.org/2000/svg">  <defs>    <filter id="blur" x="-.20655" y="-.28472" width="1.403" height="1.6944">      <feGaussianBlur in="SourceAlpha" stdDeviation="3" />      <feOffset dx="0" dy="4" result="offsetblur" />      <feComponentTransfer>        <feFuncA slope="0.05" type="linear" />      </feComponentTransfer>      <feMerge>        <feMergeNode />        <feMergeNode in="SourceGraphic" />      </feMerge>    </filter>    <style type="text/css">      <![CDATA[      /*** CLOUDS*/      @keyframes am-weather-cloud-2 {        0% {          -webkit-transform: translate(0px, 0px);          -moz-transform: translate(0px, 0px);          -ms-transform: translate(0px, 0px);          transform: translate(0px, 0px);        }        50% {          -webkit-transform: translate(2px, 0px);          -moz-transform: translate(2px, 0px);          -ms-transform: translate(2px, 0px);          transform: translate(2px, 0px);        }        100% {          -webkit-transform: translate(0px, 0px);          -moz-transform: translate(0px, 0px);          -ms-transform: translate(0px, 0px);          transform: translate(0px, 0px);        }      }      .am-weather-cloud-2 {        -webkit-animation-name: am-weather-cloud-2;        -moz-animation-name: am-weather-cloud-2;        animation-name: am-weather-cloud-2;        -webkit-animation-duration: 3s;        -moz-animation-duration: 3s;        animation-duration: 3s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      /*** SUN*/      @keyframes am-weather-sun {        0% {          -webkit-transform: rotate(0deg);          -moz-transform: rotate(0deg);          -ms-transform: rotate(0deg);          transform: rotate(0deg);        }        100% {          -webkit-transform: rotate(360deg);          -moz-transform: rotate(360deg);          -ms-transform: rotate(360deg);          transform: rotate(360deg);        }      }      .am-weather-sun {        -webkit-animation-name: am-weather-sun;        -moz-animation-name: am-weather-sun;        -ms-animation-name: am-weather-sun;        animation-name: am-weather-sun;        -webkit-animation-duration: 9s;        -moz-animation-duration: 9s;        -ms-animation-duration: 9s;        animation-duration: 9s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      @keyframes am-weather-sun-shiny {        0% {          stroke-dasharray: 3px 10px;          stroke-dashoffset: 0px;        }        50% {          stroke-dasharray: 0.1px 10px;          stroke-dashoffset: -1px;        }        100% {          stroke-dasharray: 3px 10px;          stroke-dashoffset: 0px;        }      }      .am-weather-sun-shiny line {        -webkit-animation-name: am-weather-sun-shiny;        -moz-animation-name: am-weather-sun-shiny;        -ms-animation-name: am-weather-sun-shiny;        animation-name: am-weather-sun-shiny;        -webkit-animation-duration: 2s;        -moz-animation-duration: 2s;        -ms-animation-duration: 2s;        animation-duration: 2s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      ]]>    </style>  </defs>  <g transform="translate(16 -2)" filter="url(#blur)">    <g transform="translate(0,16)">      <g class="am-weather-sun"        style="-moz-animation-duration:9s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-sun;-moz-animation-timing-function:linear;-ms-animation-duration:9s;-ms-animation-iteration-count:infinite;-ms-animation-name:am-weather-sun;-ms-animation-timing-function:linear;-webkit-animation-duration:9s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-sun;-webkit-animation-timing-function:linear">        <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round" stroke-width="2" />        <g transform="rotate(45)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(90)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(135)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="scale(-1)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(225)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(-90)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>        <g transform="rotate(-45)">          <line transform="translate(0,9)" y2="3" fill="none" stroke="#ffa500" stroke-linecap="round"            stroke-width="2" />        </g>      </g>      <circle r="5" fill="#ffa500" stroke="#ffa500" stroke-width="2" />    </g>    <g class="am-weather-cloud-2"      style="-moz-animation-duration:3s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-cloud-2;-moz-animation-timing-function:linear;-webkit-animation-duration:3s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-cloud-2;-webkit-animation-timing-function:linear">      <path transform="translate(-20,-11)"        d="m47.7 35.4c0-4.6-3.7-8.2-8.2-8.2-1 0-1.9 0.2-2.8 0.5-0.3-3.4-3.1-6.2-6.6-6.2-3.7 0-6.7 3-6.7 6.7 0 0.8 0.2 1.6 0.4 2.3-0.3-0.1-0.7-0.1-1-0.1-3.7 0-6.7 3-6.7 6.7 0 3.6 2.9 6.6 6.5 6.7h17.2c4.4-0.5 7.9-4 7.9-8.4z"        fill="#91c0f8" stroke="#fff" stroke-linejoin="round" stroke-width="1.2" />    </g>  </g></svg>',
    '04':'<svg viewBox="0 0 56 48" xmlns="http://www.w3.org/2000/svg">  <defs>    <filter id="blur" x="-.24684" y="-.27097" width="1.4937" height="1.6939">      <feGaussianBlur in="SourceAlpha" stdDeviation="3" />      <feOffset dx="0" dy="4" result="offsetblur" />      <feComponentTransfer>        <feFuncA slope="0.05" type="linear" />      </feComponentTransfer>      <feMerge>        <feMergeNode />        <feMergeNode in="SourceGraphic" />      </feMerge>    </filter>    <style type="text/css">      <![CDATA[      /*** CLOUDS*/      @keyframes am-weather-cloud-1 {        0% {          -webkit-transform: translate(-5px, 0px);          -moz-transform: translate(-5px, 0px);          -ms-transform: translate(-5px, 0px);          transform: translate(-5px, 0px);        }        50% {          -webkit-transform: translate(10px, 0px);          -moz-transform: translate(10px, 0px);          -ms-transform: translate(10px, 0px);          transform: translate(10px, 0px);        }        100% {          -webkit-transform: translate(-5px, 0px);          -moz-transform: translate(-5px, 0px);          -ms-transform: translate(-5px, 0px);          transform: translate(-5px, 0px);        }      }      .am-weather-cloud-1 {        -webkit-animation-name: am-weather-cloud-1;        -moz-animation-name: am-weather-cloud-1;        animation-name: am-weather-cloud-1;        -webkit-animation-duration: 7s;        -moz-animation-duration: 7s;        animation-duration: 7s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      @keyframes am-weather-cloud-2 {        0% {          -webkit-transform: translate(0px, 0px);          -moz-transform: translate(0px, 0px);          -ms-transform: translate(0px, 0px);          transform: translate(0px, 0px);        }        50% {          -webkit-transform: translate(2px, 0px);          -moz-transform: translate(2px, 0px);          -ms-transform: translate(2px, 0px);          transform: translate(2px, 0px);        }        100% {          -webkit-transform: translate(0px, 0px);          -moz-transform: translate(0px, 0px);          -ms-transform: translate(0px, 0px);          transform: translate(0px, 0px);        }      }      .am-weather-cloud-2 {        -webkit-animation-name: am-weather-cloud-2;        -moz-animation-name: am-weather-cloud-2;        animation-name: am-weather-cloud-2;        -webkit-animation-duration: 3s;        -moz-animation-duration: 3s;        animation-duration: 3s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      ]]>    </style>  </defs>  <g id="cloudy" transform="translate(16,-2)" filter="url(#blur)">    <g class="am-weather-cloud-1"      style="-moz-animation-duration:7s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-cloud-1;-moz-animation-timing-function:linear;-webkit-animation-duration:7s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-cloud-1;-webkit-animation-timing-function:linear">      <path transform="matrix(.6 0 0 .6 -10 -8)"        d="m47.7 35.4c0-4.6-3.7-8.2-8.2-8.2-1 0-1.9 0.2-2.8 0.5-0.3-3.4-3.1-6.2-6.6-6.2-3.7 0-6.7 3-6.7 6.7 0 0.8 0.2 1.6 0.4 2.3-0.3-0.1-0.7-0.1-1-0.1-3.7 0-6.7 3-6.7 6.7 0 3.6 2.9 6.6 6.5 6.7h17.2c4.4-0.5 7.9-4 7.9-8.4z"        fill="#91c0f8" stroke="#fff" stroke-linejoin="round" stroke-width="1.2" />    </g>    <g class="am-weather-cloud-2"      style="-moz-animation-duration:3s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-cloud-2;-moz-animation-timing-function:linear;-webkit-animation-duration:3s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-cloud-2;-webkit-animation-timing-function:linear">      <path transform="translate(-20,-11)"        d="m47.7 35.4c0-4.6-3.7-8.2-8.2-8.2-1 0-1.9 0.2-2.8 0.5-0.3-3.4-3.1-6.2-6.6-6.2-3.7 0-6.7 3-6.7 6.7 0 0.8 0.2 1.6 0.4 2.3-0.3-0.1-0.7-0.1-1-0.1-3.7 0-6.7 3-6.7 6.7 0 3.6 2.9 6.6 6.5 6.7h17.2c4.4-0.5 7.9-4 7.9-8.4z"        fill="#57a0ee" stroke="#fff" stroke-linejoin="round" stroke-width="1.2" />    </g>  </g></svg>',
    '09':'<svg viewBox="0 0 56 48" xmlns="http://www.w3.org/2000/svg">  <defs>    <filter id="blur" x="-.24684" y="-.24132" width="1.4937" height="1.5878">      <feGaussianBlur in="SourceAlpha" stdDeviation="3" />      <feOffset dx="0" dy="4" result="offsetblur" />      <feComponentTransfer>        <feFuncA slope="0.05" type="linear" />      </feComponentTransfer>      <feMerge>        <feMergeNode />        <feMergeNode in="SourceGraphic" />      </feMerge>    </filter>    <style type="text/css">      <![CDATA[      /*** CLOUDS*/      @keyframes am-weather-cloud-2 {        0% {          -webkit-transform: translate(0px, 0px);          -moz-transform: translate(0px, 0px);          -ms-transform: translate(0px, 0px);          transform: translate(0px, 0px);        }        50% {          -webkit-transform: translate(2px, 0px);          -moz-transform: translate(2px, 0px);          -ms-transform: translate(2px, 0px);          transform: translate(2px, 0px);        }        100% {          -webkit-transform: translate(0px, 0px);          -moz-transform: translate(0px, 0px);          -ms-transform: translate(0px, 0px);          transform: translate(0px, 0px);        }      }      .am-weather-cloud-2 {        -webkit-animation-name: am-weather-cloud-2;        -moz-animation-name: am-weather-cloud-2;        animation-name: am-weather-cloud-2;        -webkit-animation-duration: 3s;        -moz-animation-duration: 3s;        animation-duration: 3s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      /*** RAIN*/      @keyframes am-weather-rain {        0% {          stroke-dashoffset: 0;        }        100% {          stroke-dashoffset: -100;        }      }      .am-weather-rain-1 {        -webkit-animation-name: am-weather-rain;        -moz-animation-name: am-weather-rain;        -ms-animation-name: am-weather-rain;        animation-name: am-weather-rain;        -webkit-animation-duration: 8s;        -moz-animation-duration: 8s;        -ms-animation-duration: 8s;        animation-duration: 8s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      ]]>    </style>  </defs>  <g transform="translate(16,-2)" filter="url(#blur)">    <g class="am-weather-cloud-3"      style="-moz-animation-duration:3s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-cloud-2;-moz-animation-timing-function:linear;-webkit-animation-duration:3s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-cloud-2;-webkit-animation-timing-function:linear">      <path transform="translate(-20,-11)"        d="m47.7 35.4c0-4.6-3.7-8.2-8.2-8.2-1 0-1.9 0.2-2.8 0.5-0.3-3.4-3.1-6.2-6.6-6.2-3.7 0-6.7 3-6.7 6.7 0 0.8 0.2 1.6 0.4 2.3-0.3-0.1-0.7-0.1-1-0.1-3.7 0-6.7 3-6.7 6.7 0 3.6 2.9 6.6 6.5 6.7h17.2c4.4-0.5 7.9-4 7.9-8.4z"        fill="#57a0ee" stroke="#fff" stroke-linejoin="round" stroke-width="1.2" />    </g>    <g transform="translate(-20,-10) rotate(10,-238.68,233.96)">      <line class="am-weather-rain-1" transform="translate(-6,1)" y2="8" fill="none" stroke="#91c0f8"        stroke-dasharray="4, 7" stroke-linecap="round" stroke-width="2"        style="-moz-animation-duration:8s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-rain;-moz-animation-timing-function:linear;-ms-animation-duration:8s;-ms-animation-iteration-count:infinite;-ms-animation-name:am-weather-rain;-ms-animation-timing-function:linear;-webkit-animation-duration:8s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-rain;-webkit-animation-timing-function:linear" />    </g>  </g></svg>',
    '10':'<svg viewBox="0 0 56 48" xmlns="http://www.w3.org/2000/svg">  <defs>    <filter id="blur" x="-.24684" y="-.23409" width="1.4937" height="1.5702">      <feGaussianBlur in="SourceAlpha" stdDeviation="3" />      <feOffset dx="0" dy="4" result="offsetblur" />      <feComponentTransfer>        <feFuncA slope="0.05" type="linear" />      </feComponentTransfer>      <feMerge>        <feMergeNode />        <feMergeNode in="SourceGraphic" />      </feMerge>    </filter>    <style type="text/css">      <![CDATA[      /*** RAIN*/      @keyframes am-weather-rain {        0% {          stroke-dashoffset: 0;        }        100% {          stroke-dashoffset: -100;        }      }      .am-weather-rain-1 {        -webkit-animation-name: am-weather-rain;        -moz-animation-name: am-weather-rain;        -ms-animation-name: am-weather-rain;        animation-name: am-weather-rain;        -webkit-animation-duration: 8s;        -moz-animation-duration: 8s;        -ms-animation-duration: 8s;        animation-duration: 8s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      .am-weather-rain-2 {        -webkit-animation-name: am-weather-rain;        -moz-animation-name: am-weather-rain;        -ms-animation-name: am-weather-rain;        animation-name: am-weather-rain;        -webkit-animation-delay: 0.25s;        -moz-animation-delay: 0.25s;        -ms-animation-delay: 0.25s;        animation-delay: 0.25s;        -webkit-animation-duration: 8s;        -moz-animation-duration: 8s;        -ms-animation-duration: 8s;        animation-duration: 8s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      /*** CLOUDS*/      @keyframes am-weather-cloud-2 {        0% {          -webkit-transform: translate(0px, 0px);          -moz-transform: translate(0px, 0px);          -ms-transform: translate(0px, 0px);          transform: translate(0px, 0px);        }        50% {          -webkit-transform: translate(2px, 0px);          -moz-transform: translate(2px, 0px);          -ms-transform: translate(2px, 0px);          transform: translate(2px, 0px);        }        100% {          -webkit-transform: translate(0px, 0px);          -moz-transform: translate(0px, 0px);          -ms-transform: translate(0px, 0px);          transform: translate(0px, 0px);        }      }      .am-weather-cloud-2 {        -webkit-animation-name: am-weather-cloud-2;        -moz-animation-name: am-weather-cloud-2;        animation-name: am-weather-cloud-2;        -webkit-animation-duration: 3s;        -moz-animation-duration: 3s;        animation-duration: 3s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      ]]>    </style>  </defs>  <g transform="translate(16,-2)" filter="url(#blur)">    <g class="am-weather-cloud-3"      style="-moz-animation-duration:3s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-cloud-2;-moz-animation-timing-function:linear;-webkit-animation-duration:3s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-cloud-2;-webkit-animation-timing-function:linear">      <path transform="translate(-20,-11)"        d="m47.7 35.4c0-4.6-3.7-8.2-8.2-8.2-1 0-1.9 0.2-2.8 0.5-0.3-3.4-3.1-6.2-6.6-6.2-3.7 0-6.7 3-6.7 6.7 0 0.8 0.2 1.6 0.4 2.3-0.3-0.1-0.7-0.1-1-0.1-3.7 0-6.7 3-6.7 6.7 0 3.6 2.9 6.6 6.5 6.7h17.2c4.4-0.5 7.9-4 7.9-8.4z"        fill="#57a0ee" stroke="#fff" stroke-linejoin="round" stroke-width="1.2" />    </g>    <g transform="translate(-20,-10) rotate(10,-245.89,217.31)" fill="none" stroke="#91c0f8" stroke-dasharray="4, 7" stroke-linecap="round"      stroke-width="2">      <line class="am-weather-rain-1" transform="translate(-6,1)" y2="8"        style="-moz-animation-duration:8s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-rain;-moz-animation-timing-function:linear;-ms-animation-duration:8s;-ms-animation-iteration-count:infinite;-ms-animation-name:am-weather-rain;-ms-animation-timing-function:linear;-webkit-animation-duration:8s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-rain;-webkit-animation-timing-function:linear" />      <line class="am-weather-rain-2" transform="translate(0,-1)" y2="8"        style="-moz-animation-delay:0.25s;-moz-animation-duration:8s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-rain;-moz-animation-timing-function:linear;-ms-animation-delay:0.25s;-ms-animation-duration:8s;-ms-animation-iteration-count:infinite;-ms-animation-name:am-weather-rain;-ms-animation-timing-function:linear;-webkit-animation-delay:0.25s;-webkit-animation-duration:8s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-rain;-webkit-animation-timing-function:linear" />    </g>  </g></svg>',
    '11':'<svg viewBox="0 0 56 48" xmlns="http://www.w3.org/2000/svg"> <defs>  <filter id="blur" x="-.24684" y="-.19575" width="1.4937" height="1.4959">   <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>   <feOffset dx="0" dy="4" result="offsetblur"/>   <feComponentTransfer>    <feFuncA slope="0.05" type="linear"/>   </feComponentTransfer>   <feMerge>    <feMergeNode/>    <feMergeNode in="SourceGraphic"/>   </feMerge>  </filter>  <style type="text/css"><![CDATA[/*** CLOUDS*/@keyframes am-weather-cloud-1 {  0% {    -webkit-transform: translate(-5px,0px);       -moz-transform: translate(-5px,0px);        -ms-transform: translate(-5px,0px);            transform: translate(-5px,0px);  }  50% {    -webkit-transform: translate(10px,0px);       -moz-transform: translate(10px,0px);        -ms-transform: translate(10px,0px);            transform: translate(10px,0px);  }  100% {    -webkit-transform: translate(-5px,0px);       -moz-transform: translate(-5px,0px);        -ms-transform: translate(-5px,0px);            transform: translate(-5px,0px);  }}.am-weather-cloud-1 {  -webkit-animation-name: am-weather-cloud-1;     -moz-animation-name: am-weather-cloud-1;          animation-name: am-weather-cloud-1;  -webkit-animation-duration: 7s;     -moz-animation-duration: 7s;          animation-duration: 7s;  -webkit-animation-timing-function: linear;     -moz-animation-timing-function: linear;          animation-timing-function: linear;  -webkit-animation-iteration-count: infinite;     -moz-animation-iteration-count: infinite;          animation-iteration-count: infinite;}@keyframes am-weather-cloud-2 {  0% {    -webkit-transform: translate(0px,0px);       -moz-transform: translate(0px,0px);        -ms-transform: translate(0px,0px);            transform: translate(0px,0px);  }  50% {    -webkit-transform: translate(2px,0px);       -moz-transform: translate(2px,0px);        -ms-transform: translate(2px,0px);            transform: translate(2px,0px);  }  100% {    -webkit-transform: translate(0px,0px);       -moz-transform: translate(0px,0px);        -ms-transform: translate(0px,0px);            transform: translate(0px,0px);  }}.am-weather-cloud-2 {  -webkit-animation-name: am-weather-cloud-2;     -moz-animation-name: am-weather-cloud-2;          animation-name: am-weather-cloud-2;  -webkit-animation-duration: 3s;     -moz-animation-duration: 3s;          animation-duration: 3s;  -webkit-animation-timing-function: linear;     -moz-animation-timing-function: linear;          animation-timing-function: linear;  -webkit-animation-iteration-count: infinite;     -moz-animation-iteration-count: infinite;          animation-iteration-count: infinite;}/*** STROKE*/@keyframes am-weather-stroke {  0% {    -webkit-transform: translate(0.0px,0.0px);       -moz-transform: translate(0.0px,0.0px);        -ms-transform: translate(0.0px,0.0px);            transform: translate(0.0px,0.0px);  }  2% {    -webkit-transform: translate(0.3px,0.0px);       -moz-transform: translate(0.3px,0.0px);        -ms-transform: translate(0.3px,0.0px);            transform: translate(0.3px,0.0px);  }  4% {    -webkit-transform: translate(0.0px,0.0px);       -moz-transform: translate(0.0px,0.0px);        -ms-transform: translate(0.0px,0.0px);            transform: translate(0.0px,0.0px);  }  6% {    -webkit-transform: translate(0.5px,0.4px);       -moz-transform: translate(0.5px,0.4px);        -ms-transform: translate(0.5px,0.4px);            transform: translate(0.5px,0.4px);  }  8% {    -webkit-transform: translate(0.0px,0.0px);       -moz-transform: translate(0.0px,0.0px);        -ms-transform: translate(0.0px,0.0px);            transform: translate(0.0px,0.0px);  }  10% {    -webkit-transform: translate(0.3px,0.0px);       -moz-transform: translate(0.3px,0.0px);        -ms-transform: translate(0.3px,0.0px);            transform: translate(0.3px,0.0px);  }  12% {    -webkit-transform: translate(0.0px,0.0px);       -moz-transform: translate(0.0px,0.0px);        -ms-transform: translate(0.0px,0.0px);            transform: translate(0.0px,0.0px);  }  14% {    -webkit-transform: translate(0.3px,0.0px);       -moz-transform: translate(0.3px,0.0px);        -ms-transform: translate(0.3px,0.0px);            transform: translate(0.3px,0.0px);  }  16% {    -webkit-transform: translate(0.0px,0.0px);       -moz-transform: translate(0.0px,0.0px);        -ms-transform: translate(0.0px,0.0px);            transform: translate(0.0px,0.0px);  }  18% {    -webkit-transform: translate(0.3px,0.0px);       -moz-transform: translate(0.3px,0.0px);        -ms-transform: translate(0.3px,0.0px);            transform: translate(0.3px,0.0px);  }  20% {    -webkit-transform: translate(0.0px,0.0px);       -moz-transform: translate(0.0px,0.0px);        -ms-transform: translate(0.0px,0.0px);            transform: translate(0.0px,0.0px);  }  22% {    -webkit-transform: translate(1px,0.0px);       -moz-transform: translate(1px,0.0px);        -ms-transform: translate(1px,0.0px);            transform: translate(1px,0.0px);  }  24% {    -webkit-transform: translate(0.0px,0.0px);       -moz-transform: translate(0.0px,0.0px);        -ms-transform: translate(0.0px,0.0px);            transform: translate(0.0px,0.0px);  }  26% {    -webkit-transform: translate(-1px,0.0px);       -moz-transform: translate(-1px,0.0px);        -ms-transform: translate(-1px,0.0px);            transform: translate(-1px,0.0px);  }  28% {    -webkit-transform: translate(0.0px,0.0px);       -moz-transform: translate(0.0px,0.0px);        -ms-transform: translate(0.0px,0.0px);            transform: translate(0.0px,0.0px);  }  40% {    fill: orange;    -webkit-transform: translate(0.0px,0.0px);       -moz-transform: translate(0.0px,0.0px);        -ms-transform: translate(0.0px,0.0px);            transform: translate(0.0px,0.0px);  }  65% {    fill: white;    -webkit-transform: translate(-1px,5.0px);       -moz-transform: translate(-1px,5.0px);        -ms-transform: translate(-1px,5.0px);            transform: translate(-1px,5.0px);  }  61% {    fill: orange;  }  100% {    -webkit-transform: translate(0.0px,0.0px);       -moz-transform: translate(0.0px,0.0px);        -ms-transform: translate(0.0px,0.0px);            transform: translate(0.0px,0.0px);  }}.am-weather-stroke {  -webkit-animation-name: am-weather-stroke;     -moz-animation-name: am-weather-stroke;          animation-name: am-weather-stroke;  -webkit-animation-duration: 1.11s;     -moz-animation-duration: 1.11s;          animation-duration: 1.11s;  -webkit-animation-timing-function: linear;     -moz-animation-timing-function: linear;          animation-timing-function: linear;  -webkit-animation-iteration-count: infinite;     -moz-animation-iteration-count: infinite;          animation-iteration-count: infinite;}        ]]></style> </defs> <g id="thunder" transform="translate(-4,-12)" filter="url(#blur)">  <g transform="translate(20,10)">   <g class="am-weather-cloud-1" style="-moz-animation-duration:7s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-cloud-1;-moz-animation-timing-function:linear;-webkit-animation-duration:7s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-cloud-1;-webkit-animation-timing-function:linear">    <path transform="matrix(.6 0 0 .6 -10 -6)" d="m47.7 35.4c0-4.6-3.7-8.2-8.2-8.2-1 0-1.9 0.2-2.8 0.5-0.3-3.4-3.1-6.2-6.6-6.2-3.7 0-6.7 3-6.7 6.7 0 0.8 0.2 1.6 0.4 2.3-0.3-0.1-0.7-0.1-1-0.1-3.7 0-6.7 3-6.7 6.7 0 3.6 2.9 6.6 6.5 6.7h17.2c4.4-0.5 7.9-4 7.9-8.4z" fill="#91c0f8" stroke="#fff" stroke-linejoin="round" stroke-width="1.2"/>   </g>   <path transform="translate(-20,-11)" d="m47.7 35.4c0-4.6-3.7-8.2-8.2-8.2-1 0-1.9 0.2-2.8 0.5-0.3-3.4-3.1-6.2-6.6-6.2-3.7 0-6.7 3-6.7 6.7 0 0.8 0.2 1.6 0.4 2.3-0.3-0.1-0.7-0.1-1-0.1-3.7 0-6.7 3-6.7 6.7 0 3.6 2.9 6.6 6.5 6.7h17.2c4.4-0.5 7.9-4 7.9-8.4z" fill="#57a0ee" stroke="#fff" stroke-linejoin="round" stroke-width="1.2"/>   <g transform="matrix(1.2,0,0,1.2,-4,28)">    <polygon class="am-weather-stroke" points="11.1 6.9 14.3 -2.9 20.5 -2.9 16.4 4.3 20.3 4.3 11.5 14.6 14.9 6.9" fill="#ffa500" stroke="#fff" style="-moz-animation-duration:1.11s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-stroke;-moz-animation-timing-function:linear;-webkit-animation-duration:1.11s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-stroke;-webkit-animation-timing-function:linear"/>   </g>  </g> </g></svg>',
    '13':'<svg viewBox="0 0 56 48" xmlns="http://www.w3.org/2000/svg">  <defs>    <filter id="blur" x="-.24684" y="-.26897" width="1.4937" height="1.6759">      <feGaussianBlur in="SourceAlpha" stdDeviation="3" />      <feOffset dx="0" dy="4" result="offsetblur" />      <feComponentTransfer>        <feFuncA slope="0.05" type="linear" />      </feComponentTransfer>      <feMerge>        <feMergeNode />        <feMergeNode in="SourceGraphic" />      </feMerge>    </filter>    <style type="text/css">      <![CDATA[      /*** CLOUDS*/      @keyframes am-weather-cloud-2 {        0% {          -webkit-transform: translate(0px, 0px);          -moz-transform: translate(0px, 0px);          -ms-transform: translate(0px, 0px);          transform: translate(0px, 0px);        }        50% {          -webkit-transform: translate(2px, 0px);          -moz-transform: translate(2px, 0px);          -ms-transform: translate(2px, 0px);          transform: translate(2px, 0px);        }        100% {          -webkit-transform: translate(0px, 0px);          -moz-transform: translate(0px, 0px);          -ms-transform: translate(0px, 0px);          transform: translate(0px, 0px);        }      }      .am-weather-cloud-2 {        -webkit-animation-name: am-weather-cloud-2;        -moz-animation-name: am-weather-cloud-2;        animation-name: am-weather-cloud-2;        -webkit-animation-duration: 3s;        -moz-animation-duration: 3s;        animation-duration: 3s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      /*** SNOW*/      @keyframes am-weather-snow {        0% {          -webkit-transform: translate(0.0px, 0);          -moz-transform: translate(0.0px, 0);          -ms-transform: translate(0.0px, 0);          transform: translate(0.0px, 0);        }        33.33% {          -webkit-transform: translate(-1.2px, 2px);          -moz-transform: translate(-1.2px, 2px);          -ms-transform: translate(-1.2px, 2px);          transform: translate(-1.2px, 2px);        }        66.66% {          -webkit-transform: translate(1.4px, 4px);          -moz-transform: translate(1.4px, 4px);          -ms-transform: translate(1.4px, 4px);          transform: translate(1.4px, 4px);          opacity: 1;        }        100% {          -webkit-transform: translate(-1.6px, 6px);          -moz-transform: translate(-1.6px, 6px);          -ms-transform: translate(-1.6px, 6px);          transform: translate(-1.6px, 6px);          opacity: 0;        }      }      .am-weather-snow-1 {        -webkit-animation-name: am-weather-snow;        -moz-animation-name: am-weather-snow;        -ms-animation-name: am-weather-snow;        animation-name: am-weather-snow;        -webkit-animation-duration: 2s;        -moz-animation-duration: 2s;        -ms-animation-duration: 2s;        animation-duration: 2s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      ]]>    </style>  </defs>  <g transform="translate(16,-2)" filter="url(#blur)">    <g class="am-weather-cloud-3"      style="-moz-animation-duration:3s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-cloud-2;-moz-animation-timing-function:linear;-webkit-animation-duration:3s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-cloud-2;-webkit-animation-timing-function:linear">      <path transform="translate(-20,-11)"        d="m47.7 35.4c0-4.6-3.7-8.2-8.2-8.2-1 0-1.9 0.2-2.8 0.5-0.3-3.4-3.1-6.2-6.6-6.2-3.7 0-6.7 3-6.7 6.7 0 0.8 0.2 1.6 0.4 2.3-0.3-0.1-0.7-0.1-1-0.1-3.7 0-6.7 3-6.7 6.7 0 3.6 2.9 6.6 6.5 6.7h17.2c4.4-0.5 7.9-4 7.9-8.4z"        fill="#57a0ee" stroke="#fff" stroke-linejoin="round" stroke-width="1.2" />    </g>    <g class="am-weather-snow-1"      style="-moz-animation-duration:2s;-moz-animation-iteration-count:infinite;-moz-animation-name:am-weather-snow;-moz-animation-timing-function:linear;-ms-animation-duration:2s;-ms-animation-iteration-count:infinite;-ms-animation-name:am-weather-snow;-ms-animation-timing-function:linear;-webkit-animation-duration:2s;-webkit-animation-iteration-count:infinite;-webkit-animation-name:am-weather-snow;-webkit-animation-timing-function:linear">      <g transform="translate(11,28)" fill="none" stroke="#57a0ee" stroke-linecap="round">        <line transform="translate(0,9)" y1="-2.5" y2="2.5" stroke-width="1.2" />        <line transform="rotate(45,-10.864,4.5)" y1="-2.5" y2="2.5" />        <line transform="rotate(90,-4.5,4.5)" y1="-2.5" y2="2.5" />        <line transform="rotate(135,-1.864,4.5)" y1="-2.5" y2="2.5" />      </g>    </g>  </g></svg>',
    '50':'<svg viewBox="0 0 56 48" xmlns="http://www.w3.org/2000/svg">  <defs>    <filter id="blur" x="-.20655" y="-.21122" width="1.403" height="1.4997">      <feGaussianBlur in="SourceAlpha" stdDeviation="3" />      <feOffset dx="0" dy="4" result="offsetblur" />      <feComponentTransfer>        <feFuncA slope="0.05" type="linear" />      </feComponentTransfer>      <feMerge>        <feMergeNode />        <feMergeNode in="SourceGraphic" />      </feMerge>    </filter>    <style type="text/css">      <![CDATA[      /*** haze*/      @keyframes am-weather-haze-1 {        0% {          transform: translate(0px, 0px)        }        50% {          transform: translate(7px, 0px)        }        100% {          transform: translate(0px, 0px)        }      }      .am-weather-haze-1 {        -webkit-animation-name: am-weather-haze-1;        -moz-animation-name: am-weather-haze-1;        -ms-animation-name: am-weather-haze-1;        animation-name: am-weather-haze-1;        -webkit-animation-duration: 8s;        -moz-animation-duration: 8s;        -ms-animation-duration: 8s;        animation-duration: 8s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      @keyframes am-weather-haze-2 {        0% {          transform: translate(0px, 0px)        }        21.05% {          transform: translate(-6px, 0px)        }        78.95% {          transform: translate(9px, 0px)        }        100% {          transform: translate(0px, 0px)        }      }      .am-weather-haze-2 {        -webkit-animation-name: am-weather-haze-2;        -moz-animation-name: am-weather-haze-2;        -ms-animation-name: am-weather-haze-2;        animation-name: am-weather-haze-2;        -webkit-animation-duration: 20s;        -moz-animation-duration: 20s;        -ms-animation-duration: 20s;        animation-duration: 20s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      @keyframes am-weather-haze-3 {        0% {          transform: translate(0px, 0px)        }        25% {          transform: translate(4px, 0px)        }        75% {          transform: translate(-4px, 0px)        }        100% {          transform: translate(0px, 0px)        }      }      .am-weather-haze-3 {        -webkit-animation-name: am-weather-haze-3;        -moz-animation-name: am-weather-haze-3;        -ms-animation-name: am-weather-haze-3;        animation-name: am-weather-haze-3;        -webkit-animation-duration: 6s;        -moz-animation-duration: 6s;        -ms-animation-duration: 6s;        animation-duration: 6s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      @keyframes am-weather-haze-4 {        0% {          transform: translate(0px, 0px)        }        50% {          transform: translate(-4px, 0px)        }        100% {          transform: translate(0px, 0px)        }      }      .am-weather-haze-4 {        -webkit-animation-name: am-weather-haze-4;        -moz-animation-name: am-weather-haze-4;        -ms-animation-name: am-weather-haze-4;        animation-name: am-weather-haze-4;        -webkit-animation-duration: 6s;        -moz-animation-duration: 6s;        -ms-animation-duration: 6s;        animation-duration: 6s;        -webkit-animation-timing-function: linear;        -moz-animation-timing-function: linear;        -ms-animation-timing-function: linear;        animation-timing-function: linear;        -webkit-animation-iteration-count: infinite;        -moz-animation-iteration-count: infinite;        -ms-animation-iteration-count: infinite;        animation-iteration-count: infinite;      }      ]]>    </style>  </defs>  <g transform="translate(16,-2)" filter="url(#blur)">    <g class="am-weather-haze" transform="translate(-10,20)" fill="none" stroke="#cd9e73" stroke-linecap="round"      stroke-width="2">      <line class="am-weather-haze-1" y1="0" y2="0" x1="1" x2="37" stroke-dasharray="3, 5, 17, 5, 7" />      <line class="am-weather-haze-2" y1="5" y2="5" x1="9" x2="33" stroke-dasharray="11, 7, 15" />      <line class="am-weather-haze-3" y1="10" y2="10" x1="5" x2="40" stroke-dasharray="11, 7, 3, 5, 9" />      <line class="am-weather-haze-4" y1="15" y2="15" x1="7" x2="42" stroke-dasharray="13, 5, 9, 5, 3" />    </g>  </g></svg>',
  };
  const FALLBACK_WX = WX_ICONS['01'];
  function owmIcon(icon) { return WX_ICONS[icon.slice(0,2)] || FALLBACK_WX; }


  function renderWeatherData(data) {
    const el = $('weatherWidget');
    if (!el || !data) return;
    const cfg = JSON.parse(localStorage.getItem(WEATHER_CONFIG_KEY) || '{}');
    const unit = cfg.unit || 'metric';
    const unitLabel = unit === 'metric' ? '°C' : '°F';
    const temp = Math.round(data.main.temp);
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
      sunHtml = '<div class="weather-sun-row"><span class="weather-sun-rise">↑ ' + fmt(sr) + '</span><span class="weather-sun-set">' + fmt(ss) + ' ↓</span></div>';
    }
    let rec;
    if (cond === 'Clear' && temp > (unit === 'metric' ? 20 : 68)) rec = 'Great conditions for an outdoor break.';
    else if (cond === 'Clear' && h >= 17 && h < 21) rec = 'Evening walk recommended.';
    else if (cond === 'Clouds' || cond === 'Rain' || cond === 'Drizzle' || cond === 'Thunderstorm') rec = 'Great weather for indoor focus.';
    else if (temp > (unit === 'metric' ? 28 : 82)) rec = 'Stay hydrated in the heat.';
    else if (temp < (unit === 'metric' ? 5 : 41)) rec = 'Bundle up — cold day ahead.';
    else rec = 'Conditions look good for a balanced day.';
    el.innerHTML =
      '<div class="weather-row"><span class="weather-temp">' + temp + unitLabel + '</span></div>' +
      '<div class="weather-cond">' + desc + '</div>' +
      '<div class="weather-meta-row"><span>' + humidity + '% humidity</span></div>' +
      '<div class="weather-hl"><span class="weather-hl-hi">↑ ' + hi + unitLabel + '</span><span class="weather-hl-lo">' + lo + unitLabel + ' ↓</span></div>' +
      '<div class="weather-icon-mid"><span class="weather-icon">' + icon + '</span></div>' +
      sunHtml +
      '<div class="weather-rec">' + rec + '</div>';
    // Condition data attr for optional per-condition theming
    el.closest('.card').dataset.weather = cond;
    // Gear in card-head
    const head = el.closest('.card').querySelector('.card-head');
    head.querySelector('.weather-cfg-btn')?.remove();
    head.insertAdjacentHTML('beforeend', '<button class="weather-cfg-btn" onclick="renderWeatherSetup(true)">⚙</button>');
  }

  function pickWeatherUnit(btn) {
    btn.closest('.weather-unit-row').querySelectorAll('.weather-unit-btn').forEach(function(b) {
      b.classList.toggle('is-active', b === btn);
    });
  }
  function renderWeatherSetup(forceShow) {
    const el = $('weatherWidget');
    if (!el) return;
    el.closest('.card').removeAttribute('data-weather');
    // Remove gear from card-head in setup mode
    const head = el.closest('.card').querySelector('.card-head');
    head.querySelector('.weather-cfg-btn')?.remove();
    el.innerHTML =
      '<form class="weather-form" onsubmit="saveWeatherConfig(event)">' +
        '<input id="wxApiKey" type="text" placeholder="OpenWeatherMap API key" autocomplete="off">' +
        '<input id="wxCity" type="text" placeholder="City (e.g. San Francisco)">' +
        '<div class="weather-unit-row"><button type="button" class="weather-unit-btn is-active" data-unit="metric" onclick="window.pickWeatherUnit(this)">°C</button><button type="button" class="weather-unit-btn" data-unit="imperial" onclick="window.pickWeatherUnit(this)">°F</button></div>' +
        '<button type="submit" class="weather-save-btn">Save</button>' +
      '</form>';
    const cfg = JSON.parse(localStorage.getItem(WEATHER_CONFIG_KEY) || '{}');
    if (cfg.apiKey) el.querySelector('#wxApiKey').value = cfg.apiKey;
    if (cfg.city) el.querySelector('#wxCity').value = cfg.city;
    el.querySelectorAll('.weather-unit-btn').forEach(function(b) {
      b.classList.toggle('is-active', b.getAttribute('data-unit') === (cfg.unit || 'metric'));
    });
  }
  function saveWeatherConfig(e) {
    e.preventDefault();
    const apiKey = document.getElementById('wxApiKey').value.trim();
    const city = document.getElementById('wxCity').value.trim();
    const unit = document.querySelector('.weather-unit-btn.is-active')?.getAttribute('data-unit') || 'metric';
    if (!apiKey || !city) return;
    localStorage.setItem(WEATHER_CONFIG_KEY, JSON.stringify({ apiKey, city, unit }));
    localStorage.removeItem(WEATHER_CACHE_KEY);
    renderWeather();
  }
  function renderWeather() {
    const el = $('weatherWidget');
    if (!el) return;
    const cfg = JSON.parse(localStorage.getItem(WEATHER_CONFIG_KEY) || '{}');
    if (!cfg.apiKey || !cfg.city) { renderWeatherSetup(); return; }
    const cache = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
    if (cache && cache.fetchedAt && (Date.now() - cache.fetchedAt) < WEATHER_TTL) {
      renderWeatherData(cache.data);
      return;
    }
    const unit = cfg.unit || 'metric';
    const url = 'https://api.openweathermap.org/data/2.5/weather?q=' + encodeURIComponent(cfg.city) + '&appid=' + cfg.apiKey + '&units=' + unit;
    el.closest('.card').removeAttribute('data-weather');
    el.innerHTML = '<div class="weather-loading">Loading…</div>';
    fetch(url).then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(data => {
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }));
      renderWeatherData(data);
    }).catch(() => {
      if (cache) { renderWeatherData(cache.data); return; }
      el.closest('.card').removeAttribute('data-weather');
      el.innerHTML = '<div class="weather-error">Weather unavailable. <button class="weather-cfg-btn" onclick="renderWeatherSetup(true)">Configure →</button></div>';
      // Remove head gear (error has its own action button)
      const head = el.closest('.card').querySelector('.card-head');
      head.querySelector('.weather-cfg-btn')?.remove();
    });
  }
  window.renderWeatherSetup = renderWeatherSetup;
  window.pickWeatherUnit = pickWeatherUnit;
  window.saveWeatherConfig = saveWeatherConfig;
  window.renderWeather = renderWeather;

  /* ─── Hero "Current Focus" + badge ─── */
  function updateHeroNextUp() {
    const taskEl = $('cfTaskText');
    if (!taskEl) return;
    try {
      const key = 'goals:' + window.getTodayYmd();
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      const nowMin = (new Date()).getHours() * 60 + (new Date()).getMinutes();

      // Active time-blocked goal takes priority over queued
      const activeTimedGoal = data.find(function(g) {
        if (!g.timeSlot || !g.timeSlot.start || g.done) return false;
        return nowMin >= parseMin(g.timeSlot.start) && nowMin < parseMin(g.timeSlot.end || g.timeSlot.start);
      });

      const q = data.find(g => g.queued && !g.done);
      taskEl.textContent = activeTimedGoal ? activeTimedGoal.text : (q ? q.text : '—');
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

  /* Auto-apply: if no saved timeline yet, apply the first auto-apply template */
  if (localStorage.getItem(TL_KEY) === null) {
    var _tmpls = getTemplates();
    var _autoTmpl = _tmpls.find(function(t) { return t.autoApply; });
    if (_autoTmpl) {
      saveBlocks(_autoTmpl.blocks.map(function(b) { return Object.assign({ id: tlUid() }, b); }));
      localStorage.setItem(ACTIVE_TMPL_KEY, _tmpls.indexOf(_autoTmpl));
    }
  }

  renderTimeline();
  updateTemplateSelect();
  (function() {
    var sel = $('tlTemplateSelect');
    if (!sel) return;
    var active = localStorage.getItem(ACTIVE_TMPL_KEY);
    if (active != null && sel.querySelector('option[value="' + active + '"]')) {
      sel.value = active;
    }
  })();

  var _saveTemplBtn = $('tlSaveTemplate');
  if (_saveTemplBtn) _saveTemplBtn.addEventListener('click', openSaveTemplatePop);

  var _tmplSel = $('tlTemplateSelect');
  if (_tmplSel) _tmplSel.addEventListener('change', function() {
    var val = _tmplSel.value;
    if (!val) return;
    if (val === '__manage') { openManageTemplates(); _tmplSel.value = ''; return; }
    var idx = parseInt(val, 10);
    var tmpls = getTemplates();
    if (!tmpls[idx]) { _tmplSel.value = ''; return; }
    saveBlocks(tmpls[idx].blocks.map(function(b) { return Object.assign({ id: tlUid() }, b); }));
    renderTimeline();
    showToast('Template applied');
    _tmplSel.value = idx;
    localStorage.setItem(ACTIVE_TMPL_KEY, idx);
  });

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
  /* Auto-refresh weather every 5 min so it stays current while the page is open */
  if (weatherRefreshTimer) clearInterval(weatherRefreshTimer);
  weatherRefreshTimer = setInterval(renderWeather, WEATHER_REFRESH_INTERVAL);
  /* When user returns to the tab, invalidate cache so it re-fetches immediately */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      var cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
      if (cached && cached.fetchedAt && (Date.now() - cached.fetchedAt) >= WEATHER_TTL / 2) {
        // Cache is more than halfway to expiry — ditch it so the next call fetches fresh
        localStorage.removeItem(WEATHER_CACHE_KEY);
      }
      renderWeather();
    }
  });
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
    renderTimeline();
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
