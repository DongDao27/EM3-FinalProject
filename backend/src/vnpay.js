import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { config } from "./config.js";
import { fail, sha } from "./support.js";
const encode = (v) =>
  encodeURIComponent(String(v))
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");
export const canonical = (payload) =>
  Object.keys(payload)
    .filter((k) => !["vnp_SecureHash", "vnp_SecureHashType"].includes(k))
    .sort()
    .map((k) => encode(k) + "=" + encode(payload[k]))
    .join("&");
export const vietnamDate = (date) =>
  new Date(new Date(date).getTime() + 7 * 3600000).toISOString().replace(/[-:T]/g, "").slice(0, 14);
function parsePayDate(value) {
  if (!/^\d{14}$/.test(value || "")) return null;
  const v = String(value),
    d = new Date(
      `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(8, 10)}:${v.slice(10, 12)}:${v.slice(12, 14)}+07:00`,
    );
  return Number.isFinite(d.getTime()) && vietnamDate(d) === v ? d : null;
}
export class VnpayGateway {
  constructor(settings = config.vnpay) {
    this.settings = settings;
  }
  assertAvailable(qr = false) {
    const s = this.settings;
    if (!s.merchant || !s.secret || !s.paymentUrl || !s.returnUrl)
      fail("GATEWAY_NOT_CONFIGURED", "Thiếu cấu hình VNPAY Sandbox.", 503);
    if (s.environment !== "sandbox")
      fail("PAYMENT_ENV_NOT_AUTHORIZED", "Bản này chỉ hỗ trợ Sandbox.", 503);
    for (const raw of [s.paymentUrl, s.queryUrl].filter(Boolean)) {
      const u = new URL(raw);
      if (
        u.protocol !== "https:" ||
        u.hostname !== "sandbox.vnpayment.vn" ||
        u.username ||
        u.password
      )
        fail("GATEWAY_NOT_CONFIGURED", "Endpoint Sandbox không hợp lệ.", 503);
    }
  }
  hmac(value) {
    return createHmac("sha512", this.settings.secret || "")
      .update(value)
      .digest("hex");
  }
  sign(payload) {
    return this.hmac(canonical(payload));
  }
  equal(a, b) {
    return (
      typeof a === "string" &&
      typeof b === "string" &&
      /^[a-f\d]{128}$/i.test(a) &&
      /^[a-f\d]{128}$/i.test(b) &&
      timingSafeEqual(Buffer.from(a.toLowerCase(), "hex"), Buffer.from(b.toLowerCase(), "hex"))
    );
  }
  pipe(payload, fields) {
    return this.hmac(fields.map((k) => payload[k] ?? "").join("|"));
  }
  paymentUrl(attempt, ip) {
    this.assertAvailable();
    const p = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: this.settings.merchant,
      vnp_Amount: attempt.requested_amount * 100,
      vnp_CurrCode: "VND",
      vnp_TxnRef: attempt.provider_reference,
      vnp_OrderInfo: "Thu Thanh " + attempt.provider_reference,
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: this.settings.returnUrl,
      vnp_IpAddr: ip === "::1" ? "127.0.0.1" : ip.replace(/^::ffff:/, ""),
      vnp_CreateDate: vietnamDate(attempt.created_at),
      vnp_ExpireDate: vietnamDate(attempt.expires_at),
    };
    return this.settings.paymentUrl + "?" + canonical(p) + "&vnp_SecureHash=" + this.sign(p);
  }
  verifyCallback(input) {
    const p = Object.fromEntries(Object.entries(input).filter(([k]) => k.startsWith("vnp_")));
    if (
      !this.settings.secret ||
      !this.settings.merchant ||
      Object.values(p).some((v) => typeof v !== "string" || v.length > 1000)
    )
      return null;
    if (
      !this.equal(this.sign(p), p.vnp_SecureHash) ||
      p.vnp_TmnCode !== this.settings.merchant ||
      (p.vnp_CurrCode && p.vnp_CurrCode !== "VND")
    )
      return null;
    return this.normalize(p);
  }
  normalize(p) {
    const reference = String(p.vnp_TxnRef || ""),
      amount = String(p.vnp_Amount || ""),
      transactionId = String(p.vnp_TransactionNo || "");
    if (
      !/^[a-zA-Z0-9_-]{1,100}$/.test(reference) ||
      !/^\d{1,12}$/.test(amount) ||
      Number(amount) % 100 !== 0
    )
      return null;
    const state =
      p.vnp_ResponseCode === "00" && p.vnp_TransactionStatus === "00"
        ? "succeeded"
        : p.vnp_TransactionStatus === "02"
          ? "failed"
          : "unknown";
    if (state === "succeeded" && (!/^\d{1,15}$/.test(transactionId) || Number(transactionId) === 0))
      return null;
    const keys = [
        "vnp_TxnRef",
        "vnp_Amount",
        "vnp_TransactionNo",
        "vnp_PayDate",
        "vnp_ResponseCode",
        "vnp_TransactionStatus",
      ].sort(),
      safePayload = {};
    for (const k of keys) if (k in p) safePayload[k] = p[k];
    return {
      reference,
      state,
      amount: Number(amount) / 100,
      transactionId: transactionId || null,
      paidAt: parsePayDate(p.vnp_PayDate),
      safePayload,
      fingerprint: sha(safePayload),
    };
  }
  async query(attempt) {
    this.assertAvailable();
    if (!this.settings.queryUrl) return null;
    const s = this.settings,
      p = {
        vnp_RequestId: randomUUID().replaceAll("-", ""),
        vnp_Version: "2.1.0",
        vnp_Command: "querydr",
        vnp_TmnCode: s.merchant,
        vnp_TxnRef: attempt.provider_reference,
        vnp_TransactionDate: vietnamDate(attempt.created_at),
        vnp_CreateDate: vietnamDate(new Date()),
        vnp_IpAddr: s.queryIp,
        vnp_OrderInfo: "Query " + attempt.provider_reference,
      };
    p.vnp_SecureHash = this.pipe(p, [
      "vnp_RequestId",
      "vnp_Version",
      "vnp_Command",
      "vnp_TmnCode",
      "vnp_TxnRef",
      "vnp_TransactionDate",
      "vnp_CreateDate",
      "vnp_IpAddr",
      "vnp_OrderInfo",
    ]);
    try {
      const response = await fetch(s.queryUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
      if (!response.ok) return null;
      const raw = await response.text();
      if (raw.length > 64000) return null;
      const r = JSON.parse(raw);
      if (
        !r ||
        typeof r !== "object" ||
        Array.isArray(r) ||
        Object.values(r).some(
          (v) => v !== null && !["string", "number", "boolean"].includes(typeof v),
        )
      )
        return null;
      const fields = [
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
      if (
        r.vnp_Command !== "querydr" ||
        r.vnp_ResponseCode !== "00" ||
        r.vnp_TmnCode !== s.merchant ||
        r.vnp_TxnRef !== attempt.provider_reference ||
        r.vnp_TransactionType !== "01" ||
        !this.equal(this.pipe(r, fields), r.vnp_SecureHash)
      )
        return null;
      return this.normalize(r);
    } catch {
      return null;
    }
  }
}
export const gateway = new VnpayGateway();
