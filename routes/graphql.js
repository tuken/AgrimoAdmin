const express = require('express');
const { callUpstreamGraphQL } = require('../services/gql');
const router = express.Router();

router.post('/', async (req, res) => {
  const endpoint = process.env.GRAPHQL_ENDPOINT;
  if (!endpoint) return res.status(500).json({ errors: [{ message: 'GRAPHQL_ENDPOINT is not set' }] });

  const { query, variables } = req.body || {};
  if (!query) return res.status(400).json({ errors: [{ message: 'Missing query' }] });

  const headers = {};
  if (req.session?.token) headers['authorization'] = `Bearer ${req.session.token}`;
  if (process.env.GRAPHQL_API_KEY) headers['x-api-key'] = process.env.GRAPHQL_API_KEY;

  const result = await callUpstreamGraphQL({ endpoint, query, variables, headers });
  return res.status(result.status).json(result.json);
});

module.exports = router;
