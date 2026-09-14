import { existsSync, rmSync } from 'node:fs';
import { acquireDemoLock, assertDemoDatabase, demoDatabase } from './demo-runtime.mjs';

const release = acquireDemoLock();
try {
  assertDemoDatabase();
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const target = `${demoDatabase}${suffix}`;
    if (existsSync(target)) rmSync(target);
  }
  console.log(`[DEMO] Database rimosso: ${demoDatabase}`);
} finally { release(); }
