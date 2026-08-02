import { resolve } from "node:path";

export type NodeEnvironment = "development" | "test" | "production";

export interface AppConfig {
  port: number;
  host: string;
  environment: NodeEnvironment;
  databasePath: string;
  frontendOrigin: string;
}

const parsePort = (value: string | undefined): number => {
  const port = Number(value ?? "3001");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT deve essere un numero intero compreso tra 1 e 65535");
  }
  return port;
};

const parseEnvironment = (value: string | undefined): NodeEnvironment => {
  const environment = value ?? "development";
  if (environment !== "development" && environment !== "test" && environment !== "production") {
    throw new Error("NODE_ENV deve essere development, test oppure production");
  }
  return environment;
};

const parseOrigin = (value: string | undefined): string => {
  const origin = value ?? "http://localhost:5173";
  const parsed = new URL(origin);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("FRONTEND_ORIGIN deve essere un'origine HTTP o HTTPS valida");
  }
  return parsed.origin;
};

export const loadConfig = (environment: NodeJS.ProcessEnv = process.env): AppConfig => ({
  port: parsePort(environment.PORT),
  host: environment.HOST?.trim() || "127.0.0.1",
  environment: parseEnvironment(environment.NODE_ENV),
  databasePath: resolve(environment.DATABASE_URL?.trim() || "./data/sistema-logistico.sqlite"),
  frontendOrigin: parseOrigin(environment.FRONTEND_ORIGIN),
});
