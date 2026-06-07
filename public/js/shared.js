(function() {
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function dateToYMD(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function getTodayYmd() { return dateToYMD(new Date()); }
  function getHealthData(ymd) {
    try { return JSON.parse(localStorage.getItem('health:' + ymd) || '{}'); } catch(e) { return {}; }
  }
  window.pad2 = pad2;
  window.escHtml = escHtml;
  window.dateToYMD = dateToYMD;
  window.getTodayYmd = getTodayYmd;
  window.getHealthData = getHealthData;
  window.MOOD_SCORE_MAP = { motivated: 0.95, happy: 0.90, calm: 0.80, numb: 0.35, tired: 0.35, anxious: 0.30, frustrated: 0.25, sad: 0.20 };
})();
