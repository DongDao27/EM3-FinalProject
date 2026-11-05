"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AccountGate } from "@/components/account-gate";
import { useStore } from "@/components/store-provider";
import { Empty, Loading, Notice, Icon } from "@/components/ui";
import { imageSrc } from "@/components/product-card";
import { api } from "@/lib/api-client";
import { errorMessage, money } from "@/lib/format";

export default function CartPage() {
  return (
    <AccountGate>
      <CartContent />
    </AccountGate>
  );
}
function CartContent() {
  const { cart, refreshCart } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    refreshCart().catch((error) => setError(errorMessage(error)));
  }, [refreshCart]);
  async function change(id: number, quantity?: number) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`/cart/items/${id}`, {
        method: quantity === undefined ? "DELETE" : "PATCH",
        ...(quantity === undefined ? {} : { body: { quantity } }),
      });
      await refreshCart();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <div className="container page-section">
      <div className="breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span>/</span>Giỏ hàng
      </div>
      <h1>Giỏ hàng của bạn</h1>
      {error && <Notice error>{error}</Notice>}
      {!cart ? (
        <Loading />
      ) : !cart.items.length ? (
        <Empty title="Giỏ hàng còn trống">
          <p>Thêm một cuốn sách hay hoặc món đồ bạn thích nhé.</p>
          <Link className="button primary" href="/products">
            Khám phá sản phẩm <Icon name="arrow" size={18} />
          </Link>
        </Empty>
      ) : (
        <div className="checkout-layout">
          <section className="cart-items" aria-label="Sản phẩm trong giỏ">
            {cart.items.map((item) => (
              <article className="cart-item" key={item.id}>
                {item.product.images[0] && (
                  <div className="cart-product-image">
                    <Image
                      src={imageSrc(item.product.images[0].url)}
                      fill
                      sizes="(max-width: 760px) 70px, 100px"
                      alt={item.product.name}
                      style={{
                        objectFit: "contain",
                      }}
                    />
                  </div>
                )}
                <div className="cart-item-info">
                  <small className="muted">{item.product.category.name}</small>
                  <h2>{item.product.name}</h2>
                  <strong>{money(item.product.unit_price)}</strong>
                  {!item.is_available && (
                    <p className="error-text">
                      Không đủ hàng. Vui lòng giảm số lượng hoặc xóa sản phẩm.
                    </p>
                  )}
                  <div className="quantity-control">
                    <button
                      aria-label={`Giảm số lượng ${item.product.name}`}
                      disabled={busy || item.quantity <= 1}
                      onClick={() => change(item.id, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span aria-label={`Số lượng ${item.product.name}`}>{item.quantity}</span>
                    <button
                      aria-label={`Tăng số lượng ${item.product.name}`}
                      disabled={
                        busy || item.quantity >= Math.min(99, item.product.available_quantity)
                      }
                      onClick={() => change(item.id, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="cart-item-total">
                  <strong>{money(item.line_total)}</strong>
                  <button className="text-button" disabled={busy} onClick={() => change(item.id)}>
                    Xóa
                  </button>
                </div>
              </article>
            ))}
            <Link href="/products" className="text-button">
              ← Tiếp tục mua sắm
            </Link>
          </section>
          <aside className="order-summary">
            <h2>Tóm tắt giỏ hàng</h2>
            <div className="summary-row">
              <span>Tiền sản phẩm</span>
              <strong>{money(cart.estimated_total)}</strong>
            </div>
            <p className="muted">Phí vận chuyển được hiển thị ở bước thanh toán.</p>
            <Link
              className={`button primary full ${busy || cart.items.some((item) => !item.is_available) ? "disabled-link" : ""}`}
              href="/checkout"
              aria-disabled={busy || cart.items.some((item) => !item.is_available)}
            >
              Tiến hành đặt hàng <Icon name="arrow" size={20} />
            </Link>
            <p className="summary-footnote">Giá và tồn kho được kiểm tra lại ở bước xác nhận.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
