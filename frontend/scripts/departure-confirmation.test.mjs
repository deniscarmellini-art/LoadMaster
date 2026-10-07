import assert from 'node:assert/strict';
import test from 'node:test';
import {confirmDeparture,departureTransport,departureTrailerId} from '../src/services/departureConfirmation.ts';

test('partenza: effettivo prima del pianificato, regole per le tre modalità',()=>{
 const planned={transportType:'BILICO_ESSEPI',plannedCarrierId:'Cristelli',transportDetailLabel:'Pianificato'};
 assert.deepEqual(departureTransport({transportMode:'RITIRA_CLIENTE',transportDetailLabel:'Autotreno'},planned),{mode:'RITIRA_CLIENTE',requiresCarrier:false,carrierId:'',detailLabel:'Autotreno'});
 assert.equal(departureTransport({transportMode:'RITIRA_CLIENTE'},planned).requiresCarrier,false);
 const third=departureTransport({transportMode:'TERZI_PER_ESSEPI',transportDetailLabel:'Angeli Motrice'},planned);assert.equal(third.requiresCarrier,false);assert.equal(third.detailLabel,'Angeli Motrice');
 assert.equal(departureTransport({transportMode:'BILICO_ESSEPI',trasportatoreId:'Effettivo'},planned).carrierId,'Effettivo');
 assert.equal(departureTransport({transportMode:'BILICO_ESSEPI'},planned).carrierId,'Cristelli');
 const load={backendLoadId:'L',commessa:'265694',camion:'C2-',rimorchioId:'stale'};
 assert.equal(departureTrailerId(load,[{id:'assigned',status:'CARICATO',loadId:'L'}]),'assigned');
 assert.equal(departureTrailerId(load,[{id:'manual',status:'IMPEGNATO',loadId:null,commessa:'265694',camion:'C2'}]),'manual');
 assert.equal(departureTrailerId(load,[]),undefined);
});

test('dialog: attende API e refresh, chiude dopo successo; errore mantiene aperto',async()=>{
 const events=[];let release;const pending=new Promise(resolve=>{release=resolve;});
 const confirmation=confirmDeparture(async()=>{events.push('API');await pending;events.push('refresh');},()=>events.push('close'),message=>events.push(message));
 assert.deepEqual(events,['API']);release();await confirmation;assert.deepEqual(events,['API','refresh','close']);
 events.length=0;await confirmDeparture(async()=>{throw new Error('Carico incompleto');},()=>events.push('close'),message=>events.push(message));assert.deepEqual(events,['Carico incompleto']);
 events.length=0;await confirmDeparture(async()=>{events.push('persisted');throw new Error('Refresh non riuscito');},()=>events.push('close'),message=>events.push(message));assert.deepEqual(events,['persisted','Refresh non riuscito']);
});
