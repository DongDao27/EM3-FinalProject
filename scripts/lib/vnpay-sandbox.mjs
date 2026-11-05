import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createServer } from "node:http";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const ipnPath = "/api/v1/payments/vnpay/ipn";
export const receiptPath = path.join(root, ".runtime/vnpay-tunnel.json");

export async function sandboxSettings() {
  const env = {
    ...dotenv.parse(await fs.readFile(path.join(root, "backend/.env"))),
    ...process.env,
  };
  if (env.NODE_ENV === "production" || env.VNPAY_ENV !== "sandbox")
    throw new Error("This tool requires VNPAY_ENV=sandbox and a local development environment.");
  const host = env.HOST || "localhost";
  if (!["localhost", "127.0.0.1", "::1"].includes(host))
    throw new Error("Use a loopback HOST for local Sandbox testing.");
  const port = Number(env.PORT || 8001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid API PORT.");
  return {
    env,
    backend: `http://${host === "::1" ? "[::1]" : host}:${port}`,
  };
}

export function publicIpnUrl(raw) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== ipnPath
  )
    throw new Error("VNPAY_IPN_URL must be the public HTTPS origin plus " + ipnPath);
  return url.href;
}

// The tunnel exposes only this relay, never the storefront, sessions or admin API.
export function createIpnRelay({ backend, timeout = 10000, notify = console.log }) {
  const target = new URL(backend);
  if (
    target.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    target.username ||
    target.password ||
    target.pathname !== "/" ||
    target.search ||
    target.hash
  )
    throw new Error("IPN relay target must be a loopback HTTP origin.");
  return createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    const raw = req.url || "/";
    if (raw.split("?")[0] !== ipnPath) {
      res.writeHead(404).end('{"error":"Not found"}');
      return;
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.writeHead(405).end('{"error":"GET required"}');
      return;
    }
    if (raw.length > 8192) {
      res.writeHead(414).end('{"error":"URI too long"}');
      return;
    }
    try {
      const response = await fetch(target.origin + raw, {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok) throw new Error("Backend unavailable");
      // Bound the response as well as the incoming request.
      let text = "";
      for await (const chunk of response.body) {
        text += Buffer.from(chunk).toString("utf8");
        if (text.length > 4096) throw new Error("Invalid ACK size");
      }
      const ack = JSON.parse(text);
      if (
        !["00", "01", "02", "04", "97", "99"].includes(ack.RspCode) ||
        typeof ack.Message !== "string"
      )
        throw new Error("Invalid backend ACK");
      res.end(JSON.stringify({ RspCode: ack.RspCode, Message: ack.Message }));
      // No signature, query, merchant secret or customer information is logged.
      notify(`[${new Date().toISOString()}] VNPAY IPN ACK=${ack.RspCode}`);
    } catch {
      res.writeHead(503).end('{"RspCode":"99","Message":"Local API unavailable"}');
      notify(`[${new Date().toISOString()}] VNPAY IPN relay failed; check the local API.`);
    }
  });
}
