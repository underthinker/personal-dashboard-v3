(function() {
  var NAME_KEY = 'sidebar_user_name_v1';
  var AVATAR_KEY = 'sidebar_user_avatar_v1';
  var DEFAULT_NAME = 'you';
  var ACCENT_AVATAR_DEFAULTS = {
    '#d1809b': 'assets/avatars/kanroji.webp',
    '#a78bfa': 'assets/avatars/Shinobu.jpg',
    '#5fd687': 'assets/avatars/Sanemi.jpg',
    '#5ba8f7': 'assets/avatars/Giyu.webp',
    '#e66a3b': 'assets/avatars/Rengoku.webp',
    '#2aa198': 'assets/avatars/Iguro.jpg',
    '#D6BE94': 'assets/avatars/Uzui.webp',
    '#7bc4b2': 'assets/avatars/Tokito.jpg',
    '#7d8462': 'assets/avatars/Himejima.webp'
  };

  var nameEl = document.querySelector('.su-name');
  var avatarEl = document.querySelector('.su-avatar');

  function resizeName() {
    nameEl.style.fontSize = '';
    var max = parseFloat(getComputedStyle(nameEl).fontSize);
    var min = 14;
    var step = 1;
    while ((nameEl.scrollWidth > nameEl.clientWidth) && (max >= min + step)) {
      max -= step;
      nameEl.style.fontSize = max + 'px';
    }
  }

  /* ─── Name ─────────────────────────────────────── */

  function loadName() {
    nameEl.textContent = localStorage.getItem(NAME_KEY) || DEFAULT_NAME;
    resizeName();
  }

  var cancelled = false;
  nameEl.addEventListener('click', function() {
    if (nameEl.getAttribute('contenteditable') === 'true') return;
    nameEl.setAttribute('contenteditable', 'true');
    nameEl.focus();
    var range = document.createRange();
    range.selectNodeContents(nameEl);
    range.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  nameEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
    else if (e.key === 'Escape') { cancelled = true; nameEl.blur(); }
  });
  nameEl.addEventListener('blur', function() {
    nameEl.removeAttribute('contenteditable');
    var text = nameEl.textContent.trim();
    if (cancelled) { cancelled = false; loadName(); return; }
    if (!text) { loadName(); return; }
    localStorage.setItem(NAME_KEY, text);
    resizeName();
  });

  /* ─── Avatar ───────────────────────────────────── */

  function loadAvatar() {
    var saved = localStorage.getItem(AVATAR_KEY);
    var accent = localStorage.getItem('tweak_accent') || '#d1809b';
    var src = saved || ACCENT_AVATAR_DEFAULTS[accent] || null;
    var existingImg = avatarEl.querySelector('img');
    if (src) {
      avatarEl.classList.add('has-image');
      if (existingImg) {
        existingImg.src = src;
      } else {
        var img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        avatarEl.prepend(img);
      }
    } else {
      avatarEl.classList.remove('has-image');
      if (existingImg) existingImg.remove();
    }
  }

  var overlay = document.createElement('div');
  overlay.className = 'su-avatar-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
    'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  avatarEl.appendChild(overlay);

  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  avatarEl.parentNode.appendChild(fileInput);

  avatarEl.addEventListener('click', function() { fileInput.click(); });

  fileInput.addEventListener('change', function() {
    var file = fileInput.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); fileInput.value = ''; return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      localStorage.setItem(AVATAR_KEY, e.target.result);
      loadAvatar();
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  });

  avatarEl.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    if (localStorage.getItem(AVATAR_KEY)) {
      if (confirm('Remove custom avatar?')) {
        localStorage.removeItem(AVATAR_KEY);
        loadAvatar();
      }
    }
  });

  document.addEventListener('accent-changed', loadAvatar);

  /* ─── Init ─────────────────────────────────────── */

  loadName();
  loadAvatar();
})();
