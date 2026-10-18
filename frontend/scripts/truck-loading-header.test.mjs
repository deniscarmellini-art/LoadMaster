import assert from 'node:assert/strict';
import test from 'node:test';
import { truckLoadingHeaderRows } from '../src/services/truckLoadingHeader.ts';

const selected={id:'L4',cliente:'Cliente selezionato',commessa:'SL-2604',camion:'DELTA-04'};
const order=(ordine,cliente,riferimento,loadId)=>({ordine,cliente,riferimento,pannelli:[{loadId,numeroCamion:'DELTA-04'}]});

test('intestazione: dati importati, riferimento ordine e carico selezionato',()=>{
  assert.deepEqual(truckLoadingHeaderRows(selected,[order('SL-2604','Linea Forma Srl','ORD-DEMO-2603','L4')]),[
    {customer:'Linea Forma Srl',orderReference:'ORD-DEMO-2603',order:'SL-2604',truck:'DELTA-04'},
  ]);
});

test('intestazione: valori assenti vuoti o spazi mostrano il trattino',()=>{
  assert.deepEqual(truckLoadingHeaderRows({...selected,cliente:' ',commessa:'',camion:''},[]),[
    {customer:'—',orderReference:'—',order:'—',truck:'—'},
  ]);
  assert.equal(truckLoadingHeaderRows(selected,[order('SL-2604','',' ', 'L4')])[0].orderReference,'—');
  assert.equal(truckLoadingHeaderRows(selected,[order('SL-2604','',' ', 'L4')])[0].customer,'—');
});

test('intestazione: più commesse collegate mantengono le associazioni senza duplicati',()=>{
  const a=order('SL-2604','Cliente A','Ordine A','L4'),b=order('SL-2605','Cliente B','Ordine B','L4');
  const source=[a,b,a];const before=JSON.stringify(source);
  assert.deepEqual(truckLoadingHeaderRows(selected,source),[
    {customer:'Cliente A',orderReference:'Ordine A',order:'SL-2604',truck:'DELTA-04'},
    {customer:'Cliente B',orderReference:'Ordine B',order:'SL-2605',truck:'DELTA-04'},
  ]);
  assert.equal(JSON.stringify(source),before);
});

test('intestazione: stesso camion su altri carichi non aggrega commesse estranee',()=>{
  const own=order('SL-2604','Cliente A','Ordine A','L4'),other=order('SL-2605','Cliente B','Ordine B','L5');
  assert.equal(truckLoadingHeaderRows(selected,[own,other]).length,1);
  const legacy=order('SL-2604','Cliente A','Ordine A',undefined);
  assert.equal(truckLoadingHeaderRows(selected,[legacy,other])[0].orderReference,'Ordine A');
  assert.equal(truckLoadingHeaderRows(selected,[other])[0].orderReference,'—');
});
