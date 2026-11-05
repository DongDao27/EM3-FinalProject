"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AccountGate } from "@/components/account-gate";
import { useStore } from "@/components/store-provider";
import { Notice } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import type { Order, Quote, QuoteInput } from "@/lib/types";
import { errorMessage, money } from "@/lib/format";

export default function CheckoutPage() {
  return (
    <AccountGate>
      <Checkout />
    </AccountGate>
  );
}
function Checkout() {
  const { user, refreshCart } = useStore();
  const router = useRouter();
  const [method, setMethod] = useState<"delivery" | "pickup">("delivery");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const key = useRef("");
  const lock = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = quote
    ? Math.max(0, Math.ceil((Date.parse(quote.expires_at) - now - offset) / 1000))
    : 0;
  async function getQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setFields({});
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const input: QuoteInput = {
      fulfillment_method: method,
      recipient_name: String(data.recipient_name),
      recipient_phone: String(data.recipient_phone),
    };
    if (method === "delivery")
      input.address = {
        address_line: String(data.address_line),
        locality: String(data.locality),
        province: String(data.province),
      };
    try {
      const result = await api<Quote>("/checkout/quotes", {
        method: "POST",
        body: input,
      });
      setOffset(Date.parse(result.meta.server_time) - Date.now());
      setQuote(result.data);
      key.current = crypto.randomUUID();
      setNow(Date.now());
    } catch (error) {
      setError(errorMessage(error));
      if (error instanceof ApiError) setFields(error.fields);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function createOrder() {
    if (lock.current || !quote || !remaining) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api<Order>("/orders", {
        method: "POST",
        body: { quote_id: quote.id },
        idempotencyKey: key.current,
      });
      await refreshCart().catch(() => {});
      router.push(`/orders/${encodeURIComponent(result.data.order_code)}`);
    } catch (error) {
      setError(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) setQuote(null);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <div className="container page-section">
      <div className="breadcrumb">
        <Link href="/cart">Giỏ hàng</Link>
        <span>/</span>Xác nhận đơn hàng
      </div>
      <h1>Thông tin nhận hàng</h1>
      <Notice>
        Đơn giao hàng thanh toán qua VNPAY. Nhận tại cửa hàng có thể thanh toán ngay hoặc tại quầy.
      </Notice>
      {error && (
        <Notice error>
          {error}
          {Object.entries(fields).map(([field, messages]) => (
            <p key={field}>{messages.join(" ")}</p>
          ))}
        </Notice>
      )}
      <div className="checkout-layout">
        <form
          className="checkout-form form-stack"
          onSubmit={getQuote}
          onChange={() => {
            if (!busy) setQuote(null);
          }}
        >
          <fieldset disabled={busy}>
            <legend>Cách nhận hàng</legend>
            <div className="delivery-options">
              <label className={method === "delivery" ? "selected" : ""}>
                <input
                  type="radio"
                  name="method"
                  value="delivery"
                  checked={method === "delivery"}
                  onChange={() => setMethod("delivery")}
                />
                <span>
                  Giao tận nhà<small>Phí giao mặc định 25.000đ</small>
                </span>
              </label>
              <label className={method === "pickup" ? "selected" : ""}>
                <input
                  type="radio"
                  name="method"
                  value="pickup"
                  checked={method === "pickup"}
                  onChange={() => setMethod("pickup")}
                />
                <span>
                  Nhận tại cửa hàng
                  <small>295 Tôn Đức Thắng, Hòa Khánh, Đà Nẵng · Giữ đơn 24 giờ</small>
                </span>
              </label>
            </div>
            <label>
              Họ và tên
              <input
                name="recipient_name"
                autoComplete="name"
                defaultValue={user?.name}
                required
                maxLength={120}
              />
            </label>
            <label>
              Số điện thoại
              <input
                name="recipient_phone"
                type="tel"
                autoComplete="tel"
                defaultValue={user?.phone ?? ""}
                required
                maxLength={20}
              />
            </label>
            {method === "delivery" && (
              <>
                <label>
                  Tỉnh / thành phố
                  <input name="province" autoComplete="address-level1" required maxLength={120} />
                </label>
                <label>
                  Phường / xã, địa phương
                  <input name="locality" autoComplete="address-level2" required maxLength={120} />
                </label>
                <label>
                  Địa chỉ cụ thể
                  <input
                    name="address_line"
                    autoComplete="street-address"
                    required
                    maxLength={255}
                  />
                </label>
              </>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? "Đang kiểm tra…" : "Kiểm tra và lấy báo giá"}
            </button>
          </fieldset>
        </form>
        <aside className="order-summary">
          <h2>Đơn hàng của bạn</h2>
          {quote ? (
            <>
              <div className="quote-items">
                {quote.items.map((item) => (
                  <div key={item.product_id}>
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <strong>{money(item.line_total)}</strong>
                  </div>
                ))}
              </div>
              <div className="summary-row">
                <span>Tiền hàng</span>
                <strong>{money(quote.totals.items_subtotal)}</strong>
              </div>
              <div className="summary-row">
                <span>Giảm giá</span>
                <strong>−{money(quote.totals.discount_total)}</strong>
              </div>
              <div className="summary-row">
                <span>Phí giao</span>
                <strong>{money(quote.totals.shipping_fee)}</strong>
              </div>
              <div className="summary-total">
                <span>Tổng thanh toán</span>
                <strong>{money(quote.totals.payable_total)}</strong>
              </div>
              <p className={remaining ? "muted" : "error-text"}>
                {remaining
                  ? `Báo giá còn ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
                  : "Báo giá đã hết hạn. Vui lòng lấy báo giá mới."}
              </p>
              <button
                className="button primary full"
                onClick={createOrder}
                disabled={busy || !remaining}
              >
                {busy ? "Đang xử lý…" : "Xác nhận đặt hàng"}
              </button>
              <p className="summary-footnote">
                Không hỗ trợ đổi trả / hoàn tiền. Đặt hàng chưa đồng nghĩa đã thanh toán.
              </p>
            </>
          ) : (
            <p className="muted">
              Điền thông tin và kiểm tra báo giá. Tổng tiền được xác nhận bởi cửa hàng trước khi bạn
              tạo đơn.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
