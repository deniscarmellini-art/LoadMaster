import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "./environment.js";

export const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const productionDatabase = resolve(backendRoot, "data/sistema-logistico.sqlite");
export const testDatabase = resolve(backendRoot, "data/sistema-logistico-test.sqlite");

// Never accept DATABASE_URL, PORT or dotenv defaults in the interactive TEST server.
export function assertTestDatabase(path = testDatabase): void {
  if (resolve(path).toLowerCase() !== testDatabase.toLowerCase())
    throw new Error("TEST richiede esclusivamente sistema-logistico-test.sqlite");
  const expectedDirectory = resolve(realpathSync(backendRoot), "data");
  if (existsSync(dirname(path)) && realpathSync(dirname(path)).toLowerCase() !== expectedDirectory.toLowerCase())
    throw new Error("La directory dati TEST non puo essere un collegamento");
  if (existsSync(path)) {
    const test = statSync(path);
    if (realpathSync(path).toLowerCase() !== resolve(path).toLowerCase() || test.nlink !== 1)
      throw new Error("Il database TEST non puo essere un link simbolico o hard link");
    if (existsSync(productionDatabase)) {
      const production = statSync(productionDatabase);
      if (test.dev === production.dev && test.ino === production.ino)
        throw new Error("TEST e PRODUZIONE condividono lo stesso file");
    }
  }
}

export function testConfig(): AppConfig {
  assertTestDatabase();
  return {
    environment: "test", port: 3002, host: "127.0.0.1",
    databasePath: testDatabase, frontendOrigin: "https://localhost:5174",
    frontendDistPath: null, httpsKeyPath: null, httpsCertPath: null,
  };
}
