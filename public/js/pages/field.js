document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('fields-grid');
  if (!grid) return;

  const userId = String(grid.dataset.userId || '');
  const isRole1 = !!document.getElementById('owner-filter');
  const orgLat = parseFiniteNumber(grid.dataset.orgLat);
  const orgLng = parseFiniteNumber(grid.dataset.orgLng);

  const loadingEl = document.getElementById('fields-loading');
  const metaEl = document.getElementById('list-header-meta');
  const emptyEl = document.getElementById('empty-message');
  const ownerFilter = document.getElementById('owner-filter');
  const typeFilter = document.getElementById('field-type-filter');
  const statusFilter = document.getElementById('field-status-filter');
  const prevBtn = document.getElementById('field-page-prev');
  const nextBtn = document.getElementById('field-page-next');
  const pageInfoEl = document.getElementById('field-page-info');

  const backdrop = document.getElementById('field-detail-backdrop');
  const modalCloseBtn = document.getElementById('field-detail-close');
  const modalCancelBtn = document.getElementById('field-detail-cancel');
  const modalEditBtn = document.getElementById('field-detail-edit');
  const modalSaveBtn = document.getElementById('field-detail-save');
  const titleEl = document.getElementById('field-detail-title');
  const subtitleEl = document.getElementById('field-detail-subtitle');
  const detailMapCanvas = document.getElementById('field-map-canvas');
  const coordsEl = document.getElementById('field-map-coords');

  const inputLat = document.getElementById('detail-lat');
  const inputLng = document.getElementById('detail-lng');

  const inputId = document.getElementById('detail-id');
  const inputName = document.getElementById('detail-name');
  const inputType = document.getElementById('detail-type');
  const inputArea = document.getElementById('detail-area');
  const inputStatus = document.getElementById('detail-status');
  const inputOwner = document.getElementById('detail-owner');
  const inputPostal = document.getElementById('detail-postal');
  const inputAddress = document.getElementById('detail-address');

  const createBackdrop = document.getElementById('field-create-backdrop');
  const createOpenBtn = document.getElementById('field-create-button');
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
  const createMapCanvas = document.getElementById('field-create-map-canvas');
  const createCoordsEl = document.getElementById('field-create-map-coords');

  const hasModal = !!(backdrop && titleEl && inputName && inputType && inputStatus);

  let fields = [];
  let filteredFields = [];
  let fieldTypeMasters = [];
  let fieldStateMasters = [];
  let ownerMasters = [];
  let currentFieldId = '';
  let isEditing = false;
  let lastPostalLookupKey = '';
  let isAutoFillingAddress = false;
  let detailMapPicker = null;
  let createMapPicker = null;

  detailMapPicker = createMapPickerController({
    canvasEl: detailMapCanvas,
    coordsEl,
    latInput: inputLat,
    lngInput: inputLng,
    editable: false,
    emptyZoom: 5,
  });
  createMapPicker = createMapPickerController({
    canvasEl: createMapCanvas,
    coordsEl: createCoordsEl,
    latInput: createLat,
    lngInput: createLng,
    editable: true,
    emptyZoom: 5,
  });

  try {
    if (loadingEl) loadingEl.style.display = 'block';

    const [fieldList, typeMasters, stateMasters, owners] = await Promise.all([
      fetchFields({ userId, isRole1 }),
      fetchFieldTypes().catch(() => []),
      fetchFieldStates().catch(() => []),
      isRole1 ? fetchOwners().catch(() => []) : Promise.resolve([]),
    ]);

    fields = Array.isArray(fieldList) ? fieldList.map(normalizeField) : [];
    fieldTypeMasters = Array.isArray(typeMasters) ? typeMasters : [];
    fieldStateMasters = Array.isArray(stateMasters) ? stateMasters : [];
    ownerMasters = Array.isArray(owners) ? owners : [];

    populateTypeFilter(typeFilter, fieldTypeMasters, fields);
    populateStateFilter(statusFilter, fieldStateMasters, fields);
    populateOwnerFilter(ownerFilter, fields, ownerMasters);
    populateDetailSelect(inputType, fieldTypeMasters, 'type');
    populateDetailSelect(inputStatus, fieldStateMasters, 'state');
    populateDetailSelect(createType, fieldTypeMasters, 'type');
    populateDetailSelect(createStatus, fieldStateMasters, 'state');
    populateOwnerSelect(createOwner, ownerMasters);

    filteredFields = fields.slice();
    render();
  } catch (err) {
    console.error('圃場一覧の取得に失敗しました:', err);
    fields = [];
    filteredFields = [];
    grid.innerHTML = '';
    if (metaEl) metaEl.textContent = '0件表示';
    if (emptyEl) emptyEl.style.display = '';
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }

  ownerFilter?.addEventListener('change', applyFilter);
  typeFilter?.addEventListener('change', applyFilter);
  statusFilter?.addEventListener('change', applyFilter);
  prevBtn?.addEventListener('click', () => {});
  nextBtn?.addEventListener('click', () => {});

  createOpenBtn?.addEventListener('click', openCreateModal);
  createCloseBtn?.addEventListener('click', closeCreateModal);
  createCancelBtn?.addEventListener('click', closeCreateModal);
  createBackdrop?.addEventListener('click', (e) => {
    if (e.target === createBackdrop) closeCreateModal();
  });
  createLat?.addEventListener('input', updateCreateMapFromInputs);
  createLng?.addEventListener('input', updateCreateMapFromInputs);
  inputLat?.addEventListener('input', updateDetailMapFromInputs);
  inputLng?.addEventListener('input', updateDetailMapFromInputs);
  createPostal?.addEventListener('blur', handlePostalLookup);
  createPostal?.addEventListener('change', handlePostalLookup);
  createAddress?.addEventListener('blur', handleAddressGeocode);
  createSaveBtn?.addEventListener('click', handleCreateFieldSave);

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-field-id]');
    if (!card) return;
    const field = fields.find((x) => String(x.id) === String(card.dataset.fieldId));
    if (!field) return;
    openModal(field);
  });

  modalCloseBtn?.addEventListener('click', closeModal);
  modalCancelBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (backdrop?.classList.contains('open')) closeModal();
    if (createBackdrop?.classList.contains('open')) closeCreateModal();
  });

  modalEditBtn?.addEventListener('click', () => {
    setEditing(!isEditing);
  });

  modalSaveBtn?.addEventListener('click', async () => {
    const field = fields.find((x) => String(x.id) === String(currentFieldId));
    if (!field) return;

    const payload = buildUpdateFieldInput(field);
    const validationError = validateUpdateFieldInput(payload);
    if (validationError) {
      alert(validationError);
      return;
    }

    const originalLabel = modalSaveBtn.textContent;
    modalSaveBtn.disabled = true;
    modalSaveBtn.textContent = '保存中...';

    try {
      const updated = await updateFieldMutation(field.id, payload);
      const normalized = normalizeField(updated || {});
      const nextField = normalized.id ? { ...field, ...normalized } : { ...field, ...payload };
      const index = fields.findIndex((x) => String(x.id) === String(field.id));
      if (index >= 0) fields[index] = nextField;
      applyFilter();
      openModal(nextField);
      setEditing(false);
      alert('圃場を更新しました。');
    } catch (err) {
      console.error('圃場更新に失敗しました:', err);
      alert(err?.message || '圃場更新に失敗しました。');
    } finally {
      modalSaveBtn.disabled = false;
      modalSaveBtn.textContent = originalLabel || '保存';
    }
  });



  async function handleCreateFieldSave() {
    if (!createSaveBtn) return;

    const payload = buildCreateFieldInput();
    const validationError = validateCreateFieldInput(payload);
    if (validationError) {
      alert(validationError);
      return;
    }

    const originalLabel = createSaveBtn.textContent;
    createSaveBtn.disabled = true;
    createSaveBtn.textContent = '登録中...';

    try {
      const created = await createFieldMutation(payload);
      const normalized = normalizeField(created || {});
      if (normalized.id) {
        fields.unshift(normalized);
        applyFilter();
      } else {
        const reloaded = await fetchFields({ userId, isRole1 });
        fields = Array.isArray(reloaded) ? reloaded.map(normalizeField) : [];
        applyFilter();
      }
      closeCreateModal();
      alert('圃場を登録しました。');
    } catch (err) {
      console.error('圃場登録に失敗しました:', err);
      alert(err?.message || '圃場登録に失敗しました。');
    } finally {
      createSaveBtn.disabled = false;
      createSaveBtn.textContent = originalLabel || '登録';
    }
  }

  function buildCreateFieldInput() {
    const lat = Number(String(createLat?.value || '').trim());
    const lng = Number(String(createLng?.value || '').trim());
    const area = Number(String(createArea?.value || '').trim());
    const code = String(createCode?.value || '').trim();

    const input = {
      userID: String(createOwner?.value || '').trim(),
      fieldTypeID: String(createType?.value || '').trim(),
      fieldStateID: String(createStatus?.value || '').trim(),
      name: String(createName?.value || '').trim(),
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      postalCode: String(createPostal?.value || '').trim(),
      address: String(createAddress?.value || '').trim(),
    };

    if (code) input.fieldCode = code;
    if (Number.isFinite(area)) input.area = area;

    const rawNote = String(createNote?.value || '');
    const note = rawNote.trim();
    input.note = note ? note : '　';

    return input;
  }

  function buildUpdateFieldInput(field) {
    const lat = Number(String(inputLat?.value || '').trim());
    const lng = Number(String(inputLng?.value || '').trim());
    const areaRaw = String(inputArea?.value || '').trim();
    const area = Number(areaRaw);
    const current = field || {};

    const input = {
      userID: String(current.ownerID || '').trim(),
      fieldTypeID: String(inputType?.value || current.fieldTypeID || '').trim(),
      fieldStateID: String(inputStatus?.value || current.fieldStateID || '').trim(),
      name: String(inputName?.value || '').trim(),
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      postalCode: String(inputPostal?.value || '').trim(),
      address: String(inputAddress?.value || '').trim(),
      note: String(current.note || '').trim() || '　',
    };

    if (current.fieldCode) input.fieldCode = String(current.fieldCode).trim();
    if (areaRaw !== '' && Number.isFinite(area)) input.area = area;

    return input;
  }

  function validateCreateFieldInput(input) {
    if (!input.userID) return 'オーナーを選択してください。';
    if (!input.fieldTypeID) return '種別を選択してください。';
    if (!input.fieldStateID) return '状態を選択してください。';
    if (!input.name) return '圃場名を入力してください。';
    if (!Number.isFinite(input.latitude)) return '緯度を入力してください。';
    if (!Number.isFinite(input.longitude)) return '経度を入力してください。';
    if (!input.postalCode) return '郵便番号を入力してください。';
    if (!input.address) return '住所を入力してください。';
    return '';
  }

  function validateUpdateFieldInput(input) {
    return validateCreateFieldInput(input);
  }

  async function handlePostalLookup() {
    const raw = String(createPostal?.value || '');
    const zipcode = raw.replace(/\D/g, '');
    if (!createPostal) return;
    const normalized = formatPostalCode(zipcode || raw);
    if (normalized && createPostal.value !== normalized) createPostal.value = normalized;
    if (zipcode.length !== 7) return;
    if (lastPostalLookupKey === zipcode) return;
    lastPostalLookupKey = zipcode;

    try {
      const result = await lookupPostalCode(zipcode);
      const address = result?.address || '';
      if (address && createAddress && !String(createAddress.value || '').trim()) {
        isAutoFillingAddress = true;
        createAddress.value = address;
        isAutoFillingAddress = false;
      }
      if (address) {
        await geocodeAddress(address, {
          postalCode: result?.zipcode || zipcode,
          prefecture: result?.prefecture || '',
          city: result?.city || '',
          town: result?.town || '',
        });
      }
    } catch (err) {
      console.warn('郵便番号から住所を取得できませんでした:', err);
    }
  }

  async function handleAddressGeocode() {
    if (isAutoFillingAddress) return;
    const address = String(createAddress?.value || '').trim();
    if (!address) return;
    try {
      await geocodeAddress(address, {
        postalCode: String(createPostal?.value || '').replace(/\D/g, '').slice(0, 7),
      });
    } catch (err) {
      console.warn('住所から緯度経度を取得できませんでした:', err);
    }
  }

  async function geocodeAddress(address, options = {}) {
    if (!address) return null;
    const params = new URLSearchParams({ address: String(address || '').trim() });
    const postalCode = String(options?.postalCode || '').replace(/\D/g, '').slice(0, 7);
    if (postalCode) params.set('postalCode', postalCode);
    if (options?.prefecture) params.set('prefecture', String(options.prefecture));
    if (options?.city) params.set('city', String(options.city));
    if (options?.town) params.set('town', String(options.town));

    const geo = await fetchJson(`/field/api/geocode?${params.toString()}`);
    if (geo?.lat != null && geo?.lng != null) {
      if (createLat) createLat.value = String(geo.lat);
      if (createLng) createLng.value = String(geo.lng);
      updateCreateMap(geo.lat, geo.lng);
      return geo;
    }
    return null;
  }

  function openCreateModal() {
    if (!createBackdrop) return;
    resetCreateForm();
    createBackdrop.classList.add('open');
    createBackdrop.setAttribute('aria-hidden', 'false');
    createMapPicker?.invalidateSize();
  }

  function closeCreateModal() {
    if (!createBackdrop) return;
    createBackdrop.classList.remove('open');
    createBackdrop.setAttribute('aria-hidden', 'true');
  }

  function resetCreateForm() {
    if (createName) createName.value = '';
    if (createCode) createCode.value = '';
    if (createArea) createArea.value = '';
    if (createAddress) createAddress.value = '';
    if (createPostal) createPostal.value = '';
    if (createNote) createNote.value = '';
    if (createType && createType.options.length) createType.selectedIndex = 0;
    if (createStatus && createStatus.options.length) createStatus.selectedIndex = 0;
    if (createOwner && createOwner.options?.length) createOwner.selectedIndex = 0;

    const initialLat = Number.isFinite(orgLat) ? orgLat : null;
    const initialLng = Number.isFinite(orgLng) ? orgLng : null;

    if (createLat) createLat.value = initialLat != null ? String(initialLat) : '';
    if (createLng) createLng.value = initialLng != null ? String(initialLng) : '';
    updateCreateMap(initialLat, initialLng);
  }

  function updateCreateMapFromInputs() {
    updateCreateMap(createLat?.value, createLng?.value);
  }

  function updateCreateMap(latRaw, lngRaw) {
    createMapPicker?.setLatLng(latRaw, lngRaw, { center: true });
  }

  function applyFilter() {
    const owner = String(ownerFilter?.value || '');
    const type = String(typeFilter?.value || '');
    const state = String(statusFilter?.value || '');

    filteredFields = fields.filter((field) => {
      const okOwner = !owner || String(field.ownerID) === owner;
      const okType = !type || String(field.fieldTypeID) === type;
      const okState = !state || String(field.fieldStateID) === state;
      return okOwner && okType && okState;
    });
    render();
  }

  function render() {
    grid.innerHTML = filteredFields.map(toFieldCardHtml).join('');
    if (metaEl) metaEl.textContent = `${filteredFields.length}件表示`;
    if (pageInfoEl) pageInfoEl.textContent = '1 / 1ページ';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (emptyEl) emptyEl.style.display = filteredFields.length ? 'none' : '';
  }

  function openModal(field) {
    if (!hasModal) return;
    currentFieldId = field.id;
    titleEl.textContent = field.name || '圃場詳細';
    subtitleEl.textContent = '';
    inputId.value = field.id || '';
    inputName.value = field.name || '';
    if (inputArea) inputArea.value = field.area != null && field.area !== '' ? String(field.area) : '';
    inputOwner.value = field.ownerName || '';
    inputPostal.value = field.postalCode || '';
    inputAddress.value = field.address || '';
    if (inputLat) inputLat.value = field.latitude != null && field.latitude !== '' ? String(field.latitude) : '';
    if (inputLng) inputLng.value = field.longitude != null && field.longitude !== '' ? String(field.longitude) : '';

    setSelectValue(inputType, String(field.fieldTypeID || ''));
    setSelectValue(inputStatus, String(field.fieldStateID || ''));

    updateMap(field.latitude, field.longitude);
    setEditing(false);
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    detailMapPicker?.invalidateSize();
  }

  function closeModal() {
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
    setEditing(false);
  }

  function setEditing(next) {
    isEditing = !!next;
    if (inputName) inputName.disabled = !isEditing;
    if (inputType) inputType.disabled = !isEditing;
    if (inputArea) inputArea.disabled = !isEditing;
    if (inputStatus) inputStatus.disabled = !isEditing;
    if (inputPostal) inputPostal.disabled = !isEditing;
    if (inputAddress) inputAddress.disabled = !isEditing;
    if (inputLat) inputLat.disabled = !isEditing;
    if (inputLng) inputLng.disabled = !isEditing;
    if (inputOwner) inputOwner.disabled = true;
    detailMapPicker?.setEditable(isEditing);
    if (modalSaveBtn) modalSaveBtn.style.display = isEditing ? '' : 'none';
    if (modalEditBtn) modalEditBtn.textContent = isEditing ? '編集終了' : '編集';
  }

  function updateDetailMapFromInputs() {
    updateMap(inputLat?.value, inputLng?.value);
  }

  function updateMap(latRaw, lngRaw) {
    detailMapPicker?.setLatLng(latRaw, lngRaw, { center: true });
  }

  function getTypeNameById(id) {
    return fieldTypeMasters.find((x) => String(x.id) === String(id))?.name || '';
  }

  function getStateDescriptionById(id) {
    const state = fieldStateMasters.find((x) => String(x.id) === String(id));
    return state?.description || state?.name || '';
  }
});


function createMapPickerController({ canvasEl, coordsEl, latInput, lngInput, editable = false, emptyZoom = 5 }) {
  if (!canvasEl || typeof window.L === 'undefined') {
    if (coordsEl) coordsEl.textContent = 'lat: -, lng: -';
    return {
      setLatLng() {},
      invalidateSize() {},
      setEditable() {},
    };
  }

  const defaultCenter = [35.681236, 139.767125];
  const map = L.map(canvasEl, {
    zoomControl: true,
    attributionControl: true,
  }).setView(defaultCenter, emptyZoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  const marker = L.marker(defaultCenter, {
    interactive: false,
    keyboard: false,
    opacity: 0,
    zIndexOffset: 1000,
  }).addTo(map);

  let hasValue = false;
  let syncingFromMap = false;
  let isEditable = !!editable;

  function renderCoords(lat, lng) {
    if (!coordsEl) return;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      coordsEl.textContent = `lat: ${lat.toFixed(6)}, lng: ${lng.toFixed(6)}`;
    } else {
      coordsEl.textContent = 'lat: -, lng: -';
    }
  }

  function applyToInputs(lat, lng) {
    if (latInput) latInput.value = Number.isFinite(lat) ? String(Number(lat).toFixed(7)) : '';
    if (lngInput) lngInput.value = Number.isFinite(lng) ? String(Number(lng).toFixed(7)) : '';
  }

  function updateMarkerToCenter() {
    if (!hasValue) return;
    marker.setLatLng(map.getCenter());
  }

  function enableInteractions(next) {
    isEditable = !!next;

    if (isEditable) {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
      map.touchZoom.enable();
      if (map.tap) map.tap.enable();
    } else {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      map.touchZoom.disable();
      if (map.tap) map.tap.disable();
    }

    canvasEl.classList.toggle('is-disabled', !isEditable);
    const zoomEl = map.zoomControl && map.zoomControl.getContainer ? map.zoomControl.getContainer() : null;
    if (zoomEl) zoomEl.style.display = isEditable ? '' : 'none';
  }

  function commit(latRaw, lngRaw, { center = false } = {}) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      hasValue = true;
      renderCoords(lat, lng);
      applyToInputs(lat, lng);
      const nextZoom = center ? Math.max(map.getZoom() || 16, 16) : (map.getZoom() || 16);
      map.setView([lat, lng], nextZoom, { animate: false });
      marker.setLatLng([lat, lng]);
    } else {
      hasValue = false;
      renderCoords(null, null);
      applyToInputs(null, null);
      map.setView(defaultCenter, emptyZoom, { animate: false });
    }
  }

  function syncFromCenter() {
    if (!isEditable || !hasValue) return;
    const center = map.getCenter();
    syncingFromMap = true;
    renderCoords(center.lat, center.lng);
    applyToInputs(center.lat, center.lng);
    marker.setLatLng(center);
    syncingFromMap = false;
  }

  map.on('move', () => {
    if (!hasValue) return;
    updateMarkerToCenter();
    syncFromCenter();
  });

  map.on('zoom', () => {
    if (!hasValue) return;
    updateMarkerToCenter();
  });

  if (latInput && lngInput) {
    const onInput = () => {
      if (syncingFromMap) return;
      commit(latInput.value, lngInput.value, { center: true });
    };
    latInput.addEventListener('change', onInput);
    lngInput.addEventListener('change', onInput);
  }

  setTimeout(() => map.invalidateSize(), 0);
  renderCoords(null, null);
  enableInteractions(isEditable);

  return {
    setLatLng(latRaw, lngRaw, options = {}) {
      commit(latRaw, lngRaw, options);
    },
    invalidateSize() {
      setTimeout(() => {
        map.invalidateSize();
        if (hasValue) {
          marker.setLatLng(map.getCenter());
          if (!isEditable) {
            const latlng = marker.getLatLng();
            map.panTo(latlng, { animate: false });
          }
        }
      }, 60);
    },
    setEditable(next) {
      enableInteractions(next);
      if (hasValue) {
        marker.setLatLng(map.getCenter());
      }
    },
  };
}



function parseFiniteNumber(value) {
  const num = Number(String(value ?? '').trim());
  return Number.isFinite(num) ? num : null;
}
function formatPostalCode(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 7);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

async function lookupPostalCode(zipcode) {
  return fetchJson(`/field/api/postal-lookup?zipcode=${encodeURIComponent(zipcode)}`);
}

function normalizeField(f) {
  const owner = f.user || {};
  return {
    id: f.id ?? '',
    name: f.name ?? '',
    fieldCode: f.fieldCode ?? '',
    latitude: f.latitude,
    longitude: f.longitude,
    area: f.area,
    postalCode: f.postalCode ?? '',
    address: f.address ?? '',
    note: f.note ?? '',
    updatedAt: f.updatedAt ?? '',
    ownerID: owner.id ?? '',
    ownerName: owner.farmName || fullName(owner) || owner.email || '',
    fieldTypeID: f.fieldType?.id ?? '',
    fieldTypeName: f.fieldType?.name ?? '',
    fieldStateID: f.fieldState?.id ?? '',
    fieldStateDescription: f.fieldState?.description || f.fieldState?.name || '',
  };
}

function fullName(user) {
  const name = [user?.lastName, user?.firstName].filter(Boolean).join(' ');
  return name || '';
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toFieldCardHtml(field) {
  return `
    <article class="field-card" data-field-id="${esc(field.id)}">
      <div class="field-card-header">
        <div class="field-name-wrap">
          <div class="field-name-row">
            <div class="field-name">${esc(field.name || '（名称なし）')}</div>
            ${field.area != null && field.area !== '' ? `<div class="field-area-inline">面積：${esc(field.area)}㎡</div>` : ''}
          </div>
        </div>
      </div>
      <div class="field-pill-row">
        ${field.fieldTypeName ? `<span class="pill pill-type">${esc(field.fieldTypeName)}</span>` : ''}
        ${field.fieldStateDescription ? `<span class="pill pill-status-active">${esc(field.fieldStateDescription)}</span>` : ''}
        ${field.ownerName ? `<span class="pill">${esc(field.ownerName)}</span>` : ''}
      </div>
      <div class="field-meta-row">
        <div class="field-meta-left">
          <div class="field-address">${esc(field.address || '')}</div>
        </div>
      </div>
    </article>
  `;
}

function populateOwnerFilter(selectEl, fields, owners) {
  if (!selectEl) return;
  const current = String(selectEl.value || '');
  const list = (Array.isArray(owners) && owners.length)
    ? owners.map((x) => ({ id: String(x.id || ''), name: x.name || '' })).filter((x) => x.id && x.name)
    : Array.from(new Map(fields.filter((x) => x.ownerID).map((x) => [String(x.ownerID), x.ownerName || ''])).entries()).map(([id, name]) => ({ id, name }));
  selectEl.innerHTML = '<option value="">すべてのオーナー</option>' + list.map((x) => `<option value="${esc(x.id)}">${esc(x.name || x.id)}</option>`).join('');
  if (list.some((x) => x.id === current)) selectEl.value = current;
}

function populateOwnerSelect(selectEl, owners) {
  if (!selectEl) return;
  const current = String(selectEl.value || '');
  const list = Array.isArray(owners) ? owners.filter((x) => x?.id && x?.name) : [];
  selectEl.innerHTML = '<option value="">選択してください</option>' + list.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
  if (list.some((x) => String(x.id) === current)) selectEl.value = current;
}

function populateTypeFilter(selectEl, masters, fields) {
  if (!selectEl) return;
  const current = selectEl.value;
  const source = masters.length ? masters.map((x) => ({ id: x.id, label: x.name })) : uniqBy(fields.filter((x) => x.fieldTypeID), (x) => String(x.fieldTypeID)).map((x) => ({ id: x.fieldTypeID, label: x.fieldTypeName }));
  selectEl.innerHTML = '<option value="">すべての種別</option>' + source.map((x) => `<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('');
  if (source.some((x) => String(x.id) === current)) selectEl.value = current;
}

function populateStateFilter(selectEl, masters, fields) {
  if (!selectEl) return;
  const current = selectEl.value;
  const source = masters.length ? masters.map((x) => ({ id: x.id, label: x.description || x.name })) : uniqBy(fields.filter((x) => x.fieldStateID), (x) => String(x.fieldStateID)).map((x) => ({ id: x.fieldStateID, label: x.fieldStateDescription }));
  selectEl.innerHTML = '<option value="">すべての状態</option>' + source.map((x) => `<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('');
  if (source.some((x) => String(x.id) === current)) selectEl.value = current;
}

function populateDetailSelect(selectEl, masters, kind) {
  if (!selectEl) return;
  const current = selectEl.value;
  let options = [];
  if (kind === 'type') {
    options = masters.map((x) => ({ id: x.id, label: x.name }));
  } else {
    options = masters.map((x) => ({ id: x.id, label: x.description || x.name }));
  }
  if (!options.length) return;
  selectEl.innerHTML = options.map((x) => `<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('');
  if (options.some((x) => String(x.id) === current)) selectEl.value = current;
}

function setSelectValue(selectEl, value) {
  if (!selectEl) return;
  const exists = Array.from(selectEl.options).some((opt) => String(opt.value) === String(value));
  if (exists) {
    selectEl.value = String(value);
  }
}

function uniqBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) map.set(keyFn(item), item);
  return Array.from(map.values());
}

async function gqlPost(query, variables = {}) {
  const res = await fetch('/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json?.errors?.length) {
    throw new Error(json?.errors?.[0]?.message || `HTTP ${res.status}`);
  }
  return json.data || {};
}

async function fetchFields({ userId, isRole1 }) {
  const query = `
    query FindFields($ownerID: ID) {
      findFields(ownerID: $ownerID) {
        id
        fieldCode
        name
        latitude
        longitude
        area
        postalCode
        address
        note
        user {
          id
          farmName
          firstName
          lastName
          email
        }
        fieldType {
          id
          name
        }
        fieldState {
          id
          name
          description
        }
      }
    }
  `;
  const variables = {};
  if (!isRole1 && userId) variables.ownerID = String(userId);
  const data = await gqlPost(query, variables);
  return data.findFields || [];
}

async function fetchOwners() {
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
  const data = await gqlPost(query, { roleID: '2' });
  const list = Array.isArray(data.findUsers) ? data.findUsers : [];
  return list
    .map((u) => ({
      id: String(u?.id || '').trim(),
      name: String(u?.farmName || '').trim(),
    }))
    .filter((u) => u.id && u.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

async function fetchFieldTypes() {
  const query = `
    query FieldTypes {
      fieldTypes {
        id
        name
        sortOrder
      }
    }
  `;
  const data = await gqlPost(query, {});
  return data.fieldTypes || [];
}

async function fetchFieldStates() {
  const query = `
    query FieldStates {
      fieldStates {
        id
        name
        description
      }
    }
  `;
  const data = await gqlPost(query, {});
  return data.fieldStates || [];
}


async function updateFieldMutation(id, input) {
  const query = `
    mutation UpdateField($id: ID!, $input: UpdateFieldInput!) {
      updateField(id: $id, input: $input) {
        id
        fieldCode
        name
        latitude
        longitude
        area
        postalCode
        address
        note
        user {
          id
          farmName
          firstName
          lastName
          email
        }
        fieldType {
          id
          name
        }
        fieldState {
          id
          name
          description
        }
      }
    }
  `;

  const variables = {
    id: String(id),
    input: {
      userID: String(input.userID),
      fieldTypeID: String(input.fieldTypeID),
      fieldStateID: String(input.fieldStateID),
      name: String(input.name),
      latitude: Number(input.latitude),
      longitude: Number(input.longitude),
      postalCode: String(input.postalCode),
      address: String(input.address),
    }
  };

  if (input.fieldCode) variables.input.fieldCode = String(input.fieldCode);
  if (Number.isFinite(input.area)) variables.input.area = Number(input.area);
  if (input.note) variables.input.note = String(input.note);

  const data = await gqlPost(query, variables);
  return data.updateField || null;
}

async function createFieldMutation(input) {
  const query = `
    mutation CreateField($input: CreateFieldInput!) {
      createField(input: $input) {
        id
        fieldCode
        name
        latitude
        longitude
        area
        postalCode
        address
        note
        user {
          id
          farmName
          firstName
          lastName
          email
        }
        fieldType {
          id
          name
        }
        fieldState {
          id
          name
          description
        }
      }
    }
  `;

  const variables = {
    input: {
      userID: String(input.userID),
      fieldTypeID: String(input.fieldTypeID),
      fieldStateID: String(input.fieldStateID),
      name: String(input.name),
      latitude: Number(input.latitude),
      longitude: Number(input.longitude),
      postalCode: String(input.postalCode),
      address: String(input.address),
    }
  };

  if (input.fieldCode) variables.input.fieldCode = String(input.fieldCode);
  if (Number.isFinite(input.area)) variables.input.area = Number(input.area);
  if (input.note) variables.input.note = String(input.note);

  const data = await gqlPost(query, variables);
  return data.createField || null;
}
