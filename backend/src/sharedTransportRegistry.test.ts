import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { migrateSharedTransportRegistry } from "./database/sharedTransportRegistryMigration.js";
import { buildApp, seedDepartureDdtForApp } from "./fixtures/departureDdt.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("shared registry migration preserves identities, combined values and unknowns; confirmed Sulpizii is unique",()=>{
 const db=new DatabaseSync(":memory:");
 try {
  db.exec(`CREATE TABLE Carriers(id TEXT PRIMARY KEY,name TEXT,active INTEGER,sortOrder INTEGER,createdAt TEXT,updatedAt TEXT);
   CREATE TABLE ClientVehicleTypes(id TEXT PRIMARY KEY,name TEXT,active INTEGER,sortOrder INTEGER,createdAt TEXT,updatedAt TEXT);
   CREATE TABLE ThirdPartyTransportModes(id TEXT PRIMARY KEY,name TEXT,active INTEGER,sortOrder INTEGER,createdAt TEXT,updatedAt TEXT);
   CREATE TABLE ShipmentPlans(id TEXT PRIMARY KEY,transportMode TEXT,transportDetailId TEXT,transportDetailLabel TEXT,plannedCarrierId TEXT);
   INSERT INTO Carriers VALUES('C','Cristelli',1,0,'old','old');
   INSERT INTO ClientVehicleTypes VALUES('T','Motrice',1,0,'old','old');
   INSERT INTO ThirdPartyTransportModes VALUES('M','Cristelli Motrice',1,0,'old','old'),('S1','Sulpizii Ferro',1,0,'old','old'),('S2','Sulpizii Alluminio',1,0,'old','old'),('X','Sconosciuto Mezzo',1,0,'old','old');
   INSERT INTO ShipmentPlans VALUES('P','TERZI_PER_ESSEPI','M','Cristelli Motrice',NULL),('U','TERZI_PER_ESSEPI','X','Sconosciuto Mezzo',NULL);`);
  const oldModes=db.prepare("SELECT * FROM ThirdPartyTransportModes").all();
  migrateSharedTransportRegistry(db);
  const plan=db.prepare("SELECT * FROM ShipmentPlans WHERE id='P'").get()!;
  assert.equal(plan.plannedCarrierId,'C');assert.equal(plan.vehicleTypeId,'T');assert.equal(plan.transportDetailLabel,'Cristelli Motrice');
  assert.equal(db.prepare("SELECT plannedCarrierId FROM ShipmentPlans WHERE id='U'").get()!.plannedCarrierId,null);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM Carriers WHERE name='Sulpizii'").get()!.n,1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ClientVehicleTypes").get()!.n,3);
  assert.deepEqual(db.prepare("SELECT * FROM ThirdPartyTransportModes").all(),oldModes);
  const snapshot=db.prepare("SELECT * FROM ShipmentPlans").all();migrateSharedTransportRegistry(db);
  assert.deepEqual(db.prepare("SELECT * FROM ShipmentPlans").all(),snapshot);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM Carriers").get()!.n,2);
  db.exec("UPDATE ShipmentPlans SET plannedCarrierId=NULL,vehicleTypeId=NULL WHERE id='P'");
  migrateSharedTransportRegistry(db);
  assert.equal(db.prepare("SELECT vehicleTypeId FROM ShipmentPlans WHERE id='P'").get()!.vehicleTypeId,null);
 } finally {db.close();}
});

test("shared carrier and vehicle survive linked load departure without changing legacy loading rules",async()=>{
 const config={environment:"test" as const,databasePath:join(mkdtempSync(join(tmpdir(),"shared-departure-")),"test.sqlite"),port:3194,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath:null,httpsKeyPath:null,httpsCertPath:null};
 let app=await buildApp(config);
 try {
  const req=async(method:"GET"|"POST"|"PATCH",url:string,payload?:object)=>{const response=await app.inject({method,url,...(payload?{payload}:{})});assert.ok(response.statusCode<400,response.body);return response.json();};
  const carrier=(await req("GET","/api/carriers"))[0];
  const type=await req("POST","/api/client-vehicle-types",{name:"Ferro"});
  const plan=await req("POST","/api/shipments",{commessa:"SHARED-DEPARTURE",cliente:"Cliente",camion:"C1",transportType:"TERZI_PER_ESSEPI",plannedCarrierId:carrier.id,vehicleTypeId:type.id});
  const [load]=await req("POST","/api/loads/import",{commessa:"SHARED-DEPARTURE",cliente:"Cliente",numeroCliente:"",riferimentoOrdine:"",pannelli:[{numeroPannello:"1",numeroCliente:"",numeroMasterPanel:"1",camion:"C1",lato1:"",lato2:"",tipoPannello:"TEST",quantita:1,spessore:100,lunghezza:1000,altezza:1000,superficie:1,volume:.1,peso:50}]});
  assert.equal((await req("GET","/api/shipments")).find((p:{id:string})=>p.id===plan.id).loadId,null);
  await req("PATCH",`/api/shipments/${plan.id}/link`,{loadId:load.id});
  const operatorId=(await req("GET","/api/operators"))[0].id;
  await req("PATCH",`/api/panels/${load.pannelli[0].id}/close-single`,{operatorId});
  const session=await req("POST",`/api/loads/${load.id}/loading-session`,{operatorId,destinationType:"TRASPORTATORE",transportMode:"TERZI_PER_ESSEPI",transportDetailId:type.id,carrierId:carrier.id});
  await req("POST",`/api/loading-sessions/${session.id}/units`,{operatorId,unitType:"PANEL",panelId:load.pannelli[0].id});
  seedDepartureDdtForApp(app,session.id);
  const departed=await req("POST",`/api/shipments/${plan.id}/depart`,{operatorId});
  assert.equal(departed.shipmentStatus,"CONCLUSA");assert.equal(departed.plannedCarrierId,carrier.id);assert.equal(departed.vehicleTypeId,type.id);
  await app.close();app=await buildApp(config);
  const restored=(await req("GET","/api/shipments")).find((p:{id:string})=>p.id===plan.id);
  assert.equal(restored.plannedCarrierId,carrier.id);assert.equal(restored.vehicleTypeId,type.id);assert.ok(restored.actualDepartureDate);
 } finally {await app.close();}
});

test("shared carrier API: independent combinations, edit, restart, inactive and invalid IDs",async()=>{
 const config={environment:"test" as const,databasePath:join(mkdtempSync(join(tmpdir(),"shared-carriers-")),"test.sqlite"),port:3194,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath:null,httpsKeyPath:null,httpsCertPath:null};
 let app=await buildApp(config);
 try {
  const carrier=(await app.inject({method:"GET",url:"/api/carriers"})).json()[0];
  const type=(await app.inject({method:"POST",url:"/api/client-vehicle-types",payload:{name:"Mezzo indipendente"}})).json();
  const input={commessa:"SHARED",cliente:"Cliente",transportType:"TERZI_PER_ESSEPI",plannedCarrierId:carrier.id,vehicleTypeId:type.id};
  const response=await app.inject({method:"POST",url:"/api/shipments",payload:input});assert.equal(response.statusCode,200,response.body);
  const plan=response.json();assert.equal(plan.plannedCarrierId,carrier.id);assert.equal(plan.vehicleTypeId,type.id);assert.equal(plan.transportDetailId,null);
  const invalid=await app.inject({method:"PUT",url:`/api/shipments/${plan.id}`,payload:{...input,vehicleTypeId:"unknown"}});assert.equal(invalid.statusCode,400);
  const bilico=await app.inject({method:"POST",url:"/api/shipments",payload:{commessa:"BILICO",cliente:"Cliente",transportType:"BILICO_ESSEPI",transportDetailId:carrier.id}});assert.equal(bilico.statusCode,200);assert.equal(bilico.json().plannedCarrierId,plan.plannedCarrierId);
  const optional=await app.inject({method:"POST",url:"/api/shipments",payload:{commessa:"OPTIONAL",cliente:"Cliente",transportType:"TERZI_PER_ESSEPI"}});assert.equal(optional.statusCode,200);
  const db=new DatabaseSync(config.databasePath);db.prepare("UPDATE Carriers SET active=0 WHERE id=?").run(carrier.id);db.prepare("UPDATE ClientVehicleTypes SET active=0 WHERE id=?").run(type.id);db.close();
  const retained=await app.inject({method:"PUT",url:`/api/shipments/${plan.id}`,payload:{...input,notes:"Updated"}});assert.equal(retained.statusCode,200,retained.body);
  const inactive=await app.inject({method:"POST",url:"/api/shipments",payload:{...input,commessa:"INACTIVE"}});assert.equal(inactive.statusCode,400);
  await app.close();app=await buildApp(config);
  const restored=(await app.inject({method:"GET",url:"/api/shipments"})).json().find((p:{id:string})=>p.id===plan.id);
  assert.equal(restored.vehicleTypeId,type.id);assert.equal(restored.plannedCarrierId,carrier.id);assert.equal(restored.notes,"Updated");
 } finally {await app.close();}
});
