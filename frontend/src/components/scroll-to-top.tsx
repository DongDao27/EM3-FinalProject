"use client";

import { useEffect, useState } from "react";
import { Icon } from "./ui";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const [docked, setDocked] = useState(false);
  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      setVisible(window.scrollY > Math.max(400, window.innerHeight * 0.75));
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    const footer = document.querySelector(".site-footer");
    const observer = new IntersectionObserver(([entry]) => {
      setDocked(entry.isIntersecting);
    });
    if (footer) observer.observe(footer);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  if (!visible) return null;
  return (
    <button
      type="button"
      className={`scroll-to-top${docked ? " is-docked" : ""}`}
      aria-label="Lên đầu trang"
      title="Lên đầu trang"
      onClick={() => {
        document.getElementById("main")?.focus({ preventScroll: true });
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
      }}
    >
      <Icon name="arrow" size={24} />
    </button>
  );
}
