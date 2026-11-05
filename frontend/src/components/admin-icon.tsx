import type { CSSProperties } from "react";

const paths = {
  overview: ["M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"],
  products: ["M4 5c3-2 5-2 8 0v16c-3-2-5-2-8 0zM12 5c3-2 5-2 8 0v16c-3-2-5-2-8 0"],
  categories: ["m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"],
  revenue: ["M3 3v18h18M7 16l4-5 4 2 5-8M16 5h4v4"],
  reconciliation: ["M5 7h14l-4-4M19 17H5l4 4M19 7v5M5 17v-5"],
  inventory: ["m3 8 9-5 9 5v12H3zM8 20v-8h8v8M3 8h18M10 15h4"],
  orders: ["M8 5H5v16h14V5h-3M8 3h8v4H8zM8 12h8M8 16h5"],
} as const;
export type AdminIconName = keyof typeof paths;
export function AdminIcon({ name, style }: { name: AdminIconName; style?: CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {paths[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
