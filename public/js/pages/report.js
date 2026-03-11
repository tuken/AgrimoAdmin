// 日報一覧ページ（report_list.ejs）
// - 新UI: #reports-list / .reports-grid / data-*属性のカード
// - 旧UI: GraphQLで取得して #report-list に描画（互換用）

document.addEventListener('DOMContentLoaded', async () => {
  const pageRoot = document.querySelector('#reports-list');
  const legacyRoot = document.querySelector('#report-list');

  // 新UIが無い場合は、旧UIとして動かす
  if (!pageRoot && legacyRoot) {
    await initLegacy(legacyRoot);
    return;
  }

  if (!pageRoot) return;

  const calDaysRoot = document.querySelector('#calendar-days');
  const grid = pageRoot.querySelector('.reports-grid');

  const emptyMessage = pageRoot.querySelector('#empty-message');
  const headerTitle = document.querySelector('#list-header-title');
  const headerMeta = document.querySelector('#list-header-meta');

  const searchInput = document.querySelector('#report-search');
  const searchClear = document.querySelector('#report-search-clear');
  const ownerFilter = document.querySelector('#owner-filter');
  const fieldFilter = document.querySelector('#field-filter');
  const isRole1 = !!ownerFilter;
  const currentUserId = String(pageRoot?.dataset?.userId || '').trim();
  const taskFilter = document.querySelector('#task-filter');

  const btnPrevMonth = document.querySelector('#prev-month');
  const btnNextMonth = document.querySelector('#next-month');
  const btnCurrentMonth = document.querySelector('#current-month-button');
  const monthLabel = document.querySelector('#current-month-label');
  const filterAllBtn = document.querySelector('#filter-all');
  const ymPicker = document.querySelector('#year-month-picker');
  const yearSelect = document.querySelector('#year-select');
  const monthSelect = document.querySelector('#month-select');
  const applyYm = document.querySelector('#apply-year-month');

  const pagePrev = document.querySelector('#page-prev');
  const pageNext = document.querySelector('#page-next');
  const pageInfo = document.querySelector('#page-info');
  const pagination = document.querySelector('#pagination');

  if (isRole1) {
    try {
      await initializeRole1Filters({ ownerFilter, fieldFilter });
    } catch (e) {
      console.error('[report] role1 filters init failed:', e);
    }
  } else {
    await refreshCurrentUserFieldOptions({ updateFilter: true });
  }

  async function refreshCurrentUserFieldOptions(options) {
    const opts = options || {};
    if (isRole1) return [];

    try {
      const fields = collectFieldOptionsFromDom();

      if (opts.updateFilter) {
        populateFieldFilterOptions(fieldFilter, fields);
      }

      refreshFieldSelectOptions(document.querySelector('#new-field'), fields, {
        preserveValue: true,
        singleSelectAutoPick: true,
      });

      refreshFieldSelectOptions(document.querySelector('#edit-field'), fields, {
        preserveValue: true,
      });

      refreshFieldSelectOptions(document.querySelector('#detail-field'), fields, {
        preserveValue: true,
      });

      return fields;
    } catch (err) {
      console.error('[report] refreshCurrentUserFieldOptions failed:', err);
      return [];
    }
  }


  if (!isRole1 && fieldFilter) {
    fieldFilter.addEventListener('focus', function () {
      refreshCurrentUserFieldOptions({ updateFilter: true });
    });
    fieldFilter.addEventListener('click', function () {
      refreshCurrentUserFieldOptions({ updateFilter: true });
    });
  }

  // --------------------
  // データソースの確保（DOMカード -> 無ければGraphQLで簡易カード生成）
  // --------------------
  let cards = grid ? Array.from(grid.querySelectorAll('[data-report]')) : [];

  async function reloadReportsForView() {
    if (!grid) return;
    try {
      const reportsLoading = document.querySelector('#reports-loading');
      if (reportsLoading) reportsLoading.style.display = 'block';

      const reports = await fetchReports(pageRoot, state.viewYear, state.viewMonth);
      grid.innerHTML = reports.map(toReportCardHtml).join('');
      cards = Array.from(grid.querySelectorAll('[data-report]'));
    } catch (e) {
      console.error('日報一覧の取得に失敗しました:', e);
      grid.innerHTML = '';
      cards = [];
    } finally {
      const reportsLoading = document.querySelector('#reports-loading');
      if (reportsLoading) reportsLoading.style.display = 'none';
    }
  }

  // --------------------
  // モーダル（登録 / 詳細 / 編集）
  // --------------------
  const btnNew = document.querySelector('#new-report-button');

  const createModal = document.querySelector('#new-modal-backdrop');
  const detailModal = document.querySelector('#detail-modal-backdrop');
  const editModal = document.querySelector('#edit-modal-backdrop');
  const imageViewerModal = document.querySelector('#image-viewer-backdrop');
  const imageViewerImage = document.querySelector('#image-viewer-image');

  const createForm = document.querySelector('#report-create-form');
  const editForm = document.querySelector('#report-edit-form');
  const createSaveBtn = document.querySelector('#new-save');
  const editSaveBtn = document.querySelector('#edit-save');
  const editDeleteBtn = document.querySelector('#edit-delete');

  const createMsg = document.querySelector('#new-message');
  const editMsg = document.querySelector('#edit-message');

  // NOTE: role_id により「編集」ボタン自体が描画されない場合がある
  const detailEditBtn = document.querySelector('#detail-edit');

  function todayDateOnly() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function clampDateInputValue(input) {
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

  function bindDatePickerGuard(input) {
    if (!input) return;
    input.min = input.min || '1900-01-01';
    input.max = input.max || todayDateOnly();
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('inputmode', 'none');

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
    input.addEventListener('change', () => clampDateInputValue(input));
    input.addEventListener('blur', () => clampDateInputValue(input));
  }

  let selectedCard = null;

  wireModal(createModal);
  wireModal(detailModal);
  wireModal(editModal);

  bindDatePickerGuard(document.querySelector('#new-date'));
  bindDatePickerGuard(document.querySelector('#edit-date'));
  wireCropVarietyDynamic(createForm);
  wireCropVarietyDynamic(editForm);
  wireImagePreview({ formEl: createForm, fileInputSelector: '#new-image-file', imageSelector: '#new-image', wrapperSelector: '#new-image-wrapper', placeholderSelector: '#new-image-placeholder' });
  wireImagePreview({ formEl: editForm, fileInputSelector: '#edit-image-file', imageSelector: '#edit-image', wrapperSelector: '#edit-image-wrapper', placeholderSelector: '#edit-image-placeholder' });
  wireModal(imageViewerModal);

  const detailImage = document.querySelector('#detail-image');
  const detailImageWrapper = detailImage ? detailImage.closest('.detail-image-wrapper') : null;

  function openDetailImageViewer() {
    if (!detailImage || !imageViewerModal || !imageViewerImage) return;
    const src = String(detailImage.dataset.fullSrc || detailImage.getAttribute('src') || '').trim();
    if (!src || src === '/img/agri-login-bg.png') return;
    imageViewerImage.src = src;
    imageViewerImage.alt = detailImage.alt || '作業画像';
    openModal(imageViewerModal);
  }

  if (detailImageWrapper) {
    detailImageWrapper.addEventListener('click', function () {
      openDetailImageViewer();
    });
  }
  if (detailImage) {
    detailImage.addEventListener('click', function (e) {
      e.stopPropagation();
      openDetailImageViewer();
    });
  }

  // ESCで閉じる
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    [createModal, detailModal, editModal, imageViewerModal].forEach(function (m) {
      if (m && m.classList.contains('open')) closeModal(m);
    });
  });

  function setMessage(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'form-help ' + (type ? ('is-' + type) : '');
  }

  function currentSelectedDateOrToday(state) {
    if (state && state.selectedDate) return state.selectedDate;
    return formatDate(new Date());
  }

  // --------------------
  // 状態
  // --------------------
  const now = new Date();
  const state = {
    viewYear: now.getFullYear(),
    viewMonth: now.getMonth(), // 0-index
    selectedDate: null, // 'YYYY-MM-DD'
    search: '',
    owner: '',
    field: '',
    task: '',
    page: 1,
    pageSize: 8,
  };

  const urlParams = new URLSearchParams(window.location.search || '');
  const requestedOpenReportId = String(urlParams.get('openReportId') || '').trim();
  const requestedOpenReportDate = String(urlParams.get('openReportDate') || '').trim();
  let hasAutoOpenedRequestedReport = false;

  if (/^\d{4}-\d{2}-\d{2}/.test(requestedOpenReportDate)) {
    state.viewYear = Number(requestedOpenReportDate.slice(0, 4));
    state.viewMonth = Number(requestedOpenReportDate.slice(5, 7)) - 1;
    state.selectedDate = requestedOpenReportDate.slice(0, 10);
  }

  // 年月ピッカー初期化（カードから範囲推定）
  const years = extractYears(cards, state.viewYear);
  if (yearSelect) {
    yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}年</option>`).join('');
    yearSelect.value = String(state.viewYear);
  }
  if (monthSelect) monthSelect.value = String(state.viewMonth);

  await reloadReportsForView();

  // --------------------
  // 再描画
  // --------------------
  function rerender({ resetPage = true } = {}) {
    if (resetPage) state.page = 1;
    renderCalendar(calDaysRoot, state, cards, () => rerender({ resetPage: true }));
    applyFiltersAndPagination({
      cards,
      state,
      emptyMessage,
      headerTitle,
      headerMeta,
      pagination,
      pagePrev,
      pageNext,
      pageInfo,
    });
    syncControls({ state, searchInput, ownerFilter, fieldFilter, taskFilter, monthLabel, yearSelect, monthSelect, filterAllBtn, btnCurrentMonth });
  }

  function tryAutoOpenRequestedReport() {
    if (hasAutoOpenedRequestedReport || !requestedOpenReportId || !detailModal) return;
    const card = cards.find((node) => {
      if (!node || !node.dataset) return false;
      const id = String(node.dataset.reportId || node.dataset.id || '').trim();
      return id === requestedOpenReportId;
    });
    if (!card) return;
    selectedCard = card;
    const data = readCardData(card);
    fillDetailModal(data);
    openModal(detailModal);
    hasAutoOpenedRequestedReport = true;
  }

  // --------------------
  // UIイベント
  // --------------------
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.search = searchInput.value.trim();
      rerender();
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      state.search = '';
      rerender();
    });
  }
  if (ownerFilter) {
    ownerFilter.addEventListener('change', async () => {
      state.owner = ownerFilter.value;
      if (isRole1) {
        await refreshFieldFilterByOwner({ ownerFilter, fieldFilter, selectedOwnerId: state.owner });
        state.field = '';
      }
      rerender();
    });
  }
  if (fieldFilter) {
    fieldFilter.addEventListener('change', () => {
      state.field = fieldFilter.value;
      rerender();
    });
  }
  if (taskFilter) {
    taskFilter.addEventListener('change', () => {
      state.task = taskFilter.value;
      rerender();
    });
  }

  if (btnPrevMonth) {
    btnPrevMonth.addEventListener('click', async () => {
      const d = new Date(state.viewYear, state.viewMonth - 1, 1);
      state.viewYear = d.getFullYear();
      state.viewMonth = d.getMonth();
      state.selectedDate = null;
      await reloadReportsForView();
      rerender({ resetPage: false });
      tryAutoOpenRequestedReport();
    });
  }
  if (btnNextMonth) {
    btnNextMonth.addEventListener('click', async () => {
      const d = new Date(state.viewYear, state.viewMonth + 1, 1);
      state.viewYear = d.getFullYear();
      state.viewMonth = d.getMonth();
      state.selectedDate = null;
      await reloadReportsForView();
      rerender({ resetPage: false });
      tryAutoOpenRequestedReport();
    });
  }
  if (btnCurrentMonth) {
    btnCurrentMonth.addEventListener('click', async () => {
      const today = new Date();
      state.viewYear = today.getFullYear();
      state.viewMonth = today.getMonth();
      state.selectedDate = null;
      await reloadReportsForView();
      rerender({ resetPage: false });
      tryAutoOpenRequestedReport();
    });
  }

  // 年月ピッカー
  if (monthLabel && ymPicker) {
    monthLabel.addEventListener('click', () => {
      ymPicker.hidden = !ymPicker.hidden;
    });
  }
  if (applyYm) {
    applyYm.addEventListener('click', async () => {
      const y = Number(yearSelect?.value ?? state.viewYear);
      const m = Number(monthSelect?.value ?? state.viewMonth);
      if (Number.isFinite(y) && Number.isFinite(m)) {
        state.viewYear = y;
        state.viewMonth = m;
      }
      state.selectedDate = null;
      await reloadReportsForView();
      if (ymPicker) ymPicker.hidden = true;
      rerender({ resetPage: false });
    });
  }
  document.addEventListener('click', (e) => {
    if (!ymPicker || ymPicker.hidden) return;
    const t = e.target;
    if (ymPicker.contains(t) || monthLabel?.contains(t)) return;
    ymPicker.hidden = true;
  });

  if (filterAllBtn) {
    filterAllBtn.addEventListener('click', () => {
      state.selectedDate = null;
      rerender();
    });
  }

  if (pagePrev) {
    pagePrev.addEventListener('click', () => {
      state.page = Math.max(1, state.page - 1);
      rerender({ resetPage: false });
    });
  }
  if (pageNext) {
    pageNext.addEventListener('click', () => {
      state.page += 1;
      rerender({ resetPage: false });
    });
  }



  // --------------------
  // モーダル：イベント
  // --------------------
  if (btnNew && createModal && createForm) {
    btnNew.addEventListener('click', async function () {
      await refreshCurrentUserFieldOptions({ updateFilter: false });
      createForm.reset();
      setMessage(createMsg, '', '');
      const d = currentSelectedDateOrToday(state);
      const dateInput = createForm.querySelector('#new-date');
      if (dateInput) dateInput.value = d;
      syncCropVarietySelect(createForm, '', { id: '', name: '' });
      resetImagePreview({ imageSelector: '#new-image', wrapperSelector: '#new-image-wrapper', placeholderSelector: '#new-image-placeholder' });
      openModal(createModal);
    });
  }

  if (createSaveBtn && createForm) {
    createSaveBtn.addEventListener('click', function () {
      if (typeof createForm.requestSubmit === 'function') createForm.requestSubmit();
      else createForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });
  }

  if (editSaveBtn && editForm) {
    editSaveBtn.addEventListener('click', function () {
      if (typeof editForm.requestSubmit === 'function') editForm.requestSubmit();
      else editForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });
  }

  // カードクリックで詳細
  if (grid && detailModal) {
    grid.addEventListener('click', async function (e) {
      const card = e.target && e.target.closest ? e.target.closest('[data-report]') : null;
      if (!card) return;
      await refreshCurrentUserFieldOptions({ updateFilter: false });
      selectedCard = card;
      const data = readCardData(card);
      fillDetailModal(data);
      openModal(detailModal);
    });
  }

  // 詳細→編集
  if (detailEditBtn && editModal && editForm) {
    detailEditBtn.addEventListener('click', async function () {
      if (!selectedCard) return;
      await refreshCurrentUserFieldOptions({ updateFilter: false });
      const data = readCardData(selectedCard);
      fillEditForm(data);
      closeModal(detailModal);
      openModal(editModal);
    });
  }

  // 新規登録
  if (createForm) {
    createForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      setMessage(createMsg, '', '');
      if (createSaveBtn) createSaveBtn.disabled = true;

      try {
        const fd = new FormData(createForm);
        const data = normalizeFormData(fd, createForm);
        const errorMessage = validateCreateWorkReportData(data);
        if (errorMessage) {
          setMessage(createMsg, errorMessage, 'error');
          return;
        }

        const created = await createWorkReportViaGraphQL(createForm, data);
        const merged = mergeCreatedReportIntoCardData(data, created);

        const el = buildReportCardElement(merged);
        if (merged.id) {
          el.dataset.reportId = merged.id;
          el.dataset.id = merged.id;
        }
        if (grid) grid.prepend(el);

        // cards配列更新
        cards = grid ? Array.from(grid.querySelectorAll('[data-report]')) : cards;

        // 選択日を登録日へ寄せる（UX）
        state.selectedDate = merged.date;
        state.viewYear = parseInt(merged.date.slice(0, 4), 10);
        state.viewMonth = parseInt(merged.date.slice(5, 7), 10) - 1;

        closeModal(createModal);
        createForm.reset();
        syncCropVarietySelect(createForm, '', { id: '', name: '' });
        resetImagePreview({ imageSelector: '#new-image', wrapperSelector: '#new-image-wrapper', placeholderSelector: '#new-image-placeholder' });
        rerender({ resetPage: true });
      } catch (err) {
        console.error('[report] createWorkReport failed:', err);
        setMessage(createMsg, err.message || '日報の登録に失敗しました', 'error');
      } finally {
        if (createSaveBtn) createSaveBtn.disabled = false;
      }
    });
  }

  // 編集保存
  if (editForm) {
    editForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      setMessage(editMsg, '', '');

      if (!selectedCard) {
        setMessage(editMsg, '対象の日報が見つかりません', 'error');
        return;
      }

      if (editSaveBtn) editSaveBtn.disabled = true;

      try {
        const fd = new FormData(editForm);
        const data = normalizeFormData(fd, editForm);
        data.id = String(qs('#edit-target-id', editForm)?.value || readCardData(selectedCard)?.id || '').trim();

        const errorMessage = validateUpdateWorkReportData(data);
        if (errorMessage) {
          setMessage(editMsg, errorMessage, 'error');
          return;
        }

        const updated = await updateWorkReportViaGraphQL(editForm, data);
        const merged = mergeUpdatedReportIntoCardData(data, updated, readCardData(selectedCard));

        applyCardUpdate(selectedCard, merged);
        cards = grid ? Array.from(grid.querySelectorAll('[data-report]')) : cards;

        closeModal(editModal);
        rerender({ resetPage: false });
      } catch (err) {
        console.error('[report] updateWorkReport failed:', err);
        setMessage(editMsg, err.message || '日報の更新に失敗しました', 'error');
      } finally {
        if (editSaveBtn) editSaveBtn.disabled = false;
      }
    });
  }

  // 編集削除
  if (editDeleteBtn) {
    editDeleteBtn.addEventListener('click', async function () {
      const current = selectedCard ? readCardData(selectedCard) : null;
      const targetId = String(qs('#edit-target-id', editForm)?.value || current?.id || '').trim();
      if (!targetId) {
        setMessage(editMsg, '対象の日報が見つかりません', 'error');
        return;
      }

      const ok = window.confirm('この日報を削除します。よろしいですか？');
      if (!ok) return;

      editDeleteBtn.disabled = true;
      if (editSaveBtn) editSaveBtn.disabled = true;
      setMessage(editMsg, '', '');

      try {
        await deleteWorkReportViaGraphQL(targetId);

        if (selectedCard && selectedCard.parentNode) {
          selectedCard.parentNode.removeChild(selectedCard);
        }
        cards = grid ? Array.from(grid.querySelectorAll('[data-report]')) : cards;
        selectedCard = null;

        closeModal(editModal);
        closeModal(detailModal);
        rerender({ resetPage: false });
      } catch (err) {
        console.error('[report] deleteWorkReport failed:', err);
        setMessage(editMsg, err.message || '日報の削除に失敗しました', 'error');
      } finally {
        editDeleteBtn.disabled = false;
        if (editSaveBtn) editSaveBtn.disabled = false;
      }
    });
  }

  // 初期描画
  rerender({ resetPage: false });
  tryAutoOpenRequestedReport();
});

// --------------------
// 新UI: モーダル helpers
// --------------------
function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }


function resetImagePreview({ imageSelector, wrapperSelector, placeholderSelector }) {
  const img = qs(imageSelector);
  const wrapper = qs(wrapperSelector);
  const placeholder = qs(placeholderSelector);
  if (img) {
    img.removeAttribute('src');
    img.hidden = true;
  }
  if (placeholder) placeholder.hidden = false;
  if (wrapper) wrapper.classList.add('is-empty');
}

function wireImagePreview({ formEl, fileInputSelector, imageSelector, wrapperSelector, placeholderSelector }) {
  if (!formEl) return;
  const fileInput = qs(fileInputSelector);
  const img = qs(imageSelector);
  const wrapper = qs(wrapperSelector);
  const placeholder = qs(placeholderSelector);
  if (!fileInput || !img || !wrapper || fileInput.dataset.previewWired === '1') return;
  fileInput.dataset.previewWired = '1';

  const applyEmpty = function () {
    img.removeAttribute('src');
    img.hidden = true;
    if (placeholder) placeholder.hidden = false;
    wrapper.classList.add('is-empty');
  };

  const applyFile = function (file) {
    if (!file) {
      applyEmpty();
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      img.src = e.target?.result || '';
      img.hidden = false;
      if (placeholder) placeholder.hidden = true;
      wrapper.classList.remove('is-empty');
    };
    reader.onerror = applyEmpty;
    reader.readAsDataURL(file);
  };

  fileInput.addEventListener('change', function () {
    applyFile(fileInput.files && fileInput.files[0]);
  });

  formEl.addEventListener('reset', function () {
    setTimeout(applyEmpty, 0);
  });

  applyEmpty();
}

function openModal(backdrop) {
  if (!backdrop) return;
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('modal-open');
}

function closeModal(backdrop) {
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('modal-open');
}

function wireModal(backdrop) {
  if (!backdrop) return;
  qsa('[data-modal-close]', backdrop).forEach(function (el) {
    el.addEventListener('click', function () { closeModal(backdrop); });
  });
  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop) closeModal(backdrop);
  });
}

function getSelectedText(selectEl) {
  if (!selectEl) return '';
  const opt = selectEl.options?.[selectEl.selectedIndex];
  return (opt && opt.textContent) ? opt.textContent.trim() : '';
}

function normalizeSelectToken(value) {
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFKC');
}

function setSelectByText(selectEl, text) {
  if (!selectEl || !text) return false;
  const want = normalizeSelectToken(text);
  const opts = Array.from(selectEl.options || []);
  const idx = opts.findIndex(o => normalizeSelectToken(o.textContent || '') === want);
  if (idx >= 0) {
    selectEl.selectedIndex = idx;
    selectEl.value = opts[idx].value;
    return true;
  }
  return false;
}

function setSelectValueOrText(selectEl, value, text) {
  if (!selectEl) return false;
  const wantValue = normalizeSelectToken(value);
  const opts = Array.from(selectEl.options || []);

  if (wantValue) {
    const idx = opts.findIndex(o => normalizeSelectToken(o.value) === wantValue);
    if (idx >= 0) {
      selectEl.selectedIndex = idx;
      selectEl.value = opts[idx].value;
      return true;
    }
  }

  return setSelectByText(selectEl, text);
}

function normalizeFormData(fd, formEl) {
  const date = (fd.get('date') || '').toString().trim();

  const taskId = (fd.get('task') || '').toString().trim();
  const taskName = getSelectedText(formEl?.querySelector('[name="task"]')) || taskId;

  const ownerId = (fd.get('owner_id') || '').toString().trim();
  const owner = (formEl?.querySelector('#new-owner')?.value || formEl?.querySelector('#edit-owner')?.value || '').toString().trim() || ownerId;

  const fieldId = (fd.get('field_id') || fd.get('field') || '').toString().trim();
  const fieldName = getSelectedText(formEl?.querySelector('[name="field_id"]')) || (fd.get('field') || '').toString().trim();

  const memo = ((
    qs('#new-note-text', formEl)?.value ||
    qs('#edit-note-text', formEl)?.value ||
    document.getElementById('new-note-text')?.value ||
    document.getElementById('edit-note-text')?.value ||
    fd.get('memo') ||
    ''
  ) + '').trim();
  const hours = (fd.get('hours') || '').toString().trim();
  const title = memo ? memo.split(/\r?\n/)[0].trim().slice(0, 60) : '';

  const cropItemId = (fd.get('crop_item_id') || '').toString().trim();
  const cropItemName = getSelectedText(formEl?.querySelector('[name="crop_item_id"]')) || '';
  const cropVarietyId = (fd.get('crop_variety_id') || '').toString().trim();
  const cropVarietyName = getSelectedText(formEl?.querySelector('[name="crop_variety_id"]')) || '';
  const weatherCode = (fd.get('weather') || '').toString().trim();
  const weatherName = getSelectedText(formEl?.querySelector('[name="weather"]')) || '';

  const modalRoot = formEl?.closest('.modal') || document;
  const previewImg = qs('#new-image', modalRoot) || qs('#edit-image', modalRoot);
  const imageUrl = previewImg && !previewImg.hidden ? (previewImg.getAttribute('src') || '') : '';

  const time = hours ? `${hours}h` : '';
  const text = [taskName, cropItemName, cropVarietyName, title, fieldName, owner, memo, weatherName].filter(Boolean).join(' ');

  return {
    date,
    task: taskName,
    taskId,
    owner,
    ownerId,
    field: fieldName,
    fieldId,
    title,
    time,
    hours,
    memo,
    cropItemId,
    cropItemName,
    cropVarietyId,
    cropVarietyName,
    weatherCode,
    weatherName,
    imageUrl,
    text
  };
}

function readCardData(card) {
  const ds = card ? card.dataset : {};
  const date = ds.date || '';
  const task = ds.task || '';
  const owner = ds.owner || '';
  const ownerId = ds.ownerId || '';
  const field = ds.field || '';
  const fieldId = ds.fieldId || '';
  const title = ds.title || qs('.report-title', card)?.textContent?.trim() || '';
  const memo = ds.memo || '';
  const cropItemId = ds.cropItemId || '';
  const cropItemName = ds.cropItemName || '';
  const cropVarietyId = ds.cropVarietyId || '';
  const cropVarietyName = ds.cropVarietyName || '';
  const weatherCode = ds.weatherCode || '';
  const weatherName = ds.weatherName || '';
  const hours = ds.hours || '';
  const imageUrl = ds.imageUrl || '';
  const updatedAt = ds.updatedAt || '';
  const time = ds.time || (hours ? `${hours}h` : '');
  const text = ds.text || [task, cropItemName, cropVarietyName, title, field, owner, memo, weatherName].filter(Boolean).join(' ');
  const id = ds.reportId || ds.id || '';
  return { id, date, task, owner, ownerId, field, fieldId, title, memo, time, hours, text, cropItemId, cropItemName, cropVarietyId, cropVarietyName, weatherCode, weatherName, imageUrl, updatedAt };
}

function fillDetailModal(data) {
  const detailDate = qs('#detail-date');
  const detailTask = qs('#detail-task');
  const detailCropItem = qs('#detail-crop-item');
  const detailCropVariety = qs('#detail-crop-variety');
  const detailOwner = qs('#detail-owner');
  const detailField = qs('#detail-field');
  const detailWeather = qs('#detail-weather');
  const detailHours = qs('#detail-time-hours');
  const detailUpdatedAt = qs('#detail-updated-at');
  const detailNote = qs('#detail-note-text');
  const detailImage = qs('#detail-image');
  const detailMetaFooter = qs('#detail-meta-footer');

  if (detailDate) detailDate.value = data.date || '';
  if (detailTask) {
    detailTask.value = '';
    setSelectByText(detailTask, data.task || '');
  }
  if (detailCropItem) {
    setSelectValueOrText(detailCropItem, data.cropItemId || '', data.cropItemName || '');
  }
  if (detailCropVariety) detailCropVariety.value = data.cropVarietyName || '';
  if (detailOwner) detailOwner.value = data.owner || '';
  if (detailField) {
    detailField.value = data.fieldId || '';
    if (!detailField.value && data.field) setSelectByText(detailField, data.field);
  }
  if (detailWeather) {
    detailWeather.value = data.weatherCode || '';
    if (!detailWeather.value && data.weatherName) setSelectByText(detailWeather, data.weatherName);
  }
  if (detailHours) detailHours.value = data.hours || '';
  if (detailUpdatedAt) detailUpdatedAt.value = data.updatedAt || '—';
  if (detailNote) detailNote.value = data.memo || '';
  setDetailImageState(data.imageUrl);
  if (detailMetaFooter) {
    const parts = [formatDateJa(data.date) || '', data.field || '', data.owner || ''].filter(Boolean);
    detailMetaFooter.textContent = parts.join(' ／ ');
  }
}


async function fetchCropVarieties(itemID) {
  const id = String(itemID || '').trim();
  if (!id) return [];
  try {
    const res = await fetch(`/api/crop-varieties?itemID=${encodeURIComponent(id)}`, {
      headers: { 'accept': 'application/json' },
      credentials: 'same-origin'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !Array.isArray(json?.items)) return [];
    return json.items;
  } catch (e) {
    console.error('[report] fetchCropVarieties failed:', e);
    return [];
  }
}

function fillCropVarietyOptions(selectEl, items, selectedValue, selectedText) {
  if (!selectEl) return;
  const list = Array.isArray(items) ? items : [];
  const currentValue = String(selectedValue || '').trim();
  const currentText = String(selectedText || '').trim();

  selectEl.innerHTML = '';

  if (!list.length) {
    selectEl.disabled = true;
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = currentValue || currentText ? '該当する品種がありません' : '作付品目を選択してください';
    selectEl.appendChild(opt);
    return;
  }

  selectEl.disabled = false;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '選択してください';
  selectEl.appendChild(placeholder);

  list.forEach(function (item) {
    const opt = document.createElement('option');
    opt.value = item?.id != null ? String(item.id) : '';
    opt.textContent = (item?.name || '').toString();
    selectEl.appendChild(opt);
  });

  if (currentValue) {
    selectEl.value = currentValue;
  }
  if (!selectEl.value && currentText) {
    setSelectByText(selectEl, currentText);
  }
}

async function syncCropVarietySelect(formEl, itemID, selectedVariety) {
  if (!formEl) return;
  const varietySel = qs('[name="crop_variety_id"]', formEl);
  if (!varietySel) return;

  const id = String(itemID || '').trim();
  if (!id) {
    fillCropVarietyOptions(varietySel, [], '', '');
    return;
  }

  const items = await fetchCropVarieties(id);
  fillCropVarietyOptions(varietySel, items, selectedVariety?.id, selectedVariety?.name);
}

function wireCropVarietyDynamic(formEl) {
  if (!formEl) return;
  const itemSel = qs('[name="crop_item_id"]', formEl);
  if (!itemSel || itemSel.dataset.cropVarietyWired === '1') return;
  itemSel.dataset.cropVarietyWired = '1';
  itemSel.addEventListener('change', function () {
    syncCropVarietySelect(formEl, itemSel.value, { id: '', name: '' });
  });
}

async function fillEditForm(data) {
  const editForm = qs('#report-edit-form');
  if (!editForm) return;

  const dateInput = qs('#edit-date', editForm);
  if (dateInput) dateInput.value = data.date || '';

  const taskSel = qs('#edit-task', editForm);
  if (taskSel) {
    taskSel.value = data.taskId || '';
    if (!taskSel.value && data.task) setSelectByText(taskSel, data.task);
  }

  const cropItemSel = qs('#edit-crop-item', editForm);
  if (cropItemSel) {
    setSelectValueOrText(cropItemSel, data.cropItemId || '', data.cropItemName || '');
    await syncCropVarietySelect(editForm, cropItemSel.value, { id: data.cropVarietyId || '', name: data.cropVarietyName || '' });
  }

  const ownerInput = qs('#edit-owner', editForm);
  if (ownerInput) ownerInput.value = data.owner || '';
  const ownerIdHidden = qs('#edit-owner-id', editForm);
  if (ownerIdHidden) ownerIdHidden.value = data.ownerId || ownerIdHidden.value || '';

  const fieldSel = qs('#edit-field', editForm);
  if (fieldSel) {
    fieldSel.value = data.fieldId || '';
    if (!fieldSel.value && data.field) setSelectByText(fieldSel, data.field);
  }

  const weatherSel = qs('#edit-weather', editForm);
  if (weatherSel) {
    weatherSel.value = data.weatherCode || '';
    if (!weatherSel.value && data.weatherName) setSelectByText(weatherSel, data.weatherName);
  }

  const hoursInput = qs('#edit-time-hours', editForm);
  if (hoursInput) hoursInput.value = data.hours || '';

  const noteInput = qs('#edit-note-text');
  if (noteInput) noteInput.value = data.memo || '';

  const hidden = qs('#edit-target-id', editForm);
  if (hidden) hidden.value = data.id || '';

  const img = qs('#edit-image');
  const wrapper = qs('#edit-image-wrapper');
  const placeholder = qs('#edit-image-placeholder');
  if (img && data.imageUrl) {
    img.src = data.imageUrl;
    img.hidden = false;
    if (placeholder) placeholder.hidden = true;
    if (wrapper) wrapper.classList.remove('is-empty');
  } else {
    resetImagePreview({ imageSelector: '#edit-image', wrapperSelector: '#edit-image-wrapper', placeholderSelector: '#edit-image-placeholder' });
  }
}

function buildReportThumbMarkup(imageUrl, altText) {
  const src = String(imageUrl || '').trim();
  if (src) {
    return {
      empty: false,
      html: `<img src="${escapeHtml(src)}" alt="${escapeHtml(altText || '作業画像')}">`,
    };
  }
  return {
    empty: true,
    html: `
      <div class="report-thumb-placeholder" aria-label="画像未登録">
        <div class="report-thumb-placeholder-icon">🌾</div>
        <div class="report-thumb-placeholder-text">画像なし</div>
      </div>
    `,
  };
}

function setDetailImageState(imageUrl) {
  const detailImage = qs('#detail-image');
  if (!detailImage) return;
  const wrapper = detailImage.closest('.detail-image-wrapper');
  const placeholder = qs('#detail-image-placeholder');
  const fullSrc = String(imageUrl || '').trim();
  const hasImage = !!fullSrc;

  if (hasImage) {
    detailImage.src = fullSrc;
    detailImage.hidden = false;
    detailImage.dataset.fullSrc = fullSrc;
    detailImage.style.cursor = 'zoom-in';
    if (placeholder) placeholder.hidden = true;
  } else {
    detailImage.removeAttribute('src');
    detailImage.hidden = true;
    detailImage.dataset.fullSrc = '';
    detailImage.style.cursor = 'default';
    if (placeholder) placeholder.hidden = false;
  }

  if (wrapper) {
    wrapper.classList.toggle('is-empty', !hasImage);
    wrapper.classList.toggle('is-clickable', hasImage);
    wrapper.setAttribute('title', hasImage ? 'クリックで拡大表示' : '');
  }
}

function buildReportCardElement(data) {
  const el = document.createElement('article');
  el.className = 'report-card';
  el.setAttribute('data-report', '');
  if (data.id) {
    el.dataset.reportId = data.id;
    el.dataset.id = data.id;
  }
  el.dataset.date = data.date;
  el.dataset.task = data.task;
  el.dataset.taskId = data.taskId || '';
  el.dataset.owner = data.owner;
  el.dataset.ownerId = data.ownerId || '';
  el.dataset.field = data.field;
  el.dataset.fieldId = data.fieldId || '';
  el.dataset.title = data.title || '';
  el.dataset.memo = data.memo || '';
  el.dataset.time = data.time || '';
  el.dataset.hours = data.hours || '';
  el.dataset.cropItemId = data.cropItemId || '';
  el.dataset.cropItemName = data.cropItemName || '';
  el.dataset.cropVarietyId = data.cropVarietyId || '';
  el.dataset.cropVarietyName = data.cropVarietyName || '';
  el.dataset.weatherCode = data.weatherCode || '';
  el.dataset.weatherName = data.weatherName || '';
  el.dataset.imageUrl = data.imageUrl || '';
  el.dataset.updatedAt = formatUpdatedNow();
  el.dataset.text = data.text || '';

  const meta = toJaMetaLine(data.date, data.field, data.owner);
  const title = data.title || defaultTitleForTask(data.task, data.field);
  const tag = data.task ? `<span class="report-tag">${escapeHtml(data.task)}</span>` : '';
  const hoursBadge = buildHoursBadge(data.hours);
  const weatherBadge = escapeHtml(buildWeatherBadge(data.weatherCode, data.weatherName));
  const thumb = buildReportThumbMarkup(data.imageUrl, `${data.task || '作業'}の様子`);

  el.innerHTML = `
    <div class="report-thumb${thumb.empty ? ' is-empty' : ''}">${thumb.html}</div>
    <div class="report-content">
      <div class="report-meta">${escapeHtml(meta)}</div>
      <div class="report-title">${escapeHtml(title)}</div>
      <div class="report-tags">${tag || '<span class="report-tag">—</span>'}</div>
      <div class="report-footer">
        <div class="report-footer-left">
          <span class="badge-weather">${weatherBadge}</span>
        </div>
        <div class="report-footer-right">
          <span class="badge-time">${hoursBadge}</span>
          <span class="badge-updated">最終更新：${escapeHtml(el.dataset.updatedAt)}</span>
        </div>
      </div>
    </div>
  `;
  return el;
}

function applyCardUpdate(card, data) {
  if (!card) return;
  card.dataset.date = data.date;
  card.dataset.task = data.task;
  card.dataset.taskId = data.taskId || '';
  card.dataset.owner = data.owner;
  card.dataset.ownerId = data.ownerId || '';
  card.dataset.field = data.field;
  card.dataset.fieldId = data.fieldId || '';
  card.dataset.title = data.title || '';
  card.dataset.memo = data.memo || '';
  card.dataset.time = data.time || '';
  card.dataset.hours = data.hours || '';
  card.dataset.cropItemId = data.cropItemId || '';
  card.dataset.cropItemName = data.cropItemName || '';
  card.dataset.cropVarietyId = data.cropVarietyId || '';
  card.dataset.cropVarietyName = data.cropVarietyName || '';
  card.dataset.weatherCode = data.weatherCode || '';
  card.dataset.weatherName = data.weatherName || '';
  card.dataset.imageUrl = data.imageUrl || '';
  card.dataset.updatedAt = formatUpdatedNow();
  card.dataset.text = data.text || '';

  const meta = toJaMetaLine(data.date, data.field, data.owner);
  const title = data.title || defaultTitleForTask(data.task, data.field);
  const metaEl = qs('.report-meta', card);
  const titleEl = qs('.report-title', card);
  const tagsEl = qs('.report-tags', card);
  const timeEl = qs('.badge-time', card);
  const updEl = qs('.badge-updated', card);
  const weatherEl = qs('.badge-weather', card);
  const thumbEl = qs('.report-thumb', card);

  if (metaEl) metaEl.textContent = meta;
  if (titleEl) titleEl.textContent = title;
  if (tagsEl) tagsEl.innerHTML = data.task ? `<span class="report-tag">${escapeHtml(data.task)}</span>` : '<span class="report-tag">—</span>';
  if (timeEl) timeEl.textContent = buildHoursBadge(data.hours);
  if (weatherEl) weatherEl.textContent = buildWeatherBadge(data.weatherCode, data.weatherName);
  if (updEl) updEl.textContent = `最終更新：${card.dataset.updatedAt}`;
  if (thumbEl) thumbEl.innerHTML = data.imageUrl ? `<img src="${escapeHtml(data.imageUrl)}" alt="${escapeHtml(data.task || '作業')}の様子">` : '';
}

function toJaMetaLine(dateKey, field, owner) {
  // dateKey: YYYY-MM-DD
  if (!dateKey) return `${field || '—'}／${owner || '—'}`;
  const parts = dateKey.split('-').map(n => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return `${dateKey}・${field || '—'}／${owner || '—'}`;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const w = ['日','月','火','水','木','金','土'][d.getDay()];
  const ymd = `${parts[0]}/${String(parts[1]).padStart(2,'0')}/${String(parts[2]).padStart(2,'0')}（${w}）`;
  return `${ymd}・${field || '—'}／${owner || '—'}`;
}

function defaultTitleForTask(task, field) {
  if (!task) return '作業日報';
  const f = field ? `（${field}）` : '';
  if (task === '灌水') return `灌水作業${f}`;
  if (task === '施肥') return `施肥作業${f}`;
  if (task === '収穫') return `収穫作業${f}`;
  if (task === '除草') return `除草作業${f}`;
  if (task.indexOf('防除') === 0) return `防除作業${f}`;
  return `${task}作業${f}`;
}

function formatUpdatedNow() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}



async function initLegacy(listRoot) {
  const calRoot = document.querySelector('#calendar-days');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const reports = await fetchReports(listRoot);
  renderLegacyCalendar(calRoot, year, month, reports);
  renderLegacyReportList(listRoot, reports);
}

async function fetchReports(listRoot, viewYear, viewMonth) {
  const y = Number.isFinite(Number(viewYear)) ? Number(viewYear) : new Date().getFullYear();
  const m = Number.isFinite(Number(viewMonth)) ? Number(viewMonth) : new Date().getMonth();
  const startDate = formatDate(new Date(y, m, 1));
  const endDate = formatDate(new Date(y, m + 1, 0));

  const queries = [
    `
      query FindWorkReports($startDate: Date!, $endDate: Date!) {
        findWorkReports(startDate: $startDate, endDate: $endDate) {
          id
          workDate
          workHours
          workDetail
          imageURL
          user {
            id
            firstName
            lastName
            email
          }
          field {
            id
            name
          }
          workType {
            id
            name
          }
          cropVariety {
            id
            name
            cropItem {
              id
              name
            }
          }
          weather {
            code
            japanese
          }
        }
      }
    `,
    `
      query FindWorkReports($startDate: Date!, $endDate: Date!) {
        findWorkReports(startDate: $startDate, endDate: $endDate) {
          id
          workDate
          workHours
          workDetail
          imageURL
          user {
            id
            firstName
            lastName
            email
          }
          field {
            id
            name
          }
          workType {
            id
            name
          }
          cropVariety {
            id
            name
          }
          weather {
            code
            japanese
          }
        }
      }
    `
  ];

  const variables = {
    startDate,
    endDate,
  };

  let lastError = null;
  for (const q of queries) {
    const result = await window.gql(q, variables);
    const reports = Array.isArray(result.data?.findWorkReports)
      ? result.data.findWorkReports
      : [];

    if (!result.errors) {
      return await enrichReportsWithCropItem(reports);
    }

    if (reports.length) {
      console.warn('[report] fetchReports using partial data with GraphQL warnings:', result.errors);
      return await enrichReportsWithCropItem(reports);
    }

    lastError = result.errors[0]?.message || 'GraphQL error';
    console.warn('[report] fetchReports retry with fallback query:', result.errors);
  }

  throw new Error(lastError || 'GraphQL error');
}

let cropVarietyToItemMapPromise = null;

async function enrichReportsWithCropItem(reports) {
  const list = Array.isArray(reports) ? reports : [];
  const needsEnrich = list.some(function (r) {
    return r?.cropVariety?.id && !r?.cropVariety?.cropItem && !r?.cropItem;
  });
  if (!needsEnrich) return list;

  try {
    const map = await getCropVarietyToItemMap();
    if (!(map instanceof Map) || !map.size) return list;

    return list.map(function (r) {
      if (!r?.cropVariety?.id) return r;
      if (r?.cropVariety?.cropItem || r?.cropItem) return r;

      const key = String(r.cropVariety.id);
      const cropItem = map.get(key);
      if (!cropItem) return r;

      return {
        ...r,
        cropVariety: {
          ...r.cropVariety,
          cropItem: {
            id: cropItem.id,
            name: cropItem.name,
          },
        },
      };
    });
  } catch (e) {
    console.warn('[report] enrichReportsWithCropItem failed:', e);
    return list;
  }
}

function getCropItemIdsFromDom() {
  const selectors = ['#new-crop-item', '#edit-crop-item', '#detail-crop-item'];
  const ids = new Set();

  selectors.forEach(function (selector) {
    const selectEl = document.querySelector(selector);
    if (!selectEl) return;
    Array.from(selectEl.options || []).forEach(function (opt) {
      const v = String(opt?.value || '').trim();
      if (v) ids.add(v);
    });
  });

  return Array.from(ids);
}

async function getCropVarietyToItemMap() {
  if (!cropVarietyToItemMapPromise) {
    cropVarietyToItemMapPromise = (async function () {
      const itemIds = getCropItemIdsFromDom();
      const map = new Map();

      for (const itemID of itemIds) {
        const varieties = await fetchCropVarieties(itemID);
        (Array.isArray(varieties) ? varieties : []).forEach(function (v) {
          const varietyId = String(v?.id || '').trim();
          if (!varietyId) return;
          map.set(varietyId, {
            id: String(itemID),
            name: findCropItemNameInDom(itemID),
          });
        });
      }

      return map;
    })();
  }
  return cropVarietyToItemMapPromise;
}

function findCropItemNameInDom(itemID) {
  const id = String(itemID || '').trim();
  if (!id) return '';

  const selectors = ['#new-crop-item', '#edit-crop-item', '#detail-crop-item'];
  for (const selector of selectors) {
    const selectEl = document.querySelector(selector);
    if (!selectEl) continue;
    const opt = Array.from(selectEl.options || []).find(function (o) {
      return String(o?.value || '').trim() === id;
    });
    if (opt) return String(opt.textContent || '').trim();
  }
  return '';
}


async function initializeRole1Filters({ ownerFilter, fieldFilter }) {
  if (!ownerFilter || !fieldFilter) return;
  const [owners, fields] = await Promise.all([
    fetchOwnersForFilter(),
    fetchFieldsForOwner(''),
  ]);
  const ownerOptions = (Array.isArray(owners) && owners.length)
    ? owners
    : deriveOwnersFromReportCards();
  populateOwnerFilterOptions(ownerFilter, ownerOptions);
  populateFieldFilterOptions(fieldFilter, fields);
}

async function refreshFieldFilterByOwner({ ownerFilter, fieldFilter, selectedOwnerId }) {
  if (!fieldFilter) return;
  const fields = await fetchFieldsForOwner(selectedOwnerId || '');
  populateFieldFilterOptions(fieldFilter, fields);
}

async function fetchOwnersForFilter() {
  const query = `
    query FindUsersForOwnerFilter($roleID: ID!) {
      findUsers(roleID: $roleID) {
        id
        farmName
        firstName
        lastName
        email
      }
    }
  `;
  const result = await window.gql(query, { roleID: '2' });
  if (result?.errors?.length) {
    console.warn('[report] findUsers for owner filter failed:', result.errors);
    return [];
  }
  const list = Array.isArray(result?.data?.findUsers) ? result.data.findUsers : [];
  return list
    .map(function (u) {
      return {
        id: String(u?.id || '').trim(),
        name: String(u?.farmName || '').trim() || [String(u?.lastName || '').trim(), String(u?.firstName || '').trim()].filter(Boolean).join(' ') || String(u?.email || '').trim(),
      };
    })
    .filter(function (u) { return u.id && u.name; })
    .sort(function (a, b) { return a.name.localeCompare(b.name, 'ja'); });
}

function deriveOwnersFromReportCards() {
  const cards = Array.from(document.querySelectorAll('[data-report]'));
  const uniq = new Map();
  cards.forEach(function (card) {
    const id = String(card?.dataset?.ownerId || '').trim();
    const name = String(card?.dataset?.owner || '').trim();
    if (!id || !name || uniq.has(id)) return;
    uniq.set(id, { id, name });
  });
  return Array.from(uniq.values()).sort(function (a, b) {
    return a.name.localeCompare(b.name, 'ja');
  });
}

function collectFieldOptionsFromDom() {
  const selectors = ['#field-filter', '#new-field', '#edit-field', '#detail-field'];
  const uniq = new Map();

  selectors.forEach(function (selector) {
    const selectEl = document.querySelector(selector);
    if (!selectEl) return;

    Array.from(selectEl.options || []).forEach(function (opt) {
      const id = String(opt?.value || '').trim();
      const name = String(opt?.textContent || '').trim();

      if (!id || !name) return;
      if (uniq.has(id)) return;

      uniq.set(id, { id, name });
    });
  });

  return Array.from(uniq.values()).sort(function (a, b) {
    const aNum = Number(a.id);
    const bNum = Number(b.id);

    if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
      return aNum - bNum;
    }
    return a.name.localeCompare(b.name, 'ja');
  });
}

async function fetchFieldsForOwner(ownerId) {
  const normalizedOwnerId = String(ownerId || '').trim();

  // role1 以外は GraphQL ではなく、サーバ描画済みの選択肢をそのまま使う
  const ownerFilter = document.querySelector('#owner-filter');
  const isRole1 = !!ownerFilter;
  if (!isRole1) {
    return collectFieldOptionsFromDom();
  }

  const query = `
    query FindFields($ownerID: ID) {
      findFields(ownerID: $ownerID) {
        id
        name
      }
    }
  `;

  const variables = {};
  if (normalizedOwnerId) variables.ownerID = normalizedOwnerId;

  const result = await window.gql(query, variables);
  if (result?.errors?.length) {
    throw new Error(result.errors[0]?.message || 'Failed to fetch fields');
  }

  const list = Array.isArray(result?.data?.findFields) ? result.data.findFields : [];
  return list
    .map(function (f) {
      return {
        id: String(f?.id || '').trim(),
        name: String(f?.name || '').trim(),
      };
    })
    .filter(function (f) { return f.id && f.name; })
    .sort(function (a, b) { return a.name.localeCompare(b.name, 'ja'); });
}

function populateOwnerFilterOptions(selectEl, owners) {
  if (!selectEl) return;
  const current = String(selectEl.value || '');
  const list = Array.isArray(owners) ? owners : [];
  selectEl.innerHTML = '<option value="">すべてのオーナー</option>' + list.map(function (o) {
    return `<option value="${escapeHtml(o.id)}">${escapeHtml(o.name)}</option>`;
  }).join('');
  if (list.some(function (o) { return o.id === current; })) selectEl.value = current;
}


function refreshFieldSelectOptions(selectEl, fields, options) {
  if (!selectEl) return;
  const opts = options || {};
  const list = Array.isArray(fields) ? fields : [];
  const previousValue = String(selectEl.value || '');
  const placeholderText = selectEl.dataset.placeholder || String(selectEl.options?.[0]?.textContent || '選択してください').trim() || '選択してください';
  const placeholderValue = selectEl.dataset.placeholderValue || String(selectEl.options?.[0]?.value || '');
  selectEl.dataset.placeholder = placeholderText;
  selectEl.dataset.placeholderValue = placeholderValue;
  selectEl.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = placeholderValue;
  placeholder.textContent = placeholderText;
  if (opts.singleSelectAutoPick !== true) placeholder.selected = true;
  selectEl.appendChild(placeholder);

  list.forEach(function (f) {
    const opt = document.createElement('option');
    opt.value = String(f.id);
    opt.textContent = String(f.name || '');
    selectEl.appendChild(opt);
  });

  if (opts.preserveValue && list.some(function (f) { return String(f.id) === previousValue; })) {
    selectEl.value = previousValue;
  } else if (opts.singleSelectAutoPick && list.length === 1) {
    selectEl.value = String(list[0].id);
  } else {
    selectEl.value = placeholderValue;
  }
}

function populateFieldFilterOptions(selectEl, fields) {
  if (!selectEl) return;
  const current = String(selectEl.value || '');
  const list = Array.isArray(fields) ? fields : [];
  selectEl.innerHTML = '<option value="">すべての圃場</option>' + list.map(function (f) {
    return `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`;
  }).join('');
  if (list.some(function (f) { return f.id === current; })) selectEl.value = current;
}

function getSelectedOptionLabel(selectEl, value) {
  if (!selectEl) return '';
  const v = String(value || '');
  const opt = Array.from(selectEl.options || []).find(function (o) {
    return String(o?.value || '') === v;
  });
  return String(opt?.textContent || '').trim();
}


function formatHoursLabel(value) {
  if (value === '' || value == null) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(n).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function getWeatherIcon(code, name) {
  const c = String(code == null ? '' : code).trim();
  const n = String(name || '').trim();
  if (['71','73','75','77','85','86'].includes(c) || /雪/.test(n)) return '❄️';
  if (['95','96','99'].includes(c) || /雷/.test(n)) return '⛈️';
  if (['51','53','55','56','57','61','63','65','66','67','80','81','82'].includes(c) || /雨|にわか/.test(n)) return '🌧️';
  if (['45','48'].includes(c) || /霧|もや/.test(n)) return '🌫️';
  if (['1'].includes(c) || /晴/.test(n)) return '☀️';
  if (['2','3'].includes(c) || /曇|くも/.test(n)) return '☁️';
  return n ? '🌤️' : '—';
}

function buildWeatherBadge(code, name) {
  const label = String(name || '').trim();
  const icon = getWeatherIcon(code, label);
  return label ? `${icon} ${label}` : '—';
}

function buildHoursBadge(value) {
  if (value === '' || value == null) return '⏱ —';
  return `⏱ ${formatHoursLabel(value)}h`;
}



function buildUpdateWorkReportInput(data) {
  const rawHours = String(data.hours == null ? '' : data.hours).trim();
  const parsedHours = rawHours === '' ? 0 : Number(rawHours);
  const workDetail = String(data.memo == null ? '' : data.memo).trim();

  const input = {
    fieldID: String(data.fieldId || '').trim() || null,
    workDate: String(data.date || '').trim() || null,
    workHours: Number.isFinite(parsedHours) ? parsedHours : 0,
    workTypeID: String(data.taskId || '').trim() || null,
    cropVarietyID: String(data.cropVarietyId || '').trim() || null,
    weatherCode: data.weatherCode === '' || data.weatherCode == null ? null : Number(data.weatherCode),
    workDetail,
  };

  return input;
}

function validateUpdateWorkReportData(data) {
  if (!String(data.id || '').trim()) return '対象の日報が見つかりません';
  return validateCreateWorkReportData(data);
}

async function updateWorkReportViaGraphQL(formEl, data) {
  const mutation = `
    mutation UpdateWorkReport($id: ID!, $input: UpdateWorkReportInput!) {
      updateWorkReport(id: $id, input: $input) {
        id
        workDate
        workHours
        workDetail
        imageURL
        field { id name }
        workType { id name }
        cropVariety {
          id
          name
          cropItem { id name }
        }
        weather { code japanese }
        user {
          id
          firstName
          lastName
          email
        }
      }
    }
  `;

  const id = String(data.id || '').trim();
  const input = buildUpdateWorkReportInput(data);
  const fileInput = qs('#edit-image-file', formEl);
  const file = fileInput?.files?.[0] || null;

  let result;
  if (file) {
    input.image = null;
    result = await window.gqlMultipart(mutation, { id, input }, { 'input.image': file });
  } else {
    result = await window.gql(mutation, { id, input });
  }

  if (result?.errors?.length) {
    throw new Error(result.errors[0]?.message || '日報の更新に失敗しました');
  }

  return result?.data?.updateWorkReport || null;
}

async function deleteWorkReportViaGraphQL(id) {
  const mutation = `
    mutation DeleteWorkReport($id: ID!) {
      deleteWorkReport(id: $id) {
        id
      }
    }
  `;

  const result = await window.gql(mutation, { id: String(id || '').trim() });
  if (result?.errors?.length) {
    throw new Error(result.errors[0]?.message || '日報の削除に失敗しました');
  }
  return result?.data?.deleteWorkReport || null;
}

function mergeUpdatedReportIntoCardData(data, updated, previous) {
  const report = updated || {};
  const prev = previous || {};
  const ownerName = [String(report?.user?.lastName || '').trim(), String(report?.user?.firstName || '').trim()].filter(Boolean).join(' ') || String(prev.owner || data.owner || '');
  const ownerId = String(report?.user?.id || prev.ownerId || data.ownerId || '');
  const cropItemId = String(report?.cropVariety?.cropItem?.id || data.cropItemId || prev.cropItemId || '');
  const cropItemName = String(report?.cropVariety?.cropItem?.name || data.cropItemName || prev.cropItemName || '');
  const cropVarietyName = String(report?.cropVariety?.name || data.cropVarietyName || prev.cropVarietyName || '');
  const fieldName = String(report?.field?.name || data.field || prev.field || '');
  const taskName = String(report?.workType?.name || data.task || prev.task || '');
  const memo = String(report?.workDetail || data.memo || prev.memo || '');
  const weatherName = String(report?.weather?.japanese || data.weatherName || prev.weatherName || '');

  return {
    ...prev,
    ...data,
    id: String(report?.id || data.id || prev.id || ''),
    date: String(report?.workDate || data.date || prev.date || ''),
    hours: report?.workHours != null ? String(report.workHours) : String(data.hours || prev.hours || ''),
    time: report?.workHours != null ? `${report.workHours}h` : (data.time || prev.time || ''),
    memo,
    imageUrl: String(report?.imageURL || data.imageUrl || prev.imageUrl || ''),
    taskId: String(report?.workType?.id || data.taskId || prev.taskId || ''),
    task: taskName,
    fieldId: String(report?.field?.id || data.fieldId || prev.fieldId || ''),
    field: fieldName,
    owner: ownerName,
    ownerId,
    cropItemId,
    cropItemName,
    cropVarietyId: String(report?.cropVariety?.id || data.cropVarietyId || prev.cropVarietyId || ''),
    cropVarietyName,
    weatherCode: report?.weather?.code != null ? String(report.weather.code) : String(data.weatherCode || prev.weatherCode || ''),
    weatherName,
    title: String(memo.split(/\r?\n/)[0].trim().slice(0, 60) || data.title || prev.title || ''),
    text: [
      taskName,
      cropItemName,
      cropVarietyName,
      fieldName,
      ownerName,
      memo,
      weatherName,
    ].filter(Boolean).join(' '),
  };
}

function buildCreateWorkReportInput(data) {
  const rawHours = String(data.hours == null ? '' : data.hours).trim();
  const parsedHours = rawHours === '' ? 0 : Number(rawHours);
  const workDetail = String(data.memo == null ? '' : data.memo).trim();

  return {
    fieldID: String(data.fieldId || '').trim(),
    workDate: String(data.date || '').trim(),
    workHours: Number.isFinite(parsedHours) ? parsedHours : 0,
    workTypeID: String(data.taskId || '').trim(),
    cropVarietyID: String(data.cropVarietyId || '').trim(),
    weatherCode: data.weatherCode === '' || data.weatherCode == null ? null : Number(data.weatherCode),
    workDetail,
    image: null,
  };
}

function validateCreateWorkReportData(data) {
  if (!data.date || !data.taskId || !data.fieldId) return '必須項目を入力してください';
  if (!data.cropVarietyId) return '品種を選択してください';
  if (!data.weatherCode) return '天候を選択してください';
  if (data.hours !== '' && (Number.isNaN(Number(data.hours)) || Number(data.hours) < 0)) return '作業時間を正しく入力してください';
  return '';
}

async function createWorkReportViaGraphQL(formEl, data) {
  const mutation = `
    mutation CreateWorkReport($input: CreateWorkReportInput!) {
      createWorkReport(input: $input) {
        id
        workDate
        workHours
        workDetail
        imageURL
        field { id name }
        workType { id name }
        cropVariety { id name }
        weather { code japanese }
      }
    }
  `;

  const input = buildCreateWorkReportInput(data);
  const fileInput = qs('#new-image-file', formEl);
  const file = fileInput?.files?.[0] || null;

  let result;
  if (file) {
    result = await window.gqlMultipart(mutation, { input }, { 'input.image': file });
  } else {
    result = await window.gql(mutation, { input });
  }

  if (result?.errors?.length) {
    throw new Error(result.errors[0]?.message || '日報の登録に失敗しました');
  }

  return result?.data?.createWorkReport || null;
}

function mergeCreatedReportIntoCardData(data, created) {
  const report = created || {};
  return {
    ...data,
    id: String(report?.id || ''),
    date: String(report?.workDate || data.date || ''),
    hours: report?.workHours != null ? String(report.workHours) : String(data.hours || ''),
    time: report?.workHours != null ? `${report.workHours}h` : (data.time || ''),
    memo: String(report?.workDetail || data.memo || ''),
    imageUrl: String(report?.imageURL || data.imageUrl || ''),
    taskId: String(report?.workType?.id || data.taskId || ''),
    task: String(report?.workType?.name || data.task || ''),
    fieldId: String(report?.field?.id || data.fieldId || ''),
    field: String(report?.field?.name || data.field || ''),
    cropVarietyId: String(report?.cropVariety?.id || data.cropVarietyId || ''),
    cropVarietyName: String(report?.cropVariety?.name || data.cropVarietyName || ''),
    weatherCode: report?.weather?.code != null ? String(report.weather.code) : String(data.weatherCode || ''),
    weatherName: String(report?.weather?.japanese || data.weatherName || ''),
    title: String((report?.workDetail || data.memo || '').split(/\r?\n/)[0].trim().slice(0, 60) || data.title || ''),
    text: [
      String(report?.workType?.name || data.task || ''),
      String(data.cropItemName || ''),
      String(report?.cropVariety?.name || data.cropVarietyName || ''),
      String(report?.field?.name || data.field || ''),
      String(data.owner || ''),
      String(report?.workDetail || data.memo || ''),
      String(report?.weather?.japanese || data.weatherName || ''),
    ].filter(Boolean).join(' '),
  };
}

// --------------------
// 新UI: カレンダー
// --------------------
function renderCalendar(root, state, cards, onSelectDate) {
  if (!root) return;

  const year = state.viewYear;
  const month = state.viewMonth;
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay();

  const todayKey = formatDate(new Date());
  const countByDate = countCardsByDate(cards);

  const cells = [];
  for (let i = 0; i < startDow; i++) {
    cells.push('<div class="calendar-day" style="background: rgba(243,244,246,0.7); cursor: default;" aria-hidden="true"></div>');
  }

  for (let d = 1; d <= last.getDate(); d++) {
    const key = formatDate(year, month, d);
    const n = countByDate.get(key) || 0;
    const isSelected = state.selectedDate === key;
    const isToday = key === todayKey;

    cells.push(`
      <div
        class="calendar-day${n ? ' has-reports' : ''}${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}"
        data-cal-date="${key}"
        role="button"
        tabindex="0"
        aria-label="${key}"
      >
        <div class="calendar-day-header">
          <span class="calendar-day-number">${d}</span>
          ${n ? `<span class="calendar-day-badge">${n}件</span>` : ''}
        </div>
      </div>
    `);
  }

  root.innerHTML = cells.join('');

  root.querySelectorAll('[data-cal-date]').forEach(cell => {
    const activate = () => {
      state.selectedDate = cell.getAttribute('data-cal-date');
      onSelectDate?.();
    };
    cell.addEventListener('click', activate);
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
  });
}

// --------------------
// 新UI: フィルタ & ページング
// --------------------
function applyFiltersAndPagination({ cards, state, emptyMessage, headerTitle, headerMeta, pagination, pagePrev, pageNext, pageInfo }) {
  const filtered = cards.filter(c => {
    const d = (c.dataset.date || '').trim();
    const task = (c.dataset.task || '').trim();
    const owner = (c.dataset.owner || '').trim();
    const ownerId = (c.dataset.ownerId || '').trim();
    const field = (c.dataset.field || '').trim();
    const fieldId = (c.dataset.fieldId || '').trim();
    const text = (c.dataset.text || '').toLowerCase();

    if (state.selectedDate && d !== state.selectedDate) return false;
    if (state.task && task !== state.task) return false;
    if (state.owner && ownerId !== state.owner) return false;
    if (state.field && fieldId !== state.field) return false;
    if (state.search) {
      const q = state.search.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => String(b.dataset.date || '').localeCompare(String(a.dataset.date || '')));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  state.page = Math.min(state.page, totalPages);

  const start = (state.page - 1) * state.pageSize;
  const end = start + state.pageSize;
  const pageItems = new Set(filtered.slice(start, end));

  for (const c of cards) c.style.display = pageItems.has(c) ? '' : 'none';

  if (emptyMessage) emptyMessage.style.display = total ? 'none' : '';
  if (pageInfo) pageInfo.textContent = `${state.page} / ${totalPages}`;
  if (pagePrev) pagePrev.disabled = state.page <= 1;
  if (pageNext) pageNext.disabled = state.page >= totalPages;
  if (pagination) pagination.style.display = totalPages > 1 ? '' : 'none';

  if (headerTitle) {
    headerTitle.textContent = state.selectedDate ? `日報一覧（${formatDateJa(state.selectedDate)}）` : '日報一覧（すべて）';
  }
  if (headerMeta) {
    const parts = [];
    if (state.owner) parts.push(`オーナー：${getSelectedOptionLabel(document.querySelector('#owner-filter'), state.owner) || state.owner}`);
    if (state.field) parts.push(`圃場：${getSelectedOptionLabel(document.querySelector('#field-filter'), state.field) || state.field}`);
    if (state.task) parts.push(`作業：${state.task}`);
    if (state.search) parts.push(`検索：「${state.search}」`);
    headerMeta.textContent = parts.length ? `${parts.join(' / ')}（${total}件）` : `今日を含む最近の作業が新しい順に表示されます。（${total}件）`;
  }
}

function syncControls({ state, searchInput, ownerFilter, fieldFilter, taskFilter, monthLabel, yearSelect, monthSelect, filterAllBtn, btnCurrentMonth }) {
  if (searchInput && searchInput.value !== state.search) searchInput.value = state.search;
  if (ownerFilter && ownerFilter.value !== state.owner) ownerFilter.value = state.owner;
  if (fieldFilter && fieldFilter.value !== state.field) fieldFilter.value = state.field;
  if (taskFilter && taskFilter.value !== state.task) taskFilter.value = state.task;

  if (monthLabel) monthLabel.textContent = `${state.viewYear}年 ${state.viewMonth + 1}月`;
  if (yearSelect) yearSelect.value = String(state.viewYear);
  if (monthSelect) monthSelect.value = String(state.viewMonth);
  if (btnCurrentMonth) {
    const today = new Date();
    const isCurrentMonth = state.viewYear === today.getFullYear() && state.viewMonth === today.getMonth();
    btnCurrentMonth.disabled = isCurrentMonth;
    btnCurrentMonth.setAttribute('aria-disabled', isCurrentMonth ? 'true' : 'false');
  }

  if (filterAllBtn) {
    if (state.selectedDate) filterAllBtn.classList.remove('active');
    else filterAllBtn.classList.add('active');
  }
}

// --------------------
// GraphQL -> 新UIの簡易カード
// --------------------
function toReportCardHtml(r) {
  const workDate = r.workDate ?? r.reportDate ?? r.date ?? '';
  const date = escapeHtml(workDate);
  const taskName = r.workType?.name ?? r.reportType ?? r.workType ?? '日報';
  const task = escapeHtml(taskName);
  const taskId = escapeHtml(String(r.workType?.id ?? ''));
  const fieldRawName = r.field?.fieldName ?? r.field?.name ?? '';
  const fieldName = escapeHtml(fieldRawName);
  const fieldId = escapeHtml(String(r.field?.id ?? ''));
  const ownerId = escapeHtml(String(r.user?.id ?? ''));
  const userNameRaw = r.user?.farmName || ((r.user?.firstName || r.user?.lastName)
    ? `${r.user?.lastName ?? ''} ${r.user?.firstName ?? ''}`.trim()
    : (r.user?.email ?? ''));
  const ownerName = escapeHtml(userNameRaw);
  const memoRaw = r.workDetail ?? '';
  const memo = escapeHtml(memoRaw);
  const cropItemRaw = r.cropItem ?? r.cropVariety?.cropItem ?? null;
  const cropItemId = escapeHtml(String(cropItemRaw?.id ?? ''));
  const cropItemNameRaw = cropItemRaw?.name ?? '';
  const cropItemName = escapeHtml(cropItemNameRaw);
  const cropVarietyId = escapeHtml(String(r.cropVariety?.id ?? ''));
  const cropVarietyNameRaw = r.cropVariety?.name ?? '';
  const cropVarietyName = escapeHtml(cropVarietyNameRaw);
  const weatherCode = escapeHtml(String(r.weather?.code ?? ''));
  const weatherNameRaw = r.weather?.japanese ?? '';
  const weatherName = escapeHtml(weatherNameRaw);
  const hoursRaw = r.workHours != null ? String(r.workHours) : '';
  const hours = escapeHtml(hoursRaw);
  const imageUrlRaw = r.imageURL ?? r.imageUrl ?? '';
  const imageUrl = escapeHtml(imageUrlRaw);
  const updatedAtRaw = workDate ? formatDateJa(workDate) : '';
  const updatedAt = escapeHtml(updatedAtRaw || '—');
  const text = escapeHtml([taskName, cropItemNameRaw, cropVarietyNameRaw, fieldRawName, userNameRaw, memoRaw, weatherNameRaw].filter(Boolean).join(' '));
  const title = escapeHtml(memoRaw ? memoRaw.split(/\r?\n/)[0].trim().slice(0, 60) : defaultTitleForTask(taskName, fieldRawName));
  const weatherBadge = escapeHtml(buildWeatherBadge(weatherCode, weatherNameRaw));
  const hoursBadge = buildHoursBadge(hoursRaw);
  const thumb = buildReportThumbMarkup(imageUrlRaw, `${taskName || '作業'}の様子`);

  return `
    <article class="report-card" data-report data-report-id="${escapeHtml(String(r.id ?? ''))}" data-date="${date}" data-task="${task}" data-task-id="${taskId}" data-owner="${ownerName}" data-owner-id="${ownerId}" data-field="${fieldName}" data-field-id="${fieldId}" data-memo="${memo}" data-crop-item-id="${cropItemId}" data-crop-item-name="${cropItemName}" data-crop-variety-id="${cropVarietyId}" data-crop-variety-name="${cropVarietyName}" data-weather-code="${weatherCode}" data-weather-name="${weatherName}" data-hours="${hours}" data-time="${hoursRaw ? `${hoursRaw}h` : ''}" data-image-url="${imageUrl}" data-updated-at="${updatedAt}" data-text="${text}">
      <div class="report-thumb${thumb.empty ? ' is-empty' : ''}">${thumb.html}</div>
      <div class="report-content">
        <div class="report-meta">${escapeHtml(toJaMetaLine(workDate, fieldRawName, userNameRaw))}</div>
        <div class="report-title">${title}</div>
        <div class="report-tags"><span class="report-tag">${task}</span>${cropItemNameRaw ? `<span class="report-tag">${cropItemName}</span>` : ''}${cropVarietyNameRaw ? `<span class="report-tag">${cropVarietyName}</span>` : ''}</div>
        <div class="report-footer">
          <div class="report-footer-left">
            <span class="badge-weather">${weatherBadge}</span>
          </div>
          <div class="report-footer-right">
            <span class="badge-time">${hoursBadge}</span>
            <span class="badge-updated">最終更新：${updatedAt}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

// --------------------
// 旧UI（互換）
// --------------------
function renderLegacyReportList(root, reports) {
  if (!reports.length) {
    root.innerHTML = `<div class="report-item"><div class="report-item-title">日報がありません</div><div class="report-item-meta">データがまだ登録されていない可能性があります。</div></div>`;
    return;
  }

  const sorted = [...reports].sort((a, b) => String(b.reportDate ?? '').localeCompare(String(a.reportDate ?? '')));

  root.innerHTML = sorted.map(r => {
    const fieldName = r.field?.fieldName ?? r.field?.name ?? '';
    const userName = (r.user?.firstName || r.user?.lastName)
      ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim()
      : (r.user?.email ?? '');

    return `
      <article class="report-item">
        <div class="report-item-title">${escapeHtml(r.reportType ?? r.workType ?? '日報')}</div>
        <div class="report-item-meta">日付：${escapeHtml(r.reportDate ?? r.date ?? '')}</div>
        <div class="report-item-meta">圃場：${escapeHtml(fieldName)}</div>
        <div class="report-item-meta">担当：${escapeHtml(userName)}</div>
      </article>
    `;
  }).join('');
}

function renderLegacyCalendar(root, year, month, reports) {
  if (!root) return;

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay();

  const countByDate = new Map();
  for (const r of reports) {
    const key = String(r.reportDate ?? r.date ?? '');
    if (!key) continue;
    countByDate.set(key, (countByDate.get(key) || 0) + 1);
  }

  const cells = [];
  for (let i = 0; i < startDow; i++) {
    cells.push('<div class="calendar-day" style="background: rgba(243,244,246,0.7);"></div>');
  }
  for (let d = 1; d <= last.getDate(); d++) {
    const key = formatDate(year, month, d);
    const n = countByDate.get(key) || 0;
    cells.push(`
      <div class="calendar-day">
        <div>${d}</div>
        ${n ? `<div style="margin-top:6px; font-size:0.68rem; color:#2563eb;">${n}件</div>` : ''}
      </div>
    `);
  }
  root.innerHTML = cells.join('');
}

// --------------------
// Utils
// --------------------
function extractYears(cards, fallbackYear) {
  const years = new Set();
  for (const c of cards) {
    const d = String(c.dataset.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    years.add(Number(d.slice(0, 4)));
  }
  if (!years.size) years.add(fallbackYear);
  const list = Array.from(years).sort((a, b) => a - b);
  const min = Math.min(...list);
  const max = Math.max(...list);
  const padded = [];
  for (let y = min - 1; y <= max + 1; y++) padded.push(y);
  return padded;
}

function countCardsByDate(cards) {
  const m = new Map();
  for (const c of cards) {
    const key = String(c.dataset.date || '').trim();
    if (!key) continue;
    m.set(key, (m.get(key) || 0) + 1);
  }
  return m;
}

function formatDate(dateOrY, m, d) {
  // overload:
  // - formatDate(Date)
  // - formatDate(year, month0Index, day)
  if (dateOrY instanceof Date) {
    const y = dateOrY.getFullYear();
    const mm = String(dateOrY.getMonth() + 1).padStart(2, '0');
    const dd = String(dateOrY.getDate()).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  const y = Number(dateOrY);
  const mm = String(Number(m) + 1).padStart(2, '0');
  const dd = String(Number(d)).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function formatDateJa(iso) {
  return String(iso || '').replaceAll('-', '/');
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
