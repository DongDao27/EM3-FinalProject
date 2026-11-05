# Kiểm tra trước commit và nộp — 06/11/2026

EM3 dùng database `thu_thanh_em3`, kiểm thử dùng `thu_thanh_em3_test`. Bản còn lại dùng `thu_thanh` / `thu_thanh_test`. Cùng MySQL server `127.0.0.1:3307` nhưng schema độc lập; đã xác minh bằng truy vấn trực tiếp. Dữ liệu catalog giống nhau do cùng seed, đơn/tài khoản/tồn không đồng bộ giữa hai bản. Env private và số sản phẩm/đơn/tài khoản ứng dụng trước/sau giữ nguyên.

| Kiểm tra local cuối           | Kết quả EM3                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| npm run verify                | Đạt: syntax, Prettier, repo check, tests, build, TypeScript                                                |
| Backend / API / payment tools | 54 / 7 / 4 bài đạt                                                                                         |
| E2E đầy đủ                    | 23/23 đạt, 2,1 phút                                                                                        |
| Production build              | 22 route                                                                                                   |
| npm audit                     | 0 vulnerability                                                                                            |
| Figma strict mock             | V35, 180 khung, 3.684 route; process exit0                                                                 |
| UI catalog thật               | 21 lượt trang, 375/768/1440px; không pageerror/resource error bất thường/ảnh hỏng đang hiển thị/tràn ngang |

E2E kiểm tra auth, tìm kiếm/bộ lọc, giỏ/số lượng, tiếp tục mua một lần, checkout/phí giao, cash/QR/amount/chữ ký/replay/pending/IPN/cancel, quyền admin, ảnh/sản phẩm/archive/restore, tồn/ledger, doanh thu và responsive. Screenshots desktop/mobile/cash/QR đã xem. UI và plugin V35 giữ nguyên theo phạm vi đã chốt; không tự đồng bộ V36.

Không xác định được source thừa cần xóa ở EM3 trong đợt này. Đã sửa README có nhãn/đường dẫn plugin cũ và kiểm tra định dạng. Candidate Git không chứa .env private, dependencies, build, log, upload hoặc runtime. Secret scan cơ bản không thấy token/private key; env mẫu dùng giá trị trống/placeholder. Base64 Figma và license icon được giữ vì cần cho plugin offline. Đây không phải chứng nhận an toàn tuyệt đối.

Logs local `.runtime/d88-*`; screenshots `output/e2e`. Có thể chạy lại `npm run verify` và `npm run test:e2e` từ root. Chỉ fixture database test bị dựng lại; không chuyển tiền/gửi email thật. Merchant/IPN/query thật đầy đủ, SMTP, production/staging và native Figma vẫn cần nghiệm thu riêng. Các bộ local đạt không tự khẳng định điểm10.

Chủ dự án cho phép commit/push riêng EM3 tới [DongDao27/EM3-FinalProject](https://github.com/DongDao27/EM3-FinalProject) theo D89. Repo đích ban đầu trống; dùng nhánh main và Git author đã cấu hình, không bịa lịch sử. Xem STATUS để biết receipt publication.

ZIP source tại `output/submission/ThuThanh-EM3-source-2026-11-06.zip` không chứa .git/env riêng/dependencies/runtime/business DB/uploads. Schema SQL/seed/ảnh catalog vẫn có để dựng app. Không stage các artifact local này vào Git.
