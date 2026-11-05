import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isolated = path.resolve(root, ".runtime/e2e-frontend");
if (!isolated.startsWith(root + path.sep)) throw new Error("Unsafe test preview path");
await fs.mkdir(path.join(root, "output/e2e"), { recursive: true });
await fs.cp(path.join(root, "frontend"), isolated, {
  recursive: true,
  filter: (source) => {
    const name = path.basename(source);
    return (
      ![".next", "node_modules", "output", "test-results", "playwright-report"].includes(name) &&
      !name.startsWith(".env") &&
      !name.endsWith(".tsbuildinfo")
    );
  },
});
const require = createRequire(import.meta.url);
const child = spawn(
  process.execPath,
  [
    require.resolve("@playwright/test/cli"),
    "test",
    "--config=frontend/playwright.config.ts",
    ...process.argv.slice(2),
  ],
  { cwd: root, stdio: "inherit", windowsHide: true },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
