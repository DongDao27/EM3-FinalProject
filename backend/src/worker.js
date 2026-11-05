import { query, pool } from "./db.js";
import { closeOrder, refreshOrder } from "./payments.js";
import { deliverMailBatch } from "./mail.js";
export async function tick() {
  // Provider queries happen outside database locks; each state mutation is transactional.
  for (const order of await query(
    "SELECT * FROM orders WHERE lifecycle='open' AND payment_status<>'paid' AND expires_at<=UTC_TIMESTAMP() ORDER BY id LIMIT 50",
  ))
    await closeOrder(order);
  for (const order of await query(
    "SELECT DISTINCT o.* FROM orders o JOIN payment_attempts a ON a.order_id=o.id WHERE o.payment_status<>'paid' AND a.status IN ('created','pending','unknown') AND (a.query_requested_at IS NULL OR a.query_requested_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 5 MINUTE)) ORDER BY o.id LIMIT 50",
  ))
    await refreshOrder(order);
  await query("DELETE FROM em3_sessions WHERE expires_at<UTC_TIMESTAMP()");
  await query(
    "DELETE FROM password_reset_tokens WHERE created_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 60 MINUTE)",
  );
  await deliverMailBatch();
}
if (process.argv[1]?.endsWith("worker.js")) {
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      stopping = true;
    });
  console.log("EM3 scheduler/mail worker ready.");
  while (!stopping) {
    try {
      await tick();
    } catch (e) {
      console.error("Worker cycle failed: " + (e.code || e.name));
    }
    if (process.argv.includes("--once")) break;
    for (let i = 0; i < 15 && !stopping; i++) await new Promise((r) => setTimeout(r, 1000));
  }
  await pool.end();
}
