export type Pagination = {
  page: number;
  last_page: number;
  per_page: number;
  total: number;
};
export type Meta = {
  server_time: string;
  request_id: string;
  pagination?: Pagination;
  replayed?: boolean;
};
export type Envelope<T> = { data: T; meta: Meta };
export type User = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: "admin" | "customer";
};
export type Category = {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
};
export type ProductImage = {
  id: number;
  url: string;
  alt_text: string | null;
  sort_order: number;
};
export type Product = {
  id: number;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  category: Category;
  grade: number | null;
  list_price: number;
  sale_price: number | null;
  unit_price: number;
  discount_percent?: number;
  available_quantity: number;
  is_active: boolean;
  catalog_version: number;
  is_hot: boolean;
  is_bestseller: boolean;
  sold_count?: number;
  images: ProductImage[];
};
export type CartItem = {
  id: number;
  product: Product;
  quantity: number;
  line_total: number;
  is_available: boolean;
};
export type Cart = {
  id: number;
  items: CartItem[];
  estimated_total: number;
  warnings: string[];
};
export type Totals = {
  items_subtotal: number;
  discount_total: number;
  shipping_fee: number;
  payable_total: number;
};
export type QuoteInput = {
  fulfillment_method: "delivery" | "pickup";
  recipient_name: string;
  recipient_phone: string;
  address?: { address_line: string; locality: string; province: string } | null;
};
export type OrderLine = {
  product_id: number;
  sku: string;
  name: string;
  list_unit_price: number;
  charged_unit_price: number;
  quantity: number;
  line_total: number;
};
export type Quote = {
  id: number;
  expires_at: string;
  pricing_version: number;
  cart_fingerprint: string;
  items: OrderLine[];
  totals: Totals;
};
export type Order = {
  order_code: string;
  fulfillment_method: "delivery" | "pickup";
  recipient_name: string;
  recipient_phone: string;
  address: QuoteInput["address"];
  lifecycle: string;
  payment_status: string;
  fulfillment_status: string;
  expires_at: string;
  paid_at: string | null;
  items: OrderLine[];
  totals: Totals;
  version: number;
};
export type PaymentAttempt = {
  id: string;
  order_code: string;
  status: string;
  expires_at: string;
  payment_url: string | null;
  qr_content: string | null;
  qr_kind?: "checkout_url" | null;
  provider: string;
};
export type VnpayReturn = {
  verified: boolean;
  order_code: string;
  result: "succeeded" | "failed" | "unknown";
  payment_status: string;
};
