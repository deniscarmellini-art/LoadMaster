import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('Trasporti: Disimpegna segue il controllo backend su desktop e mobile', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    server: { middlewareMode: true, watch: null, ws: false },
    appType: 'custom',
  });
  try {
    const { default: Transports } = await server.ssrLoadModule('/src/pages/Transports.tsx');
    const base = {
      id: 'T', plate: 'AE 12345', description: '', active: true,
      source: 'MANUAL', assignmentId: 'A', loadId: null,
      commessa: '265001', cliente: 'Cliente', camion: 'C1',
      plannedDepartureDate: null, departedAt: null, availableFrom: null,
      nextInspectionDate: null, disabledReason: null, loadingSessionId: null,
    };
    const render = (status, canRelease, source = 'MANUAL') => renderToStaticMarkup(
      React.createElement(Transports, {
        items: [{ ...base, status, canRelease, source }],
        shipments: [], carriers: [], onRefresh: async () => {},
      }),
    );
    for (const source of ['MANUAL', 'LOAD']) {
      assert.equal((render('IMPEGNATO', true, source).match(/>Disimpegna</g) ?? []).length, 2);
      assert.equal(render('IMPEGNATO', false, source).includes('>Disimpegna<'), false);
    }
    for (const status of ['CARICATO', 'IN_VIAGGIO', 'DISPONIBILE', 'FUORI_SERVIZIO']) {
      assert.equal(render(status, false).includes('>Disimpegna<'), false);
    }
    assert.equal((render('DISPONIBILE', false).match(/>Impegna</g) ?? []).length, 2);
  } finally { await server.close(); }
});
