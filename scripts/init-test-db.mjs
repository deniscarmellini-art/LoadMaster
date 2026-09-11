import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, renameSync, unlinkSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { acquireTestLock, assertSeparateDatabase, requireFreePorts, productionDatabase, testDatabase } from './test-runtime.mjs';

export async function initializeTestDatabase(refresh = false) {
  assertSeparateDatabase();
  if (existsSync(testDatabase) && !refresh) {
    console.log(`[TEST] Database esistente conservato: ${testDatabase}`);
    return;
  }
  for (const suffix of ['-wal', '-shm', '-journal'])
    if (existsSync(testDatabase + suffix)) throw new Error('Database TEST non chiuso correttamente. Riavviare e chiudere TEST prima del refresh.');
  if (!existsSync(productionDatabase)) throw new Error(`Database sorgente non trovato: ${productionDatabase}`);
  const temporary = `${testDatabase}.${crypto.randomUUID()}.tmp`;
  const source = new DatabaseSync(productionDatabase, { readOnly: true });
  try {
    // SQLite online backup: consistent snapshot even with production running in WAL mode.
    await backup(source, temporary);
    const copy = new DatabaseSync(temporary, { readOnly: true });
    try {
      if (copy.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Copia TEST non integra');
    } finally { copy.close(); }
    if (existsSync(testDatabase)) {
      const archive = `${testDatabase}.${Date.now()}.bak`;
      renameSync(testDatabase, archive);
      try { renameSync(temporary, testDatabase); }
      catch (error) { renameSync(archive, testDatabase); throw error; }
      console.log(`[TEST] Database TEST precedente conservato: ${archive}`);
    } else renameSync(temporary, testDatabase);
    console.log(`[TEST] Copia indipendente creata: ${testDatabase}`);
  } finally {
    source.close();
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.slice(2).some(arg => arg !== '--refresh')) throw new Error('Uso: node scripts/init-test-db.mjs [--refresh]');
  const release = acquireTestLock();
  try { await requireFreePorts(); await initializeTestDatabase(process.argv.includes('--refresh')); }
  finally { release(); }
}
