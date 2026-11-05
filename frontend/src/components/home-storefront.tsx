"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Product } from "@/lib/types";
import { errorMessage } from "@/lib/format";
import { ProductCard } from "./product-card";
import { BestsellerShowcase } from "./bestseller-showcase";
import { FlameIcon } from "./flame-icon";
import { useStore } from "./store-provider";
import { publicStorefront } from "@/lib/public-storefront";
import { CampaignBanner } from "./campaign-banner";
import { Empty, Icon, Loading, Notice } from "./ui";

type Home = {
  recommended: Product[];
  bestseller: Product[];
  new: Product[];
};

export default function HomeStorefront() {
  const { user, authLoading } = useStore();
  const [home, setHome] = useState<Home | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (authLoading) return;
    const abort = new AbortController();
    setError("");
    async function load() {
      const result =
        user?.role === "customer"
          ? await api<Home>("/home", { signal: abort.signal })
          : await publicStorefront();
      if (!abort.signal.aborted) setHome(result.data);
    }
    load().catch((error) => {
      if (!abort.signal.aborted) setError(errorMessage(error));
    });
    return () => abort.abort();
  }, [retry, user?.id, user?.role, authLoading]);
  if (!home)
    return (
      <div className="container page-section">
        {error ? (
          <Notice error>
            {error}{" "}
            <button className="text-button" onClick={() => setRetry(retry + 1)}>
              Thử lại
            </button>
          </Notice>
        ) : (
          <Loading />
        )}
      </div>
    );
  return (
    <div className="container clicon-home">
      {error && <Notice error>{error}</Notice>}
      <section className="reference-hero" aria-label="Thế giới truyện tranh">
        <Image
          src="/banners/phuongnam-manga.png"
          alt="Thế giới manga và truyện tranh"
          width={1920}
          height={600}
          priority
          sizes="(max-width: 1400px) 96vw, 1320px"
        />
        <h1 className="sr-only">Nhà sách Thu Thanh — Sách và đồ dùng học tập</h1>
      </section>
      <section className="editorial-banners" aria-label="Sách dành cho bạn">
        <Link
          href="/products"
          className="editorial-banner reference-banner"
          aria-label="Xem danh mục sách mới"
        >
          <Image
            src="/banners/phuongnam-sach-moi.png"
            loading="eager"
            alt="Sách mới tháng này"
            width={900}
            height={506}
            sizes="(max-width: 760px) 94vw, 48vw"
          />
        </Link>
        <Link
          href="/products"
          className="editorial-banner reference-banner"
          aria-label="Xem bộ sưu tập sách"
        >
          <Image
            src="/banners/phuongnam-new-books.png"
            loading="eager"
            alt="Bộ sưu tập sách mới"
            width={900}
            height={506}
            sizes="(max-width: 760px) 94vw, 48vw"
          />
        </Link>
      </section>
      <Collection
        title="Bán chạy nhất"
        products={home.bestseller}
        href="/products?section=bestseller"
        emptyTitle="Chưa có sản phẩm trong mục Bán chạy nhất"
      />
      <CampaignBanner id="manga" />
      <Collection title="Sản phẩm mới" products={home.new} href="/products?sort=newest" />
      <CampaignBanner id="kids" />
      <Collection title="Gợi ý cho bạn" products={home.recommended} href="/products" recommended />
    </div>
  );
}
function SectionHeading({ title, href }: { title: string; href: string }) {
  const description = {
    "Bán chạy nhất": "Những cuốn sách và sản phẩm nổi bật tại Thu Thanh.",
    "Sản phẩm mới": "Vừa có mặt trên kệ sách Thu Thanh.",
    "Gợi ý cho bạn": "Thêm một lựa chọn cho lần đọc tiếp theo.",
  }[title];
  return (
    <div className="section-heading">
      <div className="collection-heading-copy">
        <h2 className={title === "Bán chạy nhất" ? "bestseller-title" : undefined}>
          {title === "Bán chạy nhất" && <FlameIcon />}
          {title}
        </h2>
        {description && <p>{description}</p>}
      </div>
      <Link href={href} className="collection-link">
        Xem tất cả <Icon name="arrow" size={18} />
      </Link>
    </div>
  );
}
function Collection({
  title,
  products,
  href,
  recommended = false,
  emptyTitle = "Chưa có sản phẩm",
}: {
  title: string;
  products: Product[];
  href: string;
  recommended?: boolean;
  emptyTitle?: string;
}) {
  return (
    <section className={`home-collection${recommended ? " recommendations" : ""}`}>
      <SectionHeading title={title} href={href} />
      {products.length ? (
        title === "Bán chạy nhất" ? (
          <BestsellerShowcase products={products} />
        ) : (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )
      ) : (
        <Empty title={emptyTitle}>
          <Link href="/products">Xem danh mục sản phẩm</Link>
        </Empty>
      )}
    </section>
  );
}
