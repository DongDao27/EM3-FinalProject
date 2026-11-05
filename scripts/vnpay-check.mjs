import fs from "node:fs/promises";
import { sandboxSettings, receiptPath, publicIpnUrl, ipnPath } from "./lib/vnpay-sandbox.mjs";

let failed = false;
function check(ok, message) {
  console.log(`${ok ? "OK" : "FAIL"} ${message}`);
  if (!ok) failed = true;
}
async function probe(url, expected) {
  try {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000) });
    return response.ok && expected(await response.json());
  } catch {
    return false;
  }
}
try {
  const { env, backend } = await sandboxSettings();
  check(env.VNPAY_DEFERRED === "false", "Sandbox payment enabled");
  for (const key of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET"])
    check(!!env[key] && !/replace|change-me|your_/i.test(env[key]), `${key} configured (hidden)`);
  check(
    env.VNPAY_PAYMENT_URL === "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    "Sandbox payment endpoint",
  );
  check(
    env.VNPAY_QUERY_URL === "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
    "Sandbox query endpoint",
  );
  check(
    env.VNPAY_RETURN_URL === "http://localhost:3001/payment/vnpay-return",
    "Local return URL matches http://localhost:3001",
  );
  check(await probe(backend + "/health", (body) => body.data?.status === "ok"), "API/MySQL ready");
  check(
    await probe(backend + ipnPath, (body) => body.RspCode === "97"),
    "Local IPN rejects unsigned request with ACK97",
  );
  let raw = env.VNPAY_IPN_URL;
  if (!raw) {
    try {
      raw = JSON.parse(await fs.readFile(receiptPath, "utf8")).ipnUrl;
    } catch {
      // The user may not have opened a tunnel yet.
    }
  }
  if (!raw) check(false, "No public IPN URL. Start npm run payment:tunnel first.");
  else {
    const url = publicIpnUrl(raw);
    console.log("Public IPN URL: " + url);
    check(
      await probe(url, (body) => body.RspCode === "97"),
      "Public HTTPS reaches IPN and rejects unsigned request with ACK97",
    );
  }
  console.log("ACK97 is expected for this unsigned connectivity probe; no payment is created.");
  console.log(
    "This check does not verify merchant registration, credentials or a paid transaction.",
  );
} catch (error) {
  console.error(error.message);
  failed = true;
}
process.exitCode = failed ? 1 : 0;
