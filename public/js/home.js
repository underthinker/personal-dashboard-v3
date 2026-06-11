/* ═══ HOME TAB WIDGETS ═══
   Extracted from index.html inline script. Loaded last so it can call into
   render* helpers exported by goals/habits/health. */
(function(){
  const $ = id => document.getElementById(id);

  /* ─── Timeline v2 (range blocks, inline edit, drag sort, undo delete) ─── */
  const TL_KEY_V1  = 'timeline_blocks_v1';
  const TL_KEY     = 'timeline_blocks_v2';
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

  /* ─── Template popovers ─── */
  var _tmplPop = null;

  function openSaveTemplatePop() {
    if (_tmplPop) { _tmplPop.remove(); _tmplPop = null; return; }
    var btn = _wandAnchor || $('tlSaveTemplate');
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
    var btn = _wandAnchor || $('tlTemplateSelect');
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

  function applyTemplate(idx) {
    var tmpls = getTemplates();
    if (!tmpls[idx]) return;
    saveBlocks(tmpls[idx].blocks.map(function(b) { return Object.assign({ id: tlUid() }, b); }));
    renderTimeline();
    showToast('Template applied');
    localStorage.setItem(ACTIVE_TMPL_KEY, idx);
    var sel = $('tlTemplateSelect');
    if (sel) sel.value = idx;
  }

  var _wandAnchor = null;

  function openTemplateMenu(anchor) {
    if (_tmplPop) { _tmplPop.remove(); _tmplPop = null; return; }
    _wandAnchor = anchor;
    var esc = window.escHtml;
    var tmpls = getTemplates();
    var pop = document.createElement('div');
    pop.className = 'tl-tmpl-pop tl-wand-menu'; pop.id = 'tlWandMenu';
    var html = '<div class="tl-recur-pop-title">Templates</div>';
    if (tmpls.length) {
      html += tmpls.map(function(t, i) {
        return '<button class="tl-wand-item" type="button" data-apply="' + i + '">' + esc(t.name) + (t.autoApply ? ' ★' : '') + '</button>';
      }).join('');
    } else {
      html += '<div class="tl-wand-empty">No templates yet</div>';
    }
    html += '<div class="tl-wand-sep"></div>' +
      '<button class="tl-wand-item" type="button" data-act="save">+ Save current as template…</button>' +
      (tmpls.length ? '<button class="tl-wand-item" type="button" data-act="manage">Manage templates…</button>' : '');
    pop.innerHTML = html;
    document.body.appendChild(pop);
    var rect = anchor.getBoundingClientRect();
    pop.style.left = Math.max(4, rect.right - 220) + 'px';
    pop.style.top  = (rect.top - pop.offsetHeight - 6 + window.scrollY) + 'px';
    function close() { if (_tmplPop) { _tmplPop.remove(); _tmplPop = null; } document.removeEventListener('click', out); }
    function out(e) { if (_tmplPop && !_tmplPop.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) close(); }
    pop.addEventListener('click', function(e) {
      var ap = e.target.closest('[data-apply]');
      var ac = e.target.closest('[data-act]');
      if (ap) { applyTemplate(parseInt(ap.getAttribute('data-apply'), 10)); close(); }
      else if (ac) { var a = ac.getAttribute('data-act'); close(); if (a === 'save') openSaveTemplatePop(); else openManageTemplates(); }
    });
    _tmplPop = pop;
    requestAnimationFrame(function() { document.addEventListener('click', out); });
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

  /* ─── Row visuals ─── */
  function tlSvg(inner) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }
  var TL_ICON_SVG = tlSvg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/>');

  // Keyword → icon, scanned in order; first match wins. Generic target is fallback.
  var TL_ICONS = [
    { re: /\b(morning|wake|stretch|routine|sunrise|meditat|yoga)\b/, svg: tlSvg('<path d="M12 2v3"/><path d="m4.9 6.9 2.1 2.1"/><path d="M2 14h3"/><path d="M19 14h3"/><path d="m17 9 2.1-2.1"/><path d="M22 18H2"/><path d="M18 18a6 6 0 0 0-12 0"/>') },
    { re: /\b(deep work|focus|coding|study|writing|build)\b/, svg: tlSvg('<path d="M3 12h3l2 6 4-14 2 8h7"/>') },
    { re: /\b(team|sync|standup|meeting|call|1:1|catch ?up)\b/, svg: tlSvg('<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.2"/><path d="M16 14.2a4.5 4.5 0 0 1 5 4.3"/>') },
    { re: /\b(lunch|dinner|breakfast|eat|meal|food|break)\b/, svg: tlSvg('<path d="M6 2v8a2 2 0 0 0 4 0V2"/><path d="M8 2v20"/><path d="M17 2c-1.5 1-2 3-2 5v4h2v11"/>') },
    { re: /\b(admin|email|inbox|message|plan(ning)?)\b/, svg: tlSvg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>') },
    { re: /\b(wind ?down|evening|review|reflect|night|sleep|rest)\b/, svg: tlSvg('<path d="M12 5v9"/><path d="m8 11 4 4 4-4"/><path d="M5 19h14"/>') },
    { re: /\b(exercise|gym|run|walk|workout|train|fitness|sport)\b/, svg: tlSvg('<path d="M6.5 6.5 17.5 17.5"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="M2 6l4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>') },
    { re: /\b(read|book|learn|course|lecture|research)\b/, svg: tlSvg('<path d="M2 5a3 3 0 0 1 3-3h5v18H5a3 3 0 0 0-3 3z"/><path d="M22 5a3 3 0 0 0-3-3h-5v18h5a3 3 0 0 1 3 3z"/>') }
  ];

  function tlIconFor(label) {
    var s = String(label || '').toLowerCase();
    for (var i = 0; i < TL_ICONS.length; i++) { if (TL_ICONS[i].re.test(s)) return TL_ICONS[i].svg; }
    return TL_ICON_SVG;
  }
  var TL_CHECK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  // Pure clock-based state: pending | active | done
  function tlState(start, end, nowMin) {
    if (!start) return 'pending';
    var sm = parseMin(start), em = end ? parseMin(end) : sm;
    if (nowMin < sm) return 'pending';
    if (em > sm && nowMin < em) return 'active';
    return 'done';
  }

  function tlStatusHtml(state) {
    if (state === 'done') return '<span class="tl-status tl-status-done" aria-label="Done">' + TL_CHECK_SVG + '</span>';
    if (state === 'active') return '<span class="tl-status tl-status-active"><span class="tl-status-dot"></span>In progress</span>';
    return '<span class="tl-status tl-status-pending" aria-label="Upcoming"></span>';
  }

  // Static title + a calm intention line that rotates by time of day.
  var TL_SUBS = {
    morning:   ['Flow with intention.', 'Begin gently, move with focus.', 'One block at a time.'],
    afternoon: ['Flow with intention.', 'Steady through the middle.', 'Protect your deep work.'],
    evening:   ['Flow with intention.', 'Wind down with intention.', 'Close the day kindly.']
  };
  function updateGreeting() {
    var el = $('tlGreetSub');
    if (!el) return;
    var d = new Date(), h = d.getHours();
    var part = h < 12 ? 'morning' : (h < 18 ? 'afternoon' : 'evening');
    var pool = TL_SUBS[part];
    // Stable per day+part so it doesn't flicker on every re-render.
    var idx = (d.getFullYear() + d.getMonth() * 31 + d.getDate()) % pool.length;
    el.textContent = pool[idx];
  }

  /* ─── Render ─── */
  function renderTimeline() {
    updateGreeting();
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

    // Merge blocks and goal entries
    var blocks = sortedBlocks().map(function(b) { return Object.assign({ _isGoal: false }, b); });
    var allEntries;
    if (goalEntries.length > 0) {
      allEntries = blocks.concat(goalEntries);
      allEntries.sort(function(a, b) { return parseMin(a.start || '0:00') - parseMin(b.start || '0:00'); });
    } else {
      allEntries = blocks;
    }

    const rows = allEntries.map(function(b, i) {
      const state    = tlState(b.start, b.end, nowMin);
      const isActive = state === 'active';
      const isLast   = i === allEntries.length - 1;
      const dur = fmtDur(b.start, b.end);
      const durPill = dur ? '<span class="tl-dur">' + esc(dur) + '</span>' : '';

      if (b._isGoal) {
        return (
          '<div class="tl-row tl-goal-row tl-state-' + state + (isActive ? ' tl-row-active' : '') + (isLast ? ' tl-row-last' : '') + '"' +
              ' data-tl-gkey="' + esc(b._gKey) + '" data-tl-gidx="' + b._gIdx + '">' +
            '<div class="tl-time-col"><span class="tl-start' + (isActive ? ' active' : '') + '">' + esc(b.start) + '</span></div>' +
            '<div class="tl-dot-col"><div class="tl-dot' + (isActive ? ' active' : '') + '"></div></div>' +
            '<div class="tl-content tl-state-' + state + (isActive ? ' active' : '') + '">' +
              '<span class="tl-icon">' + TL_ICON_SVG + '</span>' +
              '<div class="tl-body">' +
                '<div class="tl-title-row">' +
                  '<span class="tl-title' + (b.done ? ' tl-goal-done' : '') + '">' + esc(b.label) + '</span>' +
                  durPill +
                '</div>' +
              '</div>' +
              '<input type="checkbox" class="tl-goal-check"' + (b.done ? ' checked' : '') + ' aria-label="Mark done">' +
            '</div>' +
          '</div>'
        );
      }

      return (
        '<div class="tl-row tl-state-' + state + (isActive ? ' tl-row-active' : '') + (isLast ? ' tl-row-last' : '') + '" data-tl-id="' + esc(b.id) + '">' +
          '<div class="tl-time-col">' +
            '<span class="tl-start' + (isActive ? ' active' : '') + '" data-tl-time>' + esc(b.start) + '</span>' +
          '</div>' +
          '<div class="tl-dot-col"><div class="tl-dot' + (isActive ? ' active' : '') + '"></div></div>' +
          '<div class="tl-content tl-state-' + state + (isActive ? ' active' : '') + '">' +
            '<span class="tl-icon">' + tlIconFor(b.label) + '</span>' +
            '<div class="tl-body">' +
              '<div class="tl-title-row">' +
                '<span class="tl-title" data-tl-label>' + esc(b.label) + '</span>' +
                durPill +
              '</div>' +
              (b.sub ? '<div class="tl-sub" data-tl-sub>' + esc(b.sub) + '</div>' : '') +
            '</div>' +
            tlStatusHtml(state) +
            '<button class="tl-del-btn" data-tl-del="' + esc(b.id) + '" aria-label="Delete block"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    el.innerHTML = rows +
      '<div class="tl-quick-add">' +
        '<button class="tl-qa-btn" type="button" aria-label="Add block">+</button>' +
        '<input class="tl-qa-start" type="text" placeholder="9:00" autocomplete="off">' +
        '<input class="tl-qa-label" type="text" placeholder="Add a block…" autocomplete="off">' +
        '<button class="tl-qa-wand" type="button" aria-label="Templates"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg></button>' +
      '</div>';

    fitTimeline(el);

    const activeRow = el.querySelector('.tl-row-active');
    if (activeRow) el.scrollTop = activeRow.offsetTop - el.clientHeight / 2 + activeRow.offsetHeight / 2;

    updateResetBtn();
  }

   /* Shrink row density (via --tl-fit) until the schedule fits without scrolling.
      Floors at 0.55 so it stays legible; past that the widget falls back to scroll. */
  var TL_FIT_MIN = 0.55;
  function fitTimeline(el) {
    el.classList.remove('tl-fit-dense');
    el.style.setProperty('--tl-fit', '1');
    var avail = el.clientHeight;
    if (!avail) return;
    if (el.scrollHeight <= avail) return;
    // 1) Shrink density down to the legibility floor.
    var f = Math.max(TL_FIT_MIN, avail / el.scrollHeight);
    el.style.setProperty('--tl-fit', f.toFixed(3));
    // 2) Still overflowing at the floor → drop subtitles (keeps titles readable),
    //    then re-shrink to the new content height.
    if (el.scrollHeight > avail + 1) {
      el.classList.add('tl-fit-dense');
      el.style.setProperty('--tl-fit', '1');
      if (el.scrollHeight > avail) {
        el.style.setProperty('--tl-fit', Math.max(TL_FIT_MIN, avail / el.scrollHeight).toFixed(3));
      }
    }
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

    if (e.target.closest('.tl-qa-btn')) { submitQuickAdd(); return; }

    var wandBtn = e.target.closest('.tl-qa-wand');
    if (wandBtn) { e.stopPropagation(); openTemplateMenu(wandBtn); return; }

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
    applyTemplate(parseInt(val, 10));
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

  /* Refit the schedule when the card is resized (window resize, custom layout). */
  if (window.ResizeObserver) {
    var _fitEl = $('timelineWidget');
    if (_fitEl) {
      var _fitRaf = 0;
      new ResizeObserver(function() {
        if (_fitRaf) return;
        _fitRaf = requestAnimationFrame(function() { _fitRaf = 0; fitTimeline(_fitEl); });
      }).observe(_fitEl);
    }
  }

  window.renderHomeInsights && window.renderHomeInsights();
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

  setInterval(function () { if (document.hidden) return; renderTimeline(); }, 60000);
})();
