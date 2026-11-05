"use client";

import Link from "next/link";
import Image from "next/image";
import { NewsletterForm } from "./newsletter-form";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { useStore } from "./store-provider";
import { Icon } from "./ui";
import { errorMessage } from "@/lib/format";
import { storeInfo } from "@/lib/store-info";
import { ProductSearch } from "./product-search";
import { ScrollToTop } from "./scroll-to-top";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Nhà sách Thu Thanh — Trang chủ">
      <Image
        src={`/brand/logo-${light ? "light" : "dark"}.svg`}
        alt="Nhà sách Thu Thanh"
        width={310}
        height={82}
        priority={light}
        loading="eager"
      />
    </Link>
  );
}
export function StoreShell({ children }: { children: ReactNode }) {
  const { user, cart, requireLogin, logout, notify } = useStore();
  const path = usePathname();
  const accountDetails = useDismissDetails();
  const adminArea = path.startsWith("/admin");
  const count = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  return (
    <>
      <a href="#main" className="skip-link">
        Đến nội dung chính
      </a>
      <header className={`site-header${adminArea ? " admin-site-header" : ""}`}>
        <div className="header-inner">
          <Brand light />
          {!adminArea && <CategoryMenu />}
          {!adminArea && <ProductSearch />}
          <div className="header-actions">
            {adminArea ? (
              <Link className="header-action" href="/">
                Về cửa hàng <Icon name="arrow" size={18} />
              </Link>
            ) : (
              <Link
                className="header-action cart-link"
                href="/cart"
                aria-label={`Giỏ hàng, ${count} sản phẩm`}
              >
                <Icon name="cart" />
                <span>Giỏ hàng</span>
                {count > 0 && <b className="cart-count">{count}</b>}
              </Link>
            )}
            {user ? (
              <details className="account-menu" ref={accountDetails}>
                <summary aria-label="Tài khoản">
                  <Icon name="user" />
                  <span>{user.name.split(" ").at(-1)}</span>
                </summary>
                <div className="dropdown">
                  <strong>{user.name}</strong>
                  <Link href="/account">Thông tin cá nhân</Link>
                  <Link href={user.role === "admin" ? "/admin" : "/orders"}>
                    {user.role === "admin" ? "Quản lý cửa hàng" : "Đơn hàng của tôi"}
                  </Link>
                  <button onClick={() => logout().catch((error) => notify(errorMessage(error)))}>
                    Đăng xuất
                  </button>
                </div>
              </details>
            ) : (
              <button className="header-action" aria-label="Tài khoản" onClick={requireLogin}>
                <Icon name="user" />
                <span>Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      {!adminArea && (
        <footer className="site-footer">
          <div className="container footer-grid">
            <div className="footer-brand">
              <Brand />
              <iframe
                className="footer-map"
                title="Bản đồ Nhà sách Thu Thanh tại 295 Tôn Đức Thắng, Đà Nẵng"
                src={storeInfo.mapEmbed}
                width={300}
                height={164}
                loading="lazy"
                referrerPolicy="no-referrer"
                allowFullScreen
              />
              <address>
                <a href={storeInfo.mapUrl} target="_blank" rel="noopener noreferrer">
                  {storeInfo.address} ↗
                </a>
              </address>
              <a className="footer-phone" href={storeInfo.phoneHref}>
                {storeInfo.phone}
              </a>
              <p className="footer-hours">{storeInfo.hours}</p>
            </div>
            <div className="footer-links">
              <h2>Dịch vụ &amp; hỗ trợ</h2>
              <Link href="/policies#terms">Điều khoản sử dụng</Link>
              <Link href="/policies#privacy">Bảo mật thông tin cá nhân</Link>
              <Link href="/policies#shipping">Chính sách vận chuyển</Link>
              <Link href="/policies#returns">Không đổi trả, hoàn tiền</Link>
            </div>
            <div className="footer-links">
              <h2>Tài khoản</h2>
              <Link href="/login">Đăng nhập</Link>
              <Link href="/register">Tạo tài khoản</Link>
              <Link href="/orders">Lịch sử mua hàng</Link>
              <Link href="/cart">Giỏ hàng của tôi</Link>
            </div>
            <NewsletterForm />
          </div>
          <div className="container copyright">© 2026 Nhà sách Thu Thanh</div>
          <ScrollToTop />
        </footer>
      )}
      {!adminArea && (
        <nav className="mobile-bottom-nav" aria-label="Điều hướng nhanh">
          <Link aria-current={path === "/" ? "page" : undefined} href="/">
            <Icon name="home" />
            Trang chủ
          </Link>
          <Link aria-current={path.startsWith("/products") ? "page" : undefined} href="/products">
            <Icon name="menu" />
            Danh mục
          </Link>
          <Link aria-current={path === "/cart" ? "page" : undefined} href="/cart">
            <Icon name="cart" />
            Giỏ hàng{count ? ` (${count})` : ""}
          </Link>
          {user ? (
            <Link href={user.role === "admin" ? "/admin" : "/orders"}>
              <Icon name="user" />
              Tài khoản
            </Link>
          ) : (
            <button onClick={requireLogin}>
              <Icon name="user" />
              Tài khoản
            </button>
          )}
        </nav>
      )}
    </>
  );
}

function CategoryMenu() {
  const { categories } = useStore();
  const details = useDismissDetails();
  return (
    <details className="category-menu" ref={details}>
      <summary aria-label="Tất cả danh mục">
        <Icon name="menu" />
        <span>Tất cả danh mục</span>
      </summary>
      <nav className="dropdown" aria-label="Danh sách danh mục">
        <Link
          href="/"
          onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
        >
          Trang chủ
        </Link>
        <Link
          href="/orders"
          onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
        >
          Đơn hàng
        </Link>
        <Link
          href="/products"
          onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
        >
          Tất cả sản phẩm
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/products?category_id=${category.id}`}
            onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
          >
            {category.name}
          </Link>
        ))}
      </nav>
    </details>
  );
}

function useDismissDetails() {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [path]);
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !ref.current?.contains(event.target))
        ref.current?.removeAttribute("open");
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !ref.current?.open) return;
      event.preventDefault();
      ref.current.removeAttribute("open");
      ref.current.querySelector("summary")?.focus();
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return ref;
}
