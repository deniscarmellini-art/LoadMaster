import assert from 'node:assert/strict';import test from 'node:test';
import {shipmentListDetails} from '../src/services/shipmentListPresentation.ts';
const base={id:'plan',loadId:'L',commessa:'A',cliente:'Cliente reale',camion:'C1',transportType:'BILICO_ESSEPI',trailerId:null,carrierId:null,plannedCarrierId:'planned',transportDetailId:null,deliveryAddress:null,notes:null};
const carriers=[{id:'planned',nome:'Trasportatore previsto'},{id:'actual',nome:'Trasportatore effettivo'}];const trailers=[{id:'trailer',targa:'AA 123 BB'}];
const assignment={id:'trailer',plate:'AA 123 BB',assignmentId:'assignment',status:'IMPEGNATO',source:'LOAD',loadId:'L',commessa:'A',camion:'C1'};
const details=(item=base,transports=[],loads=[])=>shipmentListDetails(item,carriers,trailers,transports,loads);
test('Bilico: nominativo previsto identificato e targa solo da dati disponibili',()=>{assert.equal(details().party,'Trasportatore previsto');assert.equal(details().plate,'—');assert.equal(details(base,[assignment]).plate,'AA 123 BB');assert.equal(details({...base,trailerId:'trailer'}).plate,'AA 123 BB');});
test('carico effettivo prevale sulla pianificazione, anche per la modalità',()=>{const loads=[{backendLoadId:'L',transportMode:'BILICO_ESSEPI',trasportatoreId:'actual'}];assert.equal(details(base,[assignment],loads).party,'Trasportatore effettivo');const customer=details(base,[assignment],[{backendLoadId:'L',transportMode:'RITIRA_CLIENTE'}]);assert.equal(customer.mode,'RITIRA_CLIENTE');assert.equal(customer.party,'Cliente reale');assert.equal(customer.plate,'—');});
test('Ritira Cliente: nome cliente distinto da mezzo e nessuna targa bilico impropria',()=>{const result=details({...base,transportType:'RITIRA_CLIENTE',transportDetailLabel:'Autotreno',trailerId:'trailer'});assert.equal(result.party,'Cliente reale');assert.equal(result.plate,'—');});
test('Terzi: mostra esattamente la modalità selezionata, separata dal carrierId',()=>{assert.equal(details({...base,transportType:'TERZI_PER_ESSEPI',plannedCarrierId:null,transportDetailLabel:'Cristelli Bilichetto'}).party,'Cristelli Bilichetto');assert.equal(details({...base,transportType:'TERZI_PER_ESSEPI',plannedCarrierId:null,carrierId:'actual',transportDetailLabel:'Cristelli Bilichetto'}).party,'Cristelli Bilichetto');assert.equal(details({...base,transportType:'TERZI_PER_ESSEPI',plannedCarrierId:null,transportDetailLabel:null}).party,'—');});
test('associazione manuale normalizzata e ambiguità senza targa inventata',()=>{const manual={...assignment,loadId:null,source:'MANUAL',commessa:'a',camion:'C1-'};assert.equal(details({...base,loadId:null},[manual]).plate,'AA 123 BB');assert.equal(details(base,[assignment,{...assignment,id:'other',plate:'CC 456 DD'}]).plate,'—');assert.equal(details({...base,loadId:null,camion:null},[manual]).plate,'—');});
test('mezzo riassegnato a un altro carico e nominativo sconosciuto: segnaposto',()=>{assert.equal(details({...base,trailerId:'trailer'},[{...assignment,loadId:'OTHER'}]).plate,'—');assert.equal(details({...base,carrierId:'unknown'}).party,'—');assert.equal(details({...base,transportType:null}).party,'—');});
test('indirizzo e note preservano le righe; vuoti, undefined e whitespace diventano trattino',()=>{const item={...base,deliveryAddress:' Via Roma 1\nCantiere A ',notes:'Telefonare\nPrima del ritiro'};const result=details(item);assert.equal(result.address,'Via Roma 1\nCantiere A');assert.equal(result.notes,item.notes);assert.equal(details({...base,deliveryAddress:' ',notes:undefined}).address,'—');assert.equal(details().notes,'—');assert.equal(item.deliveryAddress,' Via Roma 1\nCantiere A ');});

test("assegnazione rilasciata o manuale su altra commessa non viene mostrata come attuale",()=>{assert.equal(details({...base,trailerId:'trailer'},[{...assignment,assignmentId:null,status:'DISPONIBILE',loadId:null}]).plate,'—');assert.equal(details({...base,trailerId:'trailer'},[{...assignment,source:'MANUAL',loadId:null,commessa:'OTHER'}]).plate,'—');assert.equal(details(base,[],[{backendLoadId:'L',trasportatoreId:'actual'}]).party,'Trasportatore effettivo');});

test('Terzi: aggiornamento e cancellazione del piano prevalgono sul dettaglio precedente della sessione',()=>{const plan={...base,commessa:'265410',cliente:'RD Chalet',transportType:'TERZI_PER_ESSEPI',plannedCarrierId:null,transportDetailLabel:'Cristelli Bilichetto'};const loads=[{backendLoadId:'L',transportMode:'TERZI_PER_ESSEPI',transportDetailLabel:'Valore precedente'}];assert.equal(details(plan,[],loads).party,'Cristelli Bilichetto');assert.equal(details({...plan,transportDetailLabel:'Nuova modalità selezionata'},[],loads).party,'Nuova modalità selezionata');assert.equal(details({...plan,transportDetailLabel:null},[],loads).party,'—');assert.equal(details({...plan,transportDetailLabel:'  '},[],loads).party,'—');});
test('Ritira Cliente: soggetto esplicitamente registrato prevale, senza usare il tipo mezzo come nominativo',()=>{const plan={...base,transportType:'RITIRA_CLIENTE',transportDetailLabel:'Autotreno'};assert.equal(details({...plan,carrierId:'actual'}).party,'Trasportatore effettivo');assert.equal(details(plan,[],[{backendLoadId:'L',transportMode:'RITIRA_CLIENTE',trasportatoreId:'actual'}]).party,'Trasportatore effettivo');assert.equal(details({...plan,cliente:''}).party,'—');});
test('Terzi effettivo diverso dalla modalità pianificata: usa il dettaglio della sessione compatibile',()=>{assert.equal(details(base,[],[{backendLoadId:'L',transportMode:'TERZI_PER_ESSEPI',transportDetailLabel:'Cristelli Bilichetto'}]).party,'Cristelli Bilichetto');assert.equal(details(base,[],[{backendLoadId:'L',transportMode:'TERZI_PER_ESSEPI'}]).party,'—');});


test('Identità condivisa: stesso trasportatore per Bilico e Terzi, indipendente da tipo mezzo e valore storico',()=>{
 const bilico=details(base);
 const terzi=details({...base,transportType:'TERZI_PER_ESSEPI',vehicleTypeId:'any-type',transportDetailLabel:'Vecchio valore combinato'});
 assert.equal(terzi.carrierId,bilico.carrierId);assert.equal(terzi.party,bilico.party);
 assert.equal(details({...base,transportType:'TERZI_PER_ESSEPI',plannedCarrierId:'actual',vehicleTypeId:'other'}).party,'Trasportatore effettivo');
});

test('Tipo mezzo Terzi: selezione indipendente e anagrafica condivisa, anche disattivata; nessuna inferenza dai valori combinati',()=>{
 const types=[{id:'VT',nome:'Autotreno',attivo:false}];
 const plan={...base,transportType:'TERZI_PER_ESSEPI',vehicleTypeId:'VT',transportDetailLabel:'Cristelli Vecchio mezzo'};
 assert.equal(shipmentListDetails(plan,carriers,trailers,[],[],types).vehicleType,'Autotreno');
 assert.equal(shipmentListDetails({...plan,vehicleTypeId:null},carriers,trailers,[],[],types).vehicleType,'—');
 assert.equal(shipmentListDetails({...plan,vehicleTypeId:'unknown'},carriers,trailers,[],[],types).vehicleType,'—');
});
test('Tipo mezzo Ritira Cliente: anagrafica, snapshot storico e dati effettivi compatibili',()=>{
 const plan={...base,transportType:'RITIRA_CLIENTE',transportDetailId:'VT',transportDetailLabel:'Vecchio nome'};
 const types=[{id:'VT',nome:'Motrice',attivo:false}];
 assert.equal(shipmentListDetails(plan,carriers,trailers,[],[],types).vehicleType,'Motrice');
 assert.equal(shipmentListDetails(plan,carriers,trailers,[],[],[]).vehicleType,'Vecchio nome');
 assert.equal(shipmentListDetails({...plan,transportDetailId:null,transportDetailLabel:null},carriers,trailers,[],[],types).vehicleType,'—');
 assert.equal(shipmentListDetails(plan,carriers,trailers,[],[{backendLoadId:'L',transportMode:'RITIRA_CLIENTE',transportDetailLabel:'Pianale effettivo'}],types).vehicleType,'Pianale effettivo');
});
test('Tipo mezzo Bilico: sempre trattino; modifica del piano aggiorna il dato Terzi',()=>{
 const types=[{id:'VT',nome:'Motrice'},{id:'NEW',nome:'Autotreno'}];
 assert.equal(shipmentListDetails({...base,vehicleTypeId:'VT'},carriers,trailers,[],[],types).vehicleType,'—');
 const plan={...base,transportType:'TERZI_PER_ESSEPI',vehicleTypeId:'VT'};
 assert.equal(shipmentListDetails(plan,carriers,trailers,[],[],types).vehicleType,'Motrice');
 assert.equal(shipmentListDetails({...plan,vehicleTypeId:'NEW'},carriers,trailers,[],[],types).vehicleType,'Autotreno');
});

test('Tipo mezzo: sessione senza dettaglio riusa il piano compatibile, mai il dettaglio di un altra modalità',()=>{
 const types=[{id:'VT',nome:'Motrice'}];
 const loads=[{backendLoadId:'L',transportMode:'RITIRA_CLIENTE'}];
 assert.equal(shipmentListDetails({...base,transportType:'RITIRA_CLIENTE',transportDetailId:'VT'},carriers,trailers,[],loads,types).vehicleType,'Motrice');
 assert.equal(shipmentListDetails({...base,transportDetailLabel:'Cristelli'},carriers,trailers,[],loads,types).vehicleType,'—');
});
