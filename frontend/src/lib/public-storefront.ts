import { api } from "./api-client";
import type { Category, Envelope, Product } from "./types";

export type PublicStorefront = {
  brands: { name: string; product_count: number }[];
  categories: Category[];
  new: Product[];
  bestseller: Product[];
  recommended: Product[];
};
let pending: Promise<Envelope<PublicStorefront>> | undefined;
// Coalesce simultaneous home/header reads; do not store any account or personalized data.
export function publicStorefront() {
  pending ??= api<PublicStorefront>("/storefront").finally(() => {
    pending = undefined;
  });
  return pending;
}
