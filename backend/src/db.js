import mysql from "mysql2/promise";
import { config } from "./config.js";
export const pool = mysql.createPool(config.db);
// TIMESTAMP conversion must remain UTC even when the MySQL host uses local time.
pool.on("connection", (connection) => connection.query("SET time_zone = '+00:00'"));
export const query = async (sql, values = [], db = pool) => (await db.query(sql, values))[0];
export const first = async (sql, values = [], db = pool) =>
  (await query(sql, values, db))[0] || null;
export const json = (value) => (typeof value === "string" ? JSON.parse(value) : value);
export async function transaction(fn) {
  for (let attempt = 0; ; attempt++) {
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      const result = await fn(db);
      await db.commit();
      return result;
    } catch (error) {
      await db.rollback();
      if (attempt < 2 && ["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error.code))
        continue;
      throw error;
    } finally {
      db.release();
    }
  }
}
export async function insert(table, data, db = pool) {
  const keys = Object.keys(data);
  const result = await query(
    `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
    keys.map((k) => (data[k] === undefined ? null : data[k])),
    db,
  );
  return result.insertId;
}
export async function update(table, id, data, db = pool) {
  const keys = Object.keys(data);
  await query(
    `UPDATE \`${table}\` SET ${keys.map((k) => `\`${k}\`=?`).join(",")}, updated_at=UTC_TIMESTAMP(6) WHERE id=?`,
    [...keys.map((k) => data[k]), id],
    db,
  );
}
