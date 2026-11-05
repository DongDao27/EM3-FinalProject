import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createIpnRelay, ipnPath, publicIpnUrl } from "../lib/vnpay-sandbox.mjs";

async function listen(server, t) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test("relay preserves signed raw query and ACK while stripping credentials and other routes", async (t) => {
  const seen = [];
  const messages = [];
  const backend = await listen(
    createServer((req, res) => {
      seen.push({ url: req.url, headers: req.headers });
      res.setHeader("Set-Cookie", "private-session=secret");
      res.end('{"RspCode":"02","Message":"Order already confirmed"}');
    }),
    t,
  );
  const relay = await listen(createIpnRelay({ backend, notify: (s) => messages.push(s) }), t);
  const raw = ipnPath + "?vnp_OrderInfo=A+B%2BC&vnp_SecureHash=test-secret&vnp_X=1&vnp_X=2";
  const response = await fetch(relay + raw, {
    headers: { Cookie: "session=private", Authorization: "Bearer private" },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { RspCode: "02", Message: "Order already confirmed" });
  assert.equal(seen[0].url, raw);
  assert.equal(seen[0].headers.cookie, undefined);
  assert.equal(seen[0].headers.authorization, undefined);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.ok(messages[0].includes("ACK=02"));
  assert.ok(!messages.join().includes("test-secret"));
  for (const p of ["/health", "/api/v1/admin/orders", "//example.com", ipnPath + "/"])
    assert.equal((await fetch(relay + p)).status, 404);
  assert.equal((await fetch(relay + ipnPath, { method: "POST", body: "payload" })).status, 405);
  assert.equal(seen.length, 1);
});

test("relay returns retryable failure for timeout or malformed upstream ACK", async (t) => {
  const backend = await listen(
    createServer((req, res) => {
      if (req.url.includes("hang")) return;
      res.end('{"RspCode":"00"}');
    }),
    t,
  );
  const relay = await listen(createIpnRelay({ backend, timeout: 60, notify: () => {} }), t);
  for (const suffix of ["", "?hang=1"]) {
    const response = await fetch(relay + ipnPath + suffix);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).RspCode, "99");
  }
});

test("relay never follows an upstream redirect", async (t) => {
  let calls = 0;
  const backend = await listen(
    createServer((req, res) => {
      calls++;
      res.writeHead(302, { Location: "/private" }).end();
    }),
    t,
  );
  const relay = await listen(createIpnRelay({ backend, notify: () => {} }), t);
  assert.equal((await fetch(relay + ipnPath)).status, 503);
  assert.equal(calls, 1);
});

test("relay refuses remote targets and public IPN requires exact HTTPS callback path", () => {
  for (const backend of [
    "https://localhost",
    "http://example.com",
    "http://u:p@localhost",
    "http://localhost/admin",
  ])
    assert.throws(() => createIpnRelay({ backend }));
  assert.equal(publicIpnUrl("https://test.example" + ipnPath), "https://test.example" + ipnPath);
  for (const raw of [
    "http://test.example" + ipnPath,
    "https://test.example/admin",
    "https://u:p@test.example" + ipnPath,
    "https://test.example" + ipnPath + "?secret=1",
  ])
    assert.throws(() => publicIpnUrl(raw));
});
