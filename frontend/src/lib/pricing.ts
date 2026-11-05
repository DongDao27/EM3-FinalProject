import type { Product } from "./types";

// Display/preview only. the API calculates the amount accepted at checkout.
export function displayedDiscount(
  product: Pick<Product, "discount_percent" | "list_price" | "unit_price">,
) {
  if (product.discount_percent !== undefined) return product.discount_percent;
  return product.list_price > 0
    ? Math.max(
        0,
        Math.round(((product.list_price - product.unit_price) * 100) / product.list_price),
      )
    : 0;
}

export function previewDiscountPrice(listPrice: number, percent: number) {
  return Math.floor((listPrice * (100 - percent) + 50) / 100);
}
