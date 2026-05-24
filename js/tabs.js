(function () {
  var dateEl = document.getElementById('topbarDate');
  if (dateEl) {
    var d = new Date();
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    dateEl.textContent = days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  var originalGreeting = document.querySelector('.greeting h1')?.innerHTML;
  var tabs = document.querySelectorAll('.nav-item');
  var contents = document.querySelectorAll('.tab-content');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      contents.forEach(function (c) { c.classList.remove('is-visible'); });
      var contentId = 'tab-' + tab.getAttribute('data-tab');
      var el = document.getElementById(contentId);
      if (el) el.classList.add('is-visible');

      if (contentId === 'tab-main') {
        var greetTitle = document.querySelector('.greeting h1');
        if (greetTitle && originalGreeting) greetTitle.innerHTML = originalGreeting;
        window.updateGreeting && window.updateGreeting();
        window.renderStatsPanel && window.renderStatsPanel();
        window.renderCalendar && window.renderCalendar();
        window.renderHomeHealthRings ? window.renderHomeHealthRings() : (window.renderHabitFullRings && window.renderHabitFullRings());
        window.renderHomeInsights && window.renderHomeInsights();
      }
      var tabNames = { main:'Home', finances:'Finances', habits:'Habits', health:'Health', gym:'Gym' };
      var name = tabNames[tab.getAttribute('data-tab')] || tab.textContent.trim();
      var greetTitle = document.querySelector('.greeting h1');
      if (greetTitle && contentId !== 'tab-main') {
        greetTitle.innerHTML = '<strong>' + name + '</strong>';
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
    });
  });
})();
