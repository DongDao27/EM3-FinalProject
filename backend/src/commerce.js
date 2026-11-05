import { randomUUID } from "node:crypto";
import { ulid } from "ulid";
import { query, first, insert, update, transaction, json } from "./db.js";
import { must, fail, sha, iso, now, validate, z, str, phone, phoneSchema } from "./support.js";
import { productResource, movement } from "./catalog.js";
export async function lockedCart(userId, db) {
  must(await first("SELECT id FROM users WHERE id=? FOR UPDATE", [userId], db));
  await query(
    "INSERT IGNORE INTO carts(user_id,created_at,updated_at) VALUES(?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
    [userId],
    db,
  );
  return first("SELECT * FROM carts WHERE user_id=?", [userId], db);
}
export const cartLines = (cartId, db) =>
  query("SELECT * FROM cart_items WHERE cart_id=? ORDER BY product_id,id", [cartId], db);
export const fingerprint = (lines) => sha(lines.map((i) => [i.id, i.product_id, i.quantity]));
export async function cartResource(cart, db) {
  const items = [],
    warnings = [];
  for (const i of await cartLines(cart.id, db)) {
    const p = await productResource(
      must(await first("SELECT * FROM products WHERE id=?", [i.product_id], db)),
      db,
    );
    const available = p.is_active && p.category.is_active && p.available_quantity >= i.quantity;
    if (!available) warnings.push("Sản phẩm " + p.id + " hiện không đủ hàng hoặc ngừng bán.");
    items.push({
      id: i.id,
      product: p,
      quantity: i.quantity,
      line_total: p.unit_price * i.quantity,
      is_available: available,
    });
  }
  return {
    id: cart.id,
    items,
    estimated_total: items.reduce((s, i) => s + i.line_total, 0),
    warnings,
  };
}
export const getCart = (userId) =>
  transaction(async (db) => cartResource(await lockedCart(userId, db), db));
export async function mutateCart(userId, operation, input) {
  return transaction(async (db) => {
    const cart = await lockedCart(userId, db);
    const existing =
      operation === "add"
        ? await first(
            "SELECT * FROM cart_items WHERE cart_id=? AND product_id=?",
            [cart.id, input.product_id],
            db,
          )
        : must(
            await first(
              "SELECT * FROM cart_items WHERE cart_id=? AND id=?",
              [cart.id, input.id],
              db,
            ),
          );
    if (operation === "delete") {
      await query("DELETE FROM cart_items WHERE id=?", [existing.id], db);
      return;
    }
    const p = must(
      await first(
        "SELECT p.*,c.is_active category_active FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=?",
        [existing?.product_id || input.product_id],
        db,
      ),
    );
    const qty = operation === "add" ? (existing?.quantity || 0) + input.quantity : input.quantity;
    if (qty > 99) fail("QUANTITY_LIMIT", "Số lượng tối đa 99.");
    if (!p.is_active || !p.category_active) fail("PRODUCT_UNAVAILABLE", "Sản phẩm ngừng bán.");
    if (qty > p.stock_on_hand - p.stock_reserved)
      fail("INSUFFICIENT_STOCK", "Sản phẩm không đủ hàng.");
    await query(
      "INSERT INTO cart_items(cart_id,product_id,quantity,created_at,updated_at) VALUES(?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity),updated_at=UTC_TIMESTAMP()",
      [cart.id, p.id, qty],
      db,
    );
    return cartResource(cart, db);
  });
}
const address = z.strictObject({ address_line: str(255), locality: str(120), province: str(120) });
const quoteSchema = z.strictObject({
  fulfillment_method: z.enum(["pickup", "delivery"]),
  recipient_name: str(120),
  recipient_phone: phoneSchema,
  address: address.nullable().optional(),
});
export async function snapshot(cart, input, db, lock = false) {
  const lines = await cartLines(cart.id, db);
  if (!lines.length) fail("EMPTY_CART", "Giỏ hàng trống.");
  const products = await query(
    `SELECT * FROM products WHERE id IN (?) ORDER BY id ${lock ? "FOR UPDATE" : ""}`,
    [lines.map((i) => i.product_id)],
    db,
  );
  const items = [];
  let subtotal = 0,
    discount = 0;
  for (const i of lines) {
    const p = must(products.find((p) => p.id === i.product_id)),
      category = await first("SELECT * FROM categories WHERE id=?", [p.category_id], db);
    if (!p.is_active || !category.is_active) fail("PRODUCT_UNAVAILABLE", "Sản phẩm ngừng bán.");
    if (p.stock_on_hand - p.stock_reserved < i.quantity)
      fail("INSUFFICIENT_STOCK", "Sản phẩm không đủ hàng.");
    const unit = p.sale_price ?? p.list_price,
      lineDiscount = (p.list_price - unit) * i.quantity;
    items.push({
      product_id: p.id,
      cart_item_id: i.id,
      catalog_version: p.catalog_version,
      sku: p.sku,
      name: p.name,
      list_unit_price: p.list_price,
      charged_unit_price: unit,
      quantity: i.quantity,
      line_total: unit * i.quantity,
      discount_line_total: lineDiscount,
    });
    subtotal += p.list_price * i.quantity;
    discount += lineDiscount;
  }
  const shipping = input.fulfillment_method === "pickup" ? 0 : 25000,
    total = subtotal - discount + shipping;
  if (total > 1000000000) fail("ORDER_TOTAL_LIMIT", "Đơn hàng vượt giới hạn.");
  return {
    fulfillment_method: input.fulfillment_method,
    recipient_name: input.recipient_name,
    recipient_phone: input.recipient_phone,
    address: input.address ?? null,
    items,
    totals: {
      items_subtotal: subtotal,
      discount_total: discount,
      shipping_fee: shipping,
      payable_total: total,
    },
  };
}
export const pricingVersion = (payload) =>
  Math.max(1, parseInt(sha([payload.items, payload.totals]).slice(0, 12), 16));
export async function createQuote(userId, input) {
  input = validate(quoteSchema, { ...input, recipient_phone: phone(input.recipient_phone) });
  if (input.fulfillment_method === "delivery" && !input.address)
    fail("VALIDATION_ERROR", "Cần địa chỉ giao hàng.", 422);
  if (input.fulfillment_method === "pickup" && input.address)
    fail("VALIDATION_ERROR", "Nhận tại cửa hàng không cần địa chỉ.", 422);
  return transaction(async (db) => {
    const cart = await lockedCart(userId, db),
      payload = await snapshot(cart, input, db),
      id = randomUUID(),
      expires = new Date(Date.now() + 300000),
      version = pricingVersion(payload),
      fp = fingerprint(await cartLines(cart.id, db));
    await insert(
      "quotes",
      {
        id,
        user_id: userId,
        cart_id: cart.id,
        cart_fingerprint: fp,
        payload: JSON.stringify(payload),
        ...payload.totals,
        pricing_version: version,
        expires_at: expires,
        created_at: now(),
        updated_at: now(),
      },
      db,
    );
    return {
      id,
      expires_at: iso(expires),
      cart_fingerprint: fp,
      pricing_version: version,
      items: payload.items,
      totals: payload.totals,
    };
  });
}
export const orderItems = (id, db) =>
  query("SELECT * FROM order_items WHERE order_id=? ORDER BY product_id,id", [id], db);
export async function orderResource(o, db) {
  return {
    order_code: o.order_code,
    fulfillment_method: o.fulfillment_method,
    recipient_name: o.recipient_name,
    recipient_phone: o.recipient_phone,
    address: json(o.address),
    lifecycle: o.lifecycle,
    payment_status: o.payment_status,
    fulfillment_status: o.fulfillment_status,
    expires_at: iso(o.expires_at),
    paid_at: iso(o.paid_at),
    items: (await orderItems(o.id, db)).map((i) => ({
      product_id: i.product_id,
      sku: i.sku,
      name: i.name,
      list_unit_price: i.list_unit_price,
      charged_unit_price: i.charged_unit_price,
      quantity: i.quantity,
      line_total: i.line_total,
    })),
    totals: {
      items_subtotal: o.items_subtotal,
      discount_total: o.discount_total,
      shipping_fee: o.shipping_fee,
      payable_total: o.payable_total,
    },
    version: o.version,
  };
}
export async function findOrder(code, user, db, lock = false) {
  return must(
    await first(
      `SELECT * FROM orders WHERE order_code=? ${user.role === "admin" ? "" : "AND user_id=?"} ${lock ? "FOR UPDATE" : ""}`,
      user.role === "admin" ? [code] : [code, user.id],
      db,
    ),
  );
}
export async function history(
  db,
  id,
  event,
  before = {},
  after = {},
  actorId = null,
  reason = null,
) {
  await insert(
    "order_status_histories",
    {
      order_id: id,
      actor_id: actorId,
      event,
      before: JSON.stringify(before),
      after: JSON.stringify(after),
      reason,
      created_at: now(),
    },
    db,
  );
}
export async function changeStock(db, order, kind) {
  const lines = await orderItems(order.id, db);
  for (const i of lines) {
    const p = must(await first("SELECT * FROM products WHERE id=? FOR UPDATE", [i.product_id], db));
    if (kind === "reserve") {
      if (p.stock_on_hand - p.stock_reserved < i.quantity)
        fail("INSUFFICIENT_STOCK", "Không đủ tồn khả dụng.");
      p.stock_reserved += i.quantity;
      await insert(
        "stock_reservations",
        {
          order_item_id: i.id,
          product_id: p.id,
          quantity: i.quantity,
          status: "active",
          expires_at: order.expires_at,
          created_at: now(),
          updated_at: now(),
        },
        db,
      );
    } else {
      const reservation = await first(
        "SELECT * FROM stock_reservations WHERE order_item_id=? FOR UPDATE",
        [i.id],
        db,
      );
      if (!reservation || reservation.status !== "active") continue;
      p.stock_reserved -= i.quantity;
      if (kind === "consume") p.stock_on_hand -= i.quantity;
      await update(
        "stock_reservations",
        reservation.id,
        {
          status: kind === "consume" ? "consumed" : "released",
          released_at: kind === "release" ? now() : null,
        },
        db,
      );
    }
    if (p.stock_reserved < 0 || p.stock_reserved > p.stock_on_hand)
      fail("INVENTORY_INVARIANT", "Sổ tồn không hợp lệ.");
    await update(
      "products",
      p.id,
      { stock_on_hand: p.stock_on_hand, stock_reserved: p.stock_reserved },
      db,
    );
    await movement(
      db,
      p,
      kind,
      kind === "consume" ? -i.quantity : 0,
      kind === "reserve" ? i.quantity : -i.quantity,
      "Order " + kind,
      null,
      `order:${order.id}:${kind}:${p.id}`,
      order.id,
    );
  }
}
export async function checkout(userId, quoteId, key) {
  return transaction(async (db) => {
    const cart = await lockedCart(userId, db),
      hash = sha(quoteId);
    const prior = await first(
      "SELECT * FROM idempotency_keys WHERE user_id=? AND operation=? AND `key`=? FOR UPDATE",
      [userId, "checkout", key],
      db,
    );
    if (prior) {
      if (prior.request_hash !== hash)
        fail("IDEMPOTENCY_CONFLICT", "Khóa yêu cầu đã được sử dụng.");
      return { order: json(prior.cached_response), replayed: true };
    }
    const quote = must(
      await first(
        "SELECT * FROM quotes WHERE id=? AND user_id=? FOR UPDATE",
        [quoteId, userId],
        db,
      ),
    );
    if (quote.consumed_at) fail("QUOTE_CONSUMED", "Báo giá đã sử dụng.");
    if (now() >= quote.expires_at) fail("QUOTE_EXPIRED", "Báo giá hết hạn.");
    if (
      quote.cart_id !== cart.id ||
      quote.cart_fingerprint !== fingerprint(await cartLines(cart.id, db))
    )
      fail("CART_CHANGED", "Giỏ hàng đã thay đổi.");
    const payload = json(quote.payload),
      current = await snapshot(cart, payload, db, true);
    // Compare semantic snapshots; JSON column key ordering is determined by MySQL.
    if (Number(quote.pricing_version) !== pricingVersion(current))
      fail("PRICE_CHANGED", "Giá hoặc tồn đã thay đổi, vui lòng lấy báo giá mới.");
    const id = await insert(
      "orders",
      {
        order_code: ulid(),
        user_id: userId,
        quote_id: quoteId,
        fulfillment_method: payload.fulfillment_method,
        recipient_name: payload.recipient_name,
        recipient_phone: payload.recipient_phone,
        address: payload.address ? JSON.stringify(payload.address) : null,
        ...payload.totals,
        lifecycle: "open",
        payment_status: "unpaid",
        fulfillment_status: "unprocessed",
        expires_at: new Date(
          Date.now() + (payload.fulfillment_method === "pickup" ? 86400000 : 300000),
        ),
        version: 1,
        created_at: now(),
        updated_at: now(),
      },
      db,
    );
    for (const line of payload.items) {
      const { catalog_version, cart_item_id, ...fields } = line;
      await insert(
        "order_items",
        { order_id: id, ...fields, created_at: now(), updated_at: now() },
        db,
      );
    }
    const order = await first("SELECT * FROM orders WHERE id=?", [id], db);
    await changeStock(db, order, "reserve");
    await update("quotes", quoteId, { consumed_at: now() }, db);
    await query(
      "DELETE FROM cart_items WHERE cart_id=? AND id IN (?)",
      [cart.id, payload.items.map((i) => i.cart_item_id)],
      db,
    );
    await history(db, id, "created", {}, { lifecycle: "open", payment_status: "unpaid" }, userId);
    const resource = await orderResource(order, db);
    await insert(
      "idempotency_keys",
      {
        user_id: userId,
        operation: "checkout",
        key,
        request_hash: hash,
        status: "succeeded",
        order_id: id,
        cached_response: JSON.stringify(resource),
        created_at: now(),
        updated_at: now(),
      },
      db,
    );
    return { order: resource, replayed: false };
  });
}
export async function restoreCartOnce(db, order, cart, actorId) {
  if (
    !cart ||
    order.payment_status !== "unpaid" ||
    !["cancelled", "expired"].includes(order.lifecycle) ||
    (await first(
      "SELECT id FROM order_status_histories WHERE order_id=? AND event='cart_restored'",
      [order.id],
      db,
    ))
  )
    return;
  for (const i of await orderItems(order.id, db))
    await query(
      "INSERT INTO cart_items(cart_id,product_id,quantity,created_at,updated_at) VALUES(?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE quantity=LEAST(99,quantity+VALUES(quantity)),updated_at=UTC_TIMESTAMP()",
      [cart.id, i.product_id, i.quantity],
      db,
    );
  await history(
    db,
    order.id,
    "cart_restored",
    {},
    { cart_id: cart.id },
    actorId,
    "Current prices and stock apply at next checkout.",
  );
}
export async function fulfill(order, target, version, actorId) {
  return transaction(async (db) => {
    const o = await first("SELECT * FROM orders WHERE id=? FOR UPDATE", [order.id], db);
    if (o.version !== version) fail("VERSION_CONFLICT", "Đơn đã thay đổi.");
    const next =
      o.fulfillment_method === "pickup"
        ? { unprocessed: "preparing", preparing: "ready_for_pickup", ready_for_pickup: "fulfilled" }
        : { unprocessed: "preparing", preparing: "shipping", shipping: "fulfilled" };
    if (o.lifecycle !== "open" || next[o.fulfillment_status] !== target)
      fail("INVALID_FULFILLMENT_TRANSITION", "Chuyển trạng thái không hợp lệ.");
    if (
      (o.fulfillment_method === "delivery" || target === "fulfilled") &&
      o.payment_status !== "paid"
    )
      fail("PAYMENT_REQUIRED", "Cần thanh toán được xác minh.");
    if (o.payment_status !== "paid" && now() >= o.expires_at)
      fail("ORDER_EXPIRED", "Đơn chưa trả tiền đã hết hạn.");
    await update(
      "orders",
      o.id,
      {
        fulfillment_status: target,
        lifecycle: target === "fulfilled" ? "completed" : "open",
        completed_at: target === "fulfilled" ? now() : null,
        version: o.version + 1,
      },
      db,
    );
    await history(
      db,
      o.id,
      "fulfillment",
      { fulfillment_status: o.fulfillment_status },
      { fulfillment_status: target },
      actorId,
    );
    return orderResource(await first("SELECT * FROM orders WHERE id=?", [o.id], db), db);
  });
}
