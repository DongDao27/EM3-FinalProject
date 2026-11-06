import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { productionPlan, supervise } from "../lib/production-processes.mjs";

test("platform PORT belongs to web, API stays private and worker uses the same backend configuration", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const plan = productionPlan(root, { PORT: "4567" });
  assert.equal(plan.length, 3);
  assert.equal(plan[0].env.PORT, "8001");
  assert.equal(plan[0].env.HOST, "127.0.0.1");
  assert.equal(plan[1].env.PORT, "8001");
  assert.equal(plan[1].env.NODE_ENV, "production");
  assert.equal(plan[2].args.at(-1), "4567");
  assert(plan[2].args.includes("0.0.0.0"));
  for (const value of ["8001", "0", "65536", "not-a-port"])
    assert.throws(() => productionPlan(root, { PORT: value }));
});
function fakeChildren() {
  const children = [];
  const start = () => {
    const child = new EventEmitter();
    child.signals = [];
    child.kill = (signal) => {
      child.signals.push(signal);
      queueMicrotask(() => child.emit("exit", null));
    };
    children.push(child);
    return child;
  };
  return { children, start };
}
test("a failed API stops the web and worker instead of leaving a broken deployment", async () => {
  const { children, start } = fakeChildren();
  const services = supervise([{ name: "API" }, { name: "Worker" }, { name: "Web" }], start, 100);
  children[0].emit("exit", 2);
  assert.equal(await services.done, 2);
  assert.deepEqual(children[1].signals, ["SIGTERM"]);
  assert.deepEqual(children[2].signals, ["SIGTERM"]);
});
test("shutdown is idempotent and successful, spawn failure terminates siblings", async () => {
  const first = fakeChildren(),
    normal = supervise([{ name: "API" }, { name: "Web" }], first.start, 100);
  normal.stop(0);
  normal.stop(1);
  assert.equal(await normal.done, 0);
  const second = fakeChildren(),
    broken = supervise([{ name: "API" }, { name: "Web" }], second.start, 100);
  second.children[0].emit("error", new Error("fixture"));
  assert.equal(await broken.done, 1);
  assert.deepEqual(second.children[1].signals, ["SIGTERM"]);
});
