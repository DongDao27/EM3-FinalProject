import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const children = new Set();
let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 750);
}

const services = [
  ["API", "backend", ["src/server.js"]],
  ["Worker", "backend", ["src/worker.js"]],
  [
    "Web",
    "frontend",
    [require.resolve("next/dist/bin/next"), "dev", "--hostname", "localhost", "--port", "3001"],
  ],
];

for (const [name, directory, args] of services) {
  const child = spawn(process.execPath, args, {
    cwd: path.join(root, directory),
    stdio: "inherit",
    windowsHide: true,
  });
  children.add(child);
  child.on("error", (error) => {
    console.error(`${name} could not start: ${error.message}`);
    stop(1);
  });
  child.on("exit", (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${name} stopped (${code ?? "signal"}). Stopping the development session.`);
      stop(code || 1);
    }
  });
}

console.log("Web http://localhost:3001 | API http://localhost:8001 | Ctrl+C stops all services.");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
