"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/format";
import type { Pagination } from "@/lib/types";
import { Empty, Loading, Modal, Notice } from "@/components/ui";
type Case = {
  id: number;
  order_code: string;
  reason: string;
  status: string;
  note: string | null;
  version: number;
};
const reasons: Record<string, string> = {
  provider_query_uncertain: "Chưa xác định được kết quả từ cổng thanh toán",
  close_requires_verification: "Cần xác minh trước khi đóng đơn",
  duplicate_payment: "Giao dịch trùng lặp",
  late_payment: "Thanh toán sau hạn giữ hàng",
};
export default function ReconciliationPage() {
  const [items, setItems] = useState<Case[] | null>(null);
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [editing, setEditing] = useState<Case | null>(null);
  const [resolution, setResolution] = useState("manual_review");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const load = useCallback(async () => {
    const r = await api<Case[]>(
      `/admin/reconciliation-cases?status=${status}&page=${page}&per_page=20`,
    );
    setItems(r.data);
    setPagination(r.meta.pagination ?? null);
  }, [status, page]);
  useEffect(() => {
    setItems(null);
    setError("");
    load().catch((e) => setError(errorMessage(e)));
  }, [load]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api(`/admin/reconciliation-cases/${editing.id}`, {
        method: "PATCH",
        body: {
          version: editing.version,
          resolution,
          note: form.get("note"),
          ...(resolution === "verified_unpaid"
            ? { evidence_reference: form.get("evidence_reference") }
            : {}),
        },
      });
      setEditing(null);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <h2>Đối soát thanh toán</h2>
      <p className="muted">
        Kiểm tra các giao dịch cần xác minh. Kết quả thanh toán do hệ thống xác thực với cổng thanh
        toán.
      </p>
      <div className="admin-toolbar">
        <label>
          Trạng thái{" "}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="open">Chờ xử lý</option>
            <option value="resolved">Đã xử lý</option>
          </select>
        </label>
        <button className="button" onClick={() => load().catch((e) => setError(errorMessage(e)))}>
          Tải lại
        </button>
      </div>
      {!editing && error && <Notice error>{error}</Notice>}
      {!items ? (
        !error && <Loading />
      ) : !items.length ? (
        <Empty title="Không có giao dịch cần xử lý" />
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Đơn hàng</th>
                <th>Lý do</th>
                <th>Ghi nhận xử lý</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/admin/orders?q=${encodeURIComponent(item.order_code)}`}>
                      {item.order_code}
                    </Link>
                  </td>
                  <td>{reasons[item.reason] ?? "Cần kiểm tra giao dịch"}</td>
                  <td>{item.note ?? "Chưa có"}</td>
                  <td>
                    {item.status === "open" && (
                      <button
                        className="text-button"
                        onClick={() => {
                          setEditing(item);
                          setResolution("manual_review");
                          setError("");
                        }}
                      >
                        Xử lý
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pagination && pagination.last_page > 1 && (
        <div className="pagination">
          <button className="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Trước
          </button>
          <span>
            {page} / {pagination.last_page}
          </span>
          <button
            className="button"
            disabled={page === pagination.last_page}
            onClick={() => setPage(page + 1)}
          >
            Sau
          </button>
        </div>
      )}
      {editing && (
        <Modal
          title="Xử lý đối soát"
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          {error && <Notice error>{error}</Notice>}
          <form className="form-stack" onSubmit={save}>
            <fieldset disabled={busy}>
              <label>
                Kết quả
                <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                  <option value="manual_review">Ghi nhận đang kiểm tra</option>
                  <option value="verified_unpaid">Đã xác minh chưa thanh toán</option>
                </select>
              </label>
              <label>
                Nội dung xử lý
                <textarea
                  name="note"
                  required
                  minLength={5}
                  maxLength={2000}
                  defaultValue={editing.note ?? ""}
                />
              </label>
              {resolution === "verified_unpaid" && (
                <>
                  <label>
                    Mã tham chiếu bằng chứng
                    <input name="evidence_reference" required maxLength={255} />
                  </label>
                  <p className="muted">
                    Chỉ được đóng khi mọi giao dịch có kết quả cuối cùng chưa thanh toán đã xác thực
                    từ cổng.
                  </p>
                </>
              )}
              <button className="button primary" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu xử lý"}
              </button>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}
