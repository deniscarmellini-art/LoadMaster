import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { acquireTestLock, requireFreePorts, root } from './test-runtime.mjs';
import { initializeTestDatabase } from './init-test-db.mjs';

const release = acquireTestLock();
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  // Only our own child trees; never search/kill by port or process name.
  for (const child of children) if (child.pid && child.exitCode === null) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  release();
  process.exitCode = code;
}
function start(args, cwd) {
  const child = spawn(process.execPath, args, {
    cwd, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, NODE_ENV: 'development', VITE_API_URL: '/api' },
  });
  children.push(child);
  child.once('error', error => { console.error(error); stop(1); });
  child.once('exit', code => { if (!stopping) stop(code ?? 1); });
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
try {
  await requireFreePorts();
  await initializeTestDatabase();
  console.log('\n========== SISLOG - AMBIENTE TEST ==========');
  console.log('Frontend HTTPS + hot reload: https://192.167.4.96:5174');
  console.log('API TEST: http://127.0.0.1:3002 (solo loopback)');
  console.log('Produzione https://192.167.4.96:3001 resta indipendente.');
  console.log('Ctrl+C arresta soltanto i processi TEST avviati da questo script.\n');
  start(['--import', 'tsx', '--watch', 'src/testServer.ts'], resolve(root, 'backend'));
  start(['node_modules/vite/bin/vite.js', '--mode', 'test'], resolve(root, 'frontend'));
} catch (error) { console.error(error); stop(1); }
