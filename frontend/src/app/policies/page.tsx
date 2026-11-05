export default function PoliciesPage() {
  return (
    <article className="container page-section policy-page">
      <h1>Thông tin mua hàng</h1>
      <section id="shipping">
        <h2>Giao hàng &amp; nhận tại cửa hàng</h2>
        <p>Địa chỉ nhà sách: 295 Tôn Đức Thắng, Hòa Khánh, Đà Nẵng.</p>
        <p>
          Phí vận chuyển được hiển thị tại bước thanh toán theo cách nhận hàng. Tên, số điện thoại
          và địa chỉ nhận hàng được kiểm tra trước khi tạo đơn.
        </p>
        <p>
          Đơn giao hàng giữ sản phẩm trong 5 phút; đơn nhận tại cửa hàng giữ trong 24 giờ từ lúc tạo
          đơn. Thời gian và trạng thái thực tế do máy chủ xác nhận.
        </p>
      </section>
      <section id="returns">
        <h2>Không đổi trả / hoàn tiền</h2>
        <p>
          Nhà sách không hỗ trợ đổi trả hoặc hoàn tiền sau bán. Vui lòng kiểm tra kỹ sản phẩm, số
          lượng, thông tin nhận hàng và tổng tiền trước khi xác nhận.
        </p>
        <p>
          Đơn chưa thanh toán có thể được hủy khi đáp ứng điều kiện của hệ thống. Hủy đơn chưa thanh
          toán không phải là hoàn tiền.
        </p>
      </section>
      <section id="terms">
        <h2>Đặt hàng &amp; thanh toán</h2>
        <p>
          Giá và tồn kho được kiểm tra lại khi tạo đơn. Khi có thay đổi, bạn cần xem và xác nhận báo
          giá mới. Thông báo đặt hàng hoặc mã đơn không phải bằng chứng thanh toán.
        </p>
        <p>
          Thanh toán trực tuyến qua VNPAY cho cả đơn giao hàng và nhận tại cửa hàng. Đơn nhận tại
          cửa hàng cũng có thể trả tiền mặt tại quầy. Với VNPAY, đơn chỉ được ghi nhận đã thanh toán
          khi VNPAY xác minh giao dịch. Đơn giao hàng cần thanh toán trước.
        </p>
      </section>
      <section id="privacy">
        <h2>Thông tin cá nhân</h2>
        <p>Email đăng ký bản tin được ghi nhận khi bạn đồng ý nhận thông tin qua email.</p>
        <p>
          Thông tin tài khoản và nhận hàng được sử dụng để xử lý đơn hàng trong hệ thống. Khách hàng
          chỉ có thể xem giỏ và đơn của tài khoản mình; quản lý cửa hàng truy cập theo quyền được
          cấp.
        </p>
        <p>
          Không chia sẻ mật khẩu hoặc mã phiên đăng nhập. Tránh dùng thông tin cá nhân thật khi thử
          nghiệm trên môi trường học tập.
        </p>
      </section>
    </article>
  );
}
