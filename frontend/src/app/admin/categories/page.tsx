"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import type { Category, Pagination } from "@/lib/types";
import { errorMessage } from "@/lib/format";
import { Empty, Loading, Modal, Notice } from "@/components/ui";
import { useStore } from "@/components/store-provider";

export default function CategoriesPage() {
  const { refreshCategories } = useStore();
  const [items, setItems] = useState<Category[] | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const load = useCallback(async () => {
    const r = await api<Category[]>(`/admin/categories?page=${page}&per_page=20`);
    setItems(r.data);
    setPagination(r.meta.pagination ?? null);
  }, [page]);
  useEffect(() => {
    load().catch((e) => setError(errorMessage(e)));
  }, [load]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api(
        editing && editing !== "new" ? `/admin/categories/${editing.id}` : "/admin/categories",
        {
          method: editing === "new" ? "POST" : "PATCH",
          body: {
            name: form.get("name"),
            slug: form.get("slug"),
            sort_order: Number(form.get("sort_order")),
            is_active: form.get("is_active") === "on",
          },
        },
      );
      setEditing(null);
      await Promise.all([load(), refreshCategories()]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const current = editing !== "new" ? editing : null;
  return (
    <>
      <div className="section-heading">
        <h2>Danh mục</h2>
        <button
          className="button primary"
          onClick={() => {
            setError("");
            setEditing("new");
          }}
        >
          + Thêm danh mục
        </button>
      </div>
      {!editing && error && <Notice error>{error}</Notice>}
      {!items ? (
        <Loading />
      ) : !items.length ? (
        <Empty title="Chưa có danh mục" />
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Danh mục</th>
                <th>Thứ tự</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <br />
                    <small>{item.slug}</small>
                  </td>
                  <td>{item.sort_order}</td>
                  <td>{item.is_active ? "Đang hiển thị" : "Đã ẩn"}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        setError("");
                        setEditing(item);
                      }}
                    >
                      Chỉnh sửa
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
          title={current ? "Chỉnh sửa danh mục" : "Thêm danh mục"}
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          {error && <Notice error>{error}</Notice>}
          <form className="form-stack" onSubmit={save}>
            <fieldset disabled={busy}>
              <label>
                Tên danh mục
                <input name="name" required maxLength={120} defaultValue={current?.name} />
              </label>
              <label>
                Slug
                <input
                  name="slug"
                  required
                  maxLength={120}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  readOnly={current?.slug === "sach-giao-khoa"}
                  defaultValue={current?.slug}
                />
              </label>
              <label>
                Thứ tự
                <input
                  name="sort_order"
                  type="number"
                  required
                  min={0}
                  max={65535}
                  defaultValue={current?.sort_order ?? 0}
                />
              </label>
              <label>
                <span>
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={current?.is_active ?? true}
                  />{" "}
                  Hiển thị danh mục
                </span>
              </label>
              <p className="muted">Ẩn danh mục sẽ ẩn các sản phẩm thuộc danh mục khỏi cửa hàng.</p>
              <button className="button primary" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu danh mục"}
              </button>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}
