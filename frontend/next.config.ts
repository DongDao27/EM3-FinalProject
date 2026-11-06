import type { NextConfig } from "next";
import path from "node:path";

const backend = new URL(process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8001");
if (
  !["http:", "https:"].includes(backend.protocol) ||
  backend.username ||
  backend.password ||
  backend.pathname !== "/" ||
  backend.search ||
  backend.hash
) {
  throw new Error(
    "BACKEND_INTERNAL_URL must be a server-configured HTTP(S) origin without credentials or path.",
  );
}

const config: NextConfig = {
  experimental: { mcpServer: false },
  turbopack: { root: process.env.EM3_WORKSPACE_ROOT ?? path.resolve(process.cwd(), "..") },
  outputFileTracingRoot: process.env.EM3_WORKSPACE_ROOT ?? path.resolve(process.cwd(), ".."),
  images: { minimumCacheTTL: 86400 },
  async headers() {
    return [
      {
        source: "/reset-password",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/forgot-password",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/payment/vnpay-return",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      ...["/catalog-hd/:path*", "/brands/:path*", "/brand/:path*", "/banners/:path*"].map(
        (source) => ({
          source,
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=86400, stale-while-revalidate=604800",
            },
          ],
        }),
      ),
    ];
  },
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend.origin}/api/v1/:path*`,
      },
      {
        source: "/sanctum/csrf-cookie",
        destination: `${backend.origin}/sanctum/csrf-cookie`,
      },
      {
        source: "/storage/:path*",
        destination: `${backend.origin}/storage/:path*`,
      },
    ];
  },
};
export default config;
