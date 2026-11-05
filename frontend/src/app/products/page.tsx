"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import type { Pagination, Product } from "@/lib/types";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/components/store-provider";
import { ProductCard } from "@/components/product-card";
import { Empty, Loading, Notice } from "@/components/ui";

export default function ProductsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Catalog />
    </Suspense>
  );
}
function Catalog() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const { categories } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setSearch(params.get("q") ?? "");
    const safe = new URLSearchParams({ per_page: "12" });
    for (const key of ["q", "brand", "category_id", "grade", "section", "sort", "page"])
      if (params.get(key)) safe.set(key, params.get(key)!);
    api<Product[]>(`/products?${safe}`, { signal: abort.signal })
      .then((result) => {
        setProducts(result.data);
        setPagination(result.meta.pagination ?? null);
      })
      .catch((error) => {
        if (!abort.signal.aborted) setError(errorMessage(error));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
    // The serialized URL is the source of truth for search, filter, and pagination.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, retry]);
  function update(key: string, value: string) {
    const next = new URLSearchParams(query);
    next.delete("page");
    value ? next.set(key, value) : next.delete(key);
    router.push(`/products?${next}`);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    update("q", search.trim());
  }
  const category = categories.find((item) => String(item.id) === params.get("category_id"));
  return (
    <div className="container page-section">
      <div className="breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span>/</span>
        <span>
          {params.get("q")
            ? "Kết quả tìm kiếm"
            : (params.get("brand") ?? category?.name ?? "Tất cả sản phẩm")}
        </span>
      </div>
      <div className="page-heading">
        <div>
          <span className="eyebrow muted">KHÁM PHÁ THU THANH</span>
          <h1>
            {params.get("q")
              ? "Kết quả tìm kiếm"
              : (params.get("brand") ?? category?.name ?? "Tất cả sản phẩm")}
          </h1>
          <p className="muted">
            {params.get("q")
              ? `Kết quả cho “${params.get("q")}”`
              : "Tìm những điều bạn yêu thích, từ sách đến đồ dùng mỗi ngày."}
          </p>
        </div>
      </div>
      <div className="catalog-layout">
        <aside className="catalog-sidebar">
          <h2>Danh mục sản phẩm</h2>
          <button
            className={!category ? "active" : ""}
            onClick={() => {
              const next = new URLSearchParams(query);
              next.delete("category_id");
              next.delete("grade");
              next.delete("page");
              router.push(`/products?${next}`);
            }}
          >
            Tất cả sản phẩm
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              className={category?.id === item.id ? "active" : ""}
              onClick={() => {
                const next = new URLSearchParams(query);
                next.set("category_id", String(item.id));
                next.delete("grade");
                next.delete("page");
                router.push(`/products?${next}`);
              }}
            >
              {item.name}
            </button>
          ))}
          {category?.slug === "sach-giao-khoa" && (
            <label className="grade-filter">
              Chọn lớp
              <select
                value={params.get("grade") ?? ""}
                onChange={(event) => update("grade", event.target.value)}
              >
                <option value="">Tất cả các lớp</option>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index} value={index + 1}>
                    Lớp {index + 1}
                  </option>
                ))}
              </select>
            </label>
          )}
        </aside>
        <section className="catalog-main" aria-label="Danh sách sản phẩm">
          <div className="catalog-toolbar">
            <form className="catalog-search" onSubmit={submit}>
              <label className="sr-only" htmlFor="catalog-query">
                Tìm trong sản phẩm
              </label>
              <input
                id="catalog-query"
                value={search}
                placeholder="Tên sách, sản phẩm…"
                maxLength={100}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button className="button small">Tìm</button>
            </form>
            <label className="sort-label">
              Sắp xếp
              <select
                value={params.get("sort") ?? "newest"}
                onChange={(event) => update("sort", event.target.value)}
              >
                <option value="newest">Mới nhất</option>
                <option value="price_asc">Giá tăng dần</option>
                <option value="price_desc">Giá giảm dần</option>
              </select>
            </label>
          </div>
          {pagination && !loading && <p className="result-count">{pagination.total} sản phẩm</p>}
          {loading ? (
            <Loading />
          ) : error ? (
            <Notice error>
              {error}{" "}
              <button className="text-button" onClick={() => setRetry(retry + 1)}>
                Thử lại
              </button>
            </Notice>
          ) : products.length ? (
            <div className="product-grid catalog-grid">
              {products.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index < 2} />
              ))}
            </div>
          ) : (
            <Empty title="Chưa tìm thấy sản phẩm">
              <p>Thử một từ khóa khác hoặc bỏ bớt bộ lọc.</p>
              <Link href="/products" className="button">
                Xem tất cả
              </Link>
            </Empty>
          )}
          {pagination && pagination.last_page > 1 && !loading && (
            <nav className="pagination" aria-label="Trang sản phẩm">
              <button
                className="button small"
                disabled={pagination.page <= 1}
                onClick={() => {
                  const next = new URLSearchParams(query);
                  next.set("page", String(pagination.page - 1));
                  router.push(`/products?${next}`);
                }}
              >
                ← Trước
              </button>
              <span>
                Trang {pagination.page} / {pagination.last_page}
              </span>
              <button
                className="button small"
                disabled={pagination.page >= pagination.last_page}
                onClick={() => {
                  const next = new URLSearchParams(query);
                  next.set("page", String(pagination.page + 1));
                  router.push(`/products?${next}`);
                }}
              >
                Sau →
              </button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
