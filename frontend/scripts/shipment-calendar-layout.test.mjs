import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('calendario usa i grigi richiesti e conserva i colori delle schede spedizione', async () => {
  const component = await readFile(new URL('../src/components/shipments/ShipmentCalendar.tsx', import.meta.url), 'utf8');
  assert.match(component, /position: "relative", bgcolor: "#F0F2F5", color: "#263238"/);
  assert.match(component, /bgcolor: "#E2E6EB", borderRight: "1px solid #cbd2d9", borderBottom: "1px solid #cbd2d9"/);
  assert.match(component, /borderRight: "1px solid #cbd2d9", borderBottom: "1px solid #cbd2d9", borderColor: "#cbd2d9", bgcolor: "#F0F2F5"/);
  assert.match(component, /BILICO_ESSEPI:\{accent:"#4F9E66",background:"#D7EAD9"\}/);
  assert.match(component, /RITIRA_CLIENTE:\{accent:"#D96C77",background:"#F8D6DC"\}/);
  assert.match(component, /TERZI_PER_ESSEPI:\{accent:"#5A9DD2",background:"#CFE6F8"\}/);
  assert.match(component, /borderLeft: `4px solid \$\{colors\.accent\}`/);
  assert.match(component, /color:"#263238",\s*bgcolor: colors\.background/);
  assert.match(component, /position: "sticky", top: 0/);
});
