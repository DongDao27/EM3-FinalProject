import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deploymentSettings } from "./deployment.js";
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env"), quiet: true });
const e = process.env;
const deployment = deploymentSettings(e, root);
export const config = {
  env: e.NODE_ENV || "development",
  port: Number(e.PORT || 8001),
  host: e.HOST || "localhost",
  frontend: deployment.frontend,
  trustProxy: deployment.trustProxy,
  secret: e.SESSION_SECRET,
  cookie: e.SESSION_COOKIE || "thuthanh_em3_session",
  secure: e.COOKIE_SECURE === "true",
  storageRoot: deployment.storageRoot,
  db: {
    host: e.DB_HOST || "127.0.0.1",
    port: Number(e.DB_PORT || 3306),
    database: e.DB_DATABASE || "thu_thanh_em3",
    user: e.DB_USERNAME,
    password: e.DB_PASSWORD,
    timezone: "Z",
    charset: "utf8mb4",
    supportBigNumbers: true,
    bigNumberStrings: false,
    decimalNumbers: true,
    connectionLimit: 12,
  },
  vnpay: {
    deferred: e.VNPAY_DEFERRED !== "false",
    environment: e.VNPAY_ENV || "sandbox",
    merchant: e.VNPAY_TMN_CODE,
    secret: e.VNPAY_HASH_SECRET,
    paymentUrl: e.VNPAY_PAYMENT_URL,
    queryUrl: e.VNPAY_QUERY_URL,
    returnUrl: deployment.returnUrl,
    queryIp: e.VNPAY_QUERY_IP || "127.0.0.1",
  },
};
if (!/^thu_thanh_em3(?:_test)?$/.test(config.db.database))
  throw new Error("EM3 refuses databases outside thu_thanh_em3 / thu_thanh_em3_test");
if (!config.secret || config.secret.length < 24)
  throw new Error("SESSION_SECRET must contain at least 24 characters");
