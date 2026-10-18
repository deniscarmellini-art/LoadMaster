// Read-only suggestions, exclusively for TEST. Linking uses the existing /link API.
import { DatabaseSync } from 'node:sqlite';
import { assertTestDatabase, testDatabase } from '../src/config/testEnvironment.ts';
import { previewShipmentReconciliation } from '../src/repositories/shipmentReconciliation.ts';

if (process.argv.length > 2) throw Error('Read-only preview: automatic textual linking is disabled. Confirm suggestions through PATCH /shipments/:id/link.');
assertTestDatabase();
const db = new DatabaseSync(testDatabase, {readOnly:true});
try {
  console.log(JSON.stringify({mode:'PREVIEW_TEST',database:testDatabase,decisions:previewShipmentReconciliation(db)},null,2));
} finally {db.close();}
