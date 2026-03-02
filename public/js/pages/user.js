
document.addEventListener('DOMContentLoaded', () => {
  const userList = document.getElementById('user-list');
  if (!userList) return;

  // ---------- Helpers ----------
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (s) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const nowYmdHi = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  function openBackdrop(backdrop) {
    if (!backdrop) return;
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
  }
  function closeBackdrop(backdrop) {
    if (!backdrop) return;
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
  }
  function bindBackdropClose(backdrop, closeFn) {
    if (!backdrop) return;
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeFn();
    });
  }

  // ---------- Search + Pagination ----------
  const userSearchInput = qs('#user-search');
  const userSearchClear = qs('#user-search-clear');
  const userCountLabel = qs('#user-count');
  const pagination = qs('#user-pagination');
  const pagePrevBtn = qs('#user-page-prev');
  const pageNextBtn = qs('#user-page-next');
  const pageInfo = qs('#user-page-info');

  const PAGE_SIZE = 5;
  let currentPage = 1;

  const getAllCards = () => qsa('.worker-card', userList);

  let filteredCards = getAllCards();

  // Some browsers auto-fill this search box with the login email.
  // That would immediately filter out all cards and make the list look broken.
  // We clear auto-filled values unless the user actually typed.
  if (userSearchInput) {
    userSearchInput.dataset.userTyped = '0';
    userSearchInput.addEventListener('input', () => {
      userSearchInput.dataset.userTyped = '1';
    }, { once: true });
    setTimeout(() => {
      if (userSearchInput.dataset.userTyped === '0' && userSearchInput.value) {
        userSearchInput.value = '';
      }
    }, 200);
  }

  function updateUserCount(n) {
    if (userCountLabel) userCountLabel.textContent = `全 ${n} 名`;
  }

  function renderUserPage() {
    const allCards = getAllCards();
    const total = filteredCards.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    // hide all
    allCards.forEach(c => { c.style.display = 'none'; });

    // show page slice (order in filteredCards)
    filteredCards.forEach((c, idx) => {
      c.style.display = (idx >= start && idx < end) ? '' : 'none';
    });

    updateUserCount(total);

    if (pageInfo) pageInfo.textContent = `${currentPage} / ${totalPages}ページ`;
    if (pagePrevBtn) pagePrevBtn.disabled = currentPage === 1;
    if (pageNextBtn) pageNextBtn.disabled = currentPage === totalPages;

    // pagination always visible (CSS already forces)
    if (pagination) pagination.style.display = 'flex';
  }

  function applyUserSearch() {
    const q = (userSearchInput?.value || '').trim().toLowerCase();
    const allCards = getAllCards();
    filteredCards = allCards.filter(card => {
      const name = (card.dataset.name || '').toLowerCase();
      const email = (card.dataset.email || '').toLowerCase();
      return !q || name.includes(q) || email.includes(q);
    });
    currentPage = 1;
    renderUserPage();

    if (userSearchClear) userSearchClear.style.display = (q.length > 0) ? '' : 'none';
  }

  if (userSearchInput) {
    userSearchInput.addEventListener('input', applyUserSearch);
  }
  if (userSearchClear) {
    userSearchClear.addEventListener('click', () => {
      if (!userSearchInput) return;
      userSearchInput.value = '';
      applyUserSearch();
    });
  }
  if (pagePrevBtn) {
    pagePrevBtn.addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; renderUserPage(); }
    });
  }
  if (pageNextBtn) {
    pageNextBtn.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
      if (currentPage < totalPages) { currentPage++; renderUserPage(); }
    });
  }

  // ---------- Options: owners + fields ----------
  function getOwnerNames() {
    const cards = getAllCards();
    return cards
      .filter(c => (c.dataset.owner || '') === 'はい')
      .map(c => c.dataset.name || '')
      .filter(Boolean);
  }
  function getAllFieldNames() {
    const cards = getAllCards();
    const set = new Set();
    cards.forEach(c => {
      const fields = (c.dataset.fields || '').split(',').map(s => s.trim()).filter(Boolean);
      fields.forEach(f => set.add(f));
    });
    return Array.from(set);
  }
  function fillSelectOptions(selectEl, values, placeholder = null) {
    if (!selectEl) return;
    const current = selectEl.value;
    const opts = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    const ph = placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : '';
    selectEl.innerHTML = ph + opts;
    // try restore
    if (values.includes(current)) selectEl.value = current;
  }

  // ---------- New User Modal ----------
  const newUserButton = qs('#new-user-button');
  const newUserModalBackdrop = qs('#new-user-modal-backdrop');
  const newUserModalClose = qs('#new-user-modal-close');
  const newUserCancel = qs('#new-user-cancel');
  const newUserSave = qs('#new-user-save');

  const newUserName = qs('#new-user-name');
  const newUserEmail = qs('#new-user-email');
  const newUserPassword = qs('#new-user-password');
  const newUserOwner = qs('#new-user-owner');
  const ownerSelectWrapper = qs('#owner-select-wrapper');
  const ownerSelect = qs('#new-user-owner-select');

  const newFieldSelect = qs('#new-field-select');
  const newFieldAdd = qs('#new-field-add');
  const newFieldChips = qs('#new-field-chips');

  let newSelectedFields = [];

  function renderChips(container, fields, onRemove) {
    if (!container) return;
    container.innerHTML = fields.map((f, idx) => `
      <span class="chip">
        ${escapeHtml(f)}
        <button class="chip-remove" type="button" data-chip-index="${idx}" aria-label="remove">×</button>
      </span>
    `).join('');
    qsa('.chip-remove', container).forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.chipIndex);
        onRemove(i);
      });
    });
  }

  function resetNewUserForm() {
    if (newUserName) newUserName.value = '';
    if (newUserEmail) newUserEmail.value = '';
    if (newUserPassword) newUserPassword.value = '';
    if (newUserOwner) newUserOwner.checked = false;
    newSelectedFields = [];
    renderChips(newFieldChips, newSelectedFields, (i) => {
      newSelectedFields.splice(i, 1);
      renderChips(newFieldChips, newSelectedFields, arguments.callee);
    });
    if (ownerSelectWrapper) ownerSelectWrapper.style.display = '';
  }

  function syncNewUserSelects() {
    fillSelectOptions(ownerSelect, getOwnerNames(), 'オーナーを選択');
    fillSelectOptions(newFieldSelect, getAllFieldNames(), '圃場を選択');
  }

  function openNewUserModal() {
    syncNewUserSelects();
    resetNewUserForm();
    openBackdrop(newUserModalBackdrop);
  }
  function closeNewUserModal() {
    closeBackdrop(newUserModalBackdrop);
  }

  if (newUserButton) newUserButton.addEventListener('click', openNewUserModal);
  if (newUserModalClose) newUserModalClose.addEventListener('click', closeNewUserModal);
  if (newUserCancel) newUserCancel.addEventListener('click', closeNewUserModal);
  bindBackdropClose(newUserModalBackdrop, closeNewUserModal);

  if (newUserOwner) {
    newUserOwner.addEventListener('change', () => {
      if (!ownerSelectWrapper) return;
      ownerSelectWrapper.style.display = newUserOwner.checked ? 'none' : '';
    });
  }

  if (newFieldAdd) {
    newFieldAdd.addEventListener('click', () => {
      const v = (newFieldSelect?.value || '').trim();
      if (!v) return;
      if (!newSelectedFields.includes(v)) newSelectedFields.push(v);
      renderChips(newFieldChips, newSelectedFields, (i) => {
        newSelectedFields.splice(i, 1);
        renderChips(newFieldChips, newSelectedFields, arguments.callee);
      });
      if (newFieldSelect) newFieldSelect.value = '';
    });
  }

  function buildWorkerCard({ id, name, email, isOwner, fields, lastLogin, createdAt }) {
    const roleLabel = isOwner ? 'OWNER' : 'WORKER';
    const sectionSelector = isOwner ? '[data-section="owner"]' : '[data-section="worker"]';
    const section = qs(sectionSelector, userList);
    const cardsContainer = section || userList;

    const chips = (fields || []).map(f => `<span class="worker-field-chip">${escapeHtml(f)}</span>`).join('');
    const article = document.createElement('article');
    article.className = 'report-card worker-card';
    article.dataset.userId = id;
    article.dataset.name = name;
    article.dataset.email = email;
    article.dataset.owner = isOwner ? 'はい' : 'いいえ';
    article.dataset.fields = (fields || []).join(',');
    article.dataset.lastLogin = lastLogin || '-';
    article.dataset.createdAt = createdAt || '-';

    article.innerHTML = `
      <div class="worker-main">
        <div class="worker-name-row">
          <span class="worker-name">${escapeHtml(name)}</span>
          <span class="worker-role-pill">${roleLabel}</span>
        </div>
        <div class="worker-email">${escapeHtml(email)}</div>
        <div class="worker-fields">${chips}</div>
      </div>
      <div class="worker-meta">
        <div>
          <div class="worker-meta-label">最終ログイン</div>
          <div class="worker-meta-value worker-last-login">${escapeHtml(lastLogin || '-')}</div>
        </div>
        <div>
          <div class="worker-meta-label">登録日時</div>
          <div class="worker-meta-value worker-created-at">${escapeHtml(createdAt || '-')}</div>
        </div>
      </div>
    `;

    // insert at top of section after heading
    const heading = section ? qs('h2', section) : null;
    if (section && heading && heading.nextElementSibling) {
      section.insertBefore(article, heading.nextElementSibling);
    } else if (section && heading) {
      section.appendChild(article);
    } else {
      cardsContainer.appendChild(article);
    }
    return article;
  }

  if (newUserSave) {
    newUserSave.addEventListener('click', () => {
      const name = (newUserName?.value || '').trim();
      const email = (newUserEmail?.value || '').trim();
      if (!name || !email) {
        alert('氏名とメールアドレスを入力してください。');
        return;
      }
      const isOwner = !!newUserOwner?.checked;
      const id = `U${String(Math.floor(Math.random() * 9000) + 1000)}`;
      buildWorkerCard({
        id,
        name,
        email,
        isOwner,
        fields: newSelectedFields.slice(),
        lastLogin: '-',
        createdAt: nowYmdHi()
      });

      // refresh lists / pagination
      filteredCards = getAllCards();
      applyUserSearch();
      closeNewUserModal();
    });
  }

  // ---------- Detail Modal ----------
  const detailBackdrop = qs('#user-detail-modal-backdrop');
  const detailClose = qs('#user-detail-modal-close');

  const detailUserId = qs('#detail-user-id');
  const detailUserName = qs('#detail-user-name');
  const detailUserEmail = qs('#detail-user-email');
  const detailUserOwner = qs('#detail-user-owner');
  const detailOwnerWrapper = qs('#detail-owner-select-wrapper');
  const detailOwnerSelect = qs('#detail-user-owner-select');

  const detailFieldSelect = qs('#detail-field-select');
  const detailFieldAdd = qs('#detail-field-add');
  const detailFieldChips = qs('#detail-field-chips');

  const detailLastLogin = qs('#detail-user-last-login');
  const detailCreatedAt = qs('#detail-user-created-at');

  const btnEdit = qs('#user-detail-edit');
  const btnSave = qs('#user-detail-save');
  const btnCancel = qs('#user-detail-cancel');
  const btnDelete = qs('#user-detail-delete');

  let activeCard = null;
  let detailSelectedFields = [];
  let originalSnapshot = null;

  function syncDetailSelects() {
    fillSelectOptions(detailOwnerSelect, getOwnerNames(), 'オーナーを選択');
    fillSelectOptions(detailFieldSelect, getAllFieldNames(), '圃場を選択');
  }

  function setDetailEditMode(isEdit) {
    const disabled = !isEdit;
    [detailUserName, detailUserEmail, detailUserOwner, detailOwnerSelect, detailFieldSelect, detailFieldAdd, detailLastLogin, detailCreatedAt]
      .forEach(el => { if (!el) return; el.disabled = disabled; });

    if (detailLastLogin) detailLastLogin.disabled = true;
    if (detailCreatedAt) detailCreatedAt.disabled = true;

    if (btnEdit) btnEdit.style.display = isEdit ? 'none' : '';
    if (btnSave) btnSave.style.display = isEdit ? '' : 'none';
    if (btnCancel) btnCancel.style.display = isEdit ? '' : 'none';
    if (btnDelete) btnDelete.style.display = isEdit ? '' : 'none';

    // owner select visibility
    const isOwner = !!detailUserOwner?.checked;
    if (detailOwnerWrapper) detailOwnerWrapper.style.display = (!isOwner) ? '' : 'none';
  }

  function openDetail(card) {
    activeCard = card;
    if (!activeCard) return;

    syncDetailSelects();

    const data = activeCard.dataset;
    originalSnapshot = {
      userId: data.userId || '',
      name: data.name || '',
      email: data.email || '',
      owner: data.owner || 'いいえ',
      fields: (data.fields || '').split(',').map(s => s.trim()).filter(Boolean),
      lastLogin: data.lastLogin || '-',
      createdAt: data.createdAt || '-'
    };

    if (detailUserId) detailUserId.textContent = originalSnapshot.userId;
    if (detailUserName) detailUserName.value = originalSnapshot.name;
    if (detailUserEmail) detailUserEmail.value = originalSnapshot.email;
    if (detailUserOwner) detailUserOwner.checked = originalSnapshot.owner === 'はい';
    detailSelectedFields = originalSnapshot.fields.slice();
    renderChips(detailFieldChips, detailSelectedFields, (i) => {
      detailSelectedFields.splice(i, 1);
      renderChips(detailFieldChips, detailSelectedFields, arguments.callee);
    });
    if (detailLastLogin) detailLastLogin.value = originalSnapshot.lastLogin;
    if (detailCreatedAt) detailCreatedAt.value = originalSnapshot.createdAt;

    // owner select
    if (detailOwnerSelect) detailOwnerSelect.value = '';
    if (detailOwnerWrapper) detailOwnerWrapper.style.display = (detailUserOwner?.checked) ? 'none' : '';

    setDetailEditMode(false);
    openBackdrop(detailBackdrop);
  }

  function closeDetail() {
    closeBackdrop(detailBackdrop);
    activeCard = null;
    detailSelectedFields = [];
    originalSnapshot = null;
  }

  if (detailClose) detailClose.addEventListener('click', closeDetail);
  bindBackdropClose(detailBackdrop, closeDetail);

  // event delegation for card click
  userList.addEventListener('click', (e) => {
    const card = e.target.closest('.worker-card');
    if (!card) return;
    openDetail(card);
  });

  if (detailUserOwner) {
    detailUserOwner.addEventListener('change', () => {
      if (detailOwnerWrapper) detailOwnerWrapper.style.display = detailUserOwner.checked ? 'none' : '';
    });
  }

  if (detailFieldAdd) {
    detailFieldAdd.addEventListener('click', () => {
      const v = (detailFieldSelect?.value || '').trim();
      if (!v) return;
      if (!detailSelectedFields.includes(v)) detailSelectedFields.push(v);
      renderChips(detailFieldChips, detailSelectedFields, (i) => {
        detailSelectedFields.splice(i, 1);
        renderChips(detailFieldChips, detailSelectedFields, arguments.callee);
      });
      if (detailFieldSelect) detailFieldSelect.value = '';
    });
  }

  if (btnEdit) {
    btnEdit.addEventListener('click', () => setDetailEditMode(true));
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      if (!originalSnapshot) return;
      if (detailUserName) detailUserName.value = originalSnapshot.name;
      if (detailUserEmail) detailUserEmail.value = originalSnapshot.email;
      if (detailUserOwner) detailUserOwner.checked = originalSnapshot.owner === 'はい';
      detailSelectedFields = originalSnapshot.fields.slice();
      renderChips(detailFieldChips, detailSelectedFields, (i) => {
        detailSelectedFields.splice(i, 1);
        renderChips(detailFieldChips, detailSelectedFields, arguments.callee);
      });
      setDetailEditMode(false);
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      if (!activeCard) return;

      const name = (detailUserName?.value || '').trim();
      const email = (detailUserEmail?.value || '').trim();
      if (!name || !email) {
        alert('氏名とメールアドレスを入力してください。');
        return;
      }

      const isOwner = !!detailUserOwner?.checked;

      // update dataset
      activeCard.dataset.name = name;
      activeCard.dataset.email = email;
      activeCard.dataset.owner = isOwner ? 'はい' : 'いいえ';
      activeCard.dataset.fields = detailSelectedFields.join(',');

      // update visible UI
      const nameEl = qs('.worker-name', activeCard);
      const emailEl = qs('.worker-email', activeCard);
      const rolePill = qs('.worker-role-pill', activeCard);
      const fieldsWrap = qs('.worker-fields', activeCard);

      if (nameEl) nameEl.textContent = name;
      if (emailEl) emailEl.textContent = email;
      if (rolePill) rolePill.textContent = isOwner ? 'OWNER' : 'WORKER';
      if (fieldsWrap) {
        fieldsWrap.innerHTML = detailSelectedFields.map(f => `<span class="worker-field-chip">${escapeHtml(f)}</span>`).join('');
      }

      // move section if owner flag changed
      const currentSection = activeCard.closest('.user-section')?.dataset?.section;
      const targetSection = isOwner ? 'owner' : 'worker';
      if (currentSection && currentSection !== targetSection) {
        const section = qs(`[data-section="${targetSection}"]`, userList);
        const heading = section ? qs('h2', section) : null;
        if (section && heading && heading.nextElementSibling) {
          section.insertBefore(activeCard, heading.nextElementSibling);
        } else if (section) {
          section.appendChild(activeCard);
        }
      }

      // refresh selects (owner list may have changed)
      syncNewUserSelects();
      syncDetailSelects();

      // refresh search/pagination
      applyUserSearch();
      setDetailEditMode(false);
      alert('保存しました。（ダミー）');
    });
  }

  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      if (!activeCard) return;
      if (!confirm('この作業者を削除しますか？（ダミー）')) return;
      activeCard.remove();
      closeDetail();
      filteredCards = getAllCards();
      applyUserSearch();
    });
  }

  // ESC close support
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (newUserModalBackdrop?.classList.contains('open')) closeNewUserModal();
    if (detailBackdrop?.classList.contains('open')) closeDetail();
  });

  // initial
  filteredCards = getAllCards();
  applyUserSearch();
});
