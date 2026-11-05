import { query, first, transaction, insert, update } from "./db.js";
import { must, fail, validate, z, str, int, pageInfo, now } from "./support.js";
import { ulid } from "ulid";
export const categoryResource = (c) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  sort_order: c.sort_order,
  is_active: !!c.is_active,
});
export async function productResource(p, db) {
  return {
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    description: p.description,
    grade: p.grade,
    category: categoryResource(
      must(await first("SELECT * FROM categories WHERE id=?", [p.category_id], db)),
    ),
    list_price: p.list_price,
    sale_price: p.sale_price,
    unit_price: p.sale_price ?? p.list_price,
    discount_percent: p.list_price
      ? Math.round(((p.list_price - (p.sale_price ?? p.list_price)) * 100) / p.list_price)
      : 0,
    available_quantity: p.stock_on_hand - p.stock_reserved,
    is_active: !!p.is_active,
    is_hot: !!p.is_hot,
    is_bestseller: !!p.is_bestseller,
    catalog_version: p.catalog_version,
    ...(p.sold_count !== undefined ? { sold_count: Number(p.sold_count) } : {}),
    images: (
      await query(
        "SELECT * FROM product_images WHERE product_id=? ORDER BY sort_order,id",
        [p.id],
        db,
      )
    ).map((i) => ({
      id: i.id,
      url: "/storage/" + i.path,
      alt_text: i.alt_text,
      sort_order: i.sort_order,
    })),
  };
}
export async function products(filters = {}, admin = false, db) {
  const where = [],
    params = [];
  if (!admin) where.push("p.is_active=1 AND c.is_active=1");
  else if (filters.is_active !== undefined) {
    where.push("p.is_active=?");
    params.push(Number(filters.is_active));
  }
  if (filters.q) {
    where.push("p.name LIKE ? ESCAPE '!'");
    params.push("%" + filters.q.replace(/[!%_]/g, (c) => "!" + c) + "%");
  }
  for (const k of ["category_id", "grade"])
    if (filters[k]) {
      where.push(`p.${k}=?`);
      params.push(Number(filters[k]));
    }
  if (filters.brand) {
    where.push("CONCAT(p.description,CHAR(10)) LIKE ? ESCAPE '!'");
    params.push("%NXB / Thương hiệu: " + filters.brand.replace(/[!%_]/g, (c) => "!" + c) + "\n%");
  }
  if (filters.section === "hot") where.push("p.is_hot=1");
  const sales = `LEFT JOIN (SELECT i.product_id,SUM(i.quantity) sold_count FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.payment_status='paid' AND EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.allocation='accepted') GROUP BY i.product_id) s ON s.product_id=p.id`;
  if (filters.section === "bestseller") where.push("(p.is_bestseller=1 OR s.sold_count>0)");
  const from = `FROM products p JOIN categories c ON c.id=p.category_id ${sales} ${where.length ? "WHERE " + where.join(" AND ") : ""}`;
  const total = (await first("SELECT COUNT(*) n " + from, params, db)).n;
  const pagination = pageInfo(filters, total);
  const sort =
    filters.section === "bestseller"
      ? "sold_count DESC,p.is_bestseller DESC,p.id"
      : filters.sort === "price_asc"
        ? "COALESCE(p.sale_price,p.list_price),p.id"
        : filters.sort === "price_desc"
          ? "COALESCE(p.sale_price,p.list_price) DESC,p.id"
          : "p.created_at DESC,p.id DESC";
  const rows = await query(
    `SELECT p.*,COALESCE(s.sold_count,0) sold_count ${from} ORDER BY ${sort} LIMIT ? OFFSET ?`,
    [...params, pagination.per_page, (pagination.page - 1) * pagination.per_page],
    db,
  );
  return { items: await Promise.all(rows.map((p) => productResource(p, db))), pagination };
}
export async function recommendations(userId) {
  const candidates = await query(
    "SELECT p.* FROM products p JOIN (SELECT p.id,ROW_NUMBER() OVER (PARTITION BY p.category_id ORDER BY p.created_at DESC,p.id DESC) rn FROM products p JOIN categories c ON c.id=p.category_id WHERE p.is_active=1 AND c.is_active=1 AND p.stock_on_hand>p.stock_reserved) ranked ON ranked.id=p.id WHERE ranked.rn<=12 ORDER BY p.created_at DESC,p.id DESC",
  );
  const all = await Promise.all(candidates.map((p) => productResource(p)));
  const preferred = userId
    ? (
        await query(
          "SELECT DISTINCT p.category_id FROM products p JOIN cart_items i ON i.product_id=p.id JOIN carts c ON c.id=i.cart_id WHERE c.user_id=? UNION SELECT DISTINCT p.category_id FROM products p JOIN order_items i ON i.product_id=p.id JOIN orders o ON o.id=i.order_id WHERE o.user_id=? AND o.payment_status='paid' AND EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.allocation='accepted')",
          [userId, userId],
        )
      ).map((p) => p.category_id)
    : [];
  const groups = new Map();
  for (const p of all.filter((p) => p.available_quantity > 0)) {
    if (!groups.has(p.category.id)) groups.set(p.category.id, []);
    groups.get(p.category.id).push(p);
  }
  const ids = [...groups.keys()].sort(
      (a, b) => Number(preferred.includes(b)) - Number(preferred.includes(a)) || a - b,
    ),
    out = [];
  for (let i = 0; i < 12 && out.length < 12; i++)
    for (const id of ids) if (groups.get(id)[i] && out.length < 12) out.push(groups.get(id)[i]);
  return out;
}
export async function storefront(userId) {
  const categories = (
    await query("SELECT * FROM categories WHERE is_active=1 ORDER BY sort_order,id")
  ).map(categoryResource);
  const hot = (await products({ section: "hot", per_page: 12 })).items,
    bestseller = (await products({ section: "bestseller", per_page: 10 })).items,
    newItems = (await products({ per_page: 12 })).items;
  const counts = new Map();
  for (const row of await query(
    "SELECT p.description FROM products p JOIN categories c ON c.id=p.category_id WHERE p.is_active=1 AND c.is_active=1",
  )) {
    const brand = row.description?.match(/^NXB \/ Thương hiệu: (.+)$/mu)?.[1]?.trim();
    if (brand) counts.set(brand, (counts.get(brand) || 0) + 1);
  }
  return {
    categories,
    hot,
    bestseller,
    new: newItems,
    recommended: await recommendations(userId),
    brands: [...counts].sort().map(([name, product_count]) => ({ name, product_count })),
  };
}
const productSchema = z.strictObject({
  category_id: int(1),
  sku: str(100),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(255)
    .optional(),
  name: str(255),
  description: z.string().max(20000).nullable().optional(),
  grade: int(1, 12).nullable().optional(),
  list_price: int(),
  sale_price: int().nullable().optional(),
  discount_percent: int(0, 100).optional(),
  is_active: z.boolean().optional(),
  is_hot: z.boolean().optional(),
  is_bestseller: z.boolean().optional(),
  opening_stock: int(0, 2147483647),
});
export async function saveProduct(input, id, actorId) {
  const body = validate(
    id
      ? productSchema
          .omit({ opening_stock: true })
          .partial()
          .extend({ version: int(1) })
      : productSchema,
    input,
  );
  if ("sale_price" in body && "discount_percent" in body)
    fail("VALIDATION_ERROR", "Chỉ chọn một cách giảm giá.", 422);
  return transaction(async (db) => {
    const old = id
      ? must(await first("SELECT * FROM products WHERE id=? FOR UPDATE", [id], db))
      : null;
    if (old && old.catalog_version !== body.version)
      fail("VERSION_CONFLICT", "Sản phẩm đã thay đổi.");
    const p = {
      ...(old || {
        is_active: 1,
        is_hot: 0,
        is_bestseller: 0,
        grade: null,
        sale_price: null,
        description: null,
      }),
      ...body,
    };
    const category = must(await first("SELECT * FROM categories WHERE id=?", [p.category_id], db));
    if (p.grade !== null && category.slug !== "sach-giao-khoa")
      fail("VALIDATION_ERROR", "Chỉ sách giáo khoa có trường lớp.", 422);
    if ("discount_percent" in body)
      p.sale_price =
        body.discount_percent === 0
          ? null
          : Math.floor((p.list_price * (100 - body.discount_percent) + 50) / 100);
    if (p.sale_price !== null && p.sale_price > p.list_price)
      fail("VALIDATION_ERROR", "Giá bán cao hơn giá niêm yết.", 422);
    const fields = {};
    for (const k of [
      "category_id",
      "sku",
      "name",
      "description",
      "grade",
      "list_price",
      "sale_price",
      "is_active",
      "is_hot",
      "is_bestseller",
    ])
      fields[k] = p[k];
    fields.slug = p.slug || "san-pham-" + ulid().toLowerCase();
    fields.catalog_version = old ? old.catalog_version + 1 : 1;
    if (old) await update("products", id, fields, db);
    else {
      id = await insert(
        "products",
        {
          ...fields,
          stock_on_hand: body.opening_stock,
          stock_reserved: 0,
          created_at: now(),
          updated_at: now(),
        },
        db,
      );
      await movement(
        db,
        { id, stock_on_hand: body.opening_stock, stock_reserved: 0 },
        "opening",
        body.opening_stock,
        0,
        "Opening stock",
        actorId,
        "product:" + id + ":opening",
      );
    }
    return productResource(await first("SELECT * FROM products WHERE id=?", [id], db), db);
  });
}
export const inventoryResource = (p) => ({
  product_id: p.id,
  sku: p.sku,
  name: p.name,
  list_price: p.list_price,
  sale_price: p.sale_price,
  unit_price: p.sale_price ?? p.list_price,
  stock_on_hand: p.stock_on_hand,
  stock_reserved: p.stock_reserved,
  available_quantity: p.stock_on_hand - p.stock_reserved,
});
export async function movement(
  db,
  p,
  kind,
  onHand,
  reserved,
  reason,
  actorId,
  businessKey,
  orderId = null,
) {
  await insert(
    "inventory_movements",
    {
      product_id: p.id,
      order_id: orderId,
      actor_id: actorId,
      kind,
      delta_on_hand: onHand,
      delta_reserved: reserved,
      resulting_on_hand: p.stock_on_hand,
      resulting_reserved: p.stock_reserved,
      reason,
      business_key: businessKey,
      created_at: now(),
    },
    db,
  );
}
