"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { Product } from "@/lib/types";
import { money } from "@/lib/format";
import { ProductPicture } from "./product-picture";
import { useStore } from "./store-provider";
import { Icon } from "./ui";

export function ProductSearch() {
  const router = useRouter();
  const { openProduct } = useStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [results, setResults] = useState<Product[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const term = query.trim();
  const visible = open && !!term;

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    setState("loading");
    setResults([]);
    setActive(-1);
    const timer = window.setTimeout(async () => {
      try {
        const response = await api<Product[]>(
          `/products?${new URLSearchParams({ q: term, per_page: "6" })}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setResults(response.data);
          setState("ready");
        }
      } catch {
        if (!controller.signal.aborted) setState("error");
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term, visible, retry]);

  useEffect(() => {
    if (visible && active >= 0 && results[active]) {
      document
        .getElementById(`search-product-${results[active].id}`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [active, visible, results]);

  function choose(product: Product) {
    setOpen(false);
    setActive(-1);
    input.current?.focus();
    openProduct(product);
  }
  function showAll(event?: FormEvent) {
    event?.preventDefault();
    if (visible && active >= 0 && results[active]) {
      choose(results[active]);
      return;
    }
    setOpen(false);
    router.push(`/products?${new URLSearchParams({ q: term })}`);
  }
  return (
    <form
      role="search"
      className="header-search"
      onSubmit={showAll}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label className="sr-only" htmlFor="site-search">
        Tìm sản phẩm
      </label>
      <input
        ref={input}
        id="site-search"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={visible ? "search-suggestions" : undefined}
        aria-activedescendant={
          visible && active >= 0 ? `search-product-${results[active]?.id}` : undefined
        }
        placeholder="Tìm sách, đồ dùng học tập…"
        maxLength={100}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && visible) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            setActive(-1);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            if (results.length)
              setActive((index) =>
                event.key === "ArrowDown"
                  ? (index + 1) % results.length
                  : (index <= 0 ? results.length : index) - 1,
              );
          }
        }}
      />
      <button type="submit" className="search-submit" aria-label="Tìm kiếm">
        <Icon name="search" size={20} />
      </button>
      {visible && (
        <div className="search-dropdown">
          <p className="search-feedback" role="status">
            {state === "loading"
              ? "Đang tìm sản phẩm…"
              : state === "error"
                ? "Chưa tải được gợi ý. Vui lòng thử lại."
                : results.length
                  ? "Sản phẩm gợi ý — chọn để xem thông tin"
                  : "Chưa tìm thấy sản phẩm. Thử tên sách ngắn hơn hoặc từ khóa khác."}
          </p>
          <div
            id="search-suggestions"
            role="listbox"
            aria-label="Sản phẩm gợi ý"
            aria-busy={state === "loading"}
          >
            {results.map((product, index) => (
              <button
                type="button"
                role="option"
                id={`search-product-${product.id}`}
                key={product.id}
                aria-selected={active === index}
                className="search-option"
                onClick={() => choose(product)}
              >
                <span className="search-thumbnail">
                  {product.images[0] ? <ProductPicture product={product} /> : <Icon name="book" />}
                </span>
                <span className="search-product-info">
                  <strong>{product.name}</strong>
                  <small>{product.category.name}</small>
                  <b>{money(product.unit_price)}</b>
                  {product.available_quantity <= 0 && <small>Tạm hết hàng</small>}
                </span>
              </button>
            ))}
          </div>
          {state === "error" ? (
            <button className="search-more" type="button" onClick={() => setRetry(retry + 1)}>
              Thử lại
            </button>
          ) : (
            state === "ready" &&
            results.length > 0 && (
              <button
                className="search-more"
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`/products?${new URLSearchParams({ q: term })}`);
                }}
              >
                Xem tất cả kết quả cho “{term}” <span aria-hidden="true">→</span>
              </button>
            )
          )}
        </div>
      )}
    </form>
  );
}
