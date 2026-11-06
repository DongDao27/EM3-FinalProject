# Test thông báo VNPAY Sandbox trên máy local

IPN là thông báo từ server VNPAY tới backend, khác với trang trình duyệt quay về. Bản này dùng đường dẫn HTTPS tạm để nhận IPN; ứng dụng và database vẫn chạy trên máy bạn.

## Chạy nhanh trước buổi trình bày

Trên máy hiện tại, nếu MySQL portable chưa chạy:

```powershell
powershell -ExecutionPolicy Bypass -File D:\ThuThanh-WebDesign\scripts\mysql-local.ps1 -Action start
```

Mở ba terminal PowerShell, giữ hai terminal đầu chạy trong suốt buổi demo:

```powershell
# Terminal 1: web + API + worker
cd D:\THUTHANH-EM3
npm run dev
```

```powershell
# Terminal 2: nhận IPN từ VNPAY
cd D:\THUTHANH-EM3
npm run payment:tunnel
```

```powershell
# Terminal 3: kiểm tra trước khi thanh toán
cd D:\THUTHANH-EM3
npm run payment:check
```

Mở http://localhost:3001. URL IPN do terminal 2 in ra phải được đăng ký với merchant Sandbox; mỗi lần mở Quick Tunnel mới có thể cần cập nhật lại. Không cần Railway hoặc deploy website. Tunnel IPN chỉ phục vụ callback; không dùng nó làm URL web để quét QR từ điện thoại.

Kiểm thử tự động trước buổi trình bày (chạy tuần tự, không dùng database ứng dụng):

```powershell
cd D:\THUTHANH-EM3
npm run verify
npm run test:e2e
```

Kịch bản demo: thanh toán NCB thành công → xem đơn cập nhật; hủy tại VNPAY → đơn vẫn chưa thanh toán; tải lại trang kết quả → không thu/trừ tồn lần hai; admin nhận tiền mặt cho đơn pickup → hoàn tất. Đối với QR tại quầy, demo trên trình duyệt cùng máy; điện thoại không truy cập được `localhost` của máy tính. IPN/query thật của merchant cần kiểm chứng riêng, các tests tự động chỉ dùng fixture.

## 1. Chạy ứng dụng

Bật MySQL và chạy từ thư mục gốc:

```powershell
npm run dev
```

Mở http://localhost:8001/health để kiểm tra API/database. `backend/.env` phải có merchant Sandbox hợp lệ, `VNPAY_ENV="sandbox"`, `VNPAY_DEFERRED="false"`; giữ `VNPAY_RETURN_URL="http://localhost:3001/payment/vnpay-return"`. Frontend dùng API local mặc định; không cần tạo env frontend hoặc đổi sang URL tunnel. Không đưa merchant secret vào frontend.

## 2. Mở đường dẫn nhận IPN

Cài cloudflared nếu máy chưa có, sau đó mở lại terminal:

```powershell
winget install --id Cloudflare.cloudflared --exact
```

Mở terminal thứ hai tại thư mục gốc:

```powershell
npm run payment:tunnel
```

Lệnh mở relay tại 127.0.0.1:18081 và in địa chỉ dạng:

```text
https://ten-ngau-nhien.trycloudflare.com/api/v1/payments/vnpay/ipn
```

Giữ terminal này mở. Relay chỉ chuyển GET đúng đường dẫn IPN tới backend; các đường dẫn khác bị từ chối. Terminal in `VNPAY IPN ACK=...` khi backend trả kết quả, không ghi file log hay query/chữ ký. Ctrl+C dừng tunnel. Nếu đã có cloudflared portable tại `.runtime/tools/cloudflared.exe`, công cụ ưu tiên dùng bản đó.

Đường dẫn thay đổi khi mở Quick Tunnel mới. Muốn giữ nguyên địa chỉ giữa các phiên cần đường dẫn tunnel cố định do bạn cấu hình riêng. Quick Tunnel là công cụ thử nghiệm, không cam kết luôn sẵn sàng. [Tài liệu Cloudflare](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## 3. Đăng ký IPN với VNPAY Sandbox

Đăng ký **toàn bộ URL vừa in** làm IPN URL cho đúng merchant `VNPAY_TMN_CODE` đang dùng. Nếu tài khoản merchant không có chức năng sửa IPN, gửi URL cho bộ phận hỗ trợ tích hợp VNPAY để cập nhật. Không chỉ đổi Return URL.

Không có thao tác tự đăng ký IPN từ source. Biến `VNPAY_IPN_URL` trong backend env chỉ để công cụ kiểm tra một URL do bạn cấu hình. Nếu dùng Quick Tunnel, nên để biến này trống: công cụ tự đọc URL của phiên tunnel trong `.runtime/vnpay-tunnel.json`. Một giá trị cũ trong env sẽ được ưu tiên hơn URL phiên hiện tại.

Giữ Return URL local để trình duyệt quay về đúng session:

```dotenv
VNPAY_RETURN_URL="http://localhost:3001/payment/vnpay-return"
VNPAY_IPN_URL=""
```

Nếu sửa cấu hình backend, khởi động lại `npm run dev` và tạo đơn mới. Không cần restart để công cụ kiểm tra đọc biến IPN; không đổi SESSION_SECRET.

## 4. Kiểm tra kết nối trước khi thanh toán

Mở terminal thứ ba tại thư mục gốc:

```powershell
npm run payment:check
```

Các dòng phải là `OK`: cấu hình endpoint Sandbox, API/MySQL, IPN local và IPN HTTPS. Yêu cầu thử không có chữ ký nên backend phải trả `RspCode=97`; đây là kết quả đúng để xác nhận đường truyền, **không phải giao dịch thanh toán thành công**. Công cụ không tạo đơn, không ký callback giả, không xác minh secret có khớp merchant phía VNPAY hay chưa.

Nếu public check lỗi, đợi cloudflared báo kết nối rồi chạy lại; kiểm tra mạng và terminal tunnel. Nếu cấu hình merchant/IPN chưa được VNPAY cập nhật, public check vẫn có thể OK nhưng VNPAY chưa gửi giao dịch về đúng nơi.

## 5. Thanh toán và quan sát thông báo

Mở http://localhost:3001, đăng nhập khách hàng, tạo đơn mới rồi thanh toán bằng VNPAY Sandbox. Chọn NCB và dùng thẻ thử VNPAY công bố: `9704198526191432198`, chủ thẻ `NGUYEN VAN A`, ngày phát hành `07/15`, OTP `123456`. Hoàn thành trước hạn đơn. [Thông tin thẻ từ VNPAY](https://sandbox.vnpayment.vn/apis/vnpay-demo/).

Quan sát terminal tunnel:

| ACK  | Ý nghĩa                                                                            |
| ---- | ---------------------------------------------------------------------------------- |
| `00` | Backend đã xử lý thông báo hợp lệ; kiểm tra trạng thái đơn tương ứng               |
| `02` | Thông báo đã được xử lý trước đó; không cộng doanh thu hoặc trừ tồn lần nữa        |
| `97` | Chữ ký hoặc dữ liệu callback không hợp lệ; cũng là mã đúng khi chạy probe không ký |
| `01` | Không tìm thấy lần thanh toán tương ứng                                            |
| `04` | Số tiền không khớp                                                                 |
| `99` | Backend không xử lý được; kiểm tra API/database                                    |

ACK00 không tự khẳng định đơn đã paid: thông báo thất bại hoặc tiền về muộn cũng cần xử lý theo trạng thái đơn. Trang Return và trang đơn tự thăm dò trạng thái backend. Chỉ bằng chứng IPN/query hợp lệ mới có thể ghi nhận thanh toán. [Quy tắc IPN của VNPAY](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html).

Test thêm hủy ở VNPAY và tải lại trang kết quả: đơn hủy không được paid, thao tác tải lại không được ghi nhận tiền/tồn lần hai. Nếu đơn paid nhưng không thấy IPN trong terminal, có thể query đã xác minh thanh toán; điều đó chưa chứng minh VNPAY gọi được IPN.

Để nghiệm thu IPN thật: cần giao dịch Sandbox trên đúng merchant, thấy callback ở relay, kết quả trong đơn và bằng chứng `source=ipn` trong bảng payment_events/payment_receipts. Các bài test tự động chỉ xác minh hành vi với fixture. Không gửi toàn bộ URL callback chứa chữ ký lên chat hoặc Git.
