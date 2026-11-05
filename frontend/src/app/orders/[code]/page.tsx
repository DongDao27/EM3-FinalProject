"use client";
import Link from "next/link";
import { useOrderPolling } from "@/lib/use-order-polling";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountGate } from "@/components/account-gate";
import { useStore } from "@/components/store-provider";
import { Loading, Notice } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { Order, PaymentAttempt } from "@/lib/types";
import { errorMessage, money, statusLabel } from "@/lib/format";

export default function OrderPage() {
  return (
    <AccountGate>
      <Detail />
    </AccountGate>
  );
}
function Detail() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { refreshCart, notify } = useStore();
  const [order, setOrder] = useState<Order | null>(null);
  useOrderPolling(
    code,
    order !== null && order.lifecycle === "open" && order.payment_status !== "paid",
    setOrder,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const lock = useRef(false);
  const load = useCallback(async () => {
    const result = await api<Order>(`/orders/${encodeURIComponent(code)}`);
    setOrder(result.data);
    setOffset(Date.parse(result.meta.server_time) - Date.now());
    setNow(Date.now());
  }, [code]);
  useEffect(() => {
    let active = true;
    load().catch((error) => {
      if (active) setError(errorMessage(error));
    });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load]);
  async function cancel() {
    if (lock.current || !window.confirm("Bạn muốn hủy đơn chưa thanh toán này?")) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api<Order>(`/orders/${encodeURIComponent(code)}/cancel`, {
        method: "POST",
      });
      setOrder(result.data);
      await refreshCart();
      notify("Đã hủy đơn. Sản phẩm đã được đưa về giỏ hàng.");
      router.push("/cart");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function pay() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api<PaymentAttempt>(
        `/orders/${encodeURIComponent(code)}/payment-attempts`,
        { method: "POST", idempotencyKey: crypto.randomUUID() },
      );
      const url = result.data.payment_url;
      if (url && new URL(url).protocol === "https:") {
        window.location.assign(url);
        return;
      }
      setError(
        "Giao dịch trước đang được VNPAY xác minh. Vui lòng cập nhật trạng thái sau ít phút.",
      );
      await load();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const seconds = order
    ? Math.max(0, Math.ceil((Date.parse(order.expires_at) - now - offset) / 1000))
    : 0;
  const payable =
    order?.lifecycle === "open" &&
    ["unpaid", "pending"].includes(order.payment_status) &&
    seconds > 0;
  return (
    <div className="container page-section">
      <div className="breadcrumb">
        <Link href="/orders">Đơn hàng của tôi</Link>
        <span>/</span>
        {code}
      </div>
      {error && <Notice error>{error}</Notice>}
      {!order ? (
        !error && <Loading />
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow muted">CHI TIẾT ĐƠN HÀNG</span>
              <h1>{order.order_code}</h1>
            </div>
            <span className={`badge ${order.payment_status === "paid" ? "success" : ""}`}>
              {statusLabel[order.payment_status] ?? order.payment_status}
            </span>
          </div>
          {order.payment_status === "paid" ? (
            <Notice>Đơn đã được xác nhận thanh toán.</Notice>
          ) : order.payment_status === "reconciliation_required" ? (
            <Notice>
              Giao dịch VNPAY của đơn đang chờ nhà sách đối soát. Vui lòng không thanh toán lại;
              trạng thái sẽ được cập nhật sau khi xác minh.
            </Notice>
          ) : (
            <Notice>
              Đơn chưa được thanh toán.{" "}
              {payable
                ? order.fulfillment_method === "pickup"
                  ? "Thanh toán ngay hoặc khi nhận tại quầy."
                  : "Thanh toán trước khi hết hạn giữ hàng."
                : "Đơn chưa được thanh toán."}
            </Notice>
          )}
          <div className="checkout-layout">
            <section>
              <div className="detail-panel">
                <h2>Thông tin nhận hàng</h2>
                <p>
                  {order.recipient_name} · {order.recipient_phone}
                </p>
                <p>{statusLabel[order.fulfillment_method]}</p>
                {order.address && (
                  <p>
                    {order.address.address_line}, {order.address.locality}, {order.address.province}
                  </p>
                )}
                <p>
                  Đơn: <strong>{statusLabel[order.lifecycle] ?? order.lifecycle}</strong> ·{" "}
                  {statusLabel[order.fulfillment_status] ?? order.fulfillment_status}
                </p>
                {order.lifecycle === "open" && order.payment_status !== "paid" && (
                  <p>
                    {seconds
                      ? `Thời gian còn lại: ${Math.floor(seconds / 3600)} giờ ${Math.floor((seconds % 3600) / 60)} phút ${seconds % 60} giây`
                      : "Đã đến hạn. Trạng thái cuối cùng được xác nhận bởi máy chủ."}
                  </p>
                )}
              </div>
              <div className="detail-panel">
                <h2>Sản phẩm</h2>
                {order.items.map((item) => (
                  <div className="summary-row" key={item.product_id}>
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <strong>{money(item.line_total)}</strong>
                  </div>
                ))}
              </div>
              <div className="button-row">
                {payable && (
                  <button className="button primary" disabled={busy} onClick={pay}>
                    {order.fulfillment_method === "pickup" ? "Thanh toán ngay" : "Thanh toán"}
                  </button>
                )}
                {payable &&
                  order.fulfillment_method === "pickup" &&
                  order.payment_status === "unpaid" && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => {
                        notify("Đơn đã được giữ. Bạn thanh toán khi đến nhận tại quầy.");
                        router.push("/orders");
                      }}
                    >
                      Thanh toán tại quầy
                    </button>
                  )}
                {order.lifecycle === "open" && order.payment_status === "unpaid" && (
                  <button className="button" disabled={busy} onClick={cancel}>
                    Hủy đơn
                  </button>
                )}
              </div>
            </section>
            <aside className="order-summary">
              <h2>Tổng thanh toán</h2>
              <div className="summary-row">
                <span>Tiền hàng</span>
                <strong>{money(order.totals.items_subtotal)}</strong>
              </div>
              <div className="summary-row">
                <span>Giảm giá</span>
                <strong>−{money(order.totals.discount_total)}</strong>
              </div>
              <div className="summary-row">
                <span>Phí giao</span>
                <strong>{money(order.totals.shipping_fee)}</strong>
              </div>
              <div className="summary-total">
                <span>Tổng cộng</span>
                <strong>{money(order.totals.payable_total)}</strong>
              </div>
              <p className="summary-footnote">
                Không đổi trả / hoàn tiền. Giá trong đơn được giữ theo thời điểm đặt hàng.
              </p>
              <Link className="button full" href="/orders">
                Về danh sách đơn
              </Link>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
