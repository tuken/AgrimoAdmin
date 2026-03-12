(function () {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }



  function createToastHost() {
    let host = document.getElementById('app-toast-host');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'app-toast-host';
    host.className = 'app-toast-host';
    host.setAttribute('aria-live', 'polite');
    host.setAttribute('aria-atomic', 'true');
    document.body.appendChild(host);
    return host;
  }

  function showToast(message, type, options) {
    const text = String(message || '').trim();
    if (!text) return;
    const opts = options || {};
    const kind = String(type || opts.type || 'info').trim() || 'info';
    const duration = Number.isFinite(Number(opts.duration)) ? Math.max(1500, Number(opts.duration)) : 3200;
    const host = createToastHost();
    const toast = document.createElement('div');
    toast.className = `app-toast is-${kind}`;
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    toast.innerHTML = `
      <span class="app-toast-icon" aria-hidden="true"></span>
      <div class="app-toast-body">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
      <button type="button" class="app-toast-close" aria-label="閉じる">×</button>
    `;

    const close = () => {
      if (!toast.parentNode) return;
      toast.classList.add('is-leaving');
      window.setTimeout(() => {
        toast.remove();
      }, 180);
    };

    toast.querySelector('.app-toast-close')?.addEventListener('click', close);
    host.appendChild(toast);
    window.setTimeout(() => toast.classList.add('is-visible'), 10);
    window.setTimeout(close, duration);
    return toast;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  window.appToast = function (message, type, options) {
    return showToast(message, type, options);
  };

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
