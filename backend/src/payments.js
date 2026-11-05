import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { gateway } from "./vnpay.js";
import { query, first, insert, update, transaction, json } from "./db.js";
import { must, fail, sha, iso, now } from "./support.js";
import {
  changeStock,
  orderItems,
  orderResource,
  lockedCart,
  restoreCartOnce,
  history,
} from "./commerce.js";
const active = ["created", "pending", "unknown"];
export async function createAttempt(order, actorId, key, qr = false) {
  if (config.vnpay.deferred)
    fail("PAYMENT_INTEGRATION_DEFERRED", "Chưa bật yêu cầu thanh toán VNPAY.", 503);
  gateway.assertAvailable(qr);
  return transaction(async (db) => {
    const o = await first("SELECT * FROM orders WHERE id=? FOR UPDATE", [order.id], db);
    if (o.lifecycle !== "open" || o.payment_status === "paid" || now() >= o.expires_at)
      fail("ORDER_NOT_PAYABLE", "Đơn đã thanh toán, đóng hoặc hết hạn.");
    if (qr && o.fulfillment_method !== "pickup")
      fail("PAYMENT_CHANNEL_INVALID", "Thu tại quầy chỉ dành cho đơn nhận tại cửa hàng.");
    const operation = "payment:" + o.id;
    const prior = await first(
      "SELECT * FROM idempotency_keys WHERE user_id=? AND operation=? AND `key`=?",
      [actorId, operation, key],
      db,
    );
    if (prior)
      return first(
        "SELECT * FROM payment_attempts WHERE id=?",
        [json(prior.cached_response).attempt_id],
        db,
      );
    let a = await first(
      "SELECT * FROM payment_attempts WHERE order_id=? AND status IN (?) ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
      [o.id, active],
      db,
    );
    if (!a && o.payment_status === "reconciliation_required")
      fail("PAYMENT_RECONCILIATION_REQUIRED", "Cần đối soát trước khi trả lại.");
    if (!a) {
      const id = randomUUID();
      await insert(
        "payment_attempts",
        {
          id,
          order_id: o.id,
          provider: "vnpay",
          provider_reference: randomUUID().replaceAll("-", ""),
          requested_amount: o.payable_total,
          status: "pending",
          expires_at: o.expires_at,
          created_at: now(),
          updated_at: now(),
        },
        db,
      );
      await update("orders", o.id, { payment_status: "pending", version: o.version + 1 }, db);
      a = await first("SELECT * FROM payment_attempts WHERE id=?", [id], db);
    }
    if (
      qr &&
      !(await first(
        "SELECT id FROM order_status_histories WHERE order_id=? AND event='counter_payment_requested' AND JSON_UNQUOTE(JSON_EXTRACT(`after`,'$.attempt_id'))=?",
        [o.id, a.id],
        db,
      ))
    )
      await history(
        db,
        o.id,
        "counter_payment_requested",
        { payment_status: o.payment_status },
        { attempt_id: a.id },
        actorId,
      );
    await insert(
      "idempotency_keys",
      {
        user_id: actorId,
        operation,
        key,
        request_hash: sha(o.order_code),
        status: "succeeded",
        order_id: o.id,
        cached_response: JSON.stringify({ attempt_id: a.id }),
        created_at: now(),
        updated_at: now(),
      },
      db,
    );
    return a;
  });
}
export const presentAttempt = (a, o, ip, counter = false) => ({
  id: a.id,
  order_code: o.order_code,
  status: a.status,
  expires_at: iso(a.expires_at),
  payment_url:
    ["created", "pending"].includes(a.status) && now() < a.expires_at
      ? gateway.paymentUrl(a, ip)
      : null,
  qr_content:
    counter && ["created", "pending"].includes(a.status) && now() < a.expires_at
      ? "/api/v1/payments/vnpay/checkout/" + a.provider_reference
      : null,
  qr_kind: counter ? "checkout_url" : null,
  provider: "vnpay",
});
export async function counterCheckoutUrl(reference, ip) {
  if (config.vnpay.deferred) fail("PAYMENT_INTEGRATION_DEFERRED", "Chưa bật VNPAY.", 503);
  const a = must(
    await first("SELECT * FROM payment_attempts WHERE provider='vnpay' AND provider_reference=?", [
      reference,
    ]),
  );
  const o = must(await first("SELECT * FROM orders WHERE id=?", [a.order_id]));
  must(
    o.fulfillment_method === "pickup" &&
      (await first(
        "SELECT id FROM order_status_histories WHERE order_id=? AND event='counter_payment_requested' AND JSON_UNQUOTE(JSON_EXTRACT(`after`,'$.attempt_id'))=?",
        [o.id, a.id],
      )),
    "NOT_FOUND",
    "Không tìm thấy liên kết.",
    404,
  );
  if (
    o.lifecycle !== "open" ||
    o.payment_status !== "pending" ||
    !["created", "pending"].includes(a.status) ||
    now() >= o.expires_at ||
    now() >= a.expires_at
  )
    fail("ORDER_NOT_PAYABLE", "Liên kết đã hết hiệu lực.");
  return gateway.paymentUrl(a, ip);
}
export async function collectCash(order, actorId) {
  return transaction(async (db) => {
    const o = must(await first("SELECT * FROM orders WHERE id=? FOR UPDATE", [order.id], db));
    if (
      o.payment_status === "paid" &&
      (await first(
        "SELECT id FROM payment_receipts WHERE order_id=? AND provider='cash' AND allocation='accepted'",
        [o.id],
        db,
      ))
    )
      return orderResource(o, db);
    if (o.fulfillment_method !== "pickup" || o.lifecycle !== "open" || now() >= o.expires_at)
      fail("ORDER_NOT_PAYABLE", "Chỉ thu tiền cho đơn nhận tại cửa hàng còn hiệu lực.");
    if (
      o.payment_status !== "unpaid" ||
      (await first(
        "SELECT id FROM payment_attempts WHERE order_id=? AND status IN (?) LIMIT 1",
        [o.id, active],
        db,
      )) ||
      (await first(
        "SELECT id FROM reconciliation_cases WHERE order_id=? AND status='open' LIMIT 1",
        [o.id],
        db,
      ))
    )
      fail("PAYMENT_RECONCILIATION_REQUIRED", "Cần xác minh giao dịch trước khi thu thêm tiền.");
    const lines = await orderItems(o.id, db);
    await query(
      "SELECT id FROM products WHERE id IN (?) ORDER BY id FOR UPDATE",
      [lines.map((i) => i.product_id)],
      db,
    );
    const reservations = await query(
      "SELECT r.* FROM stock_reservations r JOIN order_items i ON i.id=r.order_item_id WHERE i.order_id=? FOR UPDATE",
      [o.id],
      db,
    );
    if (
      !lines.length ||
      reservations.length !== lines.length ||
      lines.some(
        (i) =>
          !reservations.some(
            (r) =>
              r.order_item_id === i.id &&
              r.product_id === i.product_id &&
              r.quantity === i.quantity &&
              r.status === "active",
          ),
      )
    )
      fail("RESERVATION_MISSING", "Đơn không còn đủ tồn đang giữ.");
    const reference = "cash-" + randomUUID(),
      id = randomUUID(),
      receivedAt = now();
    await insert(
      "payment_attempts",
      {
        id,
        order_id: o.id,
        provider: "cash",
        provider_reference: reference,
        requested_amount: o.payable_total,
        status: "succeeded",
        expires_at: o.expires_at,
        provider_transaction_id: reference,
        verified_at: receivedAt,
        created_at: receivedAt,
        updated_at: receivedAt,
      },
      db,
    );
    await insert(
      "payment_receipts",
      {
        provider: "cash",
        provider_transaction_id: reference,
        order_id: o.id,
        attempt_id: id,
        received_amount: o.payable_total,
        provider_paid_at: receivedAt,
        verified_at: receivedAt,
        allocation: "accepted",
        created_at: receivedAt,
        updated_at: receivedAt,
      },
      db,
    );
    await changeStock(db, o, "consume");
    await update(
      "orders",
      o.id,
      {
        payment_status: "paid",
        paid_at: receivedAt,
        lifecycle: "completed",
        fulfillment_status: "fulfilled",
        completed_at: receivedAt,
        version: o.version + 1,
      },
      db,
    );
    await history(
      db,
      o.id,
      "cash_payment_completed",
      { payment_status: "unpaid" },
      { payment_status: "paid", lifecycle: "completed", amount: o.payable_total },
      actorId,
    );
    return orderResource(await first("SELECT * FROM orders WHERE id=?", [o.id], db), db);
  });
}
export async function paymentStatus(o) {
  const latest = await first(
    "SELECT status FROM payment_attempts WHERE order_id=? ORDER BY created_at DESC,id DESC LIMIT 1",
    [o.id],
  );
  const hasActive = await first(
    "SELECT id FROM payment_attempts WHERE order_id=? AND status IN (?) LIMIT 1",
    [o.id, active],
  );
  const caseOpen = await first(
    "SELECT id FROM reconciliation_cases WHERE order_id=? AND status='open' LIMIT 1",
    [o.id],
  );
  return {
    payment_status: o.payment_status,
    latest_attempt_status: latest?.status ?? null,
    expires_at: iso(o.expires_at),
    can_retry:
      o.lifecycle === "open" && o.payment_status === "unpaid" && !hasActive && now() < o.expires_at,
    reconciliation_required: o.payment_status === "reconciliation_required" || !!caseOpen,
  };
}
export async function openCase(db, o, receiptId, reason) {
  if (
    !(await first(
      "SELECT id FROM reconciliation_cases WHERE order_id=? AND receipt_id <=> ? AND reason=? AND status='open'",
      [o.id, receiptId, reason],
      db,
    ))
  )
    await insert(
      "reconciliation_cases",
      {
        order_id: o.id,
        receipt_id: receiptId,
        reason,
        status: "open",
        version: 1,
        created_at: now(),
        updated_at: now(),
      },
      db,
    );
  if (o.payment_status !== "paid") {
    await update(
      "orders",
      o.id,
      { payment_status: "reconciliation_required", version: o.version + 1 },
      db,
    );
    o.payment_status = "reconciliation_required";
    o.version++;
  }
}
export async function applyPayment(result, source) {
  if (source === "return" && result.state === "succeeded")
    fail("INVALID_EVIDENCE_SOURCE", "Return không thể xác nhận thanh toán.");
  const candidate = await first("SELECT * FROM payment_attempts WHERE provider_reference=?", [
    result.reference,
  ]);
  if (!candidate) return "01";
  try {
    return await transaction(async (db) => {
      const o = await first("SELECT * FROM orders WHERE id=? FOR UPDATE", [candidate.order_id], db),
        lines = await orderItems(o.id, db);
      await query(
        "SELECT id FROM products WHERE id IN (?) ORDER BY id FOR UPDATE",
        [lines.map((i) => i.product_id)],
        db,
      );
      const a = await first(
          "SELECT * FROM payment_attempts WHERE id=? FOR UPDATE",
          [candidate.id],
          db,
        ),
        fp = sha(source + ":" + result.fingerprint);
      const prior = await first("SELECT * FROM payment_events WHERE fingerprint=?", [fp], db);
      if (prior) return prior.disposition === "mismatch" ? "04" : "02";
      const eventId = randomUUID();
      await insert(
        "payment_events",
        {
          id: eventId,
          source,
          provider_reference: result.reference,
          fingerprint: fp,
          signature_valid: 1,
          safe_payload: JSON.stringify(result.safePayload),
          disposition: "processing",
          created_at: now(),
        },
        db,
      );
      const finish = async (disposition, receiptId = null) =>
        query(
          "UPDATE payment_events SET disposition=?,receipt_id=?,processed_at=UTC_TIMESTAMP(6) WHERE id=?",
          [disposition, receiptId, eventId],
          db,
        );
      if (result.state !== "succeeded") {
        if (a.status !== "succeeded" && o.payment_status !== "paid") {
          await update(
            "payment_attempts",
            a.id,
            { status: result.state === "failed" ? "failed" : "unknown", verified_at: now() },
            db,
          );
          const pending = await first(
            "SELECT id FROM payment_attempts WHERE order_id=? AND status IN (?) LIMIT 1",
            [o.id, active],
            db,
          );
          if (o.payment_status !== "reconciliation_required")
            await update(
              "orders",
              o.id,
              { payment_status: pending ? "pending" : "unpaid", version: o.version + 1 },
              db,
            );
        }
        await finish(result.state);
        return "00";
      }
      if (
        !result.transactionId ||
        !result.paidAt ||
        result.paidAt > new Date(Date.now() + 300000) ||
        result.paidAt < new Date(Math.floor(a.created_at.getTime() / 1000) * 1000)
      ) {
        await openCase(db, o, null, "untrusted_payment_time");
        await update("payment_attempts", a.id, { status: "unknown" }, db);
        await finish("reconciliation_required");
        return "00";
      }
      const existing = await first(
        "SELECT * FROM payment_receipts WHERE provider='vnpay' AND provider_transaction_id=? FOR UPDATE",
        [result.transactionId],
        db,
      );
      if (existing) {
        await finish("duplicate_event", existing.id);
        return "02";
      }
      const reservations = await query(
        "SELECT r.* FROM stock_reservations r JOIN order_items i ON i.id=r.order_item_id WHERE i.order_id=?",
        [o.id],
        db,
      );
      const allocation =
        result.amount !== a.requested_amount || result.amount !== o.payable_total
          ? "mismatch"
          : o.payment_status === "paid"
            ? "duplicate"
            : o.lifecycle !== "open" ||
                result.paidAt >= o.expires_at ||
                reservations.length !== lines.length ||
                reservations.some((r) => r.status !== "active")
              ? "late"
              : "accepted";
      const receiptId = await insert(
        "payment_receipts",
        {
          provider: "vnpay",
          provider_transaction_id: result.transactionId,
          order_id: o.id,
          attempt_id: a.id,
          received_amount: result.amount,
          provider_paid_at: result.paidAt,
          verified_at: now(),
          allocation,
          created_at: now(),
          updated_at: now(),
        },
        db,
      );
      await update(
        "payment_attempts",
        a.id,
        { status: "succeeded", provider_transaction_id: result.transactionId, verified_at: now() },
        db,
      );
      if (allocation === "accepted") {
        await changeStock(db, o, "consume");
        const counter =
          o.fulfillment_method === "pickup" &&
          (await first(
            "SELECT id FROM order_status_histories WHERE order_id=? AND event='counter_payment_requested' AND JSON_UNQUOTE(JSON_EXTRACT(`after`,'$.attempt_id'))=?",
            [o.id, a.id],
            db,
          ));
        await update(
          "orders",
          o.id,
          {
            payment_status: "paid",
            paid_at: result.paidAt,
            version: o.version + 1,
            ...(counter
              ? { lifecycle: "completed", fulfillment_status: "fulfilled", completed_at: now() }
              : {}),
          },
          db,
        );
        if (counter)
          await history(
            db,
            o.id,
            "counter_payment_completed",
            { lifecycle: "open" },
            { attempt_id: a.id, lifecycle: "completed" },
          );
        await history(
          db,
          o.id,
          "payment_verified",
          { payment_status: o.payment_status },
          { payment_status: "paid" },
        );
      } else await openCase(db, o, receiptId, allocation);
      await finish(allocation, receiptId);
      return allocation === "mismatch" ? "04" : "00";
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return "02";
    throw error;
  }
}
export async function claimQuery(candidate) {
  return transaction(async (db) => {
    const o = await first("SELECT * FROM orders WHERE id=? FOR UPDATE", [candidate.order_id], db),
      a = await first("SELECT * FROM payment_attempts WHERE id=? FOR UPDATE", [candidate.id], db);
    if (
      o.payment_status === "paid" ||
      !active.includes(a.status) ||
      (a.query_requested_at && a.query_requested_at > new Date(Date.now() - 300000))
    )
      return null;
    await update("payment_attempts", a.id, { query_requested_at: now() }, db);
    return a;
  });
}
export async function refreshOrder(order, uncertainCase = true, provider = gateway) {
  for (const candidate of await query(
    "SELECT * FROM payment_attempts WHERE order_id=? AND status IN (?) ORDER BY created_at LIMIT 3",
    [order.id, active],
  )) {
    const a = await claimQuery(candidate);
    if (!a) continue;
    let verified = null;
    try {
      verified = await provider.query(a);
    } catch {
      /* Provider/config uncertainty retains reservation. */
    }
    if (verified) await applyPayment(verified, "query");
    else if (uncertainCase)
      await transaction(async (db) => {
        const o = await first("SELECT * FROM orders WHERE id=? FOR UPDATE", [order.id], db),
          current = await first("SELECT * FROM payment_attempts WHERE id=? FOR UPDATE", [a.id], db);
        if (o.payment_status !== "paid" && current.status !== "succeeded") {
          await update("payment_attempts", a.id, { status: "unknown" }, db);
          await openCase(db, o, null, "provider_query_uncertain");
        }
      });
  }
  return first("SELECT * FROM orders WHERE id=?", [order.id]);
}
export async function confirmReturn(result) {
  const a = await first("SELECT * FROM payment_attempts WHERE provider_reference=?", [
    result.reference,
  ]);
  if (!a) return null;
  if (result.state === "failed") await applyPayment(result, "return");
  else await refreshOrder({ id: a.order_id }, false);
  return first("SELECT * FROM orders WHERE id=?", [a.order_id]);
}
export async function closeOrder(order, cancel = false, actorId = null, provider = gateway) {
  if (cancel && (order.payment_status === "paid" || order.lifecycle === "completed"))
    fail("ORDER_NOT_CANCELLABLE", "Đơn đã thanh toán không thể hủy.");
  if (order.lifecycle === "open" && order.payment_status !== "paid")
    await refreshOrder(order, true, provider);
  const result = await transaction(async (db) => {
    const cart = cancel ? await lockedCart(order.user_id, db) : null,
      o = await first("SELECT * FROM orders WHERE id=? FOR UPDATE", [order.id], db);
    if (o.lifecycle !== "open" || o.payment_status === "paid") {
      await restoreCartOnce(db, o, cart, actorId);
      return o;
    }
    if (!cancel && now() < o.expires_at) return o;
    const uncertain = await first(
        "SELECT id FROM payment_attempts WHERE order_id=? AND status IN (?) LIMIT 1",
        [o.id, [...active, "succeeded"]],
        db,
      ),
      caseOpen = await first(
        "SELECT id FROM reconciliation_cases WHERE order_id=? AND status='open' LIMIT 1",
        [o.id],
        db,
      );
    if (uncertain || o.payment_status !== "unpaid" || caseOpen) {
      await openCase(db, o, null, "close_requires_verification");
      return o;
    }
    await changeStock(db, o, "release");
    const target = cancel && now() < o.expires_at ? "cancelled" : "expired";
    await update(
      "orders",
      o.id,
      {
        lifecycle: target,
        cancelled_at: target === "cancelled" ? now() : null,
        version: o.version + 1,
      },
      db,
    );
    await history(
      db,
      o.id,
      target,
      { lifecycle: "open" },
      { lifecycle: target },
      actorId,
      cancel ? "Customer cancellation" : "Reservation deadline reached",
    );
    o.lifecycle = target;
    o.version++;
    await restoreCartOnce(db, o, cart, actorId);
    return o;
  });
  if (cancel && result.lifecycle === "open")
    fail("PAYMENT_RECONCILIATION_REQUIRED", "Cần xác minh thanh toán trước khi hủy.");
  if (cancel && result.payment_status === "paid")
    fail("ORDER_NOT_CANCELLABLE", "Đơn đã thanh toán không thể hủy.");
  return orderResource(result);
}
