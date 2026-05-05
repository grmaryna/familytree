function switchTab(tab) {
    document.getElementById('signinForm').style.display = tab === 'signin' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('successMsg').classList.remove('show');
    document.getElementById('tabSignin').classList.toggle('active', tab === 'signin');
    document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
    clearErrors();
  }

  function togglePass(id, btn) {
    const inp = document.getElementById(id);
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁'; }
  }

  function showErr(id, show) {
    const el = document.getElementById(id);
    el.classList.toggle('show', show);
    const inp = el.previousElementSibling?.querySelector('input') || el.previousElementSibling;
    if (inp && inp.tagName === 'INPUT') inp.classList.toggle('error', show);
  }
  function clearErrors() {
    document.querySelectorAll('.field-error').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('input').forEach(i => i.classList.remove('error'));
  }
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function checkStrength(val) {
    const bar = document.getElementById('strengthBar');
    const fill = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    if (!val) { bar.classList.remove('show'); label.classList.remove('show'); return; }
    bar.classList.add('show'); label.classList.add('show');
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const levels = [
      { w: '20%', bg: '#e05555', text: 'Дуже слабкий' },
      { w: '40%', bg: '#e08040', text: 'Слабкий' },
      { w: '60%', bg: '#d4aa20', text: 'Середній' },
      { w: '80%', bg: '#5a9f6a', text: 'Надійний' },
      { w: '100%', bg: '#2e7a40', text: 'Дуже надійний' },
    ];
    const lvl = levels[Math.min(score - 1, 4)] || levels[0];
    fill.style.width = lvl.w;
    fill.style.background = lvl.bg;
    label.textContent = lvl.text;
    label.style.color = lvl.bg;
  }

  function submitSignin() {
    clearErrors();
    const email = document.getElementById('siEmail').value.trim();
    const pass = document.getElementById('siPass').value;
    let ok = true;
    if (!isEmail(email)) { showErr('siEmailErr', true); ok = false; }
    if (!pass) { showErr('siPassErr', true); ok = false; }
    if (!ok) return;
    // Simulate login
    showSuccess('З поверненням!', 'Ви успішно увійшли. Перейдіть до свого дерева.');
  }

  function submitRegister() {
    clearErrors();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value;
    const pass2 = document.getElementById('regPass2').value;
    let ok = true;
    if (!name) { showErr('regNameErr', true); ok = false; }
    if (!isEmail(email)) { showErr('regEmailErr', true); ok = false; }
    if (pass.length < 6) { showErr('regPassErr', true); ok = false; }
    if (pass !== pass2) { showErr('regPass2Err', true); ok = false; }
    if (!ok) return;
    showSuccess('Вітаємо, ' + name.split(' ')[0] + '! 🌱', 'Ваш акаунт створено. Почніть будувати перше сімейне дерево.');
  }

  function showSuccess(title, text) {
    document.getElementById('signinForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('successTitle').textContent = title;
    document.getElementById('successText').textContent = text;
    document.getElementById('successMsg').classList.add('show');
  }

  function socialLogin(provider) {
    showSuccess('Ласкаво просимо!', 'Ви увійшли через ' + provider + '. Перейдіть до свого дерева.');
  }

  function openForgot() { document.getElementById('forgotModal').classList.add('open'); }
  function closeForgot() { document.getElementById('forgotModal').classList.remove('open'); }
  document.getElementById('forgotModal').addEventListener('click', function(e) {
    if (e.target === this) closeForgot();
  });
  function submitForgot() {
    const email = document.getElementById('forgotEmail').value.trim();
    if (!isEmail(email)) { document.getElementById('forgotEmail').classList.add('error'); return; }
    closeForgot();
    // Show toast
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:var(--green);color:#fff;padding:12px 24px;border-radius:50px;font-size:.9rem;box-shadow:0 4px 20px rgba(0,0,0,.2);z-index:999;animation:cardIn .3s ease';
    toast.textContent = '✉️ Лист надіслано на ' + email;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const active = document.getElementById('tabSignin').classList.contains('active');
      if (active) submitSignin(); else submitRegister();
    }
  });