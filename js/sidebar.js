(function() {
  var NAME_KEY = 'sidebar_user_name_v1';
  var AVATAR_KEY = 'sidebar_user_avatar_v1';
  var DEFAULT_NAME = 'you';
  var ACCENT_AVATAR_DEFAULTS = {
    '#d1809b': '9 Hashiras/kanroji.webp',
    '#a78bfa': '9 Hashiras/Shinobu.jpg',
    '#5fd687': '9 Hashiras/Sanemi.jpg',
    '#5ba8f7': '9 Hashiras/Giyu.webp',
    '#e66a3b': '9 Hashiras/Rengoku.webp',
    '#2aa198': '9 Hashiras/Iguro.jpg',
    '#cfa846': '9 Hashiras/Uzui.webp',
    '#7bc4b2': '9 Hashiras/Tokito.jpg',
    '#7d8462': '9 Hashiras/Himejima.webp'
  };

  var nameEl = document.querySelector('.su-name');
  var avatarEl = document.querySelector('.su-avatar');

  /* ─── Name ─────────────────────────────────────── */

  function loadName() {
    nameEl.textContent = localStorage.getItem(NAME_KEY) || DEFAULT_NAME;
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
  overlay.textContent = '✎';
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
