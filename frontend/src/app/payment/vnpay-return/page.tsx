"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useOrderPolling } from "@/lib/use-order-polling";
import { useStore } from "@/components/store-provider";
import { PaymentResult } from "@/components/payment-result";
import type { Order, VnpayReturn } from "@/lib/types";
import { Loading } from "@/components/ui";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/format";

// Only the API's verified payment state can display a successful payment.
export default function VnpayReturnPage() {
  const [result, setResult] = useState<VnpayReturn | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const { user } = useStore();
  const updateOrder = useCallback((updated: Order) => {
    setOrder(updated);
    setResult((current) =>
      current ? { ...current, payment_status: updated.payment_status } : current,
    );
  }, []);
  useOrderPolling(
    result?.order_code,
    user?.role === "customer" &&
      result !== null &&
      result.payment_status !== "paid" &&
      result.result !== "failed",
    updateOrder,
  );
  useEffect(() => {
    const abort = new AbortController();
    const signed = new URLSearchParams(
      [...new URLSearchParams(window.location.search)].filter(([key]) => key.startsWith("vnp_")),
    );
    api<VnpayReturn>(`/payments/vnpay/return?${signed}`, { signal: abort.signal })
      .then(({ data }) => {
        if (!abort.signal.aborted) setResult(data);
      })
      .catch((error) => {
        if (!abort.signal.aborted) setError(errorMessage(error));
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!result?.order_code || user?.role !== "customer") return;
    const abort = new AbortController();
    api<Order>(`/orders/${encodeURIComponent(result.order_code)}`, { signal: abort.signal })
      .then(({ data }) => {
        if (!abort.signal.aborted) updateOrder(data);
      })
      .catch(() => {
        /* Private order details require ownership. */
      });
    return () => abort.abort();
  }, [result?.order_code, user?.role, updateOrder]);
  return (
    <div className="container page-section payment-result-page">
      <div className="breadcrumb">
        <Link href="/orders">Đơn hàng của tôi</Link>
        <span>/</span>Kết quả thanh toán
      </div>
      <h1 className="sr-only">Kết quả thanh toán VNPAY</h1>
      {!result && !error ? (
        <Loading />
      ) : (
        <PaymentResult result={result} order={order} error={error} />
      )}
    </div>
  );
}
