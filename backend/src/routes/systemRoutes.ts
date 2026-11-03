import type { FastifyPluginAsync } from "fastify";

import { getHealth, getInfo } from "../controllers/systemController.js";
import type { AppConfig } from "../config/environment.js";
import { MaintenanceWriteGate } from "../services/maintenanceNotice.js";

interface SystemRoutesOptions {
  config: AppConfig;
  maintenanceGate?: MaintenanceWriteGate | null;
}

export const systemRoutes: FastifyPluginAsync<SystemRoutesOptions> = async (app, options) => {
  app.get("/health", async () => getHealth());
  app.get("/info", async () => getInfo(options.config));
  if (options.config.environment === "test" || options.config.environment === "production") {
    app.get("/maintenance", async (_request, reply) => {
      reply.header("Cache-Control", "no-store, max-age=0").header("Pragma", "no-cache");
      try {
        if (!options.maintenanceGate) throw new Error("Gate manutenzione non configurato");
        return options.maintenanceGate.getStatus();
      } catch {
        return reply.code(503).send({
          code: "MAINTENANCE_STATE_UNAVAILABLE",
          message: `Stato manutenzione ${options.config.environment === "production" ? "PROD" : "TEST"} non verificabile`,
          activeWriteRequests: options.maintenanceGate?.getActiveWriteRequests() ?? 0,
        });
      }
    });
  }
};
