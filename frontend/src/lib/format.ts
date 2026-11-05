import { ApiError } from "./api-client";

export const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
const errors: Record<string, string> = {
  VALIDATION_ERROR: "Vui lòng kiểm tra lại thông tin đã nhập.",
  UNAUTHENTICATED: "Bạn cần đăng nhập để tiếp tục.",
  CSRF_TOKEN_MISMATCH: "Phiên đã thay đổi. Vui lòng tải lại trang trước khi thử lại.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  PRICE_CHANGED: "Giá hoặc phí giao đã thay đổi. Hãy kiểm tra báo giá mới trước khi xác nhận.",
  CART_CHANGED: "Giỏ hàng đã thay đổi. Vui lòng kiểm tra và lấy báo giá mới.",
  INSUFFICIENT_STOCK: "Số lượng còn lại không đủ. Vui lòng kiểm tra giỏ hàng.",
  QUOTE_EXPIRED: "Báo giá đã hết hạn. Vui lòng lấy báo giá mới.",
  PAYMENT_INTEGRATION_DEFERRED: "Thanh toán VNPAY chưa được mở. Đơn hàng chưa được thanh toán.",
  GATEWAY_NOT_CONFIGURED:
    "Thanh toán VNPAY chưa được cấu hình trên máy chủ. Đơn hàng chưa được thanh toán.",
  PAYMENT_ENV_NOT_AUTHORIZED:
    "Môi trường thanh toán VNPAY chưa được cho phép. Đơn hàng chưa được thanh toán.",
  ORDER_NOT_PAYABLE: "Đơn đã được thanh toán, đã đóng hoặc đã hết thời gian giữ hàng.",
  PAYMENT_RECONCILIATION_REQUIRED:
    "Giao dịch trước đang chờ nhà sách đối soát. Vui lòng không thanh toán lại.",
  INVALID_PAYMENT_RETURN:
    "Kết quả thanh toán không hợp lệ. Vui lòng kiểm tra trạng thái trong đơn hàng.",
  PAYMENT_NOT_FOUND: "Không tìm thấy giao dịch thanh toán tương ứng.",
  REVENUE_POLICY_NOT_APPROVED: "Báo cáo doanh thu chưa mở vì cách tính chưa được xác nhận.",
  TOO_MANY_REQUESTS: "Bạn thao tác quá nhanh. Vui lòng đợi một lúc rồi thử lại.",
};
export function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? (errors[error.code] ??
        (error.status === 503 ? "Chức năng này hiện chưa khả dụng." : error.message))
    : "Không thể kết nối. Vui lòng kiểm tra mạng rồi thử lại.";
}
export const statusLabel: Record<string, string> = {
  completed: "Hoàn tất",
  open: "Còn hiệu lực",
  cancelled: "Đã hủy",
  expired: "Đã hết hạn",
  paid: "Đã thanh toán",
  unpaid: "Chưa thanh toán",
  pending: "Đang xử lý",
  reconciliation_required: "Chờ đối soát",
  not_started: "Chưa chuẩn bị",
  preparing: "Đang chuẩn bị",
  unprocessed: "Chưa chuẩn bị",
  ready_for_pickup: "Sẵn sàng nhận",
  shipping: "Đang giao",
  fulfilled: "Đã hoàn tất",
  pickup: "Nhận tại cửa hàng",
  delivery: "Giao tận nhà",
};
