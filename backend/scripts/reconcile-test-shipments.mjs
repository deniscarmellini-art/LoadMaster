// Run from backend: node --import tsx scripts/reconcile-test-shipments.mjs [--apply]
// No configurable database path: this maintenance tool is exclusively for TEST.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertTestDatabase, testDatabase, backendRoot } from '../src/config/testEnvironment.ts';
import { previewShipmentReconciliation, reconcileManualShipments } from '../src/repositories/shipmentReconciliation.ts';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--apply')) throw Error('Only --apply is accepted; database is fixed to TEST');
assertTestDatabase();
const apply = args.includes('--apply');
const db = new DatabaseSync(testDatabase, {readOnly: !apply});
try {
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
  if (apply) db.exec('BEGIN IMMEDIATE');
  const decisions = previewShipmentReconciliation(db);
  const before = db.prepare('SELECT * FROM ShipmentPlans ORDER BY id').all();
  if (apply) {
    const out = resolve(backendRoot, '../.verification/shipment-reconciliation');
    mkdirSync(out, {recursive:true});
    writeFileSync(resolve(out, `before-${Date.now()}.json`), JSON.stringify({database:testDatabase, decisions, plans:before},null,2));
    reconcileManualShipments(db);
    const after = db.prepare('SELECT * FROM ShipmentPlans ORDER BY id').all();
    if (after.length !== before.length) throw Error('Unexpected plan count change');
    const links = new Map(decisions.filter(d=>d.reason==='MATCH').map(d=>[d.planId,d.loadId]));
    for (let i=0;i<before.length;i++) {
      const old=before[i], next=after[i];
      if (old.id!==next.id) throw Error('Unexpected plan identity change');
      for (const key of Object.keys(old)) {
        if (links.has(old.id) && ['loadId','manualCommessa','manualCliente','manualCarico','updatedAt'].includes(key)) continue;
        if (old[key]!==next[key]) throw Error(`Planning field changed: ${old.id}/${key}`);
      }
      if (links.has(old.id) && next.loadId!==links.get(old.id)) throw Error('Unexpected link');
    }
    db.exec('COMMIT');
  }
  console.log(JSON.stringify({mode:apply?'APPLIED_TEST':'PREVIEW_TEST', database:testDatabase, linked:decisions.filter(d=>d.reason==='MATCH').length, decisions},null,2));
} catch (error) {
  if (apply && db.isTransaction) db.exec('ROLLBACK');
  throw error;
} finally {db.close();}
