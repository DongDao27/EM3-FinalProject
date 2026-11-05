import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exists = async (name) =>
  fs.access(path.join(root, name)).then(
    () => true,
    () => false,
  );
const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
assert.deepEqual(manifest.workspaces, ["backend", "frontend"]);
assert.ok(await exists("package-lock.json"));
for (const directory of ["backend", "frontend"]) {
  assert.equal(await exists(`${directory}/package-lock.json`), false, "Keep one root lockfile.");
  assert.equal(
    await exists(`${directory}/node_modules`),
    false,
    "Install dependencies at the root.",
  );
}
const excluded = new Set([
  ".git",
  ".playwright-cli",
  "node_modules",
  ".next",
  ".runtime",
  "output",
  "storage",
]);
const source = [];
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(name);
    else source.push(name);
  }
}
await walk(root);
assert.ok(!source.some((name) => name.endsWith(".log")), "Logs do not belong in source.");
const readme = await fs.readFile(path.join(root, "README.md"), "utf8");
assert.ok(!/laravel|\bphp\b|ThuThanh-WebDesign/i.test(readme), "README must describe EM3 only.");
for (const match of readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
  const link = match[1];
  if (/^(https?:|#|mailto:)/.test(link)) continue;
  assert.ok(await exists(link.split("#")[0]), `Broken README link: ${link}`);
}
for (const name of ["thu-thanh-figma-clicon", "docs/reference-laravel", "backend/.env.clone"]) {
  assert.equal(await exists(name), false, `Obsolete artifact remains: ${name}`);
}
const snapshot = JSON.parse(
  await fs.readFile(path.join(root, "backend/database/catalog.json"), "utf8"),
);
assert.equal(snapshot.products.length, 137);
for (const image of snapshot.images) {
  const assetRoot = path.resolve(root, "backend/database/assets");
  const target = path.resolve(assetRoot, image.path);
  assert.ok(target.startsWith(assetRoot + path.sep));
  await fs.access(target);
}
console.log(
  `Repository check passed: one workspace lockfile, ${source.length} source files, 137 catalog products, complete seed assets.`,
);
