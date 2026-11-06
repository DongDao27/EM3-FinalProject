import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("HTTPS cookie survives the trusted private proxy and CSRF is still enforced", () => {
  assert.equal(process.env.DB_DATABASE, "thu_thanh_em3_test");
  const child = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./support/https-session-probe.js", import.meta.url))],
    {
      env: {
        ...process.env,
        NODE_ENV: "test",
        COOKIE_SECURE: "true",
        TRUST_PROXY: "loopback",
        FRONTEND_URL: "https://demo.example.test",
      },
      encoding: "utf8",
      timeout: 20000,
    },
  );
  assert.equal(child.status, 0, child.stdout + child.stderr);
});
test("forwarded HTTPS is ignored when proxy trust is disabled", () => {
  assert.equal(process.env.DB_DATABASE, "thu_thanh_em3_test");
  const child = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./support/https-session-probe.js", import.meta.url))],
    {
      env: {
        ...process.env,
        NODE_ENV: "test",
        COOKIE_SECURE: "true",
        TRUST_PROXY: "false",
        FRONTEND_URL: "https://demo.example.test",
      },
      encoding: "utf8",
      timeout: 20000,
    },
  );
  assert.equal(child.status, 0, child.stdout + child.stderr);
});
