"use client";
import Link from "next/link";
import { RevenuePanel } from "@/components/revenue-panel";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { errorMessage, money, statusLabel } from "@/lib/format";
import type { Order } from "@/lib/types";
import { Empty, Loading, Notice } from "@/components/ui";
import { TimeSeriesChart } from "@/components/time-series-chart";
import { AdminIcon, type AdminIconName } from "@/components/admin-icon";

type Dashboard = {
  timezone: string;
  counts: {
    active_products: number;
    active_categories: number;
    orders_today: number;
    awaiting_processing: number;
  };
  daily_orders: { date: string; count: number }[];
  recent_orders: Order[];
};
export default function AdminPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setError("");
    api<Dashboard>("/admin/dashboard", { signal: abort.signal })
      .then((r) => setData(r.data))
      .catch((e) => {
        if (!abort.signal.aborted) setError(errorMessage(e));
      });
    return () => abort.abort();
  }, [revision]);
  if (error)
    return (
      <Notice error>
        {error}{" "}
        <button className="text-button" onClick={() => setRevision(revision + 1)}>
          Thử lại
        </button>
      </Notice>
    );
  if (!data) return <Loading />;
  const stats = [
    ["Sản phẩm đang bán", data.counts.active_products, "/admin/products", "products"],
    ["Danh mục đang bán", data.counts.active_categories, "/admin/categories", "categories"],
    ["Đơn hàng hôm nay", data.counts.orders_today, "/admin/orders", "orders"],
    ["Chờ xử lý", data.counts.awaiting_processing, "/admin/orders", "reconciliation"],
  ] as const;
  return (
    <>
      <h2>Tổng quan nhà sách</h2>
      <p className="muted dashboard-subtitle">Hoạt động đơn hàng và danh mục sản phẩm</p>
      <div className="dashboard-stats">
        {stats.map(([label, value, href, icon]) => (
          <Link key={label} href={href} className="dashboard-stat">
            <span className={`stat-icon stat-icon-${icon}`}>
              <AdminIcon name={icon as AdminIconName} />
            </span>
            <span>{label}</span>
            <strong>{value.toLocaleString("vi-VN")}</strong>
          </Link>
        ))}
      </div>
      <RevenuePanel compact />
      <TimeSeriesChart
        title="Đơn hàng trong 7 ngày"
        points={data.daily_orders.map((day) => ({
          date: day.date,
          value: day.count,
        }))}
        kind="bars"
      />
      <p className="muted">
        Số đơn tạo theo ngày, bao gồm tất cả trạng thái. Thời gian theo giờ Việt Nam.
      </p>
      <section className="dashboard-recent">
        <h3>Đơn hàng gần đây</h3>
        {data.recent_orders.length ? (
          <div className="table-wrap" role="region" aria-label="Đơn hàng gần đây" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Cách nhận</th>
                  <th>Thanh toán</th>
                  <th>Tổng tiền đơn</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.map((order) => (
                  <tr key={order.order_code}>
                    <td>
                      <Link
                        className="text-button"
                        href={`/admin/orders?q=${encodeURIComponent(order.order_code)}`}
                      >
                        {order.order_code}
                      </Link>
                    </td>
                    <td>
                      {order.fulfillment_method === "pickup" ? "Nhận tại cửa hàng" : "Giao tận nhà"}
                    </td>
                    <td>{statusLabel[order.payment_status] ?? order.payment_status}</td>
                    <td>{money(order.totals.payable_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Chưa có đơn hàng">
            <p>Các đơn mới sẽ xuất hiện tại đây.</p>
          </Empty>
        )}
        <Link href="/admin/orders" className="collection-link">
          Quản lý đơn hàng →
        </Link>
      </section>
    </>
  );
}
