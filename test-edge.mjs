const base = "http://localhost:3001/api/v1";
async function post(path, body, token) {
  const r = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
}
async function get(path, token) {
  const r = await fetch(base + path, { headers: { Authorization: "Bearer " + token } });
  return { status: r.status, data: await r.json() };
}
(async () => {
  const login = await post("/auth/login", { login: "admin@nsvilla.com", password: "Admin@NSVilla2026!" });
  const token = login.data?.data?.tokens?.accessToken;
  if (!token) { console.log("LOGIN FAIL"); return; }
  
  const futureDate = new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10); // 10 days in future
  console.log("Testing far future date (no register):");
  const r = await get(`/cash-register?businessDate=${futureDate}`, token);
  console.log("  carriedIntoToday:", r.data?.data?.carriedIntoToday);
  console.log("  autoCarriedForward:", r.data?.data?.autoCarriedForward);
  console.log("  carriedFromDate:", r.data?.data?.carriedFromDate);
  console.log("  expectedCash:", r.data?.data?.expectedCash);
})();
