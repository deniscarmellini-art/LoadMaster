import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createServer} from 'vite';
import * as XLSX from 'xlsx';
import {unzipSync,strFromU8} from 'fflate';
import {filterShipmentList} from '../src/services/shipmentListFilters.ts';
import {shipmentListDetails} from '../src/services/shipmentListPresentation.ts';
import {shipmentHasDeparted} from '../src/services/shipmentDeparture.ts';
import {prepareDeliveryProgram,deliveryProgramDisclaimer} from '../src/services/deliveryProgramModel.ts';
import {deliveryProgramExcelBytes} from '../src/services/deliveryProgramExcel.ts';

const options={from:'2026-10-19',to:'2026-10-21',carrierName:'Vettore TEST',generatedAt:'2026-10-18T08:30:00Z'};
const base={id:'P',persisted:true,loadId:'L',commessa:'ORD-TEST',cliente:'Cliente TEST',orderReference:'RIF-001',camion:'C1',plannedDepartureDate:'2026-10-20',actualDepartureDate:null,operationalStatus:'DA_COMPLETARE',shipmentStatus:'PIANIFICATA',transportType:'TERZI_PER_ESSEPI',plannedCarrierId:'C',vehicleTypeId:'V',deliveryAddress:'Via di consegna 10\nEdificio B, 38100 Trento (TN)\nIngresso magazzino posteriore',notes:'Prima riga: telefonare prima della consegna.\nSeconda riga: accesso dal cancello laterale.\nUltima riga: fine istruzioni.'};
const detail=item=>shipmentListDetails(item,[{id:'C',nome:'Vettore TEST'},{id:'OTHER',nome:'Altro vettore'}],[],[],[],[{id:'V',nome:'Autotreno'}]);
const details=items=>new Map(items.map(item=>[item.id,detail(item)]));
const filters={search:'cliente test',type:'TERZI_PER_ESSEPI',carrierFilter:'C',from:options.from,to:options.to};
const modelFor=items=>prepareDeliveryProgram(items,details(items),options);

test('programma: stessi filtri Elenco per ricerca, modalità, trasportatore e date inclusive; lista ed export senza partenze',()=>{
 const items=[base,{...base,id:'END',plannedDepartureDate:'2026-10-21T10:00:00.000Z'},{...base,id:'START',plannedDepartureDate:'2026-10-19'},
  {...base,id:'OUT-LOW',plannedDepartureDate:'2026-10-18'},{...base,id:'OUT-HIGH',plannedDepartureDate:'2026-10-22'},
  {...base,id:'CARRIER',plannedCarrierId:'OTHER'},{...base,id:'MODE',transportType:'RITIRA_CLIENTE'},{...base,id:'STATUS',shipmentStatus:'PRONTA'},
  {...base,id:'SEARCH',cliente:'Altro cliente'},{...base,id:'DEPARTED',operationalStatus:'SPEDITO'},
  {...base,id:'ACTUAL',actualDepartureDate:'2026-10-18T07:00:00Z'},
  {...base,id:'INVALID',plannedDepartureDate:'2026-02-30'},{...base,id:'UNDATED',plannedDepartureDate:null}];
 const before=JSON.stringify(items),map=details(items),visible=filterShipmentList(items,map,filters),model=prepareDeliveryProgram(visible,map,options);
 assert.deepEqual(visible.map(item=>item.id),['P','END','START','STATUS']);
 assert.deepEqual(model.rows.map(row=>row.id),['START','P','STATUS','END']);
 assert.deepEqual(new Set(model.rows.map(row=>row.id)),new Set(visible.filter(item=>!shipmentHasDeparted(item)).map(item=>item.id)));
 assert.equal(JSON.stringify(items),before);assert.match(model.period,/19\/10\/2026.*21\/10\/2026/);
 assert.equal(model.options.carrierName,'Vettore TEST');assert.match(model.generatedLabel,/10:30/);
 assert.equal(model.rows[1].values[5],base.deliveryAddress);assert.equal(model.rows[1].values[8],base.notes);
});

test('Elenco: tutti gli stati non partiti visibili, SPEDITO/IN_VIAGGIO e partenze effettive esclusi senza limiti impliciti di data',()=>{
 const pending=[
  {...base,id:'UNPLANNED',shipmentStatus:'DA_PIANIFICARE',operationalStatus:null,plannedDepartureDate:null},
  {...base,id:'PLANNED',plannedDepartureDate:'2025-01-01'},
  {...base,id:'READY',shipmentStatus:'PRONTA',operationalStatus:'ATTESA_SPEDIZIONE'},
  {...base,id:'LOADING',operationalStatus:'IN_CARICO'},
 ];
 const departed=[{...base,id:'SHIPPED',operationalStatus:'SPEDITO'},
  {...base,id:'TRAVELLING',shipmentStatus:'IN_VIAGGIO'},
  {...base,id:'CLOSED',shipmentStatus:'CONCLUSA'},
  {...base,id:'ACTUAL',actualDepartureDate:'2026-10-18T08:00:00Z'}];
 const items=[...pending,...departed],map=details(items),before=JSON.stringify(items);
 const visible=filterShipmentList(items,map,{search:'',type:'',carrierFilter:'',from:'',to:''});
 assert.deepEqual(visible,pending);
 const model=prepareDeliveryProgram(visible,map,{...options,from:'',to:''});
 assert.deepEqual(new Set(model.rows.map(row=>row.id)),new Set(pending.map(row=>row.id)));
 assert.equal(JSON.stringify(items),before);
 assert.deepEqual(filterShipmentList(items,map,{search:'',type:'',carrierFilter:'',from:'2026-10-19',to:'2026-10-21'}).map(row=>row.id),['READY','LOADING']);
});

test('programma: nessun documento vuoto; tutti gli indicatori di partenza esclusi e date mancanti solo senza periodo',()=>{
 for(const input of [[],[{...base,operationalStatus:'SPEDITO'}],[{...base,shipmentStatus:'CONCLUSA'}],[{...base,shipmentStatus:'IN_VIAGGIO'}],[{...base,actualDepartureDate:'2026-10-18T08:00:00Z'}]])assert.throws(()=>modelFor(input),/Nessuna spedizione da esportare/);
 const noDate={...base,plannedDepartureDate:null};assert.throws(()=>modelFor([noDate]),/Nessuna spedizione/);
 const model=prepareDeliveryProgram([noDate],details([noDate]),{...options,from:'',to:'',carrierName:undefined});
 assert.equal(model.rows[0].date,null);assert.equal(model.rows[0].values[0],'—');assert.match(model.period,/Tutte le date/);
 assert.throws(()=>deliveryProgramExcelBytes({...model,rows:[]}),/Nessuna spedizione/);
});

test('Excel: stessi dati ordinati del PDF, date vere, indirizzi/note completi, a capo OOXML e nessuna formula da testo',()=>{
 const model=modelFor([{...base,id:'LATER',plannedDepartureDate:'2026-10-21',notes:'=1+1\nNon è una formula'},base]);
 const bytes=deliveryProgramExcelBytes(model),book=XLSX.read(bytes,{type:'array',cellDates:true,cellStyles:true}),sheet=book.Sheets['Programma consegne'];
 const calendarDay=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 assert.equal(sheet.A8.t,'d');assert.equal(calendarDay(sheet.A8.v),'2026-10-20');
 assert.equal(sheet.A9.t,'d');assert.equal(calendarDay(sheet.A9.v),'2026-10-21');
 const numeric=XLSX.read(bytes,{type:'array'}).Sheets['Programma consegne'];
 assert.equal(numeric.A8.v,(Date.UTC(2026,9,20)-Date.UTC(1899,11,30))/86400000);
 for(let index=0;index<model.rows.length;index++){
  for(let col=1;col<9;col++)assert.equal(sheet[XLSX.utils.encode_cell({r:index+7,c:col})].v,model.rows[index].values[col]);
 }
 assert.equal(sheet.B2.v,options.carrierName);assert.equal(sheet.A5.v,deliveryProgramDisclaimer);
 assert.equal(sheet.I9.t,'s');assert.equal(sheet.I9.f,undefined);assert.equal(sheet['!autofilter'].ref,'A7:I9');
 const files=unzipSync(bytes),styles=strFromU8(files['xl/styles.xml']),xml=strFromU8(files['xl/worksheets/sheet1.xml']);
 assert.match(styles,/<alignment vertical="top" wrapText="1"\/>/);
 const formats=styles.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/),count=Number(formats[1]);
 for(const cell of xml.matchAll(/<c\b[^>]*\bs="(\d+)"/g))assert(Number(cell[1])>=count/2&&Number(cell[1])<count);
 assert.match(xml,/<col[^>]*width="/);assert.match(xml,/customHeight="1"/);
 assert.throws(()=>deliveryProgramExcelBytes(modelFor([{...base,notes:'x'.repeat(32768)}])),/limite Excel/);
 if(process.env.DELIVERY_QA_DIR){mkdirSync(process.env.DELIVERY_QA_DIR,{recursive:true});writeFileSync(join(process.env.DELIVERY_QA_DIR,'programma-consegne.xlsx'),bytes);}
});

test('PDF: una pagina, multipagina con righe lunghe e continuazione di una nota oltre una pagina, senza scritture API',async()=>{
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});
 try{
  const {createDeliveryProgramPdf}=await server.ssrLoadModule('/src/services/deliveryProgramPdf.ts');
  const assets={logo:new Uint8Array(readFileSync(new URL('../../backend/assets/ddt/essepi-v3.png',import.meta.url))),regular:readFileSync(new URL('../../backend/assets/ddt/DejaVuSans.ttf',import.meta.url)).toString('base64'),bold:readFileSync(new URL('../../backend/assets/ddt/DejaVuSans-Bold.ttf',import.meta.url)).toString('base64')};
  const shortModel=modelFor([base,{...base,id:'MISSING',commessa:'ORD-SENZA-INDIRIZZO',deliveryAddress:' ',orderReference:'REF-2026-0000000123456',notes:'Consegna da concordare'}]);
  const before=JSON.stringify(shortModel),single=createDeliveryProgramPdf(shortModel,assets);assert.equal(single.getNumberOfPages(),1);assert.equal(JSON.stringify(shortModel),before);
  const rows=Array.from({length:35},(_,index)=>({...base,id:`P${index}`,commessa:`ORD-${String(index).padStart(3,'0')}`,notes:`INIZIO-${index}\n${base.notes}\nFINE-${index}`}));
  rows.push({...base,id:'LONG',commessa:'ORD-LUNGA',orderReference:'RIFERIMENTO-ORDINE-MOLTO-LUNGO-2026-0123456789-ABCDEFGHIJKLMN',notes:Array.from({length:180},(_,i)=>`ISTRUZIONE-${String(i).padStart(3,'0')}: consegna su appuntamento.`).join('\n')+'\nFINE-NOTA-LUNGA'});
  const many=createDeliveryProgramPdf(modelFor(rows),assets);assert(many.getNumberOfPages()>2);
  assert.throws(()=>createDeliveryProgramPdf({...modelFor([base]),rows:[]},assets),/Nessuna spedizione/);
  if(process.env.DELIVERY_QA_DIR){mkdirSync(process.env.DELIVERY_QA_DIR,{recursive:true});writeFileSync(join(process.env.DELIVERY_QA_DIR,'programma-una-pagina.pdf'),new Uint8Array(single.output('arraybuffer')));writeFileSync(join(process.env.DELIVERY_QA_DIR,'programma-multipagina.pdf'),new Uint8Array(many.output('arraybuffer')));}
 }finally{await server.close();}
});
