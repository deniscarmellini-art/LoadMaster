import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildOfflinePanelPreview, parseOfflinePanelLines } from '../src/services/offlinePanelScan.ts';
import { clearCollectorText, readCollectorText } from '../src/services/collectorInput.ts';
import { registerPanelInActivePackage } from '../src/services/packagePanelRegistration.ts';

test('Collector offline mantiene una riga per QR e ignora righe vuote', () => {
  assert.deepEqual(parseOfflinePanelLines(' QR-1\r\n\r\nQR-2\n'), [
    { line: 1, raw: 'QR-1' },
    { line: 2, raw: 'QR-2' },
  ]);
});

test('anteprima separa validi, duplicati e errori senza registrare elementi', () => {
  let validations = 0;
  const rows = buildOfflinePanelPreview('A\nA\nB\nC', raw => {
    validations++;
    if (raw === 'C') return { error: 'Elemento non previsto' };
    return { code: raw, duplicateKey: raw };
  });
  assert.equal(validations, 4);
  assert.deepEqual(rows.map(row => row.status), ['VALID', 'DUPLICATE', 'VALID', 'ERROR']);
  assert.equal(rows[1].message, 'QR duplicato nel testo importato');
  assert.equal(rows[3].message, 'Elemento non previsto');
});

test('Scansione offline usa validazione e registrazione manuali per modalità pacco e singoli', async () => {
  const page = await readFile(new URL('../src/pages/PanelScanning.tsx', import.meta.url), 'utf8');
  assert.match(page, /const validatePanelScan=/);
  assert.match(page, /const scan=async\(raw:string,requireOpenPackage=false\)/);
  assert.match(page, /scan\(row\.raw,mode==="package"\)/);
  assert.match(page, /registerSinglePanel\(panel\.backendId!,selectedOperator\.id\)/);
  assert.doesNotMatch(page, /scanPanel\(panel\.backendId!,selectedOperator\.id\).*closeSinglePanel/);
  assert.match(page, /registerPanelInActivePackage\(\{packageId:activePackageIdRef/);
  assert.match(page, /Apri o riprendi un pacco prima di importare QR in modalità pacco/);
  assert.match(page, /Conferma per registrare con la modalità indicata/);
  assert.match(page, /Risposta del server non ricevuta: verifica lo stato dell'elemento prima di riprovare/);
  assert.match(page, /Importa QR offline/);
});

test('dialogo QR offline chiudibile a riposo, intercetta Esc e focalizza il Collector dopo apertura', async () => {
  const page = await readFile(new URL('../src/pages/PanelScanning.tsx', import.meta.url), 'utf8');
  assert.match(page, /const offlineCollectorRef=useRef<HTMLInputElement>\(null\)/);
  assert.match(page, /if\(!offlineImportOpen\)return;const frame=requestAnimationFrame\(\(\)=>offlineCollectorRef\.current\?\.focus\(\)\)/);
  assert.match(page, /onClose=\{closeOfflineImport\}/);
  assert.match(page, /event\.key==="Escape"&&!offlineBusy/);
  assert.match(page, /<Button type="button" disabled=\{offlineBusy\} onClick=\{closeOfflineImport\}>/);
  assert.doesNotMatch(page, /<TextField autoFocus fullWidth multiline minRows=\{5\}/);
  assert.match(page, /const offlineImportDialog=testUi&&<Dialog/);
  assert.match(page, /\{offlineImportDialog\}/);
});

test('buffer nativo conserva caratteri rapidi, separatori e piu QR senza normalizzazione', () => {
  const qr = 'CA=C2-|CL=RD Chalet|N=418|R=1';
  const input = { value: '' };
  for (const character of qr) input.value += character;
  assert.equal(readCollectorText(input), qr);
  assert.match(readCollectorText(input), /CA=C2-/);
  assert.match(readCollectorText(input), /CL=RD Chalet\|N=418/);

  const batch = `${qr}\nCA=C3-|CL=Secondo|N=419|R=1`;
  input.value = batch;
  assert.equal(readCollectorText(input), batch);
  clearCollectorText(input);
  assert.equal(input.value, '');
});

test('Scansione usa input nativi non controllati per digitazione rapida diretta e Collector', async () => {
  const scanner = await readFile(new URL('../src/components/scanning/ScannerInput.tsx', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/pages/PanelScanning.tsx', import.meta.url), 'utf8');
  const truckLoading = await readFile(new URL('../src/pages/TruckLoading.tsx', import.meta.url), 'utf8');
  assert.match(scanner, /bufferedInput=false/);
  assert.match(scanner, /bufferedInput\?readCollectorText\(inputRef\.current\):value/);
  assert.match(scanner, /bufferedInput\?\{defaultValue:value\}:\{value,onChange:/);
  assert.match(scanner, /onScan\(scannedValue\)/);
  assert.match(page, /<ScannerInput managedFocus bufferedInput/);
  assert.match(page, /<TextField inputRef=\{offlineCollectorRef\}[^>]*defaultValue=""/);
  assert.doesNotMatch(page, /setOfflineText|value=\{offlineText\}/);
  assert.match(page, /readCollectorText\(offlineCollectorRef\.current\)/);
  assert.doesNotMatch(truckLoading, /<ScannerInput[^>]*bufferedInput/);
});

test('sezione Pacco aperto precede Elementi previsti ed è assente fuori dalla modalità pacco', async () => {
  const page = await readFile(new URL('../src/pages/PanelScanning.tsx', import.meta.url), 'utf8');
  const desktop = page.slice(page.indexOf('  return <Box>'));
  const packageSection = desktop.indexOf('{mode==="package"&&<Paper sx={{p:2,mb:2}}');
  const expectedElements = desktop.indexOf('<Typography variant="h6" sx={{mb:1}}>Elementi previsti</Typography>');
  assert.ok(packageSection >= 0 && expectedElements >= 0 && packageSection < expectedElements);
  assert.match(page, /mode!=="package"\?\!testUi&&<Button/);
  assert.match(page, /mode==="package"&&<Paper sx=\{\{p:2,mb:2\}\}/);
});

test('pacco nuovo vuoto: anteprima senza scritture e batch confermato riusa il pacco creato dal primo QR', async () => {
  const page = await readFile(new URL('../src/pages/PanelScanning.tsx', import.meta.url), 'utf8');
  const previewStart = page.indexOf('const prepareOfflinePreview=');
  const confirmStart = page.indexOf('const confirmOfflineImport=', previewStart);
  const previewCode = page.slice(previewStart, confirmStart);
  assert.doesNotMatch(previewCode, /createPackage|addPanelToPackage|registerSinglePanel/);
  assert.match(page, /activePackageIdRef\.current=id;setActivePackageId\(id\)/);
  assert.match(page, /registerPanelInActivePackage\(\{packageId:activePackageIdRef/);
  assert.doesNotMatch(page, /mode==="package"&&!activePackageId&&<Alert severity="warning"/);
  assert.match(page, /if\(requireOpenPackage&&mode!=="package"\)return\{error:/);
  assert.match(page, /if\(\/Risposta del server non ricevuta\|esito\.\*incerto\/i\.test\(outcome\.message\?\?""\)\)[\s\S]*?break;/);
});

test('conferma tre QR di un pacco nuovo crea una volta e aggiunge i successivi allo stesso ID', async () => {
  const packageId = { current: undefined };
  const calls = [];
  for (const panelId of ['panel-1', 'panel-2', 'panel-3']) {
    await registerPanelInActivePackage({
      packageId,
      loadId: 'load-1',
      operatorId: 'operator-1',
      panelId,
      create: async (loadId, operatorId, firstPanelId) => {
        calls.push(['create', loadId, operatorId, firstPanelId]);
        return { id: 'package-1' };
      },
      add: async (activeId, nextPanelId, operatorId) => {
        calls.push(['add', activeId, nextPanelId, operatorId]);
        return { id: activeId };
      },
    });
  }
  assert.deepEqual(calls, [
    ['create', 'load-1', 'operator-1', 'panel-1'],
    ['add', 'package-1', 'panel-2', 'operator-1'],
    ['add', 'package-1', 'panel-3', 'operator-1'],
  ]);
});

test('pacco esistente ripreso: tutti i QR vanno allo stesso pacco senza crearne un altro', async () => {
  const packageId = { current: 'package-existing' };
  const calls = [];
  for (const panelId of ['panel-2', 'panel-3']) {
    await registerPanelInActivePackage({
      packageId,
      loadId: 'load-1',
      operatorId: 'operator-1',
      panelId,
      create: async () => { calls.push(['create']); return { id: 'unexpected' }; },
      add: async (activeId, nextPanelId) => { calls.push(['add', activeId, nextPanelId]); return { id: activeId }; },
    });
  }
  assert.deepEqual(calls, [['add', 'package-existing', 'panel-2'], ['add', 'package-existing', 'panel-3']]);
});

test('badge IN PACCO è azzurro e DISPONIBILE verde in mobile e desktop', async () => {
  const page = await readFile(new URL('../src/pages/PanelScanning.tsx', import.meta.url), 'utf8');
  assert.match(page, /const color=situation==="DISPONIBILE"\?"success":situation==="IN PACCO"\?packageColor/);
  assert.match(page, /badgeColor=situation==="DISPONIBILE"\?"success":situation==="IN PACCO"\?"info"/);
  assert.match(page, /<Chip size="small" color=\{badgeColor\}[^>]*label=\{situation\}/);
  assert.match(page, /const color=situation==="DISPONIBILE"\?"success":situation==="IN PACCO"\?"info":situation==="CARICATO"\?"warning"/);
  assert.match(page, /situation:PanelSituation=panel\.caricato\?"CARICATO":matchingPackage\|\|inOpenPackage\?"IN PACCO"/);
  assert.match(page, /packageColor:closedPackage\?"success" as const:"info" as const/);
});
