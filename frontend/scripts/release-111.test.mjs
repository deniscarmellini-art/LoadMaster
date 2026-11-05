import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer, resolveConfig } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calendarTodayInRome } from '../src/services/shipmentCalendarWeeks.ts';

for (const flag of [true, false]) test(`1.1.1: Scansione, riepiloghi ed export operativi con TEST=${flag}`, async () => {
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
    define: { 'import.meta.env.VITE_SISLOG_TEST': JSON.stringify(flag), 'import.meta.env.PROD': JSON.stringify(!flag) },
    server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' });
  try {
    const load = { id: 'load', commessa: 'COMMESSA-111', cliente: 'Cliente 111', camion: 'C1' };
    const order = { ordine: load.commessa, cliente: load.cliente, riferimento: 'RIF-111', pannelli: [] };
    const { default: Page } = await server.ssrLoadModule('/src/pages/PanelScanning.tsx');
    let writes = 0;
    const html = renderToStaticMarkup(React.createElement(Page, {
      target: load, commessa: order, packages: [], suspendedPackages: [], singles: [], operators: [], draftPanels: [],
      onDraftChange() { writes++; }, onDataChanged: async () => { writes++; },
      onCloseSingle() { writes++; }, onClosePackage() { writes++; }, onConfirmedChange() { writes++; },
    }));
    for (const label of ['Importa QR offline', 'COMMESSA-111', 'RIF-111', 'Apri nuovo pacco']) assert(html.includes(label), label);
    assert(!html.includes('Simula scansione'));
    const { default: Header } = await server.ssrLoadModule('/src/components/shipments/TruckLoadingHeader.tsx');
    const header = renderToStaticMarkup(React.createElement(Header, { selected: load, commesse: [order] }));
    assert(header.includes('RIF-111')); assert(header.includes('Dati del carico selezionato'));
    const { default: Export } = await server.ssrLoadModule('/src/components/shipments/DeliveryProgramExport.tsx');
    assert(renderToStaticMarkup(React.createElement(Export, { filtered: [], details: new Map(), from: '', to: '' })).includes('Esporta pianificazione'));
    assert.equal(writes, 0, 'Rendering must not save, import or associate data');
  } finally { await server.close(); }
});

test('1.1.1: aggiornamenti confermati, revisioni e trasportatore non dipendono dal flag TEST', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /if \(!scanningRevision.current.isCurrent\(revision\)\) return/);
  assert.match(app, /onConfirmedChange=\{confirmScanningChange\}/);
  assert.match(app, /onMutationStart=\{\(\)=>scanningRevision.current.invalidate\(\)\}/);
  const scanning = await readFile(new URL('../src/pages/PanelScanning.tsx', import.meta.url), 'utf8');
  assert.match(scanning, /const localUpdates=!!onConfirmedChange/);
  assert(!scanning.includes('VITE_SISLOG_TEST'));
  const dashboard = await readFile(new URL('../src/pages/Dashboard.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /onChange=\{\(event\) => setDepartureCarrierId\(event.target.value\)\}\s+disabled=\{isDeparting\}/);
});

test('1.1.1: giorno Europe/Rome a mezzanotte, weekend, cambio anno e ora legale', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-12-31T23:30:00Z') });
  for (const [instant, expected] of [
    ['2026-12-31T22:59:59Z', '2026-12-31'], ['2026-12-31T23:00:00Z', '2027-01-01'],
    ['2026-11-07T23:30:00Z', '2026-11-08'], ['2026-07-04T22:30:00Z', '2026-07-05'],
    ['2026-10-25T00:30:00Z', '2026-10-25'], ['2026-10-25T01:30:00Z', '2026-10-25'],
  ]) { t.mock.timers.setTime(new Date(instant).getTime()); assert.equal(calendarTodayInRome(), expected); }
});

test('1.1.1: entrambe le build mantengono il simulatore disabilitato; il server TEST lo conserva', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  for (const mode of ['test', 'production']) {
    const config = await resolveConfig({ root, configFile: `${root}/vite.config.ts`, mode }, 'build');
    assert.equal(config.define['import.meta.env.VITE_SISLOG_TEST'], 'false');
  }
  const config = await resolveConfig({ root, configFile: `${root}/vite.config.ts`, mode: 'test' }, 'serve');
  assert.equal(config.define['import.meta.env.VITE_SISLOG_TEST'], 'true');
});
