
  function showSection(id, btn) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('sec-' + id).classList.add('active');
    btn.classList.add('active');
  }

  function selectTheme(el) {
    document.querySelectorAll('.theme-option').forEach(t => t.classList.remove('selected'));
    el.classList.add('selected');
  }

  function selectLang(el) {
    document.querySelectorAll('.lang-option').forEach(l => l.classList.remove('selected'));
    el.classList.add('selected');
  }

  function previewAvatar(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.getElementById('avatarImg');
      img.src = e.target.result;
      img.style.display = 'block';
      document.getElementById('avatarInitials').style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  function updateInitials() {
    const f = document.getElementById('firstName').value || '';
    const l = document.getElementById('lastName').value || '';
    const ini = ((f[0] || '') + (l[0] || '')).toUpperCase();
    document.getElementById('avatarInitials').textContent = ini || '?';
  }
  document.getElementById('firstName').addEventListener('input', updateInitials);
  document.getElementById('lastName').addEventListener('input', updateInitials);

  function resetProfile() {
    document.getElementById('firstName').value = 'Іван';
    document.getElementById('lastName').value = 'Петренко';
    document.getElementById('email').value = 'ivan.petrenko@example.com';
    document.getElementById('bio').value = 'Досліджую коріння своєї родини з Полтавщини.';
    updateInitials();
  }

  function importFile(input) {
    if (input.files[0]) save('Файл ' + input.files[0].name + ' імпортовано ✓');
  }

  let toastTimer;
  function save(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  let dangerTarget = '';
  function openDanger(target) {
    dangerTarget = target;
    document.getElementById('dangerInput').value = '';
    if (target === 'account') {
      document.getElementById('dangerTitle').textContent = '🗑️ Видалити акаунт';
      document.getElementById('dangerText').textContent = 'Всі ваші дерева, зв\'язки та дані будуть видалені назавжди.';
    } else {
      document.getElementById('dangerTitle').textContent = '🌲 Видалити всі дерева';
      document.getElementById('dangerText').textContent = 'Усі побудовані дерева будуть видалені без можливості відновлення.';
    }
    document.getElementById('dangerModal').classList.add('open');
    setTimeout(() => document.getElementById('dangerInput').focus(), 100);
  }
  function closeDanger() { document.getElementById('dangerModal').classList.remove('open'); }
  function confirmDanger() {
    const val = document.getElementById('dangerInput').value.trim();
    if (val !== 'ВИДАЛИТИ') {
      document.getElementById('dangerInput').style.borderColor = 'var(--red)';
      document.getElementById('dangerInput').style.boxShadow = '0 0 0 3px var(--red-pale)';
      return;
    }
    closeDanger();
    const msg = dangerTarget === 'account' ? 'Акаунт видалено. Перенаправлення...' : 'Всі дерева видалено ✓';
    save(msg);
    if (dangerTarget === 'account') setTimeout(() => window.location.href = 'index.html', 2500);
  }
  document.getElementById('dangerModal').addEventListener('click', function(e) {
    if (e.target === this) closeDanger();
  });
  document.getElementById('dangerInput').addEventListener('input', function() {
    this.style.borderColor = '';
    this.style.boxShadow = '';
  });