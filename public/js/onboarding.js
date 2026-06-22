// Onboarding checklist - teaches dashboard features after the setup wizard.
// Zero-dependency IIFE in the legacy vanilla layer. All detection is read-only
// localStorage polling; progress persists to `onboarding_checklist_v1` (not a
// tracked sync key, so it stays device-local). Modal shows once, then a
// collapsible sidebar section; confetti on full completion.
(function () {
  'use strict';

  // ─── Constants ───
  var STORAGE_KEY = 'onboarding_checklist_v1';
  var POLL_INTERVAL = 2000; // ms between detection checks
  var TODAY = dateToYMD(new Date()); // cached at init

  var DEFAULT_HABITS = [
    { id: 'hygiene', name: 'Personal Hygiene', active: true },
    { id: 'healthy_meals', name: 'Eat healthy meals', active: true },
    { id: 'go_outside', name: 'Go outside', active: true },
    { id: 'no_alcohol', name: 'No Alcohol', active: true },
    { id: 'no_fap', name: 'No fap', active: true },
    { id: 'productive', name: 'Productive Tasks', active: true },
    { id: 'creativity', name: 'Creativity', active: true },
    { id: 'journal', name: 'Journal', active: true },
    { id: 'study', name: 'Study', active: true }
  ];

  var DEFAULT_LAYOUT_CARDS = {
    'a-session':  { x: 0, y: 0, w: 2, h: 1 },
    'a-goals':    { x: 2, y: 0, w: 2, h: 1 },
    'a-stats':    { x: 4, y: 0, w: 1, h: 2 },
    'a-tomorrow': { x: 0, y: 1, w: 2, h: 1 },
    'a-timeline': { x: 2, y: 1, w: 2, h: 2 },
    'a-activity': { x: 0, y: 2, w: 2, h: 1 },
    'a-calendar': { x: 4, y: 2, w: 1, h: 1 }
  };

  var OFFLINE_OPTOUT_KEY = 'ikigai_offline_optout_v1';
  var AUTH_DONE_KEY = 'ob_auth_done_v1';

  // ─── State ───
  var state = null;
  var pollTimer = null;
  var modalShown = false; // guards against double-render within a session

  // `data-supabase` is set on <html> by the Vite bundle (src/main.ts) only when
  // Supabase creds are present. It is a deferred module, so it runs before
  // DOMContentLoaded but after this classic script parses - read it lazily, not
  // at top-level, or it would always read false.
  function hasSupabase() {
    return document.documentElement.hasAttribute('data-supabase');
  }

  // ─── Helpers ───
  function dateToYMD(d) {
    var mm = d.getMonth() + 1;
    var dd = d.getDate();
    return d.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
  }

  function loadState() {
    try {
      state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      state = null;
    }
    if (!state || state.v !== 1) {
      state = {
        v: 1,
        items: {
          first_goal: false, first_done: false, log_health: false,
          set_habits: false, focus_timer: false, customize_layout: false,
          explore_tabs: false, sign_in: false
        },
        visitedTabs: [], modalDismissed: false, completed: false, completedAt: null
      };
      saveState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function isCompleted() {
    return state.completed;
  }

  // ─── Per-item Detection ───

  function checkFirstGoal() {
    if (state.items.first_goal) return true;
    try {
      var data = JSON.parse(localStorage.getItem('goals:' + TODAY));
      if (Array.isArray(data) && data.length > 0) {
        state.items.first_goal = true;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function checkFirstDone() {
    if (state.items.first_done) return true;
    try {
      var data = JSON.parse(localStorage.getItem('goals:' + TODAY));
      if (Array.isArray(data) && data.some(function (g) { return g && g.done; })) {
        state.items.first_done = true;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function checkHealth() {
    if (state.items.log_health) return true;
    try {
      var data = JSON.parse(localStorage.getItem('health:' + TODAY));
      if (data && typeof data === 'object') {
        var keys = Object.keys(data);
        for (var i = 0; i < keys.length; i++) {
          if (typeof data[keys[i]] === 'number' && data[keys[i]] > 0) {
            state.items.log_health = true;
            return true;
          }
        }
      }
    } catch (e) {}
    return false;
  }

  function checkHabits() {
    if (state.items.set_habits) return true;
    try {
      var defs = JSON.parse(localStorage.getItem('habit_definitions'));
      if (!Array.isArray(defs)) return false;
      if (defs.length !== DEFAULT_HABITS.length) {
        state.items.set_habits = true;
        return true;
      }
      // Same length - flag if any id/name/active differs from defaults. (icon is
      // intentionally ignored: getDefinitions() migrates legacy emoji→icon and
      // we don't want that to false-trigger the checklist.)
      for (var i = 0; i < defs.length; i++) {
        if (defs[i].id !== DEFAULT_HABITS[i].id ||
            defs[i].name !== DEFAULT_HABITS[i].name ||
            defs[i].active !== DEFAULT_HABITS[i].active) {
          state.items.set_habits = true;
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function checkFocusTimer() {
    if (state.items.focus_timer) return true;
    try {
      var fs = JSON.parse(localStorage.getItem('focus_session_v1'));
      if (fs && typeof fs.accumulatedMin === 'number' && fs.accumulatedMin > 0) {
        state.items.focus_timer = true;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function checkLayout() {
    if (state.items.customize_layout) return true;
    try {
      var blob = JSON.parse(localStorage.getItem('home_layout_v1'));
      if (!blob || blob.v !== 3) return false;
      var cards = blob.cards || {};
      var ids = Object.keys(DEFAULT_LAYOUT_CARDS);
      for (var i = 0; i < ids.length; i++) {
        var c = cards[ids[i]];
        var d = DEFAULT_LAYOUT_CARDS[ids[i]];
        if (!c || c.x !== d.x || c.y !== d.y || c.w !== d.w || c.h !== d.h) {
          state.items.customize_layout = true;
          return true;
        }
      }
      if (Array.isArray(blob.hidden) && blob.hidden.length > 0) {
        state.items.customize_layout = true;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function checkTabs() {
    if (state.items.explore_tabs) return true;
    var currentTab = localStorage.getItem('active_tab');
    if (currentTab === 'habits' && state.visitedTabs.indexOf('habits') === -1) {
      state.visitedTabs.push('habits');
    }
    if (currentTab === 'health' && state.visitedTabs.indexOf('health') === -1) {
      state.visitedTabs.push('health');
    }
    if (state.visitedTabs.indexOf('habits') !== -1 && state.visitedTabs.indexOf('health') !== -1) {
      state.items.explore_tabs = true;
      return true;
    }
    return false;
  }

  function checkSignIn() {
    if (state.items.sign_in) return true;
    try {
      for (var key in localStorage) {
        if (key.indexOf('__sync_migrated__') === 0) {
          state.items.sign_in = true;
          return true;
        }
      }
    } catch (e) {}
    if (localStorage.getItem(AUTH_DONE_KEY) === '1') {
      state.items.sign_in = true;
      return true;
    }
    if (localStorage.getItem(OFFLINE_OPTOUT_KEY)) {
      state.items.sign_in = true;
      return true;
    }
    return false;
  }

  // ─── Poll Runner ───

  function detectProgress() {
    if (isCompleted()) return;

    var changed = false;
    if (checkFirstGoal()) changed = true;
    if (checkFirstDone()) changed = true;
    if (checkHealth()) changed = true;
    if (checkHabits()) changed = true;
    if (checkFocusTimer()) changed = true;
    if (checkLayout()) changed = true;
    if (checkTabs()) changed = true;
    if (hasSupabase() && checkSignIn()) changed = true;

    if (changed) {
      saveState();
      renderSidebar();
    }

    if (!isCompleted() && allItemsDone()) {
      completeChecklist();
    }
  }

  // Only the items that count toward this user's checklist. `sign_in` is
  // excluded when Supabase is unconfigured, otherwise local-only users could
  // never reach completion.
  function activeItemIds() {
    var ids = ['first_goal', 'first_done', 'log_health', 'set_habits',
      'focus_timer', 'customize_layout', 'explore_tabs'];
    if (hasSupabase()) ids.push('sign_in');
    return ids;
  }

  function allItemsDone() {
    var ids = activeItemIds();
    for (var i = 0; i < ids.length; i++) {
      if (!state.items[ids[i]]) return false;
    }
    return true;
  }

  function completeChecklist() {
    state.completed = true;
    state.completedAt = new Date().toISOString();
    saveState();
    stopPolling();
    renderSidebar();
    fireConfetti();
  }

  function completedCount() {
    var ids = activeItemIds();
    var count = 0;
    for (var i = 0; i < ids.length; i++) {
      if (state.items[ids[i]]) count++;
    }
    return count;
  }

  function totalItems() {
    return activeItemIds().length;
  }

  function getItemDefs() {
    var labels = {
      first_goal: 'Create your first goal',
      first_done: 'Check something off',
      log_health: 'Log your health',
      set_habits: 'Set up your habits',
      focus_timer: 'Try the focus timer',
      customize_layout: 'Customize your layout',
      explore_tabs: 'Explore all tabs',
      sign_in: 'Sign in to sync'
    };
    return activeItemIds().map(function (id) {
      return { id: id, label: labels[id] };
    });
  }

  function escHtml(s) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
  }

  function checkSvg(size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>';
  }

  function circleSvg(size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"><circle cx="12" cy="12" r="9"/></svg>';
  }

  function chevronSvg() {
    return '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  }

  function checkCircleSvg(size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true"><path d="M21.8 10A10 10 0 1 1 17 3.34"/><path d="m9 11 3 3L22 4"/></svg>';
  }

  // ─── Initial Modal ───

  function maybeShowModal() {
    if (modalShown || isCompleted() || state.modalDismissed) return;
    modalShown = true;
    requestAnimationFrame(renderModal);
  }

  function renderModal() {
    var bg = document.createElement('div');
    bg.className = 'ob-modal-bg';
    bg.id = 'obModalBg';

    var total = totalItems();
    var done = completedCount();

    var itemsHtml = '';
    var itemsList = getItemDefs();
    for (var i = 0; i < itemsList.length; i++) {
      var it = itemsList[i];
      var checked = state.items[it.id] ? 'ob-item--done' : '';
      if (it.id === 'sign_in' && !state.items[it.id] && hasSupabase()) {
        itemsHtml += '<button class="ob-item ob-item--action" data-action="sign-in">' +
          '<span class="ob-item-check">' + circleSvg(16) + '</span>' +
          '<span class="ob-item-label">' + escHtml(it.label) + '</span>' +
          '</button>';
      } else {
        itemsHtml += '<div class="ob-item ' + checked + '">' +
          '<span class="ob-item-check">' +
            (state.items[it.id] ? checkSvg(16) : circleSvg(16)) +
          '</span>' +
          '<span class="ob-item-label">' + escHtml(it.label) + '</span>' +
          '</div>';
      }
    }

    bg.innerHTML =
      '<div class="ob-modal">' +
        '<div class="ob-modal-header">' +
          '<div class="ob-modal-wordmark">Getting Started</div>' +
          '<p class="ob-modal-sub">Complete these steps to learn your way around.</p>' +
        '</div>' +
        '<div class="ob-progress-bar-wrap">' +
          '<div class="ob-progress-bar"><div class="ob-progress-fill" style="width:' + (total ? done / total * 100 : 0) + '%"></div></div>' +
          '<span class="ob-progress-text">' + done + ' / ' + total + '</span>' +
        '</div>' +
        '<div class="ob-item-list">' + itemsHtml + '</div>' +
        '<div class="ob-modal-actions">' +
          '<button class="ob-continue-btn" id="obContinueBtn" type="button">Continue exploring</button>' +
          '<button class="ob-skip-btn" id="obSkipBtn" type="button">Skip for now</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(bg);

    function dismiss() {
      state.modalDismissed = true;
      saveState();
      bg.remove();
      renderSidebar();
      startPolling();
    }

    document.getElementById('obContinueBtn').addEventListener('click', dismiss);
    document.getElementById('obSkipBtn').addEventListener('click', dismiss);

    var signInBtn = bg.querySelector('[data-action="sign-in"]');
    if (signInBtn) {
      signInBtn.addEventListener('click', function (e) {
        e.preventDefault();
        dismiss();
        window.dispatchEvent(new CustomEvent('ikigai:request-sign-in'));
      });
    }
  }

  // ─── Sidebar Section ───

  // Insert into the sidebar in the empty gap below the nav (above the pinned
  // user block, which `margin-top:auto` pushes to the bottom).
  function mountInSidebar(el) {
    var nav = document.querySelector('.sidebar .nav');
    var userBlock = document.querySelector('.sidebar .sidebar-user');
    if (nav && userBlock && nav.parentNode === userBlock.parentNode) {
      nav.parentNode.insertBefore(el, userBlock);
    } else if (nav) {
      nav.parentNode.insertBefore(el, nav.nextSibling);
    } else {
      var sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.appendChild(el);
    }
  }

  function renderSidebar() {
    var existing = document.getElementById('ob-sidebar');
    var wasExpanded = existing &&
      existing.querySelector('.ob-sidebar-body') &&
      existing.querySelector('.ob-sidebar-body').style.display !== 'none';
    if (existing) existing.remove();

    if (isCompleted()) {
      renderCompletedBadge();
      return;
    }

    var total = totalItems();
    var done = completedCount();
    var pct = total > 0 ? Math.round(done / total * 100) : 0;

    var section = document.createElement('div');
    section.className = 'ob-sidebar';
    section.id = 'ob-sidebar';

    section.innerHTML =
      '<div class="ob-sidebar-header" id="obSidebarToggle">' +
        '<span class="ob-sidebar-title">Getting Started</span>' +
        '<span class="ob-sidebar-count">' + done + '/' + total + '</span>' +
        '<span class="ob-sidebar-arrow' + (wasExpanded ? ' open' : '') + '">' + chevronSvg() + '</span>' +
      '</div>' +
      '<div class="ob-sidebar-body" id="obSidebarBody" style="display:' + (wasExpanded ? '' : 'none') + '">' +
        '<div class="ob-progress-bar-wrap ob-sidebar-progress">' +
          '<div class="ob-progress-bar"><div class="ob-progress-fill" style="width:' + pct + '%"></div></div>' +
        '</div>' +
        '<div class="ob-item-list ob-sidebar-items">' + getSidebarItemsHtml() + '</div>' +
      '</div>';

    mountInSidebar(section);

    document.getElementById('obSidebarToggle').addEventListener('click', function () {
      var body = document.getElementById('obSidebarBody');
      var arrow = section.querySelector('.ob-sidebar-arrow');
      if (body.style.display === 'none') {
        body.style.display = '';
        arrow.classList.add('open');
      } else {
        body.style.display = 'none';
        arrow.classList.remove('open');
      }
    });

    var signInSidebar = section.querySelector('[data-action="sign-in-sidebar"]');
    if (signInSidebar) {
      signInSidebar.addEventListener('click', function (e) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('ikigai:request-sign-in'));
      });
    }
  }

  function getSidebarItemsHtml() {
    var items = getItemDefs();
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var cls = state.items[it.id] ? 'ob-item ob-item--done' : 'ob-item';
      if (it.id === 'sign_in' && !state.items[it.id] && hasSupabase()) {
        html += '<button class="' + cls + ' ob-item--action" data-action="sign-in-sidebar">' +
          '<span class="ob-item-check">' + circleSvg(14) + '</span>' +
          '<span class="ob-item-label">' + escHtml(it.label) + '</span>' +
          '</button>';
      } else {
        html += '<div class="' + cls + '">' +
          '<span class="ob-item-check">' +
            (state.items[it.id] ? checkSvg(14) : circleSvg(14)) +
          '</span>' +
          '<span class="ob-item-label">' + escHtml(it.label) + '</span>' +
          '</div>';
      }
    }
    return html;
  }

  function renderCompletedBadge() {
    var badge = document.createElement('div');
    badge.className = 'ob-completed-badge';
    badge.id = 'ob-sidebar';
    badge.innerHTML =
      '<span class="ob-completed-icon">' + checkCircleSvg(16) + '</span>' +
      '<span class="ob-completed-text">All set</span>';
    mountInSidebar(badge);
  }

  // ─── Confetti ───

  function fireConfetti() {
    var canvas = document.createElement('canvas');
    canvas.className = 'ob-confetti-canvas';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var pieces = [];
    var colors = ['#d1809b', '#a78bfa', '#5fd687', '#5ba8f7', '#e0b341', '#2aa198', '#ff6b6b'];

    for (var i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: -2 + Math.random() * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * 360,
        rotSpeed: -5 + Math.random() * 10,
        opacity: 1
      });
    }

    var startTime = Date.now();
    var duration = 3000;

    function animate() {
      var elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        canvas.remove();
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var fade = elapsed > duration - 800 ? (duration - elapsed) / 800 : 1;

      for (var i = 0; i < pieces.length; i++) {
        var p = pieces[i];
        p.x += p.vx;
        p.vy += 0.05;
        p.y += p.vy;
        p.rot += p.rotSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.globalAlpha = fade * p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      requestAnimationFrame(animate);
    }

    animate();
  }

  // ─── Polling ───

  function startPolling() {
    if (pollTimer) return;
    if (isCompleted()) return;
    pollTimer = setInterval(detectProgress, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ─── Tab visit capture ───

  function setupTabListeners() {
    document.querySelectorAll('.nav-item[data-tab]').forEach(function (el) {
      el.addEventListener('click', function () {
        var tab = el.getAttribute('data-tab');
        var touched = false;
        if (tab === 'habits' && state.visitedTabs.indexOf('habits') === -1) {
          state.visitedTabs.push('habits');
          touched = true;
        }
        if (tab === 'health' && state.visitedTabs.indexOf('health') === -1) {
          state.visitedTabs.push('health');
          touched = true;
        }
        if (touched) saveState();
        if (!state.items.explore_tabs &&
            state.visitedTabs.indexOf('habits') !== -1 &&
            state.visitedTabs.indexOf('health') !== -1) {
          state.items.explore_tabs = true;
          saveState();
          renderSidebar();
          if (allItemsDone()) completeChecklist();
        }
      });
    });
  }

  // ─── Init ───

  function init() {
    loadState();

    if (isCompleted()) {
      renderCompletedBadge();
      return;
    }

    // Pick up tabs already visited this session via the persisted active_tab.
    var currentTab = localStorage.getItem('active_tab');
    if (currentTab === 'habits' && state.visitedTabs.indexOf('habits') === -1) {
      state.visitedTabs.push('habits');
    }
    if (currentTab === 'health' && state.visitedTabs.indexOf('health') === -1) {
      state.visitedTabs.push('health');
    }
    if (state.visitedTabs.indexOf('habits') !== -1 && state.visitedTabs.indexOf('health') !== -1) {
      state.items.explore_tabs = true;
    }
    saveState();

    setupTabListeners();

    if (!state.modalDismissed) {
      // First run: show the Getting Started modal after the setup wizard
      // finishes. Auth ("Sign in to sync") is a checklist item.
      window.addEventListener('ikigai:setup-done', function () {
        setTimeout(maybeShowModal, 400);
      }, { once: true });

      // Returning user who finished setup but never dismissed the modal.
      var setupDone = localStorage.getItem('dashboard_setup_v1') ||
        localStorage.getItem('sidebar_user_name_v1');
      if (setupDone) {
        setTimeout(maybeShowModal, 800);
      }
    } else {
      // Modal already dismissed in a past session: show the sidebar + poll.
      renderSidebar();
      startPolling();
    }

    // Quick pass to auto-check anything already satisfied.
    setTimeout(detectProgress, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
