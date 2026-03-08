async function gql(query, variables = {}) {
  const res = await fetch('/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  return res.json();
}

async function gqlMultipart(query, variables = {}, files = {}) {
  const form = new FormData();
  const operations = { query, variables: { ...(variables || {}) } };
  const map = {};
  let idx = 0;

  Object.entries(files || {}).forEach(([varPath, file]) => {
    if (!file) return;
    const key = String(idx++);
    map[key] = [`variables.${varPath}`];
  });

  form.append('operations', JSON.stringify(operations));
  form.append('map', JSON.stringify(map));

  Object.entries(files || {}).forEach(([varPath, file]) => {
    if (!file) return;
    const key = String(Object.keys(map).find(k => (map[k] || [])[0] === `variables.${varPath}`));
    form.append(key, file, file.name || 'upload.bin');
  });

  const res = await fetch('/graphql', {
    method: 'POST',
    body: form,
  });
  return res.json();
}

window.gql = gql;
window.gqlMultipart = gqlMultipart;
