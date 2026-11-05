"use client";
import { useEffect, useId, useRef, useState } from "react";
import { money } from "@/lib/format";

type Point = { date: string; value: number };
export function TimeSeriesChart({
  title,
  points,
  currency = false,
  kind = "area",
  period = "day",
}: {
  title: string;
  points: Point[];
  currency?: boolean;
  kind?: "area" | "bars";
  period?: string | null;
}) {
  const gradient = useId().replaceAll(":", "");
  const svg = useRef<SVGSVGElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setAvailableWidth(Math.floor(entry.contentRect.width)),
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const [selected, setSelected] = useState<number | null>(null);
  const index = Math.min(
    selected ?? Math.max(0, points.length - 1),
    Math.max(0, points.length - 1),
  );
  const active = points[index];
  const format = (value: number) =>
    currency ? money(value) : `${value.toLocaleString("vi-VN")} đơn`;
  const actualMax = Math.max(0, ...points.map((p) => p.value));
  const unit = 10 ** Math.floor(Math.log10(Math.max(1, actualMax)));
  const max = actualMax ? Math.ceil(actualMax / unit) * unit : 1;
  const left = 68,
    top = 18,
    plotHeight = 190,
    bottom = top + plotHeight;
  const width = Math.max(600, availableWidth, points.length * 24 + left + 24);
  const plotWidth = width - left - 24;
  const step = plotWidth / Math.max(1, points.length);
  const x = (i: number) => left + step * (i + 0.5);
  const y = (value: number) => bottom - (value / max) * plotHeight;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const label = (date: string) =>
    new Intl.DateTimeFormat(
      "vi-VN",
      period === "month"
        ? { month: "2-digit", year: "numeric" }
        : { day: "2-digit", month: "2-digit" },
    ).format(new Date(date + "T00:00:00Z"));
  return (
    <figure className="analytics-chart">
      <figcaption>
        <div>
          <span className="chart-eyebrow">
            {currency ? "DOANH THU ĐÃ XÁC NHẬN" : "HOẠT ĐỘNG ĐẶT HÀNG"}
          </span>
          <h3>{title}</h3>
        </div>
        <span className="chart-legend">
          <i />
          {currency ? "Tiền hàng sau giảm giá" : "Số đơn tạo"}
        </span>
      </figcaption>
      <div
        ref={container}
        className="chart-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${title}. Có thể cuộn ngang; dùng Tab vào điểm dữ liệu và phím mũi tên để di chuyển.`}
      >
        <svg
          ref={svg}
          viewBox={`0 0 ${width} 245`}
          style={{ width, minWidth: "100%" }}
          height="245"
          role="group"
          aria-label={title}
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5478ed" stopOpacity=".25" />
              <stop offset="100%" stopColor="#5478ed" stopOpacity=".02" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((i) => {
            const value = (max * i) / 4;
            return (
              <g key={i} aria-hidden="true">
                <line
                  x1={left}
                  x2={width - 24}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#e5ebf4"
                  strokeDasharray={i ? "4 5" : undefined}
                />
                <text x={left - 10} y={y(value) + 4} textAnchor="end" className="chart-axis-label">
                  {currency
                    ? new Intl.NumberFormat("vi-VN", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(value)
                    : Number.isInteger(value)
                      ? value
                      : ""}
                </text>
              </g>
            );
          })}
          {currency && (
            <text x={left - 10} y="10" textAnchor="end" className="chart-axis-label">
              VND
            </text>
          )}
          {kind === "area" && points.length > 0 && (
            <>
              <path
                d={`${path} L${x(points.length - 1)},${bottom} L${x(0)},${bottom} Z`}
                fill={`url(#${gradient})`}
                aria-hidden="true"
              />
              <path
                d={path}
                fill="none"
                stroke="#3559d9"
                strokeWidth="2.5"
                strokeLinejoin="round"
                aria-hidden="true"
              />
            </>
          )}
          {points.map((point, i) => (
            <g
              key={point.date}
              data-index={i}
              tabIndex={i === index ? 0 : -1}
              role="button"
              aria-label={`${label(point.date)}: ${format(point.value)}`}
              onFocus={() => setSelected(i)}
              onMouseEnter={() => setSelected(i)}
              onClick={() => setSelected(i)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? points.length - 1
                      : Math.max(
                          0,
                          Math.min(points.length - 1, i + (event.key === "ArrowRight" ? 1 : -1)),
                        );
                setSelected(next);
                (
                  svg.current?.querySelector(`[data-index="${next}"]`) as SVGElement | null
                )?.focus();
              }}
              className="chart-point"
            >
              <rect
                x={x(i) - step / 2}
                y={top}
                width={step}
                height={plotHeight + 30}
                fill="transparent"
              />
              {kind === "bars" ? (
                <rect
                  x={x(i) - Math.min(15, step * 0.3)}
                  y={y(point.value)}
                  width={Math.min(30, step * 0.6)}
                  height={bottom - y(point.value)}
                  rx="5"
                  fill={i === index ? "#2348bf" : "#8aabf3"}
                  aria-hidden="true"
                />
              ) : (
                <circle
                  cx={x(i)}
                  cy={y(point.value)}
                  r={i === index ? 5 : 3}
                  fill={i === index ? "#2348bf" : "white"}
                  stroke="#3559d9"
                  strokeWidth="2"
                  aria-hidden="true"
                />
              )}
              {i === index && (
                <line
                  x1={x(i)}
                  x2={x(i)}
                  y1={top}
                  y2={bottom}
                  stroke="#3559d9"
                  strokeDasharray="3 4"
                  opacity=".4"
                  aria-hidden="true"
                />
              )}
              {(i === 0 ||
                i === points.length - 1 ||
                points.length < 16 ||
                i % Math.ceil(points.length / 10) === 0) && (
                <text
                  x={x(i)}
                  y={bottom + 25}
                  textAnchor="middle"
                  className="chart-axis-label"
                  aria-hidden="true"
                >
                  {label(point.date)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <p className="chart-scroll-note">Trên màn hình nhỏ, vuốt ngang để xem đầy đủ các kỳ.</p>
      <div className="chart-reading" aria-live="polite">
        <span>{active ? `Kỳ bắt đầu ${label(active.date)}` : "Chưa có dữ liệu"}</span>
        <strong>{active ? format(active.value) : "—"}</strong>
        <small>Chạm hoặc di chuyển qua biểu đồ để xem từng kỳ.</small>
      </div>
      {actualMax === 0 && (
        <p className="empty-chart">
          {currency
            ? "Chưa có doanh thu từ đơn đã thanh toán trong khoảng thời gian này."
            : "Chưa phát sinh đơn hàng trong khoảng thời gian này."}
        </p>
      )}
    </figure>
  );
}
