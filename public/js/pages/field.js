// Field list interactions
// - filter/search/pagination (simple)
// - field detail modal (click card)

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('fields-grid');
  if (!grid) return;

  // role_id == 1 判定（owner-filter があるのは role1 のみ）
  const isRole1 = !!document.getElementById('owner-filter');

  // --- create modal elements ---
  const createBtn = document.getElementById('field-create-button');
  const createBackdrop = document.getElementById('field-create-backdrop');
  const createCloseBtn = document.getElementById('field-create-close');
  const createCancelBtn = document.getElementById('field-create-cancel');
  const createSaveBtn = document.getElementById('field-create-save');

  const createName = document.getElementById('create-name');
  const createCode = document.getElementById('create-code');
  const createArea = document.getElementById('create-area');
  const createType = document.getElementById('create-type');
  const createStatus = document.getElementById('create-status');
  const createOwner = document.getElementById('create-owner');
  const createAddress = document.getElementById('create-address');
  const createPostal = document.getElementById('create-postal');
  const createLat = document.getElementById('create-lat');
  const createLng = document.getElementById('create-lng');
  const createNote = document.getElementById('create-note');
  const createMapFrame = document.getElementById('field-create-map-frame');
  const createCoordsEl = document.getElementById('field-create-map-coords');

  // --- modal elements ---
  const backdrop = document.getElementById('field-detail-backdrop');
  const modalCloseBtn = document.getElementById('field-detail-close');
  const modalCancelBtn = document.getElementById('field-detail-cancel');
  const modalEditBtn = document.getElementById('field-detail-edit');
  const modalSaveBtn = document.getElementById('field-detail-save');

  const titleEl = document.getElementById('field-detail-title');
  const subtitleEl = document.getElementById('field-detail-subtitle');
  const mapFrame = document.getElementById('field-map-frame');
  const mapMarker = document.getElementById('field-map-marker');
  const mapContainer = document.getElementById('field-map-container');
  const coordsEl = document.getElementById('field-map-coords');
  const workerChipsEl = document.getElementById('field-worker-chips');

  const inputId = document.getElementById('detail-id');
  const inputName = document.getElementById('detail-name');
  const inputCode = document.getElementById('detail-code');
  const inputArea = document.getElementById('detail-area');
  const inputType = document.getElementById('detail-type');
  const inputStatus = document.getElementById('detail-status');
  const inputOwner = document.getElementById('detail-owner');
  const inputAddress = document.getElementById('detail-address');
  const inputPostal = document.getElementById('detail-postal');
  const inputUpdated = document.getElementById('detail-updated');
  const inputNote = document.getElementById('detail-note');

  // Safety: if modal not present, just don't do modal.
  const hasModal = !!(backdrop && titleEl && inputName);

  // Demo worker map (id -> name)
  const workerNameMap = {
    '1': '田中（作業者）',
    '2': '鈴木（作業者）',
    '3': '佐藤（作業者）',
  };

  // --- filtering ---
  const searchInput = document.getElementById('field-search');
  const clearBtn = document.getElementById('field-search-clear');
  const ownerFilter = document.getElementById('owner-filter');
  const typeFilter = document.getElementById('field-type-filter');
  const statusFilter = document.getElementById('field-status-filter');
  const metaEl = document.getElementById('list-header-meta');
  const emptyEl = document.getElementById('empty-message');

  const cards = Array.from(grid.querySelectorAll('[data-field]'));

  function normalize(s) {
    return String(s ?? '').toLowerCase();
  }

  function applyFilter() {
    const q = normalize(searchInput?.value);
    const owner = ownerFilter?.value || '';
    const type = typeFilter?.value || '';
    const status = statusFilter?.value || '';

    let visible = 0;
    for (const card of cards) {
      const d = card.dataset;
      const okOwner = !owner || d.owner === owner;
      const okType = !type || d.type === type;
      const okStatus = !status || d.status === status;
      const okText = !q || normalize(d.text).includes(q);

      const show = okOwner && okType && okStatus && okText;
      card.style.display = show ? '' : 'none';
      if (show) visible += 1;
    }

    if (metaEl) metaEl.textContent = `${visible}件表示`;
    if (emptyEl) emptyEl.style.display = visible ? 'none' : '';
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyFilter);
  }
  if (clearBtn && searchInput) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      applyFilter();
      searchInput.focus();
    });
  }
  ownerFilter?.addEventListener('change', applyFilter);
  typeFilter?.addEventListener('change', applyFilter);
  statusFilter?.addEventListener('change', applyFilter);
  applyFilter();

  // --- create modal helpers ---
  const hasCreateModal = !!(createBackdrop && createName && createSaveBtn);

  function openCreateModal() {
    if (!hasCreateModal) return;
    // reset
    createName.value = '';
    createCode.value = '';
    createArea.value = '';
    createType.value = 'paddy';
    createStatus.value = 'active';
    createOwner.value = '';
    createAddress.value = '';
    createPostal.value = '';
    createLat.value = '';
    createLng.value = '';
    createNote.value = '';
    updateCreateMap();

    createBackdrop.classList.add('open');
    createBackdrop.setAttribute('aria-hidden', 'false');
    setTimeout(() => createName.focus(), 0);
  }

  function closeCreateModal() {
    if (!hasCreateModal) return;
    createBackdrop.classList.remove('open');
    createBackdrop.setAttribute('aria-hidden', 'true');
  }

  function updateCreateMap() {
    if (!hasCreateModal) return;
    const lat = parseFloat(createLat.value);
    const lng = parseFloat(createLng.value);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      if (createMapFrame) {
        createMapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(lat + ',' + lng)}&z=16&output=embed`;
      }
      if (createCoordsEl) createCoordsEl.textContent = `lat: ${lat.toFixed(6)}, lng: ${lng.toFixed(6)}`;
    } else {
      if (createMapFrame) createMapFrame.removeAttribute('src');
      if (createCoordsEl) createCoordsEl.textContent = 'lat: -, lng: -';
    }
  }

  function formatNow() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function nextId() {
    let max = 0;
    for (const c of cards) {
      const id = parseInt(c.dataset.id, 10);
      if (Number.isFinite(id)) max = Math.max(max, id);
    }
    return max + 1;
  }

  function pillStatusClass(status) {
    if (status === 'active') return 'pill-status-active';
    if (status === 'inactive') return 'pill-status-inactive';
    if (status === 'abandoned') return 'pill-status-abandoned';
    return 'pill-status-active';
  }

  function statusLabel2(status) {
    return ({ active: '利用中', inactive: '一時休止', abandoned: '廃止' }[status]) || status;
  }

  function typeLabel2(type) {
    return ({
      paddy: '水田',
      upland: '畑（畑地）',
      vegetable: '野菜圃場',
      fruit: '果樹園',
      greenhouse: 'ハウス圃場',
      other: 'その他',
    }[type]) || type;
  }

  function numberWithCommas(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) return '-';
    return n.toLocaleString('ja-JP');
  }

  function buildCard(data) {
    const el = document.createElement('article');
    el.className = 'field-card';
    el.setAttribute('data-field', '');

    // dataset (detail modal uses these)
    el.dataset.id = String(data.id);
    el.dataset.name = data.name;
    el.dataset.code = data.code;
    el.dataset.owner = data.owner;
    el.dataset.type = data.type;
    el.dataset.status = data.status;
    el.dataset.lat = String(data.lat ?? '');
    el.dataset.lng = String(data.lng ?? '');
    el.dataset.area = String(data.area ?? '');
    el.dataset.postal = data.postal;
    el.dataset.address = data.address;
    el.dataset.note = data.note;
    el.dataset.updatedAt = data.updatedAt;
    el.dataset.createdAt = data.createdAt;
    el.dataset.workerIds = data.workerIds;
    el.dataset.text = `${data.name} ${data.owner} ${typeLabel2(data.type)} ${data.address} ${data.code} ${statusLabel2(data.status)}`;

    const ownerPill = (isRole1 && data.owner)
      ? `<span class="pill">${escapeHtml(data.owner)}</span>`
      : '';

    el.innerHTML = `
      <div class="field-card-header">
        <div>
          <div class="field-name">${escapeHtml(data.name)}</div>
          <div class="field-code">コード: ${escapeHtml(data.code)}</div>
        </div>
      </div>
      <div class="field-pill-row">
        <span class="pill pill-type">${escapeHtml(typeLabel2(data.type))}</span>
        <span class="pill ${pillStatusClass(data.status)}">${escapeHtml(statusLabel2(data.status))}</span>
        ${ownerPill}
      </div>
      <div class="field-meta-row">
        <span>📍 <span class="field-address">${escapeHtml(data.address || '-')}</span></span>
        <span>📐 面積: ${numberWithCommas(data.area)} ㎡</span>
        <span>👥 <span class="field-workers-label">作業者: 未登録</span></span>
      </div>
      <div class="field-update">最終更新: ${escapeHtml(data.updatedAt)}</div>
    `;
    return el;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  if (hasCreateModal && createBtn) {
    createBtn.addEventListener('click', openCreateModal);
  }

  createCloseBtn?.addEventListener('click', closeCreateModal);
  createCancelBtn?.addEventListener('click', closeCreateModal);
  createBackdrop?.addEventListener('click', (e) => {
    if (e.target === createBackdrop) closeCreateModal();
  });

  createLat?.addEventListener('input', updateCreateMap);
  createLng?.addEventListener('input', updateCreateMap);

  createSaveBtn?.addEventListener('click', () => {
    if (!hasCreateModal) return;
    const name = createName.value.trim();
    if (!name) {
      // eslint-disable-next-line no-alert
      alert('圃場名を入力してください');
      createName.focus();
      return;
    }

    const id = nextId();
    const code = (createCode.value.trim() || `F-${String(id).padStart(3, '0')}`);
    const area = createArea.value ? Number(createArea.value) : '';
    const type = createType.value;
    const status = createStatus.value;
    const owner = createOwner.value.trim() || (isRole1 ? '未設定' : '');
    const address = createAddress.value.trim();
    const postal = createPostal.value.trim();
    const lat = createLat.value ? Number(createLat.value) : '';
    const lng = createLng.value ? Number(createLng.value) : '';
    const note = createNote.value.trim();

    const now = formatNow();
    const card = buildCard({
      id,
      name,
      code,
      owner,
      type,
      status,
      lat,
      lng,
      area,
      postal,
      address,
      note,
      updatedAt: now,
      createdAt: now,
      workerIds: '',
    });

    // add to DOM and list
    grid.insertBefore(card, grid.firstChild);
    cards.unshift(card);
    applyFilter();
    closeCreateModal();
  });

  // --- field detail modal ---
  if (!hasModal) return;

  let isEditing = false;
  let currentLat = null;
  let currentLng = null;

  const editableInputs = [
    inputName,
    inputArea,
    inputType,
    inputStatus,
    inputOwner,
    inputAddress,
    inputPostal,
    inputNote,
  ].filter(Boolean);

  function setEditing(next) {
    isEditing = next;
    for (const el of editableInputs) {
      el.disabled = !next;
    }
    // code/id/updated are always read-only
    inputCode && (inputCode.disabled = true);
    inputUpdated && (inputUpdated.disabled = true);
    modalSaveBtn.style.display = next ? '' : 'none';
    modalEditBtn.textContent = next ? '編集終了' : '編集';
    mapMarker.classList.toggle('disabled', !next);
  }

  function openModalFromCard(card) {
    const d = card.dataset;
    inputId.value = d.id || '';
    inputName.value = d.name || '';
    inputCode.value = d.code || '';
    inputArea.value = d.area || '';
    inputType.value = typeLabel(d.type);
    inputStatus.value = statusLabel(d.status);
    inputOwner.value = d.owner || '';
    inputAddress.value = d.address || '';
    inputPostal.value = d.postal || '';
    inputUpdated.value = d.updatedAt || '';
    inputNote.value = d.note || '';

    titleEl.textContent = d.name || '圃場詳細';
    subtitleEl.textContent = `コード: ${d.code || '-'}`;

    currentLat = parseFloat(d.lat);
    currentLng = parseFloat(d.lng);
    if (!Number.isFinite(currentLat)) currentLat = null;
    if (!Number.isFinite(currentLng)) currentLng = null;

    updateMap();
    renderWorkers(d.workerIds);

    setEditing(false);
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
    setEditing(false);
  }

  function updateMap() {
    const lat = currentLat;
    const lng = currentLng;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      // no-key embed
      mapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(lat + ',' + lng)}&z=16&output=embed`;
      coordsEl.textContent = `lat: ${lat.toFixed(6)}, lng: ${lng.toFixed(6)}`;
    } else {
      mapFrame.removeAttribute('src');
      coordsEl.textContent = 'lat: -, lng: -';
    }
  }

  function renderWorkers(workerIdsRaw) {
    const ids = String(workerIdsRaw || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    workerChipsEl.innerHTML = '';
    if (!ids.length) {
      workerChipsEl.innerHTML = '<span class="worker-chip">未登録</span>';
      return;
    }
    for (const id of ids) {
      const chip = document.createElement('span');
      chip.className = 'worker-chip';
      chip.textContent = workerNameMap[id] || `ID:${id}`;
      workerChipsEl.appendChild(chip);
    }
  }

  function typeLabel(v) {
    const map = {
      paddy: '水田',
      upland: '畑（畑地）',
      vegetable: '野菜圃場',
      fruit: '果樹園',
      greenhouse: 'ハウス圃場',
      other: 'その他',
    };
    return map[v] || (v || '');
  }
  function statusLabel(v) {
    const map = {
      active: '利用中',
      inactive: '一時休止',
      abandoned: '廃止',
    };
    return map[v] || (v || '');
  }

  // Card click -> open modal
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-field]');
    if (!card) return;

    // ignore clicks when user is selecting text
    const sel = window.getSelection?.();
    if (sel && String(sel).length > 0) return;

    openModalFromCard(card);
  });

  modalCloseBtn?.addEventListener('click', closeModal);
  modalCancelBtn?.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (createBackdrop && createBackdrop.classList.contains('open')) closeCreateModal();
    if (backdrop.classList.contains('open')) closeModal();
  });

  modalEditBtn?.addEventListener('click', () => {
    setEditing(!isEditing);
  });
  modalSaveBtn?.addEventListener('click', () => {
    // Demo: no backend yet
    // Sync coordinates into the note for visibility if changed
    if (Number.isFinite(currentLat) && Number.isFinite(currentLng)) {
      coordsEl.textContent = `lat: ${currentLat.toFixed(6)}, lng: ${currentLng.toFixed(6)}`;
    }
    setEditing(false);
    // eslint-disable-next-line no-alert
    alert('保存はデモです（バックエンド連携は次フェーズ）');
  });

  // --- marker drag (demo) ---
  // Move marker within the map container and update lat/lng slightly.
  // (This is a UI demo; in production you'd pick coords from real map click.)
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let markerStartLeft = 0;
  let markerStartTop = 0;

  function px(n) { return `${n}px`; }

  function getPos(el) {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  function setMarkerPos(x, y) {
    mapMarker.style.left = px(x);
    mapMarker.style.top = px(y);
    mapMarker.style.transform = 'translate(-50%, -50%)';
  }

  function ensureMarkerCentered() {
    // reset to center (CSS default) when opening
    mapMarker.style.left = '50%';
    mapMarker.style.top = '50%';
    mapMarker.style.transform = 'translate(-50%, -50%)';
  }

  // Reset marker when modal opens
  const observer = new MutationObserver(() => {
    if (backdrop.classList.contains('open')) {
      ensureMarkerCentered();
    }
  });
  observer.observe(backdrop, { attributes: true, attributeFilter: ['class'] });

  mapMarker.addEventListener('mousedown', (e) => {
    if (!isEditing) return;
    dragging = true;
    mapMarker.style.cursor = 'grabbing';

    const rect = mapContainer.getBoundingClientRect();
    const markerRect = mapMarker.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    markerStartLeft = markerRect.left - rect.left + markerRect.width / 2;
    markerStartTop = markerRect.top - rect.top + markerRect.height / 2;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = mapContainer.getBoundingClientRect();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const x = clamp(markerStartLeft + dx, 8, rect.width - 8);
    const y = clamp(markerStartTop + dy, 8, rect.height - 8);
    setMarkerPos(x, y);

    // Update coords a little (demo)
    if (Number.isFinite(currentLat) && Number.isFinite(currentLng)) {
      currentLat = currentLat + (-dy * 0.00001);
      currentLng = currentLng + (dx * 0.00001);
      coordsEl.textContent = `lat: ${currentLat.toFixed(6)}, lng: ${currentLng.toFixed(6)}`;
    }
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    mapMarker.style.cursor = 'grab';
  });
});

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
