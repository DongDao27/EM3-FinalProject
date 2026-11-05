import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { canonical, VnpayGateway, vietnamDate } from "../src/vnpay.js";
const gateway = new VnpayGateway({
  merchant: "TEST",
  secret: "fixture-secret",
  environment: "sandbox",
  paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  returnUrl: "http://localhost:3001/payment/vnpay-return",
});
test("RFC1738 canonicalization uses RFC1738 form encoding for punctuation and Vietnamese", () => {
  assert.equal(
    canonical({ z: "a b~!*'()", a: "Sách & bút", vnp_SecureHash: "omit" }),
    "a=S%C3%A1ch+%26+b%C3%BAt&z=a+b%7E%21%2A%27%28%29",
  );
});
test("Vietnam timestamp is UTC+7 across date boundary", () => {
  assert.equal(vietnamDate("2026-10-30T18:00:00Z"), "20261031010000");
});
test("malformed signature and duplicate query values are rejected", () => {
  assert.equal(
    gateway.verifyCallback({ vnp_SecureHash: "0".repeat(128), vnp_TmnCode: "TEST" }),
    null,
  );
  assert.equal(gateway.verifyCallback({ vnp_TmnCode: ["TEST", "TEST"] }), null);
});
test("amount uses integral VND, rejects fractional provider amount and invalid transaction", () => {
  assert.equal(
    gateway.normalize({
      vnp_TxnRef: "ref",
      vnp_Amount: "101",
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
      vnp_TransactionNo: "123",
    }),
    null,
  );
  assert.equal(
    gateway.normalize({
      vnp_TxnRef: "ref",
      vnp_Amount: "100",
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
      vnp_TransactionNo: "0",
    }),
    null,
  );
});
test("production merchant stays unavailable; counter uses checkout link", () => {
  assert.doesNotThrow(() => gateway.assertAvailable(true));
  assert.throws(
    () => new VnpayGateway({ ...gateway.settings, environment: "production" }).assertAvailable(),
    (e) => e.code === "PAYMENT_ENV_NOT_AUTHORIZED",
  );
});
test("QueryDr verifies pipe HMAC, merchant/reference/type and signed server response", async () => {
  const originalFetch = globalThis.fetch;
  const provider = new VnpayGateway({
    ...gateway.settings,
    queryUrl: "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
    queryIp: "127.0.0.1",
  });
  const attempt = {
    provider_reference: "query-reference",
    created_at: new Date("2026-10-31T01:00:00Z"),
  };
  const responseFields = [
    "vnp_ResponseId",
    "vnp_Command",
    "vnp_ResponseCode",
    "vnp_Message",
    "vnp_TmnCode",
    "vnp_TxnRef",
    "vnp_Amount",
    "vnp_BankCode",
    "vnp_PayDate",
    "vnp_TransactionNo",
    "vnp_TransactionType",
    "vnp_TransactionStatus",
    "vnp_OrderInfo",
    "vnp_PromotionCode",
    "vnp_PromotionAmount",
  ];
  let tamper = false,
    wrongReference = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, provider.settings.queryUrl);
    const p = JSON.parse(options.body);
    assert.equal(p.vnp_Command, "querydr");
    assert.equal(p.vnp_TransactionDate, "20261031080000");
    const fields = [
      "vnp_RequestId",
      "vnp_Version",
      "vnp_Command",
      "vnp_TmnCode",
      "vnp_TxnRef",
      "vnp_TransactionDate",
      "vnp_CreateDate",
      "vnp_IpAddr",
      "vnp_OrderInfo",
    ];
    assert.equal(
      p.vnp_SecureHash,
      createHmac("sha512", "fixture-secret")
        .update(fields.map((k) => p[k] || "").join("|"))
        .digest("hex"),
    );
    const r = {
      vnp_ResponseId: "response123",
      vnp_Command: "querydr",
      vnp_ResponseCode: "00",
      vnp_Message: "Success",
      vnp_TmnCode: "TEST",
      vnp_TxnRef: wrongReference ? "other" : attempt.provider_reference,
      vnp_Amount: "1250000",
      vnp_BankCode: "NCB",
      vnp_PayDate: "20261031080500",
      vnp_TransactionNo: "1234",
      vnp_TransactionType: "01",
      vnp_TransactionStatus: "00",
      vnp_OrderInfo: "Query",
    };
    r.vnp_SecureHash = createHmac("sha512", "fixture-secret")
      .update(responseFields.map((k) => r[k] || "").join("|"))
      .digest("hex");
    if (tamper) r.vnp_Amount = "100";
    return new Response(JSON.stringify(r), { status: 200 });
  };
  try {
    const r = await provider.query(attempt);
    assert.equal(r.state, "succeeded");
    assert.equal(r.amount, 12500);
    assert.equal(r.paidAt.toISOString(), "2026-10-31T01:05:00.000Z");
    tamper = true;
    assert.equal(await provider.query(attempt), null);
    tamper = false;
    wrongReference = true;
    assert.equal(await provider.query(attempt), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("QueryDr timeout or non-success never becomes a verified failure", async () => {
  const originalFetch = globalThis.fetch,
    provider = new VnpayGateway({
      ...gateway.settings,
      queryUrl: "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
    });
  try {
    globalThis.fetch = async () => {
      throw new Error("timeout");
    };
    assert.equal(await provider.query({ provider_reference: "ref", created_at: new Date() }), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
