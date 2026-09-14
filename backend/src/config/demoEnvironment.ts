import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "./environment.js";

export const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const demoDatabase = resolve(backendRoot, "data/sistema-logistico-demo.sqlite");
const productionDatabase = resolve(backendRoot, "data/sistema-logistico.sqlite");
const testDatabase = resolve(backendRoot, "data/sistema-logistico-test.sqlite");

export function assertDemoDatabase(path = demoDatabase): void {
  if (resolve(path).toLowerCase() !== demoDatabase.toLowerCase())
    throw new Error("DEMO richiede esclusivamente sistema-logistico-demo.sqlite");
  if ([productionDatabase, testDatabase].some(item => resolve(item).toLowerCase() === resolve(path).toLowerCase()))
    throw new Error("DEMO non puo usare database Production o TEST");
  const expectedDirectory = resolve(realpathSync(backendRoot), "data");
  if (existsSync(dirname(path)) && realpathSync(dirname(path)).toLowerCase() !== expectedDirectory.toLowerCase())
    throw new Error("La directory dati DEMO non puo essere un collegamento");
  if (existsSync(path)) {
    const database = statSync(path);
    if (realpathSync(path).toLowerCase() !== resolve(path).toLowerCase() || database.nlink !== 1)
      throw new Error("Il database DEMO non puo essere un link simbolico o hard link");
  }
}

export function demoConfig(): AppConfig {
  assertDemoDatabase();
  return {
    environment: "demo", port: 3003, host: "127.0.0.1",
    databasePath: demoDatabase, frontendOrigin: "http://localhost:5175",
    frontendDistPath: null, httpsKeyPath: null, httpsCertPath: null,
  };
}
