import { test } from "node:test";
import assert from "node:assert/strict";
import { deploymentSettings } from "../src/deployment.js";

const backend = "/app/backend";
const ready = {
  NODE_ENV: "production",
  FRONTEND_URL: "https://demo.example.test",
  HOST: "127.0.0.1",
  TRUST_PROXY: "loopback",
  COOKIE_SECURE: "true",
  SESSION_SECRET: "a".repeat(96),
  VNPAY_ENV: "sandbox",
  VNPAY_DEFERRED: "true",
  STORAGE_ROOT: "/data",
};
test("production requires HTTPS session transport and never opens real payment", () => {
  const value = deploymentSettings(ready, backend);
  assert.equal(value.trustProxy, "loopback");
  assert.equal(value.returnUrl, "https://demo.example.test/payment/vnpay-return");
  assert.equal(
    deploymentSettings({ ...ready, FRONTEND_URL: `${ready.FRONTEND_URL}/` }, backend).returnUrl,
    value.returnUrl,
  );
  for (const patch of [
    { FRONTEND_URL: "http://demo.example.test" },
    { COOKIE_SECURE: "false" },
    { TRUST_PROXY: "true" },
    { HOST: "0.0.0.0" },
    { VNPAY_ENV: "production" },
    { SESSION_SECRET: "replace-with-48-random-bytes" },
    { VNPAY_RETURN_URL: "https://other.example.test/payment/vnpay-return" },
    { VNPAY_RETURN_URL: "https://demo.example.test/wrong" },
  ])
    assert.throws(() => deploymentSettings({ ...ready, ...patch }, backend));
});
test("enabled hosted Sandbox requires credentials and official query/payment endpoints", () => {
  const enabled = {
    ...ready,
    VNPAY_DEFERRED: "false",
    VNPAY_TMN_CODE: "TESTONLY",
    VNPAY_HASH_SECRET: "test-fixture-secret",
    VNPAY_PAYMENT_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    VNPAY_QUERY_URL: "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
  };
  assert.equal(deploymentSettings(enabled, backend).frontend, ready.FRONTEND_URL);
  for (const patch of [
    { VNPAY_TMN_CODE: "" },
    { VNPAY_QUERY_URL: "" },
    { VNPAY_PAYMENT_URL: "https://pay.example.test" },
  ])
    assert.throws(() => deploymentSettings({ ...enabled, ...patch }, backend));
});
test("Railway hostname supplies public callback; tests cannot write to a mounted volume", () => {
  const value = deploymentSettings(
    { ...ready, FRONTEND_URL: "", RAILWAY_PUBLIC_DOMAIN: "demo.up.railway.app" },
    backend,
  );
  assert.equal(value.returnUrl, "https://demo.up.railway.app/payment/vnpay-return");
  const isolated = deploymentSettings({ ...ready, NODE_ENV: "test" }, backend);
  assert.match(isolated.storageRoot, /test-storage$/);
  assert.notEqual(isolated.storageRoot, "/data");
  assert.equal(deploymentSettings({}, backend).trustProxy, false);
});
