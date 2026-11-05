import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { config } from "./config.js";
import { insert, first, query, transaction } from "./db.js";
import { now } from "./support.js";
const key = createHash("sha256").update(config.secret).digest();
function encrypt(value) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv),
    buffer = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), buffer]).toString("base64");
}
export function decryptMail(payload) {
  const b = Buffer.from(payload, "base64"),
    decipher = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString());
}
export async function enqueueMail(message, db) {
  await insert("em3_mail_jobs", { payload: encrypt(message), available_at: now() }, db);
}
export async function deliverMailBatch() {
  if (process.env.MAIL_TRANSPORT !== "smtp") return;
  const transport = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_SECURE === "true",
    auth: process.env.MAIL_USERNAME
      ? { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD }
      : undefined,
    connectionTimeout: 5000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  for (let i = 0; i < 20; i++) {
    const job = await transaction(async (db) => {
      const j = await first(
        "SELECT * FROM em3_mail_jobs WHERE completed_at IS NULL AND failed_at IS NULL AND available_at<=UTC_TIMESTAMP(6) AND (locked_at IS NULL OR locked_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 5 MINUTE)) ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED",
        [],
        db,
      );
      if (j)
        await query(
          "UPDATE em3_mail_jobs SET locked_at=UTC_TIMESTAMP(),attempts=attempts+1 WHERE id=?",
          [j.id],
          db,
        );
      return j;
    });
    if (!job) break;
    try {
      const message = decryptMail(job.payload);
      await transport.sendMail({
        ...message,
        from: { name: "Nhà sách Thu Thanh", address: process.env.MAIL_FROM_ADDRESS },
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      await query("UPDATE em3_mail_jobs SET completed_at=UTC_TIMESTAMP(),payload='' WHERE id=?", [
        job.id,
      ]);
    } catch {
      await query(
        "UPDATE em3_mail_jobs SET locked_at=NULL,available_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE),failed_at=IF(attempts>=5,UTC_TIMESTAMP(),NULL) WHERE id=?",
        [job.id],
      );
      console.error("Mail delivery failed; job " + job.id + " retained for bounded retry.");
    }
  }
  transport.close();
}
