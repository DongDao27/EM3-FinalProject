# Thu Thanh EM3

## Cập nhật D85 — 05/11/2026

Nhận tại cửa hàng có ba nút Thanh toán ngay / Thanh toán tại quầy / Hủy đơn. Admin chọn VNPAY hoặc tiền mặt; tiền mặt xác nhận thu đủ và hoàn tất ngay, VNPAY chỉ hoàn tất sau xác minh. Đối tác chỉ ở landing. QR web mở trang VNPAY bằng camera, chưa phải native bank-app QR; điện thoại phải truy cập được địa chỉ frontend.

Plugin mới: `output/figma/THUTHANH-FIGMA-V35.zip` ([hướng dẫn plugin](design/figma/HUONG-DAN.md)). Giải nén/import manifest mới và chạy Cập nhật thiết kế để thay layer quản lý V34, giữ ảnh chỉnh tay/ghi chú. QR prototype không chuyển tiền.

Website nhà sách: **Next.js** làm giao diện, **Express** xử lý API và **MySQL 8.4** lưu dữ liệu. Dự án dùng npm workspaces: cài một lần tại thư mục gốc, dùng chung `node_modules` và `package-lock.json`.

Bản này dùng để chạy và kiểm thử trên máy cá nhân.

## Thiết kế và brief

[Brief thiết kế Thu Thanh](docs/BRIEF-THIET-KE-THU-THANH.docx) là bản Word trình bày mục tiêu, yêu cầu khách hàng, lý do thiết kế và các luồng desktop/mobile. Bộ [plugin Figma V35 và hướng dẫn import](design/figma/HUONG-DAN.md) dùng khung iPhone 17 Pro 402 × 874; giữ Landing page riêng, 7 luồng mỗi nền tảng và tối đa 12 màn mỗi hàng. Header một hàng và Gợi ý cùng hệ xanh biển; Đối tác đứng trước footer. Các khối Figma dùng Auto Layout/padding, nút dùng component chung; sau xác thực vẫn tiếp tục đúng thao tác mua.

Dựng gói import: `python design/figma/build.py`; kiểm cấu trúc: `npm run test:figma`. ZIP được tạo tại `output/figma/THUTHANH-FIGMA-V35.zip`. Plugin đã kiểm bằng mô phỏng local; cần chạy lại để cập nhật canvas thật. Thư mục output không đưa vào Git; source plugin có thể dựng lại ZIP.

## Database và các file dữ liệu

- `thu_thanh_em3`: database ứng dụng, lưu sản phẩm, tài khoản, giỏ hàng, đơn, tồn kho và thanh toán.
- `thu_thanh_em3_test`: database riêng cho kiểm thử; dữ liệu trong đây được xóa/tạo lại khi test.

**Database đang chạy được MySQL lưu trên server**, không phải một file `.db` trong source. Có thể xem database bằng MySQL Workbench; chạy `SHOW VARIABLES LIKE 'datadir';` để biết thư mục MySQL lưu dữ liệu trên máy mình.

| File/thư mục trong source                  | Dùng để làm gì?                                             |
| ------------------------------------------ | ----------------------------------------------------------- |
| `backend/.env`                             | Thông tin kết nối MySQL và cấu hình backend                 |
| `backend/database/001-bookstore.sql`       | Tạo các bảng nghiệp vụ                                      |
| `backend/database/002-express-runtime.sql` | Tạo bảng session và hàng đợi email                          |
| `backend/database/catalog.json`            | Dữ liệu khởi tạo: 6 danh mục, 137 sản phẩm, 137 bản ghi ảnh |
| `backend/database/assets/`                 | Ảnh đi kèm dữ liệu khởi tạo                                 |

`db:migrate` tạo bảng còn thiếu; `db:seed` thêm catalog từ JSON và chép ảnh vào storage. Chạy lại seed giữ giá/tồn đã sửa. Các file này **không chứa tài khoản, đơn hoặc giao dịch cá nhân** để chia sẻ qua Git.

Khi chạy: **trình duyệt → Next.js → Express → MySQL**. Express kiểm quyền, tính tiền và xử lý tồn kho rồi lưu vào database. Dữ liệu vẫn còn sau khi tắt web; worker xử lý hạn đơn, đối soát và email.

## Cài từ bản clone

Yêu cầu: **Git, Node.js ≥ 22.13, npm ≥ 10 và MySQL 8.4 đã khởi động**. Các lệnh dưới đây dùng PowerShell; luôn chạy npm từ thư mục gốc dự án.

### 1. Clone, cài dependencies và tạo env

Thay `URL_REPOSITORY` bằng URL Git do người chia sẻ dự án cung cấp:

```powershell
git clone "URL_REPOSITORY" THUTHANH-EM3
cd THUTHANH-EM3
npm ci
Copy-Item backend/.env.example backend/.env
```

Nếu máy đã có env thì giữ file đang dùng. **Chỉ cần cấu hình `backend/.env`**; `.env.example` là mẫu để clone, không phải file chạy. Frontend mặc định kết nối API tại localhost:8001, không cần env riêng. Không commit env thật.

### 2. Tạo database và cấu hình kết nối

Mở MySQL Workbench, đăng nhập bằng tài khoản quản trị và chạy SQL dưới đây. Thay `your_password` bằng mật khẩu riêng:

```sql
CREATE DATABASE IF NOT EXISTS thu_thanh_em3 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS thu_thanh_em3_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'thu_thanh_em3'@'127.0.0.1' IDENTIFIED BY 'your_password';
GRANT ALL ON thu_thanh_em3.* TO 'thu_thanh_em3'@'127.0.0.1';
GRANT ALL ON thu_thanh_em3_test.* TO 'thu_thanh_em3'@'127.0.0.1';
```

Sửa `backend/.env` cho khớp server vừa tạo:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=thu_thanh_em3
DB_USERNAME=thu_thanh_em3
DB_PASSWORD=your_password
```

MySQL mặc định dùng cổng 3306; nếu server dùng 3307 thì sửa `DB_PORT` theo đó. Test tự dùng cùng host/port/user/password, nhưng **luôn ép database `thu_thanh_em3_test` và `NODE_ENV=test`**. Không cần env test; merchant/session/email của test là cấu hình giả riêng, không dùng secret thanh toán thật. Tài khoản MySQL cần quyền trên cả hai database như SQL bên trên.

Tạo secret bằng lệnh sau rồi dán kết quả vào `SESSION_SECRET` trong `backend/.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Giữ secret ổn định sau khi sử dụng. Nếu đổi cổng API, truyền `BACKEND_INTERNAL_URL` qua môi trường terminal chạy frontend; cấu hình mặc định không cần bước này.

### 3. Tạo bảng, nạp sản phẩm và tạo admin

```powershell
npm run db:migrate
npm run db:seed
npm run db:migrate:test
```

Máy mới chưa có admin. Tạo bằng CLI, không có mật khẩu mặc định:

```powershell
$env:ADMIN_EMAIL='admin@example.com'
$env:ADMIN_NAME='Quản trị Thu Thanh'
$password=Read-Host 'Mật khẩu admin' -AsSecureString
$env:ADMIN_PASSWORD=[System.Net.NetworkCredential]::new('', $password).Password
npm run admin
Remove-Item Env:ADMIN_PASSWORD
```

Mật khẩu tối thiểu 12 ký tự, tối đa 72 byte UTF-8. Khách hàng tự đăng ký trên web.

Nếu admin đã tồn tại và bạn muốn đổi mật khẩu, đặt các biến như trên rồi dùng `npm run admin -- --reset-password`. CLI không nâng quyền tài khoản khách.

### 4. Chạy ứng dụng

```powershell
npm run dev
```

Lệnh chạy đồng thời **web + API + worker**; Ctrl+C để dừng. MySQL phải đang chạy.

| Địa chỉ                      | Chức năng             |
| ---------------------------- | --------------------- |
| http://localhost:3001        | Website               |
| http://localhost:3001/admin  | Quản trị              |
| http://localhost:8001/health | Kiểm tra API/database |

## Kiểm thử và các lệnh cần biết

```powershell
npm run verify                 # Kiểm tra source, backend/frontend tests, build và typecheck
npx playwright install chromium
npm run test:e2e               # Kiểm thử trình duyệt, chạy sau verify
```

Hai bộ test dùng chung database test nên không chạy đồng thời. E2E dùng provider mô phỏng, không gọi merchant thật.

- Kiểm tra dịch vụ đang chạy: mở terminal khác, chạy `npm run test:http`.
- Chạy riêng từng phần: `npm run dev:api`, `npm run dev:web`, `npm run worker`.
- Chạy bản build: `npm run build`, sau đó chạy `npm run start:api`, `npm run start:web` và `npm run worker` trong các terminal riêng.
- Định dạng source: `npm run format`. Không commit `node_modules`, `.next`, `.runtime`, output test hoặc `backend/storage`.
- Chạy nền Windows: `powershell -ExecutionPolicy Bypass -File scripts/services.ps1 -Action start`; thay `start` bằng `status` hoặc `stop` để quản lý. Launcher không ghi log; muốn xem lỗi trực tiếp dùng `npm run dev`.

## Thanh toán, email và lưu dữ liệu

Để nhận thông báo VNPAY về máy local: chạy `npm run dev`, mở terminal khác chạy `npm run payment:tunnel`, đăng ký URL IPN được in với VNPAY rồi chạy `npm run payment:check`. Xem [hướng dẫn test IPN từng bước](docs/VNPAY-SANDBOX.md), gồm cài cloudflared và kiểm tra kết quả.

**VNPAY Sandbox:** điền merchant/secret trong backend env, đặt `VNPAY_ENV=sandbox`, `VNPAY_DEFERRED=false`, return URL `http://localhost:3001/payment/vnpay-return`. IPN cần URL HTTPS đã đăng ký với VNPAY, trỏ tới `/api/v1/payments/vnpay/ipn`. Chỉ IPN/query đã xác minh mới ghi đã thanh toán; bộ test không thay thế nghiệm thu với provider. Có thể duyệt hàng, đăng ký và đặt đơn khi chưa cấu hình thanh toán.

**Email:** mặc định `MAIL_TRANSPORT=disabled`. Muốn gửi thư khôi phục, cấu hình SMTP bằng các biến `MAIL_*` trong backend env và chạy worker. Gửi email thật cần kiểm chứng riêng.

Ảnh upload nằm trong `backend/storage/public`; dữ liệu ứng dụng nằm trong MySQL. Khi chuyển máy cùng dữ liệu đang sử dụng, cần **backup/restore database và storage**, giữ env private và SESSION_SECRET ổn định; clone + seed chỉ tạo catalog ban đầu. Kiểm tra danh sách staged trước commit để không đưa secret hoặc dữ liệu riêng vào Git.

Chi tiết: [API](docs/API.md), [database và nghiệp vụ](docs/DATABASE.md), [trạng thái kiểm chứng](docs/STATUS.json).

D83: Thẻ sản phẩm có Mua ngay và nút giỏ hàng (mỗi lần1sản phẩm); bấm ảnh/tên để xem thông tin và chọn số lượng. Bán chạy tối đa10sản phẩm, cuộn dọc trong bảng xếp hạng. Plugin Figma V35 đã đồng bộ, cần import và Present để duyệt native.
