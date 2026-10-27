import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sortOperationalRows } from '../src/services/operationalTableSorting.ts';
import { dashboardVisualStatus } from '../src/components/dashboard/dashboardVisualStatus.ts';

const rows = [
  { id: 'ten', commessa: '10', cliente: 'Rossi 10', previsti: 10 },
  { id: 'two', commessa: '2', cliente: 'rossi 2', previsti: 2 },
  { id: 'two-b', commessa: '2', cliente: 'Rossi 2', previsti: 2 },
];

test('ordinamento: commessa naturale, quantità numeriche e stabilità', () => {
  assert.deepEqual(sortOperationalRows(rows, 'commessa', 'asc', (row, key) => row[key]).map(row => row.id), ['two', 'two-b', 'ten']);
  assert.deepEqual(sortOperationalRows(rows, 'previsti', 'desc', (row, key) => row[key]).map(row => row.id), ['ten', 'two', 'two-b']);
  assert.deepEqual(sortOperationalRows(rows, 'previsti', 'asc', (row, key) => row[key]).map(row => row.id), ['two', 'two-b', 'ten']);
});

test('ordinamento: testo case-insensitive, copia e ordine originale senza selezione', () => {
  const before = [...rows];
  assert.deepEqual(sortOperationalRows(rows, 'cliente', 'asc', (row, key) => row[key]).map(row => row.id), ['two', 'two-b', 'ten']);
  assert.deepEqual(rows, before);
  assert.deepEqual(sortOperationalRows(rows, null, 'asc', (row, key) => row[key]), rows);
});

test('tabelle operative: colonne azionabili escluse e identità riga conservata', async () => {
  const scanning = await readFile(new URL('../src/pages/ActiveLoads.tsx', import.meta.url), 'utf8');
  const loading = await readFile(new URL('../src/pages/TruckLoading.tsx', import.meta.url), 'utf8');
  const dashboard = await readFile(new URL('../src/components/dashboard/DashboardStatusBadge.tsx', import.meta.url), 'utf8');
  assert.match(scanning, /\{label:"Operazione"\}/);
  assert.match(loading, /\{label:"Operazione"\}/);
  assert.match(scanning, /<TableRow hover key=\{row\.id\}/);
  assert.match(loading, /<TableRow key=\{row\.id\}/);
  assert.match(scanning, /sorted\.map\(row=>/);
  assert.match(loading, /sortedSelectable\.map\(row=>/);
  assert.match(scanning, /dashboardVisualStatus\(row\)\.label/);
  assert.match(scanning, /dashboardVisualStatus\(row\)/);
  assert.match(dashboard, /dashboardVisualStatus\(row\)/);
});

test('tabella desktop Scansione compatta solo il padding verticale delle righe', async () => {
  const scanning = await readFile(new URL('../src/pages/ActiveLoads.tsx', import.meta.url), 'utf8');
  assert.match(scanning, /<TableBody sx=\{\{"& > \.MuiTableRow-root > \.MuiTableCell-root":\{paddingTop:"7px !important",paddingBottom:"7px !important"\}\}\}>/);
  assert.doesNotMatch(scanning, /<Table\s+size="small"/);
  assert.match(scanning, /<Chip label=\{status\.label\.toLocaleUpperCase\("it-IT"\)\} color=\{status\.color\} variant="outlined"\/>/);
  assert.match(scanning, /<TableCell><Button variant="contained" onClick=\{event=>\{event\.stopPropagation\(\);onOpen\(row\);\}\}>/);
  assert.match(scanning, /<Button fullWidth size="large" startIcon=\{<PlayArrowIcon\/>\} sx=\{\{mt:1\.5\}\} variant="contained"/);
});

test('tabella principale Carico camion compatta solo le righe desktop della lista', async () => {
  const loading = await readFile(new URL('../src/pages/TruckLoading.tsx', import.meta.url), 'utf8');
  assert.match(loading, /<TableBody sx=\{\{"& > \.MuiTableRow-root > \.MuiTableCell-root":\{paddingTop:"7px !important",paddingBottom:"7px !important"\}\}\}>\{sortedSelectable\.map/);
  assert.equal((loading.match(/paddingTop:"7px !important"/g) ?? []).length, 1);
  assert.match(loading, /if\(!selected&&mobile\)return <Box/);
  assert.match(loading, /<Table size="small"><TableHead>[\s\S]*?Situazione completa elementi/);
});

test('stato Scansione coincide con la presentazione Dashboard per ogni ID carico', () => {
  const loads = [
    { id: 'load-265372-C7', commessa: '265372', camion: 'C7', stato: 'Da completare', previsti: 4, pronti: 0, caricati: 0 },
    { id: 'load-265372-C8', commessa: '265372', camion: 'C8', stato: 'Da completare', previsti: 4, pronti: 0, caricati: 0 },
    { id: 'load-265372-C9', commessa: '265372', camion: 'C9', stato: 'Da completare', previsti: 4, pronti: 1, caricati: 0 },
    { id: 'load-265410-C2', commessa: '265410', camion: 'C2', stato: 'Da completare', previsti: 4, pronti: 2, caricati: 0 },
    { id: 'load-265410-C3', commessa: '265410', camion: 'C3', stato: 'Da completare', previsti: 4, pronti: 0, caricati: 0 },
  ];
  const byId = new Map(loads.map(load => [load.id, dashboardVisualStatus(load)]));
  assert.deepEqual([...byId].map(([id, status]) => [id, status.label, status.color]), [
    ['load-265372-C7', 'Da preparare', 'error'],
    ['load-265372-C8', 'Da preparare', 'error'],
    ['load-265372-C9', 'In lavorazione', 'warning'],
    ['load-265410-C2', 'In lavorazione', 'warning'],
    ['load-265410-C3', 'Da preparare', 'error'],
  ]);
});

test('presentazione Dashboard mantiene etichette e colori per tutti gli stati', () => {
  const states = [
    [{ stato: 'Da completare', previsti: 3, pronti: 0, caricati: 0 }, 'Da preparare', 'error'],
    [{ stato: 'Da completare', previsti: 3, pronti: 1, caricati: 0 }, 'In lavorazione', 'warning'],
    [{ stato: 'In carico', previsti: 3, pronti: 1, caricati: 1 }, 'In carico', 'warning'],
    [{ stato: 'Da caricare', previsti: 3, pronti: 3, caricati: 0 }, 'Da caricare', 'info'],
    [{ stato: 'Attesa spedizione', previsti: 3, pronti: 0, caricati: 3 }, 'Attesa spedizione', 'success'],
    [{ stato: 'Partita', previsti: 3, pronti: 0, caricati: 3 }, 'Partita', 'success'],
  ];
  for (const [row, label, color] of states) assert.deepEqual(dashboardVisualStatus(row), { label, color });
});
