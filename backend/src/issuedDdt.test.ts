import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
import { createHash } from "node:crypto";
import { buildApp } from "./app.js";
import { Worker } from "node:worker_threads";
import { ddtDownloadName } from "./services/ddtDownloadName.js";

test("Nome download DDT: valori reali, Windows, Unicode e dati mancanti",()=>{
  const name=(order:unknown,truck:unknown,customer:unknown)=>ddtDownloadName(JSON.stringify({data:{model:{order,truck,customer}}}));
  assert.equal(name("265694","C5","RossiLegnami"),"265694_C5_RossiLegnami.pdf");
  assert.equal(name('26/56', 'C:5', 'Rossi<>:"/\\|?*\r\n. '),'26-56_C-5_Rossi-----------.pdf');
  assert.equal(name(null,"", "..."),"Commessa_Camion_Cliente.pdf");
  assert.equal(name("CON","LPT1","Caffè"),"_CON__LPT1_Caffè.pdf");
  assert.equal(ddtDownloadName("{}"),"Commessa_Camion_Cliente.pdf");
});

async function fixture(mode="RITIRA_CLIENTE",count=4){
  const dir=mkdtempSync(join(tmpdir(),"sislog-ddt2b-")),databasePath=join(dir,"test.sqlite");
  const config={environment:"test" as const,databasePath,port:3198,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath:null,httpsKeyPath:null,httpsCertPath:null};
  const app=await buildApp(config),db=new DatabaseSync(databasePath);
  const operator=String(db.prepare("SELECT id FROM Operators WHERE active=1 LIMIT 1").get()!.id);
  const carrier=String(db.prepare("SELECT id FROM Carriers WHERE active=1 LIMIT 1").get()!.id);
  const trailer=String(db.prepare("SELECT id FROM Trailers WHERE active=1 LIMIT 1").get()!.id);
  const at="2026-10-17T08:00:00Z";
  db.prepare("INSERT INTO Loads(id,commessa,cliente,camion,stato,createdAt,updatedAt) VALUES('L','DDT-TEST','Cliente fixture','C1','ATTESA_SPEDIZIONE',?,?)").run(at,at);
  db.prepare("INSERT INTO Customers(id,denominazione,partitaIva,createdAt,updatedAt) VALUES('CUSTOM','Cliente fixture','01949810160',?,?)").run(at,at);
  db.prepare("INSERT INTO ShipmentPlans(id,loadId,customerId,deliveryAddress,orderReference,transportMode,transportType,createdAt,updatedAt) VALUES('PLAN','L','CUSTOM','Via destinazione 12, Milano','ORD-TEST',?,?,?,?)").run(mode,mode==="BILICO_ESSEPI"?mode:"TRASPORTATORE_ESTERNO",at,at);
  db.prepare("INSERT INTO ThirdPartyTransportModes(id,name,active,createdAt,updatedAt) VALUES('DETAIL','Mezzo terzi fixture',1,?,?)").run(at,at);
  db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,carrierId,trailerId,transportMode,transportDetailId,startedAt,completedAt,createdAt,updatedAt) VALUES('S','L','ATTESA_SPEDIZIONE',?,?,?,?,?,?,?,?,?,?)").run(operator,mode==="BILICO_ESSEPI"?"RIMORCHIO_ESSEPI":"TRASPORTATORE",mode==="RITIRA_CLIENTE"?null:carrier,mode==="BILICO_ESSEPI"?trailer:null,mode,mode==="TERZI_PER_ESSEPI"?"DETAIL":null,at,at,at,at);
  if(mode==="BILICO_ESSEPI")db.prepare("INSERT INTO TransportAssignments(id,trailerId,loadId,loadingSessionId,source,stato,assignedAt,createdAt,updatedAt) VALUES('ASSIGN',?,'L','S','LOAD','CARICATO',?,?,?)").run(trailer,at,at,at);
  db.prepare("INSERT INTO Packages(id,codicePacco,loadId,commessa,cliente,camion,stato,numeroPannelli,pesoTotale,volumeTotale,operatoreId,openedAt,closedAt,createdAt,updatedAt) VALUES('PACK','PACK-TEST','L','DDT-TEST','Cliente fixture','C1','CARICATO',2,100,.2,?,?,?,?,?)").run(operator,at,at,at,at);
  for(let i=0;i<count;i++){
    const pack=i>=count-2?"PACK":null;
    db.prepare("INSERT INTO Panels(id,loadId,numeroPannello,camion,tipoPannello,quantita,spessore,lunghezza,altezza,superficie,peso,volume,packageId,stato,createdAt,updatedAt) VALUES(?,'L',?,'C1','CLT',1,100,1000,1000,1,50,.1,?,'CARICATO',?,?)").run(`P${i}`,`E-${i}`,pack,at,at);
    if(!pack)db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,panelId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES(?,'S','PANEL',?,?,?,?,?)").run(`U${i}`,`P${i}`,at,operator,at,at);
  }
  db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,packageId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES('UP','S','PACKAGE','PACK',?,?,?,?)").run(at,operator,at,at);
  db.prepare("INSERT INTO OperationalEvents(id,loadId,loadingSessionId,type,operatorId,timestamp) VALUES('CLOSE','L','S','LOADING_CLOSURE_CONFIRMED',?,?)").run(operator,at);
  const issue=(key=crypto.randomUUID())=>app.inject({method:"POST",url:"/api/loading-sessions/S/ddt",payload:{operatorId:operator,requestKey:key}});
  const state=()=>JSON.stringify([db.prepare("SELECT * FROM Loads").all(),db.prepare("SELECT * FROM LoadingSessions").all(),db.prepare("SELECT * FROM ShipmentPlans").all(),db.prepare("SELECT * FROM Panels").all(),db.prepare("SELECT * FROM Packages").all()]);
  return {app,db,config,operator,issue,state,close:async()=>{db.close();await app.close();rmSync(dir,{recursive:true,force:true});}};
}

for(const mode of ["BILICO_ESSEPI","RITIRA_CLIENTE","TERZI_PER_ESSEPI"])test(`DDT definitivo ${mode}: emissione, doppio clic, snapshot e partenza separata`,async()=>{
  const f=await fixture(mode);try{
    const before=f.state(),availability=await f.app.inject({method:"GET",url:"/api/loading-sessions/S/ddt"});
    assert.equal(availability.json().canIssue,true,availability.body);
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM DdtSequences").get()!.n,0);
    const key=crypto.randomUUID(),response=await f.issue(key);assert.equal(response.statusCode,200,response.body);const doc=response.json();
    assert.match(doc.fullNumber,/^X-Lam\/0001\/\d{4}$/);assert.equal(f.state(),before);
    const payload=JSON.parse(doc.snapshotJson);assert.equal(payload.data.model.kind,"DDT_DEFINITIVO");assert.equal(payload.data.model.totals.elements,4);assert.equal(payload.data.panels.length,4);assert.equal(payload.data.packages.length,1);assert.equal(payload.data.customer.id,"CUSTOM");
    assert.equal(payload.data.model.reference,doc.fullNumber);assert.equal(payload.data.model.date,doc.documentDate.split("-").reverse().join("/"));
    assert.equal((await f.issue(key)).json().id,doc.id);assert.equal((await f.issue()).statusCode,409);
    const pdf=await f.app.inject({method:"GET",url:`/api/ddt/${doc.id}/pdf`});assert.equal(pdf.statusCode,200);assert.equal(pdf.rawPayload.subarray(0,5).toString(),"%PDF-");
    assert.match(String(pdf.headers["content-disposition"]),/^inline; filename="DDT-TEST_C1_Cliente fixture.pdf"/);
    const archivedBefore=f.db.prepare("SELECT * FROM DdtDocuments WHERE id=?").get(doc.id);
    const download=await f.app.inject({method:"GET",url:`/api/ddt/${doc.id}/pdf?download=1`});
    assert.match(String(download.headers["content-disposition"]),/^attachment; filename="DDT-TEST_C1_Cliente fixture.pdf"/);
    assert.deepEqual(download.rawPayload,pdf.rawPayload);
    assert.deepEqual(f.db.prepare("SELECT * FROM DdtDocuments WHERE id=?").get(doc.id),archivedBefore);
    assert.equal(createHash("sha256").update(pdf.rawPayload).digest("hex"),doc.pdfSha256);
    assert.deepEqual((await f.app.inject({method:"GET",url:`/api/ddt/${doc.id}/pdf`})).rawPayload,pdf.rawPayload);
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM DdtDocuments").get()!.n,1);
    assert.equal((await f.app.inject({method:"GET",url:"/api/loading-sessions/S/ddt"})).json().document.id,doc.id);
    const carrier=f.db.prepare("SELECT carrierId FROM LoadingSessions WHERE id='S'").get()!.carrierId;
    const departure=await f.app.inject({method:"POST",url:"/api/shipments/PLAN/depart",payload:{operatorId:f.operator,...(carrier?{carrierId:carrier}:{})}});assert.equal(departure.statusCode,200,departure.body);
    assert.ok(f.db.prepare("SELECT shippedAt FROM LoadingSessions WHERE id='S'").get()!.shippedAt);
    assert.deepEqual((await f.app.inject({method:"GET",url:`/api/ddt/${doc.id}/pdf`})).rawPayload,pdf.rawPayload);
    assert.equal(f.db.prepare("SELECT snapshotJson FROM DdtDocuments WHERE id=?").get(doc.id)!.snapshotJson,doc.snapshotJson);
    assert.equal((await f.app.inject({method:"POST",url:`/api/ddt/${doc.id}/cancel`,payload:{operatorId:f.operator,reason:"Tardi"}})).statusCode,409);
    if(process.env.DDT_2B_QA_DIR){const dir=resolve(process.env.DDT_2B_QA_DIR);mkdirSync(dir,{recursive:true});writeFileSync(join(dir,`definitivo-${mode}.pdf`),pdf.rawPayload);}
  }finally{await f.close();}
});

test("DDT Bilico: piano con rimorchio, vettore effettivo in sessione e rollback integrale della partenza",async()=>{
  const f=await fixture("BILICO_ESSEPI");try{
    // The operational Calendar plan already has a trailer, unlike the basic fixture.
    const trailer=String(f.db.prepare("SELECT trailerId FROM LoadingSessions WHERE id='S'").get()!.trailerId);
    f.db.prepare("UPDATE ShipmentPlans SET trailerId=? WHERE id='PLAN'").run(trailer);
    const issued=await f.issue();assert.equal(issued.statusCode,200,issued.body);
    const doc=issued.json(),carrier=f.db.prepare("SELECT carrierId FROM LoadingSessions WHERE id='S'").get()!.carrierId;
    const tables=f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>String(r.name));
    const snapshot=()=>JSON.stringify(tables.map(name=>[name,f.db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
    const before=snapshot();
    // Fail at the final write, after session/plan/material/assignment updates.
    f.db.exec("CREATE TRIGGER fail_departure_event BEFORE INSERT ON OperationalEvents WHEN NEW.type='PARTENZA_CONFERMATA' BEGIN SELECT RAISE(ABORT,'FORCED_DEPARTURE_FAILURE'); END");
    const payload={operatorId:f.operator,carrierId:carrier};
    const failed=await f.app.inject({method:"POST",url:"/api/shipments/PLAN/depart",payload});
    assert.equal(failed.statusCode,500,failed.body);assert.equal(snapshot(),before,"Failed departure must roll back every operational/archive table");
    f.db.exec("DROP TRIGGER fail_departure_event");
    const departure=await f.app.inject({method:"POST",url:"/api/shipments/PLAN/depart",payload});
    assert.equal(departure.statusCode,200,departure.body);
    const session=f.db.prepare("SELECT * FROM LoadingSessions WHERE id='S'").get()!,plan=f.db.prepare("SELECT * FROM ShipmentPlans WHERE id='PLAN'").get()!;
    assert.equal(session.stato,"SPEDITO");assert.equal(session.carrierId,carrier);
    assert.equal(plan.trailerId,trailer);assert.equal(plan.carrierId,null);assert.equal(plan.actualDepartureDate,session.shippedAt);
    assert.equal(f.db.prepare("SELECT stato FROM TransportAssignments WHERE id='ASSIGN'").get()!.stato,"IN_VIAGGIO");
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM OperationalEvents WHERE type='PARTENZA_CONFERMATA'").get()!.n,1);
    assert.deepEqual((await f.app.inject({method:"GET",url:`/api/loading-sessions/S/ddt`})).json().document,doc);
    assert.equal(createHash("sha256").update((await f.app.inject({method:"GET",url:`/api/ddt/${doc.id}/pdf`})).rawPayload).digest("hex"),doc.pdfSha256);
  }finally{await f.close();}
});

test("DDT definitivo: protezioni API e SQL, annullamento backend e riapertura",async()=>{
  const f=await fixture();try{
    const key=crypto.randomUUID(),response=await f.issue(key);assert.equal(response.statusCode,200,response.body);const doc=response.json(),before=f.state();
    for(const [method,url,payload] of [
      ["POST","/api/loading-sessions/S/reopen",{}],
      ["PATCH","/api/loading-sessions/S",{operatorId:f.operator,destinationType:"TRASPORTATORE",transportMode:"TERZI_PER_ESSEPI",transportDetailId:null}],
      ["DELETE","/api/loading-sessions/S/units/U0",{operatorId:f.operator}],
      ["POST","/api/loading-sessions/S/units",{operatorId:f.operator,unitType:"PANEL",panelId:"P0"}],
      ["PATCH","/api/packages/PACK/location",{location:"Cambiata"}],
      ["PATCH","/api/panels/P0/location",{location:"Cambiata"}],
    ] as const){const r=await f.app.inject({method,url,payload});assert.equal(r.statusCode,409,r.body);}
    for(const sql of ["UPDATE Loads SET cliente='Alterato' WHERE id='L'","DELETE FROM Loads WHERE id='L'","UPDATE LoadingSessions SET transportMode='BILICO_ESSEPI' WHERE id='S'","UPDATE Panels SET peso=500 WHERE id='P0'","UPDATE Panels SET packageId='PACK' WHERE id='P0'","DELETE FROM LoadingUnits WHERE id='U0'","UPDATE Packages SET numeroPannelli=99 WHERE id='PACK'","UPDATE ShipmentPlans SET deliveryAddress='Diverso' WHERE id='PLAN'","UPDATE ShipmentPlans SET loadId=NULL WHERE id='PLAN'","DELETE FROM ShipmentPlans WHERE id='PLAN'","UPDATE Customers SET partitaIva='000' WHERE id='CUSTOM'"]){assert.throws(()=>f.db.exec(sql),/DDT_LOAD_LOCKED/,sql);}
    assert.equal(f.state(),before);
    const panels=f.db.prepare("SELECT numeroPannello,numeroCliente,numeroMasterPanel,camion,lato1,lato2,tipoPannello,quantita,spessore,lunghezza,altezza,superficie,volume,peso FROM Panels WHERE loadId='L'").all();
    const imported=await f.app.inject({method:"PUT",url:"/api/loads/L/import",payload:{commessa:"DDT-TEST",cliente:"Modificato",numeroCliente:"",riferimentoOrdine:"MODIFICATO",pannelli:panels}});
    assert.equal(imported.statusCode,409,imported.body);assert.equal(f.state(),before);
    // Scheduling is separate from document data and must not rewrite the original.
    f.db.exec("UPDATE ShipmentPlans SET plannedDepartureDate='2026-10-18' WHERE id='PLAN'");
    assert.equal(f.db.prepare("SELECT snapshotJson FROM DdtDocuments WHERE id=?").get(doc.id)!.snapshotJson,doc.snapshotJson);
    assert.equal((await f.app.inject({method:"POST",url:`/api/ddt/${doc.id}/cancel`,payload:{operatorId:f.operator,reason:" "}})).statusCode,409);
    const cancelled=await f.app.inject({method:"POST",url:`/api/ddt/${doc.id}/cancel`,payload:{operatorId:f.operator,reason:"Correzione destinazione"}});assert.equal(cancelled.statusCode,200,cancelled.body);
    assert.equal(cancelled.json().status,"ANNULLATO");assert.equal((await f.app.inject({method:"GET",url:`/api/ddt/${doc.id}/pdf`})).statusCode,200);
    assert.equal((await f.issue(key)).json().status,"ANNULLATO","A replay must never issue another document after cancellation");
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM DdtDocuments").get()!.n,1);
    const reopened=await f.app.inject({method:"POST",url:"/api/loading-sessions/S/reopen",payload:{}});assert.equal(reopened.statusCode,200,reopened.body);
    assert.equal((await f.issue()).statusCode,409);
    const closed=await f.app.inject({method:"POST",url:"/api/loading-sessions/S/complete"});assert.equal(closed.statusCode,200,closed.body);
    const second=await f.issue();assert.equal(second.statusCode,200,second.body);assert.equal(second.json().sequence,2);
    assert.equal(f.db.prepare("SELECT replacedByDdtId FROM DdtDocuments WHERE id=?").get(doc.id)!.replacedByDdtId,second.json().id);
  }finally{await f.close();}
});

test("Recupero trasporto pianificato: anteprima consentita ma emissione definitiva ancora bloccata",async()=>{
 const f=await fixture();try{
  f.db.exec("UPDATE LoadingSessions SET transportMode=NULL,carrierId=NULL WHERE id='S'; UPDATE ShipmentPlans SET transportMode='BILICO_ESSEPI',plannedCarrierId=(SELECT id FROM Carriers WHERE active=1 LIMIT 1) WHERE id='PLAN'");
  const before=f.state(),session=f.db.prepare("SELECT * FROM LoadingSessions WHERE id='S'").get();
  assert.equal((await f.app.inject({method:'GET',url:'/api/loading-sessions/S/ddt-preview'})).statusCode,200);
  const issued=await f.issue();assert.equal(issued.statusCode,422);assert.match(issued.json().error.message,/modalit. effettiva/);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM DdtDocuments').get()!.n,0);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM DdtSequences').get()!.n,0);
  assert.equal(f.state(),before);assert.deepEqual(f.db.prepare("SELECT * FROM LoadingSessions WHERE id='S'").get(),session);
 }finally{await f.close();}
});

test("DDT definitivo: corruzione PDF blocca la ristampa via API",async()=>{
  const f=await fixture();try{
    const doc=(await f.issue()).json();
    f.db.exec("DROP TRIGGER ddt_immutable; UPDATE DdtDocuments SET pdfBytes=X'00'");
    const response=await f.app.inject({method:"GET",url:`/api/ddt/${doc.id}/pdf`});assert.equal(response.statusCode,409);assert.equal(response.json().error.code,"DDT_PDF_INTEGRITY_ERROR");
  }finally{await f.close();}
});

for(const environment of ["development","demo","production"] as const)test(`DDT definitivo: nessuna API o schema attivato in ${environment}`,async()=>{
  const dir=mkdtempSync(join(tmpdir(),"sislog-ddt-disabled-")),databasePath=join(dir,"isolated.sqlite"),frontendDistPath=join(dir,"frontend");
  mkdirSync(frontendDistPath);writeFileSync(join(frontendDistPath,"index.html"),"test fixture");
  const app=await buildApp({environment,databasePath,port:3198,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath,httpsKeyPath:null,httpsCertPath:null});
  const db=new DatabaseSync(databasePath,{readOnly:true});try{
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='DdtDocuments'").get()!.n,0);
    for(const [method,url,payload] of [["GET","/api/loading-sessions/S/ddt",undefined],["POST","/api/loading-sessions/S/ddt",{operatorId:"OP",requestKey:crypto.randomUUID()}],["GET","/api/ddt/D/pdf",undefined],["POST","/api/ddt/D/cancel",{operatorId:"OP",reason:"test"}]] as const){assert.equal((await app.inject({method,url,...(payload?{payload}:{})})).statusCode,404);}
  }finally{db.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});

test("DDT definitivo: dati mancanti e chiusura non confermata non consumano numeri",async()=>{
  const f=await fixture("TERZI_PER_ESSEPI");try{
    f.db.exec("UPDATE LoadingSessions SET carrierId=NULL WHERE id='S'");assert.equal((await f.issue()).statusCode,422);
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM DdtSequences").get()!.n,0);
    const carrier=f.db.prepare("SELECT id FROM Carriers WHERE active=1 LIMIT 1").get()!.id;
    f.db.prepare("UPDATE LoadingSessions SET carrierId=? WHERE id='S'").run(carrier!);
    f.db.exec("DELETE FROM OperationalEvents WHERE id='CLOSE'");assert.equal((await f.issue()).statusCode,409);
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM DdtSequences").get()!.n,0);
  }finally{await f.close();}
});

test("DDT definitivo: due API concorrenti, stessa chiave e chiavi distinte",async()=>{
  const f=await fixture(),second=await buildApp(f.config);try{
    const key=crypto.randomUUID();const results=await Promise.all([f.issue(key),second.inject({method:"POST",url:"/api/loading-sessions/S/ddt",payload:{operatorId:f.operator,requestKey:key}})]);
    assert.deepEqual(results.map(r=>r.statusCode),[200,200]);assert.equal(results[0]!.json().id,results[1]!.json().id);
    assert.equal((await f.issue()).statusCode,409);assert.equal(f.db.prepare("SELECT lastNumber FROM DdtSequences").get()!.lastNumber,1);
  }finally{await second.close();await f.close();}
});

test("DDT definitivo: multipagina e snapshot originale dopo riavvio",async()=>{
  const f=await fixture("RITIRA_CLIENTE",80);try{
    const response=await f.issue();assert.equal(response.statusCode,200,response.body);const doc=response.json();
    const first=await f.app.inject({method:"GET",url:`/api/ddt/${doc.id}/pdf`});const other=await buildApp(f.config);
    try{assert.deepEqual((await other.inject({method:"GET",url:`/api/ddt/${doc.id}/pdf`})).rawPayload,first.rawPayload);}finally{await other.close();}
    if(process.env.DDT_2B_QA_DIR){const dir=resolve(process.env.DDT_2B_QA_DIR);mkdirSync(dir,{recursive:true});writeFileSync(join(dir,"definitivo-multipagina.pdf"),first.rawPayload);}
  }finally{await f.close();}
});

test("Fase 2C: annullamento audit, correzione documentale e sostituzione senza riaprire",async()=>{
  const f=await fixture();try{
    const first=(await f.issue()).json(),original=(await f.app.inject({method:"GET",url:`/api/ddt/${first.id}/pdf`})).rawPayload;
    const waiting=f.state();
    const cancel=(reason:string,operatorId=f.operator)=>f.app.inject({method:"POST",url:`/api/ddt/${first.id}/cancel`,payload:{operatorId,reason}});
    assert.equal((await cancel(" ")).statusCode,409);assert.equal((await cancel("Motivo","missing")).statusCode,409);
    const cancelled=await cancel(" Correzione indirizzo ");assert.equal(cancelled.statusCode,200,cancelled.body);
    assert.equal(f.state(),waiting,"Annullamento non riapre e non registra la partenza");
    const doc=cancelled.json();assert.equal(doc.cancellationReason,"Correzione indirizzo");assert.equal(doc.cancelledByOperatorId,f.operator);assert.ok(doc.cancelledAt);
    assert.equal(doc.snapshotJson,first.snapshotJson);assert.equal(doc.pdfSha256,first.pdfSha256);assert.equal(doc.documentDate,first.documentDate);
    assert.equal((await cancel("Altro motivo")).statusCode,409);
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM OperationalEvents WHERE type='DDT_CANCELLED'").get()!.n,1);
    assert.equal(f.db.prepare("SELECT cancellationReason FROM DdtDocuments WHERE id=?").get(first.id)!.cancellationReason,"Correzione indirizzo");
    for(const url of ["/api/loading-sessions/S/ship","/api/shipments/PLAN/depart"]){const r=await f.app.inject({method:"POST",url,payload:{operatorId:f.operator}});assert.equal(r.statusCode,409);assert.equal(r.json().error.code,"DDT_VALID_REQUIRED");}
    const currentPlan=(await f.app.inject({method:"GET",url:"/api/shipments"})).json<Array<{id:string;updatedAt:string}>>().find(plan=>plan.id==="PLAN")!;
    const correction=await f.app.inject({method:"PUT",url:"/api/shipments/PLAN",payload:{loadId:"L",commessa:"DDT-TEST",cliente:"Cliente fixture",camion:"C1",customerId:"CUSTOM",transportType:"RITIRA_CLIENTE",deliveryAddress:"Destinazione corretta",notes:"Correzione documentale",expectedUpdatedAt:currentPlan.updatedAt}});
    assert.equal(correction.statusCode,200,correction.body);
    assert.equal((await f.app.inject({method:"GET",url:"/api/loading-sessions/S/ddt"})).json().canIssue,true);
    const second=(await f.issue()).json();assert.equal(second.sequence,first.sequence+1);assert.notEqual(second.id,first.id);
    assert.equal(JSON.parse(second.snapshotJson).data.model.destination,"Destinazione corretta");
    const archive=(await f.app.inject({method:"GET",url:"/api/loading-sessions/S/ddt"})).json();assert.equal(archive.history.length,2);
    assert.equal(archive.history.find((d:{id:string})=>d.id===first.id).replacedByDdtId,second.id);
    const old=await f.app.inject({method:"GET",url:`/api/ddt/${first.id}/pdf`});assert.equal(old.headers["x-ddt-status"],"ANNULLATO");assert.deepEqual(old.rawPayload,original);
    const departure=await f.app.inject({method:"POST",url:"/api/shipments/PLAN/depart",payload:{operatorId:f.operator}});assert.equal(departure.statusCode,200,departure.body);
    assert.ok(f.db.prepare("SELECT shippedAt FROM LoadingSessions WHERE id='S'").get()!.shippedAt);
    const after=(await f.app.inject({method:"GET",url:"/api/loading-sessions/S/ddt"})).json();assert.equal(after.canCancel,false);assert.equal(after.history.length,2);
    assert.equal((await f.app.inject({method:"POST",url:`/api/ddt/${second.id}/cancel`,payload:{operatorId:f.operator,reason:"Dopo partenza"}})).statusCode,409);
    assert.equal(f.db.prepare("SELECT snapshotJson FROM DdtDocuments WHERE id=?").get(second.id)!.snapshotJson,second.snapshotJson);
    assert.deepEqual((await f.app.inject({method:"GET",url:`/api/ddt/${first.id}/pdf`})).rawPayload,original);
  }finally{await f.close();}
});

test("Fase 2C: nessuna partenza senza DDT, riapertura materiale esplicita e nuova chiusura",async()=>{
  const f=await fixture();try{
    const before=f.state();
    for(const url of ["/api/loading-sessions/S/ship","/api/shipments/PLAN/depart"]){const r=await f.app.inject({method:"POST",url,payload:{operatorId:f.operator}});assert.equal(r.statusCode,409);assert.equal(r.json().error.code,"DDT_VALID_REQUIRED");assert.equal(f.state(),before);}
    const doc=(await f.issue()).json();
    await f.app.inject({method:"POST",url:`/api/ddt/${doc.id}/cancel`,payload:{operatorId:f.operator,reason:"Correzione materiale"}});
    const reopened=await f.app.inject({method:"POST",url:"/api/loading-sessions/S/reopen",payload:{note:"Correggere materiale"}});assert.equal(reopened.statusCode,200,reopened.body);
    const removed=await f.app.inject({method:"DELETE",url:"/api/loading-sessions/S/units/U0",payload:{operatorId:f.operator}});assert.equal(removed.statusCode,200,removed.body);
    assert.equal((await f.issue()).statusCode,409);
    const oldPdf=f.db.prepare("SELECT pdfBytes FROM DdtDocuments WHERE id=?").get(doc.id)!.pdfBytes;
    f.db.exec("UPDATE Panels SET peso=55 WHERE id='P0'");
    const loaded=await f.app.inject({method:"POST",url:"/api/loading-sessions/S/units",payload:{unitType:"PANEL",panelId:"P0",operatorId:f.operator}});assert.equal(loaded.statusCode,200,loaded.body);
    assert.equal((await f.app.inject({method:"POST",url:"/api/loading-sessions/S/complete"})).statusCode,200);
    const replacement=await f.issue();assert.equal(replacement.statusCode,200,replacement.body);assert.equal(replacement.json().sequence,2);
    assert.equal(JSON.parse(replacement.json().snapshotJson).data.model.totals.weight,205);
    assert.deepEqual(f.db.prepare("SELECT pdfBytes FROM DdtDocuments WHERE id=?").get(doc.id)!.pdfBytes,oldPdf);
  }finally{await f.close();}
});

test("Fase 2C: annullamenti concorrenti non riscrivono motivazione e audit",async()=>{
  const f=await fixture(),other=await buildApp(f.config);try{
    const doc=(await f.issue()).json();
    const replies=await Promise.all([f.app,other].map((app,index)=>app.inject({method:"POST",url:`/api/ddt/${doc.id}/cancel`,payload:{operatorId:f.operator,reason:`Motivo ${index}`}})));
    assert.deepEqual(replies.map(r=>r.statusCode).sort(),[200,409]);
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM OperationalEvents WHERE type='DDT_CANCELLED'").get()!.n,1);
    assert.equal(f.db.prepare("SELECT cancellationReason FROM DdtDocuments WHERE id=?").get(doc.id)!.cancellationReason,replies.find(r=>r.statusCode===200)!.json().cancellationReason);
    assert.equal(f.db.prepare("SELECT stato FROM LoadingSessions WHERE id='S'").get()!.stato,"ATTESA_SPEDIZIONE");
  }finally{await other.close();await f.close();}
});

test("Fase 2C: concorrenza reale annullamento/partenza su connessioni distinte",async()=>{
  const f=await fixture();try{
    const doc=(await f.issue()).json();
    const workers=["cancel","depart"].map(action=>new Worker(`
      const {parentPort,workerData:w}=require('node:worker_threads');
      (async()=>{
        const {DatabaseSync}=await import('node:sqlite');
        const db=new DatabaseSync(w.path);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
        const {LoadingRepository}=await import(w.loadingRepo),{LoadingService}=await import(w.loadingService);
        const {DefinitiveDdtRepository}=await import(w.ddtRepo),{DefinitiveDdtService}=await import(w.ddtService);
        parentPort.once('message',()=>{try{
          if(w.action==='cancel')new DefinitiveDdtService(new DefinitiveDdtRepository(db),'test').cancel(w.id,w.operator,'Correzione concorrente');
          else new LoadingService(new LoadingRepository(db),undefined,true).ship('S',{operatorId:w.operator});
          parentPort.postMessage({action:w.action,ok:true});
        }catch(error){parentPort.postMessage({action:w.action,ok:false,error:error.message});}finally{db.close();parentPort.close();}});
        parentPort.postMessage({ready:true});
      })().catch(error=>{throw error;});
    `,{eval:true,workerData:{action,path:f.config.databasePath,id:doc.id,operator:f.operator,loadingRepo:new URL('./repositories/loadingRepository.js',import.meta.url).href,loadingService:new URL('./services/loadingService.js',import.meta.url).href,ddtRepo:new URL('./repositories/definitiveDdtRepository.js',import.meta.url).href,ddtService:new URL('./services/definitiveDdtService.js',import.meta.url).href}}));
    try{
      await Promise.all(workers.map(worker=>new Promise<void>((resolve,reject)=>{worker.once('message',()=>resolve());worker.once('error',reject);} )));
      const pending=workers.map(worker=>new Promise<{action:string;ok:boolean;error?:string}>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);}));
      workers.forEach(worker=>worker.postMessage('start'));const results=await Promise.all(pending);
      assert.equal(results.filter(r=>r.ok).length,1,JSON.stringify(results));
      const cancelled=f.db.prepare("SELECT status FROM DdtDocuments WHERE id=?").get(doc.id)!.status==='ANNULLATO';
      const shipped=f.db.prepare("SELECT shippedAt FROM LoadingSessions WHERE id='S'").get()!.shippedAt!==null;
      assert.notEqual(cancelled,shipped);
      assert.equal(f.db.prepare("SELECT pdfSha256 FROM DdtDocuments WHERE id=?").get(doc.id)!.pdfSha256,doc.pdfSha256);
    }finally{await Promise.all(workers.map(worker=>worker.terminate()));}
  }finally{await f.close();}
});
