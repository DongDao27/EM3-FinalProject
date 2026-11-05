"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountGate } from "@/components/account-gate";
import { Empty, Loading, Notice } from "@/components/ui";
import { api } from "@/lib/api-client";
import { errorMessage, money, statusLabel } from "@/lib/format";
import type { Order, Pagination } from "@/lib/types";

export default function OrdersPage() {
  return (
    <AccountGate>
      <Orders />
    </AccountGate>
  );
}
function Orders() {
  const [data, setData] = useState<Order[] | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setData(null);
    setError("");
    api<Order[]>(`/orders?page=${page}&per_page=10`, { signal: abort.signal })
      .then((result) => {
        setData(result.data);
        setPagination(result.meta.pagination ?? null);
      })
      .catch((error) => {
        if (!abort.signal.aborted) setError(errorMessage(error));
      });
    return () => abort.abort();
  }, [page]);
  return (
    <div className="container page-section">
      <div className="breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span>/</span>Đơn hàng
      </div>
      <h1>Đơn hàng của tôi</h1>
      {error ? (
        <Notice error>{error}</Notice>
      ) : !data ? (
        <Loading />
      ) : !data.length ? (
        <Empty title="Bạn chưa có đơn hàng">
          <p>Những cuốn sách tiếp theo đang đợi bạn.</p>
          <Link className="button primary" href="/products">
            Khám phá sản phẩm
          </Link>
        </Empty>
      ) : (
        <div className="orders-list">
          {data.map((order) => (
            <Link
              href={`/orders/${encodeURIComponent(order.order_code)}`}
              className="order-card"
              key={order.order_code}
            >
              <div>
                <strong>{order.order_code}</strong>
                <p className="muted">{statusLabel[order.fulfillment_method]}</p>
                <p>
                  {order.items
                    .slice(0, 2)
                    .map((item) => `${item.name} × ${item.quantity}`)
                    .join(" · ")}
                </p>
              </div>
              <div>
                <span className={`badge ${order.payment_status === "paid" ? "success" : ""}`}>
                  {statusLabel[order.payment_status] ?? order.payment_status}
                </span>
                <p className="price">{money(order.totals.payable_total)}</p>
                <small>{statusLabel[order.lifecycle] ?? order.lifecycle} →</small>
              </div>
            </Link>
          ))}
        </div>
      )}
      {pagination && pagination.last_page > 1 && (
        <div className="pagination">
          <button className="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Trước
          </button>
          <span>
            {page} / {pagination.last_page}
          </span>
          <button
            className="button"
            disabled={page >= pagination.last_page}
            onClick={() => setPage(page + 1)}
          >
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}
