import assert from 'node:assert/strict';
import test from 'node:test';
import { shipmentLinkSuggestions } from '../src/services/shipmentLinkSuggestions.ts';
const plan={id:'P',persisted:true,loadId:null,commessa:'TEST',camion:null};
const load=(id,extra={})=>({id:`load:${id}`,loadId:id,persisted:false,commessa:'TEST',camion:'C1',...extra});
test('suggerimenti unici o multipli non selezionano o mutano collegamenti',()=>{
 const items=[plan,load('L1'),load('L2',{camion:'C2'}),load('L1')];const snapshot=structuredClone(items);
 assert.deepEqual(shipmentLinkSuggestions(plan,items).map(p=>p.loadId),['L1','L2']);
 assert.deepEqual(items,snapshot);
 assert.equal(shipmentLinkSuggestions({...plan,camion:'C9'},items).length,2);
});
test('esclude occupati, spediti, altre commesse e pianificazioni già collegate',()=>{
 const items=[load('occupied'),{...plan,id:'other',loadId:'occupied'},load('shipped',{operationalStatus:'SPEDITO'}),load('departed',{actualDepartureDate:'2026-10-17'}),load('other',{commessa:'OTHER'}),load('available')];
 assert.deepEqual(shipmentLinkSuggestions(plan,items).map(p=>p.loadId),['available']);
 assert.deepEqual(shipmentLinkSuggestions({...plan,loadId:'confirmed'},items),[]);
 assert.deepEqual(shipmentLinkSuggestions({...plan,actualDepartureDate:'2026-10-17'},items),[]);
});
