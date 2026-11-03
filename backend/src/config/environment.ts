import { isAbsolute, resolve } from "node:path";
import { existsSync, realpathSync, statSync } from "node:fs";

export type NodeEnvironment = "development" | "test" | "demo" | "production";

export interface AppConfig {
  port: number;
  host: string;
  environment: NodeEnvironment;
  databasePath: string;
  frontendOrigin: string;
  frontendDistPath: string | null;
  httpsKeyPath: string | null;
  httpsCertPath: string | null;
  /** Persistent environment-specific maintenance state, outside build folders. */
  maintenanceStatePath?: string | null;
}

export interface MaintenanceStatePaths {
  test: string;
  production: string;
}

export const maintenanceStatePaths = (environment: NodeJS.ProcessEnv = process.env): MaintenanceStatePaths => {
  const programData = environment.ProgramData?.trim() || "C:\\ProgramData";
  const test = resolve(environment.SISLOG_TEST_MAINTENANCE_STATE_PATH?.trim() || `${programData}/SisLog/TEST/maintenance-state.json`);
  const production = resolve(environment.SISLOG_PROD_MAINTENANCE_STATE_PATH?.trim() || `${programData}/SisLog/PROD/maintenance-state.json`);
  if (test.toLowerCase() === production.toLowerCase()) {
    throw new Error("I file di manutenzione TEST e PROD devono essere distinti");
  }
  // Also reject aliases to the same existing file, including hard links.
  if (existsSync(test) && existsSync(production)) {
    const testStats = statSync(test);
    const productionStats = statSync(production);
    if (realpathSync(test).toLowerCase() === realpathSync(production).toLowerCase() ||
      (testStats.dev === productionStats.dev && testStats.ino === productionStats.ino)) {
      throw new Error("I file di manutenzione TEST e PROD non possono riferirsi allo stesso file");
    }
  }
  return { test, production };
};

const parsePort = (value: string | undefined): number => {
  const port = Number(value ?? "3001");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT deve essere un numero intero compreso tra 1 e 65535");
  }
  return port;
};

const parseEnvironment = (value: string | undefined): NodeEnvironment => {
  const environment = value ?? "development";
  if (environment !== "development" && environment !== "test" && environment !== "demo" && environment !== "production") {
    throw new Error("NODE_ENV deve essere development, test, demo oppure production");
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

const parseHttpsPaths=(keyValue:string|undefined,certValue:string|undefined,nodeEnvironment:NodeEnvironment):{keyPath:string|null;certPath:string|null}=>{
  const keyPath=keyValue?.trim();
  const certPath=certValue?.trim();
  if(!keyPath&&!certPath)return{keyPath:null,certPath:null};
  if(!keyPath||!certPath)throw new Error("Per abilitare HTTPS configurare sia HTTPS_KEY_PATH sia HTTPS_CERT_PATH");
  if(nodeEnvironment==="production"&&(!isAbsolute(keyPath)||!isAbsolute(certPath)))throw new Error("HTTPS_KEY_PATH e HTTPS_CERT_PATH devono essere percorsi assoluti in produzione");
  return{keyPath:resolve(keyPath),certPath:resolve(certPath)};
};

export const loadConfig = (environment: NodeJS.ProcessEnv = process.env): AppConfig => {
  const nodeEnvironment=parseEnvironment(environment.NODE_ENV);
  const https=parseHttpsPaths(environment.HTTPS_KEY_PATH,environment.HTTPS_CERT_PATH,nodeEnvironment);
  const maintenancePaths = maintenanceStatePaths(environment);
  return{
    port:parsePort(environment.PORT),
    host:environment.HOST?.trim()||"127.0.0.1",
    environment:nodeEnvironment,
    databasePath:parseDatabasePath(environment.DATABASE_URL,nodeEnvironment),
    frontendOrigin:parseOrigin(environment.FRONTEND_ORIGIN),
    frontendDistPath:parseFrontendDistPath(environment.FRONTEND_DIST_PATH,nodeEnvironment),
    httpsKeyPath:https.keyPath,
    httpsCertPath:https.certPath,
    maintenanceStatePath: nodeEnvironment === "test"
      ? maintenancePaths.test
      : nodeEnvironment === "production" ? maintenancePaths.production : null,
  };
};
