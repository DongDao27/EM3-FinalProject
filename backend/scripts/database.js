import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { config, root } from "../src/config.js";
import { pool, query, first, insert, transaction } from "../src/db.js";
import { now } from "../src/support.js";
export async function migrate() {
  await query(
    "CREATE TABLE IF NOT EXISTS em3_migrations(name VARCHAR(255) PRIMARY KEY, applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6))",
  );
  for (const name of (await fs.readdir(path.join(root, "database")))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if ((await query("SELECT name FROM em3_migrations WHERE name=?", [name])).length) continue;
    const connection = await mysql.createConnection({
      ...config.db,
      connectionLimit: undefined,
      multipleStatements: true,
    });
    try {
      await connection.query(await fs.readFile(path.join(root, "database", name), "utf8"));
      await query("INSERT INTO em3_migrations(name) VALUES(?)", [name]);
      console.log("Applied " + name);
    } finally {
      await connection.end();
    }
  }
}
export async function seed() {
  const catalog = JSON.parse(await fs.readFile(path.join(root, "database/catalog.json"), "utf8"));
  await transaction(async (db) => {
    const categoryMap = new Map(),
      productMap = new Map();
    for (const row of catalog.categories) {
      let existing = await first("SELECT id FROM categories WHERE slug=?", [row.slug], db);
      if (!existing) {
        const { id, ...fields } = row;
        existing = {
          id: await insert("categories", { ...fields, created_at: now(), updated_at: now() }, db),
        };
      }
      categoryMap.set(row.id, existing.id);
    }
    for (const row of catalog.products) {
      let existing = await first("SELECT id FROM products WHERE sku=?", [row.sku], db);
      if (!existing) {
        const { id, ...fields } = row;
        const newId = await insert(
          "products",
          {
            ...fields,
            category_id: categoryMap.get(row.category_id),
            stock_reserved: 0,
            created_at: now(),
            updated_at: now(),
          },
          db,
        );
        await insert(
          "inventory_movements",
          {
            product_id: newId,
            kind: "opening",
            delta_on_hand: row.stock_on_hand,
            delta_reserved: 0,
            resulting_on_hand: row.stock_on_hand,
            resulting_reserved: 0,
            reason: "Catalog snapshot initial stock",
            business_key: "product:" + newId + ":opening",
            created_at: now(),
          },
          db,
        );
        productMap.set(row.id, newId);
      }
      // Existing products, stock, prices and images are intentionally preserved on repeated seed.
    }
    for (const row of catalog.images)
      if (productMap.has(row.product_id)) {
        const { id, ...fields } = row;
        await insert(
          "product_images",
          {
            ...fields,
            product_id: productMap.get(row.product_id),
            created_at: now(),
            updated_at: now(),
          },
          db,
        );
      }
  });
  await fs.cp(path.join(root, "database/assets"), path.join(config.storageRoot, "public"), {
    recursive: true,
    force: false,
    errorOnExist: false,
  });
  console.log(
    "Catalog seed complete; existing records preserved. No demo orders or admin created.",
  );
}
if (process.argv[1]?.endsWith("database.js")) {
  try {
    if (process.argv[2] === "seed") await seed();
    else await migrate();
  } finally {
    await pool.end();
  }
}
