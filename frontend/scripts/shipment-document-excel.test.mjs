import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import {prepareShipmentDocument} from '../src/services/shipmentDocumentModel.ts';
import {shipmentExcelBytes} from '../src/services/shipmentDocumentExcel.ts';

test('Scheda spedizione: Excel riapribile con dati generali, distinta completa, date e totali',()=>{
 const operator={id:'OP',label:'DV — Operatore TEST'};
 const model=prepareShipmentDocument({
  schemaVersion:1,kind:'SHIPMENT_SHEET',shipmentId:'SESSION-TEST',loadId:'LOAD-TEST',order:'TEST-2604',customer:'Cliente TEST',truck:'TRUCK-TEST',
  shippedAt:'2026-10-18T08:30:00Z',firstPlannedDate:'2026-10-16T08:00:00Z',transportMode:'BILICO_ESSEPI',transportDetail:'Dettaglio TEST',
  carrier:{id:'C',label:'Vettore TEST'},trailer:{id:'T',label:'Rimorchio TEST',plate:'TEST-03'},operators:{start:operator,close:operator,departure:operator},
  totals:{expected:2,shipped:2,packages:1,weight:125.5,volume:.375,warehouseDays:3},
  elements:[
   {id:'E1',unitType:'Singolo',packageCode:null,number:'001',masterPanel:'MASTER-1',thickness:100,length:2000,width:1000,weight:50,volume:.2,scanOperator:operator,scannedAt:'2026-10-17T08:00:00Z',state:'SPEDITO'},
   {id:'E2',unitType:'Pacco',packageCode:'PACK-TEST',number:'002',masterPanel:'MASTER-2',thickness:80,length:2500,width:1200,weight:75.5,volume:.175,scanOperator:null,scannedAt:null,state:'SPEDITO'},
  ],warnings:['Nota storica TEST'],events:[],
 });
 const book=XLSX.read(shipmentExcelBytes(model),{type:'array',cellFormula:true});
 assert.deepEqual(book.SheetNames,['Riepilogo','Elementi spediti']);
 const summary=book.Sheets.Riepilogo,details=book.Sheets['Elementi spediti'];
 const rows=XLSX.utils.sheet_to_json(summary,{header:1,defval:null});
 const value=label=>rows.find(row=>row[0]===label)?.[1];
 for(const [label,expected] of [
  ['Identificativo spedizione','SESSION-TEST'],['Commessa','TEST-2604'],['Cliente','Cliente TEST'],['Camion','TRUCK-TEST'],
  ['Modalità trasporto','Bilico Essepi'],['Dettaglio trasporto','Dettaglio TEST'],['Trasportatore','Vettore TEST'],['Rimorchio','TEST-03 - Rimorchio TEST'],
  ['Operatore avvio',operator.label],['Operatore chiusura',operator.label],['Operatore partenza',operator.label],
  ['Elementi previsti',2],['Elementi spediti',2],['Pacchi spediti',1],['Peso totale (kg)',125.5],['Volume totale (m³)',.375],
  ['Permanenza in magazzino (gg)',3],['Documento operativo','Non costituisce un DDT ufficiale'],['Informazioni storiche','Nota storica TEST'],
 ])assert.equal(value(label),expected,label);
 const localSerial=(y,m,d,h=0,min=0)=>(Date.UTC(y,m-1,d,h,min)-Date.UTC(1899,11,30))/86400000;
 assert.equal(value('Data spedizione'),localSerial(2026,10,18,10,30));
 assert.equal(value('Prima data prevista certificata'),localSerial(2026,10,16,10));
 const elements=XLSX.utils.sheet_to_json(details,{header:1,defval:null});
 assert.equal(elements[0].length,14);
 assert.deepEqual(elements[1],['TEST-2604','TRUCK-TEST','Singolo',null,'001','MASTER-1',100,2000,1000,50,.2,operator.label,localSerial(2026,10,17,10),'SPEDITO']);
 assert.deepEqual(elements[2],['TEST-2604','TRUCK-TEST','Pacco','PACK-TEST','002','MASTER-2',80,2500,1200,75.5,.175,'—',null,'SPEDITO']);
 assert.equal(details['!autofilter'].ref,'A1:N3');
 assert.equal(summary.B18.f,"SUM('Elementi spediti'!J2:J3)");assert.equal(summary.B19.f,"SUM('Elementi spediti'!K2:K3)");
 assert.equal(details.J5.f,'SUM(J2:J3)');assert.equal(details.K5.f,'SUM(K2:K3)');
 assert.equal(details.J5.v,125.5);assert.equal(details.K5.v,.375);
});
