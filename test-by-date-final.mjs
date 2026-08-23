const base = "http://localhost:3001/api/v1";

async function get(path, token) {
  const r = await fetch(base + path, { headers: { Authorization: "Bearer " + token } });
  return { status: r.status, data: await r.json() };
}

async function main() {
  const login = await fetch("http://localhost:3001/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: "admin@nsvilla.com", password: "Admin@NSVilla2026!" })
  });
  const loginData = await login.json();
  const token = loginData.data?.tokens?.accessToken;
  if (!token) { console.log("LOGIN FAIL"); return; }
  console.log("Token:", token.substring(0, 30) + "...");

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  console.log("=== CASH BY DATE ===\n");

  for (const d of [yesterday, today, tomorrow]) {
    const r = await fetch(`http://localhost:3001/api/v1/cash-register?businessDate=${d}`, { headers: { Authorization: "Bearer " + token } });
    const res = await r.json();
    console.log(`${d}: carried=${res.data?.data?.carriedIntoToday ?? 'null'} expected=${res.data?.data?.expectedCash ?? 'null'} entries=${res.data?.data?.entries?.length ?? 0}`);
  }
})();