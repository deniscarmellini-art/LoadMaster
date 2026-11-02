import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { labelPanelIndexesInRange, masterPanelBounds, sortLabelPanels } from '../src/services/labelPanelOrdering.ts';

const panels = [
  { id: 'p10', numeroMasterPanel: '10', numeroPannello: '2' },
  { id: 'p2b', numeroMasterPanel: '2', numeroPannello: '10' },
  { id: 'p2a', numeroMasterPanel: '2', numeroPannello: '3' },
  { id: 'p2c', numeroMasterPanel: '2', numeroPannello: '3A' },
  { id: 'p1', numeroMasterPanel: '1', numeroPannello: '20' },
];

test('etichette ordinate numericamente per Master Panel e poi per elemento', () => {
  assert.deepEqual(sortLabelPanels(panels).map(panel => panel.id), ['p1', 'p2a', 'p2c', 'p2b', 'p10']);
  assert.deepEqual(panels.map(panel => panel.id), ['p10', 'p2b', 'p2a', 'p2c', 'p1']);
});

test('intervallo Master Panel include estremi ed elementi con Master Panel ripetuto', () => {
  const ordered = sortLabelPanels(panels);
  assert.deepEqual(labelPanelIndexesInRange(ordered, 2, 2).map(index => ordered[index].id), ['p2a', 'p2c', 'p2b']);
  assert.deepEqual(labelPanelIndexesInRange(ordered, 1, 2).map(index => ordered[index].id), ['p1', 'p2a', 'p2c', 'p2b']);
});

test('intervallo vuoto o valori Master Panel non numerici non producono selezioni spurie', () => {
  assert.deepEqual(labelPanelIndexesInRange([{ numeroMasterPanel: '', numeroPannello: '1' }], 0, 1), []);
  assert.deepEqual(labelPanelIndexesInRange(panels, 11, 20), []);
});

test('limiti automatici derivano dai Master Panel numerici della commessa', () => {
  assert.deepEqual(masterPanelBounds(panels), { min: 1, max: 10 });
  assert.equal(masterPanelBounds([{ numeroMasterPanel: 'N/D', numeroPannello: '1' }]), null);
});

test('tabella e sequenza di stampa condividono l’array ordinato; selezione intervallo sostituisce quella corrente', async () => {
  const page = await readFile(new URL('../src/pages/PrintLabels.tsx', import.meta.url), 'utf8');
  assert.match(page, /setPanels\(ordered\)/);
  assert.match(page, /panels\.map\(\(panel,index\)=>/);
  assert.match(page, /panels\.filter\(\(_,index\)=>selected\.has\(index\)\)/);
  assert.match(page, /setSelected\(new Set\(indexes\)\)/);
  assert.match(page, /const selectTruck=\(truck:string\)=>setSelected\(new Set\(panels\.map/);
  assert.match(page, /initializedOrder\.current!==commessa\.ordine/);
  assert.match(page, /const bounds=masterPanelBounds\(ordered\);setMasterPanelFrom\(bounds\?String\(bounds\.min\):""\);setMasterPanelTo\(bounds\?String\(bounds\.max\):""\)/);
  assert.match(page, /La commessa selezionata non contiene Master Panel numerici validi/);
  assert.match(page, /<Typography[^>]*>Stampa elementi per Master Panel<\/Typography><Typography[^>]*>Da<\/Typography><TextField[^>]*hiddenLabel/);
});
