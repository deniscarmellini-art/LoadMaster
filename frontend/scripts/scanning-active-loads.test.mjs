import assert from 'node:assert/strict';
import test from 'node:test';
import {scanningActiveLoads} from '../src/services/scanningActiveLoads.ts';

const row={id:'L',commessa:'ORD',camion:'C1',stato:'Da completare',previsti:2,pronti:0,mancanti:2};
const scanned={loadId:'L',numeroCamion:'C1',scannedAt:'2026-10-18T08:00:00Z',preparato:true,caricato:false};
const orders=panels=>[{ordine:'ORD',pannelli:panels}];

test('scansione: visibili elementi da scansionare anche con materiale disponibile e Mancanti zero',()=>{
 const pending={...scanned,scannedAt:undefined};
 const available={...row,stato:'Da caricare',pronti:2,mancanti:0};
 assert.deepEqual(scanningActiveLoads([available],orders([scanned,pending]),[]),[available]);
 assert.deepEqual(scanningActiveLoads([row],orders([scanned,{...pending,preparato:false}]),[]),[row]);
});

test('scansione completata: singoli e pacchi chiusi esclusi senza modificare input o contatori',()=>{
 const data=orders([scanned,{...scanned,packageId:'PACK'}]),packs=[{id:'PACK',stato:'DISPONIBILE'}];
 const before=JSON.stringify({row,data,packs});
 assert.deepEqual(scanningActiveLoads([row],data,packs),[]);
 assert.equal(JSON.stringify({row,data,packs}),before);
});

for(const stato of ['Attesa spedizione','Partita'])test(`scansione: ${stato} esclusa anche con scansioni mancanti`,()=>{
 assert.deepEqual(scanningActiveLoads([{...row,stato}],orders([{...scanned,scannedAt:undefined}]),[]),[]);
});

test('scansione: conservare chiusura singolo incompleta e pacchi aperti o sospesi',()=>{
 assert.deepEqual(scanningActiveLoads([row],orders([scanned,{...scanned,preparato:false}]),[]),[row]);
 for(const packs of [[],[{id:'PACK',stato:'APERTO',workflowState:'SOSPESO'}]]){
  assert.deepEqual(scanningActiveLoads([row],orders([scanned,{...scanned,packageId:'PACK'}]),packs),[row]);
 }
});

test('scansione: elementi di un altro carico non certificano il completamento e i dati parziali restano visibili',()=>{
 const data=orders([scanned,{...scanned,loadId:'OTHER',scannedAt:undefined}]);
 assert.deepEqual(scanningActiveLoads([row],data,[]),[row]);
 assert.deepEqual(scanningActiveLoads([{...row,previsti:1}],data,[]),[]);
 assert.deepEqual(scanningActiveLoads([row],[],[]),[row]);
 assert.deepEqual(scanningActiveLoads([{...row,previsti:0}],[],[]),[]);
});
