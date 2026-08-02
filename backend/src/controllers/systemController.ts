import type { AppConfig } from "../config/environment.js";
import type { HealthResponse, InfoResponse } from "../models/api.js";

export const API_VERSION = "0.5.0";

export const getHealth = (): HealthResponse => ({
  status: "ok",
  service: "Sistema Logistico API",
  version: API_VERSION,
  timestamp: new Date().toISOString(),
});

export const getInfo = (config: AppConfig): InfoResponse => ({
  service: "Sistema Logistico API",
  version: API_VERSION,
  environment: config.environment,
  runtime: `Node.js ${process.versions.node}`,
  database: "sqlite",
});
