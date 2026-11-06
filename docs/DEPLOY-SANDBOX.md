# Deploy EM3 + VNPAY Sandbox trên Railway

Phạm vi: website demo public HTTPS, thanh toán thử Sandbox; không nhận tiền thật. Dùng một service ứng dụng (Next.js + Express + worker) và một service MySQL. Không cần mua tên miền, có thể dùng domain Railway cấp.

## 1. Tài khoản và chi phí

Đăng nhập [Railway](https://railway.com/) bằng GitHub. [Trial](https://docs.railway.com/pricing/free-trial) hiện cấp $5 credit một lần, hết hạn sau tối đa 30 ngày; không bảo đảm miễn phí chạy liên tục. Limited Trial có thể hạn chế outbound tới VNPAY. Kiểm tra trạng thái xác minh, credit và Usage trước khi deploy. Không bật gói trả phí nếu chưa chọn ngân sách. Dừng/xóa tài nguyên sau buổi demo nếu không dùng; backup trước khi hết trial.

Có thể thêm và kết nối Railway trong trợ lý để triển khai trực tiếp. Chưa kết nối tài khoản thì source chỉ được chuẩn bị, chưa có public URL.

## 2. MySQL riêng trên cloud

Tạo Empty Project, thêm MySQL service. Đặt `MYSQL_DATABASE=thu_thanh_em3` khi khởi tạo database. Giữ MySQL private, không mở public TCP để ứng dụng kết nối. Service có volume database riêng. Dữ liệu local không tự chuyển lên cloud.

Nếu database đã khởi tạo với tên mặc định khác, tạo thêm schema `thu_thanh_em3` bằng database console; không đổi guard trong source sang database tùy ý, không xóa database đã có dữ liệu.

Để tiết kiệm RAM demo, kiểm tra Start Command của MySQL: nếu template đặt buffer pool `1G`, giảm xuống `128M` và giới hạn kết nối. Ví dụ với image MySQL chính thức:

```text
docker-entrypoint.sh mysqld --innodb-use-native-aio=0 --disable-log-bin --performance_schema=0 --innodb-buffer-pool-size=128M --max-connections=40
```

Giữ nguyên image/version của database đã có volume; không đổi major version để tiết kiệm tài nguyên. Theo dõi RAM/Usage thực tế của cả hai service; credit trial có thể hết trước 30 ngày.

## 3. Service ứng dụng

Thêm service từ repo `DongDao27/EM3-FinalProject`, branch `main`, root directory là root repo. Railway dùng `Dockerfile` và `railway.json`. Tạo public domain trong Settings → Networking. Gắn volume vào `/data` để giữ ảnh upload/seed qua redeploy. Dùng một replica cho bài demo và tắt chế độ tự ngủ vì worker cần chạy để đối soát/hết hạn đơn.

Đặt các Variables sau trước lần deploy thành công:

| Biến             | Giá trị                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `NODE_ENV`       | `production` (runtime web, không phải tiền thật)                           |
| `PORT`           | Railway tự cấp; không đặt 8001                                             |
| `HOST`           | `127.0.0.1`                                                                |
| `TRUST_PROXY`    | `loopback`                                                                 |
| `COOKIE_SECURE`  | `true`                                                                     |
| `SESSION_COOKIE` | `thuthanh_em3_session`                                                     |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên riêng ≥32 ký tự, giữ ổn định                              |
| `FRONTEND_URL`   | `https://<domain-app>`; có thể để source suy ra từ `RAILWAY_PUBLIC_DOMAIN` |
| `STORAGE_ROOT`   | `/data`                                                                    |
| `DB_HOST`        | `${{MySQL.MYSQLHOST}}` (đổi tên service nếu khác)                          |
| `DB_PORT`        | `${{MySQL.MYSQLPORT}}`                                                     |
| `DB_DATABASE`    | `thu_thanh_em3`                                                            |
| `DB_USERNAME`    | `${{MySQL.MYSQLUSER}}`                                                     |
| `DB_PASSWORD`    | `${{MySQL.MYSQLPASSWORD}}`                                                 |
| `VNPAY_ENV`      | `sandbox`                                                                  |
| `VNPAY_DEFERRED` | `true` trong lúc chuẩn bị merchant                                         |
| `MAIL_TRANSPORT` | `disabled` nếu chưa dùng SMTP                                              |

Tạo SESSION_SECRET tại terminal của bạn, rồi nhập qua Variables, không gửi lên chat/Git:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Docker build chỉ dùng source/dependencies, không có env private. Pre-deploy chạy migration idempotent, không reset dữ liệu. Không đưa credential vào build arguments hoặc NEXT_PUBLIC. Backend chỉ bind loopback8001; public port thuộc Next.js. Khi một process chết, supervisor dừng cả service để Railway khởi động lại, tránh web còn chạy nhưng worker/API đã mất.

## 4. Nạp catalog và tạo admin

Sau khi service có volume và database sẵn sàng, mở terminal/SSH của service đang chạy. Chạy một lần:

```bash
npm run db:seed
```

Seed tạo catalog và copy ảnh vào volume, không tạo doanh số/đơn giả. Không chạy seed trong image build hoặc pre-deploy vì volume runtime chưa được mount ở bước đó. Để tạo admin, cung cấp ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD trong môi trường terminal rồi chạy `npm run admin`; xóa ADMIN_PASSWORD khỏi phiên sau khi dùng. Không có mật khẩu admin mặc định; không đưa mật khẩu vào command arguments/history.

## 5. Bật thanh toán Sandbox

Nhập merchant Sandbox của bạn qua Variables:

```dotenv
VNPAY_ENV=sandbox
VNPAY_DEFERRED=false
VNPAY_TMN_CODE=<merchant-sandbox>
VNPAY_HASH_SECRET=<secret-sandbox>
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_QUERY_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
VNPAY_RETURN_URL=https://<domain-app>/payment/vnpay-return
```

Đăng ký **IPN URL** cho đúng merchant với VNPAY:

```text
https://<domain-app>/api/v1/payments/vnpay/ipn
```

Chỉ sửa Return URL hoặc đặt biến env không tự đăng ký IPN. Domain public phải ổn định và không có trang login/challenge chặn IPN. Sau khi đổi Variables, redeploy. Công cụ payment:tunnel/payment:check hiện dành cho Sandbox local, không dùng làm launcher trên Railway. Query IP nếu VNPAY yêu cầu phải cấu hình theo thông tin server/merchant được cung cấp, không đoán một IP cố định.

## 6. Nghiệm thu public

```bash
npm run deploy:smoke -- https://<domain-app>
```

Smoke kiểm tra web/API/database, cookie HTTPS và unsigned IPN bị từ chối ACK97. ACK97 không phải thanh toán thành công. Sau đó kiểm tra bằng trình duyệt: đăng ký/login, ảnh sản phẩm, checkout, VNPAY Sandbox thành công/hủy, tải lại không ghi nhận hai lần, pickup/cash/QR và admin. Dùng thẻ thử VNPAY công bố trong [tài liệu Sandbox](VNPAY-SANDBOX.md), không dùng thẻ/tiền thật.

Để gọi là nghiệm thu IPN thật của Sandbox: cần bằng chứng callback từ VNPAY vào merchant/domain này và receipt/event có source=ipn; fixtures hoặc chỉ trang Return thành công không thay bằng chứng đó. Không đăng URL callback có chữ ký hoặc secret vào Git/chat. Test SMTP là phần riêng nếu bật email.

Chỉ đánh dấu deploy hoàn tất sau khi có public URL và các kiểm tra thực tế. Docker/CI/local pass là bước chuẩn bị, không tự chứng minh Railway hoặc VNPAY đã kết nối.
