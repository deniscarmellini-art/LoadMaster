import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fileURLToPath } from 'node:url';
import { getNextBusinessDays } from '../src/utils/businessDays.ts';

test('Dashboard rimuove i titoli ridondanti e usa lo spazio recuperato per una riga', async () => {
  const upcoming = await readFile(new URL('../src/components/dashboard/UpcomingShipments.tsx', import.meta.url), 'utf8');
  const content = await readFile(new URL('../src/components/dashboard/DashboardContent.tsx', import.meta.url), 'utf8');
  const grid = await readFile(new URL('../src/components/dashboard/DashboardGrid.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(upcoming, /Spedizioni scadute e prossimi 4 giorni lavorativi/);
  assert.doesNotMatch(content, /Commesse attive \(/);
  assert.match(upcoming, /mb:\s*1/);
  assert.match(upcoming, /pt:\s*1/);
  assert.match(content, /pt:\s*1/);
  assert.match(content, /height:\s*\{\s*sm:\s*"min\(676px, calc\(100vh - 280px\)\)"/);
  assert.match(grid, /rowHeight=\{56\}/);
});

test('schede spedizioni Dashboard compatte su due righe, note accessibili e badge invariati', async () => {
  const upcoming = await readFile(new URL('../src/components/dashboard/UpcomingShipments.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(upcoming, /statusLabels|PRONTA: "Pronta"|IN_VIAGGIO: "In viaggio"/);
  assert.match(upcoming, /height: 20,[\s\S]*fontSize: "0\.7rem"/);
  assert.match(upcoming, /p: 1\.5/);
  assert.match(upcoming, /"& > \* \+ \*": \{ mt: 0\.25 \}/);
  assert.match(upcoming, /title=\{heading\}[\s\S]*noWrap/);
  assert.match(upcoming, /justifyContent: "space-between", gap: 0\.5, minWidth: 0/);
  assert.match(upcoming, /const note = shipment\.notes\?\.trim\(\)/);
  assert.match(upcoming, /<Tooltip key=\{shipment\.id\} title=\{note \?\? ""\} placement="top" describeChild>/);
  assert.match(upcoming, /aria-label=\{note \? `\$\{heading\}\. \$\{transportText\}\. Nota: \$\{note\}` : undefined\}/);
  assert.match(upcoming, /note && \(/);
  assert.match(upcoming, /title=\{note\}/);
  assert.match(upcoming, /noWrap/);
  assert.match(upcoming, /dayShipments\.map\(\(shipment\)/);
});

test('Dashboard mostra una o cinque spedizioni, note e stati senza nasconderle', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' });
  try {
    const { default: UpcomingShipments } = await server.ssrLoadModule('/src/components/dashboard/UpcomingShipments.tsx');
    const date = getNextBusinessDays(new Date(), 4)[0].iso;
    const shipments = Array.from({ length: 5 }, (_, index) => ({
      id: `SHIP-${index}`, persisted: true, loadId: `LOAD-${index}`, commessa: `COMM-${index}`, camion: `C${index + 1}`,
      cliente: index === 0 ? 'Cliente con denominazione molto lunga per verificare il troncamento' : `Cliente ${index}`,
      orderReference: null, plannedDepartureDate: date, actualDepartureDate: null, transportType: 'BILICO_ESSEPI',
      transportDetailLabel: 'Bilico Essepi · trasportatore di prova', shipmentStatus: index === 1 ? 'IN_VIAGGIO' : 'PRONTA',
      operationalStatus: index === 0 ? 'ATTESA_SPEDIZIONE' : index === 1 ? 'IN_CARICO' : null,
      notes: index === 0 ? 'Nota lunga di prova che deve essere consultabile integralmente con mouse e tastiera.' : null,
    }));
    const render = rows => renderToStaticMarkup(React.createElement(UpcomingShipments, { shipments: rows, carriers: [{ id: 'C', nome: 'Essepi' }], transports: [], onOpenShipments: () => {} }));
    const one = render(shipments.slice(0, 1));
    assert.match(one, /Cliente con denominazione molto lunga/);
    assert.match(one, /aria-label="[^"]*Nota: Nota lunga di prova che deve essere consultabile integralmente con mouse e tastiera\."/);
    assert.match(one, /tabindex="0"/);
    assert.doesNotMatch(one, /Pronta|In viaggio/);

    const five = render(shipments);
    assert.equal((five.match(/<button\b/g) ?? []).length, 5);
    assert.match(five, /ATTESA SPEDIZIONE/);
    assert.match(five, /IN CARICO/);
    assert.doesNotMatch(five, /Pronta|In viaggio/);
  } finally {
    await server.close();
  }
});

test('clic da Dashboard apre il dettaglio della spedizione tramite ID e al close torna alla Dashboard', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const shipmentsPage = await readFile(new URL('../src/pages/Shipments.tsx', import.meta.url), 'utf8');
  assert.match(app, /onOpenShipments=\{\(shipment\) => \{\s*setDashboardShipmentId\(shipment\?\.id \?\? null\);\s*setPage\("shipments"\);/);
  assert.match(app, /initialShipmentId=\{dashboardShipmentId\}/);
  assert.match(shipmentsPage, /items\.find\(item => item\.id === initialShipmentId\)/);
  assert.match(shipmentsPage, /initialShipmentHandled\.current = initialShipmentId;\s*const departed = shipmentHasDeparted\(shipment\);\s*open\(shipment, undefined, departed\)/);
  assert.match(shipmentsPage, /const open = \(item\?: ShipmentItem, date\?: string, readOnly=false\)/);
  assert.match(shipmentsPage, /readOnlyDashboardDetail\s*\?\s*"Dettaglio spedizione"/);
  assert.match(shipmentsPage, /!readOnlyDashboardDetail\s*&&\s*editing!=="new"\s*&&\s*editing\?\.persisted/);
  assert.match(shipmentsPage, /setEditing\(null\);[\s\S]*?if \(initialShipmentHandled\.current\) \{[\s\S]*onReturnToDashboard\?\.\(\)/);
  assert.match(shipmentsPage, /onClose=\{closeEditor\}/);

  const sameCommessa = [
    { id: 'shipment-load-a', commessa: 'COMM-1', loadId: 'load-a' },
    { id: 'shipment-load-b', commessa: 'COMM-1', loadId: 'load-b' },
  ];
  assert.equal(sameCommessa.find(item => item.id === 'shipment-load-b'), sameCommessa[1]);
});
