import assert from 'node:assert/strict';
import test from 'node:test';
import {shipmentCalendarTransportDetails} from '../src/services/shipmentCalendarPresentation.ts';

const base={id:'P',loadId:'L',commessa:'TEST',camion:'C1',transportType:'TERZI_PER_ESSEPI',plannedCarrierId:'C',vehicleTypeId:'V',carrierId:null,trailerId:null};
const carriers=[{id:'C',nome:'Cristelli'},{id:'A',nome:'Angeli'}];
const types=[{id:'V',nome:'Autotreno'},{id:'F',nome:'Ferro'}];
const assignment={id:'T',plate:'AB123CD',assignmentId:'ASSIGN',loadId:'L',status:'CARICATO',source:'LOAD'};
const details=(item=base,transports=[],loads=[])=>shipmentCalendarTransportDetails(item,carriers,types,[],transports,loads);

test('Terzi: trasportatore e mezzo dalla pianificazione; dettaglio storico non duplica né prevale',()=>{
 assert.equal(details({...base,transportDetailLabel:'Vecchio valore'}),'Cristelli · Autotreno');
 assert.equal(details(base,[],[{backendLoadId:'L',transportMode:'TERZI_PER_ESSEPI',trasportatoreId:'A'}]),'Cristelli · Autotreno');
});
test('Terzi: uno o nessun dato, ID sconosciuti e nessun segnaposto',()=>{
 assert.equal(details({...base,vehicleTypeId:null}),'Cristelli');
 assert.equal(details({...base,plannedCarrierId:null}),'Autotreno');
 assert.equal(details({...base,plannedCarrierId:null,vehicleTypeId:null}),'');
 assert.equal(details({...base,plannedCarrierId:'unknown',vehicleTypeId:'unknown'}),'');
 assert.equal(shipmentCalendarTransportDetails(base,[{id:'C',nome:' — '}],[{id:'V',nome:' '}],[],[]),'');
});
test('Terzi: salvataggio e modifica delle selezioni aggiornano il testo senza mutare il piano',()=>{
 const before={...base};assert.equal(details(),'Cristelli · Autotreno');
 assert.equal(details({...base,plannedCarrierId:'A',vehicleTypeId:'F'}),'Angeli · Ferro');
 assert.deepEqual(base,before);
});
test('Bilico: trasportatore effettivo e targa della stessa assegnazione',()=>{
 const item={...base,transportType:'BILICO_ESSEPI',vehicleTypeId:null};
 assert.equal(details(item,[assignment],[{backendLoadId:'L',transportMode:'BILICO_ESSEPI',trasportatoreId:'A'}]),'Angeli · AB123CD');
 assert.equal(details(item,[assignment]),'Cristelli · AB123CD');
 assert.equal(details({...item,plannedCarrierId:null},[assignment]),'AB123CD');
});
test('Bilico: targa rilasciata o riassegnata non viene recuperata dalla cache',()=>{
 const item={...base,transportType:'BILICO_ESSEPI',trailerId:'T'};
 assert.equal(details(item,[{...assignment,loadId:'OTHER'}]),'Cristelli');
 assert.equal(details(item,[{...assignment,assignmentId:null,status:'DISPONIBILE'}]),'Cristelli');
 assert.equal(details({...item,plannedCarrierId:null}), '');
});
test('Ritira Cliente e modalità non definita: nessun arricchimento della scheda esistente',()=>{
 assert.equal(details({...base,transportType:'RITIRA_CLIENTE'}),'');
 assert.equal(details({...base,transportType:null}),'');
});
