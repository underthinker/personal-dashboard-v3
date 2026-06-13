(function() {
  'use strict';

  // ─── Constants ───
  var SK_STATE = 'pomodoro_session_v1';
  var SK_SETTINGS = 'pomodoro_settings_v1';
  var SK_HINT_SEEN = 'pomodoro_hint_seen_v1';
  var RING_CIRCUMFERENCE = 2 * Math.PI * 52; // ≈ 326.73

  var PHASE = {
    IDLE: 'idle',
    FOCUS: 'focus',
    SHORT_BREAK: 'shortBreak',
    LONG_BREAK: 'longBreak',
  };

  var PHASE_LABELS = {};
  PHASE_LABELS[PHASE.IDLE] = 'FOCUS';
  PHASE_LABELS[PHASE.FOCUS] = 'FOCUS';
  PHASE_LABELS[PHASE.SHORT_BREAK] = 'SHORT BREAK';
  PHASE_LABELS[PHASE.LONG_BREAK] = 'LONG BREAK';

  // ─── State ───
  // phase, timeRemaining, totalTime, isRunning, completedInSequence, endTime
  // endTime: wall-clock ms when the running phase finishes (null when paused/idle).
  var s = {
    phase: PHASE.IDLE,
    timeRemaining: 0,
    totalTime: 0,
    isRunning: false,
    completedInSequence: 0,
    endTime: null,
  };
  var settings = { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakInterval: 4, muted: false };
  var timerId = null;

  // ─── DOM refs (set on init) ───
  var $ = function(id) { return document.getElementById(id); };
  var overlay, modalEl, closeBtn, startBtn, resetBtn, skipBtn, muteBtn;
  var ringEl, timeEl, phaseEl, progressEl, dotsEl, hintEl;
  var settingsToggle, settingsBody, settingsInputs, stepButtons;
  var sidebarBtn;
  var prevFocus = null; // element to restore focus to on close

  // ─── Helpers ───
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    return pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60);
  }

  // Local date YYYY-MM-DD (matches goals.js dateToYMD; NOT UTC toISOString).
  function localYMD() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function loadJSON(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v || fallback;
    } catch (e) { return fallback; }
  }

  function saveState() { localStorage.setItem(SK_STATE, JSON.stringify(s)); }
  function saveSettings() { localStorage.setItem(SK_SETTINGS, JSON.stringify(settings)); }

  // ─── Settings ───
  function loadSettings() {
    var raw = loadJSON(SK_SETTINGS, {});
    settings.focusMin = raw.focusMin || 25;
    settings.shortBreakMin = raw.shortBreakMin || 5;
    settings.longBreakMin = raw.longBreakMin || 15;
    settings.longBreakInterval = raw.longBreakInterval || 4;
    settings.muted = !!raw.muted;
    syncSettingsInputs();
  }

  function saveSetting(key, val) {
    settings[key] = val;
    saveSettings();
  }

  function syncSettingsInputs() {
    if (!settingsInputs) return;
    settingsInputs.forEach(function(inp) {
      var key = inp.dataset.key;
      if (key && settings[key] !== undefined) inp.value = settings[key];
    });
  }

  // ─── Timer logic ───
  function getPhaseDuration(phase) {
    if (phase === PHASE.FOCUS) return settings.focusMin * 60;
    if (phase === PHASE.SHORT_BREAK) return settings.shortBreakMin * 60;
    if (phase === PHASE.LONG_BREAK) return settings.longBreakMin * 60;
    return 0;
  }

  function getNextPhase() {
    if (s.phase === PHASE.IDLE) return PHASE.FOCUS;
    if (s.phase === PHASE.FOCUS) {
      if (s.completedInSequence >= settings.longBreakInterval) return PHASE.LONG_BREAK;
      return PHASE.SHORT_BREAK;
    }
    return PHASE.FOCUS; // break → focus
  }

  // Set up a phase but leave it stopped, waiting for the user to press Start.
  function startPhase(phase) {
    stopTimer();
    s.phase = phase;
    s.isRunning = false;
    s.totalTime = getPhaseDuration(phase);
    s.timeRemaining = s.totalTime;
    s.endTime = null;
    saveState();
    updateUI();
  }

  function startTimer() {
    if (s.phase === PHASE.IDLE) {
      s.phase = PHASE.FOCUS;
      s.totalTime = settings.focusMin * 60;
      s.timeRemaining = s.totalTime;
    }
    beginRunning();
  }

  function resumeTimer() {
    beginRunning();
  }

  // Wall-clock model: anchor an endTime; remaining is always derived from now.
  function beginRunning() {
    dismissHint();
    s.isRunning = true;
    s.endTime = Date.now() + s.timeRemaining * 1000;
    startInterval();
    saveState();
    updateUI();
  }

  function dismissHint() {
    if (!hintEl || hintEl.hidden) return;
    hintEl.hidden = true;
    try { localStorage.setItem(SK_HINT_SEEN, '1'); } catch (e) {}
  }

  function pauseTimer() {
    reconcile();
    s.isRunning = false;
    s.endTime = null;
    stopTimer();
    saveState();
    updateUI();
  }

  function startInterval() {
    stopTimer();
    timerId = setInterval(tick, 250);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  // Recompute timeRemaining from wall clock (survives background/close).
  function reconcile() {
    if (s.isRunning && s.endTime) {
      s.timeRemaining = Math.max(0, Math.round((s.endTime - Date.now()) / 1000));
    }
  }

  function tick() {
    reconcile();
    updateTimerDisplay(s.timeRemaining);
    updateRing(s.totalTime > 0 ? s.timeRemaining / s.totalTime : 1);
    if (s.timeRemaining <= 0) {
      completePhase();
    }
  }

  function completePhase() {
    stopTimer();
    s.isRunning = false;
    s.endTime = null;
    s.timeRemaining = 0;
    playChime();

    if (s.phase === PHASE.FOCUS) {
      var mins = Math.round(s.totalTime / 60);
      if (mins > 0) creditFocusMinutes(mins);
      s.completedInSequence++;
    } else if (s.phase === PHASE.LONG_BREAK) {
      s.completedInSequence = 0; // sequence resets after long break
    }

    // Ring pulse animation
    var wrap = ringEl.closest('.pomo-ring-wrapper');
    if (wrap) {
      wrap.classList.add('pomo-ring-pulse');
      setTimeout(function() { wrap.classList.remove('pomo-ring-pulse'); }, 800);
    }

    saveState();
    updateUI(); // updateControls shows "Next"
  }

  // Used by the "Next" button after a phase has already completed. completePhase
  // already did the sequence bookkeeping, so just set up the next phase.
  function advanceToNext() {
    startPhase(getNextPhase()); // stopped, waiting for Start
  }

  // Used by the Skip button on an active (not-yet-complete) phase. Mirror the
  // sequence bookkeeping completePhase does so skipping still advances the
  // session counter / dots instead of looping on "Session 1".
  function skipPhase() {
    if (s.phase === PHASE.IDLE) return;
    if (s.phase === PHASE.FOCUS) {
      s.completedInSequence++;
    } else if (s.phase === PHASE.LONG_BREAK) {
      s.completedInSequence = 0;
    }
    startPhase(getNextPhase());
  }

  function resetTimer() {
    stopTimer();
    s.phase = PHASE.IDLE;
    s.isRunning = false;
    s.timeRemaining = 0;
    s.totalTime = 0;
    s.completedInSequence = 0;
    s.endTime = null;
    saveState();
    updateUI();
  }

  // ─── Focus minute crediting (local date, matches goals.js) ───
  function creditFocusMinutes(mins) {
    try {
      var key = 'health:' + localYMD();
      var data = JSON.parse(localStorage.getItem(key) || '{}');
      data.focus_min = (data.focus_min || 0) + mins;
      localStorage.setItem(key, JSON.stringify(data));
      window.dispatchEvent(new CustomEvent('focus-updated'));
    } catch (e) {}
  }

  // ─── Sound (Web Audio API) ───
  function playChime() {
    if (settings.muted) return;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      var dur = [0.15, 0.15, 0.3];
      notes.forEach(function(freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + dur[i]);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + dur[i] + 0.05);
      });
    } catch (e) { /* silent fail */ }
  }

  // ─── UI rendering ───
  function updateUI() {
    var shownRemaining = s.timeRemaining;
    if (s.phase === PHASE.IDLE) shownRemaining = settings.focusMin * 60;
    updateTimerDisplay(shownRemaining);
    updateRing(s.totalTime > 0 ? s.timeRemaining / s.totalTime : 1);
    updatePhaseLabel();
    updateControls();
    updateProgressLabel();
    renderDots();
  }

  // Segmented session dots: filled = completed focus sessions in the current
  // sequence; the active focus session pulses.
  function renderDots() {
    if (!dotsEl) return;
    var total = settings.longBreakInterval;
    var done = Math.min(s.completedInSequence, total);
    dotsEl.innerHTML = '';
    for (var i = 0; i < total; i++) {
      var d = document.createElement('span');
      d.className = 'pomo-dot';
      if (i < done) d.classList.add('done');
      else if (i === done && s.phase === PHASE.FOCUS) d.classList.add('current');
      dotsEl.appendChild(d);
    }
  }

  function updateTimerDisplay(seconds) { timeEl.textContent = fmtTime(seconds); }

  function updateRing(progress) {
    var offset = RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));
    ringEl.style.strokeDashoffset = offset;
  }

  function updatePhaseLabel() {
    phaseEl.textContent = PHASE_LABELS[s.phase] || 'FOCUS';
    phaseEl.style.opacity = s.phase === PHASE.IDLE ? '0.5' : '0.8';
  }

  function updateControls() {
    if (s.phase === PHASE.IDLE) {
      startBtn.textContent = 'Start';
      resetBtn.style.display = 'none';
    } else if (s.isRunning) {
      startBtn.textContent = 'Pause';
      resetBtn.style.display = '';
    } else if (s.timeRemaining <= 0) {
      startBtn.textContent = 'Next'; // phase complete
      resetBtn.style.display = '';
    } else if (s.timeRemaining === s.totalTime) {
      startBtn.textContent = 'Start'; // fresh phase, not yet started
      resetBtn.style.display = '';
    } else {
      startBtn.textContent = 'Resume'; // paused mid-phase
      resetBtn.style.display = '';
    }
    startBtn.className = 'pomo-btn pomo-btn-primary';
    // Skip is available whenever a phase is active (not idle, not already complete).
    if (skipBtn) skipBtn.hidden = (s.phase === PHASE.IDLE || s.timeRemaining <= 0);
  }

  function updateProgressLabel() {
    if (s.phase === PHASE.IDLE) { progressEl.textContent = ''; return; }
    if (s.phase === PHASE.FOCUS) {
      // completedInSequence counts finished sessions; current is +1.
      var current = Math.min(s.completedInSequence + 1, settings.longBreakInterval);
      progressEl.textContent = 'Session ' + current + ' of ' + settings.longBreakInterval;
    } else {
      var n = s.completedInSequence;
      progressEl.textContent = 'Break - ' + n + ' focus session' + (n !== 1 ? 's' : '') + ' done';
    }
  }

  // ─── Modal open/close ───
  function openModal() {
    prevFocus = document.activeElement;
    overlay.hidden = false;
    // force reflow so the opacity/transform transition runs
    void overlay.offsetWidth;
    overlay.classList.add('open');
    sidebarBtn.classList.add('active');
    document.body.style.overflow = 'hidden';
    reconcile();
    if (s.isRunning) startInterval();
    updateUI();
    modalEl.focus();
  }

  function closeModal() {
    // Timer keeps running in the background (wall-clock anchored); just stop the
    // visual interval to save work while hidden.
    stopTimer();
    overlay.classList.remove('open');
    sidebarBtn.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(function() { overlay.hidden = true; }, 250);
    if (prevFocus && prevFocus.focus) prevFocus.focus();
    prevFocus = null;
  }

  function toggleSettings() {
    settingsBody.hidden = !settingsBody.hidden;
    settingsToggle.setAttribute('aria-expanded', String(!settingsBody.hidden));
  }

  // Keep Tab focus within the modal while it is open.
  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    var focusables = modalEl.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusables = Array.prototype.filter.call(focusables, function(el) {
      return el.offsetParent !== null; // skip hidden (e.g. collapsed settings)
    });
    if (!focusables.length) return;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // ─── State persistence (survive refresh) ───
  function loadState() {
    var saved = loadJSON(SK_STATE, null);
    if (saved && saved.phase && saved.phase !== PHASE.IDLE) {
      s.phase = saved.phase;
      s.totalTime = saved.totalTime || 0;
      s.completedInSequence = saved.completedInSequence || 0;
      s.isRunning = !!saved.isRunning;
      s.endTime = saved.endTime || null;
      if (s.isRunning && s.endTime) {
        s.timeRemaining = Math.max(0, Math.round((s.endTime - Date.now()) / 1000));
      } else {
        s.timeRemaining = saved.timeRemaining || 0;
        s.isRunning = false;
        s.endTime = null;
      }
      if (s.timeRemaining <= 0 && s.isRunning) {
        completePhase();
      }
    } else {
      resetTimer();
    }
  }

  // ─── Init ───
  function init() {
    overlay = $('pomoOverlay');
    if (!overlay) return;
    modalEl = overlay.querySelector('.pomo-modal');
    closeBtn = $('pomoClose');
    startBtn = $('pomoStartBtn');
    resetBtn = $('pomoResetBtn');
    skipBtn = $('pomoSkipBtn');
    muteBtn = $('pomoMute');
    ringEl = overlay.querySelector('.pomo-ring-progress');
    timeEl = $('pomoTime');
    phaseEl = $('pomoPhase');
    progressEl = $('pomoProgress');
    dotsEl = $('pomoDots');
    hintEl = $('pomoHint');
    if (hintEl && localStorage.getItem(SK_HINT_SEEN)) hintEl.hidden = true;
    settingsToggle = $('pomoSettingsToggle');
    settingsBody = $('pomoSettingsBody');
    settingsInputs = overlay.querySelectorAll('.pomo-settings-input');
    stepButtons = overlay.querySelectorAll('.pomo-step');
    sidebarBtn = $('pomodoroToggle');

    loadSettings();
    loadState();

    sidebarBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openModal();
    });

    var mobTab = document.querySelector('.mob-tab[data-tab="pomodoro"]');
    if (mobTab) {
      mobTab.addEventListener('click', function(e) {
        e.preventDefault();
        openModal();
      });
    }

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', function(e) {
      if (overlay.hidden || !overlay.classList.contains('open')) return;
      var tag = e.target && e.target.tagName;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      } else if (e.key === 'Tab') {
        trapFocus(e);
      } else if ((e.key === ' ' || e.code === 'Space') && tag !== 'INPUT' && tag !== 'BUTTON') {
        // Space toggles start/pause (skip when a button/input is focused to avoid double-firing).
        e.preventDefault();
        startBtn.click();
      } else if ((e.key === 'r' || e.key === 'R') && tag !== 'INPUT' && s.phase !== PHASE.IDLE) {
        e.preventDefault();
        resetTimer();
      }
    });

    settingsToggle.setAttribute('aria-expanded', 'false');

    startBtn.addEventListener('click', function() {
      if (s.phase !== PHASE.IDLE && !s.isRunning && s.timeRemaining <= 0) {
        advanceToNext(); // phase complete → set up next
        return;
      }
      if (s.isRunning) {
        pauseTimer();
      } else if (s.timeRemaining > 0 && s.timeRemaining < s.totalTime) {
        resumeTimer();
      } else {
        startTimer();
      }
    });

    resetBtn.addEventListener('click', resetTimer);
    skipBtn.addEventListener('click', skipPhase);

    // Mute toggle (persisted).
    muteBtn.setAttribute('aria-pressed', String(settings.muted));
    muteBtn.addEventListener('click', function() {
      settings.muted = !settings.muted;
      saveSettings();
      muteBtn.setAttribute('aria-pressed', String(settings.muted));
    });

    // Stepper buttons: clamp to min/max, then reuse the input change handler.
    stepButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var input = this.parentNode.querySelector('.pomo-settings-input');
        if (!input) return;
        var step = parseInt(this.dataset.step, 10) || 0;
        var min = parseInt(input.min, 10);
        var max = parseInt(input.max, 10);
        var val = (parseInt(input.value, 10) || min) + step;
        if (!isNaN(min)) val = Math.max(min, val);
        if (!isNaN(max)) val = Math.min(max, val);
        input.value = val;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    settingsToggle.addEventListener('click', toggleSettings);
    settingsInputs.forEach(function(inp) {
      inp.addEventListener('change', function() {
        var key = this.dataset.key;
        var val = parseInt(this.value, 10);
        if (key && val > 0) {
          saveSetting(key, val);
          if (s.phase === PHASE.IDLE) updateUI();
        }
      });
    });

    // Reconcile when tab returns to foreground.
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden && s.isRunning) {
        reconcile();
        if (!overlay.hidden && overlay.classList.contains('open')) {
          startInterval();
          tick();
        } else if (s.timeRemaining <= 0) {
          completePhase();
        }
      }
    });

    updateUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
