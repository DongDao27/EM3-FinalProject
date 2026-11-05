"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { errorMessage, money } from "@/lib/format";
import { Loading, Notice } from "./ui";
import { TimeSeriesChart } from "./time-series-chart";

type Amounts = {
  accepted_sales: number;
  shipping_collected: number;
  unallocated_receipts: number;
  net_sales: number;
  merchandise_refunds: number;
  shipping_refunds: number;
  unallocated_refunds: number;
};
type Report = {
  from: string;
  to: string;
  timezone: string;
  totals: Amounts;
  series: (Amounts & { period: string })[];
};
const dateKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
function nextDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function RevenuePanel({ compact = false }: { compact?: boolean }) {
  const today = dateKey(new Date());
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [granularity, setGranularity] = useState("day");
  const [query, setQuery] = useState(() =>
    new URLSearchParams({ from, to: nextDay(to), granularity }).toString(),
  );
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setData(null);
    setError("");
    api<Report>(`/admin/revenue?${query}`, { signal: abort.signal })
      .then((r) => setData(r.data))
      .catch((e) => {
        if (!abort.signal.aborted) setError(errorMessage(e));
      });
    return () => abort.abort();
  }, [query, revision]);
  const grouping = new URLSearchParams(query).get("granularity");
  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Kỳ bắt đầu", "Doanh thu tiền hàng", "Phí giao hàng", "Tiền cần đối soát"].join(","),
      ...data.series.map((row) =>
        [row.period, row.accepted_sales, row.shipping_collected, row.unallocated_receipts].join(
          ",",
        ),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + rows.join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `thu-thanh-doanh-thu-${data.from}-${data.to}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="revenue-panel">
      <div className="section-heading">
        <h2>Doanh thu {compact ? "tháng này" : "bán hàng"}</h2>
        {compact && (
          <Link className="collection-link" href="/admin/revenue">
            Xem báo cáo →
          </Link>
        )}
      </div>
      {!compact && (
        <div className="revenue-presets" aria-label="Khoảng thời gian nhanh">
          {[7, 30, 90].map((days) => {
            const start = new Date(`${today}T00:00:00Z`);
            start.setUTCDate(start.getUTCDate() - days + 1);
            const startKey = start.toISOString().slice(0, 10);
            return (
              <button
                key={days}
                type="button"
                aria-pressed={
                  new URLSearchParams(query).get("from") === startKey &&
                  new URLSearchParams(query).get("to") === nextDay(today)
                }
                onClick={() => {
                  setFrom(startKey);
                  setTo(today);
                  setGranularity(days === 90 ? "week" : "day");
                  setQuery(
                    new URLSearchParams({
                      from: startKey,
                      to: nextDay(today),
                      granularity: days === 90 ? "week" : "day",
                    }).toString(),
                  );
                  setRevision((n) => n + 1);
                }}
              >
                {days} ngày qua
              </button>
            );
          })}
        </div>
      )}
      {!compact && (
        <form
          className="admin-toolbar revenue-filters"
          onSubmit={(event) => {
            event.preventDefault();
            if (from > to) {
              setError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
              return;
            }
            setQuery(
              new URLSearchParams({
                from,
                to: nextDay(to),
                granularity,
              }).toString(),
            );
            setRevision((n) => n + 1);
          }}
        >
          <label>
            Từ ngày
            <input
              type="date"
              required
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              required
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label>
            Nhóm theo
            <select
              aria-label="Nhóm theo"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value)}
            >
              <option value="day">Ngày</option>
              <option value="week">Tuần</option>
              <option value="month">Tháng</option>
            </select>
          </label>
          <button className="button primary">Xem báo cáo</button>
          <button className="button" type="button" disabled={!data} onClick={exportCsv}>
            Xuất CSV
          </button>
        </form>
      )}
      {!compact && (
        <p className="muted">
          Tiền hàng sau giảm giá của đơn đã xác nhận thanh toán. Phí giao hàng thống kê riêng. Thời
          gian theo giờ Việt Nam.
        </p>
      )}
      {error && (
        <Notice error>
          {error}{" "}
          <button className="text-button" onClick={() => setRevision((n) => n + 1)}>
            Thử lại
          </button>
        </Notice>
      )}
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="dashboard-stats revenue-stats">
            <div className="dashboard-stat">
              <span>Doanh thu tiền hàng</span>
              <strong>{money(data.totals.accepted_sales)}</strong>
            </div>
            <div className="dashboard-stat">
              <span>Phí giao hàng đã thu</span>
              <strong>{money(data.totals.shipping_collected)}</strong>
            </div>
            <div className="dashboard-stat">
              <span>Tiền cần đối soát</span>
              <strong>{money(data.totals.unallocated_receipts)}</strong>
            </div>
          </div>
          {!compact && (
            <TimeSeriesChart
              title={`Doanh thu theo ${grouping === "week" ? "tuần" : grouping === "month" ? "tháng" : "ngày"}`}
              points={data.series.map((row) => ({
                date: row.period,
                value: row.accepted_sales,
              }))}
              currency
              period={grouping}
            />
          )}
          {!compact && (
            <div className="data-table-wrap">
              <table>
                <caption>Chi tiết theo kỳ</caption>
                <thead>
                  <tr>
                    <th>Kỳ bắt đầu</th>
                    <th>Doanh thu tiền hàng</th>
                    <th>Phí giao hàng</th>
                    <th>Tiền cần đối soát</th>
                  </tr>
                </thead>
                <tbody>
                  {data.series.map((row) => (
                    <tr key={row.period}>
                      <td>{row.period.split("-").reverse().join("/")}</td>
                      <td>{money(row.accepted_sales)}</td>
                      <td>{money(row.shipping_collected)}</td>
                      <td>{money(row.unallocated_receipts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
