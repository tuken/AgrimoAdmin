/**
 * Minimal GraphQL client for upstream endpoint.
 * - Forwards Authorization from session.token when present
 * - Optionally forwards GRAPHQL_API_KEY as x-api-key
 */
async function callUpstreamGraphQL({ endpoint, query, variables, headers }) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify({ query, variables })
  });

  const text = await res.text();
  // Upstream might not always return JSON; guard
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, json: { errors: [{ message: 'Upstream did not return JSON', raw: text }] } };
  }
}

module.exports = { callUpstreamGraphQL };
