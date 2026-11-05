import { test } from "node:test";
import assert from "node:assert/strict";
import { testEnvironment } from "../scripts/test-env.js";

test("test environment overrides application database, merchant secrets, mail and session", () => {
  const base = {
    NODE_ENV: "production",
    DB_DATABASE: "thu_thanh_em3",
    DB_HOST: "127.0.0.1",
    DB_PORT: "3307",
    DB_USERNAME: "local-user",
    DB_PASSWORD: "private-db-password",
    VNPAY_TMN_CODE: "PRIVATE_MERCHANT",
    VNPAY_HASH_SECRET: "private-provider-secret",
    VNPAY_QUERY_URL: "https://provider.invalid/real",
    MAIL_TRANSPORT: "smtp",
    MAIL_PASSWORD: "private-smtp-password",
    SESSION_SECRET: "private-session-secret",
    COOKIE_SECURE: "true",
    E2E_TESTING: "1",
  };
  const env = testEnvironment(base);
  assert.equal(base.DB_DATABASE, "thu_thanh_em3");
  assert.equal(env.NODE_ENV, "test");
  assert.equal(env.DB_DATABASE, "thu_thanh_em3_test");
  for (const key of ["DB_HOST", "DB_PORT", "DB_USERNAME", "DB_PASSWORD"])
    assert.equal(env[key], base[key]);
  assert.equal(env.VNPAY_TMN_CODE, "TESTEM3");
  assert.notEqual(env.VNPAY_HASH_SECRET, base.VNPAY_HASH_SECRET);
  assert.equal(env.VNPAY_QUERY_URL, "");
  assert.equal(env.MAIL_TRANSPORT, "disabled");
  assert.equal(env.MAIL_PASSWORD, "");
  assert.notEqual(env.SESSION_SECRET, base.SESSION_SECRET);
  assert.equal(env.COOKIE_SECURE, "false");
  assert.equal(env.E2E_TESTING, "");
});
