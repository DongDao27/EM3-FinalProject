"use client";
import { useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { errorMessage } from "@/lib/format";
import { useStore } from "./store-provider";
import { Icon, Notice } from "./ui";

export function ProductActions({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const { user, purchaseProduct } = useStore();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const available = product.is_active && product.available_quantity > 0;
  const disabled = busy || !available || (user !== null && user.role !== "customer");
  async function act(destination: "cart" | "checkout") {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await purchaseProduct(product, 1, destination);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={`product-actions-block ${className}`}>
      <div className="product-actions" aria-busy={busy}>
        <button
          className="button primary product-buy"
          onClick={() => act("checkout")}
          disabled={disabled}
          aria-label={`Mua ngay ${product.name}`}
        >
          {busy ? "Đang xử lý…" : available ? "Mua ngay" : "Tạm hết hàng"}
        </button>
        <button
          className="button product-add"
          onClick={() => act("cart")}
          disabled={disabled}
          aria-label={`Thêm ${product.name} vào giỏ hàng`}
        >
          <Icon name="cart" size={22} />
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}
