"use client";
import { CounterPayment } from "@/components/counter-payment";
import { AdminOrderHistory } from "@/components/admin-history";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { errorMessage, money, statusLabel } from "@/lib/format";
import type { Order, Pagination } from "@/lib/types";
import { Empty, Loading, Modal, Notice } from "@/components/ui";

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminOrders />
    </Suspense>
  );
}
function AdminOrders() {
  const params = useSearchParams();
  const initialSearch = params.get("q") ?? "";
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const counterUpdate = useCallback((order: Order) => {
    setSelected(order);
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    setQ(initialSearch);
    setSearch(initialSearch);
    setPage(1);
  }, [initialSearch]);
  useEffect(() => {
    const abort = new AbortController();
    setOrders(null);
    setError("");
    const params = new URLSearchParams({
      q: search,
      page: String(page),
      per_page: "12",
    });
    if (method) params.set("fulfillment_method", method);
    api<Order[]>(`/admin/orders?${params}`, { signal: abort.signal })
      .then((result) => {
        setOrders(result.data);
        setPagination(result.meta.pagination ?? null);
      })
      .catch((error) => {
        if (!abort.signal.aborted) setError(errorMessage(error));
      });
    return () => abort.abort();
  }, [search, method, page, revision]);
  async function update(target_status: string) {
    if (
      !selected ||
      lock.current ||
      !window.confirm(`Chuyển đơn sang “${statusLabel[target_status]}”?`)
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      setSelected(
        (
          await api<Order>(`/admin/orders/${encodeURIComponent(selected.order_code)}/fulfillment`, {
            method: "PATCH",
            body: { target_status, version: selected.version },
          })
        ).data,
      );
      setRevision(revision + 1);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <>
      <h2>Đơn hàng</h2>
      <div className="admin-toolbar">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(q);
            setPage(1);
          }}
        >
          <input
            aria-label="Tìm đơn hàng"
            placeholder="Mã đơn, tên hoặc số điện thoại…"
            value={q}
            maxLength={100}
            onChange={(event) => setQ(event.target.value)}
          />
          <button className="button">Tìm</button>
        </form>
        <label>
          Cách nhận{" "}
          <select
            value={method}
            onChange={(event) => {
              setMethod(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            <option value="pickup">Nhận tại cửa hàng</option>
            <option value="delivery">Giao hàng</option>
          </select>
        </label>
      </div>
      {error && <Notice error>{error}</Notice>}
      {!orders ? (
        !error && <Loading />
      ) : !orders.length ? (
        <Empty title="Chưa có đơn hàng" />
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã đơn / Khách</th>
                <th>Cách nhận</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Xử lý</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.order_code}>
                  <td>
                    <strong>{order.order_code}</strong>
                    <br />
                    {order.recipient_name}
                    <br />
                    <small>{order.recipient_phone}</small>
                  </td>
                  <td>{statusLabel[order.fulfillment_method]}</td>
                  <td>{money(order.totals.payable_total)}</td>
                  <td>{statusLabel[order.payment_status] ?? order.payment_status}</td>
                  <td>
                    {statusLabel[order.lifecycle] ?? order.lifecycle}
                    <br />
                    {statusLabel[order.fulfillment_status] ?? order.fulfillment_status}
                  </td>
                  <td>
                    <button className="text-button" onClick={() => setSelected(order)}>
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      {selected && (
        <Modal
          title={selected.order_code}
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          <p>
            {selected.recipient_name} · {selected.recipient_phone}
          </p>
          <p>
            {statusLabel[selected.payment_status] ?? selected.payment_status} ·{" "}
            {statusLabel[selected.fulfillment_status] ?? selected.fulfillment_status}
          </p>
          {selected.address && (
            <p>
              {selected.address.address_line}, {selected.address.locality},{" "}
              {selected.address.province}
            </p>
          )}
          {selected.items.map((item) => (
            <div className="summary-row" key={item.product_id}>
              <span>
                {item.name} × {item.quantity}
              </span>
              <strong>{money(item.line_total)}</strong>
            </div>
          ))}
          <div className="summary-total">
            <strong>{money(selected.totals.payable_total)}</strong>
          </div>
          {selected.fulfillment_method === "pickup" && (
            <CounterPayment
              key={`payment-${selected.order_code}`}
              order={selected}
              onUpdate={counterUpdate}
              onBusyChange={setBusy}
            />
          )}
          {error && <Notice error>{error}</Notice>}
          {selected.lifecycle === "open" && (
            <div className="button-row">
              {selected.fulfillment_status === "unprocessed" && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => update("preparing")}
                >
                  Bắt đầu chuẩn bị
                </button>
              )}
              {selected.fulfillment_status === "preparing" && (
                <button
                  className="button"
                  disabled={
                    busy ||
                    (selected.fulfillment_method === "delivery" &&
                      selected.payment_status !== "paid")
                  }
                  onClick={() =>
                    update(
                      selected.fulfillment_method === "pickup" ? "ready_for_pickup" : "shipping",
                    )
                  }
                >
                  {selected.fulfillment_method === "pickup" ? "Sẵn sàng nhận" : "Bắt đầu giao"}
                </button>
              )}
              {["ready_for_pickup", "shipping"].includes(selected.fulfillment_status) && (
                <button
                  className="button"
                  disabled={busy || selected.payment_status !== "paid"}
                  onClick={() => update("fulfilled")}
                >
                  Xác nhận hoàn tất
                </button>
              )}
            </div>
          )}
          <AdminOrderHistory
            key={selected.order_code}
            orderCode={selected.order_code}
            version={selected.version}
          />
        </Modal>
      )}
    </>
  );
}
