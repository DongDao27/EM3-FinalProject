"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "./store-provider";
import { Loading } from "./ui";

export function AuthLanding({ register = false }: { register?: boolean }) {
  const { user, authLoading, requireLogin, requireRegistration } = useStore();
  const router = useRouter();
  const open = register ? requireRegistration : requireLogin;
  useEffect(() => {
    if (authLoading) return;
    if (user) router.replace(user.role === "admin" ? "/admin" : "/orders");
    else open();
  }, [authLoading, user, open, router]);
  if (authLoading) return <Loading />;
  return (
    <section className="container empty-state">
      <h1>{register ? "Tạo tài khoản" : "Đăng nhập"}</h1>
      <p>
        Đăng nhập để mua sắm và theo dõi đơn hàng. Tài khoản quản trị được chuyển đến trang quản lý
        nhà sách.
      </p>
      <button className="button primary" onClick={open}>
        {register ? "Mở form đăng ký" : "Mở form đăng nhập"}
      </button>
    </section>
  );
}
