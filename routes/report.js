const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { callUpstreamGraphQL } = require('../services/gql');
const { findAuthContextByUserId } = require('../models/user');
const { getWeatherCodes } = require('../services/weather');

const router = express.Router();
router.use(requireAuth);

async function refreshSessionUserFields(req) {
  const sessionUser = req.session?.user || null;
  if (!sessionUser?.id) return;
  try {
    const ctx = await findAuthContextByUserId(sessionUser.id);
    if (!ctx?.user) return;
    req.session.user = {
      ...req.session.user,
      ...ctx.user,
      org: ctx.org || null,
      fields: Array.isArray(ctx.fields) ? ctx.fields : [],
    };
  } catch (err) {
    console.error('[report_list] session field refresh failed:', err);
  }
}

const WORK_TYPES_QUERY = `
query wt {
  workTypes { id name }
}
`;

const CROP_ITEMS_QUERY = `
query ci {
  cropItems { id name }
}
`;

const CROP_VARIETIES_QUERY = `
query cv($itemID: ID!) {
  cropVarieties(itemID: $itemID) {
    id
    name
    sortOrder
  }
}
`;


router.get('/api/crop-varieties', async (req, res) => {
  const endpoint = process.env.GRAPHQL_ENDPOINT;
  const itemID = String(req.query.itemID || '').trim();

  if (!itemID) return res.json({ ok: true, items: [] });
  if (!endpoint) return res.status(500).json({ ok: false, items: [], message: 'GRAPHQL_ENDPOINT is not set' });

  try {
    const r = await callUpstreamGraphQL({
      endpoint,
      query: CROP_VARIETIES_QUERY,
      variables: { itemID },
    });

    if (r?.json?.errors?.length) {
      console.error('[report] cropVarieties errors:', r.json.errors);
      return res.status(502).json({ ok: false, items: [], errors: r.json.errors });
    }

    const list = Array.isArray(r?.json?.data?.cropVarieties) ? r.json.data.cropVarieties : [];
    list.sort((a, b) => Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0) || Number(a?.id ?? 0) - Number(b?.id ?? 0));
    return res.json({ ok: true, items: list });
  } catch (e) {
    console.error('[report] cropVarieties fetch failed:', e);
    return res.status(500).json({ ok: false, items: [], message: 'Failed to fetch crop varieties' });
  }
});

router.get('/report_list', async (req, res) => {
  await refreshSessionUserFields(req);
  const endpoint = process.env.GRAPHQL_ENDPOINT;

  // Weather codes (code -> japanese)
  let weatherCodes = [];
  try {
    const map = await getWeatherCodes({ endpoint });
    if (map && typeof map === 'object') {
      weatherCodes = Object.entries(map)
        .map(([code, japanese]) => ({ code: String(code), japanese: String(japanese || '') }))
        .sort((a, b) => Number(a.code) - Number(b.code));
    }
  } catch (e) {
    console.error('[report_list] getWeatherCodes failed:', e);
  }

  // Work types master
  let workTypes = [];
  try {
    if (endpoint) {
      const r = await callUpstreamGraphQL({ endpoint, query: WORK_TYPES_QUERY, variables: {} });
      const list = r?.json?.data?.workTypes;
      if (Array.isArray(list)) workTypes = list;
      if (r?.json?.errors?.length) console.error('[report_list] workTypes errors:', r.json.errors);
    }
  } catch (e) {
    console.error('[report_list] workTypes fetch failed:', e);
  }

  // Crop items master
  let cropItems = [];
  try {
    if (endpoint) {
      const r = await callUpstreamGraphQL({ endpoint, query: CROP_ITEMS_QUERY, variables: {} });
      const list = r?.json?.data?.cropItems;
      if (Array.isArray(list)) cropItems = list;
      if (r?.json?.errors?.length) console.error('[report_list] cropItems errors:', r.json.errors);
    }
  } catch (e) {
    console.error('[report_list] cropItems fetch failed:', e);
  }

  res.render('pages/report_list', {
    title: '日報一覧',
    user: req.session.user || null,
    activeKey: 'report',
    pageCss: 'report',
    pageJs: 'report',
    weatherCodes,
    workTypes,
    cropItems,
  });
});

module.exports = router;
