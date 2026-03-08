const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { findOrgById } = require('../models/user');

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }
  return { res, text, json };
}

const router = express.Router();
router.use(requireAuth);

router.get('/field_list', async (req, res) => {
  const sessionUser = req.session.user || null;
  let freshOrg = null;

  try {
    if (sessionUser && sessionUser.org_id) {
      freshOrg = await findOrgById(sessionUser.org_id);
      if (freshOrg) {
        req.session.user = {
          ...(req.session.user || {}),
          org: freshOrg,
        };
      }
    }
  } catch (err) {
    console.error('field_list org refresh failed:', err);
  }

  const user = req.session.user || sessionUser || null;
  const org = freshOrg || user?.org || null;
  const orgLat = org?.latitude ?? org?.lat ?? '';
  const orgLng = org?.longitude ?? org?.lon ?? '';

  res.render('pages/field_list', {
    title: '圃場一覧',
    user,
    orgLat,
    orgLng,
    activeKey: 'field'
  });
});


router.get('/field/api/postal-lookup', async (req, res) => {
  try {
    const zipcode = String(req.query.zipcode || '').replace(/\D/g, '').slice(0, 7);
    if (zipcode.length !== 7) return res.status(400).json({ error: '郵便番号は7桁で入力してください。' });

    const url = `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${encodeURIComponent(zipcode)}`;
    const { res: upstream, json } = await fetchJson(url, {
      headers: { accept: 'application/json' },
    });

    if (!upstream.ok) return res.status(502).json({ error: '郵便番号検索APIの呼び出しに失敗しました。' });
    if (!json || json.status !== 200) return res.status(502).json({ error: json?.message || '郵便番号検索APIの応答が不正です。' });

    const hit = Array.isArray(json.results) ? json.results[0] : null;
    if (!hit) return res.status(404).json({ error: '該当する住所が見つかりませんでした。' });

    const address = [hit.address1, hit.address2, hit.address3].filter(Boolean).join('');
    return res.json({
      ok: true,
      zipcode: hit.zipcode || zipcode,
      address,
      prefecture: hit.address1 || '',
      city: hit.address2 || '',
      town: hit.address3 || '',
    });
  } catch (err) {
    console.error('postal lookup failed:', err);
    return res.status(500).json({ error: '郵便番号から住所を取得できませんでした。' });
  }
});

router.get('/field/api/geocode', async (req, res) => {
  try {
    const address = String(req.query.address || '').trim();
    const postalCode = String(req.query.postalCode || '').replace(/\D/g, '').slice(0, 7);
    const prefecture = String(req.query.prefecture || '').trim();
    const city = String(req.query.city || '').trim();
    const town = String(req.query.town || '').trim();
    if (!address && !postalCode) return res.status(400).json({ error: '住所を指定してください。' });

    const candidates = buildGeocodeCandidates({ address, postalCode, prefecture, city, town });

    let hit = null;
    for (const candidate of candidates) {
      const found = await queryNominatim(candidate);
      if (found) {
        hit = found;
        break;
      }
    }

    if (!hit) return res.status(404).json({ error: '住所に一致する位置情報が見つかりませんでした。' });

    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(502).json({ error: '位置情報の形式が不正です。' });
    }

    return res.json({ ok: true, lat, lng, displayName: hit.display_name || '' });
  } catch (err) {
    console.error('geocode failed:', err);
    return res.status(500).json({ error: '住所から緯度経度を取得できませんでした。' });
  }
});

async function queryNominatim(query) {
  if (!query) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=jp&q=${encodeURIComponent(query)}`;
  const { res: upstream, json } = await fetchJson(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'AglimoAdmin/1.0 (field geocode)',
    },
  });
  if (!upstream.ok) {
    throw new Error('住所から緯度経度を取得できませんでした。');
  }
  return Array.isArray(json) ? (json[0] || null) : null;
}

function buildGeocodeCandidates({ address, postalCode, prefecture, city, town }) {
  const raw = [
    address,
    address ? `日本 ${address}` : '',
    [prefecture, city, town].filter(Boolean).join(''),
    [prefecture, city].filter(Boolean).join(''),
    postalCode ? `${postalCode} Japan` : '',
    postalCode ? `〒${postalCode}` : '',
  ];

  const normalized = raw
    .map(normalizeGeocodeText)
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function normalizeGeocodeText(value) {
  let v = String(value || '').trim();
  if (!v) return '';
  v = v.replace(/[　\s]+/g, ' ');
  v = v.replace(/〒\s*/g, '');
  return v.trim();
}

module.exports = router;
