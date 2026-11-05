import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  outputDir: resolve(root, "output/e2e/results"),
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      name: "Test Express",
      command: `"${process.execPath}" backend/scripts/test.js e2e`,
      cwd: root,
      env: { E2E_TESTING: "1" },
      url: "http://localhost:18082/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      name: "Test Next.js",
      command: `"${process.execPath}" "${resolve(root, "node_modules/next/dist/bin/next")}" dev --hostname localhost --port 3100`,
      cwd: resolve(root, ".runtime/e2e-frontend"),
      env: { BACKEND_INTERNAL_URL: "http://localhost:18082", EM3_WORKSPACE_ROOT: root },
      url: "http://localhost:3100",
      reuseExistingServer: false,
      timeout: 90000,
    },
  ],
});
