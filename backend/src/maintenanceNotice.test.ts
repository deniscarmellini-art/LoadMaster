import assert from "node:assert/strict";
import test from "node:test";
import { request as httpRequest } from "node:http";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppConfig } from "./config/environment.js";
import { maintenanceStatePaths } from "./config/environment.js";
import { buildApp } from "./fixtures/departureDdt.js";
import { readMaintenanceNotice } from "./services/maintenanceNotice.js";

const root = mkdtempSync(join(tmpdir(), "sislog-maintenance-notice-"));
test.after(() => rmSync(root, { recursive: true, force: true }));

test("percorsi manutenzione: TEST e PROD sono distinti e una configurazione coincidente viene rifiutata", () => {
  const programData = join(root, "ProgramData");
  const paths = maintenanceStatePaths({ ProgramData: programData });
  assert.equal(paths.test, join(programData, "SisLog", "TEST", "maintenance-state.json"));
  assert.equal(paths.production, join(programData, "SisLog", "PROD", "maintenance-state.json"));
  assert.notEqual(paths.test.toLowerCase(), paths.production.toLowerCase());
  assert.throws(() => maintenanceStatePaths({
    ProgramData: programData,
    SISLOG_TEST_MAINTENANCE_STATE_PATH: paths.test,
    SISLOG_PROD_MAINTENANCE_STATE_PATH: paths.test,
  }), /devono essere distinti/i);
});

test("avviso TEST: assenza file significa idle e GET è read-only/no-store", async () => {
  const statePath = join(root, "missing", "state.json");
  const config: AppConfig = { environment: "test", port: 3002, host: "127.0.0.1", databasePath: ":memory:", frontendOrigin: "http://localhost", frontendDistPath: null, httpsKeyPath: null, httpsCertPath: null, maintenanceStatePath: statePath };
  const app = await buildApp(config);
  try {
    const first = await app.inject({ method: "GET", url: "/api/maintenance" });
    const second = await app.inject({ method: "GET", url: "/api/maintenance" });
    assert.equal(first.statusCode, 200);
    assert.match(first.headers["cache-control"] ?? "", /no-store/);
    assert.equal(first.json().state, "idle");
    assert.equal(first.json().updateRevision, 0);
    assert.equal(first.json().activeWriteRequests, 0);
    assert.equal(second.json().state, "idle");
    assert.equal(existsSync(statePath), false, "la GET non crea né scrive il file di stato");
    assert.equal(first.json().remainingSeconds, null);
  } finally { await app.close(); }
});

test("avviso TEST: espone la revisione persistente e mantiene compatibilità con i file precedenti", async () => {
  const statePath = join(root, "revision.json");
  const config: AppConfig = { environment: "test", port: 3002, host: "127.0.0.1", databasePath: ":memory:", frontendOrigin: "http://localhost", frontendDistPath: null, httpsKeyPath: null, httpsCertPath: null, maintenanceStatePath: statePath };
  writeFileSync(statePath, JSON.stringify({ formatVersion: 1, state: "idle", message: null, scheduledAt: null, updateRevision: 7 }));
  const app = await buildApp(config);
  try {
    const response = await app.inject({ method: "GET", url: "/api/maintenance" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().updateRevision, 7);
    assert.match(response.headers["cache-control"] ?? "", /no-store/);
  } finally { await app.close(); }

  writeFileSync(statePath, JSON.stringify({ formatVersion: 1, state: "idle", message: null, scheduledAt: null }));
  assert.equal(readMaintenanceNotice(statePath).updateRevision, 0, "i file Fase 1/2 senza revisione mantengono compatibilità");
  writeFileSync(statePath, JSON.stringify({ formatVersion: 1, state: "idle", message: null, scheduledAt: null, updateRevision: -1 }));
  assert.throws(() => readMaintenanceNotice(statePath), /illeggibile o danneggiato/i);
});

test("avviso TEST: countdown basato sull'ora server, resta scheduled anche a scadenza", () => {
  const statePath = join(root, "scheduled.json"), now = new Date("2026-11-02T12:00:00.000Z");
  writeFileSync(statePath, JSON.stringify({ formatVersion: 1, state: "scheduled", message: "Aggiornamento programmato", scheduledAt: "2026-11-02T12:02:00.000Z" }));
  assert.equal(readMaintenanceNotice(statePath, now).remainingSeconds, 120);
  const expired = readMaintenanceNotice(statePath, new Date("2026-11-02T12:03:00.000Z"));
  assert.equal(expired.state, "maintenance");
  assert.equal(expired.remainingSeconds, 0);
});

test("blocco TEST: ammette prima della scadenza, rifiuta le nuove scritture dopo e lascia terminare quelle già ammesse", async () => {
  const statePath = join(root, "in-flight.json");
  writeFileSync(statePath, JSON.stringify({ formatVersion: 1, state: "scheduled", message: "test", scheduledAt: new Date(Date.now() + 60_000).toISOString() }));
  const config: AppConfig = { environment: "test", port: 3002, host: "127.0.0.1", databasePath: ":memory:", frontendOrigin: "http://localhost", frontendDistPath: null, httpsKeyPath: null, httpsCertPath: null, maintenanceStatePath: statePath };
  const app = await buildApp(config);
  let markStarted!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  const hold = new Promise<void>(resolve => { finish = resolve; });
  app.post("/__maintenance-test/in-flight", async () => { markStarted(); await hold; return { completed: true }; });
  try {
    assert.equal((await app.inject({ method: "GET", url: "/api/loads" })).statusCode, 200, "le letture restano disponibili");
    const firstWrite = app.inject({ method: "POST", url: "/__maintenance-test/in-flight" });
    await started;
    const active = await app.inject({ method: "GET", url: "/api/maintenance" });
    assert.equal(active.json().activeWriteRequests, 1);
    writeFileSync(statePath, JSON.stringify({ formatVersion: 1, state: "scheduled", message: "test", scheduledAt: "2020-01-01T00:00:00.000Z" }));
    const maintenanceStatus = await app.inject({ method: "GET", url: "/api/maintenance" });
    assert.equal(maintenanceStatus.json().state, "maintenance");
    assert.equal(maintenanceStatus.json().activeWriteRequests, 1, "una scrittura già ammessa resta conteggiata dopo la scadenza");
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const blocked = await app.inject({ method, url: "/__maintenance-test/in-flight" });
      assert.equal(blocked.statusCode, 503, `${method} deve essere bloccato`);
      assert.equal(blocked.json().code, "MAINTENANCE_ACTIVE");
    }
    finish();
    assert.deepEqual((await firstWrite).json(), { completed: true });
    assert.equal((await app.inject({ method: "GET", url: "/api/maintenance" })).json().activeWriteRequests, 0);
  } finally { finish(); await app.close(); }
});

test("blocco TEST: scadenza persistente blocca le scritture anche dopo riavvio e Resume riabilita", async () => {
  const statePath = join(root, "restart.json");
  writeFileSync(statePath, JSON.stringify({ formatVersion: 1, state: "scheduled", message: "test", scheduledAt: "2020-01-01T00:00:00.000Z" }));
  const config: AppConfig = { environment: "test", port: 3002, host: "127.0.0.1", databasePath: ":memory:", frontendOrigin: "http://localhost", frontendDistPath: null, httpsKeyPath: null, httpsCertPath: null, maintenanceStatePath: statePath };
  const first = await buildApp(config);
  const firstResponse = await first.inject({ method: "POST", url: "/api/loads/import", payload: {} });
  assert.equal(firstResponse.statusCode, 503); assert.equal(firstResponse.json().code, "MAINTENANCE_ACTIVE");
  await first.close();

  const restarted = await buildApp(config);
  try {
    assert.equal((await restarted.inject({ method: "GET", url: "/api/maintenance" })).json().state, "maintenance");
    const stillBlocked = await restarted.inject({ method: "POST", url: "/api/loads/import", payload: {} });
    assert.equal(stillBlocked.statusCode, 503); assert.equal(stillBlocked.json().code, "MAINTENANCE_ACTIVE");
    writeFileSync(statePath, JSON.stringify({ formatVersion: 1, state: "idle", message: null, scheduledAt: null }));
    const resumed = await restarted.inject({ method: "POST", url: "/api/loads/import", payload: {} });
    assert.notEqual(resumed.statusCode, 503);
  } finally { await restarted.close(); }
});

test("avviso TEST: stato corrotto restituisce 503 e non viene interpretato come idle", async () => {
  const statePath = join(root, "corrupt.json");
  writeFileSync(statePath, "{not json");
  const config: AppConfig = { environment: "test", port: 3002, host: "127.0.0.1", databasePath: ":memory:", frontendOrigin: "http://localhost", frontendDistPath: null, httpsKeyPath: null, httpsCertPath: null, maintenanceStatePath: statePath };
  const app = await buildApp(config);
  try {
    const response = await app.inject({ method: "GET", url: "/api/maintenance" });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, "MAINTENANCE_STATE_UNAVAILABLE");
  } finally { await app.close(); }
});

test("PROD: endpoint stato disponibile, barriera e conteggio sopravvivono al riavvio del backend", async () => {
  const staticRoot = join(root, "prod-static"); mkdirSync(staticRoot, { recursive: true }); writeFileSync(join(staticRoot, "index.html"), "ok");
  const statePath = join(root, "prod-state.json");
  writeFileSync(statePath, JSON.stringify({ formatVersion: 1, updateRevision: 0, state: "scheduled", message: "test prod", scheduledAt: new Date(Date.now() + 60_000).toISOString() }));
  const config: AppConfig = { environment: "production", port: 3001, host: "127.0.0.1", databasePath: ":memory:", frontendOrigin: "http://localhost", frontendDistPath: staticRoot, httpsKeyPath: null, httpsCertPath: null, maintenanceStatePath: statePath };
  const app = await buildApp(config);
  let markStarted!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  const hold = new Promise<void>(resolve => { finish = resolve; });
  app.post("/__maintenance-prod/in-flight", async () => { markStarted(); await hold; return { completed: true }; });
  try {
    const status = await app.inject({ method: "GET", url: "/api/maintenance" });
    assert.equal(status.statusCode, 200);
    assert.equal(status.json().state, "scheduled");
    assert.equal(status.json().activeWriteRequests, 0);
    const firstWrite = app.inject({ method: "POST", url: "/__maintenance-prod/in-flight" });
    await started;
    assert.equal((await app.inject({ method: "GET", url: "/api/maintenance" })).json().activeWriteRequests, 1);
    writeFileSync(statePath, JSON.stringify({ formatVersion: 1, updateRevision: 1, state: "scheduled", message: "test prod", scheduledAt: "2020-01-01T00:00:00.000Z" }));
    const blocked = await app.inject({ method: "POST", url: "/__maintenance-prod/in-flight" });
    assert.equal(blocked.statusCode, 503);
    assert.equal(blocked.json().code, "MAINTENANCE_ACTIVE");
    assert.equal((await app.inject({ method: "GET", url: "/api/health" })).statusCode, 200, "le letture restano disponibili");
    assert.equal((await app.inject({ method: "GET", url: "/api/maintenance" })).json().activeWriteRequests, 1);
    finish();
    assert.deepEqual((await firstWrite).json(), { completed: true });
    assert.equal((await app.inject({ method: "GET", url: "/api/maintenance" })).json().activeWriteRequests, 0);
  } finally { finish(); await app.close(); }

  const restarted = await buildApp(config);
  try {
    assert.equal((await restarted.inject({ method: "GET", url: "/api/maintenance" })).json().state, "maintenance");
    assert.equal((await restarted.inject({ method: "GET", url: "/api/maintenance" })).json().activeWriteRequests, 0, "il contatore è in memoria e riparte da zero dopo il riavvio");
    assert.equal((await restarted.inject({ method: "POST", url: "/api/loads/import", payload: {} })).statusCode, 503);
  } finally { await restarted.close(); }
});

test("PROD: stato mancante o danneggiato blocca le scritture ma lascia disponibili le letture", async () => {
  const staticRoot = join(root, "prod-fail-closed"); mkdirSync(staticRoot, { recursive: true }); writeFileSync(join(staticRoot, "index.html"), "ok");
  for (const scenario of ["missing", "unconfigured", "corrupt"] as const) {
    const statePath = join(root, `prod-${scenario}.json`);
    if (scenario === "corrupt") writeFileSync(statePath, "{not json");
    const config: AppConfig = { environment: "production", port: 3001, host: "127.0.0.1", databasePath: ":memory:", frontendOrigin: "http://localhost", frontendDistPath: staticRoot, httpsKeyPath: null, httpsCertPath: null, maintenanceStatePath: scenario === "unconfigured" ? null : statePath };
    const app = await buildApp(config);
    try {
      const status = await app.inject({ method: "GET", url: "/api/maintenance" });
      assert.equal(status.statusCode, 503);
      assert.equal(status.json().code, "MAINTENANCE_STATE_UNAVAILABLE");
      assert.equal(status.json().activeWriteRequests, 0);
      const read = await app.inject({ method: "GET", url: "/api/health" });
      assert.equal(read.statusCode, 200);
      for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
        const write = await app.inject({ method, url: "/api/loads/import", payload: {} });
        assert.equal(write.statusCode, 503, `${scenario}: ${method} deve essere bloccato`);
        assert.equal(write.json().code, "MAINTENANCE_STATE_UNAVAILABLE");
      }
    } finally { await app.close(); }
  }
});

test("il contatore resta attivo dopo la disconnessione del client finché termina l'elaborazione server", async () => {
  const statePath = join(root, "disconnect.json");
  writeFileSync(statePath, JSON.stringify({ formatVersion: 1, updateRevision: 0, state: "idle", message: null, scheduledAt: null }));
  const config: AppConfig = { environment: "production", port: 0, host: "127.0.0.1", databasePath: ":memory:", frontendOrigin: "http://localhost", frontendDistPath: join(root, "prod-static"), httpsKeyPath: null, httpsCertPath: null, maintenanceStatePath: statePath };
  mkdirSync(config.frontendDistPath!, { recursive: true });
  writeFileSync(join(config.frontendDistPath!, "index.html"), "ok");
  const app = await buildApp(config);
  let markStarted!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  const hold = new Promise<void>(resolve => { finish = resolve; });
  app.post("/__maintenance-prod/disconnect", async () => { markStarted(); await hold; return { completed: true }; });
  try {
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    const port = Number(new URL(address).port);
    const client = httpRequest({ hostname: "127.0.0.1", port, path: "/__maintenance-prod/disconnect", method: "POST" });
    client.on("error", () => undefined);
    client.end();
    await started;
    client.destroy();
    await new Promise<void>(resolve => setTimeout(resolve, 20));
    assert.equal((await app.inject({ method: "GET", url: "/api/maintenance" })).json().activeWriteRequests, 1);
    finish();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if ((await app.inject({ method: "GET", url: "/api/maintenance" })).json().activeWriteRequests === 0) return;
      await new Promise<void>(resolve => setTimeout(resolve, 10));
    }
    assert.fail("il contatore non è tornato a zero dopo la conclusione server");
  } finally { finish(); await app.close(); }
});
