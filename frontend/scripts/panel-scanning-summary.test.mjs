import assert from 'node:assert/strict';
import test from 'node:test';
import { panelScanningSummaryFields } from '../src/services/panelScanningSummary.ts';

test('riepilogo scansione: ordine richiesto e riferimento reale della commessa',()=>{
  const data={target:{cliente:'Linea Forma Srl',commessa:'SL-2604',camion:'DELTA-04'},commessa:{riferimento:'ORD-DEMO-2603'},expected:12,available:9,missing:3,packages:2};
  const before=JSON.stringify(data);
  assert.deepEqual(panelScanningSummaryFields(data),[
    ['Cliente','Linea Forma Srl'],['Riferimento ordine','ORD-DEMO-2603'],['Commessa','SL-2604'],['Camion','DELTA-04'],
    ['Previsti',12],['Disponibili',9],['Mancanti',3],['Pacchi creati',2],
  ]);
  assert.equal(JSON.stringify(data),before);
});

test('riepilogo scansione: informazioni assenti e conteggi zero conservati',()=>{
  const fields=panelScanningSummaryFields({target:{cliente:'',commessa:' ',camion:undefined},commessa:{riferimento:undefined},expected:0,available:0,missing:0,packages:0});
  assert.deepEqual(fields.map(([,value])=>value),['—','—','—','—',0,0,0,0]);
});

test('riepilogo scansione: cambiando commessa cambia il riferimento, senza sostituzioni',()=>{
  const data={target:{cliente:'Cliente A',commessa:'A',camion:'C1'},commessa:{riferimento:'Ordine A'},expected:4,available:2,missing:2,packages:1};
  assert.equal(panelScanningSummaryFields(data)[1][1],'Ordine A');
  assert.equal(panelScanningSummaryFields({...data,commessa:{riferimento:'Ordine B'}})[1][1],'Ordine B');
  assert.equal(panelScanningSummaryFields({...data,commessa:{riferimento:''}})[1][1],'—');
});
