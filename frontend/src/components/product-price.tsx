import type { Product } from "@/lib/types";
import { money } from "@/lib/format";
import { displayedDiscount } from "@/lib/pricing";

export function ProductPrice({ product }: { product: Product }) {
  const discounted = product.unit_price < product.list_price;
  const percent = displayedDiscount(product);
  return (
    <div className="product-pricing">
      <strong className="price">{money(product.unit_price)}</strong>
      {discounted && (
        <div className="list-price-row">
          <del>{money(product.list_price)}</del>
          <span className="discount-badge">{percent > 0 ? `- ${percent}%` : "Giảm giá"}</span>
        </div>
      )}
    </div>
  );
}
