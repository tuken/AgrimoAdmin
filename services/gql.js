const { getRequestContext } = require('../middleware/requestContext');

/**
 * Call upstream GraphQL endpoint.
 * Automatically injects session cookie if available in request context.
 * (Upstream requested: Cookie: session=<id>)
 */
async function callUpstreamGraphQL({ endpoint, query, variables, headers }) {
  if (!endpoint) throw new Error('GraphQL endpoint is not set');

  const ctx = getRequestContext();
  const autoHeaders = {};

  if (ctx && ctx.sessionId) {
    // Use cookie-based session propagation
    autoHeaders.Cookie = `session=${ctx.sessionId}`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      ...autoHeaders,
      ...(headers || {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();

  // GraphQL should return JSON, but some endpoints may return HTML on misconfig.
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = null;
  }

  return { res, text, json };
}

module.exports = { callUpstreamGraphQL };
