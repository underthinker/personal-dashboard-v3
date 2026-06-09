(function(){
  'use strict';

  // ───────── Constants ─────────
  var LAYOUT_KEY = 'home_layout_v1';
  var CARD_IDS = [
    'a-session', 'a-goals', 'a-stats', 'a-tomorrow', 'a-timeline',
    'a-habits', 'a-activity', 'a-mood', 'a-weather', 'a-calendar'
  ];
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

  function getHomeGrid() { return document.querySelector('.home-grid'); }
  function hasCustomLayout() { return storeGet(LAYOUT_KEY) != null; }

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
        // GridStack's save() omits props equal to its defaults (w/h === 1), so a
        // saved card may lack w/h — fall back to 1, not the whole default slot.
        cards[id] = {
          x: +p.x, y: +p.y,
          w: isFinite(p.w) ? +p.w : 1,
          h: isFinite(p.h) ? +p.h : 1
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

  function computeCellHeight() {
    // Default layout is 5 row-units tall (fold = y0..y3 = 4u, ambient = y4 = 1u).
    // Measure the SCROLL VIEWPORT (grid's parent, #tab-main) so the unit is sized
    // to the visible fold, independent of how tall the grid's own content is.
    var parent = homeGrid && homeGrid.parentElement;
    var avail = parent ? parent.clientHeight : 0;
    if (!avail) avail = (window.innerHeight || 800) - 120;
    return Math.max(60, Math.floor((avail - MARGIN * 6) / 5));
  }

  // ───────── Render a saved custom layout into the plain CSS grid ─────────
  function applyCustomCss(cards) {
    if (!homeGrid) return;
    homeGrid.style.setProperty('--home-cell-h', computeCellHeight() + 'px');
    homeGrid.classList.add('home-grid--custom');
    CARD_IDS.forEach(function(id) {
      var card = homeGrid.querySelector('.' + id);
      if (!card) return;
      var p = cards[id];
      card.style.gridColumn = (p.x + 1) + ' / span ' + p.w;
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
  function renderLayout() {
    homeGrid = getHomeGrid();
    if (!homeGrid) return;
    if (DESKTOP_MQ.matches && hasCustomLayout()) applyCustomCss(resolveLayout());
    else clearCustomCss();
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

    // Wrap each live .card in GridStack's required DOM (move, never clone, so all
    // existing listeners — home.js, goals.js, SortableJS — keep working).
    var items = [];
    CARD_IDS.forEach(function(id) {
      var card = homeGrid.querySelector('.' + id);
      if (!card) return;
      var pos = layout[id];

      if (!card.querySelector('.card-drag-handle')) {
        var handle = document.createElement('div');
        handle.className = 'card-drag-handle';
        handle.setAttribute('aria-hidden', 'true');
        handle.textContent = '⠿';
        card.appendChild(handle);
      }

      var item = document.createElement('div');
      item.className = 'grid-stack-item';
      item.setAttribute('gs-id', id);
      item.setAttribute('gs-x', pos.x);
      item.setAttribute('gs-y', pos.y);
      item.setAttribute('gs-w', pos.w);
      item.setAttribute('gs-h', pos.h);
      var content = document.createElement('div');
      content.className = 'grid-stack-item-content';
      content.appendChild(card); // moves card out of homeGrid
      item.appendChild(content);
      items.push(item);
    });

    homeGrid.innerHTML = '';
    items.forEach(function(i) { homeGrid.appendChild(i); });
    homeGrid.classList.add('home-grid--gridstack');

    grid = GridStack.init({
      column: 5,
      cellHeight: cellH,
      margin: MARGIN,
      float: false,
      staticGrid: false, // editable immediately — no separate "static" toggle
      handle: '.card-drag-handle',
      resizable: { handles: 'se' }
    }, homeGrid);

    document.body.classList.add('is-editing-layout');
    setToolbar(true);
  }

  // Pull positions out of GridStack before we tear it down.
  function readGridLayout() {
    var nodes = grid.save(false); // [{x,y,w,h,id,...}]
    var cards = {};
    nodes.forEach(function(n) {
      if (n.id && CARD_IDS.indexOf(n.id) !== -1) {
        // save(false) drops props equal to GridStack defaults; coerce w/h.
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
        homeGrid.appendChild(card);
      }
      item.remove();
    });
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
    unwrap();
    document.body.classList.remove('is-editing-layout');
    setToolbar(false);
    if (persist) {
      // Equals default ⇒ delete key so the pristine named-area layout returns.
      if (layoutEqualsDefault(cards)) storeDelete(LAYOUT_KEY);
      else storeSet(LAYOUT_KEY, { v: 1, cols: 5, cards: cards });
    }
    renderLayout();
  }

  // Reset just moves cards back to default slots while still editing; the actual
  // key delete happens on Done (layoutEqualsDefault ⇒ storeDelete).
  function resetToDefault() {
    if (!grid) return;
    grid.batchUpdate();
    CARD_IDS.forEach(function(id) {
      var el = homeGrid.querySelector('.grid-stack-item[gs-id="' + id + '"]');
      if (el) grid.update(el, DEFAULT_LAYOUT.cards[id]);
    });
    grid.commit();
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
    if (resetBtn) resetBtn.addEventListener('click', resetToDefault);
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
