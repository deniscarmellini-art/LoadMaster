import { isAbsolute, resolve } from "node:path";

export type NodeEnvironment = "development" | "test" | "production";

export interface AppConfig {
  port: number;
  host: string;
  environment: NodeEnvironment;
  databasePath: string;
  frontendOrigin: string;
  frontendDistPath: string | null;
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

const parseFrontendDistPath=(value:string|undefined,nodeEnvironment:NodeEnvironment):string|null=>{
  const path=value?.trim();
  if(nodeEnvironment!=="production")return path&&isAbsolute(path)?path:null;
  if(!path)throw new Error("FRONTEND_DIST_PATH è obbligatorio quando NODE_ENV=production");
  if(!isAbsolute(path))throw new Error("FRONTEND_DIST_PATH deve essere un percorso assoluto");
  return path;
};

const parseDatabasePath=(value:string|undefined,nodeEnvironment:NodeEnvironment):string=>{
  const path=value?.trim();
  if(nodeEnvironment!=="production")return resolve(path||"./data/sistema-logistico.sqlite");
  if(!path)throw new Error("DATABASE_URL è obbligatorio quando NODE_ENV=production");
  if(!isAbsolute(path))throw new Error("DATABASE_URL deve essere un percorso assoluto in produzione");
  return path;
};

export const loadConfig = (environment: NodeJS.ProcessEnv = process.env): AppConfig => {
  const nodeEnvironment=parseEnvironment(environment.NODE_ENV);
  return{
    port:parsePort(environment.PORT),
    host:environment.HOST?.trim()||"127.0.0.1",
    environment:nodeEnvironment,
    databasePath:parseDatabasePath(environment.DATABASE_URL,nodeEnvironment),
    frontendOrigin:parseOrigin(environment.FRONTEND_ORIGIN),
    frontendDistPath:parseFrontendDistPath(environment.FRONTEND_DIST_PATH,nodeEnvironment),
  };
};
