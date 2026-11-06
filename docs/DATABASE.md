# Database Thu Thanh EM3

**Engine:** MySQL 8.4, InnoDB, utf8mb4. Backend Express kết nối bằng thư viện `mysql2`; cấu hình lấy từ `backend/.env`. Connection và thời gian nghiệp vụ dùng UTC, báo cáo tính ngày theo Asia/Ho_Chi_Minh.

Mật khẩu tài khoản mới dùng bcrypt. Login cũng xác minh Argon2id/Argon2i của tài khoản cũ và bcrypt dạng `$2y$`; giữ nguyên hash đang lưu, không yêu cầu đổi mật khẩu chỉ vì chuyển backend.

| Database             | Mục đích                                                            |
| -------------------- | ------------------------------------------------------------------- |
| `thu_thanh_em3`      | Dữ liệu ứng dụng: tài khoản, catalog, giỏ, đơn, tồn kho, thanh toán |
| `thu_thanh_em3_test` | Fixture kiểm thử; các bài test xóa/tạo lại dữ liệu tại đây          |

## File nào dùng để tạo dữ liệu?

- `backend/database/001-bookstore.sql`: schema các bảng nghiệp vụ.
- `backend/database/002-express-runtime.sql`: bảng `em3_sessions` và `em3_mail_jobs`.
- `backend/database/catalog.json`: catalog seed, gồm 6 danh mục, 137 sản phẩm và 137 bản ghi ảnh.
- `backend/database/assets/`: file ảnh cho catalog seed.
- `backend/.env`: host/port/tên database/user/password; đây là cấu hình, không chứa database.

Từ root, `npm run db:migrate` áp dụng các file SQL chưa chạy; bảng `em3_migrations` lưu tên migration đã áp dụng. `npm run db:seed` thêm catalog còn thiếu và chép ảnh vào storage, giữ giá/tồn đã sửa. Máy mới tạo admin riêng qua `npm run admin`; seed không tạo tài khoản, đơn hoặc giao dịch giả.

## Dữ liệu thật nằm ở đâu?

MySQL lưu các file nội bộ trong thư mục dữ liệu của server. Xem vị trí bằng SQL:

```sql
SHOW VARIABLES LIKE 'datadir';
```

MySQL Workbench có thể xem các bảng trong `thu_thanh_em3`. Khi web chạy, Express đọc/ghi các bảng này; thay đổi không được ghi ngược vào file SQL hoặc `catalog.json`. Tắt web không xóa database.

## Các bảng chính

| Nhóm            | Bảng                                                                             |
| --------------- | -------------------------------------------------------------------------------- |
| Tài khoản/phiên | users, password_reset_tokens, em3_sessions                                       |
| Catalog/giỏ     | categories, products, product_images, carts, cart_items                          |
| Báo giá/đơn     | quotes, orders, order_items, stock_reservations                                  |
| Thanh toán      | payment_attempts, payment_receipts, payment_events, reconciliation_cases         |
| Sổ nghiệp vụ    | inventory_movements, order_status_histories, idempotency_keys, refunds, settings |
| Liên lạc        | newsletter_subscriptions, em3_mail_jobs                                          |

Tiền lưu VND nguyên. Tồn khả dụng = `stock_on_hand - stock_reserved`; mutation tiền/tồn dùng transaction và row lock. Đơn giữ snapshot giá, receipt/idempotency có unique key để không xử lý hai lần. Chỉ IPN/query đã xác minh mới ghi paid.

Database, `backend/storage` và env cần được sao lưu riêng. Clone + seed chỉ dựng catalog ban đầu; muốn chuyển dữ liệu khách/đơn đang có cần backup/restore MySQL. Giữ `SESSION_SECRET` ổn định để đọc được mail job đã mã hóa. Không reset database ứng dụng để chạy test.

## Quy tắc nghiệp vụ

- Khách chưa đăng nhập được xem/tìm sản phẩm; customer chỉ mua và xem đơn của mình; admin quản lý catalog/tồn/đơn. Không có đăng ký admin công khai.
- Giá, quyền, tồn và trạng thái do server quyết định. Giảm phần trăm làm tròn VND; không truyền đồng thời sale_price và discount_percent. Phí delivery 25.000đ, pickup 0đ. Không hỗ trợ đổi trả/hoàn tiền.
- Giỏ không giữ giá/tồn. Quote và checkout kiểm tra giá, tồn, fingerprint giỏ và thời hạn; đơn lưu snapshot và tạo idempotent. Grade 1–12 chỉ dùng cho sách giáo khoa; quantity tối đa 99.
- Delivery giữ hàng 5 phút, pickup 24 giờ. Reserve tăng stock_reserved; receipt được chấp nhận giảm stock_on_hand và stock_reserved đúng một lần. Hủy/hết hạn hợp lệ giải phóng tồn đúng một lần.
- Lifecycle: open → completed/cancelled/expired; không mở lại đơn terminal. Payment: unpaid/pending/paid/reconciliation_required. Giao hàng/hoàn tất cần paid; admin không tự PATCH paid.
- Hủy đơn kiểm tra ownership và bằng chứng thanh toán, phục hồi giỏ đúng một lần cùng transaction. Scheduler hết hạn không tự khôi phục giỏ. Lần đặt lại dùng giá/tồn hiện hành.
- VNPAY xác minh HMAC-SHA512, merchant/reference/amount/currency/status/transaction/time. Return chỉ hiển thị/kích hoạt query; IPN/query hợp lệ mới ghi nhận tiền. Callback lặp, tiền về muộn hoặc sai số tiền được lưu bằng chứng, không tăng doanh thu hay trừ tồn lần hai.
- Query không chắc chắn giữ reservation và mở đối soát; không tự mở lần thu tiền mới. Không gọi provider khi giữ khóa database.
- Doanh thu lấy từ accepted receipt theo paid_at, ngày Việt Nam; tiền hàng sau giảm và phí giao tách riêng. Không tính duplicate/late/mismatch hoặc bịa giao dịch cho biểu đồ.
- Khôi phục mật khẩu chỉ dành cho customer có email: token hash, hạn 60 phút, dùng một lần; mail job mã hóa, đổi mật khẩu vô hiệu session cũ. Newsletter cần consent, chưa có gửi chiến dịch.

## D85 — Thu tiền tại quầy và đồng bộ giao diện

Pickup có Thanh toán ngay / Thanh toán tại quầy / Hủy đơn; delivery chỉ Thanh toán / Hủy đơn. Chọn tại quầy giữ unpaid/hạn giữ hàng cũ, quay về danh sách. Admin POST /api/v1/admin/orders/{code}/cash-payment body rỗng: kiểm role+CSRF, khóa order/products/reservations, nhận đủ payable_total do server tính, receipt provider=cash allocation=accepted + attempt succeeded + audit actor, consume tồn và completed/fulfilled trong cùng transaction. Retry/concurrent chỉ ghi một khoản thu, chặn delivery/closed/expired/paid/pending/unknown/reconciliation/thiếu reservation.
Admin payment-attempts cho pickup trả qr_kind=checkout_url, qr_content=/api/v1/payments/vnpay/checkout/{reference}. QR tạo local từ frontend origin + path; public GET reference ngẫu nhiên kiểm counter marker, trạng thái/hạn rồi 302 no-store đến signed VNPAY URL đúng amount. Query amount từ client bị bỏ qua. GET không ghi paid; chỉ IPN/query verified accepted của đúng counter attempt mới tự hoàn tất và popup. Customer online vẫn cần fulfillment. Native bank-app merchant QR chưa tích hợp. Điện thoại cần origin frontend truy cập được, không dùng localhost của máy tính để quét từ thiết bị khác.
Đối tác chỉ landing. Figma V35: 180khung/178prototype/2landingreview, 7luồng/platform/max12màn/hàng, preserve ảnh chỉnhtay và V34upgrade; QR Figma chỉ mẫu văn bản vô hại, không chuyển tiền. Nghiệm thu native canvas là người dùng import/Present lại, không suy từ mock. Không schema migration hoặc reset/main-data/env/provider thật.
