import assert from 'node:assert/strict';
import test from 'node:test';
import {findRemovedOperationalPanels} from '../src/utils/importManifest.ts';

test('distinta operativa senza C1: zero rimossi tra i 45 elementi spediti',()=>{
 const shipped=Array.from({length:45},(_,i)=>({numeroPannello:String(i+1),numeroCamion:'C1',loadStatus:'SPEDITO',caricato:true,spedito:true}));
 const active=[{numeroPannello:'205',numeroCamion:'C3',loadStatus:'DA_COMPLETARE'},{numeroPannello:'212',numeroCamion:'C2',loadStatus:'ATTESA_SPEDIZIONE'}];
 assert.deepEqual(findRemovedOperationalPanels([...shipped,...active],active),[]);
 assert.deepEqual(findRemovedOperationalPanels([{numeroPannello:'S',loadStatus:'SPEDITO',spedito:false}],[]),[]);
 assert.deepEqual(findRemovedOperationalPanels([{numeroPannello:'S',spedito:true}],[]),[]);
});

test('spostamenti esclusi dai rimossi; rimozioni operative reali restano visibili',()=>{
 const existing=[{numeroPannello:'205',numeroCamion:'C2',loadStatus:'DA_CARICARE'},{numeroPannello:'R',loadStatus:'IN_CARICO',caricato:true}];
 assert.deepEqual(findRemovedOperationalPanels(existing,[{numeroPannello:' 205 ',numeroCamion:'C3'}]),[existing[1]]);
});
