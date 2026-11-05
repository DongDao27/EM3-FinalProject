# Thu Thanh Bookstore

**Final Project — EM3** · Hệ thống bán sách trực tuyến và quản lý cửa hàng, hỗ trợ giao hàng và nhận tại quầy.

[![EM3 checks](https://github.com/DongDao27/EM3-FinalProject/actions/workflows/checks.yml/badge.svg)](https://github.com/DongDao27/EM3-FinalProject/actions/workflows/checks.yml)

## Công nghệ

| Thành phần | Công nghệ                                                  |
| ---------- | ---------------------------------------------------------- |
| Frontend   | Next.js 16, React 19, TypeScript, Tailwind CSS 4           |
| Backend    | Node.js, Express 5, REST API                               |
| Database   | MySQL 8.4, transaction và khóa hàng                        |
| Kiểm thử   | Node.js Test Runner, Supertest, Playwright, GitHub Actions |

## Chức năng chính

- **Khách hàng:** tìm kiếm, lọc sản phẩm, giỏ hàng, đặt hàng và theo dõi đơn.
- **Thanh toán:** VNPAY Sandbox hoặc tiền mặt tại quầy; xác minh giao dịch trước khi ghi nhận thanh toán.
- **Quản trị:** quản lý sản phẩm, hình ảnh, danh mục, tồn kho, đơn hàng và báo cáo doanh thu.
- **Tài khoản:** đăng ký, đăng nhập, cập nhật hồ sơ và khôi phục mật khẩu; phân quyền bằng session cookie và CSRF.

## Cài đặt và chạy

Yêu cầu **Node.js ≥ 22.13**, **npm ≥ 10** và **MySQL 8.4**.

```bash
git clone https://github.com/DongDao27/EM3-FinalProject.git
cd EM3-FinalProject
npm ci
cp backend/.env.example backend/.env
```

Cấu hình kết nối MySQL và `SESSION_SECRET` trong `backend/.env`. Tạo database `thu_thanh_em3` và `thu_thanh_em3_test` theo [hướng dẫn cài đặt](docs/SETUP.md).

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Website: **http://localhost:3001** · Quản trị: **http://localhost:3001/admin** · API: **http://localhost:8001**.

Tạo tài khoản quản trị bằng CLI theo hướng dẫn cài đặt; dự án không cung cấp mật khẩu mặc định. Cấu hình merchant Sandbox và SMTP được hướng dẫn riêng trong tài liệu.

## Kiểm thử

```bash
npm run verify
npx playwright install chromium
npm run test:e2e
```

Chạy tuần tự; tests sử dụng database riêng và mô phỏng thanh toán/email. [Kết quả kiểm chứng](docs/PRE-SUBMISSION-CHECK.md): **54 backend tests, 7 API client tests, 4 payment-tool tests và 23 E2E tests đạt**.

## Tài liệu

[Cài đặt & vận hành](docs/SETUP.md) · [REST API](docs/API.md) · [Database](docs/DATABASE.md) · [VNPAY Sandbox](docs/VNPAY-SANDBOX.md) · [Thiết kế Figma](design/figma/HUONG-DAN.md)
