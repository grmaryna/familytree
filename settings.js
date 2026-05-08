 // --- NAV ---
  function showSection(id, btn) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('sec-' + id).classList.add('active');
    btn.classList.add('active');
  }

  // --- THEME ---
  const themes = {
    forest:  { '--bg':'#f5f0e8','--bg2':'#ede6d6','--green':'#3a6b4a','--green-light':'#5a8f6a','--green-pale':'#d4e8da','--brown':'#7a5c3a','--text':'#2c2218','--muted':'#7a6a55','--border':'#d8cdb8','--white':'#fff' },
    ocean:   { '--bg':'#e8f2f8','--bg2':'#d8eaf4','--green':'#2a6080','--green-light':'#3a80a8','--green-pale':'#c8e0ee','--brown':'#3a6878','--text':'#0f2a38','--muted':'#4a7088','--border':'#b8d4e4','--white':'#fff' },
    autumn:  { '--bg':'#fdf3e8','--bg2':'#f5e6d0','--green':'#a04020','--green-light':'#c05030','--green-pale':'#fde0cc','--brown':'#8a5020','--text':'#2a1408','--muted':'#8a5a3a','--border':'#e0c8a8','--white':'#fff' },
    night:   { '--bg':'#1a1f2e','--bg2':'#141824','--green':'#4a7acf','--green-light':'#6a9aef','--green-pale':'#1e2d4a','--brown':'#7a8aaa','--text':'#e0e8f8','--muted':'#8090b0','--border':'#2a3550','--white':'#1e2438' },
    rose:    { '--bg':'#fdf0f0','--bg2':'#f5e2e2','--green':'#a04060','--green-light':'#c05070','--green-pale':'#fde0e8','--brown':'#8a4050','--text':'#280a14','--muted':'#8a4a58','--border':'#e0c0c8','--white':'#fff' },
    sand:    { '--bg':'#f5f0e0','--bg2':'#ede4cc','--green':'#7a6030','--green-light':'#9a7840','--green-pale':'#e8dfc0','--brown':'#6a5028','--text':'#28200c','--muted':'#7a6840','--border':'#d8c898','--white':'#fff' },
  };

  function selectTheme(el) {
    document.querySelectorAll('.theme-option').forEach(t => t.classList.remove('selected'));
    el.classList.add('selected');
  }

  function applyTheme() {
    const selected = document.querySelector('.theme-option.selected');
    if (!selected) return;
    const name = selected.dataset.theme;
    const vars = themes[name];
    if (!vars) return;
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    localStorage.setItem('rodo-theme', name);
    save(T('toast.themeSaved').replace('{name}', selected.querySelector('.theme-label').textContent.trim()));
  }

  // --- TRANSLATIONS ---
  const i18n = {
    uk: {
      "nav.back": "← На головну", "nav.profile": "Профіль", "nav.appearance": "Вигляд",
      "nav.notifications": "Сповіщення", "nav.privacy": "Приватність", "nav.data": "Дані", "nav.danger": "Небезпечна зона",
      "page.title": "Налаштування", "page.sub": "Управляйте своїм акаунтом та персоналізуйте Родовід",
      "profile.title": "Профіль", "profile.desc": "Ваше ім'я та особиста інформація",
      "profile.firstName": "Ім'я", "profile.lastName": "Прізвище", "profile.email": "Електронна пошта",
      "profile.bio": "Про себе", "profile.dob": "Дата народження", "profile.phone": "Телефон",
      "profile.changePass": "Змінити пароль", "profile.passHint": "Залиште порожнім, якщо не хочете змінювати",
      "profile.currentPass": "Поточний пароль", "profile.newPass": "Новий пароль", "profile.confirmPass": "Підтвердження",
      "appear.title": "Вигляд", "appear.desc": "Тема та мова інтерфейсу",
      "appear.themeLabel": "Тема кольорів", "appear.langLabel": "Мова інтерфейсу",
      "notif.title": "Сповіщення", "notif.desc": "Керуйте тим, що і як вам надходить",
      "notif.email": "Email-сповіщення", "notif.emailDesc": "Отримувати важливі оновлення на пошту",
      "notif.shared": "Нові спільні дерева", "notif.sharedDesc": "Коли хтось запрошує вас до дерева",
      "notif.changes": "Зміни від учасників", "notif.changesDesc": "Коли хтось редагує спільне дерево",
      "notif.bday": "Нагадування про дні народження", "notif.bdayDesc": "Сповіщення за день до дати народження",
      "notif.marketing": "Маркетингові листи", "notif.marketingDesc": "Поради, новини та оновлення продукту",
      "priv.title": "Приватність", "priv.desc": "Контролюйте, хто що бачить",
      "priv.public": "Публічний профіль", "priv.publicDesc": "Інші користувачі можуть знайти вас у пошуку",
      "priv.showDob": "Відображати дату народження", "priv.showDobDesc": "Видимо для учасників спільних дерев",
      "priv.invites": "Дозволити запрошення", "priv.invitesDesc": "Інші можуть запрошувати вас до дерев",
      "priv.2fa": "Двофакторна автентифікація", "priv.2faDesc": "Підвищений захист акаунту",
      "priv.visibility": "Хто може переглядати ваші дерева",
      "data.title": "Дані та експорт", "data.desc": "Управляйте своїми даними та деревами",
      "data.autosave": "Автозбереження", "data.autosaveDesc": "Автоматично зберігати зміни кожні 5 хвилин",
      "data.backup": "Резервні копії", "data.backupDesc": "Щотижнева резервна копія у хмарі",
      "data.exportTitle": "Експорт даних", "data.exportDesc": "Завантажте своє дерево у різних форматах",
      "data.importTitle": "Імпорт", "data.importDesc": "Завантажте існуюче дерево у форматі GEDCOM",
      "danger.title": "Небезпечна зона", "danger.desc": "Незворотні дії — будьте обережні",
      "danger.deleteTrees": "Видалити всі дерева", "danger.deleteTreesDesc": "Усі ваші дерева та зв'язки будуть видалені назавжди",
      "danger.deleteTreesBtn": "Видалити дерева",
      "danger.logoutAll": "Вийти з усіх пристроїв", "danger.logoutAllDesc": "Завершити всі активні сесії, крім поточної",
      "danger.logoutAllBtn": "Вийти скрізь",
      "danger.deleteAccount": "Видалити акаунт", "danger.deleteAccountDesc": "Акаунт та всі дані будуть видалені безповоротно",
      "danger.deleteAccountBtn": "Видалити акаунт",
      "modal.confirm": "Підтвердіть дію", "modal.irreversible": "Ця дія незворотна.",
      "btn.cancel": "Скасувати", "btn.confirm": "Підтвердити", "btn.save": "Зберегти",
      "btn.apply": "Застосувати", "btn.saveChanges": "Зберегти зміни",
      "toast.profileSaved": "Профіль збережено ✓", "toast.saved": "Налаштування збережено ✓",
      "toast.loggedOut": "Всі сесії завершено ✓", "toast.themeSaved": "Тему «{name}» застосовано ✓",
      "toast.langSaved": "Мову змінено на «{name}» ✓",
    },
    en: {
      "nav.back": "← Back to home", "nav.profile": "Profile", "nav.appearance": "Appearance",
      "nav.notifications": "Notifications", "nav.privacy": "Privacy", "nav.data": "Data", "nav.danger": "Danger zone",
      "page.title": "Settings", "page.sub": "Manage your account and personalise Rodovid",
      "profile.title": "Profile", "profile.desc": "Your name and personal information",
      "profile.firstName": "First name", "profile.lastName": "Last name", "profile.email": "Email address",
      "profile.bio": "About me", "profile.dob": "Date of birth", "profile.phone": "Phone",
      "profile.changePass": "Change password", "profile.passHint": "Leave blank if you don't want to change it",
      "profile.currentPass": "Current password", "profile.newPass": "New password", "profile.confirmPass": "Confirm",
      "appear.title": "Appearance", "appear.desc": "Theme and interface language",
      "appear.themeLabel": "Colour theme", "appear.langLabel": "Interface language",
      "notif.title": "Notifications", "notif.desc": "Manage what and how you receive",
      "notif.email": "Email notifications", "notif.emailDesc": "Receive important updates by email",
      "notif.shared": "New shared trees", "notif.sharedDesc": "When someone invites you to a tree",
      "notif.changes": "Member changes", "notif.changesDesc": "When someone edits a shared tree",
      "notif.bday": "Birthday reminders", "notif.bdayDesc": "Notifications one day before a birthday",
      "notif.marketing": "Marketing emails", "notif.marketingDesc": "Tips, news and product updates",
      "priv.title": "Privacy", "priv.desc": "Control who sees what",
      "priv.public": "Public profile", "priv.publicDesc": "Other users can find you in search",
      "priv.showDob": "Show date of birth", "priv.showDobDesc": "Visible to members of shared trees",
      "priv.invites": "Allow invitations", "priv.invitesDesc": "Others can invite you to trees",
      "priv.2fa": "Two-factor authentication", "priv.2faDesc": "Enhanced account security",
      "priv.visibility": "Who can view your trees",
      "data.title": "Data & export", "data.desc": "Manage your data and trees",
      "data.autosave": "Auto-save", "data.autosaveDesc": "Automatically save changes every 5 minutes",
      "data.backup": "Backups", "data.backupDesc": "Weekly cloud backup",
      "data.exportTitle": "Export data", "data.exportDesc": "Download your tree in various formats",
      "data.importTitle": "Import", "data.importDesc": "Upload an existing tree in GEDCOM format",
      "danger.title": "Danger zone", "danger.desc": "Irreversible actions — be careful",
      "danger.deleteTrees": "Delete all trees", "danger.deleteTreesDesc": "All your trees and connections will be deleted permanently",
      "danger.deleteTreesBtn": "Delete trees",
      "danger.logoutAll": "Log out of all devices", "danger.logoutAllDesc": "End all active sessions except the current one",
      "danger.logoutAllBtn": "Log out everywhere",
      "danger.deleteAccount": "Delete account", "danger.deleteAccountDesc": "Account and all data will be deleted permanently",
      "danger.deleteAccountBtn": "Delete account",
      "modal.confirm": "Confirm action", "modal.irreversible": "This action is irreversible.",
      "btn.cancel": "Cancel", "btn.confirm": "Confirm", "btn.save": "Save",
      "btn.apply": "Apply", "btn.saveChanges": "Save changes",
      "toast.profileSaved": "Profile saved ✓", "toast.saved": "Settings saved ✓",
      "toast.loggedOut": "All sessions ended ✓", "toast.themeSaved": "Theme «{name}» applied ✓",
      "toast.langSaved": "Language changed to «{name}» ✓",
    },
    de: {
      "nav.back": "← Zur Startseite", "nav.profile": "Profil", "nav.appearance": "Aussehen",
      "nav.notifications": "Benachrichtigungen", "nav.privacy": "Datenschutz", "nav.data": "Daten", "nav.danger": "Gefahrenzone",
      "page.title": "Einstellungen", "page.sub": "Verwalten Sie Ihr Konto und personalisieren Sie Rodovid",
      "profile.title": "Profil", "profile.desc": "Ihr Name und persönliche Informationen",
      "profile.firstName": "Vorname", "profile.lastName": "Nachname", "profile.email": "E-Mail-Adresse",
      "profile.bio": "Über mich", "profile.dob": "Geburtsdatum", "profile.phone": "Telefon",
      "profile.changePass": "Passwort ändern", "profile.passHint": "Leer lassen, wenn Sie es nicht ändern möchten",
      "profile.currentPass": "Aktuelles Passwort", "profile.newPass": "Neues Passwort", "profile.confirmPass": "Bestätigung",
      "appear.title": "Aussehen", "appear.desc": "Thema und Oberflächensprache",
      "appear.themeLabel": "Farbthema", "appear.langLabel": "Oberflächensprache",
      "notif.title": "Benachrichtigungen", "notif.desc": "Verwalten Sie was und wie Sie empfangen",
      "notif.email": "E-Mail-Benachrichtigungen", "notif.emailDesc": "Wichtige Updates per E-Mail erhalten",
      "notif.shared": "Neue gemeinsame Bäume", "notif.sharedDesc": "Wenn jemand Sie zu einem Baum einlädt",
      "notif.changes": "Änderungen von Mitgliedern", "notif.changesDesc": "Wenn jemand einen gemeinsamen Baum bearbeitet",
      "notif.bday": "Geburtstagserinnerungen", "notif.bdayDesc": "Benachrichtigungen einen Tag vor dem Geburtstag",
      "notif.marketing": "Marketing-E-Mails", "notif.marketingDesc": "Tipps, Neuigkeiten und Produktupdates",
      "priv.title": "Datenschutz", "priv.desc": "Kontrollieren Sie, wer was sieht",
      "priv.public": "Öffentliches Profil", "priv.publicDesc": "Andere Benutzer können Sie in der Suche finden",
      "priv.showDob": "Geburtsdatum anzeigen", "priv.showDobDesc": "Sichtbar für Mitglieder gemeinsamer Bäume",
      "priv.invites": "Einladungen erlauben", "priv.invitesDesc": "Andere können Sie zu Bäumen einladen",
      "priv.2fa": "Zwei-Faktor-Authentifizierung", "priv.2faDesc": "Erhöhter Kontoschutz",
      "priv.visibility": "Wer kann Ihre Bäume sehen",
      "data.title": "Daten & Export", "data.desc": "Verwalten Sie Ihre Daten und Bäume",
      "data.autosave": "Automatisches Speichern", "data.autosaveDesc": "Änderungen alle 5 Minuten automatisch speichern",
      "data.backup": "Sicherungskopien", "data.backupDesc": "Wöchentliche Cloud-Sicherung",
      "data.exportTitle": "Daten exportieren", "data.exportDesc": "Laden Sie Ihren Baum in verschiedenen Formaten herunter",
      "data.importTitle": "Import", "data.importDesc": "Laden Sie einen bestehenden Baum im GEDCOM-Format hoch",
      "danger.title": "Gefahrenzone", "danger.desc": "Unwiderrufliche Aktionen — Vorsicht",
      "danger.deleteTrees": "Alle Bäume löschen", "danger.deleteTreesDesc": "Alle Ihre Bäume und Verbindungen werden dauerhaft gelöscht",
      "danger.deleteTreesBtn": "Bäume löschen",
      "danger.logoutAll": "Von allen Geräten abmelden", "danger.logoutAllDesc": "Alle aktiven Sitzungen außer der aktuellen beenden",
      "danger.logoutAllBtn": "Überall abmelden",
      "danger.deleteAccount": "Konto löschen", "danger.deleteAccountDesc": "Konto und alle Daten werden unwiderruflich gelöscht",
      "danger.deleteAccountBtn": "Konto löschen",
      "modal.confirm": "Aktion bestätigen", "modal.irreversible": "Diese Aktion ist unwiderruflich.",
      "btn.cancel": "Abbrechen", "btn.confirm": "Bestätigen", "btn.save": "Speichern",
      "btn.apply": "Anwenden", "btn.saveChanges": "Änderungen speichern",
      "toast.profileSaved": "Profil gespeichert ✓", "toast.saved": "Einstellungen gespeichert ✓",
      "toast.loggedOut": "Alle Sitzungen beendet ✓", "toast.themeSaved": "Thema «{name}» angewendet ✓",
      "toast.langSaved": "Sprache auf «{name}» geändert ✓",
    },
    pl: {
      "nav.back": "← Na stronę główną", "nav.profile": "Profil", "nav.appearance": "Wygląd",
      "nav.notifications": "Powiadomienia", "nav.privacy": "Prywatność", "nav.data": "Dane", "nav.danger": "Strefa niebezpieczna",
      "page.title": "Ustawienia", "page.sub": "Zarządzaj kontem i personalizuj Rodovid",
      "profile.title": "Profil", "profile.desc": "Twoje imię i dane osobowe",
      "profile.firstName": "Imię", "profile.lastName": "Nazwisko", "profile.email": "Adres e-mail",
      "profile.bio": "O mnie", "profile.dob": "Data urodzenia", "profile.phone": "Telefon",
      "profile.changePass": "Zmień hasło", "profile.passHint": "Zostaw puste, jeśli nie chcesz zmieniać",
      "profile.currentPass": "Aktualne hasło", "profile.newPass": "Nowe hasło", "profile.confirmPass": "Potwierdzenie",
      "appear.title": "Wygląd", "appear.desc": "Motyw i język interfejsu",
      "appear.themeLabel": "Motyw kolorów", "appear.langLabel": "Język interfejsu",
      "notif.title": "Powiadomienia", "notif.desc": "Zarządzaj tym co i jak otrzymujesz",
      "notif.email": "Powiadomienia e-mail", "notif.emailDesc": "Otrzymuj ważne aktualizacje na e-mail",
      "notif.shared": "Nowe wspólne drzewa", "notif.sharedDesc": "Gdy ktoś zaprasza Cię do drzewa",
      "notif.changes": "Zmiany od członków", "notif.changesDesc": "Gdy ktoś edytuje wspólne drzewo",
      "notif.bday": "Przypomnienia o urodzinach", "notif.bdayDesc": "Powiadomienia dzień przed datą urodzin",
      "notif.marketing": "E-maile marketingowe", "notif.marketingDesc": "Porady, nowości i aktualizacje produktu",
      "priv.title": "Prywatność", "priv.desc": "Kontroluj kto co widzi",
      "priv.public": "Publiczny profil", "priv.publicDesc": "Inni użytkownicy mogą Cię znaleźć w wyszukiwarce",
      "priv.showDob": "Pokaż datę urodzenia", "priv.showDobDesc": "Widoczne dla członków wspólnych drzew",
      "priv.invites": "Zezwól na zaproszenia", "priv.invitesDesc": "Inni mogą zapraszać Cię do drzew",
      "priv.2fa": "Uwierzytelnianie dwuskładnikowe", "priv.2faDesc": "Zwiększona ochrona konta",
      "priv.visibility": "Kto może przeglądać Twoje drzewa",
      "data.title": "Dane i eksport", "data.desc": "Zarządzaj swoimi danymi i drzewami",
      "data.autosave": "Automatyczne zapisywanie", "data.autosaveDesc": "Automatycznie zapisuj zmiany co 5 minut",
      "data.backup": "Kopie zapasowe", "data.backupDesc": "Tygodniowa kopia zapasowa w chmurze",
      "data.exportTitle": "Eksport danych", "data.exportDesc": "Pobierz swoje drzewo w różnych formatach",
      "data.importTitle": "Import", "data.importDesc": "Wgraj istniejące drzewo w formacie GEDCOM",
      "danger.title": "Strefa niebezpieczna", "danger.desc": "Nieodwracalne działania — bądź ostrożny",
      "danger.deleteTrees": "Usuń wszystkie drzewa", "danger.deleteTreesDesc": "Wszystkie Twoje drzewa i połączenia zostaną trwale usunięte",
      "danger.deleteTreesBtn": "Usuń drzewa",
      "danger.logoutAll": "Wyloguj ze wszystkich urządzeń", "danger.logoutAllDesc": "Zakończ wszystkie aktywne sesje oprócz bieżącej",
      "danger.logoutAllBtn": "Wyloguj wszędzie",
      "danger.deleteAccount": "Usuń konto", "danger.deleteAccountDesc": "Konto i wszystkie dane zostaną trwale usunięte",
      "danger.deleteAccountBtn": "Usuń konto",
      "modal.confirm": "Potwierdź działanie", "modal.irreversible": "To działanie jest nieodwracalne.",
      "btn.cancel": "Anuluj", "btn.confirm": "Potwierdź", "btn.save": "Zapisz",
      "btn.apply": "Zastosuj", "btn.saveChanges": "Zapisz zmiany",
      "toast.profileSaved": "Profil zapisany ✓", "toast.saved": "Ustawienia zapisane ✓",
      "toast.loggedOut": "Wszystkie sesje zakończone ✓", "toast.themeSaved": "Motyw «{name}» zastosowany ✓",
      "toast.langSaved": "Język zmieniony na «{name}» ✓",
    },
  };

  let currentLang = localStorage.getItem('rodo-lang') || 'uk';

  // Translation helper
  function T(key) { return (i18n[currentLang] || i18n.uk)[key] || key; }

  // Apply all data-i18n elements
  function applyTranslations(lang) {
    const t = i18n[lang] || i18n.uk;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key] !== undefined) el.textContent = t[key];
    });
    document.documentElement.lang = lang;
  }

  function selectLang(el) {
    document.querySelectorAll('.lang-option').forEach(l => l.classList.remove('selected'));
    el.classList.add('selected');
  }

  function applyLang() {
    const selected = document.querySelector('.lang-option.selected');
    if (!selected) return;
    const flags = { '🇺🇦': 'uk', '🇬🇧': 'en', '🇩🇪': 'de', '🇵🇱': 'pl' };
    const flagEl = selected.querySelector('.lang-flag');
    const code = flags[flagEl ? flagEl.textContent.trim() : '🇺🇦'] || 'uk';
    currentLang = code;
    applyTranslations(code);
    localStorage.setItem('rodo-lang', code);
    const langNames = { uk: 'Українська', en: 'English', de: 'Deutsch', pl: 'Polski' };
    save(T('toast.langSaved').replace('{name}', langNames[code]));
  }
  // --- INIT: restore saved preferences ---
  (function init() {
    // Theme
    const savedTheme = localStorage.getItem('rodo-theme');
    if (savedTheme && themes[savedTheme]) {
      document.querySelectorAll('.theme-option').forEach(t => {
        t.classList.toggle('selected', t.dataset.theme === savedTheme);
      });
      Object.entries(themes[savedTheme]).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    }
    // Lang
    const savedLang = localStorage.getItem('rodo-lang') || 'uk';
    currentLang = savedLang;
    const flagMap = { uk: '🇺🇦', en: '🇬🇧', de: '🇩🇪', pl: '🇵🇱' };
    document.querySelectorAll('.lang-option').forEach(l => {
      const flag = l.querySelector('.lang-flag');
      if (flag) l.classList.toggle('selected', flag.textContent.trim() === flagMap[savedLang]);
    });
    applyTranslations(savedLang);
  })();