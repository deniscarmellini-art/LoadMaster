import assert from "node:assert/strict";
import test from "node:test";
import { openSqliteDatabase } from "./database/sqliteDatabase.js";
import { LoadRepository } from "./repositories/loadRepository.js";
import { LoadService } from "./services/loadService.js";
import { ScanningRepository } from "./repositories/scanningRepository.js";
import { ScanningService } from "./services/scanningService.js";
import { LoadingRepository } from "./repositories/loadingRepository.js";
import { LoadingService } from "./services/loadingService.js";
import { TransportRepository } from "./repositories/transportRepository.js";
import { shipmentDocument } from "./repositories/shipmentDocumentRepository.js";

test("Scheda spedizione: lettura, singoli, pacchi, snapshot e riferimenti storici",()=>{
 for(const transportMode of ["RITIRA_CLIENTE","TERZI_PER_ESSEPI","BILICO_ESSEPI"] as const){
 for(const variant of ["single","package","mixed"]){
 const conn=openSqliteDatabase(":memory:"),db=conn.database;
 try{
  const repo=new LoadRepository(db),load=new LoadService(repo).import({commessa:"DOC-TEST",cliente:"Cliente storico",numeroCliente:"NC",riferimentoOrdine:"R",pannelli:Array.from({length:3},(_,i)=>({numeroPannello:String(i+1),numeroCliente:"NC",numeroMasterPanel:`MP${i+1}`,camion:"C1",lato1:"A",lato2:"B",tipoPannello:"X",quantita:1,spessore:100,lunghezza:2000,altezza:1000,superficie:2,volume:.200123,peso:12.3456}))})[0]!;
  const op=String(db.prepare("SELECT id FROM Operators LIMIT 1").get()!.id),scan=new ScanningService(new ScanningRepository(db));
  const panels=repo.panels(load.id);let pack:string|null=null;
  if(variant!=="single"){const stamp=new Date().toISOString();pack="test-pack";db.prepare("INSERT INTO Packages(id,codicePacco,loadId,commessa,cliente,camion,stato,numeroPannelli,pesoTotale,volumeTotale,operatoreId,openedAt,closedAt,createdAt,updatedAt) VALUES(?,'P-TEST',?,'DOC-TEST','Cliente storico','C1','DISPONIBILE',?,?,?, ?,?,?,?,?)").run(pack,load.id,variant==='package'?3:2,(variant==='package'?3:2)*12.3456,(variant==='package'?3:2)*.200123,op,stamp,stamp,stamp,stamp);for(const p of panels.slice(0,variant==='package'?3:2))db.prepare("UPDATE Panels SET packageId=?,stato='DISPONIBILE',scannedAt=?,scannedByOperatorId=? WHERE id=?").run(pack,stamp,op,p.id);}
  for(const p of panels.filter((_,i)=>variant==='single'||(variant==='mixed'&&i===2)))scan.closeSingle(p.id,{operatorId:op});
  const transports=new TransportRepository(db);const loading=new LoadingService(new LoadingRepository(db,transports),transports);
  // Exercise all persisted transport modes without introducing dependencies on registries.
  const carrier=String(db.prepare("SELECT id FROM Carriers LIMIT 1").get()!.id);
  const trailer=String(db.prepare("SELECT id FROM Trailers WHERE active=1 LIMIT 1").get()!.id);const session=loading.create(load.id,{operatorId:op,destinationType:"RIMORCHIO_ESSEPI",trailerId:trailer,carrierId:carrier});
  loading.update(session.id,{operatorId:op,destinationType:"RIMORCHIO_ESSEPI",carrierId:carrier,transportMode:"BILICO_ESSEPI"});
  assert.throws(()=>shipmentDocument(db,session.id),/conclusa/);
  if(pack)loading.addUnit(session.id,{unitType:"PACKAGE",packageId:pack,operatorId:op});
  for(const p of panels.filter((_,i)=>variant==='single'||(variant==='mixed'&&i===2)))loading.addUnit(session.id,{unitType:"PANEL",panelId:p.id,operatorId:op});
  loading.complete(session.id);loading.ship(session.id,{carrierId:carrier,operatorId:op});
  db.prepare("UPDATE LoadingSessions SET transportMode=?,transportDetailLabel='Mezzo storico' WHERE id=?").run(transportMode,session.id);
  const document=shipmentDocument(db,session.id);assert.equal(document.elements.length,3);assert.equal(new Set(document.elements.map(e=>e.id)).size,3);assert.equal(document.totals.weight,3*12.3456);assert.equal(document.totals.volume,3*.200123);assert.equal(document.transportMode,transportMode);assert.equal(document.firstPlannedDate,null);assert.equal(document.totals.warehouseDays,variant==="package"?null:0);
  const frozenWeight=document.elements[0]!.weight;db.prepare("UPDATE Panels SET peso=999,lunghezza=999 WHERE id=?").run(document.elements[0]!.id);assert.equal(shipmentDocument(db,session.id).elements[0]!.weight,frozenWeight);
  db.prepare("INSERT INTO OperationalEvents(id,loadId,type,timestamp,note) VALUES(?,?,'SHIPMENT_PLAN_CREATED','2026-01-01T00:00:00Z',?)").run(`plan-event-${variant}`,load.id,JSON.stringify({id:'plan',loadId:load.id,plannedDepartureDate:'2026-10-01'}));
  assert.equal(shipmentDocument(db,session.id).firstPlannedDate,'2026-10-01');
  db.prepare("UPDATE Carriers SET name='Nome nuovo',updatedAt='2099-01-01T00:00:00Z' WHERE id=?").run(carrier);const historical=shipmentDocument(db,session.id);assert.equal(historical.carrier?.label,transportMode==="BILICO_ESSEPI"?"Mezzo storico":null);if(transportMode!=="BILICO_ESSEPI")assert.ok(historical.warnings.some(w=>w.includes('trasportatore')));
  assert.throws(()=>shipmentDocument(db,"absent"),/non trovata/);
  db.prepare("UPDATE LoadingSessions SET transportMode=NULL WHERE id=?").run(session.id);
  assert.equal(shipmentDocument(db,session.id).trailer?.id,trailer);
  db.prepare("UPDATE LoadingUnits SET active=0 WHERE loadingSessionId=?").run(session.id);
  assert.throws(()=>shipmentDocument(db,session.id),/incoerente/);
 }finally{conn.close();}
 }}
});
