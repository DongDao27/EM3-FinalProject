import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { productionPlan, supervise } from "./lib/production-processes.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const services = supervise(productionPlan(root, process.env));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => services.stop(0));
process.exitCode = await services.done;
