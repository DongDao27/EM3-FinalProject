import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { config } from "./config.js";
import { query, first, update, transaction, insert } from "./db.js";
import {
  BusinessError,
  fail,
  must,
  data,
  meta,
  validate,
  z,
  int,
  str,
  idemKey,
  now,
  iso,
} from "./support.js";
import { MySqlSessionStore } from "./session-store.js";
import {
  loadUser,
  requireUser,
  role,
  register,
  login,
  profile,
  userResource,
  forgotPassword,
  resetPassword,
} from "./auth.js";
import {
  products,
  productResource,
  categoryResource,
  storefront,
  saveProduct,
  inventoryResource,
} from "./catalog.js";
import {
  getCart,
  mutateCart,
  createQuote,
  checkout,
  findOrder,
  orderResource,
  orderItems,
  lockedCart,
  cartResource,
  fulfill,
} from "./commerce.js";
import {
  collectCash,
  counterCheckoutUrl,
  createAttempt,
  presentAttempt,
  paymentStatus,
  applyPayment,
  confirmReturn,
  closeOrder,
} from "./payments.js";
import { gateway } from "./vnpay.js";
import {
  paginated,
  listOrders,
  adjustInventory,
  saveCategory,
  uploadImage,
  deleteImage,
  orderHistory,
  caseResource,
  resolveCase,
  dashboard,
  revenue,
  vietnamStart,
} from "./admin.js";
export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy);
app.set("query parser", "simple");
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-origin" } }));
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.set("X-Request-ID", req.requestId);
  res.set("Cache-Control", "private, no-store");
  next();
});
app.get("/health", async (req, res) => {
  await first("SELECT 1");
  data(req, res, { status: "ok", backend: "express", database: "mysql" });
});
app.use(
  "/storage",
  express.static(path.join(config.storageRoot, "public"), {
    dotfiles: "deny",
    index: false,
    maxAge: "1d",
    setHeaders: (res) => res.set("X-Content-Type-Options", "nosniff"),
  }),
);
app.use(express.json({ limit: "64kb" }), cookieParser());
app.use(
  session({
    name: config.cookie,
    secret: config.secret,
    store: new MySqlSessionStore(),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: config.secure, maxAge: 86400000, path: "/" },
  }),
);
app.get("/sanctum/csrf-cookie", (req, res) => {
  req.session.csrf ||= randomBytes(32).toString("hex");
  res.cookie("XSRF-TOKEN", req.session.csrf, {
    httpOnly: false,
    sameSite: "lax",
    secure: config.secure,
    path: "/",
  });
  res.status(204).end();
});
app.use("/api/v1", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("Origin");
  if (
    origin &&
    ![config.frontend, new URL(config.frontend).origin, `http://localhost:${config.port}`].includes(
      origin,
    )
  )
    return next(new BusinessError("CSRF_MISMATCH", "Nguồn yêu cầu không hợp lệ.", 419));
  const supplied = req.get("X-XSRF-TOKEN"),
    expected = req.session.csrf;
  if (
    typeof supplied !== "string" ||
    typeof expected !== "string" ||
    !/^[a-f0-9]{64}$/.test(supplied) ||
    supplied.length !== expected.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return next(new BusinessError("CSRF_MISMATCH", "Phiên CSRF không hợp lệ.", 419));
  next();
});
const api = express.Router();
app.use("/api/v1", api);
api.use((req, res, next) => {
  if (Object.values(req.query).some((v) => typeof v !== "string" || v.length > 1000))
    return next(new BusinessError("VALIDATION_ERROR", "Query không hợp lệ.", 422));
  next();
});
const limited = (limit, minutes = 1) =>
  rateLimit({
    windowMs: minutes * 60000,
    limit: config.env === "test" ? 10000 : limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
          fields: {},
        },
        meta: meta(req),
      }),
  });
api.get("/payments/vnpay/checkout/:reference", limited(60), async (req, res) => {
  if (!/^[a-f0-9]{32}$/.test(req.params.reference))
    fail("NOT_FOUND", "Không tìm thấy liên kết.", 404);
  res.set("Referrer-Policy", "no-referrer");
  res.redirect(302, await counterCheckoutUrl(req.params.reference, req.ip));
});
api.get("/payments/vnpay/ipn", async (req, res) => {
  let code = "99";
  try {
    const verified = gateway.verifyCallback(req.query);
    code = verified ? await applyPayment(verified, "ipn") : "97";
  } catch {
    console.error("VNPAY IPN could not be applied. Request " + req.requestId);
  }
  const messages = {
    "00": "Confirm Success",
    "01": "Order not found",
    "02": "Order already confirmed",
    "04": "Invalid amount",
    97: "Invalid signature",
    99: "Unknown error",
  };
  res.json({ RspCode: code, Message: messages[code] });
});
api.get("/payments/vnpay/return", limited(30), async (req, res) => {
  const verified = must(
      gateway.verifyCallback(req.query),
      "INVALID_PAYMENT_RETURN",
      "Chữ ký thanh toán không hợp lệ.",
      422,
    ),
    o = must(
      await confirmReturn(verified),
      "PAYMENT_NOT_FOUND",
      "Không tìm thấy lần thanh toán.",
      404,
    );
  data(req, res, {
    verified: true,
    order_code: o.order_code,
    result: verified.state,
    payment_status: o.payment_status,
  });
});
function catalogQuery(req) {
  const b = validate(
    z.strictObject({
      q: z.string().max(255).optional(),
      category_id: z.coerce.number().int().positive().optional(),
      grade: z.coerce.number().int().min(1).max(12).optional(),
      section: z.enum(["hot", "bestseller", "new"]).optional(),
      sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
      brand: z.string().max(255).optional(),
      page: z.coerce.number().int().min(1).optional(),
      per_page: z.coerce.number().int().min(1).max(100).optional(),
      is_active: z.enum(["0", "1"]).optional(),
    }),
    req.query,
  );
  return b;
}
const respondPage = (req, res, p) => data(req, res, p.items, 200, { pagination: p.pagination });
api.get("/storefront", async (req, res) => {
  res.set("Cache-Control", "public, max-age=0, s-maxage=20, stale-while-revalidate=20");
  data(req, res, await storefront());
});
api.get("/categories", async (req, res) =>
  data(
    req,
    res,
    (await query("SELECT * FROM categories WHERE is_active=1 ORDER BY sort_order,id")).map(
      categoryResource,
    ),
  ),
);
api.get("/products", async (req, res) => respondPage(req, res, await products(catalogQuery(req))));
api.get("/products/:id", async (req, res) => {
  const p = must(
    await first(
      "SELECT p.* FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=? AND p.is_active=1 AND c.is_active=1",
      [req.params.id],
    ),
  );
  data(req, res, await productResource(p));
});
api.use(loadUser);
api.get("/home", async (req, res) =>
  data(req, res, await storefront(req.user?.role === "customer" ? req.user.id : null)),
);
api.post("/newsletter/subscriptions", limited(10), async (req, res) => {
  const b = validate(z.strictObject({ email: z.email().max(254), consent: z.literal(true) }), {
    ...req.body,
    email:
      typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : req.body.email,
  });
  await query(
    "INSERT IGNORE INTO newsletter_subscriptions(email,consented_at,created_at,updated_at) VALUES(?,UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP())",
    [b.email],
  );
  data(req, res, { message: "Đăng ký nhận tin thành công." }, 202);
});
api.post("/auth/register", limited(5), async (req, res) =>
  data(req, res, await register(req), 201),
);
api.post("/auth/login", limited(10), async (req, res) => data(req, res, await login(req)));
api.post("/auth/forgot-password", limited(5), async (req, res) =>
  data(req, res, await forgotPassword(req.body), 202),
);
api.post("/auth/reset-password", limited(5), async (req, res) =>
  data(req, res, await resetPassword(req)),
);
api.use(requireUser);
api.get("/auth/me", (req, res) => data(req, res, userResource(req.user)));
api.patch("/auth/profile", limited(10), async (req, res) => data(req, res, await profile(req)));
api.post("/auth/logout", async (req, res) => {
  await new Promise((resolve, reject) => req.session.destroy((e) => (e ? reject(e) : resolve())));
  res.clearCookie(config.cookie, { path: "/" });
  data(req, res, { message: "Đã đăng xuất." });
});
const customer = express.Router();
api.use(customer);
customer.use(
  (req, res, next) => (req.path.startsWith("/admin") ? next("router") : next()),
  role("customer"),
);
customer.get("/cart", async (req, res) => data(req, res, await getCart(req.user.id)));
customer.post("/cart/items", async (req, res) => {
  const b = validate(z.strictObject({ product_id: int(1), quantity: int(1, 99) }), req.body);
  data(req, res, await mutateCart(req.user.id, "add", b));
});
customer.patch("/cart/items/:id", async (req, res) => {
  const b = validate(z.strictObject({ quantity: int(1, 99) }), req.body);
  data(req, res, await mutateCart(req.user.id, "set", { ...b, id: req.params.id }));
});
customer.delete("/cart/items/:id", async (req, res) => {
  await mutateCart(req.user.id, "delete", { id: req.params.id });
  res.status(204).end();
});
customer.post("/checkout/quotes", async (req, res) =>
  data(req, res, await createQuote(req.user.id, req.body), 201),
);
customer.post("/orders", async (req, res) => {
  const b = validate(z.strictObject({ quote_id: z.uuid() }), req.body),
    r = await checkout(req.user.id, b.quote_id.toLowerCase(), idemKey(req));
  data(req, res, r.order, r.replayed ? 200 : 201, { replayed: r.replayed });
});
customer.get("/orders", async (req, res) =>
  respondPage(req, res, await listOrders(req.user, catalogQuery(req))),
);
customer.get("/orders/:code", async (req, res) => {
  let o = await findOrder(req.params.code, req.user);
  if (o.lifecycle === "open" && o.payment_status !== "paid" && now() >= o.expires_at)
    await closeOrder(o);
  o = await findOrder(req.params.code, req.user);
  data(req, res, await orderResource(o));
});
customer.post("/orders/:code/cancel", async (req, res) => {
  validate(z.strictObject({}), req.body ?? {});
  data(req, res, await closeOrder(await findOrder(req.params.code, req.user), true, req.user.id));
});
customer.post("/orders/:code/reorder", async (req, res) => {
  const o = await findOrder(req.params.code, req.user);
  validate(z.strictObject({}), req.body ?? {});
  data(
    req,
    res,
    await transaction(async (db) => {
      const cart = await lockedCart(req.user.id, db),
        warnings = [];
      for (const line of await orderItems(o.id, db)) {
        const p = await productResource(
            await first("SELECT * FROM products WHERE id=?", [line.product_id], db),
            db,
          ),
          old = await first(
            "SELECT quantity FROM cart_items WHERE cart_id=? AND product_id=?",
            [cart.id, p.id],
            db,
          ),
          current = old?.quantity || 0;
        if (!p.is_active || !p.category.is_active || p.available_quantity <= current) {
          warnings.push("Không thể thêm sản phẩm " + p.id);
          continue;
        }
        const quantity = Math.min(99, p.available_quantity, current + line.quantity);
        if (quantity < current + line.quantity)
          warnings.push("Số lượng sản phẩm " + p.id + " đã giới hạn theo tồn.");
        await query(
          "INSERT INTO cart_items(cart_id,product_id,quantity,created_at,updated_at) VALUES(?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)",
          [cart.id, p.id, quantity],
          db,
        );
      }
      const resource = await cartResource(cart, db);
      resource.warnings.push(...warnings);
      return resource;
    }),
  );
});
function paymentRoutes(router, admin = false) {
  router.post("/orders/:code/payment-attempts", limited(30), async (req, res) => {
    validate(z.strictObject({}), req.body ?? {});
    const o = await findOrder(req.params.code, req.user),
      a = await createAttempt(o, req.user.id, idemKey(req), admin);
    data(req, res, presentAttempt(a, o, req.ip, admin));
  });
  router.get("/orders/:code/payment-status", limited(60), async (req, res) =>
    data(req, res, await paymentStatus(await findOrder(req.params.code, req.user))),
  );
}
paymentRoutes(customer);
const admin = express.Router();
api.use("/admin", role("admin"), admin);
admin.get("/dashboard", async (req, res) => data(req, res, await dashboard()));
admin.get("/revenue", async (req, res) => data(req, res, await revenue(req.query)));
admin.get("/orders", async (req, res) => {
  for (const key of ["from", "to"]) if (req.query[key]) vietnamStart(req.query[key]);
  respondPage(req, res, await listOrders(req.user, req.query));
});
admin.get("/orders/:code", async (req, res) =>
  data(req, res, await orderResource(await findOrder(req.params.code, req.user))),
);
admin.get("/orders/:code/history", async (req, res) =>
  respondPage(req, res, await orderHistory(await findOrder(req.params.code, req.user), req.query)),
);
admin.post("/orders/:code/cash-payment", limited(30), async (req, res) => {
  validate(z.strictObject({}), req.body ?? {});
  data(req, res, await collectCash(await findOrder(req.params.code, req.user), req.user.id));
});
admin.patch("/orders/:code/fulfillment", async (req, res) => {
  const b = validate(
    z.strictObject({
      target_status: z.enum(["preparing", "ready_for_pickup", "shipping", "fulfilled"]),
      version: int(1),
    }),
    req.body,
  );
  data(
    req,
    res,
    await fulfill(
      await findOrder(req.params.code, req.user),
      b.target_status,
      b.version,
      req.user.id,
    ),
  );
});
paymentRoutes(admin, true);
admin.post("/orders/:code/refund-records", (req, res) =>
  fail("REFUNDS_DISABLED", "Chính sách cửa hàng không đổi trả hoặc hoàn tiền.", 403),
);
admin.get("/refund-records/:id/evidence", async (req, res) => {
  const r = must(await first("SELECT evidence_path FROM refunds WHERE id=?", [req.params.id])),
    base = path.resolve(config.storageRoot, "private"),
    target = path.resolve(base, r.evidence_path);
  if (!target.startsWith(base + path.sep)) fail("NOT_FOUND", "Không tìm thấy bằng chứng.", 404);
  res.download(target, "evidence");
});
admin.get("/reconciliation-cases", async (req, res) => {
  const q = req.query,
    status = q.status || "open";
  if (!["open", "resolved"].includes(status))
    fail("VALIDATION_ERROR", "Trạng thái không hợp lệ.", 422);
  respondPage(
    req,
    res,
    await paginated("reconciliation_cases", "WHERE status=?", [status], q, caseResource),
  );
});
admin.patch("/reconciliation-cases/:id", async (req, res) =>
  data(req, res, await resolveCase(req.params.id, req.body, req.user.id)),
);
admin.get("/inventory", async (req, res) => {
  const q = catalogQuery(req),
    where = q.q ? "WHERE LOCATE(?,name)>0 OR LOCATE(?,sku)>0" : "",
    params = q.q ? [q.q, q.q] : [];
  respondPage(
    req,
    res,
    await paginated("products", where, params, q, async (p) => inventoryResource(p)),
  );
});
admin.get("/inventory/:id/movements", async (req, res) => {
  must(await first("SELECT id FROM products WHERE id=?", [req.params.id]));
  respondPage(
    req,
    res,
    await paginated(
      "inventory_movements",
      "WHERE product_id=?",
      [req.params.id],
      req.query,
      async (m) => ({
        id: m.id,
        kind: m.kind,
        delta_on_hand: m.delta_on_hand,
        delta_reserved: m.delta_reserved,
        resulting_on_hand: m.resulting_on_hand,
        resulting_reserved: m.resulting_reserved,
        reason: m.reason,
        actor_name: m.actor_id
          ? (await first("SELECT name FROM users WHERE id=?", [m.actor_id]))?.name
          : null,
        order_code: m.order_id
          ? (await first("SELECT order_code FROM orders WHERE id=?", [m.order_id]))?.order_code
          : null,
        created_at: iso(m.created_at),
      }),
    ),
  );
});
admin.post("/inventory/:id/adjustments", async (req, res) => {
  const b = validate(
    z.strictObject({
      delta: int(-2147483647, 2147483647).refine((v) => v !== 0),
      reason: str(1000),
      request_key: z
        .string()
        .max(100)
        .regex(/^[a-zA-Z0-9_-]+$/),
    }),
    req.body,
  );
  data(req, res, await adjustInventory(req.params.id, b, req.user.id));
});
admin.get("/categories", async (req, res) =>
  respondPage(
    req,
    res,
    await paginated(
      "categories",
      "",
      [],
      req.query,
      async (c) => categoryResource(c),
      undefined,
      "sort_order,id",
    ),
  ),
);
admin.post("/categories", async (req, res) => data(req, res, await saveCategory(req.body), 201));
admin.patch("/categories/:id", async (req, res) =>
  data(req, res, await saveCategory(req.body, req.params.id)),
);
admin.get("/products", async (req, res) =>
  respondPage(req, res, await products(catalogQuery(req), true)),
);
admin.get("/products/:id", async (req, res) =>
  data(
    req,
    res,
    await productResource(must(await first("SELECT * FROM products WHERE id=?", [req.params.id]))),
  ),
);
admin.post("/products", async (req, res) =>
  data(req, res, await saveProduct(req.body, null, req.user.id), 201),
);
admin.patch("/products/:id", async (req, res) =>
  data(req, res, await saveProduct(req.body, req.params.id, req.user.id)),
);
admin.delete("/products/:id", async (req, res) => {
  const b = validate(z.strictObject({ version: int(1) }), req.body);
  await transaction(async (db) => {
    const p = must(
      await first("SELECT * FROM products WHERE id=? FOR UPDATE", [req.params.id], db),
    );
    if (!p.is_active) return;
    if (p.catalog_version !== b.version) fail("VERSION_CONFLICT", "Sản phẩm đã thay đổi.");
    await update("products", p.id, { is_active: 0, catalog_version: p.catalog_version + 1 }, db);
  });
  res.status(204).end();
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 2, parts: 3 },
});
admin.post("/products/:id/images", upload.single("image"), async (req, res) =>
  data(req, res, await uploadImage(req.params.id, req.file, req.body), 201),
);
admin.delete("/products/:id/images/:imageId", async (req, res) => {
  await deleteImage(req.params.id, req.params.imageId);
  res.status(204).end();
});
app.use((req, res) =>
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Không tìm thấy đường dẫn.", fields: {} },
    meta: meta(req),
  }),
);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  let status = error.status || 500,
    code = error.code || "INTERNAL_ERROR",
    message = error.message,
    fields = error.fields || {};
  if (error.code === "ER_DUP_ENTRY") {
    status = 422;
    code = "VALIDATION_ERROR";
    message = "Email, số điện thoại, SKU hoặc slug đã được sử dụng.";
  }
  if (error.code === "ER_NO_REFERENCED_ROW_2") {
    status = 422;
    code = "VALIDATION_ERROR";
    message = "Dữ liệu liên quan không tồn tại.";
  }
  if (error instanceof multer.MulterError) {
    status = 422;
    code = "VALIDATION_ERROR";
    message = "Tệp tải lên vượt giới hạn hoặc không hợp lệ.";
  }
  if (status >= 500) {
    console.error("Request " + req.requestId + " failed: " + (error.code || error.name));
    message = "Dịch vụ tạm thời không khả dụng.";
    code = "SERVICE_UNAVAILABLE";
  }
  res.status(status).json({ error: { code, message, fields }, meta: meta(req) });
});
