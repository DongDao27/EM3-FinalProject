"use client";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { money } from "@/lib/format";
import { displayedDiscount, previewDiscountPrice } from "@/lib/pricing";

export function ProductPricingFields({ initial }: { initial: Product | null }) {
  const [mode, setMode] = useState("price");
  const [list, setList] = useState(initial?.list_price.toString() ?? "");
  const [sale, setSale] = useState(initial?.sale_price?.toString() ?? "");
  const [percent, setPercent] = useState(initial ? displayedDiscount(initial).toString() : "0");
  const calculated =
    mode === "percent"
      ? previewDiscountPrice(Number(list), Number(percent))
      : sale === ""
        ? Number(list)
        : Number(sale);
  return (
    <>
      <label>
        Giá bìa / giá niêm yết
        <input
          name="list_price"
          type="number"
          required
          min={0}
          max={1000000000}
          step={1}
          value={list}
          onChange={(e) => setList(e.target.value)}
        />
      </label>
      <label>
        Cách nhập giá giảm
        <select
          aria-label="Cách nhập giá giảm"
          name="pricing_mode"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="price">Nhập giá bán</option>
          <option value="percent">Nhập phần trăm giảm giá</option>
        </select>
      </label>
      {mode === "percent" ? (
        <label>
          Phần trăm giảm giá (%)
          <input
            name="discount_percent"
            type="number"
            required
            min={0}
            max={100}
            step={1}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
          />
        </label>
      ) : (
        <label>
          Giá bán giảm (nếu có)
          <input
            name="sale_price"
            type="number"
            min={0}
            max={Number(list) || 1000000000}
            step={1}
            value={sale}
            onChange={(e) => setSale(e.target.value)}
          />
        </label>
      )}
      <output className="pricing-preview" aria-live="polite">
        Giá bán:{" "}
        <strong>{Number.isFinite(calculated) && calculated >= 0 ? money(calculated) : "—"}</strong>
      </output>
    </>
  );
}
