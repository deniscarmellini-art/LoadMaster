import { spawnSync } from 'node:child_process';
import { acquireDemoLock, assertDemoDatabase, demoDatabase } from './demo-runtime.mjs';

if (process.argv.slice(2).some(argument => argument !== '--reset')) throw new Error('Uso: node scripts/init-demo-db.mjs --reset');
const release = acquireDemoLock();
try {
  assertDemoDatabase();
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/database/demoSeed.ts'], { cwd: 'backend', stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw new Error(`Creazione database DEMO fallita (${result.status ?? 'errore'})`);
  console.log(`[DEMO] Dataset fittizio rigenerato: ${demoDatabase}`);
} finally { release(); }
