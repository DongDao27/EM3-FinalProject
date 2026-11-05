import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import { pool, first, insert, update } from "../src/db.js";
import { validate, z, str, passwordSchema, email, now } from "../src/support.js";
// Environment variables keep credentials out of command arguments/history. No default password.
try {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const identifier = email(process.env.ADMIN_EMAIL || (await rl.question("Admin email: ")));
  const name = process.env.ADMIN_NAME || (await rl.question("Admin name: "));
  rl.close();
  if (!process.env.ADMIN_PASSWORD)
    throw new Error(
      "Set ADMIN_PASSWORD in this process environment, then rerun. Password is never echoed.",
    );
  const body = validate(z.object({ email: z.email(), name: str(120), password: passwordSchema }), {
    email: identifier,
    name,
    password: process.env.ADMIN_PASSWORD,
  });
  const existing = await first("SELECT * FROM users WHERE email=?", [body.email]);
  if (existing) {
    if (existing.role !== "admin")
      throw new Error("Account is not an admin; refusing role promotion.");
    if (!process.argv.includes("--reset-password"))
      throw new Error("Admin exists. Use --reset-password only if a password reset is intended.");
    await update("users", existing.id, {
      password: await bcrypt.hash(body.password, 12),
      remember_token: null,
    });
  } else
    await insert("users", {
      name: body.name,
      email: body.email,
      password: await bcrypt.hash(body.password, 12),
      role: "admin",
      created_at: now(),
      updated_at: now(),
    });
  console.log("Admin saved.");
} finally {
  await pool.end();
}
