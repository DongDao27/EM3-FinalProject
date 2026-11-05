"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { errorMessage, money } from "@/lib/format";
import { InventoryHistory } from "@/components/admin-history";
import { useStore } from "@/components/store-provider";
import { Loading, Modal, Notice } from "@/components/ui";
import type { Pagination } from "@/lib/types";
type Stock = {
  product_id: number;
  sku: string;
  name: string;
  list_price: number;
  sale_price: number | null;
  unit_price: number;
  stock_on_hand: number;
  stock_reserved: number;
  available_quantity: number;
};

export default function InventoryPage() {
  const { categories, notify } = useStore();
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Stock[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Stock | null>(null);
  const [history, setHistory] = useState<Stock | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const request = useRef("");
  useEffect(() => {
    const abort = new AbortController();
    setError("");
    setData(null);
    const params = new URLSearchParams({ page: String(page), per_page: "15" });
    if (category) params.set("category_id", category);
    api<Stock[]>(`/admin/inventory?${params}`, { signal: abort.signal })
      .then((result) => {
        setData(result.data);
        setPagination(result.meta.pagination ?? null);
      })
      .catch((error) => {
        if (!abort.signal.aborted) setError(errorMessage(error));
      });
    return () => abort.abort();
  }, [category, page, revision]);
  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !editing) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api(`/admin/inventory/${editing.product_id}/adjustments`, {
        method: "POST",
        body: {
          delta: Number(form.get("delta")),
          reason: form.get("reason"),
          request_key: request.current,
        },
      });
      setEditing(null);
      setRevision(revision + 1);
      notify("Đã điều chỉnh tồn kho và ghi lịch sử.");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <>
      <div className="admin-toolbar">
        <h2>Tồn kho</h2>
        <label>
          Danh mục{" "}
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <Notice error>{error}</Notice>}
      {!data ? (
        !error && <Loading />
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Giá bán</th>
                <th>Tồn thực</th>
                <th>Đang giữ</th>
                <th>Có thể bán</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.product_id}>
                  <td>
                    <strong>{item.name}</strong>
                    <br />
                    <small>{item.sku}</small>
                  </td>
                  <td>
                    <strong>{money(item.unit_price)}</strong>
                    {item.unit_price < item.list_price && (
                      <>
                        <br />
                        <s className="muted">{money(item.list_price)}</s>
                      </>
                    )}
                  </td>
                  <td>{item.stock_on_hand}</td>
                  <td>{item.stock_reserved}</td>
                  <td>{item.available_quantity}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        request.current = crypto.randomUUID();
                        setEditing(item);
                      }}
                    >
                      Điều chỉnh
                    </button>
                    <button className="text-button" onClick={() => setHistory(item)}>
                      Lịch sử
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
      {editing && (
        <Modal
          title="Điều chỉnh tồn kho"
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <p>{editing.name}</p>
          <p className="muted">
            Tồn thực: {editing.stock_on_hand} · Đang giữ: {editing.stock_reserved}
          </p>
          <form
            className="form-stack"
            onSubmit={adjust}
            onChange={() => {
              request.current = crypto.randomUUID();
            }}
          >
            <label>
              Số lượng tăng / giảm
              <input
                name="delta"
                type="number"
                required
                min={-2147483647}
                max={2147483647}
                step={1}
                disabled={busy}
              />
            </label>
            <label>
              Lý do
              <textarea name="reason" required maxLength={1000} rows={3} disabled={busy} />
            </label>
            {error && <Notice error>{error}</Notice>}
            <button className="button primary" disabled={busy}>
              {busy ? "Đang lưu…" : "Xác nhận điều chỉnh"}
            </button>
          </form>
        </Modal>
      )}
      {history && (
        <Modal title={`Lịch sử tồn kho — ${history.name}`} onClose={() => setHistory(null)}>
          <InventoryHistory productId={history.product_id} />
        </Modal>
      )}
    </>
  );
}
