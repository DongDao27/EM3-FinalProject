import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

export function productionPlan(root, env) {
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 8001)
    throw new Error("Public PORT must be valid and different from the private API port 8001.");
  const require = createRequire(path.join(root, "package.json"));
  const shared = { ...env, NODE_ENV: "production", BACKEND_INTERNAL_URL: "http://127.0.0.1:8001" };
  return [
    {
      name: "API",
      cwd: path.join(root, "backend"),
      args: ["src/server.js"],
      env: { ...shared, PORT: "8001", HOST: "127.0.0.1" },
    },
    {
      name: "Worker",
      cwd: path.join(root, "backend"),
      args: ["src/worker.js"],
      env: { ...shared, PORT: "8001", HOST: "127.0.0.1" },
    },
    {
      name: "Web",
      cwd: path.join(root, "frontend"),
      args: [
        require.resolve("next/dist/bin/next"),
        "start",
        "--hostname",
        "0.0.0.0",
        "--port",
        String(port),
      ],
      env: shared,
    },
  ];
}

export function supervise(plan, start = spawn, graceMs = 10000) {
  const children = new Set();
  let stopping = false,
    timer;
  let finish;
  const done = new Promise((resolve) => {
    finish = resolve;
  });
  let result = 0;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    result = code;
    for (const child of children) child.kill("SIGTERM");
    timer = setTimeout(() => {
      for (const child of children) child.kill("SIGKILL");
      finish(result);
    }, graceMs);
    if (!children.size) {
      clearTimeout(timer);
      finish(result);
    }
  }
  for (const service of plan) {
    const child = start(process.execPath, service.args, {
      cwd: service.cwd,
      env: service.env,
      stdio: "inherit",
      windowsHide: true,
    });
    children.add(child);
    child.once("error", () => {
      children.delete(child);
      console.error(`${service.name} could not start.`);
      stop(1);
      if (!children.size) {
        clearTimeout(timer);
        finish(result);
      }
    });
    child.once("exit", (code) => {
      children.delete(child);
      if (!stopping) {
        console.error(`${service.name} stopped; shutting down the deployment.`);
        stop(code || 1);
      }
      if (stopping && !children.size) {
        clearTimeout(timer);
        finish(result);
      }
    });
  }
  return { stop, done };
}
