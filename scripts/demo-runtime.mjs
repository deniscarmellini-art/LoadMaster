import { closeSync, existsSync, openSync, realpathSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const demoDatabase = resolve(root, 'backend/data/sistema-logistico-demo.sqlite');
const dataDirectory = resolve(root, 'backend/data');

export function assertDemoDatabase() {
  if (resolve(dirname(demoDatabase)).toLowerCase() !== dataDirectory.toLowerCase()) throw new Error('Percorso database DEMO non valido');
  if (existsSync(demoDatabase)) {
    const info = statSync(demoDatabase);
    if (realpathSync(demoDatabase).toLowerCase() !== demoDatabase.toLowerCase() || info.nlink !== 1) throw new Error('Database DEMO: link simbolici e hard link non ammessi');
  }
}

export async function requireDemoPorts() {
  for (const port of [3003, 5175]) await new Promise((resolvePromise, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Porta DEMO ${port} occupata. Nessun processo e stato arrestato.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolvePromise));
  });
}

export function acquireDemoLock() {
  const path = resolve(root, 'backend/data/.sislog-demo.lock');
  let fd;
  try { fd = openSync(path, 'wx'); }
  catch { throw new Error('DEMO gia avviato o lock residuo: backend/data/.sislog-demo.lock'); }
  writeFileSync(fd, String(process.pid));
  return () => { closeSync(fd); unlinkSync(path); };
}
