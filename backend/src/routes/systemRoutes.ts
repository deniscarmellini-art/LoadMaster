import type { FastifyPluginAsync } from "fastify";

import { getHealth, getInfo } from "../controllers/systemController.js";
import type { AppConfig } from "../config/environment.js";

interface SystemRoutesOptions {
  config: AppConfig;
}

export const systemRoutes: FastifyPluginAsync<SystemRoutesOptions> = async (app, options) => {
  app.get("/health", async () => getHealth());
  app.get("/info", async () => getInfo(options.config));
};
