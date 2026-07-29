const fetch = require('node:fetch');

async function main() {
  // We need to login as secretary.lagura first
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'secretary.lagura', password: 'BatacDemo2026!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token; // adjust if it's stored differently, or just use the cookie

  // Actually, Batac uses session cookies or something? Let's check headers
  const setCookie = loginRes.headers.get('set-cookie');
  
  const queryUrl = 'http://localhost:3000/api/trpc/organization.listEmployees?batch=1&input=%7B%220%22%3A%7B%22limit%22%3A25%7D%7D';
  const res = await fetch(queryUrl, {
    headers: { 'cookie': setCookie }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
main().catch(console.error);
