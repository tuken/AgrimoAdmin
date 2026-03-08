(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('modal-open');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('modal-open');
  }

  function wireModal(modal) {
    if (!modal) return;
    qsa('[data-modal-close]', modal).forEach(function (el) {
      el.addEventListener('click', function () { closeModal(modal); });
    });
  }

  function setMessage(el, msg, type) {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('is-ok', 'is-error');
    if (type === 'ok') el.classList.add('is-ok');
    if (type === 'error') el.classList.add('is-error');
  }

  async function postJson(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {})
    });
    const json = await res.json().catch(function () { return null; });
    if (!res.ok) {
      const msg = (json && json.error) ? json.error : '処理に失敗しました';
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const profileModal = qs('#profile-modal');
    const passwordModal = qs('#password-modal');

    // If pages without header/modals
    if (!profileModal && !passwordModal) return;

    wireModal(profileModal);
    wireModal(passwordModal);

    const openProfile = qs('#open-profile-modal');
    const openPassword = qs('#open-password-modal');

    const accountMenu = qs('.account-menu');
    const accountButton = qs('.account-pill');

    function closeAccountMenu() {
      if (accountMenu) accountMenu.classList.remove('open');
      if (accountButton) accountButton.setAttribute('aria-expanded', 'false');
    }

    if (openProfile) {
      openProfile.addEventListener('click', function () {
        openProfile.blur();
        closeAccountMenu();
        openModal(profileModal);
      });
    }
    if (openPassword) {
      openPassword.addEventListener('click', function () {
        openPassword.blur();
        closeAccountMenu();
        openModal(passwordModal);
      });
    }

    // Esc to close
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (profileModal && profileModal.classList.contains('is-open')) closeModal(profileModal);
      if (passwordModal && passwordModal.classList.contains('is-open')) closeModal(passwordModal);
    });

    // Password show/hide toggle
    // - Attach directly to buttons (more reliable with password managers / injected nodes)
    // - Use capture so other handlers can't stop it
    function toggleForButton(btn) {
      const id = btn.getAttribute('data-pw-toggle') || btn.getAttribute('data-target');
      if (!id) return;
      const input = document.getElementById(id);
      if (!input) return;
      input.type = (input.type === 'password') ? 'text' : 'password';
      // Keep focus if possible (don’t crash if browser doesn’t support preventScroll)
      try { input.focus({ preventScroll: true }); } catch (_) { try { input.focus(); } catch (_) {} }
    }

    // Bind existing buttons on load
    qsa('button.password-toggle,[data-pw-toggle],[data-target]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleForButton(btn);
      }, true);
    });

    // Also handle any dynamically inserted buttons (event delegation, capture)
    document.addEventListener('click', function (e) {
      const t = (e.target && e.target.nodeType === 1) ? e.target : e.target?.parentElement;
      if (!t || !t.closest) return;
      const btn = t.closest('button.password-toggle,[data-pw-toggle],[data-target]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      toggleForButton(btn);
    }, true);

    // Profile submit
    const profileForm = qs('#profile-form');
    const profileMsg = qs('#profile-message');
    if (profileForm) {
      profileForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        setMessage(profileMsg, '', null);
        const fd = new FormData(profileForm);
        const email = String(fd.get('email') || '').trim();
        const lastName = String(fd.get('last_name') || '').trim();
        const firstName = String(fd.get('first_name') || '').trim();
        if (!email || !lastName || !firstName) {
          setMessage(profileMsg, 'メールアドレス・姓・名を入力してください', 'error');
          return;
        }
        try {
          const json = await postJson('/account/profile', { email, lastName, firstName });
          setMessage(profileMsg, json.message || '保存しました', 'ok');

          // Update header display name text
          const headerEmail = qs('.account-pill-email');
          if (headerEmail) headerEmail.textContent = [lastName, firstName].filter(Boolean).join(' ');

          // Close after short delay
          setTimeout(function () { closeModal(profileModal); }, 450);
        } catch (err) {
          setMessage(profileMsg, err.message || '保存に失敗しました', 'error');
        }
      });
    }

    // Password submit
    const passwordForm = qs('#password-form');
    const passwordMsg = qs('#password-message');
    const PASSWORD_REGEX = /^[A-Za-z0-9!.\-=_#@<>]{8,20}$/;
    const PASSWORD_HELP = '8文字以上20文字以下の半角英数字で入力してください。記号は !.-=_#@<> が使用できます。';
    if (passwordForm) {
      passwordForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        setMessage(passwordMsg, '', null);
        const fd = new FormData(passwordForm);
        const password = String(fd.get('password') || '');
        const passwordConfirm = String(fd.get('password_confirm') || '');
        if (!password || !passwordConfirm) {
          setMessage(passwordMsg, 'パスワードを入力してください', 'error');
          return;
        }
        if (!PASSWORD_REGEX.test(password)) {
          setMessage(passwordMsg, PASSWORD_HELP, 'error');
          return;
        }
        if (password !== passwordConfirm) {
          setMessage(passwordMsg, 'パスワードが一致しません', 'error');
          return;
        }
        try {
          const json = await postJson('/account/password', { password, passwordConfirm });
          setMessage(passwordMsg, json.message || '変更しました', 'ok');
          passwordForm.reset();
          setTimeout(function () { closeModal(passwordModal); }, 450);
        } catch (err) {
          setMessage(passwordMsg, err.message || '変更に失敗しました', 'error');
        }
      });
    }
  });
})();
