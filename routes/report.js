const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { callUpstreamGraphQL } = require('../services/gql');
const { getWeatherCodes } = require('../services/weather');

const router = express.Router();
router.use(requireAuth);

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

router.get('/report_list', async (req, res) => {
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
