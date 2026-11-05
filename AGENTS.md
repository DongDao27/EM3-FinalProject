# Thu Thanh EM3

Đọc START-HERE.md, docs/STATUS.json, HANDOFF.md, PROGRESS.md, DECISIONS.md, PRD.md và TASKS.json trước khi sửa. Kiểm tra git/source thực tế; không ghi đè việc chưa commit. Dùng npm workspaces từ root, một lockfile, không cài riêng từng package.

Express/MySQL quyết định quyền, giá, tồn và trạng thái. Giữ session/CSRF, transaction/row lock/idempotency. Return không tự ghi paid; chỉ provider evidence đã xác minh. Không gọi provider trong DB lock. Không reset database ứng dụng, env hoặc storage để sửa lỗi.

Chỉ backend/.env cần cấu hình; backend/.env.example là mẫu. Test qua backend/scripts/test.js, luôn dùng thu_thanh_em3_test, provider/mail giả; không thêm env test/frontend trùng mặc định. Không commit secret/log/dependencies/generated builds. Không gửi giao dịch/email thật từ yêu cầu cleanup.

Ghi acceptance trước sửa; kiểm tra phù hợp, cập nhật TASKS → PROGRESS → HANDOFF → STATUS bằng kết quả thật. Giữ checkpoint ngắn, bằng chứng tại STATUS thay vì thêm báo cáo trùng. Done cần source và acceptance đạt, external pending phải rõ. npm run verify và npm run test:e2e là kiểm tra chính. Không tự commit/push khi chưa được yêu cầu.
