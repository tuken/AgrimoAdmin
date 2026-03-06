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
  const taskFilter = document.querySelector('#task-filter');

  const btnPrevMonth = document.querySelector('#prev-month');
  const btnNextMonth = document.querySelector('#next-month');
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

  // --------------------
  // データソースの確保（GraphQLから当月分を取得）
  // --------------------
  let cards = [];
  let rerenderCurrentCards = () => {};

  // --------------------
  // モーダル（登録 / 詳細 / 編集）
  // --------------------
  const btnNew = document.querySelector('#new-report-button');

  const createModal = document.querySelector('#new-modal-backdrop');
  const detailModal = document.querySelector('#detail-modal-backdrop');
  const editModal = document.querySelector('#edit-modal-backdrop');

  const createForm = document.querySelector('#report-create-form');
  const editForm = document.querySelector('#report-edit-form');
  const createSaveBtn = document.querySelector('#new-save');
  const editSaveBtn = document.querySelector('#edit-save');

  const createMsg = document.querySelector('#new-message');
  const editMsg = document.querySelector('#edit-message');

  const detailMeta = document.querySelector('#detail-meta');
  const detailTitle = document.querySelector('#detail-title');
  const detailTags = document.querySelector('#detail-tags');
  const detailTime = document.querySelector('#detail-time');
  const detailMemo = document.querySelector('#detail-memo');
  // NOTE: role_id により「編集」ボタン自体が描画されない場合がある
  const detailEditBtn = document.querySelector('#detail-edit');

  let selectedCard = null;

  wireModal(createModal);
  wireModal(detailModal);
  wireModal(editModal);
  wireCropVarietyDynamic(createForm);
  wireCropVarietyDynamic(editForm);
  wireImagePreview({ formEl: createForm, fileInputSelector: '#new-image-file', imageSelector: '#new-image', wrapperSelector: '#new-image-wrapper', placeholderSelector: '#new-image-placeholder' });
  wireImagePreview({ formEl: editForm, fileInputSelector: '#edit-image-file', imageSelector: '#edit-image', wrapperSelector: '#edit-image-wrapper', placeholderSelector: '#edit-image-placeholder' });

  // ESCで閉じる
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    [createModal, detailModal, editModal].forEach(function (m) {
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

  if (monthSelect) monthSelect.value = String(state.viewMonth);

  // --------------------
  // 再描画
  // --------------------
  function rerender({ resetPage = true } = {}) {
    rerenderCurrentCards(resetPage);
  }

  async function fetchAndRender({ resetPage = true } = {}) {
    if (resetPage) state.page = 1;
    try {
      const result = await reloadReports({
        pageRoot,
        grid,
        state,
        emptyMessage,
        headerTitle,
        headerMeta,
        pagination,
        pagePrev,
        pageNext,
        pageInfo,
        filterAllBtn,
        searchInput,
        ownerFilter,
        fieldFilter,
        taskFilter,
        monthLabel,
        yearSelect,
        monthSelect,
        calDaysRoot,
      });
      cards = result.cards;
      rerenderCurrentCards = result.rerenderExternal;
    } catch (e) {
      console.error('日報一覧の取得に失敗しました:', e);
      grid.innerHTML = '';
      cards = [];
      rerenderCurrentCards = () => {
        applyFiltersAndPagination({ cards, state, emptyMessage, headerTitle, headerMeta, pagination, pagePrev, pageNext, pageInfo, ownerFilter, fieldFilter, taskFilter });
        syncControls({ state, searchInput, ownerFilter, fieldFilter, taskFilter, monthLabel, yearSelect, monthSelect, filterAllBtn });
        renderCalendar(calDaysRoot, state, cards, () => rerender({ resetPage: true }));
      };
      rerenderCurrentCards(true);
    }
  }

  await fetchAndRender({ resetPage: true });

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
      state.selectedDate = null;
      await fetchAndRender();
    });
  }
  if (fieldFilter) {
    fieldFilter.addEventListener('change', async () => {
      state.field = fieldFilter.value;
      state.selectedDate = null;
      await fetchAndRender();
    });
  }
  if (taskFilter) {
    taskFilter.addEventListener('change', async () => {
      state.task = taskFilter.value;
      state.selectedDate = null;
      await fetchAndRender();
    });
  }

  if (btnPrevMonth) {
    btnPrevMonth.addEventListener('click', async () => {
      const d = new Date(state.viewYear, state.viewMonth - 1, 1);
      state.viewYear = d.getFullYear();
      state.viewMonth = d.getMonth();
      state.selectedDate = null;
      await fetchAndRender({ resetPage: true });
    });
  }
  if (btnNextMonth) {
    btnNextMonth.addEventListener('click', async () => {
      const d = new Date(state.viewYear, state.viewMonth + 1, 1);
      state.viewYear = d.getFullYear();
      state.viewMonth = d.getMonth();
      state.selectedDate = null;
      await fetchAndRender({ resetPage: true });
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
      if (ymPicker) ymPicker.hidden = true;
      await fetchAndRender({ resetPage: true });
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
    btnNew.addEventListener('click', function () {
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
    grid.addEventListener('click', function (e) {
      const card = e.target && e.target.closest ? e.target.closest('[data-report]') : null;
      if (!card) return;
      selectedCard = card;
      const data = readCardData(card);
      fillDetailModal(data);
      openModal(detailModal);
    });
  }

  // 詳細→編集
  if (detailEditBtn && editModal && editForm) {
    detailEditBtn.addEventListener('click', function () {
      if (!selectedCard) return;
      const data = readCardData(selectedCard);
      fillEditForm(data);
      closeModal(detailModal);
      openModal(editModal);
    });
  }

  // 新規登録
  if (createForm) {
    createForm.addEventListener('submit', function (e) {
      e.preventDefault();
      setMessage(createMsg, '', '');

      const fd = new FormData(createForm);
      const data = normalizeFormData(fd, createForm);

      if (!data.date || !data.task || !data.owner || !data.field) {
        setMessage(createMsg, '必須項目を入力してください', 'error');
        return;
      }

      const el = buildReportCardElement(data);
      if (grid) grid.prepend(el);

      // cards配列更新
      cards = grid ? Array.from(grid.querySelectorAll('[data-report]')) : cards;

      // 選択日を登録日へ寄せる（UX）
      state.selectedDate = data.date;
      state.viewYear = parseInt(data.date.slice(0, 4), 10);
      state.viewMonth = parseInt(data.date.slice(5, 7), 10) - 1;

      closeModal(createModal);
      rerender({ resetPage: true });
    });
  }

  // 編集保存
  if (editForm) {
    editForm.addEventListener('submit', function (e) {
      e.preventDefault();
      setMessage(editMsg, '', '');

      if (!selectedCard) {
        setMessage(editMsg, '対象の日報が見つかりません', 'error');
        return;
      }

      const fd = new FormData(editForm);
      const data = normalizeFormData(fd, editForm);

      if (!data.date || !data.task || !data.owner || !data.field) {
        setMessage(editMsg, '必須項目を入力してください', 'error');
        return;
      }

      applyCardUpdate(selectedCard, data);
      cards = grid ? Array.from(grid.querySelectorAll('[data-report]')) : cards;

      closeModal(editModal);
      rerender({ resetPage: false });
    });
  }

  // 初期描画
  rerender({ resetPage: false });
});

// --------------------
// 新UI: モーダル helpers
// --------------------
function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

function pad2(n) { return String(n).padStart(2, '0'); }

function startOfMonthKey(year, month0) {
  return `${year}-${pad2(month0 + 1)}-01`;
}

function endOfMonthKey(year, month0) {
  return formatDate(new Date(year, month0 + 1, 0));
}

function getSelectedLabel(selectEl) {
  if (!selectEl) return '';
  const opt = selectEl.options?.[selectEl.selectedIndex];
  return (opt?.dataset?.label || opt?.textContent || '').trim();
}

function isNumericLike(value) {
  return /^\d+$/.test(String(value || '').trim());
}

function buildReportQuery() {
  return `
    query FindWorkReports($startDate: Date!, $endDate: Date!, $ownerID: ID, $fieldID: ID, $workTypeID: ID) {
      findWorkReports(startDate: $startDate, endDate: $endDate, ownerID: $ownerID, fieldID: $fieldID, workTypeID: $workTypeID) {
        id
        workDate
        workHours
        workDetail
        imageURL
        user {
          id
          email
          firstName
          lastName
          farmName
        }
        field {
          id
          name
          fieldCode
        }
        workType {
          id
          name
          sortOrder
        }
        cropVariety {
          id
          name
          cropItem { id name }
        }
        weather {
          code
          japanese
        }
      }
    }
  `;
}

function normalizeReport(r) {
  const fieldName = String(r?.field?.name || r?.field?.fieldName || '').trim();
  const fieldId = r?.field?.id != null ? String(r.field.id) : '';
  const wt = r?.workType;
  const taskName = String((wt && typeof wt === 'object') ? (wt.name || '') : (r?.reportType || r?.workType || '')).trim() || '日報';
  const taskId = wt && typeof wt === 'object' && wt.id != null ? String(wt.id) : '';
  const userName = [r?.user?.lastName, r?.user?.firstName].filter(Boolean).join(' ').trim() || String(r?.user?.farmName || r?.user?.email || '').trim();
  const ownerId = r?.user?.id != null ? String(r.user.id) : '';
  const cropVarietyName = String(r?.cropVariety?.name || '').trim();
  const cropVarietyId = r?.cropVariety?.id != null ? String(r.cropVariety.id) : '';
  const cropItemName = String(r?.cropVariety?.cropItem?.name || '').trim();
  const cropItemId = r?.cropVariety?.cropItem?.id != null ? String(r.cropVariety.cropItem.id) : '';
  const weatherName = String(r?.weather?.japanese || '').trim();
  const weatherCode = r?.weather?.code != null ? String(r.weather.code) : '';
  const memo = String(r?.workDetail || '').trim();
  const date = String(r?.workDate || r?.reportDate || r?.date || '').trim();
  const hours = Number(r?.workHours);
  const time = Number.isFinite(hours) && hours > 0 ? `${hours}時間` : '';
  const title = defaultTitleForTask(taskName, fieldName);
  const text = [taskName, fieldName, userName, cropItemName, cropVarietyName, memo, weatherName].filter(Boolean).join(' ');
  return {
    id: r?.id != null ? String(r.id) : '',
    date,
    task: taskName,
    taskId,
    owner: userName,
    ownerId,
    field: fieldName,
    fieldId,
    title,
    memo,
    time,
    cropItemId,
    cropItemName,
    cropVarietyId,
    cropVarietyName,
    weatherCode,
    weatherName,
    imageURL: String(r?.imageURL || '').trim(),
    text,
  };
}

async function reloadReports({ pageRoot, grid, state, emptyMessage, headerTitle, headerMeta, pagination, pagePrev, pageNext, pageInfo, filterAllBtn, searchInput, ownerFilter, fieldFilter, taskFilter, monthLabel, yearSelect, monthSelect, calDaysRoot }) {
  const loadingEl = document.querySelector('#reports-loading');
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    const reports = await fetchReports(pageRoot, state);
    const normalized = reports.map(normalizeReport);
    grid.innerHTML = normalized.map(toReportCardHtml).join('');
    const cards = Array.from(grid.querySelectorAll('[data-report]'));

    const years = extractYears(cards, state.viewYear);
    if (yearSelect) {
      yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}年</option>`).join('');
      yearSelect.value = String(state.viewYear);
    }

    renderCalendar(calDaysRoot, state, cards, () => rerenderExternal(true));
    applyFiltersAndPagination({ cards, state, emptyMessage, headerTitle, headerMeta, pagination, pagePrev, pageNext, pageInfo, ownerFilter, fieldFilter, taskFilter });
    syncControls({ state, searchInput, ownerFilter, fieldFilter, taskFilter, monthLabel, yearSelect, monthSelect, filterAllBtn });

    function rerenderExternal(resetPage) {
      state.page = resetPage ? 1 : state.page;
      applyFiltersAndPagination({ cards, state, emptyMessage, headerTitle, headerMeta, pagination, pagePrev, pageNext, pageInfo, ownerFilter, fieldFilter, taskFilter });
      syncControls({ state, searchInput, ownerFilter, fieldFilter, taskFilter, monthLabel, yearSelect, monthSelect, filterAllBtn });
      renderCalendar(calDaysRoot, state, cards, () => rerenderExternal(true));
    }

    return { cards, rerenderExternal };
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}


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

function setSelectByText(selectEl, text) {
  if (!selectEl || !text) return;
  const want = String(text).trim();
  const opts = Array.from(selectEl.options || []);
  const hit = opts.find(o => (o.textContent || '').trim() === want);
  if (hit) selectEl.value = hit.value;
}

function normalizeFormData(fd, formEl) {
  const date = (fd.get('date') || '').toString().trim();

  // task: keep ID for future API, but show NAME in UI
  const taskId = (fd.get('task') || '').toString().trim();
  const taskName = getSelectedText(formEl?.querySelector('[name="task"]')) || taskId;

  // 担当者: ログインユーザー固定（フォームには hidden の owner_id が入る）
  const ownerId = (fd.get('owner_id') || '').toString().trim();
  // disabled input は FormData に乗らないため、表示名はDOMから取得
  const owner = (formEl?.querySelector('#new-owner')?.value || formEl?.querySelector('#edit-owner')?.value || '').toString().trim() || ownerId;

  // field: keep ID for future API, but show NAME in UI
  const fieldId = (fd.get('field_id') || fd.get('field') || '').toString().trim();
  const fieldName = getSelectedText(formEl?.querySelector('[name="field_id"]')) || (fd.get('field') || '').toString().trim();

  const title = (fd.get('title') || '').toString().trim();
  const timeStart = (fd.get('timeStart') || '').toString().trim();
  const timeEnd = (fd.get('timeEnd') || '').toString().trim();
  const memo = (fd.get('memo') || '').toString().trim();

  // optional masters (kept for future)
  const cropItemId = (fd.get('crop_item_id') || '').toString().trim();
  const cropItemName = getSelectedText(formEl?.querySelector('[name="crop_item_id"]')) || '';
  const cropVarietyId = (fd.get('crop_variety_id') || '').toString().trim();
  const cropVarietyName = getSelectedText(formEl?.querySelector('[name="crop_variety_id"]')) || '';
  const weatherCode = (fd.get('weather') || '').toString().trim();

  const time = (timeStart || timeEnd) ? `${timeStart || '—'}〜${timeEnd || '—'}` : '';
  const text = [taskName, cropItemName, cropVarietyName, title, fieldName, owner, memo].filter(Boolean).join(' ');

  return {
    date,
    task: taskName,
    taskId,
    owner,
    ownerId,
    field: fieldName,
    fieldId,
    title,
    timeStart,
    timeEnd,
    time,
    memo,
    cropItemId,
    cropItemName,
    cropVarietyId,
    cropVarietyName,
    weatherCode,
    text
  };
}

function readCardData(card) {
  const ds = card ? card.dataset : {};
  const date = ds.date || '';
  const task = ds.task || '';
  const owner = ds.owner || '';
  const field = ds.field || '';
  const title = ds.title || qs('.report-title', card)?.textContent?.trim() || '';
  const memo = ds.memo || '';
  const cropItemId = ds.cropItemId || '';
  const cropItemName = ds.cropItemName || '';
  const cropVarietyId = ds.cropVarietyId || '';
  const cropVarietyName = ds.cropVarietyName || '';
  const time = ds.time || qs('.badge-time', card)?.textContent?.replace('🕒', '')?.trim() || '';
  const text = ds.text || [task, cropItemName, cropVarietyName, title, field, owner, memo].filter(Boolean).join(' ');
  const id = ds.reportId || ds.id || '';
  const taskId = ds.taskId || '';
  const fieldId = ds.fieldId || '';
  const ownerId = ds.ownerId || '';
  const weatherCode = ds.weatherCode || '';
  const weatherName = ds.weatherName || '';
  const imageURL = ds.imageUrl || '';
  return { id, date, task, taskId, owner, ownerId, field, fieldId, title, memo, time, text, cropItemId, cropItemName, cropVarietyId, cropVarietyName, weatherCode, weatherName, imageURL };
}

function fillDetailModal(data) {
  const meta = toJaMetaLine(data.date, data.field, data.owner);
  const tagsHtml = [
    data.task ? `<span class="report-tag">${escapeHtml(data.task)}</span>` : '',
  ].filter(Boolean).join('');

  const detailMeta = qs('#detail-meta');
  const detailTitle = qs('#detail-title');
  const detailTags = qs('#detail-tags');
  const detailTime = qs('#detail-time');
  const detailMemo = qs('#detail-memo');

  if (detailMeta) detailMeta.textContent = meta;
  if (detailTitle) detailTitle.textContent = data.title || '（タイトル未設定）';
  if (detailTags) detailTags.innerHTML = tagsHtml || '<span class="report-tag">—</span>';
  if (detailTime) detailTime.textContent = data.time || '—';
  if (detailMemo) detailMemo.textContent = data.memo || '—';

  const img = qs('#detail-image');
  if (img) {
    img.src = data.imageURL || '/img/agri-login-bg.png';
    img.onerror = function () { this.onerror = null; this.src = '/img/agri-login-bg.png'; };
  }
  const note = qs('#detail-note-text');
  if (note) note.value = data.memo || '';
  const dateEl = qs('#detail-date');
  if (dateEl) dateEl.value = data.date || '';
  const taskEl = qs('#detail-task');
  if (taskEl) { taskEl.value = data.taskId || ''; if (!taskEl.value && data.task) setSelectByText(taskEl, data.task); }
  const cropItemEl = qs('#detail-crop-item');
  if (cropItemEl) { cropItemEl.value = data.cropItemId || ''; if (!cropItemEl.value && data.cropItemName) setSelectByText(cropItemEl, data.cropItemName); }
  const ownerEl = qs('#detail-owner');
  if (ownerEl) ownerEl.value = data.owner || '';
  const fieldEl = qs('#detail-field');
  if (fieldEl) { fieldEl.value = data.fieldId || ''; if (!fieldEl.value && data.field) setSelectByText(fieldEl, data.field); }
  const weatherEl = qs('#detail-weather');
  if (weatherEl) { weatherEl.value = data.weatherCode || ''; if (!weatherEl.value && data.weatherName) setSelectByText(weatherEl, data.weatherName); }
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

function fillEditForm(data) {
  const editForm = qs('#report-edit-form');
  if (!editForm) return;

  qs('#edit-date', editForm).value = data.date || '';
  // select value is ID, but card stores task NAME -> match by option text
  const taskSel = qs('#edit-task', editForm);
  if (taskSel) {
    taskSel.value = '';
    setSelectByText(taskSel, data.task || '');
  }
  const cropItemSel = qs('#edit-crop-item', editForm);
  if (cropItemSel) {
    cropItemSel.value = data.cropItemId || '';
    if (!cropItemSel.value && data.cropItemName) setSelectByText(cropItemSel, data.cropItemName);
    syncCropVarietySelect(editForm, cropItemSel.value, { id: data.cropVarietyId || '', name: data.cropVarietyName || '' });
  }
  qs('#edit-owner', editForm).value = data.owner || '';
  const fieldSel = qs('#edit-field', editForm);
  if (fieldSel) {
    fieldSel.value = '';
    setSelectByText(fieldSel, data.field || '');
  }
  qs('#edit-title', editForm).value = data.title || '';
  qs('#edit-memo', editForm).value = data.memo || '';

  // time split (09:00〜11:00)
  const m = (data.time || '').match(/(\d{2}:\d{2})\s*〜\s*(\d{2}:\d{2})/);
  qs('#edit-time-start', editForm).value = m ? m[1] : '';
  qs('#edit-time-end', editForm).value = m ? m[2] : '';

  const hidden = qs('#edit-target-id', editForm);
  if (hidden) hidden.value = data.id || '';
  resetImagePreview({ imageSelector: '#edit-image', wrapperSelector: '#edit-image-wrapper', placeholderSelector: '#edit-image-placeholder' });
}

function buildReportCardElement(data) {
  const html = toReportCardHtml(data);
  const tmp = document.createElement('div');
  tmp.innerHTML = html.trim();
  return tmp.firstElementChild;
}

function applyCardUpdate(card, data) {
  if (!card) return;
  card.dataset.date = data.date;
  card.dataset.task = data.task;
  card.dataset.owner = data.owner;
  card.dataset.field = data.field;
  card.dataset.title = data.title || '';
  card.dataset.memo = data.memo || '';
  card.dataset.time = data.time || '';
  card.dataset.taskId = data.taskId || '';
  card.dataset.ownerId = data.ownerId || '';
  card.dataset.fieldId = data.fieldId || '';
  card.dataset.cropItemId = data.cropItemId || '';
  card.dataset.cropItemName = data.cropItemName || '';
  card.dataset.cropVarietyId = data.cropVarietyId || '';
  card.dataset.cropVarietyName = data.cropVarietyName || '';
  card.dataset.weatherCode = data.weatherCode || '';
  card.dataset.weatherName = data.weatherName || '';
  card.dataset.imageUrl = data.imageURL || '';
  card.dataset.text = data.text || '';

  const meta = toJaMetaLine(data.date, data.field, data.owner);
  const title = data.title || defaultTitleForTask(data.task, data.field);
  const metaEl = qs('.report-meta', card);
  const titleEl = qs('.report-title', card);
  const tagsEl = qs('.report-tags', card);
  const timeEl = qs('.badge-time', card);
  const updEl = qs('.badge-updated', card);
  const weatherEl = qs('.badge-weather', card);
  const workerEl = qs('.badge-worker', card);
  const imgEl = qs('.report-thumb img', card);

  if (metaEl) metaEl.textContent = meta;
  if (titleEl) titleEl.textContent = title;
  if (tagsEl) tagsEl.innerHTML = data.task ? `<span class="report-tag">${escapeHtml(data.task)}</span>` : '<span class="report-tag">—</span>';
  if (timeEl) timeEl.textContent = data.time ? `🕒 ${data.time}` : '🕒 —';
  if (updEl) updEl.textContent = `作付：${data.cropVarietyName || data.cropItemName || '—'}`;
  if (weatherEl) weatherEl.textContent = `⛅ ${data.weatherName || '—'}`;
  if (workerEl) workerEl.textContent = `👨‍🌾 ${data.owner || '—'}`;
  if (imgEl) { imgEl.src = data.imageURL || '/img/agri-login-bg.png'; imgEl.onerror = function () { this.onerror = null; this.src = '/img/agri-login-bg.png'; }; }
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

async function fetchReports(listRoot, state) {
  const query = buildReportQuery();
  const userIdRaw = String(listRoot?.dataset?.userId || '').trim();
  const safeState = state || { viewYear: new Date().getFullYear(), viewMonth: new Date().getMonth(), owner: '', field: '', task: '' };
  const ownerFilterValue = String(safeState?.owner || '').trim();
  const variables = {
    startDate: startOfMonthKey(safeState.viewYear, safeState.viewMonth),
    endDate: endOfMonthKey(safeState.viewYear, safeState.viewMonth),
  };

  // ownerID はオーナー絞り込みが明示された場合のみ付与する。
  // 初期表示は startDate / endDate のみで取得し、権限制御はサーバー側に委ねる。
  // （非管理者で ownerID を自動付与すると upstream 側で 422 になる環境があるため）
  if (ownerFilterValue && isNumericLike(ownerFilterValue)) {
    variables.ownerID = ownerFilterValue;
  }

  if (safeState?.field && isNumericLike(safeState.field)) variables.fieldID = String(safeState.field);
  if (safeState?.task && isNumericLike(safeState.task)) variables.workTypeID = String(safeState.task);

  const result = await window.gql(query, variables);
  if (result.errors) {
    throw new Error(result.errors[0]?.message || 'GraphQL error');
  }
  return Array.isArray(result.data?.findWorkReports) ? result.data.findWorkReports : [];
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
function applyFiltersAndPagination({ cards, state, emptyMessage, headerTitle, headerMeta, pagination, pagePrev, pageNext, pageInfo, ownerFilter, fieldFilter, taskFilter }) {
  const filtered = cards.filter(c => {
    const d = (c.dataset.date || '').trim();
    const task = (c.dataset.task || '').trim();
    const taskId = (c.dataset.taskId || '').trim();
    const owner = (c.dataset.owner || '').trim();
    const ownerId = (c.dataset.ownerId || '').trim();
    const field = (c.dataset.field || '').trim();
    const fieldId = (c.dataset.fieldId || '').trim();
    const text = (c.dataset.text || '').toLowerCase();

    if (state.selectedDate && d !== state.selectedDate) return false;
    if (state.task && taskId !== state.task && task !== state.task) return false;
    if (state.owner && ownerId !== state.owner && owner !== state.owner) return false;
    if (state.field && fieldId !== state.field && field !== state.field) return false;
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
    const ownerLabel = getSelectedLabel(ownerFilter) || state.owner;
    const fieldLabel = getSelectedLabel(fieldFilter) || state.field;
    const taskLabel = getSelectedLabel(taskFilter) || state.task;
    if (state.owner) parts.push(`オーナー：${ownerLabel}`);
    if (state.field) parts.push(`圃場：${fieldLabel}`);
    if (state.task) parts.push(`作業：${taskLabel}`);
    if (state.search) parts.push(`検索：「${state.search}」`);
    headerMeta.textContent = parts.length ? `${parts.join(' / ')}（${total}件）` : `今日を含む最近の作業が新しい順に表示されます。（${total}件）`;
  }
}

function syncControls({ state, searchInput, ownerFilter, fieldFilter, taskFilter, monthLabel, yearSelect, monthSelect, filterAllBtn }) {
  if (searchInput && searchInput.value !== state.search) searchInput.value = state.search;
  if (ownerFilter && ownerFilter.value !== state.owner) ownerFilter.value = state.owner;
  if (fieldFilter && fieldFilter.value !== state.field) fieldFilter.value = state.field;
  if (taskFilter && taskFilter.value !== state.task) taskFilter.value = state.task;

  if (monthLabel) monthLabel.textContent = `${state.viewYear}年 ${state.viewMonth + 1}月`;
  if (yearSelect) yearSelect.value = String(state.viewYear);
  if (monthSelect) monthSelect.value = String(state.viewMonth);

  if (filterAllBtn) {
    if (state.selectedDate) filterAllBtn.classList.remove('active');
    else filterAllBtn.classList.add('active');
  }
}

// --------------------
// GraphQL -> 新UIの簡易カード
// --------------------
function toReportCardHtml(r) {
  const data = normalizeReport(r);
  const date = escapeHtml(data.date);
  const task = escapeHtml(data.task);
  const fieldName = escapeHtml(data.field);
  const ownerName = escapeHtml(data.owner);
  const title = escapeHtml(data.title || defaultTitleForTask(data.task, data.field));
  const weatherName = escapeHtml(data.weatherName || '—');
  const timeBadge = data.time ? `🕒 ${escapeHtml(data.time)}` : '🕒 —';
  const imageUrl = escapeHtml(data.imageURL || '/img/agri-login-bg.png');
  const text = escapeHtml(data.text || [data.task, data.field, data.owner, data.memo].filter(Boolean).join(' '));
  const cropItemName = escapeHtml(data.cropItemName || '');
  const cropVarietyName = escapeHtml(data.cropVarietyName || '');
  const memo = escapeHtml(data.memo || '');

  return `
    <article class="report-card"
      data-report
      data-id="${escapeHtml(data.id)}"
      data-report-id="${escapeHtml(data.id)}"
      data-date="${date}"
      data-task="${task}"
      data-task-id="${escapeHtml(data.taskId)}"
      data-owner="${ownerName}"
      data-owner-id="${escapeHtml(data.ownerId)}"
      data-field="${fieldName}"
      data-field-id="${escapeHtml(data.fieldId)}"
      data-title="${title}"
      data-memo="${memo}"
      data-time="${escapeHtml(data.time)}"
      data-crop-item-id="${escapeHtml(data.cropItemId)}"
      data-crop-item-name="${cropItemName}"
      data-crop-variety-id="${escapeHtml(data.cropVarietyId)}"
      data-crop-variety-name="${cropVarietyName}"
      data-weather-code="${escapeHtml(data.weatherCode)}"
      data-weather-name="${weatherName}"
      data-image-url="${imageUrl}"
      data-text="${text}">
      <div class="report-thumb">
        <img src="${imageUrl}" alt="${task || '作業'}の様子" onerror="this.onerror=null;this.src='/img/agri-login-bg.png';">
      </div>
      <div class="report-content">
        <div class="report-meta">${escapeHtml(toJaMetaLine(data.date, data.field, data.owner))}</div>
        <div class="report-title">${title}</div>
        <div class="report-tags">${task ? `<span class="report-tag">${task}</span>` : '<span class="report-tag">—</span>'}</div>
        <div class="report-footer">
          <div class="report-footer-left">
            <span class="badge-weather">⛅ ${weatherName}</span>
            <span class="badge-worker">👨‍🌾 ${ownerName || '—'}</span>
          </div>
          <div class="report-footer-right">
            <span class="badge-time">${timeBadge}</span>
            <span class="badge-updated">作付：${cropVarietyName || cropItemName || '—'}</span>
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
