const { getRequestContext } = require('../middleware/requestContext');
const http = require('http');
const https = require('https');

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

async function callUpstreamGraphQLRaw({ endpoint, req, headers }) {
  if (!endpoint) throw new Error('GraphQL endpoint is not set');

  const ctx = getRequestContext();
  const autoHeaders = {};

  if (ctx && ctx.sessionId) {
    autoHeaders.Cookie = `session=${ctx.sessionId}`;
  }

  const url = new URL(endpoint);
  const transport = url.protocol === 'https:' ? https : http;
  const contentType = req.headers['content-type'];
  const contentLength = req.headers['content-length'];

  return new Promise((resolve, reject) => {
    const upstreamReq = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search || ''}`,
        method: 'POST',
        headers: {
          ...(contentType ? { 'content-type': contentType } : {}),
          ...(contentLength ? { 'content-length': contentLength } : {}),
          'accept': 'application/json',
          ...autoHeaders,
          ...(headers || {}),
        },
      },
      (upstreamRes) => {
        let text = '';
        upstreamRes.setEncoding('utf8');
        upstreamRes.on('data', (chunk) => {
          text += chunk;
        });
        upstreamRes.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (e) {
            json = null;
          }

          resolve({
            res: { status: upstreamRes.statusCode || 200 },
            text,
            json,
          });
        });
      }
    );

    upstreamReq.on('error', reject);
    req.on('error', reject);
    req.pipe(upstreamReq);
  });
}

module.exports = { callUpstreamGraphQL, callUpstreamGraphQLRaw };
