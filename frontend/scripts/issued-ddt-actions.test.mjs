import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('completamento mantiene il carico selezionato e passa alla consultazione', async () => {
  const truckLoading = await readFile(new URL('../src/pages/TruckLoading.tsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const start = truckLoading.indexOf('const close=async()=>{');
  const close = truckLoading.slice(start, truckLoading.indexOf('const mobileUnits=', start));
  assert.match(close, /setBackendStatus\(session\.stato\)/);
  assert.match(close, /setViewOnly\(true\)/);
  assert.doesNotMatch(close, /setSelected\(null\)/);
  assert.match(close, /ora puoi emettere il DDT definitivo/);
  assert.match(app, /setResumeLoad\(normalized\)/);
  assert.match(app, /onReturnToLoads=\{\(\)\s*=>\s*\{/);
  assert.match(app, /key=\{loadingInstance\}/);
  assert.doesNotMatch(app, /key=\{`\$\{resumeLoad\?\.loadId/);
  assert.equal((truckLoading.match(/!closureConfirmedAt&&<Button/g) ?? []).length, 2);
});

test('DDT emesso in Carico camion: soltanto stampa manuale e ritorno all’elenco', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    server: { middlewareMode: true, watch: null, ws: false },
    appType: 'custom',
  });
  try {
    const { default: IssuedDdtActions } = await server.ssrLoadModule('/src/components/shipments/IssuedDdtActions.tsx');
    const html = renderToStaticMarkup(React.createElement(IssuedDdtActions, {
      documentId: 'ddt/123',
      busy: false,
      onView: () => {},
      onReturnToLoads: () => {},
    }));

    assert.match(html, /STAMPA DDT/);
    assert.match(html, /TORNA A CARICO CAMION/);
    assert.doesNotMatch(html, /Visualizza \/ Ristampa DDT|Scarica\/Salva PDF/);
    assert.match(html, /href="\/api\/ddt\/ddt%2F123\/pdf"/);
    assert.doesNotMatch(html, /download=1/);
    assert.match(html, /target="_blank"/);
    assert.doesNotMatch(html, /window\.print|onload=.*print/);

    const archiveHtml = renderToStaticMarkup(React.createElement(IssuedDdtActions, {
      documentId: 'ddt/123',
      busy: false,
      onView: () => {},
    }));
    assert.match(archiveHtml, /Visualizza \/ Ristampa DDT/);
    assert.match(archiveHtml, /Stampa DDT/);
    assert.match(archiveHtml, /Scarica\/Salva PDF/);
    assert.match(archiveHtml, /href="\/api\/ddt\/ddt%2F123\/pdf\?download=1"/);
    assert.doesNotMatch(archiveHtml, /TORNA A CARICO CAMION/);
  } finally {
    await server.close();
  }
});

test('anteprima DDT resta prima dell’emissione e si nasconde con un documento valido', async () => {
  const panel = await readFile(new URL('../src/components/shipments/DefinitiveDdtPanel.tsx', import.meta.url), 'utf8');
  const truckLoading = await readFile(new URL('../src/pages/TruckLoading.tsx', import.meta.url), 'utf8');
  const history = await readFile(new URL('../src/pages/History.tsx', import.meta.url), 'utf8');
  const historyDialog = await readFile(new URL('../src/components/history/ShipmentDocumentDialog.tsx', import.meta.url), 'utf8');
  assert.match(panel, /status&&!status\.document&&<DdtPreviewButton/);
  assert.match(panel, /status\?\.document\?/);
  assert.match(panel, /!archiveOnly&&status&&<>.*!status\.canIssue/);
  assert.match(panel, /archiveOnly&&\(status\?\.history/);
  assert.doesNotMatch(truckLoading, /<DdtPreviewButton/);
  assert.match(panel, /borderTop:1,borderColor:"divider"/);
  assert.match(history, /ShipmentDocumentDialog shipmentId=\{detail\}/);
  assert.match(historyDialog, /DefinitiveDdtPanel[\s\S]*archiveOnly/);
});
