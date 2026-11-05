import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
export class BusinessError extends Error {
  constructor(code, message, status = 409, fields = {}) {
    super(message);
    Object.assign(this, { code, status, fields });
  }
}
export function fail(code, message, status = 409) {
  throw new BusinessError(code, message, status);
}
export function must(value, code = "NOT_FOUND", message = "Không tìm thấy dữ liệu.", status = 404) {
  if (!value) fail(code, message, status);
  return value;
}
export const sha = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
export const now = () => new Date();
export const iso = (value) => (value ? new Date(value).toISOString() : null);
export const meta = (req, extra = {}) => ({
  server_time: now().toISOString(),
  request_id: req.requestId || randomUUID(),
  ...extra,
});
export const data = (req, res, value, status = 200, extra = {}) =>
  res.status(status).json({ data: value, meta: meta(req, extra) });
export const pageInfo = (q, total) => {
  const page = validate(z.coerce.number().int().min(1).max(1000000), q.page ?? 1),
    per_page = validate(z.coerce.number().int().min(1).max(100), q.per_page ?? 20);
  return {
    page,
    per_page,
    total: Number(total),
    last_page: Math.max(1, Math.ceil(total / per_page)),
  };
};
export const phone = (value) => {
  if (typeof value !== "string") return value;
  const p = value.replace(/[\s().-]/g, "");
  return p.startsWith("0") ? "+84" + p.slice(1) : p.startsWith("84") ? "+" + p : p;
};
export const email = (value) => (typeof value === "string" ? value.trim().toLowerCase() : value);
export const int = (min = 0, max = 1000000000) => z.number().int().min(min).max(max);
export const str = (max) => z.string().trim().min(1).max(max);
export const phoneSchema = z.string().regex(/^\+84[35789][0-9]{8}$/);
export function validate(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues)
      (fields[issue.path.join(".") || "request"] ||= []).push(issue.message);
    throw new BusinessError("VALIDATION_ERROR", "Dữ liệu không hợp lệ.", 422, fields);
  }
  return result.data;
}
export const keySchema = z.string().regex(/^[a-zA-Z0-9._-]{8,100}$/);
export const idemKey = (req) => validate(keySchema, req.get("Idempotency-Key"));
export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .refine((v) => Buffer.byteLength(v, "utf8") <= 72, "Mật khẩu tối đa 72 byte UTF-8.");
export { z };
