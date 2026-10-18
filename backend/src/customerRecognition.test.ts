import assert from "node:assert/strict";
import test from "node:test";
import { openSqliteDatabase } from "./database/sqliteDatabase.js";
import { recognizeCustomer } from "./repositories/customerRecognition.js";
import { ShipmentRepository } from "./repositories/shipmentRepository.js";
import { ddtPreview } from "./repositories/ddtPreviewRepository.js";
import { buildApp } from "./app.js";
import { customerFields } from "./models/customer.js";

function fixture() {
  const connection = openSqliteDatabase(":memory:"), db = connection.database;
  const now = "2026-10-16T10:00:00Z", original = "LiNeA  Forma Srl";
  db.prepare("INSERT INTO Loads(id,commessa,cliente,camion,stato,createdAt,updatedAt) VALUES('load','SL-2604',?,'DELTA-04','IN_CARICO',?,?)").run(original,now,now);
  db.prepare("INSERT INTO Carriers(id,name,createdAt,updatedAt) VALUES('carrier','Vettore TEST',?,?)").run(now,now);
  db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,carrierId,transportMode,startedAt,createdAt,updatedAt) VALUES('session','load','IN_CARICO','op','TRASPORTATORE','carrier','TERZI_PER_ESSEPI',?,?,?)").run(now,now,now);
  db.prepare("INSERT INTO Panels(id,loadId,numeroPannello,camion,tipoPannello,quantita,lunghezza,altezza,superficie,peso,stato,createdAt,updatedAt) VALUES('panel','load','E1','DELTA-04','CLT L5-140',1,4000,2000,8,560,'CARICATO',?,?)").run(now,now);
  db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,panelId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES('unit','session','PANEL','panel',?,'op',?,?)").run(now,now,now);
  const customer = (id:string, name=" linea   FORMA srl ",vat="00123456789") => db.prepare("INSERT INTO Customers(id,denominazione,partitaIva,createdAt,updatedAt) VALUES(?,?,?,?,?)").run(id,name,vat,now,now);
  const legacy = () => db.prepare("INSERT INTO ShipmentPlans(id,loadId,deliveryAddress,createdAt,updatedAt) VALUES('legacy','load','Cantiere TEST',?,?)").run(now,now);
  const input = {loadId:"load",commessa:"SL-2604",cliente:"Nome payload da non usare",camion:"DELTA-04",transportType:"RITIRA_CLIENTE" as const,deliveryAddress:"Cantiere TEST",plannedDepartureDate:"2026-10-20"};
  const snapshot = () => JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row => [row.name,db.prepare(`SELECT * FROM "${String(row.name).replaceAll('"','""')}" ORDER BY rowid`).all()]));
  return {db,customer,legacy,input,original,snapshot,repo:new ShipmentRepository(db,true),close:()=>connection.close()};
}

test("customer recognition: only exact name, ignoring case and surplus spaces",()=>{
  const f=fixture();try {
    f.customer("unique");
    assert.deepEqual(recognizeCustomer(f.db,"LINEA\t Forma   Srl "),{customerId:"unique",status:"UNIQUE"});
    for(const name of ["Linea Forma S.r.l.","Linea Forma","Linea Fòrma Srl","", "LineaForma Srl"])
      assert.deepEqual(recognizeCustomer(f.db,name),{customerId:null,status:"NONE"});
    f.customer("duplicate","Linea Forma Srl","00999999999");
    assert.deepEqual(recognizeCustomer(f.db,"Linea Forma Srl"),{customerId:null,status:"AMBIGUOUS"});
  } finally {f.close();}
});

test("customer recognition: create/update/date edits use imported name and preserve explicit links",()=>{
  const f=fixture();try {
    f.customer("exact");
    const plan=f.repo.create(f.input);assert.equal(plan.customerId,"exact");assert.equal(plan.cliente,f.original);
    f.customer("manual","Altro cliente selezionato","00222222222");
    const selected=f.repo.update(plan.id,{...f.input,customerId:"manual"})!;assert.equal(selected.customerId,"manual");
    assert.equal(f.repo.update(plan.id,{...f.input,customerId:null})!.customerId,"manual");
    assert.equal(f.repo.update(plan.id,f.input)!.customerId,"manual");
    f.db.prepare("UPDATE ShipmentPlans SET customerId=NULL WHERE id=?").run(plan.id);
    assert.equal(f.repo.update(plan.id,f.input)!.customerId,"exact");
    f.db.prepare("UPDATE ShipmentPlans SET customerId=NULL WHERE id=?").run(plan.id);
    const current=f.repo.find(plan.id,false)!;
    assert.equal(f.repo.update(plan.id,{plannedDepartureDate:"2026-10-21",expectedUpdatedAt:current.updatedAt!})!.customerId,"exact");
    const audit=f.db.prepare("SELECT note FROM OperationalEvents WHERE type='SHIPMENT_PLAN_UPDATED' ORDER BY rowid DESC LIMIT 1").get()!;
    assert.equal(JSON.parse(String(audit.note)).after.customerId,"exact");
  } finally {f.close();}
});

test("customer recognition: zero/multiple matches never choose; manual selection resolves ambiguity",()=>{
  for(const duplicate of [false,true]) {
    const f=fixture();try {
      if(duplicate){f.customer("one");f.customer("two");}
      const plan=f.repo.create(f.input);assert.equal(plan.customerId,null);
      assert.equal(f.repo.update(plan.id,f.input)!.customerId,null);
      assert.throws(()=>ddtPreview(f.db,"session",new Date(),true),duplicate?/più clienti.*Selezionare esplicitamente/:/nessuna corrispondenza.*Selezionare esplicitamente/);
      f.customer("manual","Cliente scelto manualmente","00222222222");
      assert.equal(f.repo.update(plan.id,{...f.input,customerId:"manual"})!.customerId,"manual");
      const model=ddtPreview(f.db,"session",new Date(),true);
      assert.equal(model.customer,f.original);assert.equal(model.vat,"00222222222");
    } finally {f.close();}
  }
});

test("DDT legacy: unique customer resolves read-only, original name and correct VAT retained",()=>{
  const f=fixture();try {
    f.legacy();f.customer("exact");
    const before=f.snapshot(), changes=f.db.prepare("SELECT total_changes() n").get()!.n;
    const model=ddtPreview(f.db,"session",new Date(),true);
    assert.equal(model.customer,f.original);assert.equal(model.vat,"00123456789");
    assert.equal(f.db.prepare("SELECT customerId FROM ShipmentPlans WHERE id='legacy'").get()!.customerId,null);
    assert.equal(f.snapshot(),before);assert.equal(f.db.prepare("SELECT total_changes() n").get()!.n,changes);
    f.customer("explicit","Denominazione diversa","00888888888");
    f.db.prepare("UPDATE ShipmentPlans SET customerId='explicit' WHERE id='legacy'").run();
    assert.equal(ddtPreview(f.db,"session",new Date(),true).vat,"00888888888");
    // Legacy mode is unchanged outside TEST.
    f.db.prepare("UPDATE ShipmentPlans SET customerId=NULL WHERE id='legacy'").run();
    assert.throws(()=>ddtPreview(f.db,"session"),/collegare l'anagrafica cliente/);
  } finally {f.close();}
});

test("customer recognition API: linked import beats form name; association survives manual save",async()=>{
  const app=await buildApp({environment:"test",databasePath:":memory:",port:3199,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath:null,httpsKeyPath:null,httpsCertPath:null});
  try {
    const fields=Object.fromEntries(customerFields.map(field=>[field,""]));
    const customer=await app.inject({method:"POST",url:"/api/customers",payload:{...fields,denominazione:"LINEA Forma Srl",partitaIva:"00123456789"}});
    assert.equal(customer.statusCode,201,customer.body);
    const imported=await app.inject({method:"POST",url:"/api/loads/import",payload:{commessa:"SL-2604",cliente:"Linea  Forma Srl",numeroCliente:"",riferimentoOrdine:"ORD-TEST",pannelli:[{numeroPannello:"E1",numeroCliente:"",numeroMasterPanel:"1",camion:"DELTA-04",lato1:"",lato2:"",tipoPannello:"CLT",quantita:1,spessore:140,lunghezza:4000,altezza:2000,superficie:8,volume:1.12,peso:560}]}});
    assert.equal(imported.statusCode,201,imported.body);
    const input={loadId:imported.json()[0].id,commessa:"SL-2604",cliente:"Nome form differente",camion:"DELTA-04",transportType:"RITIRA_CLIENTE",customerId:null};
    const saved=await app.inject({method:"POST",url:"/api/shipments",payload:input});
    assert.equal(saved.statusCode,200,saved.body);assert.equal(saved.json().customerId,customer.json().id);
    const updated=await app.inject({method:"PUT",url:`/api/shipments/${saved.json().id}`,payload:{...input,deliveryAddress:"Via cantiere"}});
    assert.equal(updated.statusCode,200,updated.body);assert.equal(updated.json().customerId,customer.json().id);
    assert.equal(updated.json().cliente,"Linea  Forma Srl");
  } finally {await app.close();}
});
