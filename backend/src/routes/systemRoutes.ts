import type { FastifyPluginAsync } from "fastify";

import { getHealth, getInfo } from "../controllers/systemController.js";
import type { AppConfig } from "../config/environment.js";
import { readMaintenanceNotice } from "../services/maintenanceNotice.js";

interface SystemRoutesOptions {
  config: AppConfig;
}

export const systemRoutes: FastifyPluginAsync<SystemRoutesOptions> = async (app, options) => {
  app.get("/health", async () => getHealth());
  app.get("/info", async () => getInfo(options.config));
  if (options.config.environment === "test") {
    app.get("/maintenance", async (_request, reply) => {
      reply.header("Cache-Control", "no-store, max-age=0").header("Pragma", "no-cache");
      try {
        return readMaintenanceNotice(options.config.maintenanceStatePath);
      } catch {
      return reply.code(503).send({ code: "MAINTENANCE_STATE_UNAVAILABLE", message: "Stato manutenzione TEST non verificabile" });
      }
    });
  }
};
