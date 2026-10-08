import assert from "node:assert/strict";
import "./materialAvailability.test.js";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { ScanningRepository } from "./repositories/scanningRepository.js";
import { openSqliteDatabase } from "./database/sqliteDatabase.js";
import { ScanningService } from "./services/scanningService.js";
import { buildApp } from "./app.js";
import { loadConfig, type AppConfig } from "./config/environment.js";
import { addBusinessDays, TransportRepository } from "./repositories/transportRepository.js";
import { assertTestDatabase, productionDatabase, testConfig, testDatabase } from "./config/testEnvironment.js";
import { migrateLoadingTransport } from "./database/loadingTransportMigration.js";
import { LoadingRepository } from "./repositories/loadingRepository.js";
import { LoadRepository } from "./repositories/loadRepository.js";
import { LoadService } from "./services/loadService.js";
import { ShipmentRepository, type ShipmentRecord } from "./repositories/shipmentRepository.js";
import { previewShipmentReconciliation, reconcileManualShipments } from "./repositories/shipmentReconciliation.js";
import { shipmentHistoryMetrics } from "./repositories/shipmentHistoryMetrics.js";

test("storico: prima pianificazione certificata, nessuna data magazzino inventata, proiezione read-only",()=>{
  const db=new DatabaseSync(":memory:");
  db.exec("CREATE TABLE OperationalEvents(id TEXT,type TEXT,loadId TEXT,timestamp TEXT,note TEXT)");
  const event=(id:string,loadId:string,type:string,timestamp:string,note:unknown)=>db.prepare("INSERT INTO OperationalEvents VALUES(?,?,?,?,?)").run(id,type,loadId,timestamp,JSON.stringify(note));
  try {
    event("PLAN","A","SHIPMENT_PLAN_CREATED","2026-09-01T10:00:00Z",{id:"P",loadId:"A",plannedDepartureDate:"2026-10-07"});
    event("UPDATE","A","SHIPMENT_PLAN_UPDATED","2026-09-02T10:00:00Z",{before:{id:"P",loadId:"A",plannedDepartureDate:"2026-10-07"},after:{plannedDepartureDate:"2026-10-08"}});
    // Physical completion is explicitly NOT material availability.
    event("COMPLETE","A","LOADING_COMPLETED","2026-10-07T10:00:00Z",null);
    event("REOPEN","A","LOADING_REOPENED","2026-10-07T11:00:00Z",null);
    event("MOVE","A","PANEL_REASSIGNED","2026-10-07T11:05:00Z",null);
    event("CANCEL","A","SCAN_CANCELLED","2026-10-07T11:10:00Z",null);
    const before=db.prepare("SELECT * FROM OperationalEvents ORDER BY id").all();
    assert.deepEqual(shipmentHistoryMetrics(db,"A","2026-10-08T12:00:00Z"),{originalPlannedDepartureDate:"2026-10-07",warehouseDays:null});
    assert.deepEqual(shipmentHistoryMetrics(db,"OTHER-TRUCK","2026-10-08T12:00:00Z"),{originalPlannedDepartureDate:null,warehouseDays:null});
    assert.deepEqual(shipmentHistoryMetrics(db,"A",null),{originalPlannedDepartureDate:null,warehouseDays:null});
    assert.deepEqual(shipmentHistoryMetrics(db,"A","2026-08-01T12:00:00Z"),{originalPlannedDepartureDate:null,warehouseDays:null});
    event("EMPTY","B","SHIPMENT_PLAN_CREATED","2026-09-01T10:00:00Z",{id:"P2",loadId:"B",plannedDepartureDate:null});
    event("FIRST","B","SHIPMENT_PLAN_UPDATED","2026-09-02T10:00:00Z",{before:{id:"P2",loadId:"B",plannedDepartureDate:null},after:{plannedDepartureDate:"2026-10-06"}});
    assert.equal(shipmentHistoryMetrics(db,"B","2026-10-08T12:00:00Z").originalPlannedDepartureDate,"2026-10-06");
    event("MANUAL","C","SHIPMENT_PLAN_UPDATED","2026-09-02T10:00:00Z",{before:{id:"P3",loadId:"C",plannedDepartureDate:"2026-10-01",originalPlannedDepartureDate:"2026-10-01"},after:{plannedDepartureDate:"2026-10-06"}});
    assert.equal(shipmentHistoryMetrics(db,"C","2026-10-08T12:00:00Z").originalPlannedDepartureDate,null);
    event("BAD","D","SHIPMENT_PLAN_CREATED","2026-09-01T10:00:00Z",{id:"P4",loadId:"D",plannedDepartureDate:"2026-02-30"});
    assert.equal(shipmentHistoryMetrics(db,"D","2026-10-08T12:00:00Z").originalPlannedDepartureDate,null);
    assert.deepEqual(db.prepare("SELECT * FROM OperationalEvents WHERE loadId='A' ORDER BY id").all(),before);
  }finally{db.close();}
});

test("operator registry: immutable code, deactivate/reactivate, safe delete and historical archive",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"operator-registry-"));
  const databasePath=join(dir,"test.sqlite"),app=await buildApp({...config,databasePath});
  const db=new DatabaseSync(databasePath);
  try {
    const create=async(id:string)=>(await app.inject({method:"POST",url:"/api/operators",payload:{id,code:"GT",name:"Giorgio Tamburini"}}));
    assert.equal((await create("UNUSED")).statusCode,201);
    assert.equal((await app.inject({method:"PUT",url:"/api/operators/UNUSED",payload:{code:"XX",name:"Giorgio Tamburini"}})).statusCode,409);
    assert.equal((await app.inject({method:"PUT",url:"/api/operators/UNUSED",payload:{code:"GT",name:"Giorgio Nuovo"}})).statusCode,200);
    assert.equal((await app.inject({method:"PATCH",url:"/api/operators/UNUSED",payload:{active:false}})).json().active,false);
    assert.equal((await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string;active:boolean}>>().find(item=>item.id==="UNUSED")?.active,false);
    assert.equal((await app.inject({method:"PATCH",url:"/api/operators/UNUSED",payload:{active:true}})).json().active,true);
    assert.equal((await app.inject({method:"DELETE",url:"/api/operators/UNUSED"})).statusCode,200);
    assert.equal(db.prepare("SELECT 1 FROM Operators WHERE id='UNUSED'").get(),undefined);
    await create("HISTORY");
    const now=new Date().toISOString();
    db.prepare("INSERT INTO Loads(id,commessa,cliente,camion,createdAt,updatedAt) VALUES('OP-LOAD','TEST','Cliente','C1',?,?)").run(now,now);
    db.prepare("INSERT INTO OperationalEvents(id,loadId,type,operatorId,timestamp,note) VALUES('OP-EVENT','OP-LOAD','PANEL_SCANNED','HISTORY',?,'preserve')").run(now);
    const event=db.prepare("SELECT * FROM OperationalEvents WHERE id='OP-EVENT'").get();
    assert.equal((await app.inject({method:"DELETE",url:"/api/operators/HISTORY"})).statusCode,200);
    const archived=db.prepare("SELECT * FROM Operators WHERE id='HISTORY'").get()!;
    assert.equal(archived.archived,1);assert.equal(archived.active,0);assert.equal(archived.code,"GT");assert.equal(archived.name,"Giorgio Tamburini");
    assert.deepEqual(db.prepare("SELECT * FROM OperationalEvents WHERE id='OP-EVENT'").get(),event);
    assert.equal((await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string;archived:boolean}>>().find(item=>item.id==="HISTORY")?.archived,true);
    assert.equal((await app.inject({method:"PATCH",url:"/api/operators/HISTORY",payload:{active:true}})).statusCode,409);
    assert.throws(()=>db.prepare("UPDATE Operators SET code='XX' WHERE id='HISTORY'").run(),/OPERATOR_CODE_IMMUTABLE/);
    assert.throws(()=>db.prepare("INSERT INTO OperationalEvents(id,loadId,type,operatorId,timestamp) VALUES('NEW','OP-LOAD','PANEL_SCANNED','HISTORY',?)").run(now),/OPERATOR_INACTIVE/);
    await create("OPEN");
    const carrier=String(db.prepare("SELECT id FROM Carriers LIMIT 1").get()!.id);
    db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,carrierId,startedAt,createdAt,updatedAt) VALUES('OP-SESSION','OP-LOAD','IN_CARICO','OPEN','TRASPORTATORE',?,?,?,?)").run(carrier,now,now,now);
    const session=db.prepare("SELECT * FROM LoadingSessions WHERE id='OP-SESSION'").get();
    assert.equal((await app.inject({method:"DELETE",url:"/api/operators/OPEN"})).statusCode,409);
    assert.deepEqual(db.prepare("SELECT * FROM LoadingSessions WHERE id='OP-SESSION'").get(),session);
    assert.equal(db.prepare("SELECT archived FROM Operators WHERE id='OPEN'").get()!.archived,0);
    await create("PACKAGE-OPEN");
    db.prepare("INSERT INTO Packages(id,codicePacco,loadId,commessa,cliente,camion,stato,operatoreId,openedAt,createdAt,updatedAt) VALUES('OP-PACK','OP-PACK','OP-LOAD','TEST','Cliente','C1','APERTO','PACKAGE-OPEN',?,?,?)").run(now,now,now);
    assert.equal((await app.inject({method:"DELETE",url:"/api/operators/PACKAGE-OPEN"})).statusCode,409);
    assert.equal(db.prepare("SELECT stato FROM Packages WHERE id='OP-PACK'").get()!.stato,"APERTO");
    db.prepare("UPDATE Packages SET stato='DISPONIBILE',closedAt=? WHERE id='OP-PACK'").run(now);
    assert.equal((await app.inject({method:"DELETE",url:"/api/operators/PACKAGE-OPEN"})).statusCode,200);
    assert.equal(db.prepare("SELECT archived FROM Operators WHERE id='PACKAGE-OPEN'").get()!.archived,1);
    await create("AUDIT-ONLY");
    db.prepare("INSERT INTO DeletedLoadAudit(eventId,loadId,commessa,camion,eventJson,archivedAt) VALUES('OP-AUDIT','OLD','TEST','C1',?,?)").run(JSON.stringify({operatorId:"AUDIT-ONLY",type:"PANEL_SCANNED"}),now);
    assert.equal((await app.inject({method:"DELETE",url:"/api/operators/AUDIT-ONLY"})).statusCode,200);
    assert.equal(db.prepare("SELECT archived FROM Operators WHERE id='AUDIT-ONLY'").get()!.archived,1);
    await create("INACTIVE");
    await app.inject({method:"PATCH",url:"/api/operators/INACTIVE",payload:{active:false}});
    assert.throws(()=>db.prepare("INSERT INTO OperationalEvents(id,loadId,type,operatorId,timestamp) VALUES('INACTIVE-EVENT','OP-LOAD','PANEL_SCANNED','INACTIVE',?)").run(now),/OPERATOR_INACTIVE/);
    await app.inject({method:"PATCH",url:"/api/operators/INACTIVE",payload:{active:true}});
    db.prepare("INSERT INTO OperationalEvents(id,loadId,type,operatorId,timestamp) VALUES('ACTIVE-EVENT','OP-LOAD','PANEL_SCANNED','INACTIVE',?)").run(now);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
    const reopened=openSqliteDatabase(databasePath);
    assert.equal(reopened.database.prepare("SELECT code,archived FROM Operators WHERE id='HISTORY'").get()!.code,"GT");
    assert.equal(reopened.database.prepare("SELECT archived FROM Operators WHERE id='HISTORY'").get()!.archived,1);
    reopened.close();
  }finally{db.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});

test("calendario: cambio sola data persistente, nessuna modifica operativa e conflitti multiutente",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"calendar-move-")),databasePath=join(dir,"test.sqlite");
  const app=await buildApp({...config,databasePath});
  const db=new DatabaseSync(databasePath);
  try {
    const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("CAL-1","C1-")])})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
    const op=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
    await app.inject({method:"PATCH",url:`/api/panels/${load.pannelli[0]!.id}/close-single`,payload:{operatorId:op.id}});
    const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:op.id,destinationType:"TRASPORTATORE",transportMode:"RITIRA_CLIENTE"}})).json<{id:string}>();
    await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{operatorId:op.id,unitType:"PANEL",panelId:load.pannelli[0]!.id}});
    const input={loadId:load.id,commessa:"COMM-TEST",cliente:"Cliente Test",camion:"C1-",transportType:"RITIRA_CLIENTE",notes:"Conservare nota",orderReference:"RIF-MANUALE",plannedLoadingDate:"2026-10-01",plannedDepartureDate:"2026-10-02"};
    const plan=(await app.inject({method:"POST",url:"/api/shipments",payload:input})).json<ShipmentRecord>();
    assert.equal(plan.operationalStatus,"ATTESA_SPEDIZIONE");
    const snapshot=()=>Object.fromEntries(["Loads","Panels","Packages","LoadingSessions","LoadingUnits","TransportAssignments","OperationalEvents"].map(table=>[table,db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
    const before=snapshot(),beforePlan=db.prepare("SELECT * FROM ShipmentPlans WHERE id=?").get(plan.id)!;
    const move=(date:string,version:string)=>app.inject({method:"PUT",url:`/api/shipments/${plan.id}`,payload:{plannedDepartureDate:date,expectedUpdatedAt:version}});
    const result=await move("2026-10-06",plan.updatedAt!);assert.equal(result.statusCode,200,result.body);
    const saved=result.json<ShipmentRecord>();assert.equal(saved.plannedDepartureDate,"2026-10-06");assert.equal(saved.originalPlannedDepartureDate,"2026-10-02");assert.ok(saved.plannedDepartureDateChangedAt);
    const afterPlan=db.prepare("SELECT * FROM ShipmentPlans WHERE id=?").get(plan.id)!;
    for(const key of Object.keys(beforePlan))if(!["plannedDepartureDate","plannedDepartureDateChangedAt","updatedAt"].includes(key))assert.equal(afterPlan[key],beforePlan[key],key);
    const afterMove=snapshot();
    assert.deepEqual({...afterMove,OperationalEvents:before.OperationalEvents},before);
    const changes=db.prepare("SELECT note FROM OperationalEvents WHERE loadId=? AND type='SHIPMENT_PLAN_UPDATED'").all(load.id);
    assert.equal(changes.length,1);
    const change=JSON.parse(String(changes[0]!.note));assert.equal(change.before.plannedDepartureDate,'2026-10-02');assert.equal(change.after.plannedDepartureDate,'2026-10-06');
    assert.equal((await move('2026-10-06',saved.updatedAt!)).statusCode,200);
    assert.deepEqual(snapshot(),afterMove);
    assert.equal((await move("2026-10-12",plan.updatedAt!)).statusCode,409);
    assert.equal((await move("2026-02-30",saved.updatedAt!)).statusCode,400);
    assert.equal((await app.inject({method:"PUT",url:`/api/shipments/${plan.id}`,payload:{plannedDepartureDate:null,expectedUpdatedAt:saved.updatedAt}})).statusCode,400);
    assert.deepEqual(snapshot(),afterMove);
    assert.equal((await app.inject({method:"GET",url:"/api/shipments"})).json<ShipmentRecord[]>().find(p=>p.id===plan.id)!.plannedDepartureDate,"2026-10-06");
    // A different connection/operation confirms departure after the frontend snapshot.
    assert.equal((await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/ship`,payload:{}})).statusCode,200);
    const departed=snapshot(),departedPlan=db.prepare("SELECT * FROM ShipmentPlans WHERE id=?").get(plan.id);
    const rejected=await move("2026-10-12",saved.updatedAt!);assert.equal(rejected.statusCode,409);assert.equal(rejected.json().error.code,"SHIPMENT_CONSOLIDATED");
    assert.deepEqual(snapshot(),departed);assert.deepEqual(db.prepare("SELECT * FROM ShipmentPlans WHERE id=?").get(plan.id),departedPlan);
  } finally {db.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});

test("pianificazione manuale prima dell'import: stessa entita, dati preservati e aggiornamenti idempotenti",async()=>{
  const app=await buildApp(config);
  try {
    const detail=(await app.inject({method:"POST",url:"/api/third-party-transport-modes",payload:{name:"Angeli Motrice",active:true,sortOrder:0}})).json<{id:string}>();
    const input={commessa:"265609",cliente:"Cliente manuale",camion:" c1- ",plannedLoadingDate:"2026-10-01",plannedDepartureDate:"2026-10-02",transportType:"TERZI_PER_ESSEPI",transportDetailId:detail.id,notes:"Accesso dal retro",orderReference:"RIF MANUALE"};
    const plan=(await app.inject({method:"POST",url:"/api/shipments",payload:input})).json<ShipmentRecord>();
    const payload={...importedLoad([importedPanel("P1","C1-"),importedPanel("P2","C1-")]),commessa:"265609",cliente:"Cliente ufficiale",riferimentoOrdine:"ALTRO RIF"};
    const imported=await app.inject({method:"POST",url:"/api/loads/import",payload});assert.equal(imported.statusCode,201);
    const load=imported.json<Array<{id:string;pannelli:Array<{id:string;peso:number;volume:number}>}>>()[0]!;
    const read=async()=>(await app.inject({method:"GET",url:"/api/shipments"})).json<ShipmentRecord[]>();
    const items=await read();assert.equal(items.length,1);
    const linked=items[0]!;assert.equal(linked.id,plan.id);assert.equal(linked.loadId,load.id);assert.equal(linked.camion,"C1-");assert.equal(linked.cliente,"Cliente ufficiale");assert.equal(linked.operationalStatus,"DA_COMPLETARE");
    for(const key of ["plannedLoadingDate","plannedDepartureDate","originalPlannedDepartureDate","plannedDepartureDateChangedAt","transportType","transportDetailId","transportDetailLabel","plannedCarrierId","notes","orderReference","createdAt"] as const)assert.equal(linked[key],plan[key],key);
    assert.equal(items.filter(item=>item.plannedDepartureDate===input.plannedDepartureDate).length,1);
    const op=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
    for(const panel of load.pannelli)await app.inject({method:"PATCH",url:`/api/panels/${panel.id}/close-single`,payload:{operatorId:op.id}});
    assert.equal((await read())[0]!.operationalStatus,"DA_CARICARE");
    const operative=(await app.inject({method:"GET",url:`/api/loads/${load.id}`})).json<{stato:string;pannelli:Array<{stato:string;peso:number;volume:number}>}>();
    assert.equal(operative.stato,"DA_CARICARE");assert.equal(operative.pannelli.length,2);assert.ok(operative.pannelli.every(p=>p.stato==="DISPONIBILE"));assert.deepEqual(operative.pannelli.map(p=>[p.peso,p.volume]),load.pannelli.map(p=>[p.peso,p.volume]));
    for(let i=0;i<2;i++)assert.equal((await app.inject({method:"PUT",url:"/api/orders/265609/import",payload})).statusCode,200);
    assert.equal((await app.inject({method:"PUT",url:`/api/loads/${load.id}/import`,payload})).statusCode,200);
    const repeated=await read();assert.equal(repeated.length,1);assert.deepEqual({...repeated[0],operationalStatus:linked.operationalStatus},linked);
  } finally {await app.close();}
});

test("riconciliazione: camion assente, import multi-camion, conflitti, storico e dati esistenti",async t=>{
  for(const scenario of ["single","multiple","update-multiple","occupied","competing","existing","different-truck","different-order","shipped","departed-plan"] as const)await t.test(scenario,()=>{
    const {database:db,close}=openSqliteDatabase(":memory:");
    try {
      const loads=new LoadService(new LoadRepository(db)), plans=new ShipmentRepository(db);
      const base={commessa:"265721",cliente:"Cliente manuale",camion:null,transportType:"RITIRA_CLIENTE" as const,plannedDepartureDate:"2026-10-02",notes:"Conservare",orderReference:null};
      const payload={...importedLoad([importedPanel("A","C1-")]),commessa:base.commessa};
      let plan;
      if(["occupied","existing","shipped"].includes(scenario)) {
        const load=loads.import(payload)[0]!;
        if(scenario==="occupied")plans.create({...base,loadId:load.id});
        if(scenario==="shipped")db.prepare("UPDATE Loads SET stato='SPEDITO' WHERE id=?").run(load.id);
        plan=plans.create(base);
      } else {
        plan=plans.create({...base,camion:scenario==="different-truck"?"C9":null,commessa:scenario==="different-order"?"26572":base.commessa});
        if(scenario==="departed-plan")db.prepare("UPDATE ShipmentPlans SET actualDepartureDate='2026-09-30' WHERE id=?").run(plan.id);
        if(scenario==="competing")plans.create({...base,camion:"C1"});
        if(scenario==="multiple"||scenario==="update-multiple")payload.pannelli.push(importedPanel("B","C2-"));
        if(scenario==="update-multiple")loads.updateOrderImport(base.commessa,payload);
        else loads.import(payload);
      }
      const before=db.prepare("SELECT * FROM ShipmentPlans WHERE id=?").get(plan.id)!;
      const preview=previewShipmentReconciliation(db);
      reconcileManualShipments(db);
      const after=db.prepare("SELECT * FROM ShipmentPlans WHERE id=?").get(plan.id)!;
      if(scenario==="single"||scenario==="existing") {
        assert.ok(after.loadId);assert.equal(after.orderReference,null);
        if(scenario==="existing")assert.equal(preview.find(d=>d.planId===plan.id)!.reason,"MATCH");
      } else {assert.equal(after.loadId,null);assert.deepEqual(after,before);}
      const snapshot=db.prepare("SELECT * FROM ShipmentPlans ORDER BY id").all();
      reconcileManualShipments(db);assert.deepEqual(db.prepare("SELECT * FROM ShipmentPlans ORDER BY id").all(),snapshot);
      if(scenario==="multiple"||scenario==="update-multiple")assert.equal(preview.find(d=>d.planId===plan.id)!.reason,"AMBIGUOUS_LOADS");
      if(scenario==="competing")assert.ok(preview.every(d=>d.reason==="COMPETING_PLANS"));
    } finally {close();}
  });
});

test("riconciliazione e import condividono il rollback",()=>{
  const {database:db,close}=openSqliteDatabase(":memory:");
  try {
    const plans=new ShipmentRepository(db),repo=new LoadRepository(db),loads=new LoadService(repo);
    const plan=plans.create({commessa:"ATOMIC",cliente:"Test",camion:"C1-",transportType:"RITIRA_CLIENTE"});
    db.exec("CREATE TRIGGER reject_link BEFORE UPDATE OF loadId ON ShipmentPlans WHEN NEW.loadId IS NOT NULL BEGIN SELECT RAISE(ABORT,'test rollback'); END");
    assert.throws(()=>loads.import({...importedLoad([importedPanel("P","C1-")]),commessa:"ATOMIC"}),/test rollback/);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM Loads").get()!.n,0);
    assert.equal(db.prepare("SELECT loadId FROM ShipmentPlans WHERE id=?").get(plan.id)!.loadId,null);
  } finally {close();}
});

test("stato automatico: 0/9, 8/9, 9/9, annullamento, ricarico e partenza", async()=>{
  const app=await buildApp(config);
  try {
    const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
    const detail=(await app.inject({method:"POST",url:"/api/third-party-transport-modes",payload:{name:"Angeli Ribassato",active:true,sortOrder:0}})).json<{id:string}>();
    const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad(Array.from({length:9},(_,i)=>importedPanel(String(i+1),"C5-")))})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
    for(const panel of load.pannelli)assert.equal((await app.inject({method:"PATCH",url:`/api/panels/${panel.id}/close-single`,payload:{operatorId:operator.id}})).statusCode,200);
    const settings={operatorId:operator.id,destinationType:"TRASPORTATORE",transportMode:"TERZI_PER_ESSEPI",transportDetailId:detail.id};
    const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:settings})).json<{id:string;stato:string}>();
    assert.equal(session.stato,"DA_CARICARE");
    const add=async(index:number)=>{
      const response=await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:load.pannelli[index]!.id,operatorId:operator.id}});
      assert.equal(response.statusCode,200);return response.json<{stato:string;completedAt:string|null;units:Array<{id:string}>}>();
    };
    for(let i=0;i<8;i++)assert.equal((await add(i)).stato,"IN_CARICO");
    assert.equal((await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/ship`,payload:{}})).statusCode,409);
    const completed=await add(8);assert.equal(completed.stato,"ATTESA_SPEDIZIONE");assert.ok(completed.completedAt);
    const read=async()=>(await app.inject({method:"GET",url:"/api/loads"})).json<Array<{id:string;stato:string;pannelli:Array<{stato:string}>}>>().find(item=>item.id===load.id)!;
    assert.equal((await read()).stato,"ATTESA_SPEDIZIONE");
    const removed=await app.inject({method:"DELETE",url:`/api/loading-sessions/${session.id}/units/${completed.units[8]!.id}`,payload:{operatorId:operator.id}});
    assert.equal(removed.statusCode,200);assert.equal(removed.json().stato,"IN_CARICO");assert.equal(removed.json().completedAt,null);
    const partial=await read();assert.equal(partial.stato,"IN_CARICO");assert.equal(partial.pannelli.filter(p=>p.stato==="CARICATO").length,8);
    assert.equal((await add(8)).stato,"ATTESA_SPEDIZIONE");
    const update=async(transportDetailId:string|null)=>(await app.inject({method:"PATCH",url:`/api/loading-sessions/${session.id}`,payload:{...settings,transportDetailId}})).json<{stato:string}>();
    assert.equal((await update(null)).stato,"IN_CARICO");
    assert.equal((await update(detail.id)).stato,"ATTESA_SPEDIZIONE");
    const shipped=await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/ship`,payload:{}});
    assert.equal(shipped.statusCode,200);assert.equal(shipped.json().stato,"SPEDITO");assert.ok(shipped.json().shippedAt);
    assert.equal((await app.inject({method:"DELETE",url:`/api/loading-sessions/${session.id}/units/${completed.units[0]!.id}`,payload:{operatorId:operator.id}})).statusCode,409);
    assert.equal((await read()).stato,"SPEDITO");
  } finally {await app.close();}
});

test("refresh persiste il completamento preesistente contando i pannelli del pacco e corregge attese incomplete",()=>{
  const {database:db,close}=openSqliteDatabase(":memory:");
  try {
    const now=new Date().toISOString();
    db.prepare("INSERT INTO Loads(id,commessa,cliente,camion,stato,createdAt,updatedAt) VALUES('L','TEST','Cliente','C5','IN_CARICO',?,?)").run(now,now);
    const op=(db.prepare("SELECT id FROM Operators LIMIT 1").get() as {id:string}).id;
    const carrier=(db.prepare("SELECT id FROM Carriers LIMIT 1").get() as {id:string}).id;
    const scanning=new ScanningService(new ScanningRepository(db));
    for(let i=0;i<9;i++)db.prepare("INSERT INTO Panels(id,loadId,numeroPannello,camion,createdAt,updatedAt) VALUES(?,'L',?,'C5',?,?)").run('P'+i,String(i),now,now);
    const pack=scanning.createPackage({loadId:'L',operatorId:op,panelId:'P0'});
    // Seed an already loaded package as found in an existing database.
    db.prepare("UPDATE Panels SET packageId=?,stato='CARICATO' WHERE loadId='L'").run(pack.id);
    db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,carrierId,startedAt,createdAt,updatedAt) VALUES('S','L','IN_CARICO',?,'TRASPORTATORE',?,?,?,?)").run(op,carrier,now,now,now);
    db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,packageId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES('U','S','PACKAGE',?,?,?,?,?)").run(pack.id,now,op,now,now);
    const repo=new LoadingRepository(db);
    assert.equal(repo.findByLoad('L')!.stato,'ATTESA_SPEDIZIONE');
    assert.equal(db.prepare("SELECT stato FROM Loads WHERE id='L'").get()!.stato,'ATTESA_SPEDIZIONE');
    assert.equal(db.prepare("SELECT stato FROM LoadingSessions WHERE id='S'").get()!.stato,'ATTESA_SPEDIZIONE');
    const events=repo.find('S')!.events.length;
    assert.equal(repo.list()[0]!.events.length,events);
    assert.equal(repo.complete('S').events.length,events);
    db.prepare("UPDATE Panels SET packageId=NULL,stato='DISPONIBILE' WHERE id='P8'").run();
    assert.equal(repo.find('S')!.stato,'IN_CARICO');
    assert.equal(db.prepare("SELECT stato FROM Loads WHERE id='L'").get()!.stato,'IN_CARICO');
  } finally {close();}
});

test("draft: atomic first scan, safe abandonment, resume and last removal", async t=>{
  const {database:db,close}=openSqliteDatabase(":memory:");
  const repo=new ScanningRepository(db),service=new ScanningService(repo);
  const now=new Date().toISOString(),operatorId="TEST-OP",loadId="TEST-LOAD";
  db.prepare("INSERT INTO Loads(id,commessa,cliente,camion,createdAt,updatedAt) VALUES(?,?,?,?,?,?)").run(loadId,"TEST","Cliente","C1",now,now);
  for(let n=1;n<=5;n++)db.prepare("INSERT INTO Panels(id,loadId,numeroPannello,camion,peso,volume,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)").run(`P${n}`,loadId,String(n),"C1",10,2,now,now);
  const first=(panelId:string)=>service.createPackage({loadId,operatorId,panelId});
  try {
    await t.test("no scan: no draft exists",()=>assert.equal(service.listPackages().length,0));
    const a=first("P1");
    await t.test("first scan creates active package with correct totals",()=>{
      assert.equal(a.workflowState,"ATTIVO");assert.equal(a.numeroPannelli,1);
      assert.equal(a.pesoTotale,10);assert.equal(a.volumeTotale,2);assert.equal(a.pannelli[0]?.id,"P1");
    });
    await t.test("suspend A and abandon new B without creating a record",()=>{
      assert.equal(service.suspendPackage(a.id)?.workflowState,"SOSPESO");
      assert.equal(service.listPackages().length,1);assert.equal(service.getPackage(a.id).pannelli.length,1);
    });
    await t.test("resume preserves operator, associations and totals",()=>{
      const resumed=service.resumePackage(a.id)!;
      assert.equal(resumed.workflowState,"ATTIVO");assert.equal(resumed.operatoreId,operatorId);
      assert.equal(resumed.pesoTotale,10);assert.equal(resumed.volumeTotale,2);assert.equal(resumed.pannelli[0]?.id,"P1");
    });
    await t.test("failed first scan rolls back draft, scan and suspension",()=>{
      db.exec("CREATE TRIGGER reject_test_panel BEFORE UPDATE OF packageId ON Panels WHEN NEW.id='P2' AND NEW.packageId IS NOT NULL BEGIN SELECT RAISE(ABORT,'test failure'); END");
      assert.throws(()=>first("P2"));assert.equal(service.listPackages().length,1);
      assert.equal(service.getPackage(a.id).workflowState,"ATTIVO");assert.equal(repo.findPanel("P2")?.scannedAt,null);
      db.exec("DROP TRIGGER reject_test_panel");
    });
    const b=first("P2");
    await t.test("new persisted B suspends A; resume A suspends B",()=>{
      assert.equal(service.getPackage(a.id).workflowState,"SOSPESO");
      service.resumePackage(a.id);assert.equal(service.getPackage(b.id).workflowState,"SOSPESO");
      assert.equal(service.getPackage(b.id).pannelli[0]?.id,"P2");
    });
    await t.test("last removal deletes only empty draft and retains audit and panel",()=>{
      assert.equal(service.removePanel(a.id,"P1",{operatorId}),null);
      assert.equal(repo.findPackage(a.id),null);assert.equal(repo.findPanel("P1")?.stato,"MANCANTE");
      assert.equal(repo.findPanel("P1")?.packageId,null);
      const audit=db.prepare("SELECT * FROM OperationalEvents WHERE type='EMPTY_DRAFT_CANCELLED'").get()!;
      assert.equal(audit.packageId,null);assert.ok(String(audit.note).includes(a.id));
      assert.ok(db.prepare("SELECT 1 FROM OperationalEvents WHERE type='PANEL_REMOVED_FROM_PACKAGE'").get());
      assert.equal(service.suspendPackage(a.id),null);
    });
    await t.test("valid suspended draft survives even with stale zero counter",()=>{
      db.prepare("UPDATE Packages SET numeroPannelli=0 WHERE id=?").run(b.id);
      assert.equal(service.suspendPackage(b.id)?.pannelli.length,1);
      assert.ok(repo.findPackage(b.id));
      db.prepare("UPDATE Packages SET numeroPannelli=1 WHERE id=?").run(b.id);
    });
    await t.test("closing a valid package preserves contents and dimensions",()=>{
      service.resumePackage(b.id);
      const closed=service.closePackage(b.id,{codicePacco:"PK-TEST",operatoreId:operatorId,lunghezzaPacco:1000,larghezzaPacco:500,altezzaPacco:300});
      assert.equal(closed.stato,"DISPONIBILE");assert.equal(closed.pannelli[0]?.id,"P2");
      assert.equal(closed.pesoTotale,10);assert.equal(closed.volumeTotale,2);assert.ok(closed.closedAt);
      assert.throws(()=>service.suspendPackage(b.id));
    });
    await t.test("legacy empty cannot close, is discarded even with stale positive counter",()=>{
      const legacy=repo.createPackage(loadId,operatorId);
      db.prepare("UPDATE Packages SET numeroPannelli=99 WHERE id=?").run(legacy.id);
      assert.throws(()=>service.closePackage(legacy.id,{codicePacco:"INVALID",operatoreId:operatorId,lunghezzaPacco:1,larghezzaPacco:1,altezzaPacco:1}));
      assert.equal(service.suspendPackage(legacy.id),null);assert.equal(repo.findPackage(legacy.id),null);
    });
    await t.test("resume removes empty legacy draft; opening cleans previous empty",()=>{
      const legacy=repo.createPackage(loadId,operatorId);repo.suspendPackage(legacy.id);
      assert.equal(service.resumePackage(legacy.id),null);
      const other=repo.createPackage(loadId,operatorId);const c=first("P3");
      assert.equal(repo.findPackage(other.id),null);assert.equal(c.pannelli.length,1);
      service.suspendPackage(c.id);
    });
    await t.test("empty draft with any loading reference is preserved",()=>{
      const legacy=repo.createPackage(loadId,operatorId);
      db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,carrierId,startedAt,createdAt,updatedAt) VALUES('SESSION',?,'IN_CARICO',?,'TRASPORTATORE','CARRIER',?,?,?)").run(loadId,operatorId,now,now,now);
      db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,packageId,loadedAt,loadedByOperatorId,active,createdAt,updatedAt) VALUES('UNIT','SESSION','PACKAGE',?,?,?,0,?,?)").run(legacy.id,now,operatorId,now,now);
      assert.throws(()=>service.suspendPackage(legacy.id));assert.ok(repo.findPackage(legacy.id));
      assert.ok(db.prepare("SELECT 1 FROM LoadingUnits WHERE id='UNIT'").get());
    });
  } finally {close();}
});

test("draft: stale empty snapshot cannot delete an element assigned by another connection",()=>{
  const directory=mkdtempSync(join(tmpdir(),"draft-concurrency-")),path=join(directory,"test.sqlite");
  const first=openSqliteDatabase(path),other=new DatabaseSync(path);
  try{
    const now=new Date().toISOString(),repo=new ScanningRepository(first.database),secondRepo=new ScanningRepository(other);
    first.database.prepare("INSERT INTO Loads(id,commessa,cliente,camion,createdAt,updatedAt) VALUES('L','T','C','C1',?,?)").run(now,now);
    first.database.prepare("INSERT INTO Panels(id,loadId,numeroPannello,camion,createdAt,updatedAt) VALUES('P','L','1','C1',?,?)").run(now,now);
    const draft=repo.createPackage("L","OP");assert.equal(draft.pannelli.length,0);
    secondRepo.transaction(()=>secondRepo.addPanel(draft.id,"P","OP"));
    // A stale UI still considers it empty. The transaction reads the newly committed association.
    const suspended=new ScanningService(repo).suspendPackage(draft.id)!;
    assert.equal(suspended.workflowState,"SOSPESO");assert.equal(suspended.pannelli[0]?.id,"P");
    assert.equal(repo.transaction(()=>repo.discardEmptyDraft(draft.id)),false);
    // BEGIN IMMEDIATE excludes a competing writer throughout check/delete.
    first.database.exec("BEGIN IMMEDIATE");
    try{assert.throws(()=>other.exec("BEGIN IMMEDIATE"),/locked/);}finally{first.database.exec("ROLLBACK");}
  } finally {other.close();first.close();rmSync(directory,{recursive:true,force:true});}
});

test("draft API: first panel required, duplicate requests safe, empty removal response",async()=>{
  const app=await buildApp(config);
  try{
    const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
    const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("ATOMIC","C1")])})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
    const input={loadId:load.id,operatorId:operator.id};
    assert.equal((await app.inject({method:"POST",url:"/api/packages",payload:input})).statusCode,400);
    assert.deepEqual((await app.inject({method:"GET",url:"/api/packages"})).json(),[]);
    const panelId=load.pannelli[0]!.id;
    const responses=await Promise.all([1,2].map(()=>app.inject({method:"POST",url:"/api/packages",payload:{...input,panelId}})));
    assert.deepEqual(responses.map(r=>r.statusCode).sort(),[201,409]);
    const pack=responses.find(r=>r.statusCode===201)!.json<{id:string;numeroPannelli:number}>();
    assert.equal(pack.numeroPannelli,1);
    assert.equal((await app.inject({method:"GET",url:"/api/packages"})).json<unknown[]>().length,1);
    const removed=await app.inject({method:"DELETE",url:`/api/packages/${pack.id}/panels/${panelId}`,payload:{operatorId:operator.id}});
    assert.equal(removed.statusCode,200);assert.equal(removed.json(),null);
    const repeated=await app.inject({method:"POST",url:`/api/packages/${pack.id}/suspend`});
    assert.equal(repeated.statusCode,200);assert.equal(repeated.json(),null);
    assert.equal((await app.inject({method:"GET",url:`/api/packages/${pack.id}`})).statusCode,404);
  }finally{await app.close();}
});

test("trasportatore previsto separato dall'effettivo, modificabile e cancellabile prima della partenza", async()=>{
  const app=await buildApp(config);
  try {
    const carriers=(await app.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string}>>();
    const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
    const trailer=(await app.inject({method:"GET",url:"/api/trailers"})).json<Array<{id:string}>>()[0]!;
    const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("PLAN-CARRIER","C1")])})).json<Array<{id:string;commessa:string;cliente:string;camion:string;pannelli:Array<{id:string}>}>>()[0]!;
    const input={loadId:load.id,commessa:load.commessa,cliente:load.cliente,camion:load.camion,transportType:"BILICO_ESSEPI",plannedCarrierId:carriers[0]!.id};
    const created=await app.inject({method:"POST",url:"/api/shipments",payload:input});
    assert.equal(created.statusCode,200);
    const plan=created.json<{id:string;plannedCarrierId:string;carrierId:null;trailerId:null}>();
    assert.equal(plan.plannedCarrierId,carriers[0]!.id);assert.equal(plan.carrierId,null);assert.equal(plan.trailerId,null);
    const update=await app.inject({method:"PUT",url:`/api/shipments/${plan.id}`,payload:{...input,plannedCarrierId:carriers[1]!.id}});
    assert.equal(update.statusCode,200);assert.equal(update.json().plannedCarrierId,carriers[1]!.id);
    assert.equal((await app.inject({method:"PUT",url:`/api/shipments/${plan.id}`,payload:{...input,plannedCarrierId:"missing"}})).statusCode,400);
    assert.equal((await app.inject({method:"PUT",url:`/api/shipments/${plan.id}`,payload:{...input,transportType:"RITIRA_CLIENTE"}})).statusCode,400);
    assert.equal((await app.inject({method:"DELETE",url:`/api/shipments/${plan.id}`})).statusCode,200);
    const second=(await app.inject({method:"POST",url:"/api/shipments",payload:input})).json<{id:string}>();
    await app.inject({method:"PATCH",url:`/api/panels/${load.pannelli[0]!.id}/close-single`,payload:{operatorId:operator.id}});
    const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"RIMORCHIO_ESSEPI",trailerId:trailer.id}})).json<{id:string}>();
    await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:load.pannelli[0]!.id,operatorId:operator.id}});
    assert.equal((await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/complete`})).statusCode,200);
    const edited=await app.inject({method:"PUT",url:`/api/shipments/${second.id}`,payload:{...input,plannedCarrierId:carriers[1]!.id}});
    assert.equal(edited.statusCode,200);assert.equal(edited.json().trailerId,trailer.id);assert.equal(edited.json().carrierId,null);
    assert.equal((await app.inject({method:"POST",url:`/api/shipments/${second.id}/depart`,payload:{carrierId:carriers[0]!.id}})).statusCode,200);
    const final=(await app.inject({method:"GET",url:"/api/shipments"})).json<Array<{id:string;carrierId:string;plannedCarrierId:string}>>().find(p=>p.id===second.id)!;
    assert.equal(final.carrierId,carriers[0]!.id);assert.equal(final.plannedCarrierId,carriers[1]!.id);
    assert.equal((await app.inject({method:"PUT",url:`/api/shipments/${second.id}`,payload:input})).statusCode,409);
    assert.equal((await app.inject({method:"DELETE",url:`/api/shipments/${second.id}`})).statusCode,409);
  } finally {await app.close();}
});

test("la nuova pianificazione precompila il riferimento ordine dal carico quando omesso",async()=>{
  const app=await buildApp(config);
  try{
    const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("ORDER-REF","C1")])})).json<Array<{id:string;commessa:string;cliente:string;camion:string}>>()[0]!;
    const virtual=(await app.inject({method:"GET",url:"/api/shipments"})).json<Array<{loadId:string|null;orderReference:string|null}>>().find(item=>item.loadId===load.id)!;
    assert.equal(virtual.orderReference,"RIF-01");
    const planned=(await app.inject({method:"POST",url:"/api/shipments",payload:{loadId:load.id,commessa:load.commessa,cliente:load.cliente,camion:load.camion,transportType:"RITIRA_CLIENTE"}})).json<{orderReference:string|null}>();
    assert.equal(planned.orderReference,"RIF-01");
    const manual=(await app.inject({method:"POST",url:"/api/shipments",payload:{commessa:"MANUAL-REF",cliente:"Cliente",camion:"C2",transportType:"TERZI_PER_ESSEPI"}})).json<{orderReference:string|null}>();
    assert.equal(manual.orderReference,null);
  }finally{await app.close();}
});

test("riferimento pianificazione indipendente, facoltativo e persistente anche dopo migrazione", async()=>{
  const directory=mkdtempSync(join(tmpdir(),"shipment-reference-"));
  const databasePath=join(directory,"test.sqlite");
  let app=await buildApp({...config,databasePath});
  try {
    const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("REF-INDEPENDENT","C1")])})).json<Array<{id:string;commessa:string;cliente:string;camion:string}>>()[0]!;
    const input={loadId:load.id,commessa:load.commessa,cliente:load.cliente,camion:load.camion,transportType:"RITIRA_CLIENTE"};
    const created=await app.inject({method:"POST",url:"/api/shipments",payload:input});
    assert.equal(created.statusCode,200);
    const plan=created.json<{id:string;orderReference:string|null}>();
    assert.equal(plan.orderReference,"RIF-01");
    const update=async(value:Record<string,unknown>)=>{
      const response=await app.inject({method:"PUT",url:`/api/shipments/${plan.id}`,payload:{...input,...value}});
      assert.equal(response.statusCode,200);return response.json<{orderReference:string|null}>();
    };
    assert.equal((await update({orderReference:"  RIF-MANUALE  "})).orderReference,"RIF-MANUALE");
    assert.equal((await update({})).orderReference,"RIF-MANUALE");
    const original=(await app.inject({method:"GET",url:`/api/loads/${load.id}`})).json<{riferimentoOrdine:string}>();
    assert.equal(original.riferimentoOrdine,"RIF-01");
    await app.close();
    app=await buildApp({...config,databasePath});
    const read=async()=>(await app.inject({method:"GET",url:"/api/shipments"})).json<Array<{id:string;orderReference:string|null}>>().find(p=>p.id===plan.id)!.orderReference;
    assert.equal(await read(),"RIF-MANUALE");
    assert.equal((await update({orderReference:""})).orderReference,null);
    await app.close();
    app=await buildApp({...config,databasePath});
    assert.equal(await read(),null);
    const manual=await app.inject({method:"POST",url:"/api/shipments",payload:{commessa:"REF-MANUAL",cliente:"Cliente",transportType:"TERZI_PER_ESSEPI",orderReference:"INSERITO"}});
    assert.equal(manual.statusCode,200);assert.equal(manual.json().orderReference,"INSERITO");
    // Simulate the old schema and verify one-time backfill on reopening.
    await app.close();
    const db=new DatabaseSync(databasePath);
    db.exec("ALTER TABLE ShipmentPlans DROP COLUMN orderReference");
    db.close();
    app=await buildApp({...config,databasePath});
    assert.equal(await read(),"RIF-01");
    await update({orderReference:null});
    await app.close();
    app=await buildApp({...config,databasePath});
    assert.equal(await read(),null);
  } finally {await app.close();rmSync(directory,{recursive:true,force:true});}
});

test("carico: effettivi separati dal previsto, rimorchio da Trasporti e riapertura",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"loading-actual-"));
  const cfg={...config,databasePath:join(directory,"test.sqlite")};
  let app=await buildApp(cfg);
  try{
    const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
    const carriers=(await app.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string}>>();
    const trailer=(await app.inject({method:"GET",url:"/api/trailers"})).json<Array<{id:string}>>()[0]!;
    const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("ACTUAL","C1")])})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
    const planned=(await app.inject({method:"POST",url:"/api/shipments",payload:{loadId:load.id,commessa:"COMM-TEST",cliente:"Cliente Test",camion:"C1",transportType:"BILICO_ESSEPI",transportDetailId:carriers[0]!.id}})).json<{id:string}>();
    const base={operatorId:operator.id,destinationType:"RIMORCHIO_ESSEPI",transportMode:"BILICO_ESSEPI"};
    const created=await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{...base,trailerId:trailer.id}});
    assert.equal(created.statusCode,201);
    const session=created.json<{id:string;trailerId:string|null}>();
    assert.equal(session.trailerId,null,"an available trailer must never be assigned from loading input");
    await app.inject({method:"PATCH",url:`/api/panels/${load.pannelli[0]!.id}/close-single`,payload:{operatorId:operator.id}});
    const scan=await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{operatorId:operator.id,unitType:"PANEL",panelId:load.pannelli[0]!.id}});
    assert.equal(scan.statusCode,200,"scanning allowed without trailer or carrier");
    assert.equal((await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/complete`})).statusCode,400);
    const reserved=await app.inject({method:"POST",url:`/api/trailers/${trailer.id}/reservation`,payload:{commessa:"COMM-TEST",cliente:"Cliente Test",carico:"C1"}});
    assert.equal(reserved.statusCode,200);
    const update=await app.inject({method:"PATCH",url:`/api/loading-sessions/${session.id}`,payload:{...base,carrierId:carriers[1]!.id}});
    assert.equal(update.statusCode,200);assert.equal(update.json().trailerId,trailer.id);assert.equal(update.json().carrierId,carriers[1]!.id);
    assert.equal((await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/complete`})).statusCode,200);
    assert.equal((await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/reopen`,payload:{}})).statusCode,200);
    await app.close();app=await buildApp(cfg);
    const restored=(await app.inject({method:"GET",url:`/api/loads/${load.id}/loading-session`})).json<{carrierId:string;transportMode:string;units:unknown[]}>();
    assert.equal(restored.carrierId,carriers[1]!.id);assert.equal(restored.transportMode,"BILICO_ESSEPI");assert.equal(restored.units.length,1);
    await app.inject({method:"PATCH",url:`/api/carriers/${carriers[1]!.id}`,payload:{active:false}});
    assert.equal((await app.inject({method:"PATCH",url:`/api/loading-sessions/${session.id}`,payload:{...base,carrierId:carriers[1]!.id}})).statusCode,200,"saved inactive carrier remains valid");
    const third=(await app.inject({method:"POST",url:"/api/third-party-transport-modes",payload:{name:"Terzi effettivo",active:true,sortOrder:0}})).json<{id:string}>();
    const switched=await app.inject({method:"PATCH",url:`/api/loading-sessions/${session.id}`,payload:{...base,transportMode:"TERZI_PER_ESSEPI",transportDetailId:third.id}});
    assert.equal(switched.statusCode,409);assert.equal(switched.json().error.code,"TRAILER_RELEASE_REQUIRED");
    const protectedSession=(await app.inject({method:"GET",url:`/api/loads/${load.id}/loading-session`})).json();
    assert.equal(protectedSession.carrierId,carriers[1]!.id);assert.equal(protectedSession.trailerId,trailer.id);
    const plans=(await app.inject({method:"GET",url:"/api/shipments"})).json<Array<{id:string;transportType:string;transportDetailId:string}>>();
    assert.equal(plans.find(p=>p.id===planned.id)!.transportDetailId,carriers[0]!.id);assert.equal(plans.find(p=>p.id===planned.id)!.transportType,"BILICO_ESSEPI");
    const inconsistent=await app.inject({method:"PATCH",url:`/api/loading-sessions/${session.id}`,payload:{...base,transportMode:"RITIRA_CLIENTE",transportDetailId:carriers[0]!.id}});
    assert.equal(inconsistent.statusCode,400);
    const inactiveNew=await app.inject({method:"PATCH",url:`/api/loading-sessions/${session.id}`,payload:{...base,carrierId:carriers[1]!.id}});
    assert.equal(inactiveNew.statusCode,200,"saved inactive carrier remains valid after blocked mode change");
    const shipped=await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/ship`,payload:{}});
    assert.equal(shipped.statusCode,200);assert.equal(shipped.json().transportDetailId,null);assert.equal(shipped.json().carrierId,carriers[1]!.id);
  }finally{await app.close();rmSync(directory,{recursive:true,force:true});}
});

test("migrazione carico conserva record, collegamenti, indici e trigger esistenti",()=>{
  const db=new DatabaseSync(":memory:");
  try{
    db.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE LoadingSessions(id TEXT PRIMARY KEY,destinationType TEXT NOT NULL,trailerId TEXT,carrierId TEXT,notes TEXT,
      CHECK((destinationType='RIMORCHIO_ESSEPI' AND trailerId IS NOT NULL) OR (destinationType='TRASPORTATORE' AND carrierId IS NOT NULL)));
      CREATE UNIQUE INDEX legacy_loading_notes ON LoadingSessions(notes);
      CREATE TABLE Child(id TEXT PRIMARY KEY,sessionId TEXT REFERENCES LoadingSessions(id));
      CREATE TABLE Audit(message TEXT);
      CREATE TRIGGER legacy_loading_audit AFTER UPDATE ON LoadingSessions BEGIN INSERT INTO Audit(message) VALUES(NEW.id); END;
      INSERT INTO LoadingSessions VALUES('session','RIMORCHIO_ESSEPI','trailer',NULL,'preserve');
      INSERT INTO Child VALUES('child','session');`);
    migrateLoadingTransport(db);
    migrateLoadingTransport(db);
    assert.equal((db.prepare("SELECT notes FROM LoadingSessions WHERE id='session'").get() as {notes:string}).notes,"preserve");
    assert.equal(db.prepare("SELECT * FROM Child").all().length,1);
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length,0);
    db.exec("UPDATE LoadingSessions SET trailerId=NULL WHERE id='session'");
    assert.equal(db.prepare("SELECT * FROM Audit").all().length,1);
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='legacy_loading_notes'").get());
  }finally{db.close();}
});

test("carico urgente: tre modalità, dettagli opzionali alla scansione e obblighi alla partenza",async()=>{
  const app=await buildApp(config);
  try{
    const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
    const third=(await app.inject({method:"POST",url:"/api/third-party-transport-modes",payload:{name:"Terzi test",active:true,sortOrder:0}})).json<{id:string}>();
    const vehicle=(await app.inject({method:"POST",url:"/api/client-vehicle-types",payload:{name:"Centinato",active:true,sortOrder:0}})).json<{id:string}>();
    for(const [index,mode] of [null,"RITIRA_CLIENTE","TERZI_PER_ESSEPI","BILICO_ESSEPI"].entries()){
      const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:{...importedLoad([importedPanel(`URGENT-${index}`,"C1")]),commessa:`URGENT-${index}`}})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
      const base={operatorId:operator.id,destinationType:"TRASPORTATORE",transportMode:mode};
      const create=await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:base});assert.equal(create.statusCode,201);
      const id=create.json<{id:string}>().id;
      await app.inject({method:"PATCH",url:`/api/panels/${load.pannelli[0]!.id}/close-single`,payload:{operatorId:operator.id}});
      assert.equal((await app.inject({method:"POST",url:`/api/loading-sessions/${id}/units`,payload:{operatorId:operator.id,unitType:"PANEL",panelId:load.pannelli[0]!.id}})).statusCode,200);
      const ship=await app.inject({method:"POST",url:`/api/loading-sessions/${id}/ship`,payload:{}});
      assert.equal(ship.statusCode,mode==="RITIRA_CLIENTE"?200:400);
      if(mode==="TERZI_PER_ESSEPI"){
        assert.equal((await app.inject({method:"PATCH",url:`/api/loading-sessions/${id}`,payload:{...base,transportDetailId:third.id}})).statusCode,200);
        assert.equal((await app.inject({method:"POST",url:`/api/loading-sessions/${id}/ship`,payload:{}})).statusCode,200);
      }
      if(mode===null){
        const changed=await app.inject({method:"PATCH",url:`/api/loading-sessions/${id}`,payload:{...base,transportMode:"RITIRA_CLIENTE",transportDetailId:vehicle.id}});
        assert.equal(changed.statusCode,200);assert.equal(changed.json().transportDetailLabel,"Centinato");
        assert.equal((await app.inject({method:"POST",url:`/api/loading-sessions/${id}/ship`,payload:{}})).statusCode,200);
      }
    }
  }finally{await app.close();}
});

test("il server TEST ignora porta, database e HTTPS ereditati dalla produzione",()=>{
  const keys=["NODE_ENV","PORT","DATABASE_URL","HTTPS_KEY_PATH","HTTPS_CERT_PATH"] as const;
  const previous=keys.map(key=>[key,process.env[key]] as const);
  try{
    Object.assign(process.env,{NODE_ENV:"production",PORT:"3001",DATABASE_URL:productionDatabase,HTTPS_KEY_PATH:"production.key",HTTPS_CERT_PATH:"production.pem"});
    const actual=testConfig();
    assert.equal(actual.port,3002);assert.equal(actual.host,"127.0.0.1");
    assert.equal(actual.environment,"test");assert.equal(actual.databasePath,testDatabase);
    assert.notEqual(actual.databasePath,productionDatabase);
    assert.equal(actual.httpsKeyPath,null);assert.equal(actual.frontendDistPath,null);
    assert.throws(()=>assertTestDatabase(productionDatabase),/esclusivamente/);
  }finally{for(const [key,value] of previous)if(value===undefined)delete process.env[key];else process.env[key]=value;}
});

const config: AppConfig = {
  port: 3001,
  host: "127.0.0.1",
  environment: "test",
  databasePath: ":memory:",
  frontendOrigin: "http://localhost:5173",
  frontendDistPath: null,
  httpsKeyPath: null,
  httpsCertPath: null,
};

test("la configurazione di produzione richiede percorsi assoluti per frontend e database",()=>{
  const base={NODE_ENV:"production",PORT:"3001",HOST:"0.0.0.0",FRONTEND_ORIGIN:"http://server:3001"};
  assert.throws(()=>loadConfig({...base,DATABASE_URL:"D:/SisLog/data/app.sqlite"}),/FRONTEND_DIST_PATH è obbligatorio/);
  assert.throws(()=>loadConfig({...base,FRONTEND_DIST_PATH:"D:/SisLog/frontend/dist"}),/DATABASE_URL è obbligatorio/);
  assert.throws(()=>loadConfig({...base,DATABASE_URL:"./data/app.sqlite",FRONTEND_DIST_PATH:"D:/SisLog/frontend/dist"}),/DATABASE_URL deve essere un percorso assoluto/);
  const loaded=loadConfig({...base,DATABASE_URL:"D:/SisLog/data/app.sqlite",FRONTEND_DIST_PATH:"D:/SisLog/frontend/dist"});
  assert.equal(loaded.host,"0.0.0.0");assert.equal(loaded.port,3001);assert.equal(loaded.databasePath,"D:/SisLog/data/app.sqlite");
});

test("la configurazione HTTPS richiede chiave e certificato insieme",()=>{
  assert.throws(()=>loadConfig({NODE_ENV:"development",HTTPS_KEY_PATH:"key.pem"}),/sia HTTPS_KEY_PATH sia HTTPS_CERT_PATH/);
  const loaded=loadConfig({NODE_ENV:"development",HTTPS_KEY_PATH:"key.pem",HTTPS_CERT_PATH:"cert.pem"});
  assert.match(loaded.httpsKeyPath??"",/key\.pem$/);assert.match(loaded.httpsCertPath??"",/cert\.pem$/);
});

test("in produzione pubblica la SPA senza intercettare gli errori API",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"sislog-frontend-"));
  const assetsPath=join(directory,"assets");
  mkdirSync(assetsPath);
  writeFileSync(join(directory,"index.html"),"<!doctype html><html><body>SisLog Dashboard</body></html>");
  writeFileSync(join(assetsPath,"app.js"),"globalThis.__sislog=true;");
  const productionConfig:AppConfig={...config,environment:"production",frontendDistPath:directory};
  try{
    const app=await buildApp(productionConfig);
    const health=await app.inject({method:"GET",url:"/api/health"});
    assert.equal(health.statusCode,200);
    assert.equal(health.headers["content-type"]?.includes("application/json"),true);
    const home=await app.inject({method:"GET",url:"/"});
    assert.equal(home.statusCode,200);assert.match(home.body,/SisLog Dashboard/);
    const asset=await app.inject({method:"GET",url:"/assets/app.js"});
    assert.equal(asset.statusCode,200);assert.match(asset.body,/__sislog/);
    const settings=await app.inject({method:"GET",url:"/settings"});
    assert.equal(settings.statusCode,200);assert.match(settings.body,/SisLog Dashboard/);
    const warehouse=await app.inject({method:"GET",url:"/warehouse"});
    assert.equal(warehouse.statusCode,200);assert.match(warehouse.body,/SisLog Dashboard/);
    const history=await app.inject({method:"GET",url:"/history"});
    assert.equal(history.statusCode,200);assert.match(history.body,/SisLog Dashboard/);
    const missingAsset=await app.inject({method:"GET",url:"/assets/missing.js"});
    assert.equal(missingAsset.statusCode,404);assert.equal(missingAsset.headers["content-type"]?.includes("application/json"),true);
    const missingFavicon=await app.inject({method:"GET",url:"/favicon.ico"});
    assert.equal(missingFavicon.statusCode,404);assert.equal(missingFavicon.headers["content-type"]?.includes("application/json"),true);
    const missingApi=await app.inject({method:"GET",url:"/api/non-esiste"});
    assert.equal(missingApi.statusCode,404);
    assert.equal(missingApi.headers["content-type"]?.includes("application/json"),true);
    assert.equal(missingApi.json<{error:{code:string}}>().error.code,"RESOURCE_NOT_FOUND");
    await app.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("in produzione rifiuta una cartella frontend assente o senza index.html",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"sislog-invalid-frontend-"));
  try{
    await assert.rejects(()=>buildApp({...config,environment:"production",frontendDistPath:join(directory,"assente")}),/FRONTEND_DIST_PATH non esiste/);
    await assert.rejects(()=>buildApp({...config,environment:"production",frontendDistPath:directory}),/non contiene index\.html/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("il rientro dopo due giorni lavorativi salta il fine settimana",()=>{
  assert.equal(addBusinessDays("2026-08-03T10:00:00.000Z",2),"2026-08-05T10:00:00.000Z");
  assert.equal(addBusinessDays("2026-08-06T10:00:00.000Z",2),"2026-08-10T10:00:00.000Z");
  assert.equal(addBusinessDays("2026-08-07T10:00:00.000Z",2),"2026-08-11T10:00:00.000Z");
});

test("le spedizioni future manuali sono persistenti e non creano carichi operativi",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"sislog-shipments-"));
  const databasePath=join(directory,"shipments.sqlite");
  try{
    const first=await buildApp({...config,databasePath});
    const created=await first.inject({method:"POST",url:"/api/shipments",payload:{commessa:"265700",cliente:"ROSSI",camion:"C1",plannedLoadingDate:"2026-09-10",plannedDepartureDate:"2026-09-12",transportType:"BILICO_ESSEPI",trailerId:null,carrierId:null,notes:"Pianificazione futura"}});
    assert.equal(created.statusCode,200);assert.equal(created.json<{shipmentStatus:string;trailerId:string|null}>().shipmentStatus,"PIANIFICATA");assert.equal(created.json<{trailerId:string|null}>().trailerId,null);
    const pickup=await first.inject({method:"POST",url:"/api/shipments",payload:{commessa:"265701",cliente:"BIANCHI",camion:"C2",plannedDepartureDate:null,transportType:"RITIRA_CLIENTE",trailerId:null,carrierId:null}});assert.equal(pickup.statusCode,200);
    assert.deepEqual((await first.inject({method:"GET",url:"/api/loads"})).json(),[]);
    const trailer=(await first.inject({method:"GET",url:"/api/trailers"})).json<Array<{id:string}>>()[0]!;const reserved=await first.inject({method:"POST",url:`/api/trailers/${trailer.id}/reservation`,payload:{commessa:"265700",cliente:"ROSSI",carico:"C1",plannedDepartureDate:"2026-09-12"}});assert.equal(reserved.statusCode,200);const assigned=(await first.inject({method:"GET",url:"/api/shipments"})).json<Array<{commessa:string;trailerId:string|null}>>().find(item=>item.commessa==="265700");assert.equal(assigned?.trailerId,trailer.id);
    await first.close();
    const second=await buildApp({...config,databasePath});
    const shipments=(await second.inject({method:"GET",url:"/api/shipments"})).json<Array<{commessa:string;camion:string|null}>>();
    assert.equal(shipments.length,2);assert.equal(shipments[0]?.commessa,"265700");assert.equal(shipments[0]?.camion,"C1");
    await second.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("elimina solo una pianificazione non partita e conserva carico ed elementi",async()=>{
  const app=await buildApp(config);
  const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:{...importedLoad([importedPanel("PLAN-1","C1")]),commessa:"PLAN-DELETE"}})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
  const plan=(await app.inject({method:"POST",url:"/api/shipments",payload:{loadId:load.id,commessa:"PLAN-DELETE",cliente:"Cliente Test",camion:"C1",plannedDepartureDate:"2026-09-20",transportType:"RITIRA_CLIENTE",trailerId:null,carrierId:null}})).json<{id:string}>();
  const removed=await app.inject({method:"DELETE",url:`/api/shipments/${plan.id}`});
  assert.equal(removed.statusCode,200);assert.equal(removed.json<{success:boolean}>().success,true);
  const shipments=(await app.inject({method:"GET",url:"/api/shipments"})).json<Array<{id:string;persisted:boolean;loadId:string}>>();
  assert.equal(shipments.some(item=>item.id===plan.id),false);assert.equal(shipments.some(item=>item.loadId===load.id&&!item.persisted),true);
  const untouched=(await app.inject({method:"GET",url:`/api/loads/${load.id}`})).json<{id:string;pannelli:Array<{id:string}>}>();
  assert.equal(untouched.id,load.id);assert.deepEqual(untouched.pannelli.map(item=>item.id),load.pannelli.map(item=>item.id));
  assert.equal((await app.inject({method:"DELETE",url:`/api/loads/${load.id}`})).statusCode,204);
  await app.close();
});

test("rifiuta la cancellazione di una pianificazione con partenza consolidata",async()=>{
  const app=await buildApp(config);
  const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
  const carrier=(await app.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string}>>()[0]!;
  const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:{...importedLoad([importedPanel("PLAN-SHIPPED","C2")]),commessa:"PLAN-CONSOLIDATED"}})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
  await app.inject({method:"PATCH",url:`/api/panels/${load.pannelli[0]!.id}/close-single`,payload:{operatorId:operator.id}});
  const plan=(await app.inject({method:"POST",url:"/api/shipments",payload:{loadId:load.id,commessa:"PLAN-CONSOLIDATED",cliente:"Cliente Test",camion:"C2",plannedDepartureDate:"2026-09-20",transportType:"RITIRA_CLIENTE",trailerId:null,carrierId:null}})).json<{id:string}>();
  const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"TRASPORTATORE",carrierId:carrier.id}})).json<{id:string}>();
  await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:load.pannelli[0]!.id,operatorId:operator.id}});
  await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/ship`,payload:{carrierId:carrier.id}});
  const blocked=await app.inject({method:"DELETE",url:`/api/shipments/${plan.id}`});
  assert.equal(blocked.statusCode,409);assert.equal(blocked.json<{error:{code:string}}>().error.code,"SHIPMENT_CONSOLIDATED");
  assert.equal((await app.inject({method:"DELETE",url:`/api/loads/${load.id}`})).statusCode,409);
  assert.equal((await app.inject({method:"DELETE",url:"/api/orders/PLAN-CONSOLIDATED"})).statusCode,409);
  assert.equal((await app.inject({method:"GET",url:"/api/shipments"})).json<Array<{id:string}>>().some(item=>item.id===plan.id),true);
  await app.close();
});

test("la prima partenza prevista resta originale e le modifiche sono persistenti",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"shipment-departure-history-"));const persistentConfig={...config,databasePath:join(directory,"shipment-history.sqlite")};
  try{const first=await buildApp(persistentConfig);
    const base={commessa:"HISTORY-1",cliente:"Cliente",camion:"C1",transportType:"BILICO_ESSEPI",trailerId:null,carrierId:null};
    const created=(await first.inject({method:"POST",url:"/api/shipments",payload:{...base,plannedDepartureDate:"2026-08-29"}})).json<{id:string;plannedDepartureDate:string;originalPlannedDepartureDate:string;plannedDepartureDateChangedAt:string|null}>();assert.equal(created.plannedDepartureDate,"2026-08-29");assert.equal(created.originalPlannedDepartureDate,"2026-08-29");assert.equal(created.plannedDepartureDateChangedAt,null);
    const changed=(await first.inject({method:"PUT",url:`/api/shipments/${created.id}`,payload:{...base,plannedDepartureDate:"2026-08-31"}})).json<{originalPlannedDepartureDate:string;plannedDepartureDateChangedAt:string|null}>();assert.equal(changed.originalPlannedDepartureDate,"2026-08-29");assert.ok(changed.plannedDepartureDateChangedAt);
    const changedAgain=(await first.inject({method:"PUT",url:`/api/shipments/${created.id}`,payload:{...base,plannedDepartureDate:"2026-09-02"}})).json<{plannedDepartureDate:string;originalPlannedDepartureDate:string;plannedDepartureDateChangedAt:string|null}>();assert.equal(changedAgain.plannedDepartureDate,"2026-09-02");assert.equal(changedAgain.originalPlannedDepartureDate,"2026-08-29");assert.ok(changedAgain.plannedDepartureDateChangedAt);
    const laterBase={commessa:"HISTORY-2",cliente:"Cliente",camion:"C2",transportType:"RITIRA_CLIENTE",trailerId:null,carrierId:null};const withoutDate=(await first.inject({method:"POST",url:"/api/shipments",payload:{...laterBase,plannedDepartureDate:null}})).json<{id:string}>();const firstDate=(await first.inject({method:"PUT",url:`/api/shipments/${withoutDate.id}`,payload:{...laterBase,plannedDepartureDate:"2026-09-10"}})).json<{originalPlannedDepartureDate:string;plannedDepartureDateChangedAt:string|null}>();assert.equal(firstDate.originalPlannedDepartureDate,"2026-09-10");assert.equal(firstDate.plannedDepartureDateChangedAt,null);
    await first.close();const second=await buildApp(persistentConfig);const restored=(await second.inject({method:"GET",url:"/api/shipments"})).json<Array<{commessa:string;plannedDepartureDate:string;originalPlannedDepartureDate:string;plannedDepartureDateChangedAt:string|null}>>().find(item=>item.commessa==="HISTORY-1")!;assert.equal(restored.plannedDepartureDate,"2026-09-02");assert.equal(restored.originalPlannedDepartureDate,"2026-08-29");assert.ok(restored.plannedDepartureDateChangedAt);await second.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("le prenotazioni manuali persistono e vengono convertite nel carico reale",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"manual-transport-"));const persistentConfig={...config,databasePath:join(directory,"transport.sqlite")};
  try{const first=await buildApp(persistentConfig);const trailers=(await first.inject({method:"GET",url:"/api/trailers"})).json<Array<{id:string}>>(),operator=(await first.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;const trailer=trailers[0]!,freeTrailer=trailers[1]!;
    const shipment=(await first.inject({method:"POST",url:"/api/shipments",payload:{commessa:"COMM-TEST",cliente:"Cliente Test",camion:"C1",plannedDepartureDate:"2026-09-15",transportType:"BILICO_ESSEPI",trailerId:null,carrierId:null}})).json<{id:string}>();
    const reserved=await first.inject({method:"POST",url:`/api/trailers/${trailer.id}/reservation`,payload:{commessa:"COMM-TEST",cliente:"Cliente Test",carico:"C1",plannedDepartureDate:"2026-09-15"}});const reservation=reserved.json<{status:string;source:string;assignmentId:string;plannedDepartureDate:string}>();assert.equal(reservation.status,"IMPEGNATO");assert.equal(reservation.source,"MANUAL");assert.equal(reservation.plannedDepartureDate,"2026-09-15");
    assert.equal((await first.inject({method:"POST",url:`/api/trailers/${trailer.id}/reservation`,payload:{commessa:"ALTRO",cliente:"Cliente",carico:"C9"}})).statusCode,409);
    const edited=await first.inject({method:"PUT",url:`/api/trailers/${trailer.id}/reservation`,payload:{commessa:"COMM-TEST",cliente:"Cliente Test aggiornato",carico:"C1",plannedDepartureDate:"2026-09-16"}});const editedReservation=edited.json<{cliente:string;plannedDepartureDate:string}>();assert.equal(editedReservation.cliente,"Cliente Test aggiornato");assert.equal(editedReservation.plannedDepartureDate,"2026-09-15");
    const updatedShipment=await first.inject({method:"PUT",url:`/api/shipments/${shipment.id}`,payload:{commessa:"COMM-TEST",cliente:"Cliente Test",camion:"C1",plannedDepartureDate:"2026-09-16",transportType:"BILICO_ESSEPI",trailerId:null,carrierId:null}});assert.equal(updatedShipment.statusCode,200);assert.equal((await first.inject({method:"GET",url:"/api/transports"})).json<Array<{id:string;plannedDepartureDate:string|null}>>().find(item=>item.id===trailer.id)?.plannedDepartureDate,"2026-09-16");
    assert.equal((await first.inject({method:"PUT",url:`/api/trailers/${trailer.id}/reservation`,payload:{commessa:"COMM-TEST",cliente:"Cliente Test",carico:"C1",plannedDepartureDate:"2026-02-30"}})).statusCode,400);
    await first.inject({method:"POST",url:`/api/trailers/${freeTrailer.id}/reservation`,payload:{commessa:"LIBERA",cliente:"Cliente",carico:"C2"}});assert.equal((await first.inject({method:"DELETE",url:`/api/trailers/${freeTrailer.id}/reservation`})).json<{status:string}>().status,"DISPONIBILE");
    await first.close();const second=await buildApp(persistentConfig);const persisted=(await second.inject({method:"GET",url:"/api/transports"})).json<Array<{id:string;source:string;assignmentId:string;plannedDepartureDate:string|null}>>().find(item=>item.id===trailer.id)!;assert.equal(persisted.source,"MANUAL");assert.equal(persisted.assignmentId,reservation.assignmentId);assert.equal(persisted.plannedDepartureDate,"2026-09-16");
    const load=(await second.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("M1","C1")])})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;await second.inject({method:"PATCH",url:`/api/panels/${load.pannelli[0]!.id}/close-single`,payload:{operatorId:operator.id}});const session=(await second.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"RIMORCHIO_ESSEPI",trailerId:trailer.id}})).json<{id:string}>();const converted=(await second.inject({method:"GET",url:"/api/transports"})).json<Array<{id:string;source:string;assignmentId:string;plannedDepartureDate:string|null}>>().find(item=>item.id===trailer.id)!;assert.equal(converted.source,"LOAD");assert.equal(converted.assignmentId,reservation.assignmentId);assert.equal(converted.plannedDepartureDate,"2026-09-16");
    await second.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:load.pannelli[0]!.id,operatorId:operator.id}});await second.inject({method:"POST",url:`/api/loading-sessions/${session.id}/complete`});const loaded=(await second.inject({method:"GET",url:"/api/transports"})).json<Array<{id:string;status:string;plannedDepartureDate:string|null}>>().find(item=>item.id===trailer.id)!;assert.equal(loaded.status,"CARICATO");assert.equal(loaded.plannedDepartureDate,"2026-09-16");const rescheduled=await second.inject({method:"PATCH",url:`/api/trailers/${trailer.id}/planned-departure`,payload:{plannedDepartureDate:"2026-09-18"}});assert.equal(rescheduled.statusCode,200);assert.equal(rescheduled.json<{plannedDepartureDate:string}>().plannedDepartureDate,"2026-09-16");assert.equal((await second.inject({method:"GET",url:"/api/transports"})).json<Array<{id:string;plannedDepartureDate:string|null}>>().find(item=>item.id===trailer.id)?.plannedDepartureDate,"2026-09-16");assert.equal((await second.inject({method:"DELETE",url:`/api/trailers/${trailer.id}/reservation`})).statusCode,409);await second.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("revisione e fuori servizio dei rimorchi sono persistenti",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"transport-settings-"));const persistentConfig={...config,databasePath:join(directory,"transport.sqlite")};
  try{const first=await buildApp(persistentConfig);const trailer=(await first.inject({method:"GET",url:"/api/trailers"})).json<Array<{id:string}>>()[0]!;
    const inspection=await first.inject({method:"PATCH",url:`/api/trailers/${trailer.id}/inspection`,payload:{nextInspectionDate:"2026-09-01"}});assert.equal(inspection.statusCode,200);
    const disabled=await first.inject({method:"POST",url:`/api/trailers/${trailer.id}/disable`,payload:{reason:"Manutenzione",notes:"Pneumatici"}});assert.equal(disabled.json<{status:string}>().status,"FUORI_SERVIZIO");await first.close();
    const second=await buildApp(persistentConfig);const restored=(await second.inject({method:"GET",url:"/api/transports"})).json<Array<{id:string;status:string;nextInspectionDate:string;disabledReason:string}>>().find(item=>item.id===trailer.id)!;assert.equal(restored.status,"FUORI_SERVIZIO");assert.equal(restored.nextInspectionDate,"2026-09-01");assert.match(restored.disabledReason,/Manutenzione/);
    const enabled=await second.inject({method:"POST",url:`/api/trailers/${trailer.id}/enable`});assert.equal(enabled.json<{status:string}>().status,"DISPONIBILE");await second.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("GET /api/health restituisce lo stato del servizio", async () => {
  const app = await buildApp(config);
  const result = await app.inject({ method: "GET", url: "/api/health" });
  await app.close();

  assert.equal(result.statusCode, 200);
  const health = result.json<{ status: string; service: string; version: string; timestamp: string }>();
  assert.equal(health.status, "ok");
  assert.equal(health.service, "Sistema Logistico API");
  assert.equal(health.version, "0.5.0");
  assert.equal(Number.isNaN(Date.parse(health.timestamp)), false);
});

test("una route sconosciuta usa il formato errore comune", async () => {
  const app = await buildApp(config);
  const result = await app.inject({ method: "GET", url: "/api/non-esiste" });
  await app.close();

  assert.equal(result.statusCode, 404);
  assert.equal(result.json<{ error: { code: string } }>().error.code, "RESOURCE_NOT_FOUND");
});

test("le anagrafiche sono inizializzate e consentono la rimozione di operatori mai utilizzati", async () => {
  const app = await buildApp(config);
  for (const path of ["operators","trailers","carriers"]) {
    const list = await app.inject({ method:"GET", url:`/api/${path}` });
    assert.equal(list.statusCode,200);
    assert.ok(list.json<unknown[]>().length>0);
  }

  const created = await app.inject({method:"POST",url:"/api/operators",payload:{code:"ZZ",name:"Operatore Test",active:true,sortOrder:99}});
  assert.equal(created.statusCode,201);
  const operator=created.json<{id:string;active:boolean}>();
  const updated=await app.inject({method:"PUT",url:`/api/operators/${operator.id}`,payload:{code:"ZZ",name:"Operatore Aggiornato",active:true,sortOrder:99}});
  assert.equal(updated.statusCode,200);
  const deleted=await app.inject({method:"DELETE",url:`/api/operators/${operator.id}`});
  assert.equal(deleted.statusCode,200);
  assert.equal(deleted.json<{active:boolean}>().active,false);
  const list=await app.inject({method:"GET",url:"/api/operators"});
  assert.equal(list.json<Array<{id:string;active:boolean}>>().find(item=>item.id===operator.id),undefined);
  await app.close();
});

test("PATCH disattiva e riattiva tutte le anagrafiche", async()=>{
  const app=await buildApp(config);
  for(const path of ["operators","trailers","carriers"]){
    const list=await app.inject({method:"GET",url:`/api/${path}`});
    const record=list.json<Array<{id:string;active:boolean}>>()[0];
    assert.ok(record);
    const disabled=await app.inject({method:"PATCH",url:`/api/${path}/${record.id}`,payload:{active:false}});
    assert.equal(disabled.statusCode,200);
    assert.equal(disabled.json<{active:boolean}>().active,false);
    const enabled=await app.inject({method:"PATCH",url:`/api/${path}/${record.id}`,payload:{active:true}});
    assert.equal(enabled.statusCode,200);
    assert.equal(enabled.json<{active:boolean}>().active,true);
    const deleted=await app.inject({method:"DELETE",url:`/api/${path}/${record.id}`});
    assert.equal(deleted.statusCode,200);
    if(path==="trailers"){const scrapped=(await app.inject({method:"GET",url:"/api/trailers"})).json<Array<{id:string;active:boolean;archived:boolean}>>().find(item=>item.id===record.id);assert.ok(scrapped);assert.equal(scrapped.active,false);assert.equal(scrapped.archived,true);assert.equal((await app.inject({method:"GET",url:"/api/transports"})).json<Array<{id:string}>>().some(item=>item.id===record.id),false);}
    else assert.equal(deleted.json<{active:boolean}>().active,false);
  }
  const invalid=await app.inject({method:"PATCH",url:"/api/carriers/id-inesistente",payload:{active:false}});
  assert.equal(invalid.statusCode,404);
  assert.equal(invalid.json<{error:{code:string}}>().error.code,"RESOURCE_NOT_FOUND");
  await app.close();
});

test("aggiunta e modifica funzionano per tutte le anagrafiche",async()=>{
  const app=await buildApp(config);
  const cases=[
    {path:"operators",create:{code:"NX",name:"Nuovo Operatore",active:true,sortOrder:90},update:{code:"NX",name:"Operatore Modificato",active:true,sortOrder:91}},
    {path:"trailers",create:{plate:"TEST-01",description:"Nuovo rimorchio",active:true,sortOrder:90},update:{plate:"TEST-01",description:"Rimorchio modificato",active:true,sortOrder:91}},
    {path:"carriers",create:{name:"Nuovo Trasportatore",active:true,sortOrder:90},update:{name:"Trasportatore Modificato",active:true,sortOrder:91}},
  ];
  for(const item of cases){
    const created=await app.inject({method:"POST",url:`/api/${item.path}`,payload:item.create});
    assert.equal(created.statusCode,201);
    const id=created.json<{id:string}>().id;
    const updated=await app.inject({method:"PUT",url:`/api/${item.path}/${id}`,payload:item.update});
    assert.equal(updated.statusCode,200);
    assert.equal(updated.json<{sortOrder:number}>().sortOrder,91);
  }
  await app.close();
});

test("le nuove anagrafiche trasporti supportano CRUD logico senza valori hardcodati",async()=>{
  const app=await buildApp(config);
  for(const item of [
    {path:"client-vehicle-types",name:"Mezzo cliente test",updated:"Mezzo cliente aggiornato"},
    {path:"third-party-transport-modes",name:"Modalità terzi test",updated:"Modalità terzi aggiornata"},
  ]){
    const initial=await app.inject({method:"GET",url:`/api/${item.path}`});
    assert.equal(initial.statusCode,200);assert.equal(initial.json<unknown[]>().length,0);
    const created=await app.inject({method:"POST",url:`/api/${item.path}`,payload:{name:item.name,active:true,sortOrder:0}});
    assert.equal(created.statusCode,201);const id=created.json<{id:string}>().id;
    const updated=await app.inject({method:"PUT",url:`/api/${item.path}/${id}`,payload:{name:item.updated,active:true,sortOrder:1}});
    assert.equal(updated.statusCode,200);assert.equal(updated.json<{name:string}>().name,item.updated);
    const disabled=await app.inject({method:"PATCH",url:`/api/${item.path}/${id}`,payload:{active:false}});
    assert.equal(disabled.statusCode,200);assert.equal(disabled.json<{active:boolean}>().active,false);
    const enabled=await app.inject({method:"PATCH",url:`/api/${item.path}/${id}`,payload:{active:true}});
    assert.equal(enabled.json<{active:boolean}>().active,true);
    const logicallyDeleted=await app.inject({method:"DELETE",url:`/api/${item.path}/${id}`});
    assert.equal(logicallyDeleted.statusCode,200);assert.equal(logicallyDeleted.json<{active:boolean}>().active,false);
  }
  await app.close();
});

test("le nuove anagrafiche trasporti persistono e non modificano i trasportatori esistenti",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"transport-registries-"));
  const persistentConfig={...config,databasePath:join(directory,"settings.sqlite")};
  try{
    const first=await buildApp(persistentConfig);
    const carriersBefore=(await first.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string;name:string}>>();
    const vehicle=(await first.inject({method:"POST",url:"/api/client-vehicle-types",payload:{name:"Bilico cliente",active:true,sortOrder:0}})).json<{id:string}>();
    const mode=(await first.inject({method:"POST",url:"/api/third-party-transport-modes",payload:{name:"Servizio esterno",active:true,sortOrder:0}})).json<{id:string}>();
    await first.close();
    const restarted=await buildApp(persistentConfig);
    assert.ok((await restarted.inject({method:"GET",url:"/api/client-vehicle-types"})).json<Array<{id:string}>>().some(item=>item.id===vehicle.id));
    assert.ok((await restarted.inject({method:"GET",url:"/api/third-party-transport-modes"})).json<Array<{id:string}>>().some(item=>item.id===mode.id));
    assert.deepEqual((await restarted.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string;name:string}>>().map(({id,name})=>({id,name})),carriersBefore.map(({id,name})=>({id,name})));
    await restarted.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("le pianificazioni validano macro-categoria, dettaglio opzionale e voci disattivate",async()=>{
  const app=await buildApp(config);
  try{
    const carrier=(await app.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string;name:string}>>()[0]!;
    const vehicle=(await app.inject({method:"POST",url:"/api/client-vehicle-types",payload:{name:"Motrice",active:true,sortOrder:0}})).json<{id:string}>();
    const thirdParty=(await app.inject({method:"POST",url:"/api/third-party-transport-modes",payload:{name:"Vettore dedicato",active:true,sortOrder:0}})).json<{id:string}>();
    const bilico=await app.inject({method:"POST",url:"/api/shipments",payload:{commessa:"MODE-B",cliente:"Cliente",camion:"C1",transportType:"BILICO_ESSEPI",transportDetailId:carrier.id}});
    assert.equal(bilico.statusCode,200);assert.equal(bilico.json<{transportDetailLabel:string}>().transportDetailLabel,carrier.name);
    const pickup=await app.inject({method:"POST",url:"/api/shipments",payload:{commessa:"MODE-R",cliente:"Cliente",camion:"C1",transportType:"RITIRA_CLIENTE",transportDetailId:vehicle.id}});
    assert.equal(pickup.statusCode,200);assert.equal(pickup.json<{transportDetailLabel:string}>().transportDetailLabel,"Motrice");
    const third=await app.inject({method:"POST",url:"/api/shipments",payload:{commessa:"MODE-T",cliente:"Cliente",camion:"C1",transportType:"TERZI_PER_ESSEPI",transportDetailId:thirdParty.id}});
    assert.equal(third.statusCode,200);assert.equal(third.json<{transportDetailLabel:string}>().transportDetailLabel,"Vettore dedicato");
    assert.equal((await app.inject({method:"POST",url:"/api/shipments",payload:{commessa:"MODE-OPTIONAL",cliente:"Cliente",camion:"C1",transportType:"TERZI_PER_ESSEPI"}})).statusCode,200);
    assert.equal((await app.inject({method:"POST",url:"/api/shipments",payload:{commessa:"MODE-BAD",cliente:"Cliente",camion:"C1",transportType:"RITIRA_CLIENTE",transportDetailId:carrier.id}})).statusCode,400);
    await app.inject({method:"PATCH",url:`/api/client-vehicle-types/${vehicle.id}`,payload:{active:false}});
    const pickupRecord=pickup.json<{id:string;transportDetailId:string}>();
    assert.equal((await app.inject({method:"PUT",url:`/api/shipments/${pickupRecord.id}`,payload:{commessa:"MODE-R",cliente:"Cliente",camion:"C1",transportType:"RITIRA_CLIENTE",transportDetailId:vehicle.id}})).statusCode,200);
    assert.equal((await app.inject({method:"POST",url:"/api/shipments",payload:{commessa:"MODE-INACTIVE",cliente:"Cliente",camion:"C1",transportType:"RITIRA_CLIENTE",transportDetailId:vehicle.id}})).statusCode,400);
    const changed=await app.inject({method:"PUT",url:`/api/shipments/${bilico.json<{id:string}>().id}`,payload:{commessa:"MODE-B",cliente:"Cliente",camion:"C1",transportType:"RITIRA_CLIENTE",transportDetailId:null}});
    assert.equal(changed.statusCode,200);assert.equal(changed.json<{transportDetailId:null}>().transportDetailId,null);
  }finally{await app.close();}
});

test("la disattivazione rimane persistente dopo il riavvio",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"sistema-logistico-"));
  const persistentConfig={...config,databasePath:join(directory,"settings.sqlite")};
  try{
    const firstApp=await buildApp(persistentConfig);
    const list=await firstApp.inject({method:"GET",url:"/api/carriers"});
    const carrier=list.json<Array<{id:string}>>()[0];assert.ok(carrier);
    await firstApp.inject({method:"PATCH",url:`/api/carriers/${carrier.id}`,payload:{active:false}});
    await firstApp.close();
    const restartedApp=await buildApp(persistentConfig);
    const persisted=await restartedApp.inject({method:"GET",url:"/api/carriers"});
    assert.equal(persisted.json<Array<{id:string;active:boolean}>>().find(item=>item.id===carrier.id)?.active,false);
    await restartedApp.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("CPR viene inizializzato una sola volta, modificato e mantenuto dopo il riavvio",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"operational-settings-"));
  const persistentConfig={...config,databasePath:join(directory,"settings.sqlite")};
  try{
    const first=await buildApp(persistentConfig);
    const initial=await first.inject({method:"GET",url:"/api/operational-settings"});
    assert.equal(initial.statusCode,200);
    const cpr=initial.json<Array<{key:string;value:string}>>().filter(item=>item.key==="CPR");
    assert.equal(cpr.length,1);
    assert.equal(cpr[0]?.value,"0809-CPR-1049");
    const updated=await first.inject({method:"PUT",url:"/api/operational-settings/CPR",payload:{key:"CPR",value:"0809-CPR-TEST",description:"CPR",active:true,sortOrder:3}});
    assert.equal(updated.statusCode,200);
    await first.close();
    const restarted=await buildApp(persistentConfig);
    const persisted=await restarted.inject({method:"GET",url:"/api/operational-settings"});
    const persistedCpr=persisted.json<Array<{key:string;value:string}>>().filter(item=>item.key==="CPR");
    assert.equal(persistedCpr.length,1);
    assert.equal(persistedCpr[0]?.value,"0809-CPR-TEST");
    await restarted.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("il preflight CORS consente PATCH dal frontend Vite",async()=>{
  const app=await buildApp(config);
  const response=await app.inject({method:"OPTIONS",url:"/api/carriers/id",headers:{origin:"http://localhost:5173","access-control-request-method":"PATCH","access-control-request-headers":"content-type"}});
  assert.equal(response.statusCode,204);
  assert.match(response.headers["access-control-allow-methods"]??"",/PATCH/);
  assert.equal(response.headers["access-control-allow-origin"],"http://localhost:5173");
  await app.close();
});

const importedPanel=(numeroPannello:string,camion:string,peso=10)=>({numeroPannello,numeroCliente:"NC",numeroMasterPanel:"MP",camion,lato1:"A",lato2:"B",tipoPannello:"X",quantita:1,spessore:100,lunghezza:1200,altezza:2400,superficie:2.88,volume:0.288,peso});
const importedLoad=(panels:ReturnType<typeof importedPanel>[],removeMissing?:boolean)=>({commessa:"COMM-TEST",cliente:"Cliente Test",numeroCliente:"C-01",riferimentoOrdine:"RIF-01",...(removeMissing===undefined?{}:{removeMissing}),pannelli:panels});

test("rimorchio da Carico camion: stessa reservation, unicità multiutente, disimpegno e cambio modalità protetto",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"loading-reserve-")),databasePath=join(dir,"test.sqlite");
  const app=await buildApp({...config,databasePath}),other=await buildApp({...config,databasePath});
  const db=new DatabaseSync(databasePath);
  const call=(method:"GET"|"POST"|"PATCH"|"DELETE",url:string,payload?:object)=>app.inject({method,url,...(payload?{payload}:{})});
  try{
    const loads=(await call("POST","/api/loads/import",importedLoad([importedPanel("RS1","C1"),importedPanel("RS2","C2")]))).json<Array<{id:string;camion:string;pannelli:Array<{id:string}>}>>();
    const first=loads.find(l=>l.camion==="C1")!,second=loads.find(l=>l.camion==="C2")!;
    const trailers=(await call("GET","/api/transports")).json<Array<{id:string;status:string;active:boolean}>>().filter(t=>t.status==="DISPONIBILE"&&t.active);
    const a=trailers[0]!,b=trailers[1]!;
    const operator=(await call("GET","/api/operators")).json<Array<{id:string}>>()[0]!;
    const base={operatorId:operator.id,destinationType:"RIMORCHIO_ESSEPI",transportMode:"BILICO_ESSEPI"};
    const session=(await call("POST",`/api/loads/${first.id}/loading-session`,base)).json<{id:string;carrierId:null;trailerId:null}>();
    assert.equal(session.carrierId,null);assert.equal(session.trailerId,null);
    const reservation=(load:typeof first)=>({loadId:load.id,commessa:"COMM-TEST",cliente:"Cliente Test",carico:load.camion});
    const snapshot=()=>JSON.stringify(Object.fromEntries(["Loads","Panels","LoadingSessions","LoadingUnits","OperationalEvents","ShipmentPlans","TransportAssignments"].map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY id`).all()])));
    const before=snapshot();assert.equal((await call("GET","/api/transports")).json<Array<{id:string;status:string}>>().find(t=>t.id===a.id)!.status,"DISPONIBILE");assert.equal(snapshot(),before,"list and selection do not assign");
    const result=await call("POST",`/api/trailers/${a.id}/reservation`,reservation(first));assert.equal(result.statusCode,200,result.body);
    const assigned=result.json<{assignmentId:string;source:string;loadId:string;status:string;canRelease:boolean}>();assert.equal(assigned.source,"LOAD");assert.equal(assigned.loadId,first.id);assert.equal(assigned.status,"IMPEGNATO");assert.equal(assigned.canRelease,true);
    const saved=(await call("GET",`/api/loads/${first.id}/loading-session`)).json();assert.equal(saved.trailerId,a.id);assert.equal(saved.carrierId,null);
    const same=(await call("GET","/api/transports")).json<Array<{id:string;assignmentId:string}>>().find(t=>t.id===a.id)!;assert.equal(same.assignmentId,assigned.assignmentId);
    const occupied=snapshot();
    assert.equal((await other.inject({method:"POST",url:`/api/trailers/${a.id}/reservation`,payload:reservation(second)})).statusCode,409);
    assert.equal((await call("POST",`/api/trailers/${b.id}/reservation`,reservation(first))).json().error.code,"LOAD_ALREADY_ASSIGNED");assert.equal(snapshot(),occupied);
    for(const transportMode of ["RITIRA_CLIENTE","TERZI_PER_ESSEPI",null]){
      const switched=await call("PATCH",`/api/loading-sessions/${session.id}`,{...base,transportMode});assert.equal(switched.statusCode,409);assert.equal(switched.json().error.code,"TRAILER_RELEASE_REQUIRED");assert.equal(snapshot(),occupied);
    }
    const release=await call("DELETE",`/api/trailers/${a.id}/reservation?assignmentId=${assigned.assignmentId}`);assert.equal(release.statusCode,200);assert.equal(release.json().status,"DISPONIBILE");
    assert.equal((await call("PATCH",`/api/loading-sessions/${session.id}`,{...base,transportMode:"RITIRA_CLIENTE"})).statusCode,200);
    const customer=snapshot();assert.equal((await call("POST",`/api/trailers/${a.id}/reservation`,reservation(first))).statusCode,409);assert.equal(snapshot(),customer);
    assert.equal((await call("PATCH",`/api/loading-sessions/${session.id}`,base)).statusCode,200);
    // Reservation also precedes session creation; subsequent adoption keeps its ID.
    const noSession=await call("POST",`/api/trailers/${b.id}/reservation`,reservation(second));assert.equal(noSession.statusCode,200);
    const adopted=(await call("POST",`/api/loads/${second.id}/loading-session`,base)).json<{id:string;trailerId:string}>();assert.equal(adopted.trailerId,b.id);
    assert.equal(db.prepare("SELECT id FROM TransportAssignments WHERE trailerId=? AND releasedAt IS NULL").get(b.id)!.id,noSession.json().assignmentId);
    assert.equal((await call("DELETE",`/api/trailers/${b.id}/reservation?assignmentId=${noSession.json().assignmentId}`)).statusCode,200);
    // Both clients loaded the same availability list before competing.
    const races=await Promise.all([call("POST",`/api/trailers/${a.id}/reservation`,reservation(first)),other.inject({method:"POST",url:`/api/trailers/${a.id}/reservation`,payload:reservation(second)})]);
    assert.deepEqual(races.map(r=>r.statusCode).sort(),[200,409]);
    const winner=races[0]!.statusCode===200?first:second;
    const active=db.prepare("SELECT * FROM TransportAssignments WHERE trailerId=? AND releasedAt IS NULL").all(a.id);assert.equal(active.length,1);assert.equal(active[0]!.loadId,winner.id);
    // A released empty session can adopt a new assignment without requiring a carrier.
    const winningSession=winner.id===first.id?session:(await call("POST",`/api/loads/${winner.id}/loading-session`,base)).json<{id:string}>();
    await call("PATCH",`/api/panels/${winner.pannelli[0]!.id}/close-single`,{operatorId:operator.id});
    assert.equal((await call("POST",`/api/loading-sessions/${winningSession.id}/units`,{operatorId:operator.id,unitType:"PANEL",panelId:winner.pannelli[0]!.id})).statusCode,200);
    const physical=snapshot();assert.equal((await call("DELETE",`/api/trailers/${a.id}/reservation?assignmentId=${String(active[0]!.id)}`)).statusCode,409);
    assert.equal((await call("PATCH",`/api/loading-sessions/${winningSession.id}`,{...base,transportMode:"RITIRA_CLIENTE"})).statusCode,409);assert.equal(snapshot(),physical);
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length,0);
  }finally{db.close();await other.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});

for(const mode of ["RITIRA_CLIENTE","RITIRA_CLIENTE_EMPTY","BILICO_ESSEPI","TERZI_PER_ESSEPI"] as const)test(`partenza Dashboard: ${mode}, 24/24, dati effettivi, storico e rollback`,async()=>{
 const dir=mkdtempSync(join(tmpdir(),"dashboard-departure-")),databasePath=join(dir,"test.sqlite"),app=await buildApp({...config,databasePath}),db=new DatabaseSync(databasePath);
 try{
  const call=async(method:"GET"|"POST"|"PATCH",url:string,payload?:unknown)=>app.inject({method,url,...(payload===undefined?{}:{payload:payload as Record<string,unknown>})});
  const operator=(await call("GET","/api/operators")).json<Array<{id:string}>>()[0]!,carriers=(await call("GET","/api/carriers")).json<Array<{id:string}>>(),trailer=(await call("GET","/api/trailers")).json<Array<{id:string}>>()[0]!;
  const confirmOperator=(await call("POST","/api/operators",{code:"CONFIRM",name:"Operatore partenza",active:true,sortOrder:0})).json<{id:string}>();
  const detail=(await call("POST",mode==="TERZI_PER_ESSEPI"?"/api/third-party-transport-modes":"/api/client-vehicle-types",{name:"Dettaglio effettivo",active:true,sortOrder:0})).json<{id:string}>();
  const loads=(await call("POST","/api/loads/import",importedLoad([importedPanel("C1","C1"),...Array.from({length:24},(_,i)=>importedPanel(String(200+i),"C2")),importedPanel("C3","C3")]))).json<Array<{id:string;camion:string;pannelli:Array<{id:string}>}>>();
  const c1=loads.find(l=>l.camion==="C1")!,c2=loads.find(l=>l.camion==="C2")!,c3=loads.find(l=>l.camion==="C3")!;
  db.prepare("UPDATE Loads SET stato='SPEDITO' WHERE id=?").run(c1.id);db.prepare("UPDATE Panels SET stato='SPEDITO' WHERE loadId=?").run(c1.id);
  const transportMode=mode==="RITIRA_CLIENTE_EMPTY"?"RITIRA_CLIENTE":mode;
  const plan=(await call("POST","/api/shipments",{commessa:"COMM-TEST",cliente:"Cliente Test",loadId:c2.id,camion:"C2",plannedDepartureDate:"2026-10-06",transportType:mode==="BILICO_ESSEPI"?"BILICO_ESSEPI":"TERZI_PER_ESSEPI",...(mode==="BILICO_ESSEPI"?{plannedCarrierId:carriers[0]!.id}:{})})).json<{id:string}>();
  if(mode==="BILICO_ESSEPI")assert.equal((await call("POST",`/api/trailers/${trailer.id}/reservation`,{commessa:"COMM-TEST",cliente:"Cliente Test",carico:"C2"})).statusCode,200);
  const settings={operatorId:operator.id,destinationType:mode==="BILICO_ESSEPI"?"RIMORCHIO_ESSEPI":"TRASPORTATORE",transportMode,...(mode==="BILICO_ESSEPI"?{carrierId:carriers[1]!.id}:mode==="RITIRA_CLIENTE_EMPTY"?{}:{transportDetailId:detail.id})};
  const sessionResponse=await call("POST",`/api/loads/${c2.id}/loading-session`,settings);assert.equal(sessionResponse.statusCode,201,sessionResponse.body);const session=sessionResponse.json<{id:string}>();
  for(const p of c2.pannelli){db.prepare("UPDATE Panels SET stato='CARICATO' WHERE id=?").run(p.id);db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,panelId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES(?,?,'PANEL',?,'now',?,'now','now')").run(crypto.randomUUID(),session.id,p.id,operator.id);}
  const ready=await call("GET",`/api/loads/${c2.id}/loading-session`);assert.equal(ready.json().stato,"ATTESA_SPEDIZIONE");
  const tables=["Loads","Panels","Packages","LoadingSessions","LoadingUnits","OperationalEvents","ShipmentPlans","TransportAssignments"] as const;
  const snapshot=()=>Object.fromEntries(tables.map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY id`).all()])) as Record<typeof tables[number],Array<Record<string,string|number|null>>>;
  const before=snapshot(),planned=before.ShipmentPlans.find(p=>p.id===plan.id)!;
  const depart=(input:Record<string,unknown>={operatorId:confirmOperator.id})=>call("POST",`/api/shipments/${plan.id}/depart`,input);
  assert.equal((await depart({operatorId:"missing"})).statusCode,400);assert.deepEqual(snapshot(),before);
  if(mode!=="BILICO_ESSEPI"){assert.equal((await depart({operatorId:confirmOperator.id,carrierId:carriers[0]!.id})).statusCode,400);assert.deepEqual(snapshot(),before);}
  db.exec("CREATE TRIGGER reject_departure BEFORE UPDATE OF actualDepartureDate ON ShipmentPlans BEGIN SELECT RAISE(ABORT,'departure rollback'); END");
  assert.equal((await depart()).statusCode,500);assert.deepEqual(snapshot(),before);db.exec("DROP TRIGGER reject_departure");
  const unit=before.LoadingUnits.find(u=>u.loadingSessionId===session.id)!;db.prepare("UPDATE LoadingUnits SET active=0 WHERE id=?").run(unit.id!);db.prepare("UPDATE Panels SET stato='DISPONIBILE' WHERE id=?").run(unit.panelId!);
  assert.equal((await call("POST",`/api/loading-sessions/${session.id}/ship`,{operatorId:confirmOperator.id})).statusCode,409);
  db.prepare("UPDATE LoadingUnits SET active=1 WHERE id=?").run(unit.id!);db.prepare("UPDATE Panels SET stato='CARICATO' WHERE id=?").run(unit.panelId!);
  const result=await depart();assert.equal(result.statusCode,200,result.body);assert.equal(result.json().operationalStatus,"SPEDITO");assert.equal(result.json().shipmentStatus,mode==="BILICO_ESSEPI"?"IN_VIAGGIO":"CONCLUSA");
  const after=snapshot(),saved=after.LoadingSessions.find(s=>s.id===session.id)!;assert.equal(saved.stato,"SPEDITO");assert.ok(saved.shippedAt);assert.equal(saved.transportMode,transportMode);assert.equal(saved.transportDetailId,mode==="RITIRA_CLIENTE_EMPTY"||mode==="BILICO_ESSEPI"?null:detail.id);assert.equal(saved.carrierId,mode==="BILICO_ESSEPI"?carriers[1]!.id:null);assert.equal(saved.trailerId,mode==="BILICO_ESSEPI"?trailer.id:null);
  const events=after.OperationalEvents.filter(e=>e.loadId===c2.id&&e.type==="PARTENZA_CONFERMATA");assert.equal(events.length,1);assert.equal(events[0]!.operatorId,confirmOperator.id);assert.equal(events[0]!.timestamp,saved.shippedAt);
  const departedPlan=after.ShipmentPlans.find(p=>p.id===plan.id)!;assert.equal(departedPlan.actualDepartureDate,saved.shippedAt);for(const key of Object.keys(planned))if(!["actualDepartureDate","carrierId","updatedAt"].includes(key))assert.deepEqual(departedPlan[key],planned[key],key);
  assert.equal(after.Panels.filter(p=>p.loadId===c2.id&&p.stato==="SPEDITO").length,24);assert.deepEqual(after.LoadingUnits,before.LoadingUnits);
  for(const t of tables){const others=(rows:typeof before.Loads)=>rows.filter(r=>r.id===c1.id||r.id===c3.id||r.loadId===c1.id||r.loadId===c3.id);assert.deepEqual(others(after[t]),others(before[t]));}
  assert.equal((await depart()).statusCode,409);assert.deepEqual(snapshot(),after);
  assert.equal((await call("GET","/api/loading-sessions")).json<Array<{id:string;stato:string}>>().find(s=>s.id===session.id)!.stato,"SPEDITO");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
 }finally{db.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});

test("distinta: riassegnazione disponibile, protezioni operative, idempotenza e rollback",async()=>{
 const {database:db}=openSqliteDatabase(":memory:"),repository=new LoadRepository(db),service=new LoadService(repository);
 const original=importedLoad([importedPanel("S","C1"),importedPanel("L","C2"),importedPanel("A","C2"),importedPanel("B","C3"),importedPanel("R","C3")]);
 try{
  const loads=service.import(original),c1=loads.find(l=>l.camion==="C1")!,c2=loads.find(l=>l.camion==="C2")!,c3=loads.find(l=>l.camion==="C3")!;
  const a=c2.pannelli.find(p=>p.numeroPannello==="A")!,l=c2.pannelli.find(p=>p.numeroPannello==="L")!;
  db.prepare("UPDATE Loads SET stato='SPEDITO' WHERE id=?").run(c1.id);
  db.prepare("UPDATE Panels SET stato='SPEDITO' WHERE loadId=?").run(c1.id);
  db.prepare("UPDATE Panels SET stato='DISPONIBILE',scannedAt='original-scan' WHERE id=?").run(a.id);
  db.prepare("UPDATE Panels SET stato='CARICATO' WHERE id=?").run(l.id);
  db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,carrierId,startedAt,createdAt,updatedAt) VALUES('session',?,'IN_CARICO','OP','TRASPORTATORE','CARRIER','now','now','now')").run(c2.id);
  db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,panelId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES('unit','session','PANEL',?,'now','OP','now','now')").run(l.id);
  const snapshot=()=>Object.fromEntries(["Loads","Panels","LoadingSessions","LoadingUnits","OperationalEvents"].map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY id`).all()]));
  const shippedBefore=db.prepare("SELECT * FROM Loads WHERE id=?").get(c1.id),loadedBefore=db.prepare("SELECT * FROM Panels WHERE id=?").get(l.id),unitBefore=db.prepare("SELECT * FROM LoadingUnits").all();
  const updated={...original,pannelli:original.pannelli.map(p=>p.numeroPannello==="A"?{...p,camion:"C3"}:p)};
  // Legacy import already inserted a pristine copy on the destination truck.
  db.prepare(`INSERT INTO Panels(id,loadId,numeroPannello,numeroCliente,numeroMasterPanel,camion,lato1,lato2,tipoPannello,quantita,spessore,lunghezza,altezza,superficie,volume,peso,stato,createdAt,updatedAt)
    SELECT 'ghost',?,numeroPannello,numeroCliente,numeroMasterPanel,'C3',lato1,lato2,tipoPannello,quantita,spessore,lunghezza,altezza,superficie,volume,peso,'MANCANTE',createdAt,updatedAt FROM Panels WHERE id=?`).run(c3.id,a.id);
  const before=snapshot();
  db.exec("CREATE TRIGGER fail_move BEFORE UPDATE OF loadId ON Panels WHEN NEW.numeroPannello='A' BEGIN SELECT RAISE(ABORT,'forced rollback'); END");
  assert.throws(()=>service.updateOrderImport(original.commessa,updated),/forced rollback/);assert.deepEqual(snapshot(),before);db.exec("DROP TRIGGER fail_move");
  const result=service.updateOrderImport(original.commessa,updated),moved=result.find(x=>x.id===c3.id)!.pannelli.find(p=>p.id===a.id)!;
  assert.equal(moved.stato,"DISPONIBILE");assert.equal(moved.scannedAt,"original-scan");assert.equal(moved.loadId,c3.id);
  assert.ok(!repository.panels(c2.id).some(p=>p.id===a.id));assert.equal(repository.panels(c3.id).length,3);
  assert.equal(db.prepare("SELECT 1 FROM Panels WHERE id='ghost'").get(),undefined);
  assert.deepEqual(db.prepare("SELECT * FROM Loads WHERE id=?").get(c1.id),shippedBefore);assert.deepEqual(db.prepare("SELECT * FROM Panels WHERE id=?").get(l.id),loadedBefore);assert.deepEqual(db.prepare("SELECT * FROM LoadingUnits").all(),unitBefore);
  const stable=snapshot();service.updateOrderImport(original.commessa,updated);assert.deepEqual(snapshot(),stable);
  for(const number of ["S","L"]){
   assert.throws(()=>service.updateOrderImport(original.commessa,{...updated,pannelli:updated.pannelli.map(p=>p.numeroPannello===number?{...p,camion:"C3"}:p)}),/spedito|caricato/);assert.deepEqual(snapshot(),stable);
   const omitted={...updated,removeMissing:true,pannelli:updated.pannelli.filter(p=>p.numeroPannello!==number)};
   if(number==="S")service.updateOrderImport(original.commessa,omitted);
   else assert.throws(()=>service.updateOrderImport(original.commessa,omitted),/caricat|partita/);
   assert.deepEqual(snapshot(),stable);
  }
  service.updateOrderImport(original.commessa,{...updated,pannelli:updated.pannelli.filter(p=>p.numeroPannello!=="S")});assert.deepEqual(snapshot(),stable);
  const removed=service.updateOrderImport(original.commessa,{...updated,removeMissing:true,pannelli:updated.pannelli.filter(p=>p.numeroPannello!=="R")});assert.equal(removed.find(x=>x.id===c3.id)!.pannelli.length,2);
  const direct={...updated,removeMissing:true,pannelli:updated.pannelli.filter(p=>p.numeroPannello!=="R").map(p=>p.numeroPannello==="A"?{...p,camion:"C2"}:p)};
  service.updateOrderImport(original.commessa,direct);
  assert.equal(repository.panels(c2.id).find(p=>p.id===a.id)?.stato,"DISPONIBILE");
  assert.equal(repository.panels(c2.id).find(p=>p.id===a.id)?.scannedAt,"original-scan");
  const directStable=snapshot();service.updateOrderImport(original.commessa,direct);assert.deepEqual(snapshot(),directStable);
  assert.throws(()=>service.updateOrderImport(original.commessa,{...direct,pannelli:[...direct.pannelli,importedPanel("A","C3")]}),/duplicato/);assert.deepEqual(snapshot(),directStable);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
 }finally{db.close();}
});

test("distinta operativa C2/C3 omette 45 spediti C1: storico immutabile e conflitti espliciti atomici",async()=>{
 const directory=mkdtempSync(join(tmpdir(),"manifest-shipped-")),databasePath=join(directory,"case.sqlite");
 const app=await buildApp({...config,databasePath}),db=new DatabaseSync(databasePath);
 try{
  const shipped=Array.from({length:45},(_,i)=>importedPanel(`S${i+1}`,"C1"));
  const active=[importedPanel("L","C2"),importedPanel("205","C2"),importedPanel("B","C3")];
  const original={...importedLoad([...shipped,...active]),commessa:"SHIPPED-MANIFEST"};
  const creation=await app.inject({method:"POST",url:"/api/loads/import",payload:original});assert.equal(creation.statusCode,201,creation.body);
  const loads=creation.json<Array<{id:string;camion:string;pannelli:Array<{id:string;numeroPannello:string}>}>>(),c1=loads.find(l=>l.camion==="C1")!,c2=loads.find(l=>l.camion==="C2")!,c3=loads.find(l=>l.camion==="C3")!;
  db.prepare("UPDATE Loads SET stato='SPEDITO' WHERE id=?").run(c1.id);
  db.prepare("UPDATE Panels SET stato='SPEDITO' WHERE loadId=?").run(c1.id);
  db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,carrierId,startedAt,shippedAt,createdAt,updatedAt) VALUES('shipped-session',?,'SPEDITO','OP','TRASPORTATORE','CARRIER','start','departure','start','departure')").run(c1.id);
  for(const panel of c1.pannelli)db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,panelId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES(?,'shipped-session','PANEL',?,'start','OP','start','start')").run(`unit-${panel.id}`,panel.id);
  db.prepare("INSERT INTO OperationalEvents(id,loadId,loadingSessionId,type,timestamp) VALUES('departure',?,'shipped-session','PARTENZA_CONFERMATA','departure')").run(c1.id);
  db.prepare("UPDATE Panels SET stato=CASE WHEN numeroPannello='L' THEN 'CARICATO' ELSE 'DISPONIBILE' END,scannedAt='scan-original' WHERE loadId=?").run(c2.id);
  db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,carrierId,startedAt,createdAt,updatedAt) VALUES('active-session',?,'IN_CARICO','OP','TRASPORTATORE','CARRIER','start','start','start')").run(c2.id);
  db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,panelId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES('loaded-unit','active-session','PANEL',?,'start','OP','start','start')").run(c2.pannelli.find(p=>p.numeroPannello==="L")!.id);
  const snapshot=()=>Object.fromEntries(["Loads","Panels","Packages","LoadingSessions","LoadingUnits","OperationalEvents","ShipmentPlans","TransportAssignments"].map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY id`).all()]));
  const before=snapshot(),shippedRows=(state:ReturnType<typeof snapshot>)=>Object.fromEntries(Object.entries(state).map(([t,rows])=>[t,rows.filter(r=>r.id===c1.id||r.loadId===c1.id||r.loadingSessionId==="shipped-session")]));
  const payload={...original,pannelli:active.map(p=>p.numeroPannello==="205"?{...p,camion:"C3"}:p.numeroPannello==="B"?{...p,peso:20}:p)};
  const update=(value:typeof payload)=>app.inject({method:"PUT",url:"/api/orders/SHIPPED-MANIFEST/import",payload:value});
  const first=await update(payload);assert.equal(first.statusCode,200,first.body);assert.deepEqual(shippedRows(snapshot()),shippedRows(before));
  const saved=first.json<Array<{id:string;stato:string;pannelli:Array<{id:string;stato:string;numeroPannello:string;scannedAt:string;peso:number}>}>>();
  assert.equal(saved.find(l=>l.id===c1.id)!.pannelli.length,45);assert.equal(saved.find(l=>l.id===c2.id)!.stato,"ATTESA_SPEDIZIONE");
  const moved=saved.find(l=>l.id===c3.id)!.pannelli.find(p=>p.numeroPannello==="205")!;assert.equal(moved.id,c2.pannelli.find(p=>p.numeroPannello==="205")!.id);assert.equal(moved.stato,"DISPONIBILE");assert.equal(moved.scannedAt,"scan-original");assert.equal(saved.find(l=>l.id===c3.id)!.pannelli.find(p=>p.numeroPannello==="B")!.peso,20);
  const stable=snapshot();
  for(const removeMissing of [false,true]){const repeat=await update({...payload,removeMissing} as typeof payload);assert.equal(repeat.statusCode,200,repeat.body);assert.deepEqual(snapshot(),stable);}
  for(const panel of [{...shipped[0]!,camion:"C3"},{...shipped[0]!,peso:999},{...shipped[0]!,numeroMasterPanel:"CHANGED"}]){
   const conflict=await update({...payload,pannelli:[...payload.pannelli,panel]});assert.equal(conflict.statusCode,409,conflict.body);assert.equal(conflict.json().error.code,"MANIFEST_CONFLICT");assert.deepEqual(snapshot(),stable);
  }
  const explicit=await update({...payload,pannelli:[...payload.pannelli,...shipped]});assert.equal(explicit.statusCode,200,explicit.body);assert.deepEqual(snapshot(),stable);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
 }finally{db.close();await app.close();rmSync(directory,{recursive:true,force:true});}
});

test("importa una distinta multi-camion in transazione e legge i pannelli",async()=>{
  const app=await buildApp(config);
  const response=await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("102","C1"),importedPanel("102","C2")])});
  assert.equal(response.statusCode,201);
  const loads=response.json<Array<{id:string;camion:string;pannelli:unknown[]}>>();
  assert.equal(loads.length,2);
  assert.equal(loads.every(load=>load.pannelli.length===1),true);
  const panels=await app.inject({method:"GET",url:`/api/loads/${loads[0]!.id}/panels`});
  assert.equal(panels.statusCode,200);
  assert.equal(panels.json<unknown[]>().length,1);
  const duplicate=await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("103","C1")])});
  assert.equal(duplicate.statusCode,409);
  assert.equal(duplicate.json<{error:{code:string}}>().error.code,"LOAD_ALREADY_EXISTS");
  await app.close();
});

test("aggiorna la distinta senza duplicare pannelli e consente l'eliminazione",async()=>{
  const app=await buildApp(config);
  const created=await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("1","C1"),importedPanel("2","C1")])});
  const load=created.json<Array<{id:string}>>()[0];assert.ok(load);
  const updated=await app.inject({method:"PUT",url:`/api/loads/${load.id}/import`,payload:importedLoad([importedPanel("1","C1",99),importedPanel("3","C1")],true)});
  assert.equal(updated.statusCode,200);
  const updatedPanels=updated.json<{pannelli:Array<{numeroPannello:string;peso:number}>}>().pannelli;
  assert.deepEqual(updatedPanels.map(panel=>panel.numeroPannello).sort(),["1","3"]);
  assert.equal(updatedPanels.find(panel=>panel.numeroPannello==="1")?.peso,99);
  const removed=await app.inject({method:"DELETE",url:`/api/loads/${load.id}`});
  assert.equal(removed.statusCode,204);
  const missing=await app.inject({method:"GET",url:`/api/loads/${load.id}`});
  assert.equal(missing.statusCode,404);
  await app.close();
});

test("aggiornando una distinta rimuove atomicamente un camion non più presente",async()=>{
  const app=await buildApp(config);
  const original={...importedLoad([importedPanel("1","C1",10),importedPanel("2","C2",20)]),commessa:"UPDATE-TRUCKS"};
  await app.inject({method:"POST",url:"/api/loads/import",payload:original});
  const updated=await app.inject({method:"PUT",url:"/api/orders/UPDATE-TRUCKS/import",payload:{...original,removeMissing:true,pannelli:[importedPanel("1","C1",99)]}});
  assert.equal(updated.statusCode,200);
  const loads=updated.json<Array<{camion:string;pannelli:Array<{peso:number}>}>>();
  assert.deepEqual(loads.map(load=>load.camion),["C1"]);assert.equal(loads[0]?.pannelli[0]?.peso,99);
  await app.close();
});

test("l'aggiornamento multi-camion esegue rollback se il camion rimosso ha attività",async()=>{
  const app=await buildApp(config);
  const original={...importedLoad([importedPanel("1","C1",10),importedPanel("2","C2",20)]),commessa:"UPDATE-BLOCKED"};
  const loads=(await app.inject({method:"POST",url:"/api/loads/import",payload:original})).json<Array<{camion:string;pannelli:Array<{id:string}>}>>();
  const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
  const c2=loads.find(load=>load.camion==="C2")!;await app.inject({method:"PATCH",url:`/api/panels/${c2.pannelli[0]!.id}/scan`,payload:{operatorId:operator.id}});
  const blocked=await app.inject({method:"PUT",url:"/api/orders/UPDATE-BLOCKED/import",payload:{...original,removeMissing:true,pannelli:[importedPanel("1","C1",99)]}});
  assert.equal(blocked.statusCode,409);assert.equal(blocked.json<{error:{code:string}}>().error.code,"RESOURCE_IN_USE");
  const restored=(await app.inject({method:"GET",url:"/api/loads"})).json<Array<{commessa:string;camion:string;pannelli:Array<{peso:number}>}>>().filter(load=>load.commessa==="UPDATE-BLOCKED");
  assert.equal(restored.length,2);assert.equal(restored.find(load=>load.camion==="C1")?.pannelli[0]?.peso,10);
  await app.close();
});

test("elimina atomicamente la commessa 265588 dopo conferma della pianificazione preventiva",async()=>{
  const app=await buildApp(config);
  const payload={...importedLoad([importedPanel("139","C7"),importedPanel("140","C7")]),commessa:"265588"};
  const load=(await app.inject({method:"POST",url:"/api/loads/import",payload})).json<Array<{id:string}>>()[0]!;
  const plan=await app.inject({method:"POST",url:"/api/shipments",payload:{commessa:"265588",cliente:"Cliente Test",camion:"C7",plannedDepartureDate:"2026-08-18",transportType:"BILICO_ESSEPI",trailerId:null,carrierId:null}});
  assert.equal(plan.statusCode,200);
  const trailer=(await app.inject({method:"GET",url:"/api/trailers"})).json<Array<{id:string}>>()[0]!;
  assert.equal((await app.inject({method:"POST",url:`/api/trailers/${trailer.id}/reservation`,payload:{commessa:"265588",cliente:"Cliente Test",carico:"C7"}})).statusCode,200);
  const warning=await app.inject({method:"DELETE",url:"/api/orders/265588"});
  assert.equal(warning.statusCode,409);assert.equal(warning.json<{error:{code:string}}>().error.code,"PREVENTIVE_PLAN_CONFIRMATION_REQUIRED");
  assert.equal((await app.inject({method:"GET",url:`/api/loads/${load.id}`})).statusCode,200);
  const removed=await app.inject({method:"DELETE",url:"/api/orders/265588?confirmPlanning=true"});
  assert.equal(removed.statusCode,204);
  assert.equal((await app.inject({method:"GET",url:`/api/loads/${load.id}`})).statusCode,404);
  assert.equal((await app.inject({method:"GET",url:"/api/shipments"})).json<Array<{commessa:string}>>().some(item=>item.commessa==="265588"),false);
  assert.equal((await app.inject({method:"GET",url:"/api/transports"})).json<Array<{id:string;status:string}>>().find(item=>item.id===trailer.id)?.status,"DISPONIBILE");
  await app.close();
});

test("elimina una commessa con il solo pacco bozza vuoto",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"legacy-empty-"));
  const path=join(directory,"test.sqlite");
  const app=await buildApp({...config,databasePath:path});
  const payload={...importedLoad([importedPanel("101","C3"),importedPanel("104","C4")]),commessa:"EMPTY-DRAFT"};
  const loads=(await app.inject({method:"POST",url:"/api/loads/import",payload})).json<Array<{id:string}>>();
  const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
  const legacyDb=new DatabaseSync(path);new ScanningRepository(legacyDb).createPackage(loads[0]!.id,operator.id);legacyDb.close();
  const removed=await app.inject({method:"DELETE",url:"/api/orders/EMPTY-DRAFT"});
  assert.equal(removed.statusCode,204);
  assert.equal((await app.inject({method:"GET",url:"/api/loads"})).json<Array<{commessa:string}>>().some(load=>load.commessa==="EMPTY-DRAFT"),false);
  await app.close();
});

test("eliminando C6 conserva C5 della stessa commessa",async()=>{
  const app=await buildApp(config);
  const payload={...importedLoad([importedPanel("501-C5","C5"),importedPanel("501-C6","C6")]),commessa:"265501"};
  const loads=(await app.inject({method:"POST",url:"/api/loads/import",payload})).json<Array<{id:string;camion:string}>>();
  const c5=loads.find(load=>load.camion==="C5")!,c6=loads.find(load=>load.camion==="C6")!;
  assert.equal((await app.inject({method:"DELETE",url:`/api/loads/${c6.id}`})).statusCode,204);
  assert.equal((await app.inject({method:"GET",url:`/api/loads/${c5.id}`})).statusCode,200);
  assert.equal((await app.inject({method:"GET",url:`/api/loads/${c6.id}`})).statusCode,404);
  const remaining=(await app.inject({method:"GET",url:"/api/loads"})).json<Array<{commessa:string;camion:string}>>().filter(load=>load.commessa==="265501");
  assert.deepEqual(remaining.map(load=>load.camion),["C5"]);
  await app.close();
});

test("eliminando l'unico carico non lascia la commessa nelle viste attive",async()=>{
  const app=await buildApp(config);
  const payload={...importedLoad([importedPanel("ONLY-1","C1")]),commessa:"ONLY-LOAD"};
  const load=(await app.inject({method:"POST",url:"/api/loads/import",payload})).json<Array<{id:string}>>()[0]!;
  assert.equal((await app.inject({method:"DELETE",url:`/api/loads/${load.id}`})).statusCode,204);
  assert.equal((await app.inject({method:"GET",url:"/api/loads"})).json<Array<{commessa:string}>>().some(item=>item.commessa==="ONLY-LOAD"),false);
  assert.equal((await app.inject({method:"GET",url:"/api/loading-sessions"})).json<Array<{commessa:string}>>().some(item=>item.commessa==="ONLY-LOAD"),false);
  assert.equal((await app.inject({method:"GET",url:"/api/shipments"})).json<Array<{commessa:string}>>().some(item=>item.commessa==="ONLY-LOAD"),false);
  await app.close();
});

test("elimina un carico con sessione reversibile dopo avere rimosso tutte le unità",async()=>{
  const app=await buildApp(config);
  const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
  const carrier=(await app.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string}>>()[0]!;
  const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:{...importedLoad([importedPanel("REVERSIBLE-1","C1-")]),commessa:"REVERSIBLE-DELETE"}})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
  const panel=load.pannelli[0]!;
  await app.inject({method:"PATCH",url:`/api/panels/${panel.id}/close-single`,payload:{operatorId:operator.id}});
  const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"TRASPORTATORE",carrierId:carrier.id}})).json<{id:string}>();
  const loaded=(await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:panel.id,operatorId:operator.id}})).json<{units:Array<{id:string}>}>();
  await app.inject({method:"DELETE",url:`/api/loading-sessions/${session.id}/units/${loaded.units[0]!.id}`,payload:{operatorId:operator.id}});
  const beforeDelete=(await app.inject({method:"GET",url:`/api/loads/${load.id}/loading-session`})).json<{shippedAt:string|null;units:unknown[]}>();
  assert.equal(beforeDelete.shippedAt,null);assert.equal(beforeDelete.units.length,0);
  assert.equal((await app.inject({method:"DELETE",url:`/api/loads/${load.id}`})).statusCode,204);
  assert.equal((await app.inject({method:"GET",url:`/api/loads/${load.id}`})).statusCode,404);
  assert.equal((await app.inject({method:"GET",url:"/api/loading-sessions"})).json<Array<{id:string}>>().some(item=>item.id===session.id),false);
  await app.close();
});

test("non elimina un carico con sessione spedita e consolidata",async()=>{
  const app=await buildApp(config);
  const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
  const carrier=(await app.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string}>>()[0]!;
  const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:{...importedLoad([importedPanel("CONSOLIDATED-1","C2")]),commessa:"CONSOLIDATED-DELETE"}})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
  const panel=load.pannelli[0]!;
  await app.inject({method:"PATCH",url:`/api/panels/${panel.id}/close-single`,payload:{operatorId:operator.id}});
  const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"TRASPORTATORE",carrierId:carrier.id}})).json<{id:string}>();
  await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:panel.id,operatorId:operator.id}});
  await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/complete`});
  await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/ship`,payload:{carrierId:carrier.id}});
  const blocked=await app.inject({method:"DELETE",url:`/api/loads/${load.id}`});
  assert.equal(blocked.statusCode,409);assert.equal(blocked.json<{error:{code:string}}>().error.code,"RESOURCE_IN_USE");
  assert.equal((await app.inject({method:"GET",url:`/api/loads/${load.id}`})).statusCode,200);
  await app.close();
});

test("la cancellazione di un carico non tocca l'attività di un altro camion della stessa commessa",async()=>{
  const app=await buildApp(config);
  const payload={...importedLoad([importedPanel("SAFE-1","C5"),importedPanel("ACTIVE-1","C6")]),commessa:"MIXED-ACTIVITY"};
  const loads=(await app.inject({method:"POST",url:"/api/loads/import",payload})).json<Array<{id:string;camion:string;pannelli:Array<{id:string}>}>>();
  const c5=loads.find(load=>load.camion==="C5")!,c6=loads.find(load=>load.camion==="C6")!;
  const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
  assert.equal((await app.inject({method:"PATCH",url:`/api/panels/${c6.pannelli[0]!.id}/scan`,payload:{operatorId:operator.id}})).statusCode,200);
  assert.equal((await app.inject({method:"PATCH",url:`/api/panels/${c6.pannelli[0]!.id}/close-single`,payload:{operatorId:operator.id}})).statusCode,200);
  const blocked=await app.inject({method:"DELETE",url:`/api/loads/${c6.id}`});
  assert.equal(blocked.statusCode,409);
  assert.equal(blocked.json<{error:{code:string}}>().error.code,"RESOURCE_IN_USE");
  assert.equal((await app.inject({method:"DELETE",url:`/api/loads/${c5.id}`})).statusCode,204);
  const untouched=(await app.inject({method:"GET",url:`/api/loads/${c6.id}`})).json<{camion:string;pannelli:Array<{id:string;stato:string;scannedByOperatorId:string|null}>}>();
  assert.equal(untouched.camion,"C6");
  assert.equal(untouched.pannelli[0]?.id,c6.pannelli[0]?.id);
  assert.equal(untouched.pannelli[0]?.stato,"DISPONIBILE");
  assert.equal(untouched.pannelli[0]?.scannedByOperatorId,operator.id);
  await app.close();
});

test("la cancellazione multi-camion non rimuove nulla se un camion contiene attività",async()=>{
  const app=await buildApp(config);
  const payload={...importedLoad([importedPanel("1","C1"),importedPanel("2","C2")]),commessa:"MULTI-DELETE"};
  const loads=(await app.inject({method:"POST",url:"/api/loads/import",payload})).json<Array<{id:string;pannelli:Array<{id:string}>}>>();
  const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
  await app.inject({method:"PATCH",url:`/api/panels/${loads[1]!.pannelli[0]!.id}/scan`,payload:{operatorId:operator.id}});
  const blocked=await app.inject({method:"DELETE",url:"/api/orders/MULTI-DELETE"});
  assert.equal(blocked.statusCode,409);assert.equal(blocked.json<{error:{code:string}}>().error.code,"RESOURCE_IN_USE");
  assert.equal((await app.inject({method:"GET",url:`/api/loads/${loads[0]!.id}`})).statusCode,200);
  assert.equal((await app.inject({method:"GET",url:`/api/loads/${loads[1]!.id}`})).statusCode,200);
  await app.close();
});

test("commesse e pannelli persistono dopo il riavvio backend",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"loads-persistence-"));const persistentConfig={...config,databasePath:join(directory,"operational.sqlite")};
  try{const first=await buildApp(persistentConfig);await first.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("77","C7")])});await first.close();const second=await buildApp(persistentConfig);const loads=await second.inject({method:"GET",url:"/api/loads"});assert.equal(loads.json<Array<{pannelli:unknown[]}>>()[0]?.pannelli.length,1);await second.close();}finally{rmSync(directory,{recursive:true,force:true});}
});

test("scansioni, singoli e pacchi persistono con associazioni e dimensioni",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"scanning-persistence-"));const persistentConfig={...config,databasePath:join(directory,"scanning.sqlite")};
  try{
    const first=await buildApp(persistentConfig);
    const operator=(await first.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
    const created=(await first.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("S1","C1"),importedPanel("P1","C1"),importedPanel("P2","C1")])})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
    const [single,panel1,panel2]=created.pannelli;
    assert.equal((await first.inject({method:"PATCH",url:`/api/panels/${single!.id}/scan`,payload:{operatorId:operator.id}})).statusCode,200);
    assert.equal((await first.inject({method:"PATCH",url:`/api/panels/${single!.id}/close-single`,payload:{operatorId:operator.id}})).json<{stato:string}>().stato,"DISPONIBILE");
    const opened=(await first.inject({method:"POST",url:"/api/packages",payload:{loadId:created.id,operatorId:operator.id,panelId:panel1!.id}})).json<{id:string;stato:string}>();
    assert.equal(opened.stato,"APERTO");
    await first.inject({method:"PATCH",url:`/api/panels/${panel2!.id}/scan`,payload:{operatorId:operator.id}});
    const twoPanels=await first.inject({method:"POST",url:`/api/packages/${opened.id}/panels`,payload:{panelId:panel2!.id,operatorId:operator.id}});
    assert.equal(twoPanels.json<{numeroPannelli:number}>().numeroPannelli,2);
    const removed=await first.inject({method:"DELETE",url:`/api/packages/${opened.id}/panels/${panel2!.id}`,payload:{operatorId:operator.id}});
    assert.equal(removed.json<{numeroPannelli:number}>().numeroPannelli,1);
    await first.inject({method:"PATCH",url:`/api/panels/${panel2!.id}/scan`,payload:{operatorId:operator.id}});
    await first.inject({method:"POST",url:`/api/packages/${opened.id}/panels`,payload:{panelId:panel2!.id,operatorId:operator.id}});
    const closed=await first.inject({method:"POST",url:`/api/packages/${opened.id}/close`,payload:{codicePacco:"PK-TEST-000001",operatoreId:operator.id,lunghezzaPacco:4500,larghezzaPacco:1200,altezzaPacco:600}});
    assert.equal(closed.statusCode,200);assert.equal(closed.json<{stato:string}>().stato,"DISPONIBILE");
    await first.close();
    const restarted=await buildApp(persistentConfig);const warehouse=await restarted.inject({method:"GET",url:"/api/warehouse"});
    const data=warehouse.json<{singles:unknown[];packages:Array<{codicePacco:string;numeroPannelli:number;lunghezzaPacco:number;pannelli:unknown[]}>;openPackages:unknown[]}>();
    assert.equal(data.singles.length,1);assert.equal(data.packages[0]?.codicePacco,"PK-TEST-000001");assert.equal(data.packages[0]?.numeroPannelli,2);assert.equal(data.packages[0]?.pannelli.length,2);assert.equal(data.packages[0]?.lunghezzaPacco,4500);assert.equal(data.openPackages.length,0);
    await restarted.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("gestisce N pacchi in lavorazione mantenendone uno solo attivo",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"package-multi-"));const persistentConfig={...config,databasePath:join(directory,"multi.sqlite")};
  try{
    const first=await buildApp(persistentConfig);
    const operator=(await first.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
    const load=(await first.inject({method:"POST",url:"/api/loads/import",payload:{...importedLoad([importedPanel("P1","C1"),importedPanel("P2","C1"),importedPanel("P3","C1"),importedPanel("P4","C1")]),commessa:"MULTI-PACKAGE"}})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
    const scanAndAdd=async(packageId:string,panelId:string)=>{await first.inject({method:"PATCH",url:`/api/panels/${panelId}/scan`,payload:{operatorId:operator.id}});const response=await first.inject({method:"POST",url:`/api/packages/${packageId}/panels`,payload:{panelId,operatorId:operator.id}});assert.equal(response.statusCode,200);};
    const packageA=(await first.inject({method:"POST",url:"/api/packages",payload:{loadId:load.id,operatorId:operator.id,panelId:load.pannelli[0]!.id}})).json<{id:string}>();
    await scanAndAdd(packageA.id,load.pannelli[1]!.id);
    const packageB=(await first.inject({method:"POST",url:"/api/packages",payload:{loadId:load.id,operatorId:operator.id,panelId:load.pannelli[2]!.id}})).json<{id:string}>();
    let warehouse=(await first.inject({method:"GET",url:"/api/warehouse"})).json<{openPackages:Array<{id:string}>;suspendedPackages:Array<{id:string}>}>();
    assert.deepEqual(warehouse.openPackages.map(item=>item.id),[packageB.id]);assert.equal(warehouse.suspendedPackages.some(item=>item.id===packageA.id),true);
    await first.inject({method:"POST",url:`/api/packages/${packageA.id}/resume`});
    warehouse=(await first.inject({method:"GET",url:"/api/warehouse"})).json<typeof warehouse>();
    assert.deepEqual(warehouse.openPackages.map(item=>item.id),[packageA.id]);assert.equal(warehouse.suspendedPackages.some(item=>item.id===packageB.id),true);
    await scanAndAdd(packageA.id,load.pannelli[3]!.id);
    await first.inject({method:"POST",url:`/api/packages/${packageA.id}/suspend`});
    await first.close();
    const restarted=await buildApp(persistentConfig);
    const afterRestart=(await restarted.inject({method:"GET",url:"/api/warehouse"})).json<{openPackages:unknown[];suspendedPackages:Array<{id:string;numeroPannelli:number}>}>();
    assert.equal(afterRestart.openPackages.length,0);assert.equal(afterRestart.suspendedPackages.length,2);
    assert.equal(afterRestart.suspendedPackages.find(item=>item.id===packageA.id)?.numeroPannelli,3);assert.equal(afterRestart.suspendedPackages.find(item=>item.id===packageB.id)?.numeroPannelli,1);
    await restarted.inject({method:"POST",url:`/api/packages/${packageB.id}/resume`});
    const closed=await restarted.inject({method:"POST",url:`/api/packages/${packageB.id}/close`,payload:{codicePacco:"PK-2026-000001",operatoreId:operator.id,lunghezzaPacco:1000,larghezzaPacco:500,altezzaPacco:300}});
    assert.equal(closed.statusCode,200);assert.equal(closed.json<{codicePacco:string;stato:string}>().codicePacco,"PK-2026-000001");assert.equal(closed.json<{stato:string}>().stato,"DISPONIBILE");
    const finalWarehouse=(await restarted.inject({method:"GET",url:"/api/warehouse"})).json<{packages:Array<{id:string;pannelli:Array<{id:string}>}>;openPackages:unknown[];suspendedPackages:Array<{id:string;pannelli:Array<{id:string}>}>}>();
    assert.equal(finalWarehouse.openPackages.length,0);assert.deepEqual(new Set(finalWarehouse.suspendedPackages.map(item=>item.id)),new Set([packageA.id]));assert.deepEqual(finalWarehouse.packages.find(item=>item.id===packageB.id)?.pannelli.map(item=>item.id),[load.pannelli[2]!.id]);
    await restarted.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("elimina sia un pacco mai movimentato sia un pacco scaricato da una sessione non conclusa",async()=>{
  const app=await buildApp(config);
  const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
  const carrier=(await app.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string}>>()[0]!;
  const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:{...importedLoad([importedPanel("P-CLEAN","C1"),importedPanel("P-HISTORY","C1")]),commessa:"PACKAGE-DELETE"}})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
  const makePackage=async(panelId:string,code:string)=>{const pack=(await app.inject({method:"POST",url:"/api/packages",payload:{loadId:load.id,operatorId:operator.id,panelId}})).json<{id:string}>();await app.inject({method:"POST",url:`/api/packages/${pack.id}/close`,payload:{codicePacco:code,operatoreId:operator.id,lunghezzaPacco:1000,larghezzaPacco:500,altezzaPacco:300}});return pack;};
  const clean=await makePackage(load.pannelli[0]!.id,"PK-CLEAN");
  const historical=await makePackage(load.pannelli[1]!.id,"PK-HISTORY");
  const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"TRASPORTATORE",carrierId:carrier.id}})).json<{id:string}>();
  const loaded=(await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PACKAGE",packageId:historical.id,operatorId:operator.id}})).json<{units:Array<{id:string}>}>();
  await app.inject({method:"DELETE",url:`/api/loading-sessions/${session.id}/units/${loaded.units[0]!.id}`,payload:{operatorId:operator.id}});
  const removed=await app.inject({method:"DELETE",url:`/api/packages/${clean.id}`,payload:{operatorId:operator.id}});
  assert.equal(removed.statusCode,200);assert.equal(removed.json<{success:boolean}>().success,true);
  assert.equal((await app.inject({method:"GET",url:`/api/packages/${clean.id}`})).statusCode,404);
  assert.equal((await app.inject({method:"GET",url:`/api/packages/${historical.id}`})).json<{stato:string}>().stato,"DISPONIBILE");
  const reversibleDelete=await app.inject({method:"DELETE",url:`/api/packages/${historical.id}`,payload:{operatorId:operator.id}});
  assert.equal(reversibleDelete.statusCode,200);assert.equal(reversibleDelete.json<{success:boolean}>().success,true);
  assert.equal((await app.inject({method:"GET",url:`/api/packages/${historical.id}`})).statusCode,404);
  const freed=(await app.inject({method:"GET",url:`/api/loads/${load.id}`})).json<{pannelli:Array<{id:string;stato:string;packageId:string|null}>}>().pannelli.find(panel=>panel.id===load.pannelli[1]!.id)!;
  assert.equal(freed.stato,"DISPONIBILE");assert.equal(freed.packageId,null);
  await app.close();
});

test("un pacco spedito non può essere eliminato dal magazzino",async()=>{
  const app=await buildApp(config);
  const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
  const carrier=(await app.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string}>>()[0]!;
  const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:{...importedLoad([importedPanel("P-SHIPPED","C2")]),commessa:"PACKAGE-SHIPPED"}})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
  const pack=(await app.inject({method:"POST",url:"/api/packages",payload:{loadId:load.id,operatorId:operator.id,panelId:load.pannelli[0]!.id}})).json<{id:string}>();
  await app.inject({method:"POST",url:`/api/packages/${pack.id}/close`,payload:{codicePacco:"PK-SHIPPED",operatoreId:operator.id,lunghezzaPacco:1000,larghezzaPacco:500,altezzaPacco:300}});
  const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"TRASPORTATORE",carrierId:carrier.id}})).json<{id:string}>();
  await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PACKAGE",packageId:pack.id,operatorId:operator.id}});
  assert.equal((await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/ship`,payload:{carrierId:carrier.id}})).statusCode,200);
  const blocked=await app.inject({method:"DELETE",url:`/api/packages/${pack.id}`,payload:{operatorId:operator.id}});
  assert.equal(blocked.statusCode,409);assert.equal(blocked.json<{error:{code:string}}>().error.code,"RESOURCE_IN_USE");
  assert.equal((await app.inject({method:"GET",url:`/api/packages/${pack.id}`})).json<{stato:string}>().stato,"SPEDITO");
  await app.close();
});

test("l'ubicazione manuale persiste e viene mantenuta quando un pannello viene scaricato",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"panel-location-"));const persistentConfig={...config,databasePath:join(directory,"location.sqlite")};
  try{
    const first=await buildApp(persistentConfig);
    const operator=(await first.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
    const trailer=(await first.inject({method:"GET",url:"/api/trailers"})).json<Array<{id:string}>>()[0]!;
    const load=(await first.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("U1","C1")])})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
    const panel=load.pannelli[0]!;
    await first.inject({method:"PATCH",url:`/api/panels/${panel.id}/close-single`,payload:{operatorId:operator.id}});
    const saved=await first.inject({method:"PATCH",url:`/api/panels/${panel.id}/location`,payload:{location:"Zona A"}});
    assert.equal(saved.statusCode,200);assert.equal(saved.json<{manualLocation:string|null}>().manualLocation,"Zona A");
    const session=(await first.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"RIMORCHIO_ESSEPI",trailerId:trailer.id}})).json<{id:string}>();
    const loading=await first.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:panel.id,operatorId:operator.id}});
    const unitId=loading.json<{units:Array<{id:string}>}>().units[0]!.id;
    assert.equal((await first.inject({method:"PATCH",url:`/api/panels/${panel.id}/location`,payload:{location:"Zona B"}})).statusCode,409);
    await first.inject({method:"DELETE",url:`/api/loading-sessions/${session.id}/units/${unitId}`,payload:{operatorId:operator.id}});
    await first.close();
    const restarted=await buildApp(persistentConfig);const restored=(await restarted.inject({method:"GET",url:"/api/loads"})).json<Array<{pannelli:Array<{stato:string;manualLocation:string|null}>}>>()[0]!.pannelli[0]!;
    assert.equal(restored.stato,"DISPONIBILE");assert.equal(restored.manualLocation,"Zona A");await restarted.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("la sessione di carico persiste, si riapre e viene spedita",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"loading-persistence-"));const persistentConfig={...config,databasePath:join(directory,"loading.sqlite")};
  try{
    const first=await buildApp(persistentConfig);
    const operator=(await first.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
    const trailer=(await first.inject({method:"GET",url:"/api/trailers"})).json<Array<{id:string}>>()[0]!;
    const carrier=(await first.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string}>>()[0]!;
    const load=(await first.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("L1","C1"),importedPanel("L2","C1")])})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
    for(const panel of load.pannelli)await first.inject({method:"PATCH",url:`/api/panels/${panel.id}/close-single`,payload:{operatorId:operator.id}});
    const session=(await first.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"RIMORCHIO_ESSEPI",trailerId:trailer.id}})).json<{id:string;startedAt:string}>();
    const engaged=(await first.inject({method:"GET",url:"/api/transports"})).json<Array<{id:string;status:string;commessa:string}>>().find(item=>item.id===trailer.id);
    assert.equal(engaged?.status,"IMPEGNATO");assert.equal(engaged?.commessa,"COMM-TEST");
    const secondLoad=(await first.inject({method:"POST",url:"/api/loads/import",payload:{...importedLoad([importedPanel("L3","C2")]),commessa:"265539"}})).json<Array<{id:string}>>()[0]!;
    const duplicateTrailer=await first.inject({method:"POST",url:`/api/loads/${secondLoad.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"RIMORCHIO_ESSEPI",trailerId:trailer.id}});
    assert.equal(duplicateTrailer.statusCode,409);assert.equal(duplicateTrailer.json<{error:{code:string}}>().error.code,"TRAILER_NOT_AVAILABLE");
    const partial=await first.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:load.pannelli[0]!.id,operatorId:operator.id}});
    assert.equal(partial.json<{stato:string;units:unknown[]}>().stato,"IN_CARICO");assert.equal(partial.json<{units:unknown[]}>().units.length,1);
    await first.close();
    const second=await buildApp(persistentConfig);const restored=await second.inject({method:"GET",url:`/api/loads/${load.id}/loading-session`});const restoredData=restored.json<{operatorId:string;trailerId:string;startedAt:string;units:unknown[]}>();
    assert.equal(restoredData.operatorId,operator.id);assert.equal(restoredData.trailerId,trailer.id);assert.equal(restoredData.startedAt,session.startedAt);assert.equal(restoredData.units.length,1);
    await second.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:load.pannelli[1]!.id,operatorId:operator.id}});
    assert.equal((await second.inject({method:"POST",url:`/api/loading-sessions/${session.id}/complete`})).json<{stato:string}>().stato,"ATTESA_SPEDIZIONE");
    assert.equal((await second.inject({method:"POST",url:`/api/loading-sessions/${session.id}/reopen`,payload:{note:"Nuova unità"}})).json<{stato:string}>().stato,"ATTESA_SPEDIZIONE");
    await second.inject({method:"POST",url:`/api/loading-sessions/${session.id}/complete`});
    const shipment=(await second.inject({method:"POST",url:"/api/shipments",payload:{loadId:load.id,commessa:"COMM-TEST",cliente:"Cliente Test",camion:"C1",plannedDepartureDate:"2026-09-15",transportType:"BILICO_ESSEPI",trailerId:null,carrierId:null}})).json<{id:string;shipmentStatus:string}>();assert.equal(shipment.shipmentStatus,"PRONTA");
    const shipped=await second.inject({method:"POST",url:`/api/loading-sessions/${session.id}/ship`,payload:{carrierId:carrier.id}});assert.equal(shipped.json<{stato:string;carrierId:string}>().stato,"SPEDITO");assert.equal(shipped.json<{carrierId:string}>().carrierId,carrier.id);const departedPlan=(await second.inject({method:"GET",url:"/api/shipments"})).json<Array<{id:string;shipmentStatus:string;operationalStatus:string;carrierId:string;actualDepartureDate:string|null}>>().find(item=>item.id===shipment.id)!;assert.equal(departedPlan.shipmentStatus,"IN_VIAGGIO");assert.equal(departedPlan.operationalStatus,"SPEDITO");assert.equal(departedPlan.carrierId,carrier.id);assert.ok(departedPlan.actualDepartureDate);
    const travelling=(await second.inject({method:"GET",url:"/api/transports"})).json<Array<{id:string;status:string;departedAt:string;availableFrom:string}>>().find(item=>item.id===trailer.id);
    assert.equal(travelling?.status,"IN_VIAGGIO");assert.ok(travelling?.departedAt);assert.equal(travelling?.availableFrom,addBusinessDays(travelling!.departedAt,2));
    await second.close();const database=new DatabaseSync(persistentConfig.databasePath);database.prepare("UPDATE TransportAssignments SET availableFrom=? WHERE trailerId=? AND releasedAt IS NULL").run("2020-01-01T00:00:00.000Z",trailer.id);database.close();const third=await buildApp(persistentConfig);const persisted=await third.inject({method:"GET",url:`/api/loads/${load.id}/loading-session`});assert.equal(persisted.json<{stato:string}>().stato,"SPEDITO");const available=(await third.inject({method:"GET",url:"/api/transports"})).json<Array<{id:string;status:string}>>().find(item=>item.id===trailer.id);assert.equal(available?.status,"DISPONIBILE");await third.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("ricalcola lo stato quando tutte le unità caricate e i pannelli pronti vengono rimossi",async()=>{
  const app=await buildApp(config);
  const panels=Array.from({length:7},(_,index)=>importedPanel(String(index+1),"C1-"));
  const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:{...importedLoad(panels),commessa:"STATUS-ROLLBACK"}})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
  const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
  const carrier=(await app.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string}>>()[0]!;
  for(const panel of load.pannelli)await app.inject({method:"PATCH",url:`/api/panels/${panel.id}/close-single`,payload:{operatorId:operator.id}});
  const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"TRASPORTATORE",carrierId:carrier.id}})).json<{id:string}>();
  const loaded=await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:load.pannelli[0]!.id,operatorId:operator.id}});
  const unitId=loaded.json<{units:Array<{id:string}>}>().units[0]!.id;
  assert.equal(loaded.json<{stato:string}>().stato,"IN_CARICO");
  assert.equal((await app.inject({method:"DELETE",url:`/api/loading-sessions/${session.id}/units/${unitId}`,payload:{operatorId:operator.id}})).json<{stato:string}>().stato,"DA_CARICARE");
  for(const panel of load.pannelli)await app.inject({method:"DELETE",url:`/api/panels/${panel.id}`,payload:{operatorId:operator.id}});
  const currentLoad=await app.inject({method:"GET",url:`/api/loads/${load.id}`});
  assert.equal(currentLoad.json<{stato:string}>().stato,"DA_COMPLETARE");
  const currentSession=(await app.inject({method:"GET",url:`/api/loads/${load.id}/loading-session`})).json<{stato:string;units:unknown[]}>();
  assert.equal(currentSession.stato,"DA_COMPLETARE");assert.equal(currentSession.units.length,0);
  const shipment=(await app.inject({method:"GET",url:"/api/shipments"})).json<Array<{loadId:string;operationalStatus:string}>>().find(item=>item.loadId===load.id);
  assert.equal(shipment?.operationalStatus,"DA_COMPLETARE");
  await app.close();
});

test("consente di iniziare un carico DA_COMPLETARE con un solo elemento disponibile",async()=>{
  const app=await buildApp(config);
  const panels=Array.from({length:7},(_,index)=>importedPanel(String(index+1),"C1-"));
  const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:{...importedLoad(panels),commessa:"PARTIAL-LOADING"}})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
  const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
  const carrier=(await app.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string}>>()[0]!;
  await app.inject({method:"PATCH",url:`/api/panels/${load.pannelli[0]!.id}/close-single`,payload:{operatorId:operator.id}});
  assert.equal((await app.inject({method:"GET",url:`/api/loads/${load.id}`})).json<{stato:string}>().stato,"DA_COMPLETARE");
  const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"TRASPORTATORE",carrierId:carrier.id}})).json<{id:string;stato:string}>();
  assert.equal(session.stato,"DA_COMPLETARE");
  const loaded=await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:load.pannelli[0]!.id,operatorId:operator.id}});
  assert.equal(loaded.statusCode,200);assert.equal(loaded.json<{stato:string}>().stato,"IN_CARICO");
  await app.inject({method:"PATCH",url:`/api/panels/${load.pannelli[1]!.id}/close-single`,payload:{operatorId:operator.id}});
  const refreshed=(await app.inject({method:"GET",url:`/api/loads/${load.id}`})).json<{stato:string;pannelli:Array<{stato:string}>}>();
  assert.equal(refreshed.stato,"IN_CARICO");assert.equal(refreshed.pannelli.filter(panel=>panel.stato==="DISPONIBILE").length,1);
  await app.close();
});

test("rientra in una sessione parziale esistente e continua la stessa storia operativa",async()=>{
  const app=await buildApp(config);
  const panels=[importedPanel("REOPEN-1","C1-"),importedPanel("REOPEN-2","C1-"),importedPanel("REOPEN-3","C1-")];
  const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:{...importedLoad(panels),commessa:"REOPEN-PARTIAL"}})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
  const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
  const carrier=(await app.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string}>>()[0]!;
  for(const panel of load.pannelli.slice(0,2))await app.inject({method:"PATCH",url:`/api/panels/${panel.id}/close-single`,payload:{operatorId:operator.id}});
  const created=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"TRASPORTATORE",carrierId:carrier.id}})).json<{id:string;startedAt:string}>();
  const first=(await app.inject({method:"POST",url:`/api/loading-sessions/${created.id}/units`,payload:{unitType:"PANEL",panelId:load.pannelli[0]!.id,operatorId:operator.id}})).json<{units:Array<{id:string}>;events:unknown[]}>();
  assert.equal(first.units.length,1);
  const reopened=await app.inject({method:"GET",url:`/api/loads/${load.id}/loading-session`});
  assert.equal(reopened.statusCode,200);
  assert.equal(reopened.json<{id:string;operatorId:string;carrierId:string;units:unknown[]}>().id,created.id);
  assert.equal(reopened.json<{operatorId:string}>().operatorId,operator.id);
  assert.equal(reopened.json<{carrierId:string}>().carrierId,carrier.id);
  assert.equal(reopened.json<{units:unknown[]}>().units.length,1);
  const unchanged=await app.inject({method:"PATCH",url:`/api/loading-sessions/${created.id}`,payload:{operatorId:operator.id,destinationType:"TRASPORTATORE",carrierId:carrier.id}});
  assert.equal(unchanged.statusCode,200);
  assert.equal(unchanged.json<{id:string;startedAt:string;units:unknown[]}>().id,created.id);
  assert.equal(unchanged.json<{startedAt:string}>().startedAt,created.startedAt);
  assert.equal(unchanged.json<{units:unknown[]}>().units.length,1);
  await app.inject({method:"PATCH",url:`/api/panels/${load.pannelli[2]!.id}/close-single`,payload:{operatorId:operator.id}});
  const continued=await app.inject({method:"POST",url:`/api/loading-sessions/${created.id}/units`,payload:{unitType:"PANEL",panelId:load.pannelli[1]!.id,operatorId:operator.id}});
  assert.equal(continued.statusCode,200);
  const continuedData=continued.json<{id:string;stato:string;units:unknown[];events:Array<{type:string}>}>();
  assert.equal(continuedData.id,created.id);
  assert.equal(continuedData.stato,"IN_CARICO");
  assert.equal(continuedData.units.length,2);
  assert.equal(continuedData.events.filter(event=>event.type==="LOADING_STARTED").length,1);
  assert.equal(continuedData.events.filter(event=>event.type==="UNIT_LOADED").length,2);
  await app.close();
});

test("il ritiro diretto salva la partenza effettiva e conclude la spedizione",async()=>{
  const app=await buildApp(config);
  try{const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!,carrier=(await app.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string}>>()[0]!,load=(await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("DIRECT-1","C1")])})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;await app.inject({method:"PATCH",url:`/api/panels/${load.pannelli[0]!.id}/close-single`,payload:{operatorId:operator.id}});const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"TRASPORTATORE",carrierId:carrier.id}})).json<{id:string}>();await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:load.pannelli[0]!.id,operatorId:operator.id}});const shipment=(await app.inject({method:"POST",url:"/api/shipments",payload:{loadId:load.id,commessa:"COMM-TEST",cliente:"Cliente Test",camion:"C1",plannedDepartureDate:"2026-09-15",transportType:"RITIRA_CLIENTE",trailerId:null,carrierId:null}})).json<{id:string}>();assert.equal((await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/ship`,payload:{carrierId:carrier.id}})).json<{stato:string}>().stato,"SPEDITO");const departed=(await app.inject({method:"GET",url:"/api/shipments"})).json<Array<{id:string;shipmentStatus:string;actualDepartureDate:string|null}>>().find(item=>item.id===shipment.id)!;assert.equal(departed.shipmentStatus,"CONCLUSA");assert.ok(departed.actualDepartureDate);}finally{await app.close();}
});

test("aggiornare la distinta blocca la rimozione di un pannello già caricato",async()=>{
  const app=await buildApp(config);const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;const trailer=(await app.inject({method:"GET",url:"/api/trailers"})).json<Array<{id:string}>>()[0]!;
  const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("R1","C1"),importedPanel("R2","C1")])})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
  for(const panel of load.pannelli)await app.inject({method:"PATCH",url:`/api/panels/${panel.id}/close-single`,payload:{operatorId:operator.id}});
  const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"RIMORCHIO_ESSEPI",trailerId:trailer.id}})).json<{id:string}>();
  await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:load.pannelli[1]!.id,operatorId:operator.id}});
  const update=await app.inject({method:"PUT",url:`/api/loads/${load.id}/import`,payload:importedLoad([importedPanel("R1","C1")],true)});
  assert.equal(update.statusCode,409);assert.equal(update.json().error.code,"MANIFEST_CONFLICT");
  const restored=await app.inject({method:"GET",url:`/api/loads/${load.id}/loading-session`});assert.equal(restored.json<{units:unknown[]}>().units.length,1);
  await app.close();
});

for(const deleteOrder of [false,true])test("audit reversibile 265587 e pianificazione eliminata: "+(deleteOrder?"commessa":"carico"),async()=>{
  const directory=mkdtempSync(join(tmpdir(),"reversible-audit-"));
  const databasePath=join(directory,"audit.sqlite");
  const app=await buildApp({...config,databasePath});
  const db=new DatabaseSync(databasePath);
  try{
    const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:{...importedLoad([importedPanel("1","C1-")]),commessa:"265587"}})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
    const input={loadId:load.id,commessa:"265587",cliente:"Cliente Test",camion:"C1-",plannedDepartureDate:"2026-09-20",transportType:"RITIRA_CLIENTE"};
    const plan=(await app.inject({method:"POST",url:"/api/shipments",payload:input})).json<{id:string}>();
    assert.equal((await app.inject({method:"PUT",url:`/api/shipments/${plan.id}`,payload:{...input,plannedDepartureDate:"2026-09-21"}})).statusCode,200);
    const trailer=(await app.inject({method:"GET",url:"/api/trailers"})).json<Array<{id:string}>>()[0]!;
    assert.equal((await app.inject({method:"POST",url:`/api/trailers/${trailer.id}/reservation`,payload:{commessa:"265587",cliente:"Cliente Test",carico:"C1",plannedDepartureDate:"2026-09-21"}})).statusCode,200);
    assert.equal((await app.inject({method:"DELETE",url:`/api/shipments/${plan.id}`})).statusCode,200);
    assert.equal(db.prepare("SELECT 1 FROM ShipmentPlans WHERE id=?").get(plan.id),undefined);
    assert.equal(db.prepare("SELECT 1 FROM TransportAssignments WHERE manualCommessa='265587'").get(),undefined);
    for(const type of ["PANEL_SCANNED","SINGLE_CLOSED","SCAN_CANCELLED","PACKAGE_OPENED","PANEL_ADDED_TO_PACKAGE","PACKAGE_CLOSED","PACKAGE_CANCELLED"])
      db.prepare("INSERT INTO OperationalEvents(id,loadId,type,timestamp) VALUES(?,?,?,?)").run(crypto.randomUUID(),load.id,type,"2026-09-02T14:02:46.334Z");
    const before=db.prepare("SELECT * FROM OperationalEvents WHERE loadId=? ORDER BY id").all(load.id);
    assert.equal(before.length,10);
    const result=await app.inject({method:"DELETE",url:deleteOrder?"/api/orders/265587":`/api/loads/${load.id}`});
    assert.equal(result.statusCode,204,result.body);
    const archived=db.prepare("SELECT eventJson FROM DeletedLoadAudit WHERE loadId=? ORDER BY eventId").all(load.id) as Array<{eventJson:string}>;
    assert.deepEqual(archived.map(row=>JSON.parse(row.eventJson)),before.map(row=>({...row})));
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length,0);
  }finally{db.close();await app.close();rmSync(directory,{recursive:true,force:true});}
});

for(const marker of ["event","shippedAt","SPEDITO"])test("blocca storico definitivo isolato: "+marker,async()=>{
  const directory=mkdtempSync(join(tmpdir(),"departure-marker-"));
  const databasePath=join(directory,"audit.sqlite");
  const app=await buildApp({...config,databasePath});const db=new DatabaseSync(databasePath);
  try{
    const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("1","C1")])})).json<Array<{id:string}>>()[0]!;
    const plan=(await app.inject({method:"POST",url:"/api/shipments",payload:{loadId:load.id,commessa:"TEST",cliente:"Test",camion:"C1",plannedDepartureDate:"2026-09-20",transportType:"RITIRA_CLIENTE"}})).json<{id:string}>();
    if(marker==="event")db.prepare("INSERT INTO OperationalEvents(id,loadId,type,timestamp) VALUES(?,?,'PARTENZA_CONFERMATA',?)").run(crypto.randomUUID(),load.id,"2026-09-02T14:00:00Z");
    else if(marker==="SPEDITO")db.prepare("UPDATE Loads SET stato='SPEDITO' WHERE id=?").run(load.id);
    else{
      const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;
      const carrier=(await app.inject({method:"GET",url:"/api/carriers"})).json<Array<{id:string}>>()[0]!;
      const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"TRASPORTATORE",carrierId:carrier.id}})).json<{id:string}>();
      db.prepare("UPDATE LoadingSessions SET shippedAt=? WHERE id=?").run("2026-09-02T14:00:00Z",session.id);
    }
    assert.equal((await app.inject({method:"DELETE",url:`/api/shipments/${plan.id}`})).statusCode,409);
    assert.equal((await app.inject({method:"DELETE",url:`/api/loads/${load.id}`})).statusCode,409);
    assert.ok(db.prepare("SELECT 1 FROM Loads WHERE id=?").get(load.id));
  }finally{db.close();await app.close();rmSync(directory,{recursive:true,force:true});}
});

test("Disimpegna: storico, pianificazione, reimpegno e sessione vuota", () => {
  const { database: db, close } = openSqliteDatabase(":memory:");
  const repo = new TransportRepository(db);
  try {
    db.exec(`INSERT INTO Trailers(id,plate,nextInspectionDate,createdAt,updatedAt) VALUES('T','AE 12345','2027-01-01','now','now');
      INSERT INTO Loads(id,commessa,cliente,camion,createdAt,updatedAt) VALUES('L','265001','Cliente','C1','now','now');
      INSERT INTO ShipmentPlans(id,loadId,transportType,plannedDepartureDate,createdAt,updatedAt) VALUES('P','L','BILICO_ESSEPI','2026-12-01','now','now');`);
    const plan = db.prepare("SELECT * FROM ShipmentPlans").get();
    const trailer = db.prepare("SELECT * FROM Trailers WHERE id='T'").get();
    const reserved = repo.reserve('T', {commessa:'265001',cliente:'Cliente',carico:'C1'})!;
    assert.equal(reserved.status, 'IMPEGNATO'); assert.equal(reserved.canRelease, true);
    const freed = repo.releaseReservation('T', reserved.assignmentId!)!;
    assert.equal(freed.status, 'DISPONIBILE'); assert.equal(freed.canRelease, false);
    for (const key of ['commessa','cliente','camion','plannedDepartureDate','loadingSessionId','assignmentId','loadId'] as const) assert.equal(freed[key], null);
    assert.deepEqual(db.prepare('SELECT * FROM ShipmentPlans').get(), plan);
    assert.deepEqual(db.prepare("SELECT * FROM Trailers WHERE id='T'").get(), trailer);
    const historical = db.prepare('SELECT * FROM TransportAssignments WHERE id=?').get(reserved.assignmentId!)!;
    assert.equal(historical.stato, 'CONCLUSO'); assert.ok(historical.releasedAt); assert.equal(historical.manualCommessa,'265001');
    const another = repo.reserve('T',{commessa:'OTHER',cliente:'Altro',carico:'C2'})!;
    assert.throws(()=>repo.releaseReservation('T',reserved.assignmentId!),/RESERVATION_NOT_RELEASABLE/);
    assert.equal(repo.find('T')!.assignmentId, another.assignmentId);
    repo.releaseReservation('T',another.assignmentId!);
    repo.reserve('T',{commessa:'265001',cliente:'Cliente',carico:'C1'});
    db.exec("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,trailerId,startedAt,createdAt,updatedAt) VALUES('S','L','DA_CARICARE','OP','RIMORCHIO_ESSEPI','T','now','now','now')");
    repo.assign('T','L','S');
    assert.equal(repo.find('T')!.source,'LOAD'); assert.equal(repo.find('T')!.canRelease,true);
    repo.releaseReservation('T');
    assert.equal(db.prepare("SELECT trailerId FROM LoadingSessions WHERE id='S'").get()!.trailerId,null);
    assert.equal(db.prepare("SELECT loadingSessionId FROM TransportAssignments WHERE source='LOAD'").get()!.loadingSessionId,'S');
    assert.deepEqual(db.prepare('SELECT * FROM ShipmentPlans').get(),plan);
    assert.equal(repo.reserve('T',{commessa:'265001',cliente:'Cliente',carico:'C1'})!.canRelease,true);
  } finally { close(); }
});

test("Disimpegna: controlli autorevoli e concorrenza dopo lettura pagina", async t => {
  const cases: Array<[string,string]> = [
    ['prima unità fisica',"INSERT INTO LoadingUnits(id,loadingSessionId,unitType,panelId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES('U','S','PANEL','X','now','OP','now','now')"],
    ['unità rimossa conserva inizio fisico',"INSERT INTO LoadingUnits(id,loadingSessionId,unitType,panelId,active,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES('U','S','PANEL','X',0,'now','OP','now','now')"],
    ['caricato',"UPDATE TransportAssignments SET stato='CARICATO'"],
    ['in viaggio',"UPDATE TransportAssignments SET stato='IN_VIAGGIO'"],
    ['concluso',"UPDATE TransportAssignments SET stato='CONCLUSO'"],
    ['partenza assegnazione',"UPDATE TransportAssignments SET departedAt='2026-09-29'"],
    ['carico in corso',"UPDATE LoadingSessions SET stato='IN_CARICO'"],
    ['attesa spedizione',"UPDATE LoadingSessions SET stato='ATTESA_SPEDIZIONE'"],
    ['spedito',"UPDATE LoadingSessions SET shippedAt='2026-09-29'"],
    ['completamento precedente',"UPDATE LoadingSessions SET completedAt='2026-09-29'"],
    ['riapertura',"UPDATE LoadingSessions SET reopenedAt='2026-09-29'"],
    ['stato carico',"UPDATE Loads SET stato='SPEDITO'"],
    ['pannello fisico',"UPDATE Panels SET stato='CARICATO'"],
    ['spedizione pianificata partita',"INSERT INTO ShipmentPlans(id,loadId,actualDepartureDate,createdAt,updatedAt) VALUES('P','L','2026-09-29','now','now')"],
    ['spedizione manuale partita',"INSERT INTO ShipmentPlans(id,manualCommessa,manualCarico,actualDepartureDate,createdAt,updatedAt) VALUES('P',' 265-001 ','C 1-','2026-09-29','now','now')"],
    ['storico fisico senza unità',"INSERT INTO OperationalEvents(id,loadId,loadingSessionId,type,timestamp) VALUES('E','L','S','UNIT_LOADED','now')"],
  ];
  for (const source of ['MANUAL','LOAD']) for (const [name,mutation] of cases) await t.test(`${source}: ${name}`,()=>{
    const {database:db,close}=openSqliteDatabase(':memory:'); const repo=new TransportRepository(db);
    try {
      db.exec(`INSERT INTO Trailers(id,plate,createdAt,updatedAt) VALUES('T','TEST','now','now');
        INSERT INTO Loads(id,commessa,cliente,camion,createdAt,updatedAt) VALUES('L','265001','Cliente','C1','now','now');
        INSERT INTO Panels(id,loadId,numeroPannello,camion,peso,volume,createdAt,updatedAt) VALUES('X','L','1','C1',1,1,'now','now');
        INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,startedAt,createdAt,updatedAt) VALUES('S','L','DA_CARICARE','OP','RIMORCHIO_ESSEPI','now','now','now');`);
      const before=repo.reserve('T',{commessa:'265-001',cliente:'Cliente',carico:'C 1-'})!;
      if(source==='LOAD') repo.assign('T','L','S');
      assert.equal(repo.find('T')!.canRelease,true);
      db.exec(mutation);
      assert.equal(repo.find('T')!.canRelease,false);
      assert.throws(()=>repo.releaseReservation('T',before.assignmentId!),/RESERVATION_NOT_RELEASABLE/);
      assert.equal(db.prepare('SELECT releasedAt FROM TransportAssignments').get()!.releasedAt,null);
    } finally { close(); }
  });
});

test("Disimpegna API: conferma obsoleta, rilascio e doppia richiesta", async()=>{
  const app=await buildApp(config);
  try {
    const trailer=(await app.inject({method:'GET',url:'/api/trailers'})).json<Array<{id:string}>>()[0]!;
    const url=`/api/trailers/${trailer.id}/reservation`;
    const reserved=await app.inject({method:'POST',url,payload:{commessa:'RELEASE',cliente:'Cliente',carico:'C1'}});
    assert.equal(reserved.statusCode,200); assert.equal(reserved.json().canRelease,true);
    const rejected=await app.inject({method:'DELETE',url:`${url}?assignmentId=obsolete`});
    assert.equal(rejected.statusCode,409); assert.equal(rejected.json().error.code,'RESERVATION_NOT_RELEASABLE');
    const freed=await app.inject({method:'DELETE',url:`${url}?assignmentId=${reserved.json().assignmentId}`});
    assert.equal(freed.statusCode,200); assert.equal(freed.json().status,'DISPONIBILE');
    assert.equal((await app.inject({method:'DELETE',url})).statusCode,409);
  } finally {await app.close();}
});

test("Disimpegna: seconda connessione, rollback e persistenza al riavvio",()=>{
  const directory=mkdtempSync(join(tmpdir(),'transport-release-'));
  const path=join(directory,'test.sqlite');
  const first=openSqliteDatabase(path), other=new DatabaseSync(path);
  try {
    const db=first.database,repo=new TransportRepository(db);
    db.exec(`INSERT INTO Trailers(id,plate,createdAt,updatedAt) VALUES('T','TEST','now','now');
      INSERT INTO Loads(id,commessa,cliente,camion,createdAt,updatedAt) VALUES('L','TEST','Cliente','C1','now','now');
      INSERT INTO Panels(id,loadId,numeroPannello,camion,createdAt,updatedAt) VALUES('X','L','1','C1','now','now');
      INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,trailerId,startedAt,createdAt,updatedAt) VALUES('S','L','DA_CARICARE','OP','RIMORCHIO_ESSEPI','T','now','now','now');`);
    repo.assign('T','L','S');
    const snapshot=repo.find('T')!;assert.equal(snapshot.canRelease,true);
    other.exec("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,panelId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES('U','S','PANEL','X','now','OP','now','now')");
    assert.throws(()=>repo.releaseReservation('T',snapshot.assignmentId!),/RESERVATION_NOT_RELEASABLE/);
    // Reset only this synthetic fixture to check atomic rollback on a write failure.
    other.exec("DELETE FROM LoadingUnits");
    db.exec("CREATE TRIGGER reject_release BEFORE UPDATE OF releasedAt ON TransportAssignments BEGIN SELECT RAISE(ABORT,'test failure'); END");
    assert.throws(()=>repo.releaseReservation('T'),/test failure/);
    assert.equal(db.prepare("SELECT trailerId FROM LoadingSessions WHERE id='S'").get()!.trailerId,'T');
    assert.equal(repo.find('T')!.assignmentId,snapshot.assignmentId);
    db.exec('DROP TRIGGER reject_release');
    repo.transaction(()=>{assert.throws(()=>other.exec('BEGIN IMMEDIATE'),/locked/);});
    repo.releaseReservation('T');
  } finally {other.close();first.close();}
  const reopened=openSqliteDatabase(path);
  try {
    assert.equal(new TransportRepository(reopened.database).find('T')!.status,'DISPONIBILE');
    assert.equal(reopened.database.prepare('SELECT COUNT(*) n FROM TransportAssignments').get()!.n,1);
  } finally {reopened.close();rmSync(directory,{recursive:true,force:true});}
});
import "./history.test.js";
import "./planningHistory.test.js";
import "./shipmentDocument.test.js";
