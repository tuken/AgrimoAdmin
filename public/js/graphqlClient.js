async function gql(query, variables = {}) {
  const res = await fetch('/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = json?.errors?.[0]?.message || json?.text || `${res.status} ${res.statusText}`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json || {};
}
window.gql = gql;
