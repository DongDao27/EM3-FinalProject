import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
async function check(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) await check(name);
    else if (name.endsWith(".js")) {
      const result = spawnSync(process.execPath, ["--check", name], { stdio: "inherit" });
      if (result.status) process.exit(result.status);
    }
  }
}
for (const directory of ["src", "scripts", "tests"]) await check(directory);
console.log("JavaScript syntax passed.");
