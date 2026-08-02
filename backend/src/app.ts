import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";

import type { AppConfig } from "./config/environment.js";
import { registerErrorHandlers } from "./middleware/errorHandler.js";
import { systemRoutes } from "./routes/systemRoutes.js";
import { openSqliteDatabase } from "./database/sqliteDatabase.js";
import { OperatorRepository } from "./repositories/operatorRepository.js";
import { TrailerRepository } from "./repositories/trailerRepository.js";
import { CarrierRepository } from "./repositories/carrierRepository.js";
import { OperatorService } from "./services/operatorService.js";
import { TrailerService } from "./services/trailerService.js";
import { CarrierService } from "./services/carrierService.js";
import { operatorRoutes } from "./routes/operatorRoutes.js";
import { trailerRoutes } from "./routes/trailerRoutes.js";
import { carrierRoutes } from "./routes/carrierRoutes.js";
import { LoadRepository } from "./repositories/loadRepository.js";
import { LoadService } from "./services/loadService.js";
import { loadRoutes } from "./routes/loadRoutes.js";

export const buildApp = async (config: AppConfig): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: config.environment !== "test",
  });
  const connection = openSqliteDatabase(config.databasePath);
  app.addHook("onClose", async () => connection.close());
  const operatorService = new OperatorService(new OperatorRepository(connection.database));
  const trailerService = new TrailerService(new TrailerRepository(connection.database));
  const carrierService = new CarrierService(new CarrierRepository(connection.database));
  const loadService = new LoadService(new LoadRepository(connection.database));

  await app.register(cors, {
    origin: config.frontendOrigin,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  registerErrorHandlers(app);
  await app.register(systemRoutes, { prefix: "/api", config });
  await app.register(operatorRoutes, { prefix: "/api/operators", service: operatorService });
  await app.register(trailerRoutes, { prefix: "/api/trailers", service: trailerService });
  await app.register(carrierRoutes, { prefix: "/api/carriers", service: carrierService });
  await app.register(loadRoutes, { prefix: "/api/loads", service: loadService });

  return app;
};
