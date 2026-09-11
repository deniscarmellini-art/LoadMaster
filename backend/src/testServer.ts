// Deliberately does not import dotenv/config or the production server entry point.
import { existsSync } from "node:fs";
import { buildApp } from "./app.js";
import { testConfig } from "./config/testEnvironment.js";

const config = testConfig();
if (!existsSync(config.databasePath)) throw new Error("Inizializzare TEST con scripts/init-test-db.ps1");
const app = await buildApp(config);
app.get("/api/test-environment", async () => ({ environment: "TEST", databasePath: config.databasePath, port: config.port }));
app.addHook("onSend", async (_request, reply, payload) => {
  reply.header("X-SisLog-Environment", "TEST");
  return payload;
});
process.once("SIGINT", () => void app.close());
process.once("SIGTERM", () => void app.close());
try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`[AMBIENTE TEST] API http://127.0.0.1:3002 - DB ${config.databasePath}`);
} catch (error) {
  await app.close();
  throw error;
}
