
document.addEventListener('DOMContentLoaded', () => {
  const userList = document.getElementById('user-list');
  if (!userList) return;

  const currentUserId = String(userList.dataset.currentUserId || '').trim();
  const currentRoleId = Number(userList.dataset.currentRoleId || 0);
  const isAdminUser = currentRoleId === 1;
  const isOwnerUser = currentRoleId === 2;

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

  let bodyScrollLockY = 0;

  function lockBodyScroll() {
    bodyScrollLockY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open-body-lock');
    document.body.style.top = `-${bodyScrollLockY}px`;
  }

  function unlockBodyScroll() {
    const y = bodyScrollLockY;
    document.body.classList.remove('modal-open-body-lock');
    document.body.style.top = '';
    document.documentElement.classList.remove('modal-open');
    window.scrollTo(0, y);
  }

  function syncModalOpenState() {
    const hasOpenModal = document.querySelector('.modal-backdrop.open');
    if (hasOpenModal) {
      if (!document.body.classList.contains('modal-open-body-lock')) {
        lockBodyScroll();
      } else {
        document.documentElement.classList.add('modal-open');
      }
    } else if (document.body.classList.contains('modal-open-body-lock')) {
      unlockBodyScroll();
    } else {
      document.documentElement.classList.remove('modal-open');
    }
  }

  function openBackdrop(backdrop) {
    if (!backdrop) return;
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    syncModalOpenState();
  }
  function closeBackdrop(backdrop) {
    if (!backdrop) return;
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
    syncModalOpenState();
  }
  function bindBackdropClose(backdrop, closeFn) {
    if (!backdrop) return;
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeFn();
    });
  }



  // ---------- GraphQL users ----------
  function formatDateTime(v) {
    if (!v) return '-';
    const s = String(v).trim();
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return s.replace('T', ' ').replace(/:\d{2}(?:\.\d+)?Z?$/, '');
  }

  function getDisplayName(user) {
    const full = `${String(user?.lastName || '').trim()} ${String(user?.firstName || '').trim()}`.trim();
    return full || String(user?.farmName || '').trim() || String(user?.email || '').trim() || `User ${String(user?.id || '').trim()}`;
  }

  function normalizeGender(v) {
    const s = String(v ?? '').trim().toLowerCase();
    if (!s) return '';
    if (['male', 'man', 'm', '男性', '男'].includes(s)) return 'male';
    if (['female', 'woman', 'f', '女性', '女'].includes(s)) return 'female';
    if (['other', 'others', 'その他'].includes(s)) return 'other';
    if (['unknown', 'none', '未回答', '未設定', '回答しない'].includes(s)) return 'unknown';
    return s;
  }

  function normalizeDateOnly(v) {
    if (!v) return '';
    const s = String(v).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function todayDateOnly() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function clampBirthdayValue(input) {
    if (!input) return;
    const min = String(input.min || '1900-01-01');
    const max = String(input.max || todayDateOnly());
    if (!input.value) return;
    if (input.value < min) {
      input.value = min;
      return;
    }
    if (input.value > max) {
      input.value = max;
    }
  }

  function bindBirthdayPickerGuard(input) {
    if (!input) return;
    input.min = input.min || '1900-01-01';
    input.max = input.max || todayDateOnly();
    input.setAttribute('autocomplete', 'bday');

    const openPicker = () => {
      if (input.disabled) return;
      if (typeof input.showPicker === 'function') {
        try { input.showPicker(); } catch (_) {}
      }
    };

    input.addEventListener('focus', () => {
      setTimeout(openPicker, 0);
    });

    input.addEventListener('click', () => {
      openPicker();
    });

    input.addEventListener('keydown', (e) => {
      const key = e.key;
      if (key === 'Tab' || key === 'Shift' || key === 'Escape') return;
      if (key === 'Enter' || key === ' ' || key === 'ArrowDown') {
        e.preventDefault();
        openPicker();
        return;
      }
      if (key.startsWith('Arrow') || key === 'Home' || key === 'End' || key === 'PageUp' || key === 'PageDown') return;
      e.preventDefault();
    });

    input.addEventListener('beforeinput', (e) => {
      if (input.disabled) return;
      e.preventDefault();
    });

    input.addEventListener('paste', (e) => e.preventDefault());
    input.addEventListener('drop', (e) => e.preventDefault());
    input.addEventListener('change', () => clampBirthdayValue(input));
    input.addEventListener('blur', () => clampBirthdayValue(input));
  }

  function clearUserSections() {
    qsa('.worker-card', userList).forEach((el) => el.remove());
  }


  function normalizeZipcode(v) {
    return String(v ?? '').replace(/[^\d]/g, '').slice(0, 7);
  }

  async function lookupAddressByZipcode(zipcode) {
    const normalized = normalizeZipcode(zipcode);
    if (normalized.length !== 7) return null;

    const url = `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${encodeURIComponent(normalized)}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`郵便番号検索に失敗しました: ${res.status}`);
    const json = await res.json();
    if (json?.status !== 200 || !Array.isArray(json?.results) || !json.results.length) return null;

    const first = json.results[0] || {};
    return `${String(first.address1 || '')}${String(first.address2 || '')}${String(first.address3 || '')}`.trim();
  }

  function bindZipcodeAutoFill(zipInput, addressInput) {
    if (!zipInput || !addressInput) return;

    let lastRequestedZip = '';

    const execute = async () => {
      const normalized = normalizeZipcode(zipInput.value);
      if (normalized.length !== 7) return;
      if (lastRequestedZip === normalized) return;
      lastRequestedZip = normalized;

      const currentAddress = String(addressInput.value || '').trim();
      const autoFilledZip = addressInput.dataset.autoFilledZip || '';
      const shouldOverwrite = !currentAddress || autoFilledZip === normalized || autoFilledZip === normalizeZipcode(zipInput.dataset.prevZip || '');
      if (!shouldOverwrite && currentAddress) return;

      try {
        const address = await lookupAddressByZipcode(normalized);
        if (!address) return;
        addressInput.value = address;
        addressInput.dataset.autoFilledZip = normalized;
      } catch (err) {
        console.error('郵便番号から住所を取得できませんでした:', err);
      } finally {
        zipInput.dataset.prevZip = normalized;
      }
    };

    zipInput.addEventListener('input', () => {
      const normalized = normalizeZipcode(zipInput.value);
      if (zipInput.value !== normalized) zipInput.value = normalized;
      if (normalized.length < 7) lastRequestedZip = '';
    });
    zipInput.addEventListener('blur', execute);
    zipInput.addEventListener('change', execute);
  }

  async function fetchUsers() {
    const query = `
      query UsersForList {
        listUsers {
          id
          farmName
          firstName
          lastName
          email
          postalCode
          address
          gender
          birthday
          note
          lastLoginAt
          createdAt
          parent {
            id
            farmName
            lastName
            firstName
            email
          }
          fields {
            id
            name
          }
        }
      }
    `;
    const result = await window.gql(query, {});
    if (result?.errors?.length) throw new Error(result.errors[0]?.message || 'Failed to fetch users');
    return Array.isArray(result?.data?.listUsers) ? result.data.listUsers : [];
  }

  function deriveOwnerOptionsFromUsers(users) {
    const list = Array.isArray(users) ? users : [];
    const owners = list
      .filter((u) => !String(u?.parent?.id || '').trim())
      .map((u) => ({
        id: String(u?.id || '').trim(),
        name: String(u?.farmName || '').trim() || `${String(u?.lastName || '').trim()} ${String(u?.firstName || '').trim()}`.trim() || String(u?.email || '').trim(),
      }))
      .filter((u) => u.id && u.name);

    const uniq = new Map();
    owners.forEach((u) => {
      if (!uniq.has(u.id)) uniq.set(u.id, u);
    });
    return Array.from(uniq.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }

  function populateUserList(users) {
    clearUserSections();
    (Array.isArray(users) ? users : []).forEach((user) => {
      const fields = Array.isArray(user?.fields) ? user.fields.map((f) => ({ id: String(f?.id || '').trim(), name: String(f?.name || '').trim() })).filter((f) => f.name) : [];
      const isOwner = !String(user?.parent?.id || '').trim();
      if (isOwnerUser && isOwner) return;

      const ownerDisplayName = `${String(user?.parent?.lastName || '').trim()} ${String(user?.parent?.firstName || '').trim()}`.trim()
        || String(user?.parent?.email || '').trim();
      const displayFarmName = isOwner
        ? String(user?.farmName || '').trim()
        : String(user?.parent?.farmName || '').trim() || String(user?.farmName || '').trim() || ownerDisplayName;

      buildWorkerCard({
        id: String(user?.id || '').trim(),
        farmName: displayFarmName,
        name: getDisplayName(user),
        lastName: String(user?.lastName || '').trim(),
        firstName: String(user?.firstName || '').trim(),
        email: String(user?.email || '').trim(),
        isOwner,
        ownerId: String(user?.parent?.id || '').trim(),
        ownerName: String(user?.parent?.farmName || '').trim()
          || `${String(user?.parent?.lastName || '').trim()} ${String(user?.parent?.firstName || '').trim()}`.trim()
          || String(user?.parent?.email || '').trim(),
        fields,
        postalCode: String(user?.postalCode || '').trim(),
        address: String(user?.address || '').trim(),
        gender: normalizeGender(user?.gender),
        birthday: normalizeDateOnly(user?.birthday),
        note: String(user?.note || '').trim(),
        lastLogin: formatDateTime(user?.lastLoginAt),
        createdAt: formatDateTime(user?.createdAt),
      });
    });
    const derivedOwners = deriveOwnerOptionsFromUsers(users);
    if (isOwnerUser) {
      const currentOwner = derivedOwners.find((u) => u.id === currentUserId);
      ownerOptions = currentOwner ? [currentOwner] : ownerOptions.filter((u) => u.id === currentUserId);
    } else if (!ownerOptions.length && derivedOwners.length) {
      ownerOptions = derivedOwners;
    }

    filteredCards = getAllCards();
    syncNewUserSelects();
    syncDetailSelects();
    applyUserSearch();
  }

  async function initializeUserListFromGraphQL() {
    try {
      const users = await fetchUsers();
      populateUserList(users);
    } catch (err) {
      console.error('Failed to load users:', err);
      filteredCards = getAllCards();
      applyUserSearch();
    }
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
  let ownerOptions = [];
  let newUserFieldOptions = [];

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

  function fillObjectSelectOptions(selectEl, items, placeholder = null) {
    if (!selectEl) return;
    const current = String(selectEl.value || '');
    const list = Array.isArray(items) ? items : [];
    const opts = list.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
    const ph = placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : '';
    selectEl.innerHTML = ph + opts;
    if (list.some(item => String(item.id) === current)) selectEl.value = current;
  }

  async function fetchOwnersForSelect() {
    const query = `
      query FindUsersForOwnerSelect($roleID: ID!) {
        findUsers(roleID: $roleID) {
          id
          farmName
          firstName
          lastName
          email
        }
      }
    `;
    let result = await window.gql(query, { roleID: '2' });
    if (result?.errors?.length) {
      console.warn('findUsers(roleID: "2") failed for owner select:', result.errors);
      const fallbackQuery = `
        query FindUsersForOwnerSelectFallback {
          findUsers(roleID: 2) {
            id
            farmName
            firstName
            lastName
            email
          }
        }
      `;
      result = await window.gql(fallbackQuery, {});
    }
    if (result?.errors?.length) throw new Error(result.errors[0]?.message || 'Failed to fetch owners');
    const list = Array.isArray(result?.data?.findUsers) ? result.data.findUsers : [];
    return list
      .map((u) => {
        const id = String(u?.id || '').trim();
        const name = String(u?.farmName || '').trim() || `${String(u?.lastName || '').trim()} ${String(u?.firstName || '').trim()}`.trim() || String(u?.email || '').trim();
        return { id, name };
      })
      .filter((u) => u.id && u.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }

  async function fetchFieldsForOwner(ownerId) {
    const normalizedOwnerId = String(ownerId || '').trim();
    if (!normalizedOwnerId) return [];
    const query = `
      query FindFields($ownerID: ID) {
        findFields(ownerID: $ownerID) {
          id
          name
        }
      }
    `;
    const result = await window.gql(query, { ownerID: normalizedOwnerId });
    if (result?.errors?.length) throw new Error(result.errors[0]?.message || 'Failed to fetch fields');
    const list = Array.isArray(result?.data?.findFields) ? result.data.findFields : [];
    return list
      .map((f) => ({ id: String(f?.id || '').trim(), name: String(f?.name || '').trim() }))
      .filter((f) => f.id && f.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }

  async function preloadOwnerOptions() {
    try {
      if (isOwnerUser) {
        ownerOptions = ownerOptions.filter((u) => u.id === currentUserId);
        return;
      }
      ownerOptions = await fetchOwnersForSelect();
    } catch (err) {
      console.error('Failed to preload owners:', err);
      ownerOptions = [];
    }
  }

  // ---------- New User Modal ----------
  const newUserButton = qs('#new-user-button');
  const newUserModalBackdrop = qs('#new-user-modal-backdrop');
  const newUserModalClose = qs('#new-user-modal-close');
  const newUserCancel = qs('#new-user-cancel');
  const newUserSave = qs('#new-user-save');

  const newUserFarmName = qs('#new-user-farm-name');
  const newUserLastName = qs('#new-user-last-name');
  const newUserFirstName = qs('#new-user-first-name');
  const newUserEmail = qs('#new-user-email');
  const newUserPassword = qs('#new-user-password');
  const newUserPostalCode = qs('#new-user-postal-code');
  const newUserAddress = qs('#new-user-address');
  const newUserGender = qs('#new-user-gender');
  const newUserBirthday = qs('#new-user-birthday');
  const newUserNote = qs('#new-user-note');
  const newUserOwner = qs('#new-user-owner');

  bindBirthdayPickerGuard(newUserBirthday);
  bindZipcodeAutoFill(newUserPostalCode, newUserAddress);
  const ownerSelectWrapper = qs('#owner-select-wrapper');
  const ownerSelect = qs('#new-user-owner-select');
  const newUserOwnerCheckboxGroup = qs('#new-user-owner-checkbox-group');
  const newUserFarmNameGroup = qs('#new-user-farm-name-group');
  const newUserFieldsGroup = qs('#new-user-fields-group');

  const newFieldSelect = qs('#new-field-select');
  const newFieldAdd = qs('#new-field-add');
  const newFieldChips = qs('#new-field-chips');

  let newSelectedFields = [];

  function renderChips(container, fields, onRemove) {
    if (!container) return;
    container.innerHTML = fields.map((f, idx) => `
      <span class="chip">
        ${escapeHtml(typeof f === 'string' ? f : (f?.name || ''))}
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

  function isValidPassword(password) {
    const re = /^[A-Za-z0-9!.\-=_#@<>]{8,20}$/;
    return re.test(String(password || ''));
  }

  function getSelectedOwnerIdForNewUser() {
    if (isOwnerUser) return currentUserId;
    return String(ownerSelect?.value || '').trim();
  }

  function isNewUserOwnerMode() {
    return isAdminUser && !!newUserOwner?.checked;
  }

  async function updateNewUserFieldOptions() {
    const shouldShowFields = !isNewUserOwnerMode();
    if (newUserFieldsGroup) newUserFieldsGroup.style.display = shouldShowFields ? '' : 'none';
    if (!shouldShowFields) {
      newUserFieldOptions = [];
      newSelectedFields = [];
      fillObjectSelectOptions(newFieldSelect, [], '圃場を選択');
      renderChips(newFieldChips, newSelectedFields, (i) => {
        newSelectedFields.splice(i, 1);
        renderChips(newFieldChips, newSelectedFields, arguments.callee);
      });
      return;
    }

    const ownerId = getSelectedOwnerIdForNewUser();
    if (!ownerId) {
      newUserFieldOptions = [];
      newSelectedFields = [];
      fillObjectSelectOptions(newFieldSelect, [], '先に所属オーナーを選択');
      renderChips(newFieldChips, newSelectedFields, (i) => {
        newSelectedFields.splice(i, 1);
        renderChips(newFieldChips, newSelectedFields, arguments.callee);
      });
      return;
    }

    try {
      newUserFieldOptions = await fetchFieldsForOwner(ownerId);
    } catch (err) {
      console.error('Failed to load fields for owner:', err);
      newUserFieldOptions = [];
    }

    const validIds = new Set(newUserFieldOptions.map((f) => f.id));
    newSelectedFields = newSelectedFields.filter((f) => validIds.has(f.id));
    fillObjectSelectOptions(newFieldSelect, newUserFieldOptions, newUserFieldOptions.length ? '圃場を選択' : '選択できる圃場がありません');
    renderChips(newFieldChips, newSelectedFields, (i) => {
      newSelectedFields.splice(i, 1);
      renderChips(newFieldChips, newSelectedFields, arguments.callee);
    });
  }

  function updateNewUserRoleUI() {
    const ownerMode = isNewUserOwnerMode();
    if (newUserOwnerCheckboxGroup) newUserOwnerCheckboxGroup.style.display = isAdminUser ? '' : 'none';
    if (newUserOwner) newUserOwner.disabled = !isAdminUser;
    if (newUserFarmNameGroup) newUserFarmNameGroup.style.display = (isAdminUser && ownerMode) ? '' : 'none';
    if (ownerSelectWrapper) ownerSelectWrapper.style.display = ownerMode || isOwnerUser ? 'none' : '';
    updateNewUserFieldOptions();
  }

  async function resetNewUserForm() {
    if (newUserFarmName) newUserFarmName.value = '';
    if (newUserLastName) newUserLastName.value = '';
    if (newUserFirstName) newUserFirstName.value = '';
    if (newUserEmail) newUserEmail.value = '';
    if (newUserPassword) newUserPassword.value = '';
    if (newUserPostalCode) newUserPostalCode.value = '';
    if (newUserAddress) newUserAddress.value = '';
    if (newUserGender) newUserGender.value = '';
    if (newUserBirthday) newUserBirthday.value = '';
    if (newUserNote) newUserNote.value = '';
    if (newUserOwner) newUserOwner.checked = false;
    if (ownerSelect) ownerSelect.value = isOwnerUser ? currentUserId : '';
    syncNewUserSelects();
    newSelectedFields = [];
    renderChips(newFieldChips, newSelectedFields, (i) => {
      newSelectedFields.splice(i, 1);
      renderChips(newFieldChips, newSelectedFields, arguments.callee);
    });
    updateNewUserRoleUI();
    await updateNewUserFieldOptions();
  }

  function syncNewUserSelects() {
    if (!ownerSelect) return;
    if (isOwnerUser) {
      fillObjectSelectOptions(ownerSelect, ownerOptions, ownerOptions.length ? null : 'オーナーを選択');
      ownerSelect.value = currentUserId;
      return;
    }
    fillObjectSelectOptions(ownerSelect, ownerOptions, 'オーナーを選択');
  }

  async function openNewUserModal() {
    syncNewUserSelects();
    await resetNewUserForm();
    openBackdrop(newUserModalBackdrop);
  }
  function closeNewUserModal() {
    closeBackdrop(newUserModalBackdrop);
  }

  if (newUserButton) newUserButton.addEventListener('click', () => { openNewUserModal(); });
  if (newUserModalClose) newUserModalClose.addEventListener('click', closeNewUserModal);
  if (newUserCancel) newUserCancel.addEventListener('click', closeNewUserModal);
  bindBackdropClose(newUserModalBackdrop, closeNewUserModal);

  if (newUserOwner) {
    newUserOwner.addEventListener('change', () => {
      updateNewUserRoleUI();
    });
  }

  if (ownerSelect) {
    ownerSelect.addEventListener('change', () => {
      updateNewUserFieldOptions();
    });
  }

  if (newFieldAdd) {
    newFieldAdd.addEventListener('click', () => {
      const selectedId = String(newFieldSelect?.value || '').trim();
      if (!selectedId) return;
      const field = newUserFieldOptions.find((f) => f.id === selectedId);
      if (!field) return;
      if (!newSelectedFields.some((f) => f.id === field.id)) newSelectedFields.push(field);
      renderChips(newFieldChips, newSelectedFields, (i) => {
        newSelectedFields.splice(i, 1);
        renderChips(newFieldChips, newSelectedFields, arguments.callee);
      });
      if (newFieldSelect) newFieldSelect.value = '';
    });
  }

  async function createUserMutation(input) {
    const query = `
      mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
          id
          farmName
          firstName
          lastName
          email
          postalCode
          address
          gender
          birthday
          note
          createdAt
          lastLoginAt
          parent {
            id
            farmName
            lastName
            firstName
            email
          }
          fields {
            id
            name
          }
        }
      }
    `;
    const result = await window.gql(query, { input });
    if (result?.errors?.length) throw new Error(result.errors[0]?.message || 'Failed to create user');
    return result?.data?.createUser || null;
  }


  async function updateUserMutation(id, input) {
    const query = `
      mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
        updateUser(id: $id, input: $input) {
          id
          farmName
          firstName
          lastName
          email
          postalCode
          address
          gender
          birthday
          note
          createdAt
          lastLoginAt
          parent {
            id
            farmName
            lastName
            firstName
            email
          }
          fields {
            id
            name
          }
        }
      }
    `;
    const result = await window.gql(query, { id: String(id), input });
    if (result?.errors?.length) throw new Error(result.errors[0]?.message || 'Failed to update user');
    return result?.data?.updateUser || null;
  }

  async function deleteUserMutation(id) {
    const query = `
      mutation DeleteUser($id: ID!) {
        deleteUser(id: $id) {
          id
        }
      }
    `;
    const result = await window.gql(query, { id: String(id) });
    if (result?.errors?.length) throw new Error(result.errors[0]?.message || 'Failed to delete user');
    return result?.data?.deleteUser || null;
  }

  function buildWorkerCard({ id, farmName = '', name, lastName = '', firstName = '', email, isOwner, ownerId = '', ownerName = '', fields, postalCode = '', address = '', gender = '', birthday = '', note = '', lastLogin, createdAt }) {
    const roleLabel = isOwner ? 'OWNER' : 'WORKER';
    const sectionSelector = isOwner ? '[data-section="owner"]' : '[data-section="worker"]';
    const section = qs(sectionSelector, userList);
    const cardsContainer = section || userList;

    const fieldList = Array.isArray(fields) ? fields : [];
    const fieldNames = fieldList.map((f) => typeof f === 'string' ? f : String(f?.name || '').trim()).filter(Boolean);
    const fieldIds = fieldList.map((f) => typeof f === 'string' ? '' : String(f?.id || '').trim());
    const chips = fieldNames.map(f => `<span class="worker-field-chip">${escapeHtml(typeof f === 'string' ? f : (f?.name || ''))}</span>`).join('');
    const article = document.createElement('article');
    article.className = 'report-card worker-card';
    article.dataset.userId = id;
    article.dataset.farmName = farmName || '';
    article.dataset.name = name;
    article.dataset.lastName = lastName || '';
    article.dataset.firstName = firstName || '';
    article.dataset.email = email;
    article.dataset.owner = isOwner ? 'はい' : 'いいえ';
    article.dataset.ownerId = ownerId || '';
    article.dataset.ownerName = ownerName || '';
    article.dataset.fields = fieldNames.join(',');
    article.dataset.fieldIds = fieldIds.join(',');
    article.dataset.postalCode = postalCode || '';
    article.dataset.address = address || '';
    article.dataset.gender = normalizeGender(gender);
    article.dataset.birthday = normalizeDateOnly(birthday);
    article.dataset.note = note || '';
    article.dataset.lastLogin = lastLogin || '-';
    article.dataset.createdAt = createdAt || '-';

    article.innerHTML = `
      <div class="worker-main">
        <div class="worker-name-row">
          <span class="worker-name">${escapeHtml(name)}</span>
          <span class="worker-role-pill">${roleLabel}</span>
        </div>
        <div class="worker-email">${escapeHtml(email)}</div>
        <div class="worker-company${farmName ? '' : ' is-empty'}">
          <span class="worker-company-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false"><path d="M4 20h16v-2H4v2zm2-4h3V4H6v12zm5 0h2V8h-2v8zm4 0h3V6h-3v10z"/></svg>
          </span>
          <span class="worker-company-name">${escapeHtml(farmName || '—')}</span>
        </div>
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
    newUserSave.addEventListener('click', async () => {
      const farmName = (newUserFarmName?.value || '').trim();
      const lastName = (newUserLastName?.value || '').trim();
      const firstName = (newUserFirstName?.value || '').trim();
      const name = `${lastName} ${firstName}`.trim();
      const email = (newUserEmail?.value || '').trim();
      const password = String(newUserPassword?.value || '');
      const postalCode = normalizeZipcode(newUserPostalCode?.value || '');
      const address = (newUserAddress?.value || '').trim();
      const gender = normalizeGender(newUserGender?.value);
      const birthday = normalizeDateOnly(newUserBirthday?.value);
      const note = (newUserNote?.value || '').trim();
      const isOwner = isNewUserOwnerMode();
      const ownerId = getSelectedOwnerIdForNewUser();

      if (!lastName || !firstName || !email || !password) {
        alert('姓、名、メールアドレス、パスワードを入力してください。');
        return;
      }
      if (!isValidPassword(password)) {
        alert('パスワードは8文字以上20文字以下の半角英数字で入力してください。記号は !.-=_#@<> が使用できます。');
        return;
      }
      if (!postalCode || postalCode.length !== 7 || !address || !gender || !birthday) {
        alert('郵便番号、住所、性別、生年月日を入力してください。');
        return;
      }
      if (!isOwner && !ownerId) {
        alert('所属オーナーを選択してください。');
        return;
      }

      const input = {
        parentID: isOwner ? null : Number(ownerId),
        roleID: isOwner ? 2 : 4,
        email,
        password,
        farmName,
        firstName,
        lastName,
        postalCode,
        address,
        gender,
        birthday,
        note,
        fieldIDs: isOwner ? [] : newSelectedFields.map((f) => String(f.id)),
      };

      const oldDisabled = newUserSave.disabled;
      newUserSave.disabled = true;
      try {
        await createUserMutation(input);
        await preloadOwnerOptions();
        await initializeUserListFromGraphQL();
        closeNewUserModal();
        alert('登録しました。');
      } catch (err) {
        console.error('Failed to create user:', err);
        alert(`登録に失敗しました。
${err.message || err}`);
      } finally {
        newUserSave.disabled = oldDisabled;
      }
    });
  }

  // ---------- Detail Modal ----------
  const detailBackdrop = qs('#user-detail-modal-backdrop');
  const detailClose = qs('#user-detail-modal-close');

  const detailUserId = qs('#detail-user-id');
  const detailUserFarmName = qs('#detail-user-farm-name');
  const detailUserLastName = qs('#detail-user-last-name');
  const detailUserFirstName = qs('#detail-user-first-name');
  const detailUserEmail = qs('#detail-user-email');
  const detailUserPassword = qs('#detail-user-password');
  const detailUserPostalCode = qs('#detail-user-postal-code');
  const detailUserAddress = qs('#detail-user-address');
  const detailUserGender = qs('#detail-user-gender');
  const detailUserBirthday = qs('#detail-user-birthday');
  const detailUserNote = qs('#detail-user-note');
  const detailUserOwner = qs('#detail-user-owner');

  bindBirthdayPickerGuard(detailUserBirthday);
  bindZipcodeAutoFill(detailUserPostalCode, detailUserAddress);
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
  let detailFieldOptions = [];
  let originalSnapshot = null;

  function renderDetailFieldChips() {
    renderChips(detailFieldChips, detailSelectedFields, (i) => {
      detailSelectedFields.splice(i, 1);
      renderDetailFieldChips();
    });
  }

  async function updateDetailFieldOptions() {
    const isOwner = !!detailUserOwner?.checked;
    const ownerId = originalSnapshot?.ownerId || String(detailOwnerSelect?.value || '').trim();
    const canEditFields = !isOwner;
    if (detailFieldSelect) detailFieldSelect.disabled = !canEditFields;
    if (detailFieldAdd) detailFieldAdd.disabled = !canEditFields;
    if (!canEditFields) {
      detailFieldOptions = [];
      fillObjectSelectOptions(detailFieldSelect, [], '圃場を選択');
      return;
    }
    if (!ownerId) {
      detailFieldOptions = [];
      fillObjectSelectOptions(detailFieldSelect, [], '先に所属オーナーを選択');
      return;
    }
    try {
      detailFieldOptions = await fetchFieldsForOwner(ownerId);
    } catch (err) {
      console.error('Failed to load detail fields for owner:', err);
      detailFieldOptions = [];
    }
    const validIds = new Set(detailFieldOptions.map((f) => String(f.id)));
    detailSelectedFields = detailSelectedFields.filter((f) => !f?.id || validIds.has(String(f.id)));
    fillObjectSelectOptions(detailFieldSelect, detailFieldOptions, detailFieldOptions.length ? '圃場を選択' : '選択できる圃場がありません');
    renderDetailFieldChips();
  }

  function syncDetailSelects() {
    fillObjectSelectOptions(detailOwnerSelect, ownerOptions, 'オーナーを選択');
  }

  function getOwnerOptionById(ownerId) {
    const id = String(ownerId || '').trim();
    if (!id) return null;
    return ownerOptions.find((u) => String(u?.id || '').trim() === id) || null;
  }

  function updateDetailRoleUI() {
    const isOwner = !!detailUserOwner?.checked;
    const farmGroup = qs('#detail-user-farm-name-group');
    const passwordGroup = qs('#detail-user-password-group');
    const isEditing = btnSave && btnSave.style.display !== 'none';
    if (farmGroup) farmGroup.style.display = isOwner ? '' : 'none';
    if (passwordGroup) passwordGroup.style.display = isEditing ? '' : 'none';
    if (detailOwnerWrapper) detailOwnerWrapper.style.display = isOwner ? 'none' : '';
    if (detailOwnerSelect) detailOwnerSelect.disabled = true;
    const selector = qs('#detail-field-selector');
    if (selector) selector.style.display = (!isOwner && isEditing) ? '' : 'none';
  }

  function setDetailEditMode(isEdit) {
    const disabled = !isEdit;
    [detailUserFarmName, detailUserLastName, detailUserFirstName, detailUserEmail, detailUserPostalCode, detailUserAddress, detailUserGender, detailUserBirthday, detailUserNote, detailLastLogin, detailCreatedAt]
      .forEach(el => { if (!el) return; el.disabled = disabled; });
    if (detailUserPassword) detailUserPassword.disabled = disabled;
    if (detailOwnerSelect) detailOwnerSelect.disabled = true;

    if (detailLastLogin) detailLastLogin.disabled = true;
    if (detailCreatedAt) detailCreatedAt.disabled = true;

    if (btnEdit) btnEdit.style.display = isEdit ? 'none' : '';
    if (btnSave) btnSave.style.display = isEdit ? '' : 'none';
    if (btnCancel) btnCancel.style.display = isEdit ? '' : 'none';
    if (btnDelete) btnDelete.style.display = isEdit ? '' : 'none';

    if (detailUserOwner) detailUserOwner.disabled = true;
    updateDetailRoleUI();
  }

  async function openDetail(card) {
    activeCard = card;
    if (!activeCard) return;

    syncDetailSelects();

    const data = activeCard.dataset;
    originalSnapshot = {
      userId: data.userId || '',
      farmName: data.farmName || '',
      name: data.name || '',
      lastName: data.lastName || '',
      firstName: data.firstName || '',
      email: data.email || '',
      owner: data.owner || 'いいえ',
      ownerId: data.ownerId || '',
      ownerName: data.ownerName || '',
      fields: (() => {
        const names = String(data.fields || '').split(',').map(s => s.trim()).filter(Boolean);
        const ids = String(data.fieldIds || '').split(',').map(s => s.trim());
        return names.map((name, idx) => ({ id: ids[idx] || '', name })).filter((f) => f.name);
      })(),
      postalCode: data.postalCode || '',
      address: data.address || '',
      gender: normalizeGender(data.gender || ''),
      birthday: normalizeDateOnly(data.birthday || ''),
      note: data.note || '',
      lastLogin: data.lastLogin || '-',
      createdAt: data.createdAt || '-'
    };

    if (detailUserId) detailUserId.textContent = originalSnapshot.userId;
    if (detailUserFarmName) detailUserFarmName.value = originalSnapshot.farmName;
    if (detailUserLastName) detailUserLastName.value = originalSnapshot.lastName;
    if (detailUserFirstName) detailUserFirstName.value = originalSnapshot.firstName;
    if (detailUserPassword) detailUserPassword.value = '';
    if (detailUserEmail) detailUserEmail.value = originalSnapshot.email;
    if (detailUserPostalCode) detailUserPostalCode.value = originalSnapshot.postalCode;
    if (detailUserAddress) detailUserAddress.value = originalSnapshot.address;
    if (detailUserGender) detailUserGender.value = originalSnapshot.gender;
    if (detailUserBirthday) detailUserBirthday.value = originalSnapshot.birthday;
    if (detailUserNote) detailUserNote.value = originalSnapshot.note;
    if (detailUserOwner) detailUserOwner.checked = originalSnapshot.owner === 'はい';
    detailSelectedFields = originalSnapshot.fields.slice();
    renderDetailFieldChips();
    if (detailLastLogin) detailLastLogin.value = originalSnapshot.lastLogin;
    if (detailCreatedAt) detailCreatedAt.value = originalSnapshot.createdAt;

    // owner select
    if (detailOwnerSelect) {
      const ownerId = originalSnapshot.ownerId || '';
      const ownerName = originalSnapshot.ownerName || '';

      detailOwnerSelect.value = ownerId;

      if (!detailOwnerSelect.value && ownerId) {
        const ownerOpt = getOwnerOptionById(ownerId);

        if (ownerOpt) {
          detailOwnerSelect.innerHTML = `<option value="${escapeHtml(ownerOpt.id)}">${escapeHtml(ownerOpt.name)}</option>`;
          detailOwnerSelect.value = ownerOpt.id;
        } else if (ownerName) {
          detailOwnerSelect.innerHTML = `<option value="${escapeHtml(ownerId)}">${escapeHtml(ownerName)}</option>`;
          detailOwnerSelect.value = ownerId;
        }
      }
    }
    await updateDetailFieldOptions();
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
    void openDetail(card);
  });

  if (detailUserOwner) {
    detailUserOwner.addEventListener('change', () => {
      updateDetailRoleUI();
    });
  }

  if (detailFieldAdd) {
    detailFieldAdd.addEventListener('click', () => {
      const selectedId = String(detailFieldSelect?.value || '').trim();
      if (!selectedId) return;
      const field = detailFieldOptions.find((f) => String(f.id) === selectedId);
      if (!field) return;
      if (!detailSelectedFields.some((f) => String((typeof f === 'string' ? '' : f?.id) || '') === String(field.id))) {
        detailSelectedFields.push(field);
        renderDetailFieldChips();
      }
      if (detailFieldSelect) detailFieldSelect.value = '';
    });
  }

  if (btnEdit) {
    btnEdit.addEventListener('click', async () => {
      setDetailEditMode(true);
      await updateDetailFieldOptions();
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      if (!originalSnapshot) return;
      if (detailUserFarmName) detailUserFarmName.value = originalSnapshot.farmName;
      if (detailUserLastName) detailUserLastName.value = originalSnapshot.lastName;
      if (detailUserFirstName) detailUserFirstName.value = originalSnapshot.firstName;
      if (detailUserPassword) detailUserPassword.value = '';
      if (detailUserEmail) detailUserEmail.value = originalSnapshot.email;
      if (detailUserPostalCode) detailUserPostalCode.value = originalSnapshot.postalCode;
      if (detailUserAddress) detailUserAddress.value = originalSnapshot.address;
      if (detailUserGender) detailUserGender.value = originalSnapshot.gender;
      if (detailUserBirthday) detailUserBirthday.value = originalSnapshot.birthday;
      if (detailUserNote) detailUserNote.value = originalSnapshot.note;
      if (detailUserOwner) detailUserOwner.checked = originalSnapshot.owner === 'はい';
      if (detailOwnerSelect) detailOwnerSelect.value = originalSnapshot.ownerId || '';
      detailSelectedFields = originalSnapshot.fields.slice();
      renderDetailFieldChips();
      updateDetailRoleUI();
      updateDetailFieldOptions();
      setDetailEditMode(false);
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      if (!activeCard) return;

      const farmName = (detailUserFarmName?.value || '').trim();
      const lastName = (detailUserLastName?.value || '').trim();
      const firstName = (detailUserFirstName?.value || '').trim();
      const name = `${lastName} ${firstName}`.trim();
      const email = (detailUserEmail?.value || '').trim();
      const password = String(detailUserPassword?.value || '');
      if (!lastName || !firstName || !email) {
        alert('姓、名、メールアドレスを入力してください。');
        return;
      }
      if (password && !isValidPassword(password)) {
        alert('パスワードは8文字以上20文字以下の半角英数字で入力してください。記号は !.-=_#@<> が使用できます。');
        return;
      }

      const isOwner = !!detailUserOwner?.checked;
      const ownerId = originalSnapshot?.ownerId || String(detailOwnerSelect?.value || '').trim();
      const postalCode = normalizeZipcode(detailUserPostalCode?.value || '');
      const address = (detailUserAddress?.value || '').trim();
      const gender = normalizeGender(detailUserGender?.value);
      const birthday = normalizeDateOnly(detailUserBirthday?.value);
      const note = (detailUserNote?.value || '').trim();

      const input = {
        email,
        firstName,
        lastName,
      };
      if (isOwner) input.farmName = farmName;
      if (password) input.password = password;
      if (postalCode) input.postalCode = postalCode;
      if (address) input.address = address;
      if (gender) input.gender = gender;
      if (birthday) input.birthday = birthday;
      if (note) input.note = note;

      const oldDisabled = btnSave.disabled;
      btnSave.disabled = true;
      try {
        const updatedUser = await updateUserMutation(activeCard.dataset.userId, input);
        const updatedFarmName = isOwner
          ? String(updatedUser?.farmName || farmName || '').trim()
          : farmName;
        const updatedLastName = String(updatedUser?.lastName || lastName || '').trim();
        const updatedFirstName = String(updatedUser?.firstName || firstName || '').trim();
        const updatedName = `${updatedLastName} ${updatedFirstName}`.trim();
        const updatedEmail = String(updatedUser?.email || email || '').trim();
        const updatedPostalCode = String(updatedUser?.postalCode || postalCode || '').trim();
        const updatedAddress = String(updatedUser?.address || address || '').trim();
        const updatedGender = normalizeGender(updatedUser?.gender || gender);
        const updatedBirthday = normalizeDateOnly(updatedUser?.birthday || birthday);
        const updatedNote = String(updatedUser?.note || note || '').trim();

        // update dataset
        activeCard.dataset.farmName = updatedFarmName;
        activeCard.dataset.name = updatedName;
        activeCard.dataset.lastName = updatedLastName;
        activeCard.dataset.firstName = updatedFirstName;
        activeCard.dataset.email = updatedEmail;
        activeCard.dataset.owner = isOwner ? 'はい' : 'いいえ';
        activeCard.dataset.ownerId = isOwner ? '' : ownerId;
        activeCard.dataset.fields = detailSelectedFields.map((f) => typeof f === 'string' ? f : (f?.name || '')).filter(Boolean).join(',');
        activeCard.dataset.fieldIds = detailSelectedFields.map((f) => typeof f === 'string' ? '' : (f?.id || '')).join(',');
        activeCard.dataset.postalCode = updatedPostalCode;
        activeCard.dataset.address = updatedAddress;
        activeCard.dataset.gender = updatedGender;
        activeCard.dataset.birthday = updatedBirthday;
        activeCard.dataset.note = updatedNote;

        // update visible UI
        const nameEl = qs('.worker-name', activeCard);
        const emailEl = qs('.worker-email', activeCard);
        const farmNameEl = qs('.worker-company-name', activeCard);
        const farmWrapEl = qs('.worker-company', activeCard);
        const rolePill = qs('.worker-role-pill', activeCard);
        const fieldsWrap = qs('.worker-fields', activeCard);

        if (nameEl) nameEl.textContent = updatedName;
        if (emailEl) emailEl.textContent = updatedEmail;
        if (farmNameEl) farmNameEl.textContent = isOwner ? (updatedFarmName || '—') : '—';
        if (farmWrapEl) farmWrapEl.classList.toggle('is-empty', !(isOwner && updatedFarmName));
        if (farmWrapEl) farmWrapEl.style.display = isOwner ? '' : 'none';
        if (rolePill) rolePill.textContent = isOwner ? 'OWNER' : 'WORKER';
        if (fieldsWrap) {
          fieldsWrap.innerHTML = detailSelectedFields.map(f => `<span class="worker-field-chip">${escapeHtml(typeof f === 'string' ? f : (f?.name || ''))}</span>`).join('');
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

        originalSnapshot = {
          userId: activeCard.dataset.userId || '',
          farmName: updatedFarmName,
          name: updatedName,
          lastName: updatedLastName,
          firstName: updatedFirstName,
          email: updatedEmail,
          owner: isOwner ? 'はい' : 'いいえ',
          ownerId: isOwner ? '' : ownerId,
          fields: detailSelectedFields.slice(),
          postalCode: updatedPostalCode,
          address: updatedAddress,
          gender: updatedGender,
          birthday: updatedBirthday,
          note: updatedNote,
          lastLogin: activeCard.dataset.lastLogin || '-',
          createdAt: activeCard.dataset.createdAt || '-'
        };

        // refresh search/pagination
        applyUserSearch();
        setDetailEditMode(false);
        if (detailUserPassword) detailUserPassword.value = '';
        alert('保存しました。');
      } catch (err) {
        console.error('Failed to update user:', err);
        alert(`保存に失敗しました。
${err.message || err}`);
      } finally {
        btnSave.disabled = oldDisabled;
      }
    });
  }

  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (!activeCard) return;
      const targetId = String(activeCard.dataset.userId || '').trim();
      if (!targetId) {
        alert('削除対象のユーザーIDを取得できませんでした。');
        return;
      }
      if (!confirm('このユーザーを削除しますか？')) return;

      const oldDisabled = btnDelete.disabled;
      btnDelete.disabled = true;
      try {
        await deleteUserMutation(targetId);
        activeCard.remove();
        closeDetail();
        filteredCards = getAllCards();
        applyUserSearch();
        updateUserCount(filteredCards.length);
        syncNewUserSelects();
        syncDetailSelects();
        alert('削除しました。');
      } catch (err) {
        console.error('Failed to delete user:', err);
        alert(`削除に失敗しました。
${err.message || err}`);
      } finally {
        btnDelete.disabled = oldDisabled;
      }
    });
  }

  // ESC close support
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (newUserModalBackdrop?.classList.contains('open')) closeNewUserModal();
    if (detailBackdrop?.classList.contains('open')) closeDetail();
  });

  // initial
  preloadOwnerOptions().finally(() => {
    initializeUserListFromGraphQL();
  });
});
