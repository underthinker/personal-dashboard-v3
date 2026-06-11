(function () {
  var dateEl = document.getElementById('topbarDate');
  if (dateEl) {
    var d = new Date();
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    dateEl.textContent = days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  var tabs = document.querySelectorAll('.nav-item');
  var contents = document.querySelectorAll('.tab-content');

  // Retrigger card-content entrance animations once per tab visit.
  // (Data mutations re-render in place without this class, so toggling a
  // goal/habit doesn't replay every visual.)
  var _enterTimers = new WeakMap();
  function playEntrance(el) {
    if (!el) return;
    el.classList.remove('is-entering');
    void el.offsetWidth; // reflow so the animation restarts
    el.classList.add('is-entering');
    clearTimeout(_enterTimers.get(el));
    _enterTimers.set(el, setTimeout(function () {
      el.classList.remove('is-entering');
    }, 1800));
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); t.removeAttribute('aria-current'); });
      tab.classList.add('active');
      tab.setAttribute('aria-current', 'page');
      contents.forEach(function (c) { c.classList.remove('is-visible'); c.setAttribute('aria-hidden', 'true'); });
      var contentId = 'tab-' + tab.getAttribute('data-tab');
      var el = document.getElementById(contentId);
      if (el) { el.classList.add('is-visible'); el.removeAttribute('aria-hidden'); }

      // Clear any lingering entrance class before re-rendering so new DOM
      // elements aren't created while animation CSS is active (fixes glitch
      // when switching tabs quickly before the 1800ms timeout expires).
      if (el) el.classList.remove('is-entering');

      localStorage.setItem('active_tab', tab.getAttribute('data-tab'));

      if (contentId === 'tab-main') {
        var statusEl = document.getElementById('topbarStatus');
        if (statusEl) statusEl.innerHTML = ''; 
        
        window.updateGreeting && window.updateGreeting();
        window.renderStatsPanel && window.renderStatsPanel();
        window.renderCalendar && window.renderCalendar();
        window.renderHomeHealthRings ? window.renderHomeHealthRings() : (window.renderHabitFullRings && window.renderHabitFullRings());
        window.renderHomeInsights && window.renderHomeInsights();
        window.renderHomeMood && window.renderHomeMood();
      }

      if (contentId === 'tab-finances') {
        window.renderFinances && window.renderFinances();
      }
      if (contentId === 'tab-habits') {
        window.renderHabits && window.renderHabits();
      }
      if (contentId === 'tab-health') {
        window.renderHealth && window.renderHealth();
      }

      playEntrance(el);
    });
  });

  // Play entrance on the tab that's already visible at first load.
  var initial = document.querySelector('.tab-content.is-visible');
  if (initial) playEntrance(initial);
})();
