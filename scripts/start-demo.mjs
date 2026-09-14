import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { acquireDemoLock, demoDatabase, requireDemoPorts, root } from './demo-runtime.mjs';

const release = acquireDemoLock();
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.pid && child.exitCode === null) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  release();
  process.exitCode = code;
}
function start(args, cwd) {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', windowsHide: true, env: { ...process.env, NODE_ENV: 'demo', VITE_API_URL: '/api' } });
  children.push(child);
  child.once('error', error => { console.error(error); stop(1); });
  child.once('exit', code => { if (!stopping) stop(code ?? 1); });
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
try {
  if (!existsSync(demoDatabase)) throw new Error('Database DEMO assente. Eseguire npm run db:demo:reset');
  await requireDemoPorts();
  console.log('\n========== SISLOG - AMBIENTE DEMO — DATI FITTIZI ==========');
  console.log('Frontend DEMO: http://localhost:5175');
  console.log('API DEMO: http://127.0.0.1:3003 (solo loopback)');
  console.log('Production e TEST non vengono letti o modificati.');
  console.log('Ctrl+C arresta soltanto i processi DEMO avviati da questo script.\n');
  start(['--import', 'tsx', '--watch', 'src/demoServer.ts'], resolve(root, 'backend'));
  start(['node_modules/vite/bin/vite.js', '--mode', 'demo'], resolve(root, 'frontend'));
} catch (error) { console.error(error); stop(1); }
