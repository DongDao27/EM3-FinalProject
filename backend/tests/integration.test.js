import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcryptjs";
import * as argon2 from "argon2";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { app } from "../src/app.js";
import { config } from "../src/config.js";
import { pool, query, first, insert, update, transaction } from "../src/db.js";
import { now, sha } from "../src/support.js";
import { gateway, VnpayGateway, canonical, vietnamDate } from "../src/vnpay.js";
import { createQuote, checkout, mutateCart, getCart } from "../src/commerce.js";
import {
  closeOrder,
  createAttempt,
  applyPayment,
  refreshOrder,
  collectCash,
} from "../src/payments.js";
import { saveProduct } from "../src/catalog.js";
import { decryptMail, deliverMailBatch } from "../src/mail.js";
import { tick } from "../src/worker.js";
import { createServer } from "node:net";
import { seed } from "../scripts/database.js";
if (config.env !== "test" || config.db.database !== "thu_thanh_em3_test")
  throw new Error("Tests require isolated EM3 test database");
let admin, customer, other, product, second, category, passwordHash;
const password = "Test-only-password-123!";
before(async () => {
  passwordHash = await bcrypt.hash(password, 4);
});
beforeEach(async () => {
  const db = await pool.getConnection();
  try {
    await db.query("SET FOREIGN_KEY_CHECKS=0");
    for (const row of await query("SHOW TABLES", [], db)) {
      const name = Object.values(row)[0];
      if (!["em3_migrations", "migrations"].includes(name))
        await db.query("DELETE FROM `" + name + "`");
    }
    await db.query("SET FOREIGN_KEY_CHECKS=1");
  } finally {
    db.release();
  }
  for (const [name, role] of [
    ["admin", "admin"],
    ["customer", "customer"],
    ["other", "customer"],
  ])
    await insert("users", {
      name,
      email: name + "@em3.test",
      password: passwordHash,
      role,
      created_at: now(),
      updated_at: now(),
    });
  admin = await first("SELECT * FROM users WHERE role='admin'");
  customer = await first("SELECT * FROM users WHERE name='customer'");
  other = await first("SELECT * FROM users WHERE name='other'");
  category = await insert("categories", {
    slug: "sach-giao-khoa",
    name: "Sách giáo khoa",
    is_active: 1,
    sort_order: 0,
    created_at: now(),
    updated_at: now(),
  });
  product = await saveProduct(
    {
      category_id: category,
      sku: "TEST-ONE",
      name: "Sách Một",
      list_price: 10000,
      sale_price: 9000,
      opening_stock: 5,
      is_hot: true,
      is_bestseller: true,
    },
    null,
    admin.id,
  );
  second = await saveProduct(
    {
      category_id: category,
      sku: "TEST-TWO",
      name: "Sách Hai",
      list_price: 20000,
      opening_stock: 3,
    },
    null,
    admin.id,
  );
});
after(async () => {
  await pool.end();
});
async function csrf(agent) {
  const r = await agent.get("/sanctum/csrf-cookie").expect(204);
  return decodeURIComponent(
    r.headers["set-cookie"]
      .find((v) => v.startsWith("XSRF-TOKEN="))
      .split(";")[0]
      .slice(11),
  );
}
async function mutate(agent, method, url, body, key) {
  const token = await csrf(agent);
  let req = agent[method](url).set("X-XSRF-TOKEN", token);
  if (key) req = req.set("Idempotency-Key", key);
  return req.send(body);
}
async function signedIn(name = "customer") {
  const agent = request.agent(app);
  const r = await mutate(agent, "post", "/api/v1/auth/login", {
    identifier: name + "@em3.test",
    password,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return agent;
}
const input = (method = "pickup") => ({
  fulfillment_method: method,
  recipient_name: "Khách EM3",
  recipient_phone: "0912345678",
  ...(method === "delivery"
    ? { address: { address_line: "295 Tôn Đức Thắng", locality: "Hòa Khánh", province: "Đà Nẵng" } }
    : {}),
});
async function makeOrder(user = customer, quantity = 1, method = "pickup") {
  await mutateCart(user.id, "add", { product_id: product.id, quantity });
  const quote = await createQuote(user.id, input(method));
  const r = await checkout(user.id, quote.id, "checkout-" + randomUUID());
  return first("SELECT * FROM orders WHERE order_code=?", [r.order.order_code]);
}
async function attempt(order) {
  return createAttempt(order, order.user_id, "attempt-" + randomUUID());
}
function payload(a, overrides = {}) {
  const p = {
    vnp_TmnCode: config.vnpay.merchant,
    vnp_TxnRef: a.provider_reference,
    vnp_Amount: String(a.requested_amount * 100),
    vnp_TransactionNo: "123456789",
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_PayDate: vietnamDate(now()),
    ...overrides,
  };
  p.vnp_SecureHash = gateway.sign(p);
  return p;
}
test("public catalog envelope, filters, storefront and no session on public reads", async () => {
  const r = await request(app).get("/api/v1/products?sort=price_asc&per_page=1").expect(200);
  assert.equal(r.body.data[0].sku, "TEST-ONE");
  assert.equal(r.body.meta.pagination.total, 2);
  assert.ok(r.body.meta.server_time);
  assert.equal(r.headers["set-cookie"], undefined);
  const home = await request(app).get("/api/v1/storefront").expect(200);
  assert.equal(home.body.data.categories.length, 1);
  assert.equal(home.body.data.bestseller[0].sold_count, 0);
  await request(app).get("/api/v1/products?q=x&q=y").expect(422);
  await request(app).get("/api/v1/products?sort=bad").expect(422);
});
test("CSRF, origin, authentication and role enforced by server", async () => {
  await request(app).get("/api/v1/auth/me").expect(401);
  await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: "customer@em3.test", password })
    .expect(419);
  const agent = await signedIn();
  await agent.get("/api/v1/admin/dashboard").expect(403);
  const token = await csrf(agent);
  await agent
    .post("/api/v1/cart/items")
    .set("X-XSRF-TOKEN", token)
    .set("Origin", "https://attacker.invalid")
    .send({ product_id: product.id, quantity: 1 })
    .expect(419);
  const a = await signedIn("admin");
  await a.get("/api/v1/cart").expect(403);
  await a.get("/api/v1/admin/dashboard").expect(200);
});
test("registration normalizes identity, disallows role injection and persists session", async () => {
  const a = request.agent(app);
  const body = {
    name: "Mới",
    email: " NEW@EM3.TEST ",
    phone: "0911111111",
    password,
    password_confirmation: password,
  };
  assert.equal(
    (await mutate(a, "post", "/api/v1/auth/register", { ...body, role: "admin" })).status,
    422,
  );
  const r = await mutate(a, "post", "/api/v1/auth/register", body);
  assert.equal(r.status, 201);
  assert.equal(r.body.data.role, "customer");
  assert.equal(r.body.data.phone, "+84911111111");
  assert.equal(r.body.data.email, "new@em3.test");
  assert.equal(r.body.data.password, undefined);
  await a.get("/api/v1/auth/me").expect(200);
  await mutate(a, "post", "/api/v1/auth/logout", {});
  await a.get("/api/v1/auth/me").expect(401);
});
test("existing $2y$ bcrypt password remains valid", async () => {
  await update("users", customer.id, { password: passwordHash.replace("$2b$", "$2y$") });
  const a = await signedIn();
  await a.get("/api/v1/auth/me").expect(200);
});

for (const [name, type] of [
  ["admin", argon2.argon2id],
  ["customer", argon2.argon2i],
])
  test(`existing Argon2 ${name} credentials preserve password and session permissions`, async () => {
    const u = name === "admin" ? admin : customer;
    const hash = await argon2.hash(password, {
      type,
      memoryCost: 65536,
      timeCost: 4,
      parallelism: 1,
    });
    await update("users", u.id, { password: hash });
    const agent = request.agent(app);
    const rejected = await mutate(agent, "post", "/api/v1/auth/login", {
      identifier: u.email,
      password: "incorrect-password",
    });
    assert.equal(rejected.status, 422);
    assert.equal(rejected.body.error.code, "INVALID_CREDENTIALS");
    await agent.get("/api/v1/auth/me").expect(401);
    const authenticated = await signedIn(name);
    const me = await authenticated.get("/api/v1/auth/me").expect(200);
    assert.equal(me.body.data.role, name);
    await authenticated.get("/api/v1/admin/dashboard").expect(name === "admin" ? 200 : 403);
    assert.equal((await first("SELECT password FROM users WHERE id=?", [u.id])).password, hash);
  });

test("malformed stored Argon2 hashes reject credentials without a server error", async () => {
  await update("users", admin.id, { password: "$argon2id$invalid" });
  const agent = request.agent(app);
  const result = await mutate(agent, "post", "/api/v1/auth/login", {
    identifier: admin.email,
    password,
  });
  assert.equal(result.status, 422);
  assert.equal(result.body.error.code, "INVALID_CREDENTIALS");
  await agent.get("/api/v1/auth/me").expect(401);
});
test("profile rejects duplicate identity and preserves role", async () => {
  const a = await signedIn();
  const r = await mutate(a, "patch", "/api/v1/auth/profile", {
    name: "Tên mới",
    email: "customer@em3.test",
    phone: "0901234567",
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.name, "Tên mới");
  assert.equal(
    (await mutate(a, "patch", "/api/v1/auth/profile", { name: "x", email: "admin@em3.test" }))
      .status,
    422,
  );
});
test("cart ownership, bounds, inactive products and current price", async () => {
  const a = await signedIn(),
    b = await signedIn("other");
  let r = await mutate(a, "post", "/api/v1/cart/items", { product_id: product.id, quantity: 2 });
  assert.equal(r.status, 200);
  const id = r.body.data.items[0].id;
  assert.equal((await mutate(b, "patch", "/api/v1/cart/items/" + id, { quantity: 1 })).status, 404);
  assert.equal(
    (await mutate(a, "patch", "/api/v1/cart/items/" + id, { quantity: 99 })).status,
    409,
  );
  await update("products", product.id, { sale_price: 8000 });
  r = await a.get("/api/v1/cart");
  assert.equal(r.body.data.estimated_total, 16000);
  await update("products", product.id, { is_active: 0 });
  r = await a.get("/api/v1/cart");
  assert.equal(r.body.data.items[0].is_available, false);
  assert.equal(r.body.data.warnings.length, 1);
  assert.equal((await mutate(a, "delete", "/api/v1/cart/items/" + id)).status, 204);
});
test("quote computes VND totals and shipping, rejects client money fields", async () => {
  const a = await signedIn();
  await mutate(a, "post", "/api/v1/cart/items", { product_id: product.id, quantity: 2 });
  const r = await mutate(a, "post", "/api/v1/checkout/quotes", input("delivery"));
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.data.totals, {
    items_subtotal: 20000,
    discount_total: 2000,
    shipping_fee: 25000,
    payable_total: 43000,
  });
  assert.equal(
    (await mutate(a, "post", "/api/v1/checkout/quotes", { ...input(), payable_total: 1 })).status,
    422,
  );
  assert.equal(
    (await mutate(a, "post", "/api/v1/checkout/quotes", { ...input("delivery"), address: null }))
      .status,
    422,
  );
});
test("HTTP checkout idempotency, quote single use, reserve and empty saved cart", async () => {
  const a = await signedIn();
  await mutate(a, "post", "/api/v1/cart/items", { product_id: product.id, quantity: 2 });
  const q = (await mutate(a, "post", "/api/v1/checkout/quotes", input())).body.data;
  const r = await mutate(a, "post", "/api/v1/orders", { quote_id: q.id }, "checkout-one");
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const replay = await mutate(a, "post", "/api/v1/orders", { quote_id: q.id }, "checkout-one");
  assert.equal(replay.status, 200);
  assert.equal(replay.body.meta.replayed, true);
  assert.equal(replay.body.data.order_code, r.body.data.order_code);
  assert.equal(
    (await first("SELECT stock_reserved FROM products WHERE id=?", [product.id])).stock_reserved,
    2,
  );
  assert.equal((await getCart(customer.id)).items.length, 0);
  assert.equal(
    (await mutate(a, "post", "/api/v1/orders", { quote_id: q.id }, "checkout-two")).status,
    409,
  );
  assert.equal(
    (await mutate(a, "post", "/api/v1/orders", { quote_id: randomUUID() }, "checkout-one")).status,
    409,
  );
});
test("quote expiry, cart changes and catalog version invalidate checkout atomically", async () => {
  await mutateCart(customer.id, "add", { product_id: product.id, quantity: 1 });
  const q = await createQuote(customer.id, input());
  await update("quotes", q.id, { expires_at: new Date(Date.now() - 1000) });
  await assert.rejects(
    checkout(customer.id, q.id, "expired-quote"),
    (e) => e.code === "QUOTE_EXPIRED",
  );
  const q2 = await createQuote(customer.id, input());
  await mutateCart(customer.id, "add", { product_id: second.id, quantity: 1 });
  await assert.rejects(
    checkout(customer.id, q2.id, "changed-cart"),
    (e) => e.code === "CART_CHANGED",
  );
  const q3 = await createQuote(customer.id, input());
  await update("products", product.id, { list_price: 11000, catalog_version: 2 });
  await assert.rejects(
    checkout(customer.id, q3.id, "changed-price"),
    (e) => e.code === "PRICE_CHANGED",
  );
  assert.equal((await first("SELECT COUNT(*) n FROM orders")).n, 0);
  assert.equal(
    (await first("SELECT stock_reserved FROM products WHERE id=?", [product.id])).stock_reserved,
    0,
  );
});
test("concurrent last-item checkout prevents overselling with real MySQL row locks", async () => {
  await update("products", product.id, { stock_on_hand: 1 });
  for (const u of [customer, other])
    await mutateCart(u.id, "add", { product_id: product.id, quantity: 1 });
  const q1 = await createQuote(customer.id, input()),
    q2 = await createQuote(other.id, input());
  const results = await Promise.allSettled([
    checkout(customer.id, q1.id, "last-item-one"),
    checkout(other.id, q2.id, "last-item-two"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await first("SELECT stock_reserved FROM products WHERE id=?", [product.id])).stock_reserved,
    1,
  );
});
test("cancel releases inventory and restores cart once even after replacement checkout", async () => {
  const o = await makeOrder(customer, 2);
  await mutateCart(customer.id, "add", { product_id: second.id, quantity: 1 });
  const a = await signedIn(),
    url = "/api/v1/orders/" + o.order_code + "/cancel";
  assert.equal((await mutate(a, "post", url, {})).status, 200);
  assert.equal(
    (await first("SELECT stock_reserved FROM products WHERE id=?", [product.id])).stock_reserved,
    0,
  );
  let cart = await getCart(customer.id);
  assert.equal(cart.items.length, 2);
  assert.equal(cart.items.find((i) => i.product.id === product.id).quantity, 2);
  const q = await createQuote(customer.id, input());
  await checkout(customer.id, q.id, "replacement-checkout");
  assert.equal((await getCart(customer.id)).items.length, 0);
  assert.equal((await mutate(a, "post", url, {})).status, 200);
  cart = await getCart(customer.id);
  assert.equal(cart.items.length, 0);
  assert.equal(
    (
      await first(
        "SELECT COUNT(*) n FROM order_status_histories WHERE order_id=? AND event='cart_restored'",
        [o.id],
      )
    ).n,
    1,
  );
});
test("order ownership hides other customer order and forbids cancellation", async () => {
  const o = await makeOrder(),
    b = await signedIn("other");
  await b.get("/api/v1/orders/" + o.order_code).expect(404);
  assert.equal(
    (await mutate(b, "post", "/api/v1/orders/" + o.order_code + "/cancel", {})).status,
    404,
  );
});
test("payment attempt idempotency and serialization preserve one active attempt", async () => {
  const o = await makeOrder();
  const [a, b] = await Promise.all([
    createAttempt(o, customer.id, "attempt-key-one"),
    createAttempt(o, customer.id, "attempt-key-two"),
  ]);
  assert.equal(a.id, b.id);
  assert.equal((await first("SELECT COUNT(*) n FROM payment_attempts")).n, 1);
  assert.equal((await createAttempt(o, customer.id, "attempt-key-one")).id, a.id);
  const link = new URL(gateway.paymentUrl(a, "127.0.0.1"));
  assert.equal(link.searchParams.get("vnp_Amount"), "900000");
  assert.equal(
    link.searchParams.get("vnp_ReturnUrl"),
    "http://localhost:3001/payment/vnpay-return",
  );
});
test("IPN rejects tamper/merchant/currency/array, acknowledges unknown order exactly", async () => {
  const o = await makeOrder(),
    a = await attempt(o),
    p = payload(a);
  let r = await request(app)
    .get("/api/v1/payments/vnpay/ipn")
    .query({ ...p, vnp_Amount: "100" });
  assert.deepEqual(r.body, { RspCode: "97", Message: "Invalid signature" });
  for (const overrides of [{ vnp_TmnCode: "WRONG" }, { vnp_CurrCode: "USD" }]) {
    const v = payload(a, overrides);
    r = await request(app).get("/api/v1/payments/vnpay/ipn").query(v);
    assert.equal(r.body.RspCode, "97");
  }
  const unknown = payload({ ...a, provider_reference: "unknown-ref" });
  r = await request(app).get("/api/v1/payments/vnpay/ipn").query(unknown);
  assert.equal(r.body.RspCode, "01");
  assert.equal((await first("SELECT COUNT(*) n FROM payment_receipts")).n, 0);
});
test("verified IPN allocates once, consumes stock and duplicate callback ACK is idempotent", async () => {
  const o = await makeOrder(customer, 2),
    a = await attempt(o),
    p = payload(a);
  const responses = await Promise.all([
    request(app).get("/api/v1/payments/vnpay/ipn").query(p),
    request(app).get("/api/v1/payments/vnpay/ipn").query(p),
  ]);
  assert.deepEqual(responses.map((r) => r.body.RspCode).sort(), ["00", "02"]);
  const stock = await first("SELECT * FROM products WHERE id=?", [product.id]);
  assert.equal(stock.stock_on_hand, 3);
  assert.equal(stock.stock_reserved, 0);
  assert.equal((await first("SELECT COUNT(*) n FROM payment_receipts")).n, 1);
  assert.equal(
    (await first("SELECT payment_status FROM orders WHERE id=?", [o.id])).payment_status,
    "paid",
  );
  const failure = gateway.verifyCallback(
    payload(a, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" }),
  );
  await applyPayment(failure, "ipn");
  assert.equal(
    (await first("SELECT payment_status FROM orders WHERE id=?", [o.id])).payment_status,
    "paid",
  );
});
test("browser success Return never creates receipt or marks paid without query evidence", async () => {
  const o = await makeOrder(),
    a = await attempt(o),
    p = payload(a);
  const r = await request(app).get("/api/v1/payments/vnpay/return").query(p).expect(200);
  assert.equal(r.body.data.result, "succeeded");
  assert.equal(r.body.data.payment_status, "pending");
  assert.equal((await first("SELECT COUNT(*) n FROM payment_receipts")).n, 0);
  await assert.rejects(
    applyPayment(gateway.verifyCallback(p), "return"),
    (e) => e.code === "INVALID_EVIDENCE_SOURCE",
  );
});
test("signed failure return permits a fresh attempt and keeps reservation", async () => {
  const o = await makeOrder(),
    a = await attempt(o);
  await request(app)
    .get("/api/v1/payments/vnpay/return")
    .query(payload(a, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" }))
    .expect(200);
  const current = await first("SELECT * FROM orders WHERE id=?", [o.id]);
  assert.equal(current.payment_status, "unpaid");
  const next = await attempt(current);
  assert.notEqual(next.provider_reference, a.provider_reference);
  assert.equal(
    (await first("SELECT stock_reserved FROM products WHERE id=?", [product.id])).stock_reserved,
    1,
  );
});
test("amount mismatch creates unallocated receipt and case while retaining stock", async () => {
  const o = await makeOrder(),
    a = await attempt(o);
  const r = await request(app)
    .get("/api/v1/payments/vnpay/ipn")
    .query(payload(a, { vnp_Amount: "100" }));
  assert.equal(r.body.RspCode, "04");
  assert.equal((await first("SELECT allocation FROM payment_receipts")).allocation, "mismatch");
  assert.equal(
    (await first("SELECT payment_status FROM orders WHERE id=?", [o.id])).payment_status,
    "reconciliation_required",
  );
  assert.equal(
    (await first("SELECT stock_reserved FROM products WHERE id=?", [product.id])).stock_reserved,
    1,
  );
});
test("invalid/future payment time opens reconciliation without accepting money", async () => {
  const o = await makeOrder(),
    a = await attempt(o);
  const p = payload(a, { vnp_PayDate: "20260230010101" });
  assert.equal(gateway.verifyCallback(p).paidAt, null);
  await applyPayment(gateway.verifyCallback(p), "ipn");
  assert.equal((await first("SELECT COUNT(*) n FROM payment_receipts")).n, 0);
  assert.equal(
    (await first("SELECT reason FROM reconciliation_cases")).reason,
    "untrusted_payment_time",
  );
});
test("late receipt after release records case without reopening order or consuming stock", async () => {
  const o = await makeOrder(),
    a = await attempt(o);
  await applyPayment(
    gateway.verifyCallback(payload(a, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" })),
    "return",
  );
  await closeOrder(await first("SELECT * FROM orders WHERE id=?", [o.id]), true, customer.id);
  await applyPayment(gateway.verifyCallback(payload(a)), "ipn");
  assert.equal((await first("SELECT allocation FROM payment_receipts")).allocation, "late");
  const current = await first("SELECT * FROM orders WHERE id=?", [o.id]);
  assert.equal(current.lifecycle, "cancelled");
  assert.equal(current.payment_status, "reconciliation_required");
  const p = await first("SELECT * FROM products WHERE id=?", [product.id]);
  assert.equal(p.stock_on_hand, 5);
  assert.equal(p.stock_reserved, 0);
});
test("provider uncertainty prevents cancellation, release and a new charge", async () => {
  const o = await makeOrder();
  await attempt(o);
  await assert.rejects(
    closeOrder(o, true, customer.id, { query: async () => null }),
    (e) => e.code === "PAYMENT_RECONCILIATION_REQUIRED",
  );
  assert.equal(
    (await first("SELECT stock_reserved FROM products WHERE id=?", [product.id])).stock_reserved,
    1,
  );
  assert.equal((await getCart(customer.id)).items.length, 0);
  assert.equal(
    (await first("SELECT payment_status FROM orders WHERE id=?", [o.id])).payment_status,
    "reconciliation_required",
  );
});
test("expiry scheduler releases unpaid no-attempt holds without restoring cart", async () => {
  const o = await makeOrder();
  await update("orders", o.id, { expires_at: new Date(Date.now() - 1000) });
  await tick();
  assert.equal(
    (await first("SELECT lifecycle FROM orders WHERE id=?", [o.id])).lifecycle,
    "expired",
  );
  assert.equal((await getCart(customer.id)).items.length, 0);
  assert.equal(
    (await first("SELECT stock_reserved FROM products WHERE id=?", [product.id])).stock_reserved,
    0,
  );
});
test("paid cancellation denied, fulfillment version and transitions enforced", async () => {
  const o = await makeOrder(),
    a = await attempt(o);
  await applyPayment(gateway.verifyCallback(payload(a)), "ipn");
  await assert.rejects(
    closeOrder(await first("SELECT * FROM orders WHERE id=?", [o.id]), true, customer.id),
    (e) => e.code === "ORDER_NOT_CANCELLABLE",
  );
  const agent = await signedIn("admin"),
    url = "/api/v1/admin/orders/" + o.order_code + "/fulfillment";
  let current = await first("SELECT * FROM orders WHERE id=?", [o.id]);
  assert.equal(
    (await mutate(agent, "patch", url, { target_status: "preparing", version: 1 })).status,
    409,
  );
  for (const target_status of ["preparing", "ready_for_pickup", "fulfilled"]) {
    const r = await mutate(agent, "patch", url, { target_status, version: current.version });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    current = await first("SELECT * FROM orders WHERE id=?", [o.id]);
  }
  assert.equal(current.lifecycle, "completed");
});
test("admin product CRUD, discounts, stale version, archive and grade rules", async () => {
  const a = await signedIn("admin");
  const r = await mutate(a, "post", "/api/v1/admin/products", {
    category_id: category,
    sku: "ADMIN-NEW",
    name: "Mới",
    list_price: 12345,
    discount_percent: 17,
    opening_stock: 7,
  });
  assert.equal(r.status, 201);
  const p = r.body.data;
  assert.equal(p.sale_price, 10246);
  assert.equal(
    (await mutate(a, "patch", "/api/v1/admin/products/" + p.id, { version: 99, name: "stale" }))
      .status,
    409,
  );
  assert.equal(
    (
      await mutate(a, "patch", "/api/v1/admin/products/" + p.id, {
        version: 1,
        list_price: 100,
        sale_price: 101,
      })
    ).status,
    422,
  );
  assert.equal(
    (await mutate(a, "delete", "/api/v1/admin/products/" + p.id, { version: 1 })).status,
    204,
  );
  await request(app)
    .get("/api/v1/products/" + p.id)
    .expect(404);
  assert.ok(await first("SELECT id FROM products WHERE id=?", [p.id]));
});
test("inventory adjustment idempotency, collision and reserved floor enforced", async () => {
  const o = await makeOrder(customer, 2),
    a = await signedIn("admin"),
    url = "/api/v1/admin/inventory/" + product.id + "/adjustments",
    b = { delta: 3, reason: "Nhập bổ sung", request_key: "adjust_1" };
  assert.equal((await mutate(a, "post", url, b)).status, 200);
  assert.equal((await mutate(a, "post", url, b)).body.data.stock_on_hand, 8);
  assert.equal((await mutate(a, "post", url, { ...b, delta: 4 })).status, 409);
  assert.equal(
    (await mutate(a, "post", url, { ...b, delta: -7, request_key: "adjust_2" })).status,
    409,
  );
  const r = await a.get("/api/v1/admin/inventory/" + product.id + "/movements").expect(200);
  assert.ok(r.body.data.some((m) => m.kind === "reserve" && m.order_code === o.order_code));
});
test("image upload validates content, reencodes and enforces scoped deletion", async () => {
  const a = await signedIn("admin"),
    png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } })
      .png()
      .toBuffer();
  let token = await csrf(a);
  const r = await a
    .post("/api/v1/admin/products/" + product.id + "/images")
    .set("X-XSRF-TOKEN", token)
    .attach("image", png, "cover.png");
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.ok(r.body.data.url.endsWith(".webp"));
  await request(app).get(r.body.data.url).expect(200);
  assert.equal(
    (await mutate(a, "delete", "/api/v1/admin/products/" + second.id + "/images/" + r.body.data.id))
      .status,
    404,
  );
  assert.equal(
    (
      await mutate(
        a,
        "delete",
        "/api/v1/admin/products/" + product.id + "/images/" + r.body.data.id,
      )
    ).status,
    204,
  );
  token = await csrf(a);
  await a
    .post("/api/v1/admin/products/" + product.id + "/images")
    .set("X-XSRF-TOKEN", token)
    .attach("image", Buffer.from("<script>bad</script>"), "cover.png")
    .expect(422);
});
test("newsletter consent and duplicate subscription are idempotent", async () => {
  const a = request.agent(app);
  assert.equal(
    (
      await mutate(a, "post", "/api/v1/newsletter/subscriptions", {
        email: "newsletter@em3.test",
        consent: false,
      })
    ).status,
    422,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await mutate(a, "post", "/api/v1/newsletter/subscriptions", {
          email: " Newsletter@EM3.TEST ",
          consent: true,
        })
      ).status,
      202,
    );
  assert.equal((await first("SELECT COUNT(*) n FROM newsletter_subscriptions")).n, 1);
});
test("password recovery queues encrypted token after commit and reset revokes all sessions", async () => {
  process.env.MAIL_TRANSPORT = "test";
  const a = await signedIn(),
    b = request.agent(app);
  assert.equal(
    (await mutate(b, "post", "/api/v1/auth/forgot-password", { email: "customer@em3.test" }))
      .status,
    202,
  );
  const job = await first("SELECT * FROM em3_mail_jobs"),
    message = decryptMail(job.payload),
    url = new URL(message.text.split(" ").at(-1)),
    token = url.searchParams.get("token");
  assert.ok(token);
  assert.ok(!job.payload.includes(token));
  assert.equal((await first("SELECT token FROM password_reset_tokens")).token, sha(token));
  const newPassword = "Changed-test-password-123!";
  const body = {
    email: "customer@em3.test",
    token,
    password: newPassword,
    password_confirmation: newPassword,
  };
  assert.equal((await mutate(b, "post", "/api/v1/auth/reset-password", body)).status, 200);
  await a.get("/api/v1/auth/me").expect(401);
  assert.equal((await mutate(b, "post", "/api/v1/auth/reset-password", body)).status, 422);
  assert.equal(
    (
      await mutate(b, "post", "/api/v1/auth/login", {
        identifier: "customer@em3.test",
        password: newPassword,
      })
    ).status,
    200,
  );
  process.env.MAIL_TRANSPORT = "disabled";
});
test("recovery does not expose account existence or reset public admin", async () => {
  process.env.MAIL_TRANSPORT = "test";
  const a = request.agent(app);
  const missing = await mutate(a, "post", "/api/v1/auth/forgot-password", {
      email: "missing@em3.test",
    }),
    adminResult = await mutate(a, "post", "/api/v1/auth/forgot-password", {
      email: "admin@em3.test",
    });
  assert.deepEqual(missing.body.data, adminResult.body.data);
  assert.equal((await first("SELECT COUNT(*) n FROM em3_mail_jobs")).n, 0);
  process.env.MAIL_TRANSPORT = "disabled";
});
test("revenue counts accepted merchandise once, shipping separate, Vietnam dates", async () => {
  const o = await makeOrder(customer, 2, "delivery"),
    a = await attempt(o),
    p = payload(a);
  await applyPayment(gateway.verifyCallback(p), "ipn");
  await applyPayment(gateway.verifyCallback(p), "query");
  const agent = await signedIn("admin"),
    day = vietnamDate(now()).slice(0, 8),
    from = day.slice(0, 4) + "-" + day.slice(4, 6) + "-" + day.slice(6, 8),
    end = new Date(from + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  const r = await agent
    .get("/api/v1/admin/revenue")
    .query({ from, to: end.toISOString().slice(0, 10), granularity: "day" })
    .expect(200);
  assert.equal(r.body.data.totals.accepted_sales, 18000);
  assert.equal(r.body.data.totals.shipping_collected, 25000);
  assert.equal(r.body.data.totals.net_sales, 18000);
  assert.equal(r.body.data.series.length, 1);
  assert.equal(
    (await mutate(agent, "post", "/api/v1/admin/orders/" + o.order_code + "/refund-records", {}))
      .status,
    403,
  );
});
test("admin history/catalog/inventory/categories/cases routes preserve envelopes", async () => {
  const o = await makeOrder(),
    a = await signedIn("admin");
  for (const route of [
    "/admin/products",
    "/admin/categories",
    "/admin/inventory",
    "/admin/orders",
    "/admin/reconciliation-cases",
    "/admin/orders/" + o.order_code + "/history?type=statuses",
  ]) {
    const r = await a.get("/api/v1" + route).expect(200);
    assert.ok(Array.isArray(r.body.data));
    assert.ok(r.body.meta.pagination);
  }
  const r = await mutate(a, "post", "/api/v1/admin/categories", {
    name: "Danh mục mới",
    slug: "danh-muc-moi",
    is_active: true,
  });
  assert.equal(r.status, 201);
  assert.equal(
    (await mutate(a, "patch", "/api/v1/admin/categories/" + r.body.data.id, { is_active: false }))
      .status,
    200,
  );
});
test("reconciliation cannot be resolved without signed final evidence", async () => {
  const o = await makeOrder();
  await attempt(o);
  await assert.rejects(closeOrder(o, true, customer.id, { query: async () => null }));
  const c = await first("SELECT * FROM reconciliation_cases ORDER BY id LIMIT 1"),
    a = await signedIn("admin"),
    url = "/api/v1/admin/reconciliation-cases/" + c.id;
  assert.equal(
    (
      await mutate(a, "patch", url, {
        resolution: "verified_unpaid",
        note: "Kiểm tra hồ sơ",
        version: c.version,
        evidence_reference: "untrusted screenshot",
      })
    ).status,
    409,
  );
  const r = await mutate(a, "patch", url, {
    resolution: "manual_review",
    note: "Đang kiểm tra provider",
    version: c.version,
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.status, "open");
});
test("verified server query applies payment after network work outside order locks", async () => {
  const o = await makeOrder(),
    a = await attempt(o);
  const provider = {
    query: async (candidate) => {
      assert.equal(candidate.id, a.id);
      await transaction(async (db) => {
        mustNotLocked(
          await first("SELECT id FROM orders WHERE id=? FOR UPDATE NOWAIT", [o.id], db),
        );
      });
      return gateway.verifyCallback(payload(a));
    },
  };
  function mustNotLocked(value) {
    assert.equal(value.id, o.id);
  }
  const current = await refreshOrder(o, true, provider);
  assert.equal(current.payment_status, "paid");
  assert.equal((await first("SELECT COUNT(*) n FROM payment_receipts")).n, 1);
});
test("two successful attempts allocate only first receipt and retain duplicate evidence", async () => {
  const o = await makeOrder(),
    a = await attempt(o);
  await applyPayment(
    gateway.verifyCallback(payload(a, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" })),
    "return",
  );
  const b = await attempt(await first("SELECT * FROM orders WHERE id=?", [o.id]));
  await applyPayment(gateway.verifyCallback(payload(a)), "ipn");
  await applyPayment(gateway.verifyCallback(payload(b, { vnp_TransactionNo: "987654321" })), "ipn");
  const receipts = await query("SELECT allocation FROM payment_receipts ORDER BY id");
  assert.deepEqual(
    receipts.map((r) => r.allocation),
    ["accepted", "duplicate"],
  );
  assert.equal(
    (await first("SELECT payment_status FROM orders WHERE id=?", [o.id])).payment_status,
    "paid",
  );
  assert.equal(
    (await first("SELECT stock_on_hand FROM products WHERE id=?", [product.id])).stock_on_hand,
    4,
  );
  assert.equal((await first("SELECT reason FROM reconciliation_cases")).reason, "duplicate");
});
test("real local SMTP worker delivers queued recovery after commit and scrubs completed payload", async () => {
  let captured = "";
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 localhost EM3 SMTP\r\n");
    let buffer = "",
      inData = false;
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      while (buffer.includes("\r\n")) {
        const index = buffer.indexOf("\r\n"),
          line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            socket.write("250 Queued\r\n");
          } else captured += line + "\r\n";
          continue;
        }
        if (/^EHLO|^HELO/.test(line)) socket.write("250 localhost\r\n");
        else if (/^MAIL FROM|^RCPT TO/.test(line)) socket.write("250 OK\r\n");
        else if (line === "DATA") {
          inData = true;
          socket.write("354 End with dot\r\n");
        } else if (line === "QUIT") {
          socket.end("221 Bye\r\n");
        } else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previous = {};
  for (const key of ["MAIL_TRANSPORT", "MAIL_HOST", "MAIL_PORT", "MAIL_USERNAME", "MAIL_SECURE"])
    previous[key] = process.env[key];
  Object.assign(process.env, {
    MAIL_TRANSPORT: "smtp",
    MAIL_HOST: "127.0.0.1",
    MAIL_PORT: String(server.address().port),
    MAIL_USERNAME: "",
    MAIL_SECURE: "false",
  });
  try {
    const agent = request.agent(app);
    assert.equal(
      (await mutate(agent, "post", "/api/v1/auth/forgot-password", { email: "customer@em3.test" }))
        .status,
      202,
    );
    await deliverMailBatch();
    const job = await first("SELECT * FROM em3_mail_jobs");
    assert.ok(job.completed_at);
    assert.equal(job.payload, "");
    assert.match(captured, /customer@em3\.test/);
    assert.match(captured, /reset-password/);
  } finally {
    for (const [k, v] of Object.entries(previous))
      v === undefined ? delete process.env[k] : (process.env[k] = v);
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});
test("catalog seed loads all 137 source products and repeated seed preserves edited stock and price", async () => {
  await seed();
  const p = await first("SELECT * FROM products WHERE sku='TT-SGK-002'");
  assert.ok(p);
  assert.equal((await first("SELECT COUNT(*) n FROM products")).n, 139);
  await update("products", p.id, { list_price: 98765, sale_price: null, stock_on_hand: 8 });
  await seed();
  const after = await first("SELECT * FROM products WHERE id=?", [p.id]);
  assert.equal(after.list_price, 98765);
  assert.equal(after.stock_on_hand, 8);
  assert.equal((await first("SELECT COUNT(*) n FROM products")).n, 139);
});

test("home returns ten ranked products when ten eligible products exist", async () => {
  for (let i = 0; i < 11; i++)
    await saveProduct(
      {
        category_id: category,
        sku: "RANK-" + i,
        name: "Rank " + i,
        list_price: 10000,
        opening_stock: 5,
        is_bestseller: true,
      },
      null,
      admin.id,
    );
  const response = await request(app).get("/api/v1/storefront").expect(200);
  assert.equal(response.body.data.bestseller.length, 10);
  assert.ok(response.body.data.bestseller.every((p) => p.sold_count === 0));
});

test("counter cash is admin-only, CSRF-protected, audited and amount is server-owned", async () => {
  const o = await makeOrder(),
    url = "/api/v1/admin/orders/" + o.order_code + "/cash-payment";
  await request(app).post(url).send({}).expect(419);
  const buyer = await signedIn();
  assert.equal((await mutate(buyer, "post", url, {})).status, 403);
  const manager = await signedIn("admin");
  assert.equal((await mutate(manager, "post", url, { amount: 1 })).status, 422);
  const response = await mutate(manager, "post", url, {});
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.lifecycle, "completed");
  assert.equal(response.body.data.fulfillment_status, "fulfilled");
  assert.equal(response.body.data.payment_status, "paid");
  assert.equal((await mutate(manager, "post", url, {})).status, 200);
  const r = await first("SELECT * FROM payment_receipts WHERE allocation='accepted'");
  assert.equal(r.provider, "cash");
  assert.equal(r.received_amount, o.payable_total);
  assert.equal((await first("SELECT COUNT(*) n FROM payment_receipts")).n, 1);
  assert.equal(
    (
      await first(
        "SELECT actor_id FROM order_status_histories WHERE event='cash_payment_completed'",
      )
    ).actor_id,
    admin.id,
  );
  assert.equal(
    (await first("SELECT stock_on_hand FROM products WHERE id=?", [product.id])).stock_on_hand,
    4,
  );
  const from = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10),
    to = new Date(Date.now() + 7 * 3600000 + 86400000).toISOString().slice(0, 10);
  const report = await manager
    .get("/api/v1/admin/revenue")
    .query({ from, to, granularity: "day" })
    .expect(200);
  assert.equal(report.body.data.totals.accepted_sales, o.payable_total);
});
test("two concurrent cash requests consume and allocate once", async () => {
  const o = await makeOrder();
  const [a, b] = await Promise.all([collectCash(o, admin.id), collectCash(o, admin.id)]);
  assert.equal(a.lifecycle, "completed");
  assert.equal(b.lifecycle, "completed");
  assert.equal((await first("SELECT COUNT(*) n FROM payment_receipts")).n, 1);
  assert.equal(
    (await first("SELECT COUNT(*) n FROM inventory_movements WHERE kind='consume'")).n,
    1,
  );
});
test("cash refuses pending unknown reconciliation expired closed delivery and paid orders", async () => {
  await query("UPDATE products SET stock_on_hand=100 WHERE id=?", [product.id]);
  for (const fields of [
    { payment_status: "pending" },
    { payment_status: "reconciliation_required" },
    { payment_status: "paid" },
    { expires_at: new Date(Date.now() - 1000) },
    { lifecycle: "cancelled" },
  ]) {
    const o = await makeOrder();
    await update("orders", o.id, fields);
    await assert.rejects(collectCash(o, admin.id), (e) =>
      ["ORDER_NOT_PAYABLE", "PAYMENT_RECONCILIATION_REQUIRED"].includes(e.code),
    );
  }
  const delivery = await makeOrder(customer, 1, "delivery");
  await assert.rejects(collectCash(delivery, admin.id), (e) => e.code === "ORDER_NOT_PAYABLE");
});
test("cash refuses an active attempt even with stale unpaid status", async () => {
  const o = await makeOrder();
  await attempt(o);
  await update("orders", o.id, { payment_status: "unpaid" });
  await assert.rejects(
    collectCash(o, admin.id),
    (e) => e.code === "PAYMENT_RECONCILIATION_REQUIRED",
  );
  assert.equal((await first("SELECT COUNT(*) n FROM payment_receipts")).n, 0);
});
test("cash refuses missing or released reservations without receipt or sale", async () => {
  const o = await makeOrder();
  await query(
    "UPDATE stock_reservations r JOIN order_items i ON i.id=r.order_item_id SET r.status='released' WHERE i.order_id=?",
    [o.id],
  );
  await assert.rejects(collectCash(o, admin.id), (e) => e.code === "RESERVATION_MISSING");
  assert.equal((await first("SELECT COUNT(*) n FROM payment_attempts")).n, 0);
  assert.equal((await first("SELECT COUNT(*) n FROM payment_receipts")).n, 0);
  assert.equal((await first("SELECT lifecycle FROM orders WHERE id=?", [o.id])).lifecycle, "open");
});

test("cash rolls back receipt attempt order and stock when the inventory ledger fails", async () => {
  const o = await makeOrder();
  const { id, ...movement } = await first("SELECT * FROM inventory_movements WHERE order_id=?", [
    o.id,
  ]);
  await insert("inventory_movements", {
    ...movement,
    business_key: `order:${o.id}:consume:${product.id}`,
  });
  await assert.rejects(collectCash(o, admin.id), (error) => error.code === "ER_DUP_ENTRY");
  assert.equal((await first("SELECT COUNT(*) n FROM payment_receipts")).n, 0);
  assert.equal((await first("SELECT COUNT(*) n FROM payment_attempts")).n, 0);
  const current = await first("SELECT * FROM orders WHERE id=?", [o.id]);
  assert.equal(current.lifecycle, "open");
  assert.equal(current.payment_status, "unpaid");
  const stock = await first("SELECT * FROM products WHERE id=?", [product.id]);
  assert.equal(stock.stock_on_hand, 5);
  assert.equal(stock.stock_reserved, 1);
  assert.equal(
    (await first("SELECT status FROM stock_reservations WHERE product_id=?", [product.id])).status,
    "active",
  );
});
test("counter QR short link redirects exact signed amount; verified IPN completes once", async () => {
  const o = await makeOrder(),
    manager = await signedIn("admin");
  const response = await mutate(
    manager,
    "post",
    "/api/v1/admin/orders/" + o.order_code + "/payment-attempts",
    {},
    "counter-qr-key",
  );
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const data = response.body.data;
  assert.equal(data.qr_kind, "checkout_url");
  const redirect = await request(app)
    .get(data.qr_content + "?vnp_Amount=1")
    .expect(302);
  const url = new URL(redirect.headers.location);
  assert.equal(url.searchParams.get("vnp_Amount"), String(o.payable_total * 100));
  assert.equal(
    gateway.sign(Object.fromEntries(url.searchParams)),
    url.searchParams.get("vnp_SecureHash"),
  );
  assert.match(redirect.headers["cache-control"], /no-store/);
  assert.equal(redirect.headers["referrer-policy"], "no-referrer");
  const a = await first("SELECT * FROM payment_attempts WHERE id=?", [data.id]);
  assert.equal((await first("SELECT lifecycle FROM orders WHERE id=?", [o.id])).lifecycle, "open");
  await assert.rejects(
    collectCash(o, admin.id),
    (e) => e.code === "PAYMENT_RECONCILIATION_REQUIRED",
  );
  const result = gateway.verifyCallback(payload(a));
  assert.equal(await applyPayment(result, "ipn"), "00");
  assert.equal(await applyPayment(result, "ipn"), "02");
  const paid = await first("SELECT * FROM orders WHERE id=?", [o.id]);
  assert.equal(paid.lifecycle, "completed");
  assert.equal(paid.fulfillment_status, "fulfilled");
  await request(app).get(data.qr_content).expect(409);
  assert.equal((await first("SELECT COUNT(*) n FROM payment_receipts")).n, 1);
});
test("counter links reject customer-only, unknown, expired and delivery references", async () => {
  const o = await makeOrder(),
    a = await attempt(o);
  await request(app)
    .get("/api/v1/payments/vnpay/checkout/" + a.provider_reference)
    .expect(404);
  await request(app)
    .get("/api/v1/payments/vnpay/checkout/" + "f".repeat(32))
    .expect(404);
  const delivery = await makeOrder(customer, 1, "delivery");
  await assert.rejects(
    createAttempt(delivery, admin.id, "delivery-counter-key", true),
    (e) => e.code === "PAYMENT_CHANNEL_INVALID",
  );
  await createAttempt(o, admin.id, "counter-expired-key", true);
  await update("orders", o.id, { expires_at: new Date(Date.now() - 1000) });
  await request(app)
    .get("/api/v1/payments/vnpay/checkout/" + a.provider_reference)
    .expect(409);
});
