import test from "node:test";
import assert from "node:assert/strict";
import { canReload, classifyWriteResponse, maintenanceResumeCycle, ReloadSafetyRegistry } from "../src/services/reloadSafety.ts";
import { isNewUpdateRevision, markUpdateRevisionApplied, observeUpdateRevision, parseRevision, revisionCycle, revisionFromCycle } from "../src/services/maintenanceRevision.ts";

test("reload only follows a confirmed maintenance to idle transition", () => {
  assert.equal(maintenanceResumeCycle("scheduled", "idle"), false);
  assert.equal(maintenanceResumeCycle("maintenance", "maintenance"), false);
  assert.equal(maintenanceResumeCycle("maintenance", "idle"), true);
  assert.equal(maintenanceResumeCycle(null, "idle"), false);
});

test("edited fields and pending writes prevent reload; a confirmed write can clear edits", () => {
  const safety = new ReloadSafetyRegistry();
  safety.markEdited();
  assert.equal(canReload(safety.getSnapshot()), false);
  const finish = safety.beginWrite();
  assert.equal(safety.getSnapshot().pendingWrites, 1);
  assert.equal(canReload(safety.getSnapshot()), false);
  finish("confirmed");
  assert.equal(safety.getSnapshot().pendingWrites, 0);
  assert.equal(canReload(safety.getSnapshot()), true);
});

test("edits made while a write is pending remain protected after its response", () => {
  const safety = new ReloadSafetyRegistry();
  const finish = safety.beginWrite();
  safety.markEdited();
  finish("confirmed");
  assert.equal(safety.getSnapshot().edited, true);
  assert.equal(canReload(safety.getSnapshot()), false);
});

test("uncertain outcomes stay blocked until explicit operator acknowledgement", () => {
  const safety = new ReloadSafetyRegistry();
  const finish = safety.beginWrite();
  finish("uncertain");
  assert.equal(safety.getSnapshot().uncertainWrites, 1);
  assert.equal(canReload(safety.getSnapshot()), false);
  safety.acknowledgeResolved();
  assert.equal(canReload(safety.getSnapshot()), true);
});

test("operator acknowledgement cannot clear a write that is still in flight", () => {
  const safety = new ReloadSafetyRegistry();
  const finish = safety.beginWrite();
  safety.acknowledgeResolved();
  assert.equal(safety.getSnapshot().pendingWrites, 1);
  assert.equal(canReload(safety.getSnapshot()), false);
  finish("rejected");
  assert.equal(canReload(safety.getSnapshot()), true);
});

test("open critical confirmation prevents reload until it closes", () => {
  const safety = new ReloadSafetyRegistry();
  safety.setCriticalConfirmation(true);
  assert.equal(canReload(safety.getSnapshot()), false);
  safety.setCriticalConfirmation(false);
  assert.equal(canReload(safety.getSnapshot()), true);
});

test("maintenance admission responses are definite rejections, other server errors remain uncertain", () => {
  assert.equal(classifyWriteResponse(503, "MAINTENANCE_ACTIVE"), "rejected");
  assert.equal(classifyWriteResponse(503, "MAINTENANCE_STATE_UNAVAILABLE"), "rejected");
  assert.equal(classifyWriteResponse(503, "DATABASE_UNAVAILABLE"), "uncertain");
  assert.equal(classifyWriteResponse(409, "SHIPMENT_STALE"), "rejected");
  assert.equal(classifyWriteResponse(200), "confirmed");
});

test("a newer persistent update revision is detected after an unreachable maintenance interval", () => {
  const remembered = 12;
  const serverWasUnreachableForWholeMaintenance = true;
  assert.equal(serverWasUnreachableForWholeMaintenance, true);
  assert.equal(isNewUpdateRevision(remembered, 13), true);
  assert.equal(isNewUpdateRevision(remembered, 12), false);
  assert.equal(revisionFromCycle(revisionCycle(13)), 13);
  assert.equal(parseRevision("13"), 13);
  assert.equal(parseRevision("13.2"), null);
});

test("maintenance, backend outage, Resume and recovery reload once without bypassing reloadSafety", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const safety = new ReloadSafetyRegistry();

  const initial = observeUpdateRevision(storage, 20, null);
  assert.equal(initial.pending, null);
  // Polls fail during maintenance; sessionStorage retains revision 20.
  const afterResume = observeUpdateRevision(storage, 21, initial.observed);
  assert.equal(afterResume.pending, 21);
  assert.equal(canReload(safety.getSnapshot()), true);
  assert.equal(revisionCycle(afterResume.pending), "revision-21");

  const finish = safety.beginWrite();
  finish("uncertain");
  assert.equal(canReload(safety.getSnapshot()), false, "the newer revision cannot bypass uncertain work");
  safety.acknowledgeResolved();
  assert.equal(canReload(safety.getSnapshot()), true);

  markUpdateRevisionApplied(storage, 21);
  const afterReload = observeUpdateRevision(storage, 21, 21);
  assert.equal(afterReload.pending, null, "the page loaded after reload does not start a loop");
  assert.equal(values.get("sislog-update-revision"), "21");
});
