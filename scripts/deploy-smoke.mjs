import assert from "node:assert/strict";

const base = new URL(process.argv[2] || "");
const simulated = process.argv.includes("--simulate-https-proxy");
if (simulated && !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))
  throw new Error("Proxy simulation is restricted to local CI containers.");
if (!simulated && base.protocol !== "https:") throw new Error("Hosted smoke checks require HTTPS.");
const headers = simulated ? { "X-Forwarded-Proto": "https" } : {};
let response;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    response = await fetch(new URL("/health", base), {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) break;
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
assert(response?.ok, "Public healthcheck did not reach the private API/database.");
const csrf = await fetch(new URL("/sanctum/csrf-cookie", base), { headers });
assert.equal(csrf.status, 204);
const cookies = csrf.headers.getSetCookie();
assert(
  cookies.some(
    (c) => c.startsWith("thuthanh_em3_session=") && /; Secure/i.test(c) && /; HttpOnly/i.test(c),
  ),
  "Secure session cookie missing through web proxy.",
);
assert(cookies.some((c) => c.startsWith("XSRF-TOKEN=") && /; Secure/i.test(c)));
const ipn = await fetch(new URL("/api/v1/payments/vnpay/ipn", base), { headers });
assert.equal(
  (await ipn.json()).RspCode,
  "97",
  "Unsigned IPN must be rejected, never accepted as payment.",
);
const home = await fetch(base, { headers });
assert.equal(home.status, 200);
console.log(
  "Deployment smoke passed: web, private API/database, HTTPS cookies and unsigned-IPN rejection.",
);
