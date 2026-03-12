const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { getWeeklyForecast } = require('../services/weather');
const { callUpstreamGraphQL } = require('../services/gql');
const { findAuthContextByUserId } = require('../models/user');

const router = express.Router();

async function refreshSessionUserFields(req) {
  const sessionUser = req.session?.user || null;
  if (!sessionUser?.id) return sessionUser;
  try {
    const ctx = await findAuthContextByUserId(sessionUser.id);
    if (!ctx?.user) return sessionUser;
    req.session.user = {
      ...req.session.user,
      ...ctx.user,
      org: ctx.org || null,
      fields: Array.isArray(ctx.fields) ? ctx.fields : [],
    };
    const freshFields = Array.isArray(req.session.user.fields) ? req.session.user.fields : [];
    const selectedFieldId = req.session.selectedFieldId ? Number(req.session.selectedFieldId) : NaN;
    if (freshFields.length === 0) {
      delete req.session.selectedFieldId;
    } else if (!Number.isNaN(selectedFieldId) && !freshFields.some((f) => Number(f.id) === selectedFieldId)) {
      req.session.selectedFieldId = Number(freshFields[0].id);
    }
    return req.session.user;
  } catch (err) {
    console.error('[top] session field refresh failed:', err);
    return sessionUser;
  }
}


function formatDateTimeLabel(value) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}


async function fetchWorkTypeSummary(req) {
  const endpoint = process.env.GRAPHQL_ENDPOINT;
  if (!endpoint) return [];

  const headers = {};
  if (req.session?.token) headers.authorization = `Bearer ${req.session.token}`;
  if (process.env.GRAPHQL_API_KEY) headers['x-api-key'] = process.env.GRAPHQL_API_KEY;

  const query = `
    query WorkTypeSummary {
      workTypeSummary {
        workType {
          id
          name
          sortOrder
        }
        today
        yesterday
        thisWeek
        lastWeek
        thisMonth
      }
    }
  `;

  try {
    const result = await callUpstreamGraphQL({ endpoint, query, headers });
    if (result?.json?.errors?.length) {
      console.error('[top] workTypeSummary errors:', result.json.errors);
      return [];
    }

    const items = Array.isArray(result?.json?.data?.workTypeSummary)
      ? result.json.data.workTypeSummary
      : [];

    return items.map((item) => ({
      id: Number(item?.workType?.id ?? 0),
      name: String(item?.workType?.name || '').trim() || '未設定',
      sortOrder: Number(item?.workType?.sortOrder ?? 0),
      today: Number(item?.today ?? 0),
      thisWeek: Number(item?.thisWeek ?? 0),
      thisMonth: Number(item?.thisMonth ?? 0),
      yesterday: Number(item?.yesterday ?? 0),
      lastWeek: Number(item?.lastWeek ?? 0),
    }));
  } catch (err) {
    console.error('[top] workTypeSummary fetch failed:', err);
    return [];
  }
}

async function fetchLatestWorkReports(req) {
  const endpoint = process.env.GRAPHQL_ENDPOINT;
  if (!endpoint) return [];

  const headers = {};
  if (req.session?.token) headers.authorization = `Bearer ${req.session.token}`;
  if (process.env.GRAPHQL_API_KEY) headers['x-api-key'] = process.env.GRAPHQL_API_KEY;

  const query = `
    query LatestWorkReports($count: Int!) {
      latestWorkReports(count: $count) {
        id
        workDate
        workHours
        workDetail
        workType {
          id
          name
        }
        field {
          id
          name
        }
        user {
          firstName
          lastName
        }
      }
    }
  `;

  try {
    const result = await callUpstreamGraphQL({
      endpoint,
      query,
      variables: { count: 3 },
      headers,
    });
    if (result?.json?.errors?.length) {
      console.error('[top] latestWorkReports errors:', result.json.errors);
      return [];
    }
    const list = Array.isArray(result?.json?.data?.latestWorkReports) ? result.json.data.latestWorkReports : [];
    const today = new Date();
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return list.map((item) => {
      //const workDetail = String(item?.workDetail || '').trim();
      const workTypeName = String(item?.workType?.name || '').trim();
      const title = (/*workDetail.split(/\r?\n/)[0] || */workTypeName || '日報').trim();
      const firstName = String(item?.user?.firstName || '').trim();
      const lastName = String(item?.user?.lastName || '').trim();
      const workerName = [lastName, firstName].filter(Boolean).join(' ') || '—';
      const workDate = String(item?.workDate || '');
      return {
        id: item?.id || '',
        workDate,
        datetimeLabel: formatDateTimeLabel(workDate),
        fieldName: String(item?.field?.name || '—'),
        title: title || '日報',
        workerName,
        workHours: item?.workHours != null ? Number(item.workHours) : null,
        isToday: workDate.slice(0, 10) === todayYmd,
      };
    });
  } catch (err) {
    console.error('[top] latestWorkReports fetch failed:', err);
    return [];
  }
}

// TOP is protected
router.use(requireAuth);

// 圃場切替はクエリ文字列を使わず、POST + session に保存する
router.post('/select-field', async (req, res) => {
  await refreshSessionUserFields(req);
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
  await refreshSessionUserFields(req);
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

  const [latestReports, workTypeSummary] = await Promise.all([
    fetchLatestWorkReports(req),
    fetchWorkTypeSummary(req),
  ]);

  return res.render('pages/top', {
    title: 'トップ',
    user,
    activeKey: 'top',
    fields,
    selectedFieldId: Number.isNaN(selectedFieldId) ? null : selectedFieldId,
    weather,
    latestReports,
    workTypeSummary,
  });
});

module.exports = router;
