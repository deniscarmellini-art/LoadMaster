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
import { ScanningRepository } from "./repositories/scanningRepository.js";
import { ScanningService } from "./services/scanningService.js";
import { scanningRoutes } from "./routes/scanningRoutes.js";
import { LoadingRepository } from "./repositories/loadingRepository.js";
import { LoadingService } from "./services/loadingService.js";
import { loadingRoutes } from "./routes/loadingRoutes.js";
import { TransportRepository } from "./repositories/transportRepository.js";
import { TransportService } from "./services/transportService.js";
import { transportRoutes } from "./routes/transportRoutes.js";
import { OperationalSettingRepository } from "./repositories/operationalSettingRepository.js";
import { OperationalSettingService } from "./services/operationalSettingService.js";
import { operationalSettingRoutes } from "./routes/operationalSettingRoutes.js";

export const buildApp = async (config: AppConfig): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: config.environment !== "test",
  });
  const connection = openSqliteDatabase(config.databasePath);
  app.addHook("onClose", async () => connection.close());
  const operatorService = new OperatorService(new OperatorRepository(connection.database));
  const trailerService = new TrailerService(new TrailerRepository(connection.database));
  const carrierService = new CarrierService(new CarrierRepository(connection.database));
  const transportRepository=new TransportRepository(connection.database);
  const loadService = new LoadService(new LoadRepository(connection.database),transportRepository);
  const scanningService = new ScanningService(new ScanningRepository(connection.database));
  const loadingService = new LoadingService(new LoadingRepository(connection.database,transportRepository),transportRepository);
  const transportService=new TransportService(transportRepository);
  const operationalSettingService = new OperationalSettingService(new OperationalSettingRepository(connection.database));

  await app.register(cors, {
    origin: config.frontendOrigin,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  registerErrorHandlers(app);
  await app.register(systemRoutes, { prefix: "/api", config });
  await app.register(operatorRoutes, { prefix: "/api/operators", service: operatorService });
  await app.register(trailerRoutes, { prefix: "/api/trailers", service: trailerService });
  await app.register(carrierRoutes, { prefix: "/api/carriers", service: carrierService });
  await app.register(operationalSettingRoutes, { prefix: "/api/operational-settings", service: operationalSettingService });
  await app.register(loadRoutes, { prefix: "/api/loads", service: loadService });
  await app.register(scanningRoutes, { prefix: "/api", service: scanningService });
  await app.register(loadingRoutes, { prefix: "/api", service: loadingService });
  await app.register(transportRoutes, { prefix: "/api", service: transportService });

  return app;
};
