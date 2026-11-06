# Quyết định Thu Thanh EM3

## D82 — Native mobile API compatibility (04/11/2026)

Người dùng đã chạy đúngV32 và nhận object is not extensible. Source gán nav.scrollBehavior (không có trong Plugin API) và b.reactions trực tiếp dù dynamic-page yêu cầu setReactionsAsync. Acceptance M19: tái hiện với mock nghiêm từ chối thuộc tính/readonly này; thay numberOfFixedChildren của frame cha và async reactions, reviewclone fixedcount0; lỗi kèm phase/layer. Giữ UI/flows/layout/DB. Fullmock strict, sourcecheck và ZIP integrity đạt; không gọi local test là native acceptance.

## D81 — Sửa dựng Figma bị đứng và rà soát luồng (04/11/2026)

V31 profile thực tế mock:76.001node/56.377band/depth43; Auto Layout xử lý lại hậu duệ đã chuyển, native canvas có rủi ro nghẽn. Acceptance M18: xử lý mỗi khối một lần, giảm node/depth so baseline, yield/cancel/progress trong bố cục và nối luồng; gói V32 không mất ảnh/manual artwork, rollback và 7luồng/max12/Landing riêng/402×874 giữ. Rà soát UI/luồng desktop/mobile theo UIUXProMax, chạy source/Figma checks, E2E và build khi sửa web. Mô phỏng không thay nghiệm thu Figma thật; không tuyên bố tái hiện native hang khi chưa có file/session người dùng. Không đổi nghiệp vụ/DB/env/provider hoặc commit/push.

## D80 — Header một hàng, màu xanh biển, mục Đối tác và Auto Layout (04/11/2026)

Theo yêu cầu mới, chỉnh bản EM3 đang làm: một hàng logo/danh mục/tìm kiếm/giỏ/tài khoản; mobile thu gọn nhãn nhưng giữ vùng nhấn44px và tìm kiếm gợi ý. Trang chủ qua logo/menu/bottomnav; Đơn hàng qua menu/tài khoản. Gợi ý dùng màu xanh biển cùng hệ màu header. Chỉ dùng10logo ảnh Phương Nam có nguồn/hash, mục Đối tác độc lập trước footer Thu Thanh. Không tự nhận quan hệ đối tác pháp lý. FigmaV31 giữ Landing riêng/7luồng/max12màn/hàng/402×874; chuyển các khối sang Auto Layout với padding thật, component nút tái sử dụng; chỉ lớp nền/overlay cố ý chồng được absolute. Acceptance: browser responsive375/402/768/1440, tìm kiếm/menu/auth/giỏ/admin và carousel không hồi quy; Figma kiểm layout/components/padding/geometry/route/rollback, build/typecheck/check đạt. Không đổi nghiệp vụ/DB/env/merchant hoặc commit/push. Canvas thật chờ chủ dự án chạy plugin.

## D79 — Kiểm tra nghiệm thu local lần cuối (03/11/2026)

Theo yêu cầu confirm, chạy lại check, backend/frontend/payment-tool tests, browser E2E, build/typecheck cô lập và Figma mock/ZIP kiểm source equality. Acceptance: báo kết quả thật, giữ riêng các phần chưa nghiệm thu merchant/IPN EM3, SMTP và canvas người dùng. Không tự sửa UI khi chưa thấy lỗi; không đổi env/schema/storage hoặc database ứng dụng, không gọi provider thật, không commit/push. Giữ secret và source chưa commit.

## D78 — Mobile gọn hơn, Figma V30 (03/11/2026)

Theo ảnh và yêu cầu, áp dụng UI/UX Pro Max: bỏ khoảng trống cố định dư, ưu tiên chiều cao theo nội dung; vùng nhấn chính >=44px. Acceptance: mobile bestseller có ảnh/thông tin cạnh nhau, CTA dễ thấy, không cắt tên/giá; compact ranking/footer/card/khoảng giữa mục; không overflow/chồng chữ tại375/402/768. Giữ desktop, nghiệp vụ và các nhánh V29; Landing/7luồng/max12frame/hàng/402×874 giữ. Native mock kiểm containment và kích thước, E2E kiểm chọn xếp hạng/giỏ/auth/QR/admin; review preview trước đóng V30. Canvas thật vẫn cần chạy plugin. Không đổi dữ liệu/env/API hoặc tự commit/push.

## D77 — Giữ đúng ý định mua sau đăng nhập, gói Figma V29 (03/11/2026)

Người dùng chỉ ra footer cũ và prototype yêu cầu chọn mua lần hai. Source V28/web mới đã có 10 logo ảnh nhưng ảnh người dùng mang dải tên chữ cũ; sửa cách nhận diện gói và kiểm bundle, không suy canvas đã cập nhật. Acceptance: Mua ngay → đăng nhập/đăng ký → checkout; Thêm vào giỏ → xác thực → thêm đúng số lượng một lần, không mở lại lựa chọn; đóng xác thực không mua, admin không tự mua. Figma tách intent/số lượng bằng các nhánh tĩnh cần thiết và giữ 7 luồng, 12 màn/hàng, Landing riêng, 402×874. Sửa web cùng hành vi để đồng bộ; API/backend và dữ liệu không đổi. Gói V29 phải chứa logo ảnh đúng hash, không fallback sang tên chữ; mock và browser E2E kiểm các nhánh, lỗi API không tự retry mutation. Không tự commit/push, không gọi merchant thật.

## D76 — Đồng bộ plugin Figma và brief thiết kế (03/11/2026)

Theo yêu cầu mới, đối chiếu giao diện EM3 hiện tại với plugin local V27 tại dự án gốc; người dùng xác nhận chưa import nên chưa có canvas/link Figma. Bàn giao bộ offline tại design/figma, mobile iPhone 17 Pro 402×874 logical pixels; desktop 1920×1080. Giữ Landing page riêng, 7 luồng mỗi nền tảng, các frame ngoài bảng, trái sang phải và tối đa 12 frame mỗi hàng. Không thay nghiệp vụ hay dữ liệu ứng dụng.

Acceptance trước sửa: kiểm hình học, không chồng các frame, containment, prototype links, 24 mẫu/4 mỗi danh mục và một SKU mua; cập nhật payment tick/X/pending, footer 10 logo gốc, hủy về giỏ và các màn tài khoản/admin còn thiếu. Kiểm lại 402×874 và desktop bằng preview/browser. Brief Word tiếng Việt trình bày mục tiêu, yêu cầu khách hàng, lý do thiết kế, luồng và phạm vi nghiệm thu; phân biệt prototype/local tests với canvas thật và merchant acceptance. Không tự commit/push, không sửa source/dữ liệu dự án gốc.

## D75 — Một env backend, tài liệu gọn (03/11/2026)

Theo yêu cầu dọn env/docs, chỉ giữ backend/.env thật và backend/.env.example để clone. Frontend đã có mặc định localhost8001 nên bỏ env trùng mặc định. Test dùng cùng DB credentials nhưng luôn ép thu_thanh_em3_test, session riêng, provider giả/mail disabled. CI vẫn có thể truyền DB credentials qua môi trường.

Acceptance ghi trước sửa: hash backend env không đổi; test/migrate:test/E2E không phụ thuộc env.testing; test bảo vệ database/merchant/session/mail; check/test/build/E2E đạt. Gộp OPERATIONS vào README, DOMAIN-RULES vào DATABASE, bằng chứng vào STATUS. Giữ checkpoint bắt buộc gọn, không tạo thêm báo cáo trùng. Archive gốc tại .runtime/cleanup-M12-20261103.

## Quyết định hiện hành được giữ

- D71: npm workspaces, một lockfile/node_modules ở root; Express/MySQL quyết định quyền/tiền/tồn; test riêng, không commit secrets/log/uploads/generated files.
- D72: README tiếng Việt UTF-8, hướng dẫn clone đầy đủ; không bịa URL Git hoặc tự commit/push.
- D73: chỉ chạy local, bỏ cấu hình triển khai; CI chỉ kiểm thử.
- D74: nhận IPN bằng HTTPS tunnel tới relay GET-only, không public toàn bộ backend; giữ nguyên chữ ký, không log query/secret. Biến IPN URL chỉ hỗ trợ kiểm tra, không tự đăng ký merchant. Test mô phỏng/probe không thay nghiệm thu provider thật.

## D83 — Nút căn giữa,10hạng cuộn và CTA mua trực tiếp (04/11/2026)

Yêu cầu chủ dự án: sửa component/padding Figma; Bán chạy tối đa10sản phẩm có cuộn dọc và chỉ báo/cuộn tới hạng sau; bỏ CTA Xem nhanh, thay Mua ngay và icon thêm giỏ. CTA card thao tác1sản phẩm, guest đăng nhập/đăng ký tiếp tục đúng ý định một lần, admin không mua; bấm ảnh/tên vẫn có thông tin/số lượng. Không tự thêm đơn/doanh số giả; xếp hạng theo dữ liệu thật/ghim quản trị hiện hành. Áp dụng FigmaV34, EM3 và Laravel theo yêu cầu rõ ràng, frontend local được phép theo D34. Không đổi tiền/tồn/đơn/schema/provider. Acceptance: component HUG/căn giữa với icon không stretch chữ;10hạng có viewport/scrollbar và thao tác hạng10; native API strict/geometry/route/rollback/budget; backend feed10 test, browser mua/add/auth/failure đúng một lần, build/typecheck/sourcechecks cả2bản. Bảo toàn dirtyfiles/env/mysql/storage, không commit/push.

## D85 — Đồng bộ và kiểm tra cả Laravel, EM3, Figma (05/11/2026)

Chủ dự án yêu cầu kiểm tra/sửa đầy đủ cả hai ứng dụng và Figma theo D84. Phạm vi gồm pickup ba lựa chọn; admin cash receipt/stock/audit/atomic/idempotency và QR đúng tổng, only verified IPN/query auto complete; delivery pay/cancel; đối tác chỉ landing. Port semantics sang Express, giữ MySQL/session/CSRF/provider adapters/ports/env/data riêng. Rà soát lỗi source đã chứng minh ở cả hai bản; không hứa không còn mọi lỗi. Full backend và browser suites, API/build/typecheck/checks cả hai; tests DB riêng, mỗi app backend/E2E chạy tuần tự, QA ports không trùng. Figma V35 cập nhật plugin offline hiện có, đúng actions/payment states/partners layout, native API/geometry/routes/rollback/manual preservation và ZIP source hashes; canvas thật cần đúng file đích, không giả mock là canvas đã cập nhật. Không reset main DB/schema/env, không tạo đơn/doanh số/provider/SMTP thật, không deploy/commit/push. Ghi acceptance trước source và kết quả thực tế khi hoàn tất.

## D88 — Kiểm tra trước commit/nộp bài (06/11/2026)

Chủ dự án yêu cầu xác minh MySQL EM3/Laravel có dùng chung, kiểm tra UI/E2E toàn bộ và file thừa/lỗi trước commit. Phạm vi cả hai repo, giữ Next.js và khác biệt UI D87 đã chốt; không tự đồng bộ EM3 V36. Acceptance trước sửa: đọc effective DB connection và SELECT DATABASE/server identity, không in secret; full backend/API/check/build/typecheck và full E2E từng app chạy tuần tự do QA ports dùng chung; UI desktop/tablet/mobile và ảnh/lỗi console; rà candidate Git cho secret/build/log/cache/temp/duplicate/dead assets và dependencies. Sửa lỗi tái hiện trong phạm vi, chỉ dọn file xác định là generated/không dùng và bảo toàn main DB/env/uploads/manual assets. Không reset/schema/deploy/real payment/email/commit/push. Ghi file không nên commit và giới hạn provider thật; không gọi external/skipped là passed.

## D89 — Publication theo yêu cầu chủ dự án (06/11/2026)

Cho phép commit/push riêng EM3 tới https://github.com/DongDao27/EM3-FinalProject, không publish bản khác. Repo đích đã kiểm tra trống. Acceptance: full verify/E2E D88 đạt, staged paths/secret scan sạch, initial commit main và non-force push, xác minh SHA remote/Actions, ghi receipt thật. Không deploy/real payment/email.

## D90 — README cho final project (06/11/2026)

Owner yêu cầu README chuyên nghiệp, ngắn gọn cho bài final. Phạm vi EM3 vừa publish: giữ overview/công nghệ/chức năng/quickstart/test/docs; bỏ lịch sử Dxx và ghi chú nội bộ khỏi README, chuyển chi tiết setup hiện có sang docs/SETUP.md để không mất hướng dẫn DB/secret/admin/SMTP. Acceptance trước thay README: đúng stack/source/scripts, đủ link setup, không bịa tên môn/nhóm/giảng viên, links và Prettier/check-repo đạt; docs-only, không chạy lại business E2E. Quyền publish D89 tiếp tục cho cập nhật repo này; không sửa bản khác/env/data.

## D91 — Deploy EM3 với VNPAY Sandbox (06/11/2026)

Owner đã chọn ưu tiên hosting miễn phí/trial cho demo. Không tự nâng cấp gói trả phí; public deployment vẫn cần tài khoản Railway đã kết nối.

Owner yêu cầu deploy EM3 và chỉ thanh toán Sandbox, chưa có hosting. Đang xác nhận ngân sách và tài khoản hosting; Railway là phương án đang đánh giá, chưa có kết nối tài khoản được xác nhận. Cho phép chuẩn bị deployment portable/container, HTTPS/session proxy, storage persistence, runner web/API/worker và tài liệu; không bật payment production, không tạo tài nguyên trả phí khi chưa được chấp thuận. D73 exclude-deploy được thay bằng phạm vi deploy Sandbox mới này; D89 quyền commit/push repo EM3 vẫn có.
Acceptance trước source: runtime nhận PORT động/loopback API, worker shutdown/failure rõ; cookie HTTPS chỉ trust loopback proxy opt-in, origin/CSRF giữ; env/config không vào image/Git, uploads dùng volume, database không reset; production NODE_ENV vẫn ép VNPAY sandbox; tests meaningful cho config/proxy/session và supervisor, full verify/E2E; Docker build chỉ gọi passed khi chạy được; deploy/callback thật chỉ completed sau host/merchant/IPN xác nhận. Thiếu hosting/login không chặn chuẩn bị source, checkpoint in_progress nếu chưa public URL.

## D92 — Bỏ deploy, trình bày Sandbox local (06/11/2026)

Owner hủy phạm vi deploy D91, yêu cầu lệnh chạy và test VNPAY Sandbox để trình bày. Acceptance trước thay đổi: gỡ Docker/Railway/runtime deploy và bước CI tương ứng, khôi phục cấu hình ứng dụng local đã kiểm chứng trước D91; giữ nguyên chức năng thanh toán, tunnel IPN local, private env/MySQL/uploads và source Laravel. README/PRD không còn hướng dẫn deploy hiện hành; hướng dẫn trình bày có lệnh rõ theo từng terminal, phân biệt tests fixture với giao dịch merchant thật. Chạy verify/E2E phù hợp, không tự gửi giao dịch, không reset/seed dữ liệu ứng dụng. D89 quyền cập nhật repo EM3 vẫn giữ; M25 đóng do owner hủy, không ghi deployed/done.

## D93 — Tương thích mật khẩu tài khoản cũ (07/11/2026)

Owner báo admin không đăng nhập. Kiểm tra read-only chứng minh tài khoản admin và customer cũ dùng Argon2id, trong khi login EM3 chỉ gọi bcrypt.compare; session/CSRF/database vẫn hoạt động, private env không đổi. Acceptance trước sửa: xác minh Argon2id/Argon2i và bcrypt hiện có bằng thư viện phù hợp; sai mật khẩu/hash không hợp lệ trả INVALID_CREDENTIALS, không 500; không reset hoặc tự rehash mật khẩu/data ứng dụng, không đổi quyền/session/CSRF. Test đúng/sai mật khẩu Argon2id qua login/session/admin và giữ regression bcrypt; verify/E2E trên database test. Giữ việc owner đã xóa backend/.env.example, không commit thay đổi đó.
