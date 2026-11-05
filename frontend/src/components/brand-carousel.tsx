"use client";
import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import logos from "@/lib/brands.json";
import { useStore } from "./store-provider";

export function BrandCarousel() {
  const { brands } = useStore();
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  function measure() {
    const el = track.current;
    if (el)
      setEdges({
        start: el.scrollLeft < 2,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      });
  }
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);
  function move(direction: number) {
    const el = track.current;
    if (el) {
      const tile = el.querySelector<HTMLElement>(".brand-tile");
      const step =
        (tile?.getBoundingClientRect().width ?? el.clientWidth) +
        parseFloat(getComputedStyle(el).columnGap || "0");
      const count = Math.max(1, Math.round(el.clientWidth / step));
      el.scrollBy({
        left: direction * step * count,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    }
  }
  return (
    <section className="partners-section" aria-labelledby="partners-heading">
      <div className="container">
        <h2 id="partners-heading">Đối tác</h2>
        <div className="footer-brands brand-carousel">
          <button
            type="button"
            className="brand-arrow"
            disabled={edges.start}
            onClick={() => move(-1)}
            aria-label="Thương hiệu trước"
            aria-controls="footer-brand-track"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m14 6-6 6 6 6"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div
            className="brand-track"
            id="footer-brand-track"
            ref={track}
            onScroll={measure}
            tabIndex={0}
            role="group"
            aria-label="Logo các thương hiệu"
          >
            {logos.map((logo, index) => {
              const brand = brands.find(
                (item) =>
                  item.name.toLocaleLowerCase("vi-VN") === logo.name.toLocaleLowerCase("vi-VN"),
              );
              const picture = (
                <Image
                  src={logo.src}
                  alt={logo.name}
                  width={logo.width}
                  height={logo.height}
                  sizes="(max-width: 600px) 40vw, 220px"
                  loading={index < 5 ? "eager" : "lazy"}
                />
              );
              return brand ? (
                <Link
                  href={`/products?${new URLSearchParams({ brand: brand.name })}`}
                  className="brand-tile"
                  key={logo.name}
                  aria-label={`Xem sản phẩm ${brand.name}`}
                >
                  {picture}
                </Link>
              ) : (
                <div className="brand-tile" key={logo.name}>
                  {picture}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="brand-arrow"
            disabled={edges.end}
            onClick={() => move(1)}
            aria-label="Thương hiệu tiếp theo"
            aria-controls="footer-brand-track"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m10 6 6 6-6 6"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
