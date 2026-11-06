import assert from "node:assert/strict";
import request from "supertest";
import { app } from "../../src/app.js";
import { config } from "../../src/config.js";
import { pool } from "../../src/db.js";

assert.equal(config.env, "test");
assert.equal(config.db.database, "thu_thanh_em3_test");
try {
  if (!config.trustProxy) {
    const spoofed = await request(app)
      .get("/sanctum/csrf-cookie")
      .set("X-Forwarded-Proto", "https");
    assert.equal(spoofed.status, 204);
    assert(!(spoofed.headers["set-cookie"] || []).some((c) => c.startsWith(config.cookie + "=")));
  } else {
    const direct = await request(app).get("/sanctum/csrf-cookie");
    assert.equal(direct.status, 204);
    assert(!(direct.headers["set-cookie"] || []).some((c) => c.startsWith(config.cookie + "=")));
    const secure = await request(app).get("/sanctum/csrf-cookie").set("X-Forwarded-Proto", "https");
    assert.equal(secure.status, 204);
    const cookies = secure.headers["set-cookie"];
    assert(
      cookies.some(
        (c) => c.startsWith(config.cookie + "=") && /; Secure/.test(c) && /; HttpOnly/.test(c),
      ),
    );
    assert(cookies.some((c) => c.startsWith("XSRF-TOKEN=") && /; Secure/.test(c)));
    const csrf = decodeURIComponent(
      cookies
        .find((c) => c.startsWith("XSRF-TOKEN="))
        .split(";")[0]
        .slice(11),
    );
    const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
    const invalid = await request(app)
      .post("/api/v1/auth/login")
      .set("X-Forwarded-Proto", "https")
      .set("Origin", "https://demo.example.test")
      .set("Cookie", cookie)
      .send({ identifier: "invalid@example.test", password: "test-only" });
    assert.equal(invalid.status, 419);
    const checked = await request(app)
      .post("/api/v1/auth/login")
      .set("X-Forwarded-Proto", "https")
      .set("Origin", "https://demo.example.test")
      .set("Cookie", cookie)
      .set("X-XSRF-TOKEN", csrf)
      .send({ identifier: "invalid@example.test", password: "test-only" });
    assert.notEqual(checked.status, 419);
    assert(checked.status >= 400 && checked.status < 500);
    console.log("HTTPS session and CSRF transport passed.");
  }
} finally {
  await pool.end();
}
