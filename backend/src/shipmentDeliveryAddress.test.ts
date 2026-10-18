import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildApp, seedDepartureDdtForApp } from "./fixtures/departureDdt.js";
import type { AppConfig } from "./config/environment.js";
import { migrateShipmentDeliveryAddress } from "./database/shipmentDeliveryAddressMigration.js";

const config = (): AppConfig => ({environment:"test",databasePath:join(mkdtempSync(join(tmpdir(),"sislog-address-")),"test.sqlite"),port:3198,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath:null,httpsKeyPath:null,httpsCertPath:null});
const input = {commessa:"ADDRESS-TEST",cliente:"Cliente distinto",camion:"C1",transportType:"RITIRA_CLIENTE",plannedDepartureDate:"2026-10-20"};
const address = "Cantiere Hotel\nVia Roma 12\n38010 Andalo (TN)";

test("indirizzo: migration legacy nullable, idempotente e senza inferenze dal cliente", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE ShipmentPlans(id TEXT PRIMARY KEY,manualCliente TEXT); INSERT INTO ShipmentPlans VALUES('old','Cliente storico')");
    migrateShipmentDeliveryAddress(db);
    assert.deepEqual({...db.prepare("SELECT * FROM ShipmentPlans").get()}, {id:"old",manualCliente:"Cliente storico",deliveryAddress:null});
    db.prepare("UPDATE ShipmentPlans SET deliveryAddress=? WHERE id='old'").run(address);
    migrateShipmentDeliveryAddress(db);
    assert.equal(db.prepare("SELECT deliveryAddress FROM ShipmentPlans").get()!.deliveryAddress,address);
    assert.equal(db.prepare("PRAGMA table_info(ShipmentPlans)").all().filter(row=>row.name==="deliveryAddress").length,1);
  } finally { db.close(); }
});

test("indirizzo API: facoltativo, modifica, omissione legacy, cancellazione e validazione tipo", async () => {
  const app = await buildApp(config());
  try {
    const empty = await app.inject({method:"POST",url:"/api/shipments",payload:input});
    assert.equal(empty.statusCode,200);assert.equal(empty.json().deliveryAddress,null);
    const id = empty.json().id;
    const update = async (body:object) => app.inject({method:"PUT",url:`/api/shipments/${id}`,payload:body});
    assert.equal((await update({...input,deliveryAddress:`  ${address}  `})).json().deliveryAddress,address);
    assert.equal((await update({...input,cliente:"Cliente modificato"})).json().deliveryAddress,address);
    assert.equal((await update({...input,deliveryAddress:{street:"invalid object"}})).statusCode,400);
    let plan = (await app.inject({method:"GET",url:"/api/shipments"})).json().find((p:{id:string})=>p.id===id);
    assert.equal(plan.deliveryAddress,address);
    const moved = await app.inject({method:"PUT",url:`/api/shipments/${id}`,payload:{plannedDepartureDate:"2026-10-21",expectedUpdatedAt:plan.updatedAt}});
    assert.equal(moved.statusCode,200);assert.equal(moved.json().deliveryAddress,address);
    assert.equal((await update({...input,deliveryAddress:null})).json().deliveryAddress,null);
    assert.equal((await update({...input,deliveryAddress:" \n "})).json().deliveryAddress,null);
    plan = (await app.inject({method:"GET",url:"/api/shipments"})).json().find((p:{id:string})=>p.id===id);
    assert.equal(plan.deliveryAddress,null);
  } finally { await app.close(); }
});

test("indirizzo: pianificazione manuale, collegamento al carico, partenza reale e riavvio", async () => {
  const cfg = config();let app = await buildApp(cfg);
  try {
    const planResponse = await app.inject({method:"POST",url:"/api/shipments",payload:{...input,deliveryAddress:address}});
    assert.equal(planResponse.statusCode,200);const id = planResponse.json().id;
    const imported = await app.inject({method:"POST",url:"/api/loads/import",payload:{commessa:input.commessa,cliente:input.cliente,numeroCliente:"",riferimentoOrdine:"Ordine separato",pannelli:[{numeroPannello:"1",numeroCliente:"",numeroMasterPanel:"1",camion:"C1",lato1:"",lato2:"",tipoPannello:"TEST",quantita:1,spessore:100,lunghezza:1000,altezza:1000,superficie:1,volume:.1,peso:50}]}});
    assert.equal(imported.statusCode,201);const load = imported.json()[0];
    assert.equal((await app.inject({method:"GET",url:"/api/shipments"})).json().find((p:{id:string})=>p.id===id).loadId,null);
    assert.equal((await app.inject({method:"PATCH",url:`/api/shipments/${id}/link`,payload:{loadId:load.id}})).statusCode,200);
    let plans = (await app.inject({method:"GET",url:"/api/shipments"})).json();
    assert.equal(plans.find((p:{id:string})=>p.id===id).loadId,load.id);
    assert.equal(plans.find((p:{id:string})=>p.id===id).deliveryAddress,address);
    const operatorId = (await app.inject({method:"GET",url:"/api/operators"})).json().find((o:{active:boolean})=>o.active).id;
    assert.equal((await app.inject({method:"PATCH",url:`/api/panels/${load.pannelli[0].id}/close-single`,payload:{operatorId}})).statusCode,200);
    const session = await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId,destinationType:"TRASPORTATORE",transportMode:"RITIRA_CLIENTE"}});
    assert.equal(session.statusCode,201);
    const sessionId = session.json().id;
    assert.equal((await app.inject({method:"POST",url:`/api/loading-sessions/${sessionId}/units`,payload:{operatorId,unitType:"PANEL",panelId:load.pannelli[0].id}})).statusCode,200);
    seedDepartureDdtForApp(app,sessionId);
    const shipped = await app.inject({method:"POST",url:`/api/loading-sessions/${sessionId}/ship`,payload:{operatorId}});
    assert.equal(shipped.statusCode,200);assert.equal(shipped.json().stato,"SPEDITO");
    await app.close();app = await buildApp(cfg);
    plans = (await app.inject({method:"GET",url:"/api/shipments"})).json();
    const final = plans.find((p:{id:string})=>p.id===id);
    assert.equal(final.deliveryAddress,address);assert.equal(final.cliente,input.cliente);
    assert.equal(final.shipmentStatus,"CONCLUSA");assert.ok(final.actualDepartureDate);
    assert.equal((await app.inject({method:"PUT",url:`/api/shipments/${id}`,payload:{...input,loadId:load.id,deliveryAddress:"Alterazione dopo partenza"}})).statusCode,409);
    assert.equal((await app.inject({method:"GET",url:"/api/shipments"})).json().find((p:{id:string})=>p.id===id).deliveryAddress,address);
  } finally { await app.close(); }
});
