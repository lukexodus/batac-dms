const crypto = require('crypto');

async function run() {
  const code_verifier = crypto.randomBytes(32).toString('base64url');
  const code_challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');

  // Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'secretary.lagura@batac.gov.ph',
      password: 'BatacDemo2026!',
      code_verifier,
      code_challenge,
      code_challenge_method: 'S256'
    })
  });
  
  if (!loginRes.ok) {
    console.error('Login failed:', loginRes.status, await loginRes.text());
    return;
  }
  
  const setCookie = loginRes.headers.get('set-cookie');
  if (!setCookie) {
    console.error('No set-cookie header');
    return;
  }
  
  console.log('--- documents.documentTypes Request/Response ---');
  const typeRes = await fetch('http://localhost:3000/api/trpc/documents.documentTypes', {
    headers: { 'Cookie': setCookie }
  });
  const typeData = await typeRes.json();
  const types = typeData.result.data;
  console.log('Result count:', types.length);
  const measureTypeIds = types.filter(t => ['SP_RESOLUTION', 'SP_ORDINANCE', 'SP_APPROPRIATION_ORDINANCE'].includes(t.code)).map(t => t.id);
  console.log('Filtered measureTypeIds:', measureTypeIds);
  
  if (measureTypeIds.length === 0) {
    console.log('No measureTypeIds found, skipping search.');
    return;
  }

  console.log('\n--- documents.search Request/Response ---');
  const inputParams = {
    "0": {
      "json": {
        "queryText": "",
        "documentTypeIds": measureTypeIds,
        "limit": 100
      }
    }
  };
  const searchUrl = `http://localhost:3000/api/trpc/documents.search?batch=1&input=${encodeURIComponent(JSON.stringify(inputParams))}`;
  console.log('Search URL:', searchUrl);
  
  const searchRes = await fetch(searchUrl, {
    headers: { 'Cookie': setCookie }
  });
  console.log('Search HTTP Status:', searchRes.status);
  const searchData = await searchRes.json();
  console.log('Search Data:', JSON.stringify(searchData, null, 2));
}

run().catch(console.error);
