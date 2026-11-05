import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("E2E server refuses production, application database and missing opt-in before loading the API", () => {
  const entry = fileURLToPath(new URL("./support/e2e-server.js", import.meta.url));
  for (const environment of [
    { NODE_ENV: "production", DB_DATABASE: "thu_thanh_em3_test", E2E_TESTING: "1" },
    { NODE_ENV: "test", DB_DATABASE: "thu_thanh_em3", E2E_TESTING: "1" },
    { NODE_ENV: "test", DB_DATABASE: "thu_thanh_em3_test", E2E_TESTING: "" },
  ]) {
    const result = spawnSync(process.execPath, [entry], {
      env: { ...process.env, ...environment },
      encoding: "utf8",
      timeout: 3000,
      windowsHide: true,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /E2E requires the isolated test database/);
  }
});
