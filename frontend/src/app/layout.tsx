import type { Metadata } from "next";
import localFont from "next/font/local";
import { StoreProvider } from "@/components/store-provider";
import { StoreShell } from "@/components/store-shell";
import "./globals.css";
import "./clicon.css";
import "./bookstore.css";
import "./styles/storefront.css";
import "./styles/experience.css";
import "./styles/bestseller.css";
import "./styles/payment-result.css";
import "./styles/brand-carousel.css";
import "./styles/mobile-density.css";
import "./styles/compact-header.css";
import "./styles/product-actions.css";
import "./styles/counter-payment.css";

const storeFont = localFont({
  src: "./fonts/nunito-sans-variable.woff2",
  variable: "--font-store",
  display: "swap",
  weight: "200 900",
  fallback: ["Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: "Thu Thanh — Nhà sách & văn phòng phẩm",
    template: "%s | Thu Thanh",
  },
  description:
    "Khám phá sách giáo khoa, văn học, truyện tranh và đồ dùng học tập tại nhà sách Thu Thanh.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={storeFont.variable} data-scroll-behavior="smooth">
      <body>
        <StoreProvider>
          <StoreShell>{children}</StoreShell>
        </StoreProvider>
      </body>
    </html>
  );
}
