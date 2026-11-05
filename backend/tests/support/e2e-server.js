// This isolated fixture entry point is never imported by the application API.
if (
  process.env.NODE_ENV !== "test" ||
  process.env.DB_DATABASE !== "thu_thanh_em3_test" ||
  process.env.E2E_TESTING !== "1"
) {
  throw new Error("E2E requires the isolated test database and explicit test mode");
}
Object.assign(process.env, {
  PORT: "18082",
  HOST: "localhost",
  FRONTEND_URL: "http://localhost:3100",
  VNPAY_RETURN_URL: "http://localhost:3100/payment/vnpay-return",
  VNPAY_DEFERRED: "false",
  MAIL_TRANSPORT: "test",
});
const { default: express } = await import("express");
const { default: bcrypt } = await import("bcryptjs");
const { fileURLToPath } = await import("node:url");
const { config } = await import("../../src/config.js");
const { query, first, insert, pool } = await import("../../src/db.js");
const { migrate } = await import("../../scripts/database.js");
const { saveProduct } = await import("../../src/catalog.js");
const { VnpayGateway, gateway, vietnamDate } = await import("../../src/vnpay.js");
const { now } = await import("../../src/support.js");
const { app } = await import("../../src/app.js");
await migrate();
const db = await pool.getConnection();
try {
  await db.query("SET FOREIGN_KEY_CHECKS=0");
  for (const row of await query("SHOW TABLES", [], db)) {
    const table = Object.values(row)[0];
    if (!["em3_migrations", "migrations"].includes(table))
      await db.query("DELETE FROM `" + table + "`");
  }
} finally {
  await db.query("SET FOREIGN_KEY_CHECKS=1");
  db.release();
}
const adminId = await insert("users", {
  name: "Quản trị E2E",
  email: "admin-e2e@example.test",
  role: "admin",
  password: await bcrypt.hash("E2E-Local-Password-2026!", 4),
  created_at: now(),
  updated_at: now(),
});
const categoryId = await insert("categories", {
  name: "Sách kiểm thử E2E",
  slug: "e2e-books",
  sort_order: 0,
  is_active: 1,
  created_at: now(),
  updated_at: now(),
});
for (let i = 1; i <= 10; i++) {
  const product = await saveProduct(
    {
      category_id: categoryId,
      sku: "E2E-BOOK-" + i,
      name: "Sách kiểm thử E2E " + i,
      list_price: 100000,
      sale_price: 85000,
      opening_stock: 500,
      is_hot: true,
      is_bestseller: true,
    },
    null,
    adminId,
  );
  await insert("product_images", {
    product_id: product.id,
    storage_disk: "public",
    path: "e2e/cover-" + i + ".webp",
    mime: "image/webp",
    byte_size: 1,
    sort_order: 0,
    alt_text: product.name,
    created_at: now(),
    updated_at: now(),
  });
}
const results = new Map();
gateway.assertAvailable = () => {};
gateway.paymentUrl = (attempt, ip = "127.0.0.1") => {
  const url = new URL(VnpayGateway.prototype.paymentUrl.call(gateway, attempt, ip));
  url.hostname = "e2e-provider.invalid";
  url.pathname = "/pay";
  return url.href;
};
gateway.query = async (attempt) => results.get(attempt.provider_reference) ?? null;
const serverApp = express();
serverApp.get("/storage/e2e/:filename", (req, res) =>
  res.sendFile(
    fileURLToPath(new URL("../../../frontend/public/catalog-hd/TT-VH-001.webp", import.meta.url)),
  ),
);
serverApp.get("/__e2e/provider", async (req, res) => {
  const reference = String(req.query.vnp_TxnRef || req.query.reference || "");
  if (!gateway.equal(gateway.sign(req.query), req.query.vnp_SecureHash)) return res.sendStatus(403);
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(reference) ||
    !(await first("SELECT id FROM payment_attempts WHERE provider_reference=?", [reference]))
  )
    return res.sendStatus(404);
  const button = (outcome, label) =>
    `<form action="https://e2e-provider.invalid/__e2e/finish"><input type="hidden" name="reference" value="${reference}"><button name="outcome" value="${outcome}">${label}</button></form>`;
  res
    .type("html")
    .send(
      "<!doctype html><html lang=vi><meta charset=utf-8><h1>Cổng kiểm thử tự động</h1>" +
        button("success", "Xác nhận thành công") +
        button("cancel", "Hủy thanh toán") +
        button("unknown", "Chưa xác định") +
        "</html>",
    );
});
serverApp.get("/__e2e/finish", async (req, res) => {
  const attempt = await first("SELECT * FROM payment_attempts WHERE provider_reference=?", [
    String(req.query.reference || ""),
  ]);
  const outcome = req.query.outcome;
  if (!attempt || !["success", "cancel", "unknown"].includes(outcome)) return res.sendStatus(422);
  const payload = {
    vnp_TmnCode: config.vnpay.merchant,
    vnp_TxnRef: attempt.provider_reference,
    vnp_Amount: String(attempt.requested_amount * 100),
    vnp_TransactionNo: String(
      100000000 + Number.parseInt(attempt.provider_reference.slice(0, 8), 16),
    ),
    vnp_ResponseCode: outcome === "success" ? "00" : outcome === "cancel" ? "24" : "99",
    vnp_TransactionStatus: outcome === "success" ? "00" : outcome === "cancel" ? "02" : "01",
    vnp_PayDate: vietnamDate(now()),
  };
  payload.vnp_SecureHash = gateway.sign(payload);
  results.set(
    attempt.provider_reference,
    outcome === "unknown" ? null : gateway.verifyCallback(payload),
  );
  res.redirect(config.vnpay.returnUrl + "?" + new URLSearchParams(payload));
});
serverApp.get("/__e2e/evidence", async (req, res) => {
  const order = await first("SELECT * FROM orders WHERE order_code=?", [
    String(req.query.order_code || ""),
  ]);
  if (!order) return res.sendStatus(404);
  res.json({
    payment_status: order.payment_status,
    attempts: (await first("SELECT COUNT(*) n FROM payment_attempts WHERE order_id=?", [order.id]))
      .n,
    receipts: (await first("SELECT COUNT(*) n FROM payment_receipts WHERE order_id=?", [order.id]))
      .n,
  });
});
serverApp.use(app);
const server = serverApp.listen(18082, "localhost");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
