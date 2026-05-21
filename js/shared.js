(function() {
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  window.pad2 = pad2;
  window.escHtml = escHtml;
})();
