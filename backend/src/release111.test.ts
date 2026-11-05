import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "./app.js";
import { customerFields } from "./models/customer.js";

for (const environment of ["test", "production"] as const) {
  test(`1.1.1: ${environment} associa il cliente soltanto dopo scelta esplicita`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "sislog-111-customer-"));
    const maintenanceStatePath = join(dir, "maintenance.json");
    writeFileSync(maintenanceStatePath, JSON.stringify({ formatVersion: 1, updateRevision: 0, state: "idle", message: null, scheduledAt: null }));
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>Fixture 1.1.1</title>");
    const app = await buildApp({ environment, databasePath: join(dir, "fixture.sqlite"), maintenanceStatePath,
      port: 0, host: "127.0.0.1", frontendOrigin: "http://localhost", frontendDistPath: environment === "production" ? dir : null, httpsKeyPath: null, httpsCertPath: null });
    try {
      if (environment === "production") {
        const simulator = await app.inject({ method: "GET", url: "/api/loading-sessions/unknown/test-qr-candidates" });
        assert.equal(simulator.statusCode, 404, "Production must not expose simulator API");
      }
      const fields = Object.fromEntries(customerFields.map(field => [field, ""]));
      const customer = await app.inject({ method: "POST", url: "/api/customers", payload: { ...fields, denominazione: "Cliente 111 SRL", partitaIva: "00123456789" } });
      assert.equal(customer.statusCode, 201, customer.body);
      const input = { commessa: "RELEASE-111", cliente: "Cliente 111 SRL", camion: "C1", transportType: "RITIRA_CLIENTE" };
      const create = await app.inject({ method: "POST", url: "/api/shipments", payload: input });
      assert.equal(create.statusCode, 200, create.body);
      assert.equal(create.json().customerId, null, "Omission must not silently associate the matching customer");
      const id = create.json().id;
      const save = (payload: object) => app.inject({ method: "PUT", url: `/api/shipments/${id}`, payload });
      const explicit = await save({ ...input, customerId: customer.json().id, expectedUpdatedAt: create.json().updatedAt });
      assert.equal(explicit.statusCode, 200, explicit.body);
      assert.equal(explicit.json().customerId, customer.json().id);
      const unchanged = await save({ ...input, notes: "Nota modificata", expectedUpdatedAt: explicit.json().updatedAt });
      assert.equal(unchanged.statusCode, 200, unchanged.body);
      assert.equal(unchanged.json().customerId, customer.json().id, "Existing links survive an unrelated save");
      const cleared = await save({ ...input, customerId: null, expectedUpdatedAt: unchanged.json().updatedAt });
      assert.equal(cleared.statusCode, 200, cleared.body);
      assert.equal(cleared.json().customerId, null, "Explicit removal must not trigger recognition");
    } finally { await app.close(); rmSync(dir, { recursive: true, force: true }); }
  });
}
