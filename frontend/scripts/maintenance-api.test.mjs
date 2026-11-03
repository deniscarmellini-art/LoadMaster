import test from "node:test";
import assert from "node:assert/strict";
import { getMaintenanceNotice, maintenanceCountdownSeconds } from "../src/services/maintenanceApi.ts";

test("maintenance countdown uses the synchronized server deadline and clamps at zero", () => {
  const clientNow = Date.parse("2026-11-03T09:00:00.000Z");
  const deadline = "2026-11-03T09:02:05.000Z";
  assert.equal(maintenanceCountdownSeconds(deadline, clientNow, 5000), 120);
  assert.equal(maintenanceCountdownSeconds(deadline, clientNow + 1000, 5000), 119);
  assert.equal(maintenanceCountdownSeconds("2026-11-03T08:59:00.000Z", clientNow, 0), 0);
  assert.equal(maintenanceCountdownSeconds(null, clientNow, 0), null);
});

test("maintenance polling uses the same-origin API without caching in all build environments", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const serverTime = "2026-11-03T09:00:00.000Z";
  const responses = [
    { formatVersion: 1, updateRevision: 4, state: "scheduled", message: "Aggiornamento SisLog PROD programmato", scheduledAt: "2026-11-03T09:02:00.000Z", serverTime, remainingSeconds: 120 },
    { formatVersion: 1, updateRevision: 4, state: "maintenance", message: "Aggiornamento SisLog PROD programmato", scheduledAt: "2026-11-03T08:59:00.000Z", serverTime, remainingSeconds: 0 },
    { formatVersion: 1, updateRevision: 5, state: "idle", message: null, scheduledAt: null, serverTime, remainingSeconds: null },
  ];

  globalThis.fetch = async (input, init) => {
    requests.push({ input, init });
    return Response.json(responses[requests.length - 1], { headers: { "Cache-Control": "no-store" } });
  };

  try {
    const scheduled = await getMaintenanceNotice();
    const active = await getMaintenanceNotice();
    const resumed = await getMaintenanceNotice();

    assert.equal(scheduled.state, "scheduled");
    assert.equal(scheduled.remainingSeconds, 120);
    assert.equal(active.state, "maintenance");
    assert.equal(active.remainingSeconds, 0);
    assert.equal(resumed.state, "idle");
    assert.equal(resumed.updateRevision, 5);
    assert.equal(requests.length, 3);
    for (const request of requests) {
      assert.equal(request.input, "/api/maintenance");
      assert.equal(request.init.cache, "no-store");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
