import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { config } from "./config.js";
import { query, first, insert, update, transaction, json } from "./db.js";
import { fail, must, now, iso, pageInfo, validate, z, str, int } from "./support.js";
import { movement, inventoryResource, categoryResource } from "./catalog.js";
import { orderResource } from "./commerce.js";
export async function paginated(
  table,
  where,
  params,
  q,
  transform,
  db,
  order = "created_at DESC,id DESC",
) {
  const total = (await first(`SELECT COUNT(*) n FROM ${table} ${where}`, params, db)).n,
    pagination = pageInfo(q, total);
  const rows = await query(
    `SELECT * FROM ${table} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...params, pagination.per_page, (pagination.page - 1) * pagination.per_page],
    db,
  );
  return { items: await Promise.all(rows.map((r) => transform(r))), pagination };
}
export async function listOrders(user, q) {
  const where = [],
    params = [];
  if (user.role !== "admin") {
    where.push("user_id=?");
    params.push(user.id);
  }
  for (const k of ["fulfillment_method", "payment_status", "fulfillment_status"])
    if (q[k]) {
      where.push(k + "=?");
      params.push(q[k]);
    }
  if (q.q) {
    where.push(
      "(LOCATE(?,order_code)>0 OR LOCATE(?,recipient_name)>0 OR LOCATE(?,recipient_phone)>0)",
    );
    params.push(q.q, q.q, q.q);
  }
  for (const [field, op] of [
    ["from", ">="],
    ["to", "<"],
  ])
    if (q[field]) {
      where.push("created_at" + op + "?");
      params.push(vietnamStart(q[field]));
    }
  return paginated(
    "orders",
    where.length ? "WHERE " + where.join(" AND ") : "",
    params,
    q,
    orderResource,
  );
}
export async function adjustInventory(productId, b, actorId) {
  return transaction(async (db) => {
    const p = must(await first("SELECT * FROM products WHERE id=? FOR UPDATE", [productId], db)),
      businessKey = `adjust:${actorId}:${p.id}:${b.request_key}`;
    const prior = await first(
      "SELECT * FROM inventory_movements WHERE business_key=?",
      [businessKey],
      db,
    );
    if (prior) {
      if (prior.delta_on_hand !== b.delta || prior.reason !== b.reason)
        fail("IDEMPOTENCY_CONFLICT", "Khóa yêu cầu đã dùng với nội dung khác.");
      return inventoryResource(p);
    }
    const next = p.stock_on_hand + b.delta;
    if (next < p.stock_reserved || next > 2147483647 || !b.delta)
      fail("INVALID_STOCK_ADJUSTMENT", "Tồn mới phải đủ số đang giữ.");
    p.stock_on_hand = next;
    await update("products", p.id, { stock_on_hand: next }, db);
    await movement(db, p, "adjustment", b.delta, 0, b.reason, actorId, businessKey);
    return inventoryResource(p);
  });
}
export async function saveCategory(input, id) {
  const schema = z.strictObject({
    name: str(120),
    slug: z
      .string()
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    sort_order: int(0, 1000000).optional(),
    is_active: z.boolean().optional(),
  });
  const b = validate(id ? schema.partial() : schema, input);
  if (id) {
    must(await first("SELECT id FROM categories WHERE id=?", [id]));
    if (Object.keys(b).length) await update("categories", id, b);
  } else
    id = await insert("categories", {
      ...b,
      sort_order: b.sort_order ?? 0,
      is_active: b.is_active ?? true,
      created_at: now(),
      updated_at: now(),
    });
  return categoryResource(await first("SELECT * FROM categories WHERE id=?", [id]));
}
export async function uploadImage(productId, file, input) {
  must(file, "VALIDATION_ERROR", "Cần chọn ảnh.", 422);
  const body = validate(
    z.strictObject({
      alt_text: z.string().max(255).optional(),
      sort_order: z.coerce.number().int().min(0).max(1000).optional(),
    }),
    input,
  );
  const image = sharp(file.buffer, { limitInputPixels: 40000000, failOn: "error" });
  let metadata;
  try {
    metadata = await image.metadata();
  } catch {
    fail("VALIDATION_ERROR", "Tệp không phải ảnh hợp lệ.", 422);
  }
  if (!["jpeg", "png", "webp"].includes(metadata.format))
    fail("VALIDATION_ERROR", "Chỉ hỗ trợ JPEG, PNG hoặc WebP.", 422);
  const relative = "products/" + randomUUID() + ".webp",
    absolute = path.join(config.storageRoot, "public", relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  const output = await image.rotate().webp({ quality: 90 }).toFile(absolute);
  try {
    return await transaction(async (db) => {
      must(await first("SELECT id FROM products WHERE id=? FOR UPDATE", [productId], db));
      const id = await insert(
        "product_images",
        {
          product_id: productId,
          storage_disk: "public",
          path: relative,
          mime: "image/webp",
          byte_size: output.size,
          sort_order: body.sort_order ?? 0,
          alt_text: body.alt_text ?? null,
          created_at: now(),
          updated_at: now(),
        },
        db,
      );
      return {
        id,
        url: "/storage/" + relative,
        alt_text: body.alt_text ?? null,
        sort_order: body.sort_order ?? 0,
      };
    });
  } catch (error) {
    await fs.unlink(absolute).catch(() => {});
    throw error;
  }
}
export async function deleteImage(productId, imageId) {
  const relative = await transaction(async (db) => {
    must(await first("SELECT id FROM products WHERE id=? FOR UPDATE", [productId], db));
    const i = must(
      await first(
        "SELECT * FROM product_images WHERE id=? AND product_id=?",
        [imageId, productId],
        db,
      ),
    );
    await query("DELETE FROM product_images WHERE id=?", [i.id], db);
    return i.path;
  });
  const base = path.resolve(config.storageRoot, "public"),
    target = path.resolve(base, relative);
  if (target.startsWith(base + path.sep)) await fs.unlink(target).catch(() => {});
}
export async function orderHistory(order, q) {
  const type = q.type || "attempts",
    table = {
      attempts: "payment_attempts",
      receipts: "payment_receipts",
      statuses: "order_status_histories",
    }[type];
  if (!table) fail("VALIDATION_ERROR", "Loại lịch sử không hợp lệ.", 422);
  return paginated(table, "WHERE order_id=?", [order.id], q, async (r) => {
    const base = { id: String(r.id), created_at: iso(r.created_at) };
    if (type === "attempts")
      return {
        ...base,
        type: "attempt",
        status: r.status,
        provider: r.provider,
        amount: r.requested_amount,
        verified_at: iso(r.verified_at),
        expires_at: iso(r.expires_at),
      };
    if (type === "receipts")
      return {
        ...base,
        type: "receipt",
        status: r.allocation,
        provider: r.provider,
        amount: r.received_amount,
        verified_at: iso(r.verified_at),
        transaction_id: r.provider_transaction_id,
        paid_at: iso(r.provider_paid_at),
      };
    const select = (v) =>
      Object.fromEntries(
        Object.entries(json(v) || {}).filter(([k]) =>
          ["lifecycle", "payment_status", "fulfillment_status"].includes(k),
        ),
      );
    return {
      ...base,
      type: "status",
      event: r.event,
      reason: r.reason,
      before: select(r.before),
      after: select(r.after),
    };
  });
}
export async function caseResource(c, db) {
  return {
    id: c.id,
    order_code: (await first("SELECT order_code FROM orders WHERE id=?", [c.order_id], db))
      .order_code,
    reason: c.reason,
    status: c.status,
    note: c.note,
    version: c.version,
  };
}
export async function resolveCase(id, input, actorId) {
  const b = validate(
    z.strictObject({
      resolution: z.enum([
        "manual_review",
        "verified_unpaid",
        "refund_verified",
        "duplicate_refund_verified",
      ]),
      note: z.string().min(5).max(2000),
      evidence_reference: z.string().max(255).nullish(),
      version: int(1),
    }),
    input,
  );
  const candidate = must(await first("SELECT * FROM reconciliation_cases WHERE id=?", [id]));
  return transaction(async (db) => {
    const order = await first(
        "SELECT * FROM orders WHERE id=? FOR UPDATE",
        [candidate.order_id],
        db,
      ),
      c = await first("SELECT * FROM reconciliation_cases WHERE id=? FOR UPDATE", [id], db);
    if (c.version !== b.version || c.status !== "open")
      fail("VERSION_CONFLICT", "Hồ sơ đã thay đổi hoặc đã đóng.");
    if (b.resolution === "manual_review") {
      await update("reconciliation_cases", id, { note: b.note, version: c.version + 1 }, db);
      return caseResource(
        await first("SELECT * FROM reconciliation_cases WHERE id=?", [id], db),
        db,
      );
    }
    if (!b.evidence_reference) fail("EVIDENCE_REQUIRED", "Cần dẫn chiếu bằng chứng.", 422);
    if (b.resolution === "verified_unpaid") {
      if (
        order.payment_status === "paid" ||
        (await first("SELECT id FROM payment_receipts WHERE order_id=? LIMIT 1", [order.id], db))
      )
        fail("PAYMENT_EVIDENCE_CONFLICT", "Đơn có chứng từ tiền.");
      for (const a of await query(
        "SELECT * FROM payment_attempts WHERE order_id=?",
        [order.id],
        db,
      ))
        if (
          !["failed", "cancelled", "expired"].includes(a.status) ||
          !(await first(
            "SELECT id FROM payment_events WHERE provider_reference=? AND source='query' AND signature_valid=1 AND disposition='failed' LIMIT 1",
            [a.provider_reference],
            db,
          ))
        )
          fail(
            "PAYMENT_NOT_VERIFIED_UNPAID",
            "Cần truy vấn provider xác minh thất bại cho mọi lần thử.",
          );
    } else {
      const receipt = c.receipt_id
        ? await first("SELECT * FROM payment_receipts WHERE id=?", [c.receipt_id], db)
        : null;
      const refunded = receipt
        ? (
            await first(
              "SELECT COALESCE(SUM(amount),0) n FROM refunds WHERE receipt_id=?",
              [receipt.id],
              db,
            )
          ).n
        : 0;
      if (!receipt || refunded < receipt.received_amount)
        fail("REFUND_EVIDENCE_REQUIRED", "Chứng từ hoàn tiền chưa đủ.");
    }
    await update(
      "reconciliation_cases",
      id,
      {
        status: "resolved",
        resolution: b.resolution,
        note: b.note + " Evidence: " + b.evidence_reference,
        resolved_by: actorId,
        resolved_at: now(),
        version: c.version + 1,
      },
      db,
    );
    if (
      b.resolution === "verified_unpaid" &&
      !(await first(
        "SELECT id FROM reconciliation_cases WHERE order_id=? AND status='open' LIMIT 1",
        [order.id],
        db,
      ))
    )
      await update(
        "orders",
        order.id,
        { payment_status: "unpaid", version: order.version + 1 },
        db,
      );
    return caseResource(await first("SELECT * FROM reconciliation_cases WHERE id=?", [id], db), db);
  });
}
export function vietnamStart(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail("VALIDATION_ERROR", "Ngày không hợp lệ.", 422);
  const d = new Date(day + "T00:00:00+07:00");
  if (
    !Number.isFinite(d.getTime()) ||
    new Date(d.getTime() + 25200000).toISOString().slice(0, 10) !== day
  )
    fail("VALIDATION_ERROR", "Ngày không hợp lệ.", 422);
  return d;
}
const vnDay = (d) => new Date(new Date(d).getTime() + 25200000).toISOString().slice(0, 10);
export async function dashboard() {
  const today = vnDay(now()),
    start = vietnamStart(today);
  start.setUTCDate(start.getUTCDate() - 6);
  const end = vietnamStart(today);
  end.setUTCDate(end.getUTCDate() + 1);
  const daily = await query(
    'SELECT DATE_FORMAT(DATE_ADD(created_at,INTERVAL 7 HOUR),"%Y-%m-%d") day,COUNT(*) n FROM orders WHERE created_at>=? AND created_at<? GROUP BY day',
    [start, end],
  );
  return {
    timezone: "Asia/Ho_Chi_Minh",
    counts: {
      active_products: (
        await first(
          "SELECT COUNT(*) n FROM products p JOIN categories c ON c.id=p.category_id WHERE p.is_active=1 AND c.is_active=1",
        )
      ).n,
      active_categories: (await first("SELECT COUNT(*) n FROM categories WHERE is_active=1")).n,
      orders_today: Number(daily.find((r) => r.day === today)?.n || 0),
      awaiting_processing: (
        await first(
          "SELECT COUNT(*) n FROM orders WHERE lifecycle='open' AND fulfillment_status='unprocessed'",
        )
      ).n,
    },
    daily_orders: Array.from({ length: 7 }, (_, i) => {
      const date = vnDay(new Date(start.getTime() + i * 86400000));
      return { date, count: Number(daily.find((r) => r.day === date)?.n || 0) };
    }),
    recent_orders: await Promise.all(
      (await query("SELECT * FROM orders ORDER BY created_at DESC,id DESC LIMIT 5")).map((o) =>
        orderResource(o),
      ),
    ),
  };
}
export async function revenue(q) {
  const b = validate(
      z.strictObject({
        from: z.string(),
        to: z.string(),
        granularity: z.enum(["day", "week", "month"]).default("day"),
      }),
      q,
    ),
    start = vietnamStart(b.from),
    end = vietnamStart(b.to),
    days = (end - start) / 86400000;
  if (days < 1 || days > 366) fail("VALIDATION_ERROR", "Khoảng báo cáo từ 1 đến 366 ngày.", 422);
  const zero = () => ({
      accepted_sales: 0,
      merchandise_refunds: 0,
      net_sales: 0,
      shipping_collected: 0,
      shipping_refunds: 0,
      unallocated_receipts: 0,
      unallocated_refunds: 0,
    }),
    daily = new Map();
  for (let i = 0; i < days; i++) daily.set(vnDay(new Date(start.getTime() + i * 86400000)), zero());
  for (const r of await query(
    "SELECT DATE_FORMAT(DATE_ADD(o.paid_at,INTERVAL 7 HOUR),'%Y-%m-%d') day,SUM(o.items_subtotal-o.discount_total) accepted_sales,SUM(o.shipping_fee) shipping_collected FROM orders o JOIN payment_receipts r ON r.order_id=o.id AND r.allocation='accepted' WHERE o.payment_status='paid' AND o.paid_at>=? AND o.paid_at<? GROUP BY day",
    [start, end],
  ))
    Object.assign(daily.get(r.day), {
      accepted_sales: Number(r.accepted_sales),
      shipping_collected: Number(r.shipping_collected),
    });
  for (const r of await query(
    "SELECT DATE_FORMAT(DATE_ADD(verified_at,INTERVAL 7 HOUR),'%Y-%m-%d') day,SUM(received_amount) amount FROM payment_receipts WHERE allocation<>'accepted' AND verified_at>=? AND verified_at<? GROUP BY day",
    [start, end],
  ))
    daily.get(r.day).unallocated_receipts = Number(r.amount);
  for (const r of await query(
    "SELECT f.*,r.allocation FROM refunds f JOIN payment_receipts r ON r.id=f.receipt_id WHERE f.refunded_at>=? AND f.refunded_at<?",
    [start, end],
  )) {
    const row = daily.get(vnDay(r.refunded_at));
    if (r.allocation === "accepted") {
      row.merchandise_refunds += r.merchandise_amount;
      row.shipping_refunds += r.shipping_amount;
    } else row.unallocated_refunds += r.amount;
  }
  const grouped = new Map(),
    totals = zero();
  for (const [day, row] of daily) {
    row.net_sales = row.accepted_sales - row.merchandise_refunds;
    let period = day;
    if (b.granularity === "month") period = day.slice(0, 7) + "-01";
    if (b.granularity === "week") {
      const d = new Date(day + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      period = d.toISOString().slice(0, 10);
    }
    if (!grouped.has(period)) grouped.set(period, zero());
    for (const k of Object.keys(totals)) {
      totals[k] += row[k];
      grouped.get(period)[k] += row[k];
    }
  }
  return {
    from: b.from,
    to: b.to,
    timezone: "Asia/Ho_Chi_Minh",
    totals,
    series: [...grouped].map(([period, row]) => ({ period, ...row })),
  };
}
