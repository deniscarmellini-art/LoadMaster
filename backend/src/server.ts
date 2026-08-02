import "dotenv/config";

import { buildApp } from "./app.js";
import { loadConfig } from "./config/environment.js";

const config = loadConfig();
const app = await buildApp(config);

const shutdown = async (): Promise<void> => {
  await app.close();
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error: unknown) {
  app.log.error(error);
  process.exitCode = 1;
}
