import Link from "next/link";
import type { Order, VnpayReturn } from "@/lib/types";
import { money, statusLabel } from "@/lib/format";

export function PaymentResult({
  result,
  order,
  error = "",
}: {
  result: VnpayReturn | null;
  order: Order | null;
  error?: string;
}) {
  const paid = result?.payment_status === "paid";
  const reconciliation = result?.payment_status === "reconciliation_required";
  const failed = !paid && !reconciliation && result?.result === "failed";
  const tone = paid ? "success" : failed || error ? "failure" : "pending";
  const title = paid
    ? "Thanh toán thành công"
    : error
      ? "Không thể xác minh giao dịch"
      : failed
        ? "Thanh toán không thành công"
        : reconciliation
          ? "Giao dịch đang được đối soát"
          : "Đang xác nhận thanh toán";
  const description = paid
    ? "Cảm ơn bạn đã mua sắm tại Nhà sách Thu Thanh. Thanh toán của bạn đã được xác nhận."
    : error ||
      (failed
        ? "Giao dịch chưa hoàn tất hoặc đã bị hủy. Bạn có thể thanh toán lại từ chi tiết đơn nếu đơn còn hiệu lực."
        : "Nhà sách đang chờ xác nhận kết quả từ VNPAY. Vui lòng không thanh toán lại để tránh phát sinh giao dịch trùng.");
  return (
    <>
      {result && (
        <dl className="payment-overview">
          <div>
            <dt>Mã đơn hàng</dt>
            <dd>{result.order_code}</dd>
          </div>
          <div>
            <dt>Phương thức thanh toán</dt>
            <dd>VNPAY</dd>
          </div>
          {order && (
            <div>
              <dt>Tổng thanh toán</dt>
              <dd>{money(order.totals.payable_total)}</dd>
            </div>
          )}
          {order?.paid_at && (
            <div>
              <dt>Thời gian thanh toán</dt>
              <dd>
                {new Intl.DateTimeFormat("vi-VN", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Asia/Ho_Chi_Minh",
                }).format(new Date(order.paid_at))}
              </dd>
            </div>
          )}
        </dl>
      )}
      <section
        className={`payment-outcome payment-outcome--${tone}`}
        aria-labelledby="payment-outcome-title"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <svg className="payment-outcome-icon" viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <circle cx="50" cy="50" r="43" stroke="currentColor" strokeWidth="6" />
          {tone === "success" ? (
            <path
              d="m28 51 15 15 30-32"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : tone === "failure" ? (
            <path
              d="m35 35 30 30m0-30L35 65"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M50 25v27l17 10"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
        <h2 id="payment-outcome-title">{title}</h2>
        <p>{description}</p>
        {order && (
          <span className="payment-receiving">{statusLabel[order.fulfillment_method]}</span>
        )}
        <div className="button-row">
          {result && (
            <Link
              className="button primary"
              href={`/orders/${encodeURIComponent(result.order_code)}`}
            >
              {failed ? "Quay lại đơn hàng" : "Xem chi tiết đơn"}
            </Link>
          )}
          <Link className="button" href="/">
            Tiếp tục mua sắm
          </Link>
          <Link className="payment-orders-link" href="/orders">
            Về danh sách đơn
          </Link>
        </div>
      </section>
    </>
  );
}
