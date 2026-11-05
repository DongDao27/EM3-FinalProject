import Image from "next/image";
import bounds from "@/lib/product-bounds.json";
import { imageSrc } from "@/lib/product-images";
import type { Product } from "@/lib/types";

export function ProductPicture({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const src = imageSrc(product.images[0].url);
  const crop = (bounds as Record<string, { viewBox: string; width: number; height: number }>)[src];
  if (crop)
    return (
      <svg
        className="product-picture"
        viewBox={crop.viewBox}
        role="img"
        aria-label={product.images[0].alt_text ?? product.name}
        preserveAspectRatio="xMidYMid meet"
      >
        <image href={src} width={crop.width} height={crop.height} />
      </svg>
    );
  return (
    <Image
      src={src}
      alt={product.images[0].alt_text ?? product.name}
      fill
      sizes="(max-width: 700px) 44vw, (max-width: 1100px) 30vw, 320px"
      style={{ objectFit: "contain" }}
      priority={priority}
    />
  );
}
