# Thu Thanh · Web & iPhone 17 Pro · V35

V35 cập nhật thanh toán theo D84/D85: pickup có **Thanh toán ngay / Thanh toán tại quầy / Hủy đơn**, delivery có **Thanh toán / Hủy đơn**; bỏ phần hoạt động dài ở đơn chưa trả tiền. Admin mở đơn pickup chưa thanh toán, chọn **Thanh toán qua VNPAY** hoặc **Thanh toán tiền mặt**. VNPAY đi qua QR → chờ xác nhận → **Nhận tiền thành công / Đơn hàng đã hoàn tất**; tiền mặt đi thẳng đến màn xác nhận thu đủ và hoàn tất. Chọn kịch bản khác trong panel để xem chờ/thất bại/đối soát. Tại quầy không có thao tác tiền mặt từ màn VNPAY đang chờ. **Đối tác chỉ ở landing**, tách khỏi footer các màn khác. Có 180 khung (178 prototype + 2 landing review), 7 luồng mỗi nền tảng, tối đa12màn/hàng.

QR trong plugin là mã văn bản mẫu vô hại, không gọi website, không chứa merchant/secret và không chuyển tiền. QR website thực tế mở cổng VNPAY bằng camera, chưa phải native bank-app merchant QR. Popup prototype không chứng minh đã nhận tiền thật.

Sau import V35, chạy **Cập nhật thiết kế · Hai nền tảng**, rồi chọn luồng Đơn hàng/Quản trị và Present. Không sửa manifest ID; V35 nhận diện layer V34 khi dựng lại, giữ ghi chú và ảnh chỉnh tay theo cơ chế hiện có.

V35: nút dùng chữ HUG và căn giữa icon/chữ, không stretch nhãn; các tiêu đề mục dùng Auto Layout ngang. Thẻ có Mua ngay + icon giỏ, không có nút Xem nhanh. Bán chạy có10sản phẩm trong vùng cuộn riêng: khi Present, dùng bánh xe/trackpad hoặc nút mũi tên lên/xuống ở thanh bên để tới hạng1/10. Thanh bên được cố định trong chính vùng cuộn. Trong Design, cuộn chuột di chuyển canvas; hãy Present để thử prototype. Chỉ SKU Toán1 chạy mua như phạm vi đã chốt.

Bộ plugin offline tạo các layer có thể chỉnh trong Figma Design, không cần API key hoặc mạng. Đồng bộ luồng D84/D85 của Laravel và EM3 ngày 05/11/2026. Đây là prototype tĩnh để trình bày, không kết nối database hoặc thực hiện thanh toán.

## Import và xem thiết kế

1. Giải nén **`THUTHANH-FIGMA-V35.zip`** vào một thư mục mới cố định. Nếu đã cài V27/V28 từ thư mục khác, mở Plugins → Development → Manage plugins, bỏ mục development trỏ đường dẫn cũ rồi import manifest V35. Thao tác này không xóa canvas.
2. Mở Figma Desktop → mở một file Design của bạn → Plugins → Development → Import plugin from manifest → chọn `manifest.json`.
3. Chạy **Thu Thanh V35 · Thanh toán tại quầy · Đối tác landing**. Panel phải hiện **“V35 · Thanh toán tại quầy · Đối tác landing”**; nếu còn V27/V28 thì đang mở plugin ở đường dẫn cũ. Chọn kịch bản thanh toán, nhấn **Cập nhật thiết kế · Hai nền tảng** và đợi thông báo thành công. Có thể dừng để giữ bản trước.
4. Trang **Landing page** có hai bản xem toàn trang. Trang **01 · Máy tính** và **02 · Điện thoại** chứa prototype. Chọn luồng trong plugin rồi nhấn Máy tính/Điện thoại → Present. Mobile dùng khung **402 × 874**, desktop **1920 × 1080**. Đặt preview ở Actual size/Fit, không kéo giãn frame.
5. Chỉ cuốn Toán 1 đầu tiên chạy luồng mua số lượng 1–2; mỗi danh mục 4 mẫu, 24 mẫu tổng cộng. Web thật dùng đầy đủ catalog. Hủy đơn dẫn về giỏ; đổi số lượng rồi tiếp tục đặt hàng. Màn chờ có vùng thông tin giao dịch để chuyển sang kịch bản đã chọn; đây là thao tác prototype, không phải thông báo ngân hàng thật.

## Kiểm tra nhanh bản mới

V35 sửa lỗi native mobile `object is not extensible`: dùng `numberOfFixedChildren` trên frame cha, liên kết bằng `setReactionsAsync` cho dynamic-page; không gán `scrollBehavior` lên layer. Mock nghiêm sẽ từ chối các thao tác API sai này. Nếu còn lỗi, panel hiện cả giai đoạn/layer và Console có stack.

V35 giữ sửa bộ dựng bị nặng: Auto Layout xử lý từng khối một lần, giảm các lớp Padding lồng nhau. Panel hiển thị giai đoạn, số màn và thời gian; nút Dừng hoạt động cả khi đang chuyển bố cục. Kiểm thử local giới hạn số node/độ sâu và hủy giữa Auto Layout. Thời gian trong mock không phải thời gian cam kết trên máy/Figma thật.

V35 gộp header thành một hàng trên desktop/mobile: logo, danh mục, tìm kiếm, giỏ và tài khoản. Mobile thu gọn nhãn, giữ vùng nhấn44px; Trang chủ qua logo/bottomnav, Đơn hàng qua tài khoản/menu. Mục Gợi ý chuyển xanh biển nhạt. Mục **Đối tác** chứa10logo ảnh Phương Nam đứng riêng phía trên footer Thu Thanh. Không thêm chứng nhận hay tuyên bố quan hệ pháp lý.

Menu quản trị mobile dùng lưới hai cột cùng thứ tự web, các mục có icon riêng. Các khối nội dung dùng Auto Layout với padding theo hình học, nút là instance của component dùng chung. Thư viện **Components · Nút dùng chung** nằm ngoài và dưới7luồng, không bao các màn. Lớp nền/điều hướng cố định và các lớp cố ý chồng vẫn absolute; vector logo/icon giữ cấu trúc SVG. Giữ mobile gọn V30, mẫu402×874 và mọi nhánh mua V29. Panel hiện **V35 · Thanh toán tại quầy · Đối tác landing**.

- Mục Đối tác bắt đầu bằng ảnh Thiên Long, Faber-Castell, KEYROAD, Maped, MILAN; tiếp theo là Pentel, Pilot, Sakos, BITEX, TOTY. Không có dải chữ BLOKEES/CATAN/CHAMPION GAMES/Colokit. Dùng mũi tên trong nhóm đang xem để đi tiếp/quay lại; mobile có 5 nhóm, mỗi nhóm 2 logo.
- Xem nhanh → chọn số lượng → **Mua ngay** → đăng nhập → đến thẳng **Đặt hàng**, không mở lại Xem nhanh.
- **Thêm vào giỏ** → đăng nhập → đến **Giỏ hàng** với đúng số lượng. Chuyển sang Đăng ký hoặc quay lại Đăng nhập vẫn giữ thao tác/số lượng. Đăng nhập thông thường đi tới tài khoản; đăng nhập admin tới quản trị.
- Chạy lại plugin để dựng lại các frame; chỉ import manifest không tự thay canvas. Đóng tab Present cũ, chọn màn bắt đầu mới rồi Present lại. Các nhánh xác thực là frame tĩnh của prototype, không phải hệ thống đăng nhập thật.

## Quy tắc giữ nguyên

Landing page riêng; 7 luồng mỗi nền tảng. Frame nằm ngoài bảng/section, đi từ trái sang phải, tối đa 12 frame mỗi hàng; cách ngang 320px, hàng cách 240px. Chạy lại chỉ thay các node thuộc plugin sau khi cả ba trang dựng xong. Layer do bạn tạo ngoài plugin được giữ; ảnh sản phẩm thay tay được giữ. Hãy nhân bản các frame nếu muốn giữ chỉnh sửa bố cục riêng; plugin không bảo toàn mọi chỉnh sửa bên trong frame do nó quản lý.

Khung mobile là kích thước thiết kế logic cho iPhone 17 Pro, không phải ảnh 1206 × 2622 pixel vật lý. Website chạy trong Safari có thanh trình duyệt làm chiều cao sử dụng thay đổi; prototype không giả làm ứng dụng iOS native. Thanh điều hướng dưới dành vùng trống cuối nội dung, không che CTA.

QR nhúng là mã văn bản vô hại, không chuyển tiền. Thống kê/sản phẩm trong Figma là mẫu trình bày, không phải doanh số cửa hàng. Builder lấy 10 logo ảnh và wordmark trực tiếp từ source web hiện hành, kiểm hash trước khi đóng gói; không dùng danh sách tên thương hiệu làm fallback chữ. Nguồn ảnh/logo lưu ở dữ liệu plugin và tài liệu ASSETS của dự án.

## Kiểm chứng và giới hạn

Từ gốc dự án: `python design/figma/build.py`, sau đó `npm run test:figma`. Test kiểm hình học, giá/số lượng, điều hướng, giữ ảnh sửa tay, rollback khi lỗi/hủy và bố cục 3 trang. Preview SVG được xuất vào `output/figma/preview`; đây không phải ảnh render từ Figma thật. Cần chạy plugin và kiểm font/scroll/overlay trong Figma Desktop để nghiệm thu canvas.

Thông số màn hình: [Apple](https://support.apple.com/en-nz/125090). Khung 402 × 874 tương ứng bản thiết kế logic ở tỷ lệ 3×; không khóa website vào một kích thước duy nhất.

## Nếu bản cũ đứng ở 1400

1. Dừng plugin cũ; nếu Figma không phản hồi, đóng/mở lại file. Không cần xóa toàn bộ file thiết kế của bạn.
2. Giải nén ZIP **V35** vào thư mục mới cố định. Manage plugins → bỏ development entry trỏ V31 rồi Import plugin from manifest tại thư mục V35.
3. Kiểm tra panel có **V35**, nhấn Cập nhật thiết kế. Theo dõi các giai đoạn tạo màn, nối luồng, Auto Layout và Landing. Con số nối luồng không phải số màn.
4. Có thể nhấn Dừng tạo; phần dựng tạm được bỏ và bản trước được giữ. Chỉ đóng gói thành công khi panel báo hoàn tất.
5. Present từ frame mới. Nếu cần báo lỗi, sao chép nguyên thông báo giai đoạn/lỗi trong panel và Console của plugin. Không chỉ import lại manifest cũ.

Giữ nguyên3trang, Landing riêng/7luồng/max12màn/hàng; vẫn24sản phẩm mẫu và1SKU mua. Bản này đã kiểm thử mock và preview local, chủ dự án vẫn cần chạy trong Figma để xác nhận native canvas.

Nguồn API: [FramePrototypingMixin và ReactionMixin của Figma](https://github.com/figma/plugin-typings/blob/master/plugin-api.d.ts). `scrollBehavior` thuộc dữ liệu REST, không phải thuộc tính ghi của layer trong Plugin API.
