"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api } from "@/lib/api-client";
import { errorMessage, money } from "@/lib/format";
import type { Order, PaymentAttempt } from "@/lib/types";
import { Notice } from "./ui";

export function CounterPayment({
  order,
  onUpdate,
  onBusyChange,
}: {
  order: Order;
  onUpdate: (order: Order) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [qr, setQr] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [now, setNow] = useState(Date.now());
  const lock = useRef(false);
  const active = useRef(true);
  const path = `/admin/orders/${encodeURIComponent(order.order_code)}`;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    if (order.lifecycle !== "open") return;
    const abort = new AbortController();
    let inFlight = false;
    async function refresh() {
      if (inFlight || document.hidden || lock.current) return;
      inFlight = true;
      setNow(Date.now());
      try {
        const { data } = await api<Order>(path, { signal: abort.signal });
        if (abort.signal.aborted) return;
        setUncertain(false);
        if (data.version !== order.version) onUpdate(data);
        if (url && data.payment_status === "paid" && data.lifecycle === "completed") {
          setSuccess(true);
          setQr("");
          setUrl("");
        }
      } catch (error) {
        if (!abort.signal.aborted) setError(errorMessage(error));
      } finally {
        inFlight = false;
      }
    }
    const timer = window.setInterval(refresh, 3000);
    window.addEventListener("focus", refresh);
    return () => {
      abort.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [path, order.version, order.lifecycle, url, onUpdate]);

  async function collect(method: "vnpay" | "cash") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      if (method === "cash") {
        const { data } = await api<Order>(`${path}/cash-payment`, { method: "POST" });
        if (!active.current) return;
        onUpdate(data);
        setSuccess(data.payment_status === "paid" && data.lifecycle === "completed");
        setQr("");
        setUrl("");
      } else {
        const { data } = await api<PaymentAttempt>(`${path}/payment-attempts`, {
          method: "POST",
          idempotencyKey: crypto.randomUUID(),
        });
        if (!active.current) return;
        if (
          !data.qr_content ||
          data.qr_kind !== "checkout_url" ||
          !/^\/api\/v1\/payments\/vnpay\/checkout\/[a-f0-9]{32}$/.test(data.qr_content)
        ) {
          throw new Error("Chưa có QR khả dụng. Vui lòng kiểm tra trạng thái đơn.");
        }
        const checkoutUrl = new URL(data.qr_content, window.location.origin).href;
        const image = await QRCode.toDataURL(checkoutUrl, {
          width: 360,
          margin: 4,
          errorCorrectionLevel: "M",
        });
        if (!active.current) return;
        setQr(image);
        setUrl(checkoutUrl);
        const current = await api<Order>(path);
        if (active.current) {
          onUpdate(current.data);
          if (current.data.payment_status === "paid" && current.data.lifecycle === "completed")
            setSuccess(true);
        }
      }
    } catch (error) {
      if (!active.current) return;
      setError(errorMessage(error));
      setUncertain(true);
      try {
        const current = await api<Order>(path);
        if (active.current) {
          onUpdate(current.data);
          setUncertain(false);
        }
      } catch {
        /* Keep collection disabled until a successful status read. */
      }
    } finally {
      lock.current = false;
      onBusyChange(false);
      if (active.current) setBusy(false);
    }
  }

  if (success)
    return (
      <div className="counter-payment-success" role="status">
        <h3>Nhận tiền thành công</h3>
        <p>Đơn hàng đã hoàn tất.</p>
      </div>
    );
  if (order.lifecycle !== "open" || order.payment_status === "paid") return null;
  const expired = Date.parse(order.expires_at) <= now;
  return (
    <section className="counter-payment" aria-label="Thanh toán tại quầy">
      <div className="button-row">
        <button
          className="button primary"
          disabled={
            busy || uncertain || expired || order.payment_status === "reconciliation_required"
          }
          onClick={() => collect("vnpay")}
        >
          Thanh toán qua VNPAY
        </button>
        <button
          className="button"
          disabled={busy || uncertain || expired || order.payment_status !== "unpaid"}
          onClick={() => collect("cash")}
        >
          Thanh toán tiền mặt
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
      {qr && !expired && (
        <div className="counter-payment-qr">
          <h3>Thanh toán VNPAY · {money(order.totals.payable_total)}</h3>
          {/* Generated locally; payment URLs never go to an image service. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            width={360}
            height={360}
            alt={`QR mở thanh toán VNPAY cho đơn ${order.order_code}`}
          />
          <p>Quét bằng camera để mở trang thanh toán VNPAY.</p>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Mở trang thanh toán
          </a>
          <p role="status">Đang chờ xác nhận nhận tiền…</p>
        </div>
      )}
      {expired && <Notice>Đơn đã hết thời gian thanh toán.</Notice>}
      {order.payment_status === "reconciliation_required" && (
        <Notice>Giao dịch đang chờ đối soát. Chưa thể thu thêm tiền.</Notice>
      )}
      {!qr && order.payment_status === "unpaid" && !expired && (
        <p>
          Chọn tiền mặt để xác nhận đã thu đủ {money(order.totals.payable_total)} và hoàn tất đơn.
        </p>
      )}
      {order.payment_status === "pending" && !qr && (
        <Notice>VNPAY đang chờ xác nhận. Không thu thêm tiền mặt.</Notice>
      )}
    </section>
  );
}
