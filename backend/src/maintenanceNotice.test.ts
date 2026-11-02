import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppConfig } from "./config/environment.js";
import { buildApp } from "./fixtures/departureDdt.js";
import { readMaintenanceNotice } from "./services/maintenanceNotice.js";

const root = mkdtempSync(join(tmpdir(), "sislog-maintenance-notice-"));
test.after(() => rmSync(root, { recursive: true, force: true }));

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
    writeFileSync(statePath, JSON.stringify({ formatVersion: 1, state: "scheduled", message: "test", scheduledAt: "2020-01-01T00:00:00.000Z" }));
    const blocked = await app.inject({ method: "POST", url: "/__maintenance-test/in-flight" });
    assert.equal(blocked.statusCode, 503);
    assert.equal(blocked.json().code, "MAINTENANCE_ACTIVE");
    finish();
    assert.deepEqual((await firstWrite).json(), { completed: true });
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

test("route stato manutenzione non è registrata fuori da TEST", async () => {
  const staticRoot = join(root, "prod-static"); mkdirSync(staticRoot, { recursive: true }); writeFileSync(join(staticRoot, "index.html"), "ok");
  const config: AppConfig = { environment: "production", port: 3001, host: "127.0.0.1", databasePath: ":memory:", frontendOrigin: "http://localhost", frontendDistPath: staticRoot, httpsKeyPath: null, httpsCertPath: null, maintenanceStatePath: join(root, "unused.json") };
  const app = await buildApp(config);
  try { assert.equal((await app.inject({ method: "GET", url: "/api/maintenance" })).statusCode, 404); }
  finally { await app.close(); }
});
