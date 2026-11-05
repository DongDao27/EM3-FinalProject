import bcrypt from "bcryptjs";
import { createHmac, randomBytes } from "node:crypto";
import { config } from "./config.js";
import { first, insert, update, query, transaction } from "./db.js";
import {
  fail,
  must,
  validate,
  z,
  str,
  email,
  phone,
  phoneSchema,
  passwordSchema,
  now,
  sha,
} from "./support.js";
import { enqueueMail } from "./mail.js";
export const userResource = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
});
const fingerprint = (u) => createHmac("sha256", config.secret).update(u.password).digest("hex");
export async function loadUser(req, res, next) {
  try {
    req.user = null;
    if (req.session.userId) {
      const u = await first("SELECT * FROM users WHERE id=?", [req.session.userId]);
      if (u && req.session.authHash === fingerprint(u)) req.user = u;
      else
        await new Promise((resolve, reject) =>
          req.session.regenerate((e) => (e ? reject(e) : resolve())),
        );
    }
    next();
  } catch (error) {
    next(error);
  }
}
export const requireUser = (req, res, next) =>
  req.user
    ? next()
    : next(
        Object.assign(new Error("Vui lòng đăng nhập."), { status: 401, code: "UNAUTHENTICATED" }),
      );
export const role = (expected) => (req, res, next) =>
  req.user?.role === expected
    ? next()
    : next(
        Object.assign(new Error("Không có quyền truy cập."), { status: 403, code: "FORBIDDEN" }),
      );
export async function signIn(req, u) {
  await new Promise((resolve, reject) =>
    req.session.regenerate((e) => (e ? reject(e) : resolve())),
  );
  req.session.userId = u.id;
  req.session.authHash = fingerprint(u);
  req.session.csrf = randomBytes(32).toString("hex");
  await new Promise((resolve, reject) => req.session.save((e) => (e ? reject(e) : resolve())));
  return userResource(u);
}
export async function register(req) {
  const input = { ...req.body };
  if (input.email !== undefined) input.email = email(input.email);
  if (input.phone !== undefined) input.phone = phone(input.phone);
  const body = validate(
    z
      .strictObject({
        name: str(120),
        email: z.email().max(254).nullish(),
        phone: phoneSchema.nullish(),
        password: passwordSchema,
        password_confirmation: z.string(),
      })
      .refine((b) => !!(b.email || b.phone), {
        message: "Cần email hoặc số điện thoại.",
        path: ["email"],
      })
      .refine((b) => b.password === b.password_confirmation, {
        message: "Mật khẩu xác nhận không khớp.",
        path: ["password_confirmation"],
      }),
    input,
  );
  const hash = await bcrypt.hash(body.password, 12);
  const id = await insert("users", {
    name: body.name,
    email: body.email ?? null,
    phone: body.phone ?? null,
    password: hash,
    role: "customer",
    created_at: now(),
    updated_at: now(),
  });
  return signIn(req, await first("SELECT * FROM users WHERE id=?", [id]));
}
const dummyHash = bcrypt.hashSync("em3-dummy-account-password", 12);
export async function login(req) {
  const b = validate(
      z.strictObject({ identifier: str(254), password: z.string().max(128) }),
      req.body,
    ),
    identifier = b.identifier.includes("@") ? email(b.identifier) : phone(b.identifier);
  const u = await first("SELECT * FROM users WHERE email=? OR phone=? LIMIT 1", [
    identifier,
    identifier,
  ]);
  const valid = await bcrypt.compare(
    b.password,
    (u?.password || dummyHash).replace(/^\$2y\$/, "$2b$"),
  );
  if (!u || !valid) fail("INVALID_CREDENTIALS", "Thông tin đăng nhập không chính xác.", 422);
  return signIn(req, u);
}
export async function profile(req) {
  const input = { ...req.body };
  if ("email" in input) input.email = email(input.email);
  if ("phone" in input) input.phone = phone(input.phone);
  const b = validate(
    z
      .strictObject({
        name: str(120),
        email: z.email().max(254).nullish(),
        phone: phoneSchema.nullish(),
      })
      .refine((b) => !!(b.email || b.phone), { message: "Cần email hoặc số điện thoại." }),
    input,
  );
  await update("users", req.user.id, {
    name: b.name,
    email: b.email ?? null,
    phone: b.phone ?? null,
  });
  return userResource(await first("SELECT * FROM users WHERE id=?", [req.user.id]));
}
export async function forgotPassword(input) {
  const b = validate(z.strictObject({ email: z.email().max(254) }), {
    ...input,
    email: email(input.email),
  });
  if (
    process.env.MAIL_TRANSPORT !== "smtp" &&
    !(config.env === "test" && process.env.MAIL_TRANSPORT === "test")
  )
    fail("RECOVERY_UNAVAILABLE", "Cần cấu hình SMTP để gửi thư khôi phục.", 503);
  const u = await first("SELECT * FROM users WHERE email=? AND role='customer'", [b.email]);
  if (u)
    await transaction(async (db) => {
      await first("SELECT id FROM users WHERE id=? FOR UPDATE", [u.id], db);
      const existing = await first(
        "SELECT * FROM password_reset_tokens WHERE email=?",
        [b.email],
        db,
      );
      if (existing && existing.created_at > new Date(Date.now() - 60000)) return;
      const token = randomBytes(32).toString("hex");
      await query(
        "INSERT INTO password_reset_tokens(email,token,created_at) VALUES(?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE token=VALUES(token),created_at=VALUES(created_at)",
        [b.email, sha(token)],
        db,
      );
      const link = new URL("/reset-password", config.frontend);
      link.searchParams.set("email", b.email);
      link.searchParams.set("token", token);
      await enqueueMail(
        {
          to: b.email,
          subject: "Thu Thanh – Đặt lại mật khẩu",
          text: "Liên kết có hiệu lực 60 phút: " + link.href,
        },
        db,
      );
    });
  return {
    message:
      "Nếu email khớp tài khoản khách hàng, bạn sẽ nhận được liên kết đặt lại mật khẩu. Vui lòng kiểm tra cả thư rác.",
  };
}
export async function resetPassword(req) {
  const b = validate(
    z
      .strictObject({
        email: z.email(),
        token: str(255),
        password: passwordSchema,
        password_confirmation: z.string(),
      })
      .refine((b) => b.password === b.password_confirmation, {
        message: "Mật khẩu xác nhận không khớp.",
        path: ["password_confirmation"],
      }),
    { ...req.body, email: email(req.body.email) },
  );
  const hash = await bcrypt.hash(b.password, 12);
  await transaction(async (db) => {
    const u = await first(
      "SELECT * FROM users WHERE email=? AND role='customer' FOR UPDATE",
      [b.email],
      db,
    );
    const token = await first(
      "SELECT * FROM password_reset_tokens WHERE email=? FOR UPDATE",
      [b.email],
      db,
    );
    if (
      !u ||
      !token ||
      token.created_at < new Date(Date.now() - 3600000) ||
      token.token !== sha(b.token)
    )
      fail("VALIDATION_ERROR", "Liên kết không hợp lệ hoặc đã hết hạn.", 422);
    await update("users", u.id, { password: hash, remember_token: null }, db);
    await query("DELETE FROM password_reset_tokens WHERE email=?", [b.email], db);
    await query("DELETE FROM em3_sessions WHERE user_id=?", [u.id], db);
  });
  await new Promise((resolve, reject) => req.session.destroy((e) => (e ? reject(e) : resolve())));
  return { message: "Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại." };
}
