import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
