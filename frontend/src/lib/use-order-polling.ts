"use client";

import { useEffect } from "react";
import { api } from "./api-client";
import type { Order } from "./types";

// Read-only refresh; provider verification and all state transitions stay in the API.
export function useOrderPolling(
  code: string | undefined,
  enabled: boolean,
  onUpdate: (order: Order) => void,
) {
  useEffect(() => {
    if (!code || !enabled) return;
    const abort = new AbortController();
    let inFlight = false;
    let attempts = 0;
    async function refresh() {
      if (document.hidden || inFlight || attempts >= 30 || abort.signal.aborted) return;
      inFlight = true;
      attempts++;
      try {
        const { data } = await api<Order>(`/orders/${encodeURIComponent(code!)}`, {
          signal: abort.signal,
        });
        if (!abort.signal.aborted) onUpdate(data);
      } catch {
        // Keep the last verified state on transient failures. Never infer paid/unpaid.
      } finally {
        inFlight = false;
      }
    }
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    return () => {
      abort.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [code, enabled, onUpdate]);
}
