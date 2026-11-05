import { app } from "./app.js";
import { config } from "./config.js";
import { pool, first } from "./db.js";
await first("SELECT sid FROM em3_sessions LIMIT 1");
const server = app.listen(config.port, config.host, () =>
  console.log(`Thu Thanh EM3 Express: http://${config.host}:${config.port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
