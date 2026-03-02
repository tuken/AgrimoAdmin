(function () {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    const accountWrapper = document.querySelector('.account-wrapper');
    const accountButton = document.querySelector('.account-pill');
    const accountMenu = document.querySelector('.account-menu');

    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        nav.classList.toggle('nav-open');
        toggle.classList.toggle('is-open');
      });
    }

    if (accountWrapper && accountButton && accountMenu) {
      accountButton.addEventListener('click', function (e) {
        e.stopPropagation();
        const expanded = accountButton.getAttribute('aria-expanded') === 'true';
        accountButton.setAttribute('aria-expanded', String(!expanded));
        accountMenu.classList.toggle('open');
      });

      document.addEventListener('click', function (e) {
        if (!accountWrapper.contains(e.target)) {
          accountMenu.classList.remove('open');
          accountButton.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Optional: menu items in templates
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        // allow <a> default as well
        if (logoutBtn.tagName === 'BUTTON') {
          e.preventDefault();
          window.location.href = '/signout';
        }
      });
    }
  });
})();
