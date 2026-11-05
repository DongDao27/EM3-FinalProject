# API Thu Thanh EM3

Backend: http://localhost:8001/api/v1. Frontend proxy cùng origin tại http://localhost:3001/api/v1. Hợp đồng đầy đủ: [openapi.json](openapi.json).

Response: `{ data, meta: { request_id, server_time, pagination? } }`; lỗi: `{ error: { code, message, fields }, meta }`. Đơn dùng order_code, quote/payment attempt dùng UUID; tiền VND nguyên. Mutation cần session cookie và X-XSRF-TOKEN; client lấy CSRF cookie trước mỗi mutation. Customer chỉ truy cập giỏ/đơn của mình; API kiểm tra quyền admin.

| Nhóm       | Endpoint                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Public     | GET storefront, categories, products, products/:id                                                                      |
| Auth       | POST auth/register, auth/login, auth/logout, auth/forgot-password, auth/reset-password; GET auth/me; PATCH auth/profile |
| Home       | GET home, cá nhân hóa theo session                                                                                      |
| Cart       | GET cart; POST cart/items; PATCH/DELETE cart/items/:id                                                                  |
| Checkout   | POST checkout/quotes; POST orders với quote_id và Idempotency-Key                                                       |
| Orders     | GET orders, orders/:code; POST orders/:code/cancel, orders/:code/reorder                                                |
| Payment    | POST orders/:code/payment-attempts; GET orders/:code/payment-status; GET payments/vnpay/return, payments/vnpay/ipn      |
| Newsletter | POST newsletter/subscriptions với email và consent=true                                                                 |
| Admin      | Dashboard/revenue, categories/products/images, inventory, orders/history/fulfillment, reconciliation-cases              |

Idempotency-Key dài 8–100 ký tự ASCII hợp lệ. Server quyết định tổng tiền. Conflict trả409, validation422, guest401, thiếu quyền403. Refund write403 theo chính sách cửa hàng.

IPN dùng response riêng `{ RspCode, Message }`:00 đã xử lý,01 không tìm thấy,02 đã xác nhận,04 sai tiền,97 chữ ký/dữ liệu không hợp lệ,99 lỗi xử lý. Health ngoài prefix: GET /health kiểm kết nối MySQL. Xem [test Sandbox](VNPAY-SANDBOX.md) và [quy tắc dữ liệu/nghiệp vụ](DATABASE.md).

D83: Bán chạy trên /home và /storefront trả tối đa10 sản phẩm hợp lệ, giữ thứ tự sold_count thực rồi ghim quản trị; không tạo lượt bán. CTA card Mua ngay/thêm giỏ dùng POST /cart/items hiện hành, quantity1; giá/tồn/quyền vẫn do backend xác nhận.

## D85 — Thu tiền tại quầy và đồng bộ giao diện

Pickup có Thanh toán ngay / Thanh toán tại quầy / Hủy đơn; delivery chỉ Thanh toán / Hủy đơn. Chọn tại quầy giữ unpaid/hạn giữ hàng cũ, quay về danh sách. Admin POST /api/v1/admin/orders/{code}/cash-payment body rỗng: kiểm role+CSRF, khóa order/products/reservations, nhận đủ payable_total do server tính, receipt provider=cash allocation=accepted + attempt succeeded + audit actor, consume tồn và completed/fulfilled trong cùng transaction. Retry/concurrent chỉ ghi một khoản thu, chặn delivery/closed/expired/paid/pending/unknown/reconciliation/thiếu reservation.
Admin payment-attempts cho pickup trả qr_kind=checkout_url, qr_content=/api/v1/payments/vnpay/checkout/{reference}. QR tạo local từ frontend origin + path; public GET reference ngẫu nhiên kiểm counter marker, trạng thái/hạn rồi 302 no-store đến signed VNPAY URL đúng amount. Query amount từ client bị bỏ qua. GET không ghi paid; chỉ IPN/query verified accepted của đúng counter attempt mới tự hoàn tất và popup. Customer online vẫn cần fulfillment. Native bank-app merchant QR chưa tích hợp. Điện thoại cần origin frontend truy cập được, không dùng localhost của máy tính để quét từ thiết bị khác.
Đối tác chỉ landing. Figma V35: 180khung/178prototype/2landingreview, 7luồng/platform/max12màn/hàng, preserve ảnh chỉnhtay và V34upgrade; QR Figma chỉ mẫu văn bản vô hại, không chuyển tiền. Nghiệm thu native canvas là người dùng import/Present lại, không suy từ mock. Không schema migration hoặc reset/main-data/env/provider thật.
