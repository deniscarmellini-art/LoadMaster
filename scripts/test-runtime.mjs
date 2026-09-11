import { existsSync, realpathSync, statSync, openSync, closeSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import net from 'node:net';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const productionDatabase = resolve(root, 'backend/data/sistema-logistico.sqlite');
export const testDatabase = resolve(root, 'backend/data/sistema-logistico-test.sqlite');

export function assertSeparateDatabase() {
  if (realpathSync(dirname(testDatabase)).toLowerCase() !== resolve(realpathSync(root), 'backend/data').toLowerCase())
    throw new Error('La directory dati non puo essere un collegamento');
  if (existsSync(testDatabase)) {
    const test = statSync(testDatabase);
    if (realpathSync(testDatabase).toLowerCase() !== testDatabase.toLowerCase() || test.nlink !== 1)
      throw new Error('Database TEST: link simbolici e hard link non ammessi');
    if (existsSync(productionDatabase)) {
      const production = statSync(productionDatabase);
      if (test.dev === production.dev && test.ino === production.ino) throw new Error('Database non separati');
    }
  }
}

export async function requireFreePorts() {
  for (const port of [3002, 5174]) await new Promise((resolvePromise, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Porta TEST ${port} occupata. Nessun processo e stato arrestato.`)));
    server.listen(port, '0.0.0.0', () => server.close(resolvePromise));
  });
}

// Shared by startup and refresh; prevents replacing a database while TEST is running.
export function acquireTestLock() {
  const path = resolve(root, 'backend/data/.sislog-test.lock');
  let fd;
  try { fd = openSync(path, 'wx'); }
  catch { throw new Error('TEST gia avviato o lock residuo: backend/data/.sislog-test.lock. Consultare docs/ambienti.md.'); }
  writeFileSync(fd, String(process.pid));
  return () => { closeSync(fd); unlinkSync(path); };
}
