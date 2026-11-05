"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountGate } from "@/components/account-gate";
import { AdminIcon, type AdminIconName } from "@/components/admin-icon";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <AccountGate admin>
      <div className="container page-section">
        <div className="breadcrumb">
          <Link href="/">Trang chủ</Link>
          <span>/</span>Quản trị
        </div>
        <div className="page-heading">
          <div>
            <h1>Quản lý cửa hàng</h1>
          </div>
        </div>
        <div className="admin-workspace">
          <nav className="admin-nav" aria-label="Quản lý cửa hàng">
            {(
              [
                ["/admin", "Tổng quan", "overview"],
                ["/admin/products", "Sản phẩm", "products"],
                ["/admin/categories", "Danh mục", "categories"],
                ["/admin/revenue", "Doanh thu", "revenue"],
                ["/admin/reconciliation", "Đối soát", "reconciliation"],
                ["/admin/inventory", "Tồn kho", "inventory"],
                ["/admin/orders", "Đơn hàng", "orders"],
              ] satisfies [string, string, AdminIconName][]
            ).map(([href, label, icon]) => (
              <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
                <AdminIcon name={icon} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="admin-content">{children}</div>
        </div>
      </div>
    </AccountGate>
  );
}
