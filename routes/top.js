const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { getWeeklyForecast } = require('../services/weather');

const router = express.Router();

// TOP is protected
router.use(requireAuth);

// 圃場切替はクエリ文字列を使わず、POST + session に保存する
router.post('/select-field', (req, res) => {
  const user = req.session.user || null;
  const roleType = user ? Number(user.role_id ?? user.role_type ?? user.roleType ?? user.roleId) : NaN;
  const fields = Array.isArray(user?.fields) ? user.fields : [];
  const requestedFieldId = Number(req.body?.field_id);

  // role=1 は現時点では組織軸表示。圃場切替は無効化。
  if (roleType === 1) {
    return res.redirect('/top');
  }

  const allowedField = fields.find((f) => Number(f.id) === requestedFieldId);

  if (allowedField) {
    req.session.selectedFieldId = Number(allowedField.id);
  } else if (fields.length > 0) {
    // 不正値や存在しない値は安全側で先頭圃場に戻す
    req.session.selectedFieldId = Number(fields[0].id);
  } else {
    delete req.session.selectedFieldId;
  }

  return res.redirect('/top');
});

router.get('/', async (req, res) => {
  const user = req.session.user || null;
  const endpoint = process.env.GRAPHQL_ENDPOINT;

  const roleType = user ? Number(user.role_id ?? user.role_type ?? user.roleType ?? user.roleId) : NaN;
  const org = user?.org || null;
  const fields = Array.isArray(user?.fields) ? user.fields : [];

    const selectedFieldId = req.session.selectedFieldId ? Number(req.session.selectedFieldId) : NaN;
  const selectedField =
    (!Number.isNaN(selectedFieldId) ? fields.find((f) => Number(f.id) === selectedFieldId) : null) ||
    fields[0] ||
    null;

  // NOTE: org has no lat/lon yet. fallback to selected field.
  const orgLat = org?.latitude ?? org?.lat ?? null;
  const orgLon = org?.longitude ?? org?.lon ?? null;

  const fieldLat = selectedField?.latitude ?? selectedField?.lat ?? null;
  const fieldLon = selectedField?.longitude ?? selectedField?.lon ?? null;

  const latitude = (roleType === 1) ? (orgLat ?? fieldLat) : fieldLat;
  const longitude = (roleType === 1) ? (orgLon ?? fieldLon) : fieldLon;

  const locationLabel =
    (roleType === 1)
      ? (org?.name ? `組織：${org.name}` : '組織')
      : (selectedField?.name ? `圃場：${selectedField.name}` : '圃場');

  // headers to upstream GraphQL (optional auth/apikey)
  const headers = {};
  if (req.session?.token) headers.authorization = `Bearer ${req.session.token}`;
  if (process.env.GRAPHQL_API_KEY) headers['x-api-key'] = process.env.GRAPHQL_API_KEY;

  let weather = { ok: false, locationLabel, periodLabel: '', days: [], error: '' };

  if (!endpoint) {
    weather.error = 'GRAPHQL_ENDPOINT が未設定です';
  } else if (latitude == null || longitude == null) {
    weather.error = '緯度・経度が未設定です';
  } else {
    try {
      const weekly = await getWeeklyForecast({ endpoint, latitude, longitude, headers, days: 7 });
      const days = weekly.days || [];
      const periodLabel = (days.length >= 2)
        ? `${days[0].md} 〜 ${days[days.length - 1].md}`
        : (days[0]?.md || '');

      weather = {
        ok: weekly.ok,
        locationLabel,
        periodLabel,
        days,
        error: weekly.ok ? '' : '天気情報を取得できませんでした',
      };
    } catch (e) {
      console.error('[top] weather error:', e);
      weather.error = '天気情報の取得中にエラーが発生しました';
    }
  }

  return res.render('pages/top', {
    title: 'トップ',
    user,
    activeKey: 'top',
    fields,
    selectedFieldId: Number.isNaN(selectedFieldId) ? null : selectedFieldId,
    weather,
  });
});

module.exports = router;
