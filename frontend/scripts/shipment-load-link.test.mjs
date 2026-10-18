import assert from 'node:assert/strict';
import test from 'node:test';
import { linkedShipmentForLoad, shipmentLoadLinkLabel } from '../src/services/shipmentLoadLink.ts';

const plan=(id,loadId,extra={})=>({id,loadId,persisted:true,commessa:'TEST',camion:'C1',transportType:'RITIRA_CLIENTE',...extra});
test('collegamento esplicito prevale su duplicati apparenti e ordine dei risultati',()=>{
 const linked=plan('linked','L1');
 const manual=plan('manual',null);
 for(const items of [[manual,linked],[linked,manual]]) assert.equal(linkedShipmentForLoad(items,'L1').plan,linked);
});
test('manuale non collegata e carico senza piano: nessun fallback normalizzato',()=>{
 const result=linkedShipmentForLoad([plan('manual',null),plan('other','L2')],'L1');
 assert.equal(result.plan,undefined);
 assert.match(result.problem,/Nessuna pianificazione collegata/);
 assert.equal(shipmentLoadLinkLabel(plan('manual',null)),'Manuale non collegata');
});
test('spedizioni multiple della stessa commessa restano distinte tramite loadId',()=>{
 const first=plan('P1','L1'); const second=plan('P2','L2',{transportType:'TERZI_PER_ESSEPI'});
 assert.equal(linkedShipmentForLoad([second,first],'L1').plan,first);
 assert.equal(linkedShipmentForLoad([first,second],'L2').plan,second);
 assert.equal(linkedShipmentForLoad([first,second],'L1').problem,null);
 assert.match(shipmentLoadLinkLabel(first),/Collegata al carico C1 · ID: L1/);
 assert.notEqual(shipmentLoadLinkLabel(first),shipmentLoadLinkLabel(second));
});
test('due piani realmente collegati allo stesso loadId: segnala ambiguità senza scegliere',()=>{
 const result=linkedShipmentForLoad([plan('P1','L1'),plan('P2','L1')],'L1');
 assert.equal(result.plan,undefined); assert.match(result.problem,/Più pianificazioni/);
});
test('righe virtuali non sono piani persistiti e la lettura non muta dati',()=>{
 const items=[plan('virtual','L1',{persisted:false}),plan('manual',null)];
 const snapshot=structuredClone(items);
 assert.equal(linkedShipmentForLoad(items,'L1').plan,undefined);
 assert.equal(linkedShipmentForLoad(items,null).plan,undefined);
 assert.deepEqual(items,snapshot);
});
