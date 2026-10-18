import assert from 'node:assert/strict';
import test from 'node:test';
import {createShipment,updateShipment} from '../src/services/shipmentsApi.ts';
import {normalizeShipmentPlanningInput} from '../src/services/shipmentPlanningInput.ts';

test('Ritira Cliente: apertura e salvataggio eliminano dal payload il vettore aziendale residuo, senza mutare il record storico',async()=>{
 const legacy={commessa:'TEST',cliente:'Cliente TEST',transportType:'RITIRA_CLIENTE',plannedCarrierId:'OLD',carrierId:'OLD-ACTUAL',vehicleTypeId:'OLD-TYPE',transportDetailId:'CLIENT-VEHICLE',notes:'Conservare',trailerId:null};
 const before=JSON.stringify(legacy),normalized=normalizeShipmentPlanningInput(legacy);
 assert.equal(normalized.plannedCarrierId,null);assert.equal(normalized.carrierId,null);assert.equal(normalized.vehicleTypeId,null);
 assert.equal(normalized.transportDetailId,'CLIENT-VEHICLE');assert.equal(normalized.notes,'Conservare');assert.equal(JSON.stringify(legacy),before);
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,payload:JSON.parse(options.body)});return new Response('{}',{headers:{'content-type':'application/json'}});};
 try{
  await updateShipment('PLAN',legacy);await createShipment(legacy);
  for(const call of calls)assert.deepEqual(call.payload,normalized);
  const date={plannedDepartureDate:'2026-10-20',expectedUpdatedAt:'2026-10-18T08:00:00Z'};
  await updateShipment('PLAN',date);assert.deepEqual(calls[2].payload,date);
 }finally{globalThis.fetch=original;}
});

test('cambio modalità: Ritira Cliente non conserva vettori Terzi/Bilico, altre modalità preservano dati e controlli',()=>{
 for(const transportType of ['BILICO_ESSEPI','TERZI_PER_ESSEPI']){
  const input={commessa:'TEST',cliente:'Cliente TEST',transportType,plannedCarrierId:'C',transportDetailId:'DETAIL',vehicleTypeId:'V'};
  assert.equal(normalizeShipmentPlanningInput(input),input);
  assert.equal(normalizeShipmentPlanningInput({...input,transportType:'RITIRA_CLIENTE'}).plannedCarrierId,null);
 }
});
