const express = require('express');
const { callUpstreamGraphQL, callUpstreamGraphQLRaw } = require('../services/gql');
const router = express.Router();

router.post('/', async (req, res) => {
  const endpoint = process.env.GRAPHQL_ENDPOINT;
  if (!endpoint) return res.status(500).json({ errors: [{ message: 'GRAPHQL_ENDPOINT is not set' }] });

  const headers = {};
  if (req.session?.token) headers['authorization'] = `Bearer ${req.session.token}`;
  if (process.env.GRAPHQL_API_KEY) headers['x-api-key'] = process.env.GRAPHQL_API_KEY;

  const contentType = String(req.headers['content-type'] || '').toLowerCase();

  if (contentType.includes('multipart/form-data')) {
    try {
      const result = await callUpstreamGraphQLRaw({
        endpoint,
        req,
        headers,
      });
      const status = result?.res?.status || 200;
      return res.status(status).json(result.json || { errors: [{ message: 'Upstream did not return JSON' }], text: result.text });
    } catch (e) {
      console.error('[graphql] multipart proxy failed:', e);
      return res.status(500).json({ errors: [{ message: e.message || 'Multipart proxy failed' }] });
    }
  }

  const { query, variables } = req.body || {};
  if (!query) return res.status(400).json({ errors: [{ message: 'Missing query' }] });

  const result = await callUpstreamGraphQL({ endpoint, query, variables, headers });

  // callUpstreamGraphQL returns { res, text, json }
  const status = result?.res?.status || 200;
  return res.status(status).json(result.json || { errors: [{ message: 'Upstream did not return JSON' }], text: result.text });
});

module.exports = router;
