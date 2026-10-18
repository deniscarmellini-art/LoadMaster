import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildApp } from "./app.js";
import { ddtPreview } from "./repositories/ddtPreviewRepository.js";
import { renderDdtPreview } from "./services/ddtPreviewPdf.js";

async function fixture(count = 20) {
  const dir=mkdtempSync(join(tmpdir(),"sislog-ddt-preview-"));
  const databasePath=join(dir,"test.sqlite");
  const app=await buildApp({environment:"test",databasePath,port:3198,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath:null,httpsKeyPath:null,httpsCertPath:null});
  const db=new DatabaseSync(databasePath); const now="2026-10-16T10:00:00Z";
  db.prepare("INSERT INTO Loads(id,commessa,cliente,camion,stato,createdAt,updatedAt) VALUES('load','TEST-265612','Cliente TEST importato','C1','IN_CARICO',?,?)").run(now,now);
  db.prepare("INSERT INTO Customers(id,denominazione,partitaIva,createdAt,updatedAt) VALUES('customer','Nome anagrafico differente','01949810160',?,?)").run(now,now);
  db.prepare("INSERT INTO Carriers(id,name,createdAt,updatedAt) VALUES('carrier','VETTORE TEST',?,?)").run(now,now);
  db.prepare("INSERT INTO ShipmentPlans(id,loadId,customerId,deliveryAddress,notes,createdAt,updatedAt) VALUES('plan','load','customer','Via TEST 12, Milano','Scarico concordato con il referente.',?,?)").run(now,now);
  db.prepare("UPDATE ShipmentPlans SET orderReference='RIF-SPEDIZIONE-2026' WHERE id='plan'").run();
  db.prepare("UPDATE Loads SET riferimentoOrdine='RIF-IMPORT-DIVERSO' WHERE id='load'").run();
  db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,carrierId,transportMode,startedAt,createdAt,updatedAt) VALUES('session','load','IN_CARICO','op','TRASPORTATORE','carrier','TERZI_PER_ESSEPI',?,?,?)").run(now,now,now);
  db.prepare("INSERT INTO Packages(id,codicePacco,loadId,commessa,cliente,camion,stato,operatoreId,openedAt,createdAt,updatedAt) VALUES('pack','P-001','load','TEST-265612','Cliente TEST importato','C1','CARICATO','op',?,?,?)").run(now,now,now);
  for(let i=0;i<count;i++){
    const id=`panel-${i}`,pack=i>=count-2?"pack":null;
    db.prepare("INSERT INTO Panels(id,loadId,numeroPannello,camion,tipoPannello,quantita,spessore,lunghezza,altezza,superficie,peso,packageId,stato,createdAt,updatedAt) VALUES(?,'load',?,'C1','CLT L5-140',1,140,4171,2373,9.9,693,?,'CARICATO',?,?)").run(id,`E-${String(i+1).padStart(3,"0")}`,pack,now,now);
    if(!pack)db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,panelId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES(?,'session','PANEL',? ,?,'op',?,?)").run(`unit-${i}`,id,now,now,now);
  }
  db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,packageId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES('unit-pack','session','PACKAGE','pack',?,'op',?,?)").run(now,now,now);
  // Planned material not loaded must never appear in the preview.
  db.prepare("INSERT INTO Panels(id,loadId,numeroPannello,camion,peso,stato,createdAt,updatedAt) VALUES('not-loaded','load','NOT-LOADED','C1',9999,'MANCANTE',?,?)").run(now,now);
  const snapshot=()=>JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row=>[row.name,db.prepare(`SELECT * FROM "${String(row.name).replaceAll('"','""')}" ORDER BY rowid`).all()]));
  return {app,db,snapshot,close:async()=>{db.close();await app.close();rmSync(dir,{recursive:true,force:true});}};
}

test("DDT preview: only active loaded material, packages once, imported identity and Rome date",async()=>{
  const f=await fixture();try{
    // Defensive deduplication even if legacy data loaded a child both ways.
    f.db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,panelId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES('duplicate-child','session','PANEL','panel-18','now','op','now','now')").run();
    f.db.prepare("UPDATE LoadingUnits SET active=0 WHERE panelId='panel-0'").run();
    const before=f.snapshot(), version=f.db.prepare("PRAGMA data_version").get();
    const model=ddtPreview(f.db,"session",new Date("2026-12-31T23:30:00Z"));
    assert.equal(model.customer,"Cliente TEST importato");assert.equal(model.vat,"01949810160");
    assert.equal(model.orderReference,"RIF-SPEDIZIONE-2026");assert.equal(model.truck,"C1");
    assert.equal(model.reference,"X-Lam/ANTEPRIMA/2027");assert.equal(model.date,"01/01/2027");
    assert.equal(model.totals.elements,19);assert.equal(model.totals.weight,19*693);
    assert.equal(model.groups[0]!.packageId,null);assert.equal(model.groups[1]!.packageId,"pack");
    assert.equal(new Set(model.groups.flatMap(g=>g.elements.map(p=>p.id))).size,19);
    assert.ok(!model.groups.flatMap(g=>g.elements).some(p=>p.id==="not-loaded"||p.id==="panel-0"));
    const available=await f.app.inject({method:"GET",url:"/api/loading-sessions/session/ddt-preview/availability"});
    assert.equal(available.statusCode,200);assert.equal(available.json().available,true);assert.equal(f.snapshot(),before);
    const response=await f.app.inject({method:"GET",url:"/api/loading-sessions/session/ddt-preview"});
    assert.equal(response.statusCode,200);assert.match(response.headers["content-type"]!,/application\/pdf/);
    assert.equal(response.rawPayload.subarray(0,5).toString(),"%PDF-");assert.equal(response.headers["cache-control"],"no-store");
    assert.equal(f.snapshot(),before);assert.deepEqual(f.db.prepare("PRAGMA data_version").get(),version);
    assert.equal((await f.app.inject({method:"GET",url:"/api/loading-sessions/session/ddt-preview"})).statusCode,200);
    assert.equal(f.snapshot(),before);
  }finally{await f.close();}
});

test("DDT header: optional reference/truck and linked planning are read-only",async()=>{
  const f=await fixture(4);try{
    f.db.prepare("INSERT INTO ShipmentPlans(id,manualCommessa,manualCliente,manualCarico,orderReference,createdAt,updatedAt) VALUES('manual','TEST-265612','Test','C1','WRONG-MANUAL','now','now')").run();
    f.db.prepare("UPDATE ShipmentPlans SET orderReference=NULL WHERE id='plan'").run();
    f.db.prepare("UPDATE Loads SET camion='' WHERE id='load'").run();
    const before=f.snapshot(),model=ddtPreview(f.db,"session");
    assert.equal(model.orderReference,"");assert.equal(model.truck,"");
    assert.ok(renderDdtPreview(model).pages>=1);assert.equal(f.snapshot(),before);
  }finally{await f.close();}
});

test("DDT header: long identity fields wrap on every page without changing material",async()=>{
  const f=await fixture(80);try{
    f.db.prepare("UPDATE Loads SET cliente=?,camion=? WHERE id='load'").run("Cliente con denominazione estesa e reparto operativo ".repeat(2),"CAMION-TRASPORTO-ESTESO-123456789");
    f.db.prepare("UPDATE ShipmentPlans SET orderReference=?,deliveryAddress=?,notes=? WHERE id='plan'").run("ORDINE-CLIENTE-2026-123456789 ".repeat(3),"Via della destinazione con indicazioni per lo scarico, ingresso dal cancello principale, Milano","Contattare il referente prima dello scarico. Accesso concordato e consegna al reparto materiali.");
    const before=f.snapshot(),model=ddtPreview(f.db,"session",new Date("2026-10-16T10:00:00Z")),result=renderDdtPreview(model);
    assert.ok(result.pages>1);assert.equal(result.placements.length,80);
    assert.equal(new Set(result.placements.map(p=>p.elementId)).size,80);
    assert.ok(result.placements.every(p=>p.bottom<=700));assert.equal(result.summaryPage,result.pages);
    assert.equal(model.totals.weight,80*693);assert.equal(f.snapshot(),before);
    if(process.env.DDT_PREVIEW_QA_DIR){const dir=resolve(process.env.DDT_PREVIEW_QA_DIR);mkdirSync(dir,{recursive:true});writeFileSync(join(dir,"anteprima-ddt-testi-lunghi.pdf"),result.pdf);}
  }finally{await f.close();}
});

test("DDT preview: missing required data and render errors have no writes",async()=>{
    for(const [sql,expected] of [
      ["UPDATE ShipmentPlans SET customerId=NULL","anagrafica cliente"],
      ["UPDATE Customers SET partitaIva=''","partita IVA"],
      ["UPDATE ShipmentPlans SET deliveryAddress=NULL","destinazione"],
      ["UPDATE LoadingSessions SET carrierId='missing'","vettore effettivo"],
      ["UPDATE Panels SET tipoPannello='' WHERE id='panel-0'","tipologia"],
      ["UPDATE Panels SET peso=0 WHERE id='panel-0'","peso"],
      ["UPDATE LoadingUnits SET active=0","nessuna unità"],
      ["UPDATE ShipmentPlans SET notes='"+"note ".repeat(1000)+"'","troppo lunga"],
    ]) {
      const f=await fixture(4);try{
      f.db.exec(sql!);const before=f.snapshot();
      const response=await f.app.inject({method:"GET",url:"/api/loading-sessions/session/ddt-preview"});
      assert.equal(response.statusCode,422,response.body);assert.match(response.json().error.message,new RegExp(expected!));
      assert.equal(f.snapshot(),before);
      assert.equal((await f.app.inject({method:"GET",url:"/api/loading-sessions/missing/ddt-preview"})).statusCode,404);
      }finally{await f.close();}
    }
});

test("DDT preview: one/multiple pages, row boundaries, repeated groups and final summary",async()=>{
  for(const count of [4,20,80]){
    const f=await fixture(count);try{
      const model=ddtPreview(f.db,"session",new Date("2026-10-16T10:00:00Z"));
      const result=renderDdtPreview(model);
      assert.equal(result.placements.length,count);assert.equal(new Set(result.placements.map(p=>p.elementId)).size,count);
      assert.equal(result.summaryPage,result.pages);assert.equal(count===4?result.pages===1:result.pages>1,true);
      for(const p of result.placements){assert.ok(p.top>=356);assert.ok(p.bottom<=700);}
      if(process.env.DDT_PREVIEW_QA_DIR){const dir=resolve(process.env.DDT_PREVIEW_QA_DIR);mkdirSync(dir,{recursive:true});writeFileSync(join(dir,`anteprima-ddt-${count}-elementi.pdf`),result.pdf);}
    }finally{await f.close();}
  }
});

test("DDT preview: a package continues across pages without repeating elements",async()=>{
  const f=await fixture(40);try{
    f.db.exec("UPDATE Panels SET packageId='pack' WHERE id<>'not-loaded'; DELETE FROM LoadingUnits WHERE unitType='PANEL'");
    const model=ddtPreview(f.db,"session");
    const result=renderDdtPreview(model);
    assert.equal(model.groups.length,1);assert.equal(model.groups[0]!.packageId,"pack");
    assert.equal(result.placements.length,40);assert.equal(new Set(result.placements.map(p=>p.elementId)).size,40);
    assert.ok(result.pages>=3);assert.ok(result.placements.every(p=>p.group==="PACCO P-001"));
    assert.ok(new Set(result.placements.map(p=>p.page)).size>=3);
  }finally{await f.close();}
});

for(const [mode,subject,label] of [
 ["BILICO_ESSEPI","MITTENTE","Trasporto a cura del mittente"],
 ["RITIRA_CLIENTE","DESTINATARIO","Trasporto a cura del destinatario"],
 ["TERZI_PER_ESSEPI","VETTORE","Trasporto a cura del vettore"],
] as const)test(`DDT responsabilita e vettore effettivo: ${mode}`,async()=>{
 const f=await fixture(4);try{
  f.db.prepare("UPDATE LoadingSessions SET transportMode=?,carrierId=?").run(mode,mode==="RITIRA_CLIENTE"?null:"carrier");
  f.db.prepare("UPDATE ShipmentPlans SET plannedCarrierId='carrier',transportMode='BILICO_ESSEPI'").run();
  const before=f.snapshot(),model=ddtPreview(f.db,"session");
  assert.equal(model.transport.responsibility,subject);assert.equal(model.transport.responsibilityLabel,label);
  assert.equal(model.transport.carrierName,mode==="RITIRA_CLIENTE"?null:"VETTORE TEST");
  assert.ok(model.carrier.startsWith(label));assert.equal(renderDdtPreview(model).pages,1);
  assert.equal((await f.app.inject({method:"GET",url:"/api/loading-sessions/session/ddt-preview"})).statusCode,200);
  assert.equal(f.snapshot(),before);
  f.db.prepare("UPDATE LoadingSessions SET carrierId=NULL").run();
  if(mode==="RITIRA_CLIENTE"){
   assert.equal(ddtPreview(f.db,"session").carrier,label);
   f.db.prepare("UPDATE LoadingSessions SET carrierId='missing'").run();
   assert.equal(ddtPreview(f.db,"session").carrier,label);
  }else{
   const missing=f.snapshot();assert.throws(()=>ddtPreview(f.db,"session"),/vettore effettivo confermato/);
   const response=await f.app.inject({method:"GET",url:"/api/loading-sessions/session/ddt-preview/availability"});
   assert.equal(response.json().available,false);assert.equal(f.snapshot(),missing);
  }
 }finally{await f.close();}
});
test("DDT: modalita effettiva mancante non viene inferita dal vettore o dal Calendario",async()=>{
 const f=await fixture(4);try{
  f.db.prepare("UPDATE LoadingSessions SET transportMode=NULL").run();
  f.db.prepare("UPDATE ShipmentPlans SET transportMode='TERZI_PER_ESSEPI',plannedCarrierId='carrier'").run();
  const before=f.snapshot();assert.throws(()=>ddtPreview(f.db,"session"),/modalit. effettiva/);assert.equal(f.snapshot(),before);
 }finally{await f.close();}
});
