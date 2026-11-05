"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { errorMessage, money, statusLabel } from "@/lib/format";
import type { Pagination } from "@/lib/types";
import { Loading, Notice } from "./ui";

type Movement = {
  id: number;
  kind: string;
  delta_on_hand: number;
  delta_reserved: number;
  resulting_on_hand: number;
  resulting_reserved: number;
  actor_name: string | null;
  order_code: string | null;
  reason: string | null;
  created_at: string;
};

type OrderEntry = {
  id: string;
  type: "attempt" | "receipt" | "status";
  created_at: string;
  status?: string;
  provider?: string;
  amount?: number;
  transaction_id?: string;
  event?: string;
  reason?: string | null;
  before?: Record<string, string>;
  after?: Record<string, string>;
};

const labels: Record<string, string> = {
  ...statusLabel,
  created: "Đã tạo",
  failed: "Không thành công",
  succeeded: "Thành công",
  unknown: "Chưa xác định",
  accepted: "Đã ghi nhận",
  duplicate: "Trùng giao dịch",
  late: "Nhận sau hạn",
  mismatch: "Sai số tiền",
  adjustment: "Điều chỉnh",
  reserve: "Giữ hàng",
  release: "Trả tồn giữ",
  sale: "Xuất bán",
  payment_verified: "Xác minh thanh toán",
  fulfillment: "Xử lý đơn",
  expired: "Hết hạn",
  completed: "Hoàn tất",
  cancellation: "Hủy đơn",
  cart_restored: "Đưa sản phẩm về giỏ",
};
const label = (value?: string) => (value ? (labels[value] ?? value) : "—");
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
const delta = (value: number) => (value > 0 ? `+${value}` : String(value));
const reasonLabel = (value: string | null | undefined) =>
  (
    ({
      "Order reservation": "Giữ hàng khi tạo đơn",
      "Order sale": "Xuất kho khi xác minh thanh toán",
      "Order release": "Trả tồn giữ khi đóng đơn",
      "Customer cancellation": "Khách hàng yêu cầu hủy",
      "Cancelled order items saved in cart; current prices and stock apply at checkout.":
        "Đã đưa sản phẩm về giỏ. Giá và tồn được kiểm tra lại khi đặt đơn mới.",
      "Reservation deadline reached": "Đã hết thời gian giữ hàng",
    }) as Record<string, string>
  )[value ?? ""] ??
  value ??
  "—";

function HistoryTable<T>({
  url,
  headers,
  renderRow,
}: {
  url: string;
  headers: string[];
  renderRow: (entry: T) => ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<T[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setRows(null);
    setError("");
    api<T[]>(`${url}${url.includes("?") ? "&" : "?"}page=${page}&per_page=10`, {
      signal: abort.signal,
    })
      .then((result) => {
        setRows(result.data);
        setPagination(result.meta.pagination ?? null);
      })
      .catch((cause) => {
        if (!abort.signal.aborted) setError(errorMessage(cause));
      });
    return () => abort.abort();
  }, [url, page, revision]);
  return (
    <div className="history-results" aria-busy={!rows && !error}>
      {error ? (
        <>
          <Notice error>{error}</Notice>
          <button className="button" onClick={() => setRevision(revision + 1)}>
            Thử lại
          </button>
        </>
      ) : !rows ? (
        <Loading />
      ) : !rows.length ? (
        <p className="muted" role="status">
          Chưa có lịch sử cho mục này.
        </p>
      ) : (
        <div
          className="data-table-wrap"
          role="region"
          tabIndex={0}
          aria-label="Bảng lịch sử, cuộn ngang để xem các cột còn lại"
        >
          <table className="history-table">
            <thead>
              <tr>
                {headers.map((heading) => (
                  <th key={heading} scope="col">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{rows.map(renderRow)}</tbody>
          </table>
        </div>
      )}
      {rows && pagination && pagination.last_page > 1 && (
        <nav className="pagination" aria-label="Phân trang lịch sử">
          <button className="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Trước
          </button>
          <span aria-live="polite">
            {page} / {pagination.last_page} · {pagination.total} bản ghi
          </span>
          <button
            className="button"
            disabled={page >= pagination.last_page}
            onClick={() => setPage(page + 1)}
          >
            Sau →
          </button>
        </nav>
      )}
    </div>
  );
}

export function InventoryHistory({ productId }: { productId: number }) {
  return (
    <HistoryTable<Movement>
      url={`/admin/inventory/${productId}/movements`}
      headers={["Thời gian", "Hoạt động", "Thay đổi", "Tồn sau", "Người thực hiện", "Nội dung"]}
      renderRow={(entry) => (
        <tr key={entry.id}>
          <td>
            <time dateTime={entry.created_at}>{dateTime(entry.created_at)}</time>
          </td>
          <td>{label(entry.kind)}</td>
          <td>
            Thực: {delta(entry.delta_on_hand)}
            <br />
            Giữ: {delta(entry.delta_reserved)}
          </td>
          <td>
            Thực: {entry.resulting_on_hand}
            <br />
            Giữ: {entry.resulting_reserved}
          </td>
          <td>{entry.actor_name ?? "Hệ thống"}</td>
          <td>
            {reasonLabel(entry.reason)}
            {entry.order_code && (
              <>
                <br />
                <strong>{entry.order_code}</strong>
              </>
            )}
          </td>
        </tr>
      )}
    />
  );
}

export function AdminOrderHistory({ orderCode, version }: { orderCode: string; version: number }) {
  const [type, setType] = useState("attempts");
  const isStatus = type === "statuses";
  return (
    <section className="history-panel" aria-label="Lịch sử đơn hàng">
      <h3>Lịch sử đơn hàng</h3>
      <div className="history-filters" role="group" aria-label="Loại lịch sử">
        {[
          ["attempts", "Lần thanh toán"],
          ["receipts", "Khoản tiền ghi nhận"],
          ["statuses", "Trạng thái đơn"],
        ].map(([value, text]) => (
          <button
            key={value}
            className={`button ${type === value ? "primary" : ""}`}
            aria-pressed={type === value}
            onClick={() => setType(value)}
          >
            {text}
          </button>
        ))}
      </div>
      <HistoryTable<OrderEntry>
        key={`${type}:${version}`}
        url={`/admin/orders/${encodeURIComponent(orderCode)}/history?type=${type}`}
        headers={
          isStatus
            ? ["Thời gian", "Hoạt động", "Trước", "Sau"]
            : ["Thời gian", "Kênh", "Số tiền", "Trạng thái", "Mã giao dịch"]
        }
        renderRow={(entry) => (
          <tr key={entry.id}>
            <td>
              <time dateTime={entry.created_at}>{dateTime(entry.created_at)}</time>
            </td>
            {isStatus ? (
              <>
                <td>
                  {label(entry.event)}
                  {entry.reason && <p>{reasonLabel(entry.reason)}</p>}
                </td>
                <td>
                  {Object.values(entry.before ?? {})
                    .map(label)
                    .join(" · ") || "—"}
                </td>
                <td>
                  {Object.values(entry.after ?? {})
                    .map(label)
                    .join(" · ") || "—"}
                </td>
              </>
            ) : (
              <>
                <td>
                  {entry.provider === "demo"
                    ? "Dữ liệu demo"
                    : (entry.provider?.toUpperCase() ?? "—")}
                </td>
                <td>{typeof entry.amount === "number" ? money(entry.amount) : "—"}</td>
                <td>{label(entry.status)}</td>
                <td>{entry.transaction_id ?? "—"}</td>
              </>
            )}
          </tr>
        )}
      />
      {type === "receipts" && (
        <p className="muted">Các khoản trùng, sai số tiền hoặc đến muộn cần được đối soát.</p>
      )}
    </section>
  );
}
