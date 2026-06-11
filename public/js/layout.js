(function(){
  'use strict';

  // ───────── Themed confirm modal (replaces window.confirm) ─────────
  function confirmModal(opts) {
    var prevFocus = document.activeElement;
    var backdrop = document.createElement('div');
    backdrop.className = 'layout-confirm-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'layoutConfirmTitle');
    backdrop.setAttribute('aria-describedby', 'layoutConfirmBody');
    backdrop.innerHTML =
      '<div class="layout-confirm">' +
        '<div class="layout-confirm-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>' +
          '</svg>' +
        '</div>' +
        '<h2 class="layout-confirm-title" id="layoutConfirmTitle"></h2>' +
        '<p class="layout-confirm-body" id="layoutConfirmBody"></p>' +
        '<div class="layout-confirm-actions">' +
          '<button type="button" class="layout-confirm-cancel"></button>' +
          '<button type="button" class="layout-confirm-ok"></button>' +
        '</div>' +
      '</div>';
    backdrop.querySelector('.layout-confirm-title').textContent = opts.title || 'Are you sure?';
    backdrop.querySelector('.layout-confirm-body').textContent = opts.body || '';
    var cancelBtn = backdrop.querySelector('.layout-confirm-cancel');
    var okBtn = backdrop.querySelector('.layout-confirm-ok');
    cancelBtn.textContent = opts.cancelText || 'Cancel';
    okBtn.textContent = opts.confirmText || 'Confirm';

    function close(confirmed) {
      backdrop.classList.remove('open');
      document.removeEventListener('keydown', onKey, true);
      window.setTimeout(function() {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        if (prevFocus && prevFocus.focus) prevFocus.focus();
      }, 200);
      if (confirmed && opts.onConfirm) opts.onConfirm();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
      else if (e.key === 'Enter') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') {
        // Trap focus inside the dialog (two focusable buttons).
        var focusables = [cancelBtn, okBtn];
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    }
    okBtn.addEventListener('click', function() { close(true); });
    cancelBtn.addEventListener('click', function() { close(false); });
    backdrop.addEventListener('click', function(e) { if (e.target === backdrop) close(false); });
    document.addEventListener('keydown', onKey, true);

    document.body.appendChild(backdrop);
    // Force reflow so the open transition runs.
    void backdrop.offsetWidth;
    backdrop.classList.add('open');
    okBtn.focus();
  }

  // ───────── Constants ─────────
  var LAYOUT_KEY = 'home_layout_v1';   // key unchanged (synced via RAW_STRING_KEYS)
  var BLOB_V = 3;                       // current blob schema version
  // Weighted columns — match the named-area homepage exactly so entering
  // Customize is pixel-identical (no horizontal jump). Sum = 1390.
  var COL_FR = [305, 285, 245, 195, 360];
  var COL_SUM = 1390;
  var COLS = 5;
  var GAP = 16;                         // matches `.home-grid { gap: 16px }`
  var BASE_ROWS = 3;                    // the named-area grid is 3 rows tall
  // Fallback row unit (px) only — used when live row heights can't be measured.
  var ROW_H = 150;

  // ── Widget registry: single source of truth (metadata over the static cards) ──
  // min/max re-tuned for the 3-row model (1 cell-row ≈ one full named row).
  var WIDGETS = {
    'a-session':  { title: 'Focus Session',       minW: 2, minH: 1, maxW: 3, removable: false, config: null },
    'a-goals':    { title: "Today's Plan",         minW: 2, minH: 1,          removable: false, config: null },
    'a-stats':    { title: 'Performance Overview', minW: 1, minH: 1,          removable: true,  config: null },
    'a-tomorrow': { title: 'Plan Ahead',           minW: 1, minH: 1,          removable: true,  config: null },
    'a-timeline': { title: 'Timeline',             minW: 1, minH: 1,          removable: true,  config: null },
    'a-habits':   { title: 'Habits',               minW: 2, minH: 1,          removable: true,  config: null },
    'a-activity': { title: 'Activity Insight',     minW: 2, minH: 1,          removable: true,  config: null },
    'a-calendar': { title: 'Calendar',             minW: 1, minH: 1,          removable: true,  config: 'calendar' }
  };
  var CARD_IDS = Object.keys(WIDGETS);
  // Inline SVG icons (Lucide: grip, x) — theme via currentColor.
  var SVG_GRIP = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';
  var SVG_X = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  // SE resize grip (diagonal arrow).
  var SVG_RESIZE = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 21H3"/><path d="M21 21V3"/><path d="M21 21l-9-9"/></svg>';

  // DEFAULT_LAYOUT — EXACT 1:1 map of the named-area grid (3 rows tall).
  //   "session  session  goals   goals    stats"     y=0
  //   "tomorrow timeline habits  habits   stats"     y=1
  //   "activity activity .        .        calendar"  y=2
  var DEFAULT_LAYOUT = {
    v: BLOB_V, cols: 5,
    cards: {
      'a-session':  { x: 0, y: 0, w: 2, h: 1 },
      'a-goals':    { x: 2, y: 0, w: 2, h: 1 },
      'a-stats':    { x: 4, y: 0, w: 1, h: 2 },
      'a-tomorrow': { x: 0, y: 1, w: 1, h: 1 },
      'a-timeline': { x: 1, y: 1, w: 1, h: 1 },
      'a-habits':   { x: 2, y: 1, w: 2, h: 1 },
      'a-activity': { x: 0, y: 2, w: 2, h: 1 },
      'a-calendar': { x: 4, y: 2, w: 1, h: 1 }
    }
  };
  var DESKTOP_MQ = window.matchMedia('(min-width:1401px)');

  // ───────── Storage helpers (mirror habits.js) ─────────
  function storeGet(key) {
    try { var v = localStorage.getItem(key); return v == null ? null : JSON.parse(v); }
    catch (e) { return null; }
  }
  function storeSet(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function storeDelete(key) { localStorage.removeItem(key); }
  function debounce(fn, ms) {
    var t; return function() {
      var args = arguments, ctx = this;
      clearTimeout(t); t = setTimeout(function(){ fn.apply(ctx, args); }, ms);
    };
  }

  // ───────── State ─────────
  // No GridStack. Edit mode is a custom pointer drag/resize layer over the real
  // weighted CSS grid. Cards never leave .home-grid; we only toggle inline grid
  // props + handle elements, so existing listeners survive untouched.
  var editing = false;
  var homeGrid = null;
  var editHidden = [];     // ids hidden during the current edit session
  var positions = null;    // in-memory {id:{x,y,w,h}} while editing
  var editRows = null;     // [h0,h1,h2] measured row heights (px) for this session
  var editUnit = ROW_H;    // auto-row unit (px) for rows beyond BASE_ROWS

  function getHomeGrid() { return document.querySelector('.home-grid'); }

  // A custom layout only counts when it's a valid v3 blob. Older v1/v2 blobs use
  // an incompatible 5-row coordinate encoding → treated as "no custom layout".
  function getBlob() {
    var saved = storeGet(LAYOUT_KEY);
    return (saved && saved.v === BLOB_V) ? saved : null;
  }
  function hasCustomLayout() { return getBlob() != null; }

  // Hidden widgets from the saved v3 blob.
  function loadHidden() {
    var blob = getBlob();
    var h = blob && Array.isArray(blob.hidden) ? blob.hidden : [];
    return h.filter(function(id) { return CARD_IDS.indexOf(id) !== -1; });
  }

  // Detached holder keeping hidden .card nodes alive across edit sessions.
  function getHiddenHolder() {
    var el = document.getElementById('layoutHiddenHolder');
    if (!el) {
      el = document.createElement('div');
      el.id = 'layoutHiddenHolder';
      el.style.display = 'none';
      document.body.appendChild(el);
    }
    return el;
  }

  // Read saved v3 layout, validating each card against CARD_IDS; unknown/missing
  // cards fall back to their default slot so a stale blob never blanks the grid.
  function resolveLayout() {
    var blob = getBlob();
    var cards = {};
    var srcCards = (blob && blob.cards && typeof blob.cards === 'object') ? blob.cards : {};
    CARD_IDS.forEach(function(id) {
      var p = srcCards[id];
      var def = DEFAULT_LAYOUT.cards[id];
      if (p && isFinite(p.x) && isFinite(p.y)) {
        var meta = WIDGETS[id] || {};
        cards[id] = {
          x: +p.x, y: +p.y,
          w: isFinite(p.w) ? +p.w : (meta.minW || 1),
          h: isFinite(p.h) ? +p.h : (meta.minH || 1)
        };
      } else {
        cards[id] = Object.assign({}, def);
      }
    });
    return cards;
  }

  function layoutEqualsDefault(cards) {
    return CARD_IDS.every(function(id) {
      var a = cards[id], d = DEFAULT_LAYOUT.cards[id];
      return a && a.x === d.x && a.y === d.y && a.w === d.w && a.h === d.h;
    });
  }

  // ───────── Column geometry (pointer → cell math over weighted cols) ─────────
  // Returns { left:[], width:[], top0 } in px relative to the grid content box.
  function computeGeom() {
    var rect = homeGrid.getBoundingClientRect();
    var cs = getComputedStyle(homeGrid);
    var padL = parseFloat(cs.paddingLeft) || 0;
    var padT = parseFloat(cs.paddingTop) || 0;
    var gap = parseFloat(cs.columnGap);
    if (!isFinite(gap)) gap = GAP;
    var innerW = homeGrid.clientWidth - padL - (parseFloat(cs.paddingRight) || 0);
    var usableW = innerW - gap * (COLS - 1);
    var width = [], left = [], acc = 0;
    for (var i = 0; i < COLS; i++) {
      width[i] = usableW * COL_FR[i] / COL_SUM;
      left[i] = acc + gap * i;
      acc += width[i];
    }
    return {
      left: left, width: width, gap: gap,
      originX: rect.left + padL,
      originY: rect.top + padT
    };
  }

  // Nearest valid left column index for a card of span `w` given a target px.
  function colAtX(geom, px, w) {
    var best = 0, bestD = Infinity;
    for (var i = 0; i <= COLS - w; i++) {
      var d = Math.abs(geom.left[i] - px);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }
  // Column whose right edge is nearest target px (for resize width).
  function colRightAtX(geom, px, xStart) {
    var best = xStart, bestD = Infinity;
    for (var i = xStart; i < COLS; i++) {
      var rightEdge = geom.left[i] + geom.width[i];
      var d = Math.abs(rightEdge - px);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // ───────── Row measurement (the "no jump" guarantee) ─────────
  // Read the live rendered row heights of the current .home-grid BEFORE editing.
  function measureBaseRows() {
    var cs = getComputedStyle(homeGrid);
    var rows = (cs.gridTemplateRows || '').split(/\s+/).map(parseFloat).filter(isFinite);
    if (rows.length >= BASE_ROWS) return rows.slice(0, BASE_ROWS);
    return [ROW_H, ROW_H, ROW_H];
  }

  // ───────── Render a saved custom layout into the plain CSS grid ─────────
  function applyCustomCss(blob) {
    if (!homeGrid) return;
    homeGrid.classList.add('home-grid--custom');
    homeGrid.style.gridTemplateColumns = COL_FR.map(function(f){ return f + 'fr'; }).join(' ');
    var rows = (blob && Array.isArray(blob.rows) && blob.rows.length >= BASE_ROWS)
      ? blob.rows : [ROW_H, ROW_H, ROW_H];
    homeGrid.style.gridTemplateRows = rows.slice(0, BASE_ROWS).map(function(h){ return h + 'px'; }).join(' ');
    var unit = isFinite(blob && blob.rowUnit) ? blob.rowUnit : rows[0];
    homeGrid.style.gridAutoRows = unit + 'px';
    var cards = resolveLayout();
    CARD_IDS.forEach(function(id) {
      var card = homeGrid.querySelector('.' + id);
      if (!card) return;
      var p = cards[id];
      var w = Math.max(1, Math.min(p.w, COLS));
      var x = Math.max(0, Math.min(p.x, COLS - w));
      card.style.gridColumn = (x + 1) + ' / span ' + w;
      card.style.gridRow = (p.y + 1) + ' / span ' + p.h;
    });
  }
  function clearCustomCss() {
    if (!homeGrid) return;
    homeGrid.classList.remove('home-grid--custom');
    homeGrid.style.gridTemplateColumns = '';
    homeGrid.style.gridTemplateRows = '';
    homeGrid.style.gridAutoRows = '';
    CARD_IDS.forEach(function(id) {
      var card = homeGrid.querySelector('.' + id);
      if (card) { card.style.gridColumn = ''; card.style.gridRow = ''; }
    });
  }

  // Toggle display:none per card from the hidden list.
  function applyHidden(hidden) {
    if (!homeGrid) return;
    CARD_IDS.forEach(function(id) {
      var card = homeGrid.querySelector('.' + id);
      if (card) card.style.display = (hidden.indexOf(id) !== -1) ? 'none' : '';
    });
  }

  function renderLayout() {
    homeGrid = getHomeGrid();
    if (!homeGrid) return;
    // Switch to the weighted custom render only when card POSITIONS differ from
    // default. Hidden-only changes keep the pristine named-area grid.
    if (DESKTOP_MQ.matches && hasCustomLayout() && !layoutEqualsDefault(resolveLayout())) {
      applyCustomCss(getBlob());
    } else {
      clearCustomCss();
    }
    applyHidden(loadHidden());
  }

  // ───────── Edit mode (custom pointer layer) ─────────
  function setToolbar(on) {
    var tb = document.getElementById('layoutEditToolbar');
    if (tb) tb.classList.toggle('open', !!on);
  }

  // Occupancy of all visible cards except `exceptId`, as a Set of "x,y".
  function occupancy(exceptId) {
    var occ = {};
    CARD_IDS.forEach(function(id) {
      if (id === exceptId || editHidden.indexOf(id) !== -1) return;
      var p = positions[id];
      if (!p) return;
      for (var dx = 0; dx < p.w; dx++)
        for (var dy = 0; dy < p.h; dy++)
          occ[(p.x + dx) + ',' + (p.y + dy)] = true;
    });
    return occ;
  }
  function fits(pos, exceptId) {
    if (pos.x < 0 || pos.y < 0 || pos.x + pos.w > COLS) return false;
    var occ = occupancy(exceptId);
    for (var dx = 0; dx < pos.w; dx++)
      for (var dy = 0; dy < pos.h; dy++)
        if (occ[(pos.x + dx) + ',' + (pos.y + dy)]) return false;
    return true;
  }

  function applyPos(id) {
    var card = homeGrid.querySelector('.' + id);
    if (!card) return;
    var p = positions[id];
    card.style.gridColumn = (p.x + 1) + ' / span ' + p.w;
    card.style.gridRow = (p.y + 1) + ' / span ' + p.h;
  }

  function enterEdit() {
    if (editing) return;
    homeGrid = getHomeGrid();
    if (!homeGrid || !DESKTOP_MQ.matches) return;
    if (homeGrid.clientHeight === 0) return; // tab hidden → don't edit

    // Measure live rows BEFORE mutating anything (zero-jump guarantee).
    editRows = measureBaseRows();
    editUnit = editRows[0];

    positions = resolveLayout();
    editHidden = loadHidden();
    var holder = getHiddenHolder();

    editing = true;
    homeGrid.classList.add('home-grid--editing');
    homeGrid.style.gridTemplateColumns = COL_FR.map(function(f){ return f + 'fr'; }).join(' ');
    homeGrid.style.gridTemplateRows = editRows.map(function(h){ return h + 'px'; }).join(' ');
    homeGrid.style.gridAutoRows = editUnit + 'px';

    CARD_IDS.forEach(function(id) {
      var card = homeGrid.querySelector('.' + id) || holder.querySelector('.' + id);
      if (!card) return;
      card.style.display = '';
      if (editHidden.indexOf(id) !== -1) {
        stripHandles(card);
        holder.appendChild(card);
        return;
      }
      if (card.parentNode !== homeGrid) homeGrid.appendChild(card);
      addHandles(id, card);
      applyPos(id);
    });

    document.body.classList.add('is-editing-layout');
    setToolbar(true);
    buildPalette();
  }

  // Inject drag handle, resize grip, remove button + a11y onto a live card.
  function addHandles(id, card) {
    var meta = WIDGETS[id] || {};
    if (!card.querySelector('.card-drag-handle')) {
      var handle = document.createElement('div');
      handle.className = 'card-drag-handle';
      handle.setAttribute('aria-hidden', 'true');
      handle.innerHTML = '<span class="card-grip">' + SVG_GRIP + '</span>';
      handle.addEventListener('pointerdown', function(e){ startMove(e, id, card); });
      card.appendChild(handle);
    }
    if (!card.querySelector('.card-resize-handle')) {
      var rz = document.createElement('div');
      rz.className = 'card-resize-handle';
      rz.setAttribute('aria-hidden', 'true');
      rz.innerHTML = SVG_RESIZE;
      rz.addEventListener('pointerdown', function(e){ startResize(e, id, card); });
      card.appendChild(rz);
    }
    if (meta.removable && !card.querySelector('.card-remove-btn')) {
      var rm = document.createElement('button');
      rm.className = 'card-remove-btn';
      rm.type = 'button';
      rm.setAttribute('aria-label', 'Remove ' + (meta.title || id));
      rm.innerHTML = SVG_X;
      rm.addEventListener('click', function(e) {
        e.stopPropagation(); e.preventDefault(); removeWidget(id);
      });
      card.appendChild(rm);
    }
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', (meta.title || id) + ' — use arrow keys to move');
  }
  function stripHandles(card) {
    ['.card-drag-handle', '.card-resize-handle', '.card-remove-btn'].forEach(function(sel) {
      var el = card.querySelector(sel); if (el) el.remove();
    });
    card.removeAttribute('tabindex');
    card.removeAttribute('role');
    card.removeAttribute('aria-label');
    card.classList.remove('is-dragging', 'drop-invalid');
  }

  // ── Pointer-driven MOVE ──
  function startMove(e, id, card) {
    if (!editing || e.button !== 0) return;
    e.preventDefault();
    var geom = computeGeom();
    var cardRect = card.getBoundingClientRect();
    var grabX = e.clientX - cardRect.left;   // pointer offset inside card
    var grabY = e.clientY - cardRect.top;
    var start = Object.assign({}, positions[id]);
    card.classList.add('is-dragging');
    var handle = e.currentTarget;
    try { handle.setPointerCapture(e.pointerId); } catch (err) {}

    function onMove(ev) {
      var leftPx = (ev.clientX - grabX) - geom.originX;
      var topPx = (ev.clientY - grabY) - geom.originY;
      var nx = colAtX(geom, leftPx, start.w);
      var ny = Math.max(0, Math.round(topPx / (editUnit + GAP)));
      nx = Math.max(0, Math.min(nx, COLS - start.w));
      if (nx === positions[id].x && ny === positions[id].y) return;
      var cand = { x: nx, y: ny, w: start.w, h: start.h };
      positions[id] = cand;
      applyPos(id);
      card.classList.toggle('drop-invalid', !fits(cand, id));
    }
    function onUp(ev) {
      try { handle.releasePointerCapture(ev.pointerId); } catch (err) {}
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      card.classList.remove('is-dragging', 'drop-invalid');
      if (!fits(positions[id], id)) { positions[id] = start; applyPos(id); }
    }
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  // ── Pointer-driven RESIZE (SE handle) ──
  function startResize(e, id, card) {
    if (!editing || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    var meta = WIDGETS[id] || {};
    var geom = computeGeom();
    var start = Object.assign({}, positions[id]);
    var cardTop = card.getBoundingClientRect().top - geom.originY;
    card.classList.add('is-dragging');
    var handle = e.currentTarget;
    try { handle.setPointerCapture(e.pointerId); } catch (err) {}

    function onMove(ev) {
      var px = ev.clientX - geom.originX;
      var rightCol = colRightAtX(geom, px, start.x);
      var nw = rightCol - start.x + 1;
      nw = Math.max(meta.minW || 1, Math.min(nw, meta.maxW || COLS, COLS - start.x));
      var hpx = (ev.clientY - geom.originY) - cardTop;
      var nh = Math.max(1, Math.round(hpx / (editUnit + GAP)));
      nh = Math.max(meta.minH || 1, Math.min(nh, meta.maxH || Infinity));
      if (nw === positions[id].w && nh === positions[id].h) return;
      var cand = { x: start.x, y: start.y, w: nw, h: nh };
      positions[id] = cand;
      applyPos(id);
      card.classList.toggle('drop-invalid', !fits(cand, id));
    }
    function onUp(ev) {
      try { handle.releasePointerCapture(ev.pointerId); } catch (err) {}
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      card.classList.remove('is-dragging', 'drop-invalid');
      if (!fits(positions[id], id)) { positions[id] = start; applyPos(id); }
    }
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  // ── Remove a widget (edit only) ──
  function removeWidget(id) {
    if (!editing) return;
    var card = homeGrid.querySelector('.' + id);
    if (card) {
      stripHandles(card);
      card.style.gridColumn = ''; card.style.gridRow = '';
      getHiddenHolder().appendChild(card);
    }
    if (editHidden.indexOf(id) === -1) editHidden.push(id);
    buildPalette();
  }

  // ── Add a hidden widget back (edit only): first free cell scan ──
  function addWidget(id) {
    if (!editing) return;
    var holder = getHiddenHolder();
    var card = holder.querySelector('.' + id);
    if (!card) return;
    var meta = WIDGETS[id] || {};
    var def = DEFAULT_LAYOUT.cards[id] || { w: 1, h: 1 };
    var w = Math.max(meta.minW || 1, def.w), h = Math.max(meta.minH || 1, def.h);
    editHidden = editHidden.filter(function(x) { return x !== id; });
    var placed = null;
    for (var y = 0; y < 64 && !placed; y++) {
      for (var x = 0; x <= COLS - w; x++) {
        var cand = { x: x, y: y, w: w, h: h };
        if (fits(cand, id)) { placed = cand; break; }
      }
    }
    positions[id] = placed || { x: 0, y: 0, w: w, h: h };
    homeGrid.appendChild(card);
    card.style.display = '';
    addHandles(id, card);
    applyPos(id);
    buildPalette();
  }

  // ── "Add widget" palette from currently-hidden widgets ──
  function buildPalette() {
    var pal = document.getElementById('layoutAddPalette');
    var addBtn = document.getElementById('layoutAddBtn');
    if (!pal) return;
    pal.innerHTML = '';
    if (!editHidden.length) {
      var empty = document.createElement('div');
      empty.className = 'layout-add-empty';
      empty.textContent = 'All widgets shown';
      pal.appendChild(empty);
    } else {
      editHidden.forEach(function(id) {
        var chip = document.createElement('button');
        chip.className = 'layout-add-chip';
        chip.type = 'button';
        chip.setAttribute('role', 'menuitem');
        chip.textContent = (WIDGETS[id] && WIDGETS[id].title) || id;
        chip.addEventListener('click', function() { addWidget(id); setPalette(false); });
        pal.appendChild(chip);
      });
    }
    if (addBtn) addBtn.textContent = '+ Add widget' + (editHidden.length ? ' (' + editHidden.length + ')' : '');
  }

  function setPalette(on) {
    var pal = document.getElementById('layoutAddPalette');
    var addBtn = document.getElementById('layoutAddBtn');
    if (!pal || !addBtn) return;
    pal.hidden = !on;
    addBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  // ── Reset: restore default positions + all widgets while still editing ──
  function resetToDefault() {
    if (!editing) return;
    var holder = getHiddenHolder();
    // Restore any hidden cards back into the grid.
    editHidden.slice().forEach(function(id) {
      var card = holder.querySelector('.' + id);
      if (card) { homeGrid.appendChild(card); card.style.display = ''; addHandles(id, card); }
    });
    editHidden = [];
    positions = {};
    CARD_IDS.forEach(function(id) {
      positions[id] = Object.assign({}, DEFAULT_LAYOUT.cards[id]);
      applyPos(id);
    });
    buildPalette();
  }

  // persist=true → save (Done); persist=false → discard (Cancel / forced exit).
  function exitEdit(persist) {
    if (!editing) return;
    var cards = persist ? positions : null;
    var hidden = persist ? editHidden.slice() : null;
    var rows = editRows ? editRows.slice() : null;
    var unit = editUnit;
    setPalette(false);

    // Strip all handles + inline edit props from every card (grid + holder).
    var holder = document.getElementById('layoutHiddenHolder');
    CARD_IDS.forEach(function(id) {
      var card = homeGrid.querySelector('.' + id) || (holder && holder.querySelector('.' + id));
      if (!card) return;
      stripHandles(card);
      card.style.gridColumn = ''; card.style.gridRow = '';
      if (card.parentNode !== homeGrid) homeGrid.appendChild(card);
    });
    homeGrid.classList.remove('home-grid--editing');
    homeGrid.style.gridTemplateColumns = '';
    homeGrid.style.gridTemplateRows = '';
    homeGrid.style.gridAutoRows = '';

    editing = false;
    document.body.classList.remove('is-editing-layout');
    setToolbar(false);

    if (persist) {
      if (layoutEqualsDefault(cards) && !hidden.length) {
        storeDelete(LAYOUT_KEY);
      } else {
        storeSet(LAYOUT_KEY, {
          v: BLOB_V, cols: COLS,
          rowUnit: unit,
          rows: rows,
          cards: cards,
          hidden: hidden
        });
      }
    }
    editHidden = [];
    positions = null;
    renderLayout();
  }

  // ───────── Viewport / wiring ─────────
  function onViewport() {
    if (editing && !DESKTOP_MQ.matches) {
      // Dropped below the desktop breakpoint mid-edit: bail without saving.
      exitEdit(false);
      return;
    }
    if (!editing) renderLayout();
  }

  function init() {
    homeGrid = getHomeGrid();
    // Discard stale pre-v3 blobs so they don't re-render as broken layouts.
    var raw = storeGet(LAYOUT_KEY);
    if (raw && raw.v !== BLOB_V) storeDelete(LAYOUT_KEY);
    renderLayout();

    DESKTOP_MQ.addEventListener('change', onViewport);

    // Cross-tab / cross-device: re-apply when the synced key changes (not while
    // we're mid-edit — the editor owns the DOM then).
    window.addEventListener('storage', function(e) {
      if (e.key === LAYOUT_KEY && !editing) renderLayout();
    });

    var doneBtn = document.getElementById('layoutDoneBtn');
    var cancelBtn = document.getElementById('layoutCancelBtn');
    var resetBtn = document.getElementById('layoutResetBtn');
    if (doneBtn) doneBtn.addEventListener('click', function() { exitEdit(true); });
    if (cancelBtn) cancelBtn.addEventListener('click', function() { exitEdit(false); });
    if (resetBtn) resetBtn.addEventListener('click', function() {
      confirmModal({
        title: 'Reset layout?',
        body: 'This restores the default home layout and removes your customizations.',
        confirmText: 'Reset',
        onConfirm: resetToDefault
      });
    });

    // Keyboard: Esc cancels edit; arrow keys nudge the focused card by one cell.
    document.addEventListener('keydown', function(e) {
      if (!editing) return;
      if (e.key === 'Escape') { exitEdit(false); return; }
      var dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      var d = dirs[e.key];
      if (!d) return;
      var card = document.activeElement;
      if (!card || !card.classList || !card.classList.contains('card')) return;
      var id = CARD_IDS.filter(function(x){ return card.classList.contains(x); })[0];
      if (!id || !positions[id]) return;
      e.preventDefault();
      var p = positions[id];
      var cand = { x: Math.max(0, Math.min(p.x + d[0], COLS - p.w)),
                   y: Math.max(0, p.y + d[1]), w: p.w, h: p.h };
      if (fits(cand, id)) { positions[id] = cand; applyPos(id); }
    });

    var addBtn = document.getElementById('layoutAddBtn');
    if (addBtn) addBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var pal = document.getElementById('layoutAddPalette');
      setPalette(pal ? pal.hidden : true);
    });
    document.addEventListener('click', function(e) {
      if (!editing) return;
      var wrap = document.querySelector('.layout-add-wrap');
      if (wrap && !wrap.contains(e.target)) setPalette(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API (consumed by tweaks "Customize Layout" button)
  window.HomeLayout = {
    edit: enterEdit,
    setEditMode: function(on) { if (on) enterEdit(); else exitEdit(true); },
    reset: resetToDefault,
    reload: renderLayout
  };
})();
