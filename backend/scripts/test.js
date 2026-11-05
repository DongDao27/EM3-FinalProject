import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import { testEnvironment } from "./test-env.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] || "test";
if (!["test", "migrate", "e2e"].includes(mode)) throw new Error("Unknown test command");
let local = {};
try {
  local = dotenv.parse(await fs.readFile(path.join(root, ".env")));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const env = testEnvironment({ ...local, ...process.env });
let args;
if (mode === "test") {
  const tests = (await fs.readdir(path.join(root, "tests")))
    .filter((name) => name.endsWith(".test.js"))
    .sort()
    .map((name) => path.join("tests", name));
  args = ["--test", "--test-concurrency=1", ...tests];
} else if (mode === "migrate") args = ["scripts/database.js", "migrate"];
else {
  env.E2E_TESTING = "1";
  args = ["tests/support/e2e-server.js"];
}
const child = spawn(process.execPath, args, {
  cwd: root,
  env,
  stdio: "inherit",
  windowsHide: true,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.once("error", () => {
  console.error("Unable to start the isolated test process.");
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
