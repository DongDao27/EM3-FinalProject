import type { Envelope } from "./types";

type Fields = Record<string, string[]>;
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Fields;
  readonly requestId?: string;
  constructor(
    status: number,
    code: string,
    message: string,
    fields: Fields = {},
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
  }
}

export function readXsrfCookie(cookies: string): string | undefined {
  const value = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("XSRF-TOKEN="))
    ?.slice("XSRF-TOKEN=".length);
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export function createApiClient(
  fetcher: typeof fetch = fetch,
  cookieReader = () => (typeof document === "undefined" ? "" : document.cookie),
) {
  // Each mutation obtains a current CSRF cookie. No automatic retry of mutations:
  // an ambiguous network error must never submit a cart addition/order twice.
  async function csrf() {
    const response = await fetcher("/sanctum/csrf-cookie", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new ApiError(
        response.status,
        "CSRF_UNAVAILABLE",
        "Không thể xác thực phiên. Vui lòng thử lại.",
      );
    const token = readXsrfCookie(cookieReader());
    if (!token)
      throw new ApiError(
        419,
        "CSRF_COOKIE_MISSING",
        "Phiên đăng nhập chưa sẵn sàng. Vui lòng tải lại trang.",
      );
    return token;
  }

  return async function request<T>(
    path: string,
    options: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      body?: unknown;
      idempotencyKey?: string;
      signal?: AbortSignal;
    } = {},
  ): Promise<Envelope<T>> {
    const resource = path.split("?", 1)[0];
    if (
      !/^\/[a-zA-Z0-9][a-zA-Z0-9/_?=&%+~.:-]*$/.test(path) ||
      resource.includes("..") ||
      /%2e|%2f|%5c/i.test(resource)
    ) {
      throw new Error("API path must be a relative resource path.");
    }
    const method = options.method ?? "GET";
    const headers = new Headers({ Accept: "application/json" });
    if (method !== "GET") headers.set("X-XSRF-TOKEN", await csrf());
    if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
    const multipart = options.body instanceof FormData;
    if (options.body !== undefined && !multipart) headers.set("Content-Type", "application/json");
    const response = await fetcher(`/api/v1${path}`, {
      method,
      headers,
      credentials: resource === "/storefront" && method === "GET" ? "omit" : "same-origin",
      cache: resource === "/storefront" && method === "GET" ? "default" : "no-store",
      signal: options.signal,
      body:
        options.body === undefined
          ? undefined
          : multipart
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    });
    if (response.status === 204)
      return {
        data: undefined as T,
        meta: {
          request_id: response.headers.get("X-Request-ID") ?? "",
          server_time: "",
        },
      };
    const body = await response.json().catch(() => null);
    if (!response.ok)
      throw new ApiError(
        response.status,
        body?.error?.code ?? "REQUEST_FAILED",
        body?.error?.message ?? "Không thể kết nối dịch vụ. Vui lòng thử lại.",
        body?.error?.fields ?? {},
        body?.meta?.request_id,
      );
    if (!body || !("data" in body) || !body.meta)
      throw new ApiError(502, "INVALID_RESPONSE", "Dịch vụ trả về dữ liệu không hợp lệ.");
    return body as Envelope<T>;
  };
}

export const api = createApiClient();
