import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  root,
  ipnPath,
  receiptPath,
  sandboxSettings,
  createIpnRelay,
} from "./lib/vnpay-sandbox.mjs";

let child;
let relay;
let stopping = false;
const session = `${process.pid}-${Date.now()}`;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  child?.kill();
  relay?.close();
  relay?.closeAllConnections();
  try {
    const receipt = JSON.parse(await fs.readFile(receiptPath, "utf8"));
    if (receipt.session === session) await fs.unlink(receiptPath);
  } catch {
    // Another session or no published URL.
  }
  process.exitCode = code;
}

try {
  const { backend } = await sandboxSettings();
  const health = await fetch(backend + "/health", { signal: AbortSignal.timeout(5000) });
  if (!health.ok) throw new Error("Local API/database is unavailable. Start npm run dev first.");
  const portable = path.join(root, ".runtime/tools/cloudflared.exe");
  let binary = "cloudflared";
  try {
    await fs.access(portable);
    binary = portable;
  } catch {
    // Prefer the user's installed executable when there is no portable copy.
  }
  const version = spawnSync(binary, ["--version"], { windowsHide: true, encoding: "utf8" });
  if (version.error || version.status !== 0)
    throw new Error(
      "Install cloudflared: winget install --id Cloudflare.cloudflared --exact ; then reopen the terminal.",
    );
  relay = createIpnRelay({ backend });
  await new Promise((resolve, reject) => {
    relay.once("error", reject);
    relay.listen(18081, "127.0.0.1", resolve);
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void stop());
  console.log("Sandbox IPN relay ready on 127.0.0.1:18081. Ctrl+C stops the tunnel.");
  child = spawn(binary, ["tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:18081"], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let buffer = "";
  let published = false;
  let publish = Promise.resolve();
  function output(chunk) {
    // Cloudflared's connection status goes to the console only, never a log file.
    process.stdout.write(chunk);
    buffer = (buffer + chunk.toString()).slice(-16000);
    const origin = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/)?.[0];
    if (!origin || published || stopping) return;
    published = true;
    publish = (async () => {
      await fs.mkdir(path.dirname(receiptPath), { recursive: true });
      await fs.writeFile(
        receiptPath,
        JSON.stringify({ session, ipnUrl: origin + ipnPath, createdAt: new Date().toISOString() }),
      );
      console.log(`\nRegister this IPN URL with your VNPAY Sandbox merchant:\n${origin + ipnPath}`);
      console.log("Keep this terminal open. Run npm run payment:check in another terminal.");
      console.log("Return URL stays http://localhost:3001/payment/vnpay-return.");
    })().catch((error) => console.error(error.message));
  }
  child.stdout.on("data", output);
  child.stderr.on("data", output);
  child.once("error", () => void stop(1));
  child.once("exit", async (code) => {
    await publish;
    if (!stopping) {
      console.error("Tunnel stopped. The temporary IPN URL is no longer available.");
      await stop(code || 1);
    }
  });
} catch (error) {
  console.error(error.message);
  await stop(1);
}
