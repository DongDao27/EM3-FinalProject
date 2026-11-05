"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { api, ApiError } from "@/lib/api-client";
import type { Category, Pagination, Product } from "@/lib/types";
import { errorMessage, money } from "@/lib/format";
import { Empty, Loading, Modal, Notice } from "@/components/ui";
import { imageSrc } from "@/components/product-card";
import { ProductPricingFields } from "@/components/product-pricing-fields";

export default function AdminProducts() {
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    api<Category[]>("/admin/categories?per_page=100")
      .then((r) => setCategories(r.data))
      .catch((e) => setError(errorMessage(e)));
  }, []);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [data, setData] = useState<Product[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const ticket = ++generation.current;
    const result = await api<Product[]>(
      `/admin/products?${new URLSearchParams({ q: search, page: String(page), per_page: "12", ...(category ? { category_id: category } : {}), ...(status ? { is_active: status } : {}) })}`,
    );
    if (ticket !== generation.current) return;
    setData(result.data);
    setPagination(result.meta.pagination ?? null);
  }, [search, page, category, status]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    load().catch((error) => {
      if (active) setError(errorMessage(error));
    });
    return () => {
      active = false;
      generation.current++;
    };
  }, [load]);
  async function changeStatus(product: Product) {
    if (
      busyId !== null ||
      !window.confirm(
        product.is_active
          ? `Ngừng bán “${product.name}”? Sản phẩm và lịch sử đơn hàng vẫn được lưu.`
          : `Mở bán lại “${product.name}”?`,
      )
    )
      return;
    setBusyId(product.id);
    setError("");
    try {
      await api(`/admin/products/${product.id}`, {
        method: product.is_active ? "DELETE" : "PATCH",
        body: product.is_active
          ? { version: product.catalog_version }
          : { is_active: true, version: product.catalog_version },
      });
      await load();
    } catch (e) {
      setError(errorMessage(e));
      await load().catch(() => {});
    } finally {
      setBusyId(null);
    }
  }
  return (
    <>
      <h2>Sản phẩm</h2>
      <div className="admin-toolbar">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(q);
          }}
        >
          <input
            aria-label="Tìm sản phẩm quản lý"
            placeholder="Tìm theo tên sản phẩm…"
            value={q}
            maxLength={100}
            onChange={(event) => setQ(event.target.value)}
          />
          <button className="button">Tìm</button>
        </form>
        <select
          aria-label="Danh mục quản lý sản phẩm"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Trạng thái sản phẩm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Đang bán</option>
          <option value="false">Đã ngừng bán</option>
        </select>
        <button className="button primary" onClick={() => setEditing("new")}>
          + Thêm sản phẩm
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
      {!data ? (
        !error && <Loading />
      ) : !data.length ? (
        <Empty title="Chưa có sản phẩm" />
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Giá bán</th>
                <th>Danh mục</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                    <br />
                    <small className="muted">{product.sku}</small>
                  </td>
                  <td>{money(product.unit_price)}</td>
                  <td>{product.category.name}</td>
                  <td>{product.is_active ? "Đang bán" : "Đã ẩn"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="text-button" onClick={() => setEditing(product)}>
                        Chỉnh sửa / ảnh
                      </button>
                      <button
                        className="text-button danger-text"
                        disabled={busyId !== null}
                        onClick={() => changeStatus(product)}
                      >
                        {busyId === product.id
                          ? "Đang lưu…"
                          : product.is_active
                            ? "Xóa / ngừng bán"
                            : "Mở bán lại"}
                      </button>
                    </div>
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
        <ProductEditor
          categories={categories}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (product) => {
            setEditing(product);
            await load();
          }}
        />
      )}
    </>
  );
}

function ProductEditor({
  categories,
  initial,
  onClose,
  onSaved,
}: {
  categories: Category[];
  initial: Product | null;
  onClose: () => void;
  onSaved: (product: Product) => Promise<void>;
}) {
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function fieldError(name: string) {
    return (
      fields[name] && (
        <small id={`product-error-${name}`} className="error-text">
          {fields[name].join(" ")}
        </small>
      )
    );
  }
  function selectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    if (!next) {
      setFile(null);
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(next.type) ||
      next.size > 5 * 1024 * 1024
    ) {
      setError("Chọn ảnh JPEG, PNG hoặc WebP không quá 5 MiB.");
      event.target.value = "";
      setFile(null);
      return;
    }
    setFile(next);
    setError("");
    setFields({});
  }
  function imagePicker() {
    return (
      <div className="product-image-picker">
        <label>
          Ảnh sản phẩm (JPEG, PNG, WebP; tối đa 5 MiB)
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={selectImage}
          />
        </label>
        {preview && (
          <div className="image-selection">
            {/* Local file previews cannot use the server image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Ảnh sản phẩm đã chọn" width={96} height={128} />
            <span>{file?.name}</span>
            <button className="text-button" type="button" onClick={() => setFile(null)}>
              Bỏ ảnh đã chọn
            </button>
          </div>
        )}
        {fieldError("image")}
      </div>
    );
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    setFields({});
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      sku: form.get("sku"),
      category_id: Number(form.get("category_id")),
      list_price: Number(form.get("list_price")),
      ...(form.get("pricing_mode") === "percent"
        ? { discount_percent: Number(form.get("discount_percent")) }
        : {
            sale_price: form.get("sale_price") === "" ? null : Number(form.get("sale_price")),
          }),
      grade: form.get("grade") === "" ? null : Number(form.get("grade")),
      description: form.get("description"),
      is_active: form.get("is_active") === "on",
      is_hot: form.get("is_hot") === "on",
      is_bestseller: form.get("is_bestseller") === "on",
      ...(initial
        ? { version: initial.catalog_version }
        : { opening_stock: Number(form.get("opening_stock")) }),
    };
    let created = false;
    try {
      const result = await api<Product>(
        initial ? `/admin/products/${initial.id}` : "/admin/products",
        { method: initial ? "PATCH" : "POST", body },
      );
      created = !initial;
      await onSaved(result.data);
      if (created && file) {
        const upload = new FormData();
        upload.set("image", file);
        upload.set("alt_text", result.data.name);
        await api(`/admin/products/${result.data.id}/images`, {
          method: "POST",
          body: upload,
        });
        setFile(null);
        const fresh = await api<Product>(`/admin/products/${result.data.id}`);
        await onSaved(fresh.data);
      }
      setSuccess("Đã lưu sản phẩm.");
    } catch (error) {
      if (error instanceof ApiError) setFields(error.fields);
      setError(
        (created ? "Sản phẩm đã được tạo. Kiểm tra ảnh bên dưới và tải lại ảnh nếu cần. " : "") +
          errorMessage(error),
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function reloadProduct() {
    if (!initial) throw new Error("No product selected.");
    const result = await api<Product>(`/admin/products/${initial.id}`);
    await onSaved(result.data);
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!initial || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    setFields({});
    const form = event.currentTarget;
    try {
      if (!file) {
        setError("Vui lòng chọn ảnh trước khi tải lên.");
        return;
      }
      const body = new FormData(form);
      body.set("image", file);
      await api(`/admin/products/${initial.id}/images`, {
        method: "POST",
        body,
      });
      setFile(null);
      await reloadProduct();
      form.reset();
      setSuccess("Đã thêm ảnh.");
    } catch (error) {
      if (error instanceof ApiError) setFields(error.fields);
      setError(errorMessage(error));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function removeImage(id: number) {
    if (!initial || lock.current || !window.confirm("Xóa ảnh này khỏi sản phẩm?")) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`/admin/products/${initial.id}/images/${id}`, {
        method: "DELETE",
      });
      await reloadProduct();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <Modal
      title={initial ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {error && <Notice error>{error}</Notice>}
      {Object.keys(fields).length > 0 && (
        <div className="error-text" role="alert">
          {Object.entries(fields).map(([name, messages]) => (
            <p key={name}>
              {(
                {
                  name: "Tên sản phẩm",
                  sku: "Mã SKU",
                  grade: "Lớp",
                  list_price: "Giá niêm yết",
                  sale_price: "Giá bán",
                  discount_percent: "Giảm giá",
                  image: "Ảnh",
                  category_id: "Danh mục",
                  opening_stock: "Tồn ban đầu",
                } as Record<string, string>
              )[name] ?? name}
              : {messages.join(" ")}
            </p>
          ))}
        </div>
      )}
      {success && <Notice>{success}</Notice>}
      <form className="form-stack" key={initial?.id ?? "new"} onSubmit={save}>
        <fieldset disabled={busy}>
          <label>
            Tên sản phẩm
            <input
              name="name"
              required
              maxLength={255}
              defaultValue={initial?.name}
              aria-invalid={!!fields.name}
              aria-describedby={fields.name ? "product-error-name" : undefined}
            />
            {fieldError("name")}
          </label>
          <div className="form-grid">
            <label>
              SKU
              <input
                name="sku"
                required
                maxLength={100}
                defaultValue={initial?.sku}
                aria-invalid={!!fields.sku}
                aria-describedby={fields.sku ? "product-error-sku" : undefined}
              />
              {fieldError("sku")}
            </label>
          </div>
          <label>
            Danh mục
            <select
              aria-label="Danh mục"
              name="category_id"
              defaultValue={initial?.category.id ?? categories[0]?.id}
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <ProductPricingFields initial={initial} />
          <label>
            Lớp (chỉ sách giáo khoa)
            <input
              name="grade"
              type="number"
              min={1}
              max={12}
              defaultValue={initial?.grade ?? ""}
              aria-invalid={!!fields.grade}
              aria-describedby={fields.grade ? "product-error-grade" : undefined}
            />
            {fieldError("grade")}
          </label>
          {!initial && (
            <label>
              Tồn ban đầu
              <input name="opening_stock" type="number" min={0} max={2147483647} required />
            </label>
          )}
          <label>
            Mô tả
            <textarea
              aria-label="Mô tả"
              name="description"
              rows={4}
              maxLength={20000}
              defaultValue={initial?.description ?? ""}
            />
          </label>
          <label>
            <span>
              <input name="is_active" type="checkbox" defaultChecked={initial?.is_active ?? true} />{" "}
              Đang bán
            </span>
          </label>
          <label>
            <span>
              <input name="is_hot" type="checkbox" defaultChecked={initial?.is_hot} /> Sách đang hot
              (cửa hàng chọn)
            </span>
          </label>
          {!initial && imagePicker()}
          <label className="product-checkbox">
            <span>
              <input
                name="is_bestseller"
                type="checkbox"
                defaultChecked={initial?.is_bestseller ?? false}
              />{" "}
              Hiển thị trong Bán chạy nhất
            </span>
          </label>
          <button className="button primary full" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu sản phẩm"}
          </button>
        </fieldset>
      </form>
      {initial && (
        <section className="detail-panel" style={{ marginTop: 24 }}>
          <h3>Ảnh sản phẩm</h3>
          {initial.images.map((image) => (
            <div key={image.id} className="summary-row">
              <span className="admin-product-thumbnail">
                <Image
                  src={imageSrc(image.url)}
                  alt={image.alt_text ?? initial.name}
                  fill
                  sizes="60px"
                  style={{ objectFit: "contain" }}
                />
              </span>
              <button className="text-button" disabled={busy} onClick={() => removeImage(image.id)}>
                Xóa ảnh
              </button>
            </div>
          ))}
          <form className="form-stack" onSubmit={upload}>
            <fieldset disabled={busy}>
              {imagePicker()}
              <label>
                Mô tả ảnh
                <input name="alt_text" maxLength={255} defaultValue={initial.name} />
              </label>
              <button className="button" disabled={busy}>
                Tải ảnh lên
              </button>
            </fieldset>
          </form>
        </section>
      )}
    </Modal>
  );
}
