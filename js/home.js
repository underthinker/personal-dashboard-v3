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
            '<button class="tl-del-btn" data-tl-rdel="' + esc(b.id) + '" aria-label="Delete block">\xd7</button>' +
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
          '<button class="tl-recur-btn" data-tl-recur-new="' + esc(b.id) + '" title="Set recurrence" aria-label="Set recurrence">↻</button>' +
          '<button class="tl-del-btn" data-tl-del="' + esc(b.id) + '" aria-label="Delete block">\xd7</button>' +
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
            if (e.target.checked) gs[gi].doneAt = Date.now(); else delete gs[gi].doneAt;
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
