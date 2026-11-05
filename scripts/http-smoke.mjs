import assert from "node:assert/strict";
const origin = process.env.EM3_ORIGIN || "http://localhost:3001";
const api = async (path) => {
  const r = await fetch(origin + path);
  assert.equal(r.status, 200, path);
  return r.json();
};
const products = await api("/api/v1/products?per_page=1");
assert.ok(products.meta.pagination.total >= 1);
assert.ok(products.meta.request_id);
const home = await api("/api/v1/storefront");
assert.ok(Array.isArray(home.data.categories));
assert.ok(Array.isArray(home.data.recommended));
const ipn = await api("/api/v1/payments/vnpay/ipn");
assert.deepEqual(ipn, { RspCode: "97", Message: "Invalid signature" });
const anonymous = await fetch(origin + "/api/v1/auth/me");
assert.equal(anonymous.status, 401);
const csrf = await fetch(origin + "/sanctum/csrf-cookie");
assert.equal(csrf.status, 204);
assert.ok(csrf.headers.getSetCookie().some((c) => c.startsWith("XSRF-TOKEN=")));
const forbidden = await fetch(origin + "/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
assert.equal(forbidden.status, 419);
const image = home.data.new.find((p) => p.images.length)?.images[0]?.url;
if (image) assert.equal((await fetch(origin + image)).status, 200);
assert.equal((await fetch(origin + "/")).status, 200);
console.log(
  "HTTP proxy smoke: 8 checks passed (catalog, storefront, IPN signature, auth, CSRF cookie, CSRF enforcement, image, page).",
);
