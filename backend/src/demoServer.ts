import { existsSync } from "node:fs";
import { buildApp } from "./app.js";
import { demoConfig } from "./config/demoEnvironment.js";

const config = demoConfig();
if (!existsSync(config.databasePath)) throw new Error("Inizializzare DEMO con npm run db:demo:reset");
const app = await buildApp(config);
app.get("/api/demo-environment", async () => ({ environment: "DEMO", databasePath: config.databasePath, port: config.port }));
app.addHook("onSend", async (_request, reply, payload) => {
  reply.header("X-SisLog-Environment", "DEMO");
  return payload;
});
process.once("SIGINT", () => void app.close());
process.once("SIGTERM", () => void app.close());
try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`[AMBIENTE DEMO] API http://127.0.0.1:3003 - DB ${config.databasePath}`);
} catch (error) {
  await app.close();
  throw error;
}
