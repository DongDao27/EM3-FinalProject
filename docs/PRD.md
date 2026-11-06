# Phạm vi Thu Thanh EM3

Nhà sách gồm storefront, tài khoản customer và admin: tra cứu catalog, giỏ lưu dài, đặt delivery/pickup, thanh toán VNPAY Sandbox; admin quản lý catalog/ảnh/giảm giá/tồn/đơn/báo cáo. Có khôi phục mật khẩu qua SMTP và đăng ký newsletter.

Next.js làm giao diện; Express/MySQL quyết định quyền, tiền, tồn và trạng thái. Session cookie/CSRF, không lưu bearer token trong localStorage. Quy tắc chi tiết tại [DATABASE.md](DATABASE.md), hợp đồng tại [API.md](API.md).

Chỉ chạy và kiểm thử local. Không có POS khách vãng lai, marketplace, voucher engine, tự hoàn tiền, tích hợp vận chuyển, native app hoặc merchant QR tại quầy. SMTP thật và giao dịch merchant/IPN thật cần kiểm chứng riêng; fixture không thay thế nghiệm thu provider.

Tiêu chí local: clone có thể cài từ một env backend; migrate/seed/admin/dev/verify/E2E chạy được, database test riêng, không mất dữ liệu/private env/storage. Kết quả thực tế tại [STATUS.json](STATUS.json).

## D85 — Thu tiền tại quầy và đồng bộ giao diện

Pickup có Thanh toán ngay / Thanh toán tại quầy / Hủy đơn; delivery chỉ Thanh toán / Hủy đơn. Chọn tại quầy giữ unpaid/hạn giữ hàng cũ, quay về danh sách. Admin POST /api/v1/admin/orders/{code}/cash-payment body rỗng: kiểm role+CSRF, khóa order/products/reservations, nhận đủ payable_total do server tính, receipt provider=cash allocation=accepted + attempt succeeded + audit actor, consume tồn và completed/fulfilled trong cùng transaction. Retry/concurrent chỉ ghi một khoản thu, chặn delivery/closed/expired/paid/pending/unknown/reconciliation/thiếu reservation.
Admin payment-attempts cho pickup trả qr_kind=checkout_url, qr_content=/api/v1/payments/vnpay/checkout/{reference}. QR tạo local từ frontend origin + path; public GET reference ngẫu nhiên kiểm counter marker, trạng thái/hạn rồi 302 no-store đến signed VNPAY URL đúng amount. Query amount từ client bị bỏ qua. GET không ghi paid; chỉ IPN/query verified accepted của đúng counter attempt mới tự hoàn tất và popup. Customer online vẫn cần fulfillment. Native bank-app merchant QR chưa tích hợp. Điện thoại cần origin frontend truy cập được, không dùng localhost của máy tính để quét từ thiết bị khác.
Đối tác chỉ landing. Figma V35: 180khung/178prototype/2landingreview, 7luồng/platform/max12màn/hàng, preserve ảnh chỉnhtay và V34upgrade; QR Figma chỉ mẫu văn bản vô hại, không chuyển tiền. Nghiệm thu native canvas là người dùng import/Present lại, không suy từ mock. Không schema migration hoặc reset/main-data/env/provider thật.
