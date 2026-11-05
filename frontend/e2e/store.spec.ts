import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const base = "http://localhost:3100",
  backend = "http://localhost:18082";
const password = "E2E-Local-Password-2026!";
const browserIssues = new Map<Page, string[]>();
function observe(page: Page) {
  const issues: string[] = [];
  browserIssues.set(page, issues);
  page.on("pageerror", (error) => issues.push(error.message));
  page.on("console", (message) => {
    if (message.text().includes("Encountered two children with the same key"))
      issues.push(message.text());
    if (message.type() === "warning" && message.text().includes("Image with src"))
      issues.push(message.text());
  });
}

test.beforeEach(async ({ page }) => {
  browserIssues.clear();
  observe(page);
  await page.route("https://www.google.com/maps/**", (r) =>
    r.fulfill({ body: "", contentType: "text/html" }),
  );
  await page.route("https://e2e-provider.invalid/**", async (r) => {
    const u = new URL(r.request().url());
    const response = await page.request.get(
      backend + (u.pathname === "/pay" ? "/__e2e/provider" : u.pathname) + u.search,
      { maxRedirects: 0 },
    );
    await r.fulfill({ response });
  });
  await page.route("**/*.vnpayment.vn/**", (r) => r.abort("blockedbyclient"));
});
test.afterEach(() => {
  for (const issues of browserIssues.values()) expect(issues).toEqual([]);
});
async function register(page: Page) {
  await page.goto("/register");
  const d = page.getByRole("dialog");
  await d.getByLabel("Họ và tên", { exact: true }).fill("Khách E2E");
  await d
    .getByLabel("Email hoặc số điện thoại", { exact: true })
    .fill(`customer-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`);
  await d.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await d.getByLabel("Nhập lại mật khẩu", { exact: true }).fill(password);
  await d.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await expect(d).not.toBeVisible();
}
async function admin(page: Page) {
  await page.goto("/login");
  const d = page.getByRole("dialog");
  await d.getByLabel("Email hoặc số điện thoại", { exact: true }).fill("admin-e2e@example.test");
  await d.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await d.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
async function mutation(page: Page, path: string, method: "POST" | "PATCH", data: unknown) {
  await page.request.get(base + "/sanctum/csrf-cookie");
  const c = (await page.context().cookies(base)).find((c) => c.name === "XSRF-TOKEN");
  return page.request.fetch(base + "/api/v1" + path, {
    method,
    data,
    headers: {
      Origin: base,
      Referer: base + "/",
      "X-XSRF-TOKEN": decodeURIComponent(c!.value),
      Accept: "application/json",
    },
  });
}
async function checkout(page: Page, delivery = false) {
  await page.goto("/products?q=Sách%20kiểm%20thử%20E2E%201");
  await page.getByRole("button", { name: "Xem Sách kiểm thử E2E 1", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mua ngay", exact: true }).click();
  if (!delivery) await page.getByRole("radio", { name: /Nhận tại cửa hàng/ }).check();
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0900000001");
  if (delivery) {
    await page.getByLabel("Tỉnh / thành phố", { exact: true }).fill("Đà Nẵng");
    await page.getByLabel("Phường / xã, địa phương", { exact: true }).fill("Hòa Khánh");
    await page.getByLabel("Địa chỉ cụ thể", { exact: true }).fill("295 Tôn Đức Thắng");
  }
  await page.getByRole("button", { name: "Kiểm tra và lấy báo giá", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click();
  await expect(page.getByRole("button", { name: /^(Thanh toán ngay|Thanh toán)$/ })).toBeVisible();
  return page.url().split("/").pop()!;
}
async function finish(page: Page, outcome: "success" | "cancel" | "unknown") {
  await page.getByRole("button", { name: /^(Thanh toán ngay|Thanh toán)$/ }).click();
  await expect(page.getByRole("heading", { name: "Cổng kiểm thử tự động" })).toBeVisible();
  await page
    .getByRole("button", {
      name: { success: "Xác nhận thành công", cancel: "Hủy thanh toán", unknown: "Chưa xác định" }[
        outcome
      ],
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kết quả thanh toán VNPAY", exact: true }),
  ).toBeAttached();
  await expect(page.locator("#payment-outcome-title")).toBeVisible();
}
test("counter cash completes once and pickup offers three concise actions", async ({
  page,
  browser,
}) => {
  await register(page);
  const code = await checkout(page);
  await expect(page.getByRole("button", { name: "Thanh toán ngay", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hủy đơn", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Thanh toán tại quầy", exact: true }).click();
  await expect(page).toHaveURL(/\/orders$/);
  expect(
    (await (await page.request.get(`${base}/api/v1/orders/${code}`)).json()).data.payment_status,
  ).toBe("unpaid");
  const manager = await browser.newPage({ baseURL: base });
  observe(manager);
  try {
    await admin(manager);
    await manager.goto(`/admin/orders?q=${code}`);
    await manager
      .getByRole("row")
      .filter({ hasText: code })
      .getByRole("button", { name: "Chi tiết", exact: true })
      .click();
    const dialog = manager.getByRole("dialog");
    await dialog.getByRole("button", { name: "Thanh toán tiền mặt", exact: true }).click();
    await expect(
      dialog.getByRole("heading", { name: "Nhận tiền thành công", exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText("Đơn hàng đã hoàn tất.", { exact: true })).toBeVisible();
    expect(
      (await mutation(manager, `/admin/orders/${code}/cash-payment`, "POST", {})).ok(),
    ).toBeTruthy();
    const proof = await evidence(page.request, code);
    expect(proof.payment_status).toBe("paid");
    expect(proof.receipts).toBe(1);
    expect(proof.attempts).toBe(1);
    await page.goto(`/orders/${code}`);
    await expect(page.getByRole("button", { name: "Thanh toán ngay", exact: true })).toHaveCount(0);
    await expect(page.getByText("Đơn đã được xác nhận thanh toán.", { exact: true })).toBeVisible();
    await manager.setViewportSize({ width: 375, height: 850 });
    const close = await dialog.getByRole("button", { name: "Đóng", exact: true }).boundingBox();
    expect(close).not.toBeNull();
    expect(close!.x + close!.width).toBeLessThanOrEqual(375);
    await manager.screenshot({ path: resolve(root, "output/e2e/counter-cash-375.png") });
  } finally {
    await manager.close();
  }
});

test("counter VNPAY displays local QR for exact amount and polls verified completion", async ({
  page,
  browser,
}) => {
  await register(page);
  const code = await checkout(page);
  const order = (await (await page.request.get(`${base}/api/v1/orders/${code}`)).json()).data;
  const manager = await browser.newPage({ baseURL: base });
  observe(manager);
  try {
    await admin(manager);
    await manager.goto(`/admin/orders?q=${code}`);
    await manager
      .getByRole("row")
      .filter({ hasText: code })
      .getByRole("button", { name: "Chi tiết", exact: true })
      .click();
    const dialog = manager.getByRole("dialog");
    await dialog.getByRole("button", { name: "Thanh toán qua VNPAY", exact: true }).click();
    const qr = dialog.getByRole("img", {
      name: `QR mở thanh toán VNPAY cho đơn ${code}`,
      exact: true,
    });
    await expect(qr).toBeVisible();
    expect(await qr.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    const paymentUrl = await dialog
      .getByRole("link", { name: "Mở trang thanh toán", exact: true })
      .getAttribute("href");
    const redirect = await page.request.get(paymentUrl!, { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    expect(new URL(redirect.headers().location).searchParams.get("vnp_Amount")).toBe(
      String(order.totals.payable_total * 100),
    );
    await expect(
      dialog.getByRole("button", { name: "Thanh toán tiền mặt", exact: true }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("heading", { name: "Nhận tiền thành công", exact: true }),
    ).toHaveCount(0);
    expect(
      (await mutation(manager, `/admin/orders/${code}/cash-payment`, "POST", {})).status(),
    ).toBe(409);
    await manager.setViewportSize({ width: 375, height: 850 });
    await qr.screenshot({ path: resolve(root, "output/e2e/counter-qr-375.png") });
    expect(
      await manager.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    // Follow the checked 302 explicitly so the .invalid provider remains intercepted
    // by Playwright's initial-navigation route, without a real network request.
    await page.goto(redirect.headers().location);
    await expect(page.getByRole("heading", { name: "Cổng kiểm thử tự động" })).toBeVisible();
    await page.getByRole("button", { name: "Xác nhận thành công", exact: true }).click();
    await expect(page.locator("#payment-outcome-title")).toHaveText("Thanh toán thành công");
    await manager.bringToFront();
    await expect(
      dialog.getByRole("heading", { name: "Nhận tiền thành công", exact: true }),
    ).toBeVisible();
    expect(
      (await (await page.request.get(`${base}/api/v1/orders/${code}`)).json()).data.lifecycle,
    ).toBe("completed");
    expect((await evidence(page.request, code)).receipts).toBe(1);
  } finally {
    await manager.close();
  }
});
async function evidence(request: APIRequestContext, code: string) {
  return (await request.get(backend + "/__e2e/evidence?order_code=" + code)).json();
}

test("responsive ranking, keyboard selection and aligned quantity controls", async ({ page }) => {
  for (const width of [1440, 768, 402, 375]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/");
    const header = page.locator(".site-header");
    await expect(header.locator(".header-search")).toBeVisible();
    const headerLayout = await header.evaluate((node) => {
      const items = [".brand", ".category-menu", ".header-search", ".header-actions"].map(
        (selector) => node.querySelector(selector)!.getBoundingClientRect(),
      );
      return {
        spread:
          Math.max(...items.map((r) => r.top + r.height / 2)) -
          Math.min(...items.map((r) => r.top + r.height / 2)),
        overlap: items.some((r, i) => i > 0 && r.left < items[i - 1].right - 1),
        height: node.getBoundingClientRect().height,
      };
    });
    expect(headerLayout.spread).toBeLessThan(2);
    expect(headerLayout.overlap).toBeFalsy();
    expect(headerLayout.height).toBeLessThan(100);
    await expect(page.locator(".store-navigation")).toHaveCount(0);
    const categoryMenu = header.locator(".category-menu");
    await categoryMenu.locator("summary").click();
    await expect(categoryMenu).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(categoryMenu).not.toHaveAttribute("open", "");
    await categoryMenu.locator("summary").click();
    await header.locator(".header-search input").click();
    await expect(categoryMenu).not.toHaveAttribute("open", "");
    const ranking = page.getByRole("list", { name: "Xếp hạng bán chạy" });
    await expect(ranking.getByRole("button")).toHaveCount(10);
    await ranking.hover();
    await page.mouse.wheel(0, 900);
    await expect.poll(() => ranking.evaluate((n) => n.scrollTop)).toBeGreaterThan(0);
    await ranking.getByRole("button").last().click();
    await expect(ranking.getByRole("button").last()).toHaveAttribute("aria-pressed", "true");
    await ranking.getByRole("button").last().press("Home");
    await ranking.getByRole("button").nth(1).click();
    await expect(ranking.getByRole("button").nth(1)).toHaveAttribute("aria-pressed", "true");
    await ranking.getByRole("button").nth(1).press("ArrowDown");
    await expect(ranking.getByRole("button").nth(2)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/Đã bán trong tuần/)).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    if (width === 1440)
      await page
        .locator(".bestseller-showcase")
        .screenshot({ path: resolve(root, "output/e2e/bestseller-desktop.png") });
    if (width <= 402) {
      const compact = await page.locator(".bestseller-detail").evaluate((node) => {
        const cover = node.querySelector(".bestseller-cover")!.getBoundingClientRect();
        const title = node.querySelector("h3")!.getBoundingClientRect();
        const price = node.querySelector(".product-pricing")!.getBoundingClientRect();
        const action = node.querySelector(".bestseller-add")!.getBoundingClientRect();
        return {
          coverWidth: cover.width,
          beside: title.x >= cover.right,
          actionGap: action.top - Math.max(price.bottom, cover.bottom),
          actionHeight: action.height,
        };
      });
      expect(compact.coverWidth).toBeLessThanOrEqual(112);
      expect(compact.beside).toBeTruthy();
      expect(compact.actionGap).toBeLessThan(64);
      expect(compact.actionHeight).toBeGreaterThanOrEqual(44);
      if (width === 402)
        await page
          .locator(".bestseller-showcase")
          .screenshot({ path: resolve(root, "output/e2e/bestseller-mobile-compact.png") });
    }
    await page.locator(".bestseller-cover").click();
    const boxes = await page
      .getByRole("dialog")
      .locator(".quick-quantity button, .quick-quantity input")
      .evaluateAll((ns) =>
        ns.map((n) => {
          const b = n.getBoundingClientRect();
          return { y: b.y, h: b.height };
        }),
      );
    expect(boxes).toHaveLength(3);
    expect(
      Math.max(...boxes.map((b) => b.y)) - Math.min(...boxes.map((b) => b.y)),
    ).toBeLessThanOrEqual(1);
    expect(boxes.every((b) => b.h === 48)).toBeTruthy();
    if (width === 1440)
      await page
        .getByRole("dialog")
        .screenshot({ path: resolve(root, "output/e2e/quantity-desktop.png") });
    await page.getByRole("dialog").getByRole("button", { name: "Đóng", exact: true }).click();
  }
  await page.screenshot({ path: resolve(root, "output/e2e/mobile-home.png"), fullPage: true });
});

test("search, quantity boundaries, cart and profile persist through real API", async ({ page }) => {
  await register(page);
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Tìm sản phẩm", exact: true });
  await search.fill("Sách kiểm thử E2E 1");
  await page.getByRole("option").first().waitFor();
  await search.press("ArrowDown");
  await search.press("Enter");
  const d = page.getByRole("dialog");
  await expect(d).toBeVisible();
  await expect(d.getByRole("button", { name: "Giảm số lượng" })).toBeDisabled();
  await d.getByRole("spinbutton", { name: "Số lượng" }).fill("0");
  await expect(d.getByRole("button", { name: "Thêm vào giỏ", exact: true })).toBeDisabled();
  await d.getByRole("spinbutton", { name: "Số lượng" }).fill("2");
  await d.getByRole("button", { name: "Thêm vào giỏ", exact: true }).click();
  await expect(d).not.toBeVisible();
  expect(
    (await (await page.request.get(base + "/api/v1/cart")).json()).data.items[0].quantity,
  ).toBe(2);
  await page.goto("/account");
  await page.getByLabel("Họ và tên", { exact: true }).fill("Khách đã sửa E2E");
  await page.getByRole("button", { name: /Lưu/ }).click();
  await expect
    .poll(async () => (await (await page.request.get(base + "/api/v1/auth/me")).json()).data.name)
    .toBe("Khách đã sửa E2E");
  await page.reload();
  await expect(page.getByLabel("Họ và tên", { exact: true })).toHaveValue("Khách đã sửa E2E");
});

for (const scenario of [
  { action: "Thêm vào giỏ", destination: "/cart", quantity: 1, signup: false, width: 1440 },
  { action: "Mua ngay", destination: "/checkout", quantity: 2, signup: false, width: 402 },
  { action: "Thêm vào giỏ", destination: "/cart", quantity: 2, signup: true, width: 402 },
  { action: "Mua ngay", destination: "/checkout", quantity: 1, signup: true, width: 1440 },
]) {
  test(`guest ${scenario.action}, quantity ${scenario.quantity}, ${scenario.signup ? "register" : "login"} resumes once at ${scenario.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: scenario.width, height: 874 });
    const email = `intent-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
    if (!scenario.signup) {
      await register(page);
      const account = (await (await page.request.get(base + "/api/v1/auth/me")).json()).data;
      // register() generated the address; use that real account for the login continuation.
      await mutation(page, "/auth/logout", "POST", {});
      await page.goto("/");
      await openGuestIntent(page, scenario.quantity, scenario.action);
      await page
        .getByRole("dialog")
        .getByLabel("Email hoặc số điện thoại", { exact: true })
        .fill(account.email);
    } else {
      await openGuestIntent(page, scenario.quantity, scenario.action);
      await page.getByRole("dialog").getByRole("button", { name: "Đăng ký", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByLabel("Họ và tên", { exact: true })
        .fill("Khách tiếp tục mua");
      await page
        .getByRole("dialog")
        .getByLabel("Email hoặc số điện thoại", { exact: true })
        .fill(email);
      await page
        .getByRole("dialog")
        .getByLabel("Nhập lại mật khẩu", { exact: true })
        .fill(password);
    }
    let writes = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/v1/cart/items" && request.method() === "POST")
        writes++;
    });
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await dialog
      .getByRole("button", { name: scenario.signup ? "Đăng ký" : "Đăng nhập", exact: true })
      .click();
    await expect(page).toHaveURL(base + scenario.destination);
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect
      .poll(
        async () =>
          (await (await page.request.get(base + "/api/v1/cart")).json()).data.items[0]?.quantity,
      )
      .toBe(scenario.quantity);
    await page.reload();
    expect(
      (await (await page.request.get(base + "/api/v1/cart")).json()).data.items[0].quantity,
    ).toBe(scenario.quantity);
    expect(writes).toBe(1);
  });
}

async function openGuestIntent(page: Page, quantity: number, action: string) {
  await page.goto("/products?q=Sách%20kiểm%20thử%20E2E%201");
  await page.getByRole("button", { name: "Xem Sách kiểm thử E2E 1", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("spinbutton", { name: "Số lượng" })
    .fill(String(quantity));
  await page.getByRole("dialog").getByRole("button", { name: action, exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Chào bạn trở lại" }),
  ).toBeVisible();
}

test("dismissed purchase authentication and admin login never add customer items", async ({
  page,
}) => {
  let writes = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/cart/items" && request.method() === "POST")
      writes++;
  });
  await openGuestIntent(page, 2, "Mua ngay");
  await page.getByRole("dialog").getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("spinbutton", { name: "Số lượng" })).toHaveValue(
    "2",
  );
  expect(writes).toBe(0);
  await page.getByRole("dialog").getByRole("button", { name: "Mua ngay", exact: true }).click();
  const auth = page.getByRole("dialog");
  await auth.getByLabel("Email hoặc số điện thoại", { exact: true }).fill("admin-e2e@example.test");
  await auth.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await auth.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(base + "/admin");
  expect(writes).toBe(0);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("failed resumed cart write retains login and never retries the mutation automatically", async ({
  page,
}) => {
  await register(page);
  const account = (await (await page.request.get(base + "/api/v1/auth/me")).json()).data;
  await mutation(page, "/auth/logout", "POST", {});
  await openGuestIntent(page, 2, "Mua ngay");
  let writes = 0;
  await page.route("**/api/v1/cart/items", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    writes++;
    return route.fulfill({
      status: 409,
      json: { message: "Sản phẩm tạm hết hàng.", code: "INSUFFICIENT_STOCK" },
    });
  });
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(account.email);
  await dialog.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(base + "/cart");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: /Đã đăng nhập.*Chưa thể hoàn tất/ }),
  ).toBeVisible();
  expect((await page.request.get(base + "/api/v1/auth/me")).status()).toBe(200);
  expect((await (await page.request.get(base + "/api/v1/cart")).json()).data.items).toHaveLength(0);
  expect(writes).toBe(1);
});

test("delivery fee, verified provider query, replay and tamper protection", async ({
  page,
  request,
}) => {
  await register(page);
  const code = await checkout(page, true);
  await expect(page.getByRole("button", { name: "Cập nhật trạng thái", exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Đặt lại sản phẩm", exact: true })).toHaveCount(0);
  const order = (await (await page.request.get(base + "/api/v1/orders/" + code)).json()).data;
  expect(order.totals.shipping_fee).toBe(25000);
  expect(order.totals.payable_total).toBe(110000);
  await finish(page, "success");
  await expect(
    page.getByRole("heading", { name: "Thanh toán thành công", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".payment-outcome--success .payment-outcome-icon")).toBeVisible();
  await expect(page.locator(".payment-overview")).toContainText("110.000");
  await expect(page.locator(".payment-items")).toHaveCount(0);
  await page
    .locator(".payment-result-page")
    .screenshot({ path: resolve(root, "output/e2e/payment-success-desktop.png") });
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({
    path: resolve(root, "output/e2e/payment-success-mobile.png"),
    fullPage: true,
  });
  const before = await evidence(request, code);
  expect(before.payment_status).toBe("paid");
  expect(before.receipts).toBe(1);
  const signed = new URL(page.url()).searchParams;
  expect(
    (await (await request.get(backend + "/api/v1/payments/vnpay/ipn?" + signed)).json()).RspCode,
  ).toBe("02");
  signed.set("vnp_Amount", "1");
  expect(
    (await (await request.get(backend + "/api/v1/payments/vnpay/ipn?" + signed)).json()).RspCode,
  ).toBe("97");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Thanh toán thành công", exact: true }),
  ).toBeVisible();
  expect(await evidence(request, code)).toEqual(before);
});

test("provider cancellation stays unpaid and customer cannot use admin endpoints", async ({
  page,
  request,
}) => {
  await register(page);
  const code = await checkout(page);
  await finish(page, "cancel");
  await expect(
    page.getByRole("heading", { name: "Thanh toán không thành công", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".payment-outcome--failure .payment-outcome-icon")).toBeVisible();
  await expect(page.locator(".payment-items")).toHaveCount(0);
  await page
    .locator(".payment-result-page")
    .screenshot({ path: resolve(root, "output/e2e/payment-failure-desktop.png") });
  expect((await evidence(request, code)).receipts).toBe(0);
  expect((await evidence(request, code)).payment_status).toBe("unpaid");
  expect((await page.request.get(base + "/api/v1/admin/products")).status()).toBe(403);
  expect((await mutation(page, "/admin/products", "POST", { name: "Unauthorized" })).status()).toBe(
    403,
  );
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Quản lý cửa hàng", exact: true })).toHaveCount(0);
});

test("uncertain return stays pending; backend IPN updates customer automatically", async ({
  page,
  request,
}) => {
  await register(page);
  const code = await checkout(page);
  await finish(page, "unknown");
  await expect(page.locator(".payment-outcome--pending .payment-outcome-icon")).toBeVisible();
  const before = await evidence(request, code);
  expect(before.receipts).toBe(0);
  expect(before.payment_status).toBe("pending");
  const ref = new URL(page.url()).searchParams.get("vnp_TxnRef")!;
  const confirmation = await request.get(
    backend + "/__e2e/finish?reference=" + ref + "&outcome=success",
    { maxRedirects: 0 },
  );
  const callback = new URL(confirmation.headers().location).searchParams;
  expect(
    (await (await request.get(backend + "/api/v1/payments/vnpay/ipn?" + callback)).json()).RspCode,
  ).toBe("00");
  await expect(
    page.getByRole("heading", { name: "Thanh toán thành công", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  expect((await evidence(request, code)).receipts).toBe(1);
});

test("admin creates with image/discount, edits, archives and restores product", async ({
  page,
}) => {
  await admin(page);
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "+ Thêm sản phẩm", exact: true }).click();
  const d = page.getByRole("dialog"),
    suffix = Date.now(),
    name = "Sản phẩm CRUD E2E " + suffix;
  await d.getByLabel("Tên sản phẩm", { exact: true }).fill(name);
  await d.getByLabel("SKU", { exact: true }).fill("E2E-CRUD-" + suffix);
  await d.getByLabel("Danh mục", { exact: true }).selectOption({ label: "Sách kiểm thử E2E" });
  await d.getByLabel("Giá bìa / giá niêm yết", { exact: true }).fill("100000");
  await d.getByLabel("Cách nhập giá giảm", { exact: true }).selectOption("percent");
  await d.getByLabel(/Phần trăm giảm giá/).fill("15");
  await d.getByLabel("Tồn ban đầu", { exact: true }).fill("12");
  await d.getByRole("checkbox", { name: "Hiển thị trong Bán chạy nhất", exact: true }).check();
  await d
    .locator('input[type="file"]')
    .setInputFiles(resolve(root, "frontend/public/catalog-hd/TT-VH-001.webp"));
  await d.getByRole("button", { name: "Lưu sản phẩm", exact: true }).click();
  await expect(d.getByText(/Đã lưu/)).toBeVisible();
  await d.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByLabel("Tìm sản phẩm quản lý").fill(name);
  await page.locator(".admin-toolbar").getByRole("button", { name: "Tìm", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("85.000");
  await row.getByRole("button", { name: "Chỉnh sửa / ảnh", exact: true }).click();
  await expect(
    d.getByRole("checkbox", { name: "Hiển thị trong Bán chạy nhất", exact: true }),
  ).toBeChecked();
  await d.getByLabel("Tên sản phẩm", { exact: true }).fill(name + " đã sửa");
  await d.getByRole("button", { name: "Lưu sản phẩm", exact: true }).click();
  await expect(d.getByText(/Đã lưu/)).toBeVisible();
  await d.getByRole("button", { name: "Đóng", exact: true }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Xóa / ngừng bán", exact: true }).click();
  await expect(row).toContainText("Đã ẩn");
  await row.getByRole("button", { name: /Khôi phục|Hiện lại|Mở bán/ }).click();
  await expect(row).toContainText("Đang bán");
});

test("admin navigation and revenue charts render without overflow", async ({ page }) => {
  test.setTimeout(120000);
  await admin(page);
  for (const width of [1440, 375])
    for (const path of [
      "/admin",
      "/admin/categories",
      "/admin/inventory",
      "/admin/orders",
      "/admin/reconciliation",
      "/admin/revenue",
    ]) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: "Quản lý cửa hàng", exact: true }),
      ).toBeVisible();
      await expect(page.locator("main")).not.toContainText("Không gian quản trị");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
    }
});

test("newsletter consent, password recovery and invalid reset link", async ({ page }) => {
  await page.goto("/");
  const newsletter = page.getByRole("region", { name: "Đăng ký nhận bản tin", exact: true });
  await newsletter.getByLabel("Email nhận bản tin").fill(`newsletter-${Date.now()}@example.test`);
  await newsletter.getByRole("checkbox").check();
  const saved = page.waitForResponse(
    (r) => r.url().includes("/newsletter/subscriptions") && r.request().method() === "POST",
  );
  await newsletter.getByRole("button", { name: "Đăng ký", exact: true }).click();
  expect((await saved).ok()).toBeTruthy();
  await expect(newsletter.getByRole("status")).toBeVisible();
  await page.goto("/forgot-password");
  await page
    .getByLabel("Email đăng ký", { exact: true })
    .fill(`missing-${Date.now()}@example.test`);
  const sent = page.waitForResponse(
    (r) => r.url().includes("/auth/forgot-password") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Gửi liên kết khôi phục", exact: true }).click();
  expect((await sent).ok()).toBeTruthy();
  await page.goto("/reset-password");
  await expect(page.getByText(/Liên kết chưa đầy đủ hoặc không hợp lệ/)).toBeVisible();
});

test("inventory adjustment records ledger; only admin changes order fulfillment", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await register(page);
  const code = await checkout(page);
  await finish(page, "success");
  expect(
    (
      await mutation(page, "/admin/orders/" + code + "/fulfillment", "PATCH", {
        status: "preparing",
        version: 1,
      })
    ).status(),
  ).toBe(403);
  const manager = await browser.newPage({ baseURL: base });
  observe(manager);
  manager.on("dialog", (dialog) => dialog.accept());
  try {
    await admin(manager);
    await manager.goto("/admin/inventory");
    const product = (
      await (
        await manager.request.get(
          base + "/api/v1/products?q=" + encodeURIComponent("Sách kiểm thử E2E 1"),
        )
      ).json()
    ).data.find((p: { sku: string }) => p.sku === "E2E-BOOK-1");
    const stock = manager
      .getByRole("row")
      .filter({ has: manager.getByText("E2E-BOOK-1", { exact: true }) });
    await stock.getByRole("button", { name: "Điều chỉnh", exact: true }).click();
    const dialog = manager.getByRole("dialog");
    await dialog.getByLabel("Số lượng tăng / giảm", { exact: true }).fill("3");
    await dialog.getByLabel("Lý do", { exact: true }).fill("Kiểm kê E2E +3");
    await dialog.getByRole("button", { name: "Xác nhận điều chỉnh", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const adjusted = (
      await (await manager.request.get(base + "/api/v1/products/" + product.id)).json()
    ).data;
    expect(adjusted.available_quantity).toBe(product.available_quantity + 3);
    await stock.getByRole("button", { name: "Lịch sử", exact: true }).click();
    await expect(dialog.getByText("Kiểm kê E2E +3", { exact: true }).first()).toBeVisible();
    await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
    await manager.goto("/admin/orders");
    await manager.getByLabel("Tìm đơn hàng", { exact: true }).fill(code);
    await manager
      .locator(".admin-toolbar")
      .getByRole("button", { name: "Tìm", exact: true })
      .click();
    await manager
      .getByRole("row")
      .filter({ hasText: code })
      .getByRole("button", { name: "Chi tiết", exact: true })
      .click();
    for (const name of ["Bắt đầu chuẩn bị", "Sẵn sàng nhận", "Xác nhận hoàn tất"]) {
      const changed = manager.waitForResponse(
        (r) => r.url().includes("/fulfillment") && r.request().method() === "PATCH",
      );
      await dialog.getByRole("button", { name, exact: true }).click();
      expect((await changed).ok()).toBeTruthy();
    }
    await expect
      .poll(
        async () =>
          (await (await page.request.get(base + "/api/v1/orders/" + code)).json()).data
            .fulfillment_status,
      )
      .toBe("fulfilled");
  } finally {
    await manager.close();
  }
});

test("ranked product adds one item to cart without fabricating sales", async ({ page }) => {
  await register(page);
  await page.goto("/");
  const ranking = page.getByRole("list", { name: "Xếp hạng bán chạy" });
  await ranking.getByRole("button").nth(3).click();
  const selectedName = await page.locator(".bestseller-product-copy h3").innerText();
  await page.locator(".bestseller-add .product-add").click();
  await expect
    .poll(async () => {
      const cart = (await (await page.request.get(base + "/api/v1/cart")).json()).data;
      return cart.items.some(
        (item: { product: { name: string }; quantity: number }) =>
          item.product.name === selectedName && item.quantity === 1,
      );
    })
    .toBeTruthy();
});

test("landing uses ten original image logos and accessible carousel arrows", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 768, 402, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const brands = page.getByRole("region", { name: "Đối tác", exact: true });
    await expect(brands.locator("img")).toHaveCount(10);
    await brands.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        brands
          .locator("img")
          .evaluateAll((nodes) =>
            nodes.every(
              (n) => (n as HTMLImageElement).complete && (n as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBeTruthy();
    await expect(brands.locator(".brand-name, small")).toHaveCount(0);
    await brands.getByRole("button", { name: "Thương hiệu tiếp theo", exact: true }).click();
    await expect
      .poll(() => brands.locator(".brand-track").evaluate((n) => n.scrollLeft))
      .toBeGreaterThan(0);
    await expect(
      brands.getByRole("button", { name: "Thương hiệu trước", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await brands.screenshot({
      path: resolve(root, `output/e2e/brand-logos-${width}.png`),
    });
  }
  for (const path of ["/products", "/cart", "/orders", "/policies"]) {
    await page.goto(path);
    await expect(page.getByRole("region", { name: "Đối tác", exact: true })).toHaveCount(0);
  }
});

test("invalid payment return never displays a paid confirmation", async ({ page }) => {
  await page.goto("/payment/vnpay-return?vnp_SecureHash=invalid");
  await expect(
    page.getByRole("heading", { name: "Không thể xác minh giao dịch", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".payment-outcome--failure .payment-outcome-icon")).toBeVisible();
  await expect(
    page.locator(".payment-outcome--success, .payment-overview, .payment-items"),
  ).toHaveCount(0);
});

test("cancel returns items to the saved cart and allows a fresh checkout without replay duplication", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await register(page);
  const code = await checkout(page);
  const product = (
    await (
      await page.request.get(
        base + "/api/v1/products?q=" + encodeURIComponent("Sách kiểm thử E2E 1"),
      )
    ).json()
  ).data.find((p: { sku: string }) => p.sku === "E2E-BOOK-1");
  expect(
    (await mutation(page, "/cart/items", "POST", { product_id: product.id, quantity: 2 })).ok(),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Hủy đơn", exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(
    page.getByRole("heading", { name: "Sách kiểm thử E2E 1", exact: true }),
  ).toBeVisible();
  const cart = async () => (await (await page.request.get(base + "/api/v1/cart")).json()).data;
  expect((await cart()).items[0].quantity).toBe(3);
  expect(
    (await (await page.request.get(base + "/api/v1/orders/" + code)).json()).data.lifecycle,
  ).toBe("cancelled");
  expect((await mutation(page, "/orders/" + code + "/cancel", "POST", {})).ok()).toBeTruthy();
  expect((await cart()).items[0].quantity).toBe(3);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Sách kiểm thử E2E 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Tiến hành đặt hàng/ }).click();
  await page.getByRole("radio", { name: /Nhận tại cửa hàng/ }).check();
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0900000001");
  await page.getByRole("button", { name: "Kiểm tra và lấy báo giá", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click();
  await expect(page.getByRole("button", { name: /^(Thanh toán ngay|Thanh toán)$/ })).toBeVisible();
  const newCode = page.url().split("/").pop()!;
  expect(newCode).not.toBe(code);
  expect((await cart()).items).toHaveLength(0);
  expect((await mutation(page, "/orders/" + code + "/cancel", "POST", {})).ok()).toBeTruthy();
  expect((await cart()).items).toHaveLength(0);
});

test("direct card buy resumes after login once; cart icon adds once without a product dialog", async ({
  page,
}) => {
  await register(page);
  const account = (await (await page.request.get(base + "/api/v1/auth/me")).json()).data;
  await mutation(page, "/auth/logout", "POST", {});
  await page.goto("/products?q=Sách%20kiểm%20thử%20E2E%201");
  let writes = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/v1/cart/items" && r.method() === "POST") writes++;
  });
  await page.getByRole("button", { name: "Mua ngay Sách kiểm thử E2E 1", exact: true }).click();
  const auth = page.getByRole("dialog");
  await auth.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(account.email);
  await auth.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await auth.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toBe(1);
  await page.goto("/products?q=Sách%20kiểm%20thử%20E2E%201");
  await page
    .getByRole("button", { name: "Thêm Sách kiểm thử E2E 1 vào giỏ hàng", exact: true })
    .dblclick();
  await expect
    .poll(async () => {
      const c = (await (await page.request.get(base + "/api/v1/cart")).json()).data;
      return c.items.find((i: { product: { sku: string } }) => i.product.sku === "E2E-BOOK-1")
        ?.quantity;
    })
    .toBe(2);
  expect(writes).toBe(2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("dismissing direct card login never opens a product dialog or writes a cart", async ({
  page,
}) => {
  await page.goto("/products?q=Sách%20kiểm%20thử%20E2E%201");
  let writes = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/v1/cart/items" && r.method() === "POST") writes++;
  });
  await page.getByRole("button", { name: "Mua ngay Sách kiểm thử E2E 1", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toBe(0);
});
