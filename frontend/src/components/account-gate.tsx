"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { useStore } from "./store-provider";
import { Empty, Loading } from "./ui";

export function AccountGate({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, authLoading, requireLogin } = useStore();
  if (authLoading) return <Loading />;
  if (!user)
    return (
      <div className="container page-section">
        <Empty title={admin ? "Đăng nhập quản trị" : "Đăng nhập để tiếp tục"}>
          <p>
            {admin
              ? "Dùng tài khoản quản trị đã được cấp để quản lý sản phẩm, đơn hàng và doanh thu."
              : "Xem giỏ hàng và quản lý những đơn hàng của bạn."}
          </p>
          <button className="button primary" onClick={requireLogin}>
            Đăng nhập
          </button>
        </Empty>
      </div>
    );
  if (admin !== (user.role === "admin"))
    return (
      <div className="container page-section">
        <Empty title={admin ? "Bạn không có quyền truy cập" : "Đây là khu vực mua hàng của khách"}>
          <Link href={user.role === "admin" ? "/admin" : "/"} className="button">
            {user.role === "admin" ? "Về quản lý cửa hàng" : "Về trang chủ"}
          </Link>
        </Empty>
      </div>
    );
  return children;
}
