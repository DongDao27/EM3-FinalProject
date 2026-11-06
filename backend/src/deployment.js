import path from "node:path";

export function deploymentSettings(env, backendRoot) {
  const production = env.NODE_ENV === "production";
  const frontend = (
    env.FRONTEND_URL ||
    (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:3001")
  ).replace(/\/$/, "");
  const trustProxy = env.TRUST_PROXY || "false";
  if (!["false", "loopback"].includes(trustProxy))
    throw new Error("TRUST_PROXY must be false or loopback; never trust arbitrary proxy headers.");
  const settings = {
    frontend,
    trustProxy: trustProxy === "loopback" ? "loopback" : false,
    storageRoot:
      env.NODE_ENV === "test"
        ? path.resolve(backendRoot, "../.runtime/test-storage")
        : path.resolve(env.STORAGE_ROOT || path.join(backendRoot, "storage")),
    returnUrl:
      env.VNPAY_RETURN_URL || (production ? `${frontend}/payment/vnpay-return` : undefined),
  };
  if (!production) return settings;
  const url = new URL(frontend);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Production FRONTEND_URL must be a public HTTPS origin without a path.");
  if (env.COOKIE_SECURE !== "true" || trustProxy !== "loopback")
    throw new Error(
      "Production requires COOKIE_SECURE=true and TRUST_PROXY=loopback behind the bundled web proxy.",
    );
  if (!["127.0.0.1", "localhost", "::1"].includes(env.HOST || "localhost"))
    throw new Error("The bundled production API must bind only to loopback.");
  if (
    !env.SESSION_SECRET ||
    env.SESSION_SECRET.length < 32 ||
    /^replace-/i.test(env.SESSION_SECRET)
  )
    throw new Error(
      "Production SESSION_SECRET must be independently generated, at least 32 characters.",
    );
  if ((env.VNPAY_ENV || "sandbox") !== "sandbox")
    throw new Error("This deployment supports VNPAY Sandbox only.");
  const callback = new URL(settings.returnUrl);
  if (
    callback.origin !== url.origin ||
    callback.pathname !== "/payment/vnpay-return" ||
    callback.search ||
    callback.hash
  )
    throw new Error("VNPAY_RETURN_URL must use this site's HTTPS payment return route.");
  if (env.VNPAY_DEFERRED === "false") {
    if (!env.VNPAY_TMN_CODE || !env.VNPAY_HASH_SECRET)
      throw new Error("Enabled Sandbox requires merchant credentials in server variables.");
    for (const key of ["VNPAY_PAYMENT_URL", "VNPAY_QUERY_URL"]) {
      const endpoint = new URL(env[key] || "http://invalid");
      if (
        endpoint.protocol !== "https:" ||
        endpoint.hostname !== "sandbox.vnpayment.vn" ||
        endpoint.username ||
        endpoint.password
      )
        throw new Error("Enabled Sandbox requires official HTTPS Sandbox endpoints.");
    }
  }
  return settings;
}
