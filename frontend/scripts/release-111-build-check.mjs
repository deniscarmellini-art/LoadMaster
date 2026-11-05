import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const hash = data => createHash('sha256').update(data).digest('hex');
for (const mode of ['test', 'prod']) {
  const dir = resolve(root, `.verification/1.1.1/frontend-${mode}/assets`);
  const files = readdirSync(dir);
  const javascript = files.filter(name => name.endsWith('.js')).map(name => readFileSync(join(dir, name), 'utf8')).join('\n');
  for (const label of ['Importa QR offline', 'Scansioni del Collector', 'Riepilogo compatto carico camion',
    'Rimorchio impegnato:', 'Cliente proposto:', 'Mostra settimane passate completate', 'Europe/Rome',
    'Esporta pianificazione', 'Scarica Excel', 'download=1', '1.1.1']) assert(javascript.includes(label), `${mode}: missing ${label}`);
  for (const forbidden of ['Simula scansione', 'test-qr-candidates', 'AMBIENTE TEST', 'AMBIENTE DEMO — DATI FITTIZI']) {
    assert(!javascript.includes(forbidden), `${mode}: leaked ${forbidden}`);
  }
  const assetHashes = new Set(files.filter(name => !name.endsWith('.js')).map(name => hash(readFileSync(join(dir, name)))));
  for (const name of ['essepi-v3.png', 'DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']) {
    assert(assetHashes.has(hash(readFileSync(resolve(root, `backend/assets/ddt/${name}`)))), `${mode}: DDT asset mismatch ${name}`);
  }
  console.log(`${mode}: funzioni operative presenti, simulatore e fascia TEST assenti, 3 asset DDT SHA-256 corrispondenti`);
}
