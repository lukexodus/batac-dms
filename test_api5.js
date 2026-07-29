async function main() {
  const loginRes = await fetch('http://localhost:3000/api/trpc/iam.login?batch=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 0: { username: 'secretary.lagura', password: 'BatacDemo2026!' } })
  });
  const loginData = await loginRes.json();
  const token = loginData[0].result.data.json.token; // TRPC standard response for login
  
  const queryUrl = 'http://localhost:3000/api/trpc/organization.listEmployees?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22limit%22%3A25%7D%7D%7D';
  const res = await fetch(queryUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
main().catch(console.error);
