(function(){
  'use strict';

  // ───────── Constants ─────────
  var LAYOUT_KEY = 'home_layout_v1';
  // Fixed unit row height (px). Custom + edit grids use this — NOT the old
  // fold-fit cellHeight that scaled rows to the viewport (that coupling made the
  // unit drift on resize). SaaS-standard: fixed row, content-driven span.
  var ROW_H = 150;
  // ── Widget registry: single source of truth (metadata over the static cards) ──
  // minW/minH are the keystone clip fix — GridStack + custom render refuse sizes
  // the content can't survive, so text never gets crushed mid-word. removable +
  // config are reserved for Phase 2/3 (add/remove + per-widget settings).
  var WIDGETS = {
    'a-session':  { title: 'Focus Session',        minW: 2, minH: 2, maxW: 3, removable: false, config: null },
    'a-goals':    { title: "Today's Plan",          minW: 2, minH: 2,          removable: false, config: null },
    'a-stats':    { title: 'Performance Overview',  minW: 1, minH: 2,          removable: true,  config: null },
    'a-tomorrow': { title: 'Plan Ahead',            minW: 1, minH: 1,          removable: true,  config: null },
    'a-timeline': { title: 'Timeline',              minW: 1, minH: 2,          removable: true,  config: null },
    'a-habits':   { title: 'Habits',                minW: 2, minH: 1,          removable: true,  config: null },
    'a-activity': { title: 'Activity Insight',      minW: 2, minH: 1,          removable: true,  config: null },
    'a-mood':     { title: 'Mood',                  minW: 1, minH: 1,          removable: true,  config: null },
    'a-weather':  { title: 'Weather',               minW: 1, minH: 1,          removable: true,  config: 'weather' },
    'a-calendar': { title: 'Calendar',              minW: 1, minH: 1,          removable: true,  config: 'calendar' }
  };
  var CARD_IDS = Object.keys(WIDGETS);
  var COLS = 5;
  // Inline SVG icons (Lucide: grip-vertical, x) — replaces unicode glyphs so the
  // controls render consistently and theme via currentColor.
  var SVG_GRIP = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';
  var SVG_X = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  // Default reproduces the original named-grid layout (5 cols; fold = y0..y3,
  // ambient = y4). When the saved layout equals this, we DELETE the key and fall
  // back to the pristine named-area CSS (weighted columns), not an equal-col grid.
  var DEFAULT_LAYOUT = {
    v: 1, cols: 5,
    cards: {
      'a-session':  { x: 0, y: 0, w: 2, h: 2 },
      'a-goals':    { x: 2, y: 0, w: 2, h: 2 },
      'a-stats':    { x: 4, y: 0, w: 1, h: 4 },
      'a-tomorrow': { x: 0, y: 2, w: 1, h: 2 },
      'a-timeline': { x: 1, y: 2, w: 1, h: 2 },
      'a-habits':   { x: 2, y: 2, w: 2, h: 2 },
      'a-activity': { x: 0, y: 4, w: 2, h: 1 },
      'a-mood':     { x: 2, y: 4, w: 1, h: 1 },
      'a-weather':  { x: 3, y: 4, w: 1, h: 1 },
      'a-calendar': { x: 4, y: 4, w: 1, h: 1 }
    }
  };
  var DESKTOP_MQ = window.matchMedia('(min-width:1401px)');
  var MARGIN = 8;

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
  // GridStack is now EDIT-ONLY: it exists only while the user is customizing.
  // Normal viewing is pure CSS grid — named areas (default) or explicit
  // grid-column/grid-row placement (a saved custom layout). No always-on
  // pixel-row sizing, so the fold/cutoff math can't drift outside edit mode.
  var grid = null;     // GridStack instance, non-null ONLY during edit
  var homeGrid = null;
  var editHidden = [];  // ids hidden during the current edit session

  function getHomeGrid() { return document.querySelector('.home-grid'); }
  function hasCustomLayout() { return storeGet(LAYOUT_KEY) != null; }

  // Hidden widgets: read from the saved blob (v2). v1 blobs lack `hidden` → [].
  function loadHidden() {
    var saved = storeGet(LAYOUT_KEY);
    var h = saved && Array.isArray(saved.hidden) ? saved.hidden : [];
    return h.filter(function(id) { return CARD_IDS.indexOf(id) !== -1; });
  }

  // Detached holder keeping hidden .card nodes alive across edit/innerHTML wipes
  // (they're static HTML, so we must not drop them — re-adding needs the element).
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

  // Read saved layout, validating each card against CARD_IDS; unknown/missing
  // cards fall back to their default slot so a stale blob never blanks the grid.
  function resolveLayout() {
    var saved = storeGet(LAYOUT_KEY);
    var cards = {};
    var srcCards = (saved && saved.cards && typeof saved.cards === 'object') ? saved.cards : {};
    CARD_IDS.forEach(function(id) {
      var p = srcCards[id];
      var def = DEFAULT_LAYOUT.cards[id];
      if (p && isFinite(p.x) && isFinite(p.y)) {
        // A saved card may lack w/h (older lossy blobs). Fall back to the
        // widget's registry min — never below what its content needs.
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

  // Fixed unit row height. Was a fold-fit calc (viewport/5) that drifted on
  // resize; now a constant so a card's height tracks its span, not the window.
  function computeCellHeight() { return ROW_H; }

  // ───────── Render a saved custom layout into the plain CSS grid ─────────
  function applyCustomCss(cards) {
    if (!homeGrid) return;
    homeGrid.style.setProperty('--home-cell-h', computeCellHeight() + 'px');
    homeGrid.classList.add('home-grid--custom');
    CARD_IDS.forEach(function(id) {
      var card = homeGrid.querySelector('.' + id);
      if (!card) return;
      var p = cards[id];
      // Clamp so a stale/corrupt blob can't overflow the column count and force
      // the grid to silently grow a 6th column. w capped to COLS, x kept in range.
      var w = Math.max(1, Math.min(p.w, COLS));
      var x = Math.max(0, Math.min(p.x, COLS - w));
      card.style.gridColumn = (x + 1) + ' / span ' + w;
      card.style.gridRow = (p.y + 1) + ' / span ' + p.h;
    });
  }
  function clearCustomCss() {
    if (!homeGrid) return;
    homeGrid.classList.remove('home-grid--custom');
    homeGrid.style.removeProperty('--home-cell-h');
    CARD_IDS.forEach(function(id) {
      var card = homeGrid.querySelector('.' + id);
      if (card) { card.style.gridColumn = ''; card.style.gridRow = ''; }
    });
  }

  // Desktop + custom saved → explicit placement; else pristine named areas /
  // responsive stacks (CSS owns it).
  // Toggle display:none per card from the hidden list. Only a saved custom blob
  // ever carries hidden ids, so the default named-area grid never gets holes.
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
    if (DESKTOP_MQ.matches && hasCustomLayout()) applyCustomCss(resolveLayout());
    else clearCustomCss();
    applyHidden(loadHidden());
  }

  // ───────── Edit mode (GridStack lives only here) ─────────
  function setToolbar(on) {
    var tb = document.getElementById('layoutEditToolbar');
    if (tb) tb.classList.toggle('open', !!on);
  }

  function enterEdit() {
    if (grid) return;
    homeGrid = getHomeGrid();
    if (!homeGrid || !DESKTOP_MQ.matches || typeof GridStack === 'undefined') return;

    // Drop any custom-css render so GridStack owns positioning cleanly.
    clearCustomCss();

    var layout = resolveLayout();
    var cellH = computeCellHeight();
    editHidden = loadHidden();
    var holder = getHiddenHolder();

    // Wrap each VISIBLE .card in GridStack's required DOM (move, never clone, so
    // all existing listeners — home.js, goals.js, SortableJS — keep working).
    // Hidden cards are stashed in the holder so their element survives and can be
    // re-added from the palette.
    var items = [];
    CARD_IDS.forEach(function(id) {
      var card = homeGrid.querySelector('.' + id);
      if (!card) return;
      card.style.display = ''; // undo any persisted hide before wrapping
      if (editHidden.indexOf(id) !== -1) { holder.appendChild(card); return; }
      items.push(buildItem(id, layout[id], card));
    });

    homeGrid.innerHTML = '';
    items.forEach(function(i) { homeGrid.appendChild(i); });
    homeGrid.classList.add('home-grid--gridstack');

    grid = GridStack.init({
      column: COLS,
      cellHeight: cellH,
      margin: MARGIN,
      float: false,
      staticGrid: false, // editable immediately — no separate "static" toggle
      handle: '.card-drag-handle',
      resizable: { handles: 'se' }
    }, homeGrid);

    document.body.classList.add('is-editing-layout');
    setToolbar(true);
    buildPalette();
  }

  // Build a grid-stack-item wrapping a live .card. Injects the drag handle and,
  // for removable widgets, a × remove button. Reused by enterEdit + addWidget.
  function buildItem(id, pos, card) {
    var meta = WIDGETS[id] || {};
    // Drag handle is a full-card overlay (whole card is draggable in edit mode),
    // with a small grip badge in the corner as the affordance — so the handle no
    // longer sits ON the card's own header pills.
    if (!card.querySelector('.card-drag-handle')) {
      var handle = document.createElement('div');
      handle.className = 'card-drag-handle';
      handle.setAttribute('aria-hidden', 'true');
      handle.innerHTML = '<span class="card-grip">' + SVG_GRIP + '</span>';
      card.appendChild(handle);
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

    var item = document.createElement('div');
    item.className = 'grid-stack-item';
    // Keyboard a11y: focusable, labeled; arrow keys nudge position (see init).
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'group');
    item.setAttribute('aria-label', (meta.title || id) + ' — use arrow keys to move');
    item.setAttribute('gs-id', id);
    item.setAttribute('gs-x', pos.x);
    item.setAttribute('gs-y', pos.y);
    item.setAttribute('gs-w', pos.w);
    item.setAttribute('gs-h', pos.h);
    if (meta.minW) item.setAttribute('gs-min-w', meta.minW);
    if (meta.minH) item.setAttribute('gs-min-h', meta.minH);
    if (meta.maxW) item.setAttribute('gs-max-w', meta.maxW);
    if (meta.maxH) item.setAttribute('gs-max-h', meta.maxH);
    var content = document.createElement('div');
    content.className = 'grid-stack-item-content';
    content.appendChild(card); // moves card out of its current parent
    item.appendChild(content);
    return item;
  }

  // ── Remove a widget (edit only): stash its card, drop the grid item, mark hidden.
  function removeWidget(id) {
    if (!grid) return;
    var item = homeGrid.querySelector('.grid-stack-item[gs-id="' + id + '"]');
    if (!item) return;
    var card = item.querySelector('.' + id);
    if (card) {
      var h = card.querySelector('.card-drag-handle'); if (h) h.remove();
      var r = card.querySelector('.card-remove-btn'); if (r) r.remove();
      getHiddenHolder().appendChild(card);
    }
    grid.removeWidget(item, true);
    if (editHidden.indexOf(id) === -1) editHidden.push(id);
    buildPalette();
  }

  // ── Add a hidden widget back (edit only): pull its card, wrap, auto-place.
  function addWidget(id) {
    if (!grid) return;
    var holder = getHiddenHolder();
    var card = holder.querySelector('.' + id);
    if (!card) return;
    var def = DEFAULT_LAYOUT.cards[id] || { w: 1, h: 1 };
    var item = buildItem(id, { x: 0, y: 0, w: def.w, h: def.h }, card);
    // GridStack v11: addWidget no longer takes an element — append the DOM then
    // makeWidget() to register it. autoPosition drops it in the first free slot.
    homeGrid.appendChild(item);
    grid.makeWidget(item, { autoPosition: true });
    editHidden = editHidden.filter(function(x) { return x !== id; });
    buildPalette();
  }

  // ── Build the "Add widget" palette from currently-hidden widgets.
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

  // Pull positions out of GridStack before we tear it down.
  // Read engine.nodes directly, NOT grid.save() — save() omits w/h when they
  // equal the node's minW/minH (our registry sets gs-min-w/h), so a saved blob
  // would lose real widths and every w:2 card would collapse to 1 on reload.
  function readGridLayout() {
    var cards = {};
    grid.engine.nodes.forEach(function(n) {
      if (n.id && CARD_IDS.indexOf(n.id) !== -1) {
        cards[n.id] = { x: n.x || 0, y: n.y || 0, w: n.w || 1, h: n.h || 1 };
      }
    });
    return cards;
  }

  // Destroy GridStack and unwrap cards back into the plain .home-grid.
  function unwrap() {
    if (!grid) return;
    grid.destroy(false); // keep DOM
    grid = null;
    CARD_IDS.forEach(function(id) {
      var item = homeGrid.querySelector('.grid-stack-item[gs-id="' + id + '"]');
      if (!item) return;
      var card = item.querySelector('.' + id);
      if (card) {
        var handle = card.querySelector('.card-drag-handle');
        if (handle) handle.remove();
        var rm = card.querySelector('.card-remove-btn');
        if (rm) rm.remove();
        homeGrid.appendChild(card);
      }
      item.remove();
    });
    // Return any stashed hidden cards to homeGrid (renderLayout re-applies their
    // display:none from the saved blob; on Cancel they reappear if not saved).
    var holder = document.getElementById('layoutHiddenHolder');
    if (holder) {
      CARD_IDS.forEach(function(id) {
        var card = holder.querySelector('.' + id);
        if (card) {
          var h = card.querySelector('.card-drag-handle'); if (h) h.remove();
          var r = card.querySelector('.card-remove-btn'); if (r) r.remove();
          homeGrid.appendChild(card);
        }
      });
    }
    homeGrid.classList.remove('home-grid--gridstack');
    // GridStack.destroy() leaves its own classes behind (grid-stack, gs-N,
    // gs-id-N, grid-stack-animate); strip them so .grid-stack CSS can't leak
    // into the plain/custom render before the next reload.
    [].slice.call(homeGrid.classList).forEach(function(c) {
      if (c === 'grid-stack' || c === 'grid-stack-animate' || /^gs-/.test(c)) {
        homeGrid.classList.remove(c);
      }
    });
  }

  // persist=true → save (Done); persist=false → discard (Cancel / forced exit).
  function exitEdit(persist) {
    if (!grid) return;
    var cards = persist ? readGridLayout() : null;
    var hidden = persist ? editHidden.slice() : null;
    setPalette(false);
    unwrap();
    document.body.classList.remove('is-editing-layout');
    setToolbar(false);
    if (persist) {
      // Default positions AND nothing hidden ⇒ delete key so the pristine
      // named-area layout returns. Any hidden widget forces a saved custom blob.
      if (layoutEqualsDefault(cards) && !hidden.length) storeDelete(LAYOUT_KEY);
      else storeSet(LAYOUT_KEY, { v: 2, cols: COLS, cards: cards, hidden: hidden });
    }
    editHidden = [];
    renderLayout();
  }

  // Reset just moves cards back to default slots while still editing; the actual
  // key delete happens on Done (layoutEqualsDefault ⇒ storeDelete).
  function resetToDefault() {
    if (!grid) return;
    var readded = editHidden.slice();
    grid.batchUpdate();
    // Re-add hidden widgets directly at their default slots (explicit position,
    // NOT autoPosition) so makeWidget reads the final coords from gs-* attrs.
    // Calling grid.update() on a just-made widget nulls its gs-id, so re-added
    // widgets are placed once here and skipped in the update loop below.
    readded.forEach(function(id) {
      var card = getHiddenHolder().querySelector('.' + id);
      if (!card) return;
      var item = buildItem(id, DEFAULT_LAYOUT.cards[id], card);
      homeGrid.appendChild(item);
      grid.makeWidget(item);
    });
    editHidden = [];
    CARD_IDS.forEach(function(id) {
      if (readded.indexOf(id) !== -1) return; // already placed at default
      var el = homeGrid.querySelector('.grid-stack-item[gs-id="' + id + '"]');
      if (el) grid.update(el, DEFAULT_LAYOUT.cards[id]);
    });
    grid.commit();
    buildPalette();
  }

  // ───────── Viewport / wiring ─────────
  function onViewport() {
    if (grid && !DESKTOP_MQ.matches) {
      // Dropped below the desktop breakpoint mid-edit: bail without saving.
      exitEdit(false);
      return;
    }
    renderLayout();
  }

  function onResize() {
    if (grid) {
      grid.cellHeight(computeCellHeight());
    } else if (homeGrid && homeGrid.classList.contains('home-grid--custom')) {
      homeGrid.style.setProperty('--home-cell-h', computeCellHeight() + 'px');
    }
  }

  function init() {
    homeGrid = getHomeGrid();
    renderLayout();

    DESKTOP_MQ.addEventListener('change', onViewport);
    window.addEventListener('resize', debounce(onResize, 200));

    // Cross-tab / cross-device: re-apply when the synced key changes (not while
    // we're mid-edit — GridStack owns the DOM then).
    window.addEventListener('storage', function(e) {
      if (e.key === LAYOUT_KEY && !grid) renderLayout();
    });

    var doneBtn = document.getElementById('layoutDoneBtn');
    var cancelBtn = document.getElementById('layoutCancelBtn');
    var resetBtn = document.getElementById('layoutResetBtn');
    if (doneBtn) doneBtn.addEventListener('click', function() { exitEdit(true); });
    if (cancelBtn) cancelBtn.addEventListener('click', function() { exitEdit(false); });
    if (resetBtn) resetBtn.addEventListener('click', function() {
      // Destructive: wipes the custom layout. Confirm first.
      if (window.confirm('Reset the home layout to default? This removes your customizations.')) {
        resetToDefault();
      }
    });

    // Keyboard: Esc cancels edit; arrow keys nudge the focused card by one cell.
    document.addEventListener('keydown', function(e) {
      if (!grid) return;
      if (e.key === 'Escape') { exitEdit(false); return; }
      var dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      var d = dirs[e.key];
      if (!d) return;
      var item = document.activeElement;
      if (!item || !item.classList || !item.classList.contains('grid-stack-item')) return;
      e.preventDefault();
      var node = item.gridstackNode;
      if (!node) return;
      var nx = Math.max(0, Math.min(node.x + d[0], COLS - node.w));
      var ny = Math.max(0, node.y + d[1]);
      grid.update(item, { x: nx, y: ny });
    });

    var addBtn = document.getElementById('layoutAddBtn');
    if (addBtn) addBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var pal = document.getElementById('layoutAddPalette');
      setPalette(pal ? pal.hidden : true);
    });
    // Click-away closes the palette.
    document.addEventListener('click', function(e) {
      if (!grid) return;
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
    // Back-compat: index.html calls setEditMode(true) to open the editor.
    setEditMode: function(on) { if (on) enterEdit(); else exitEdit(true); },
    reset: resetToDefault,
    reload: renderLayout
  };
})();
