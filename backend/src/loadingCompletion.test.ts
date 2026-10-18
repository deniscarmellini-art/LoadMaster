import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildApp, seedDepartureDdtForApp } from "./fixtures/departureDdt.js";
import { LoadingRepository } from "./repositories/loadingRepository.js";
import { LoadingService } from "./services/loadingService.js";
import { TransportRepository } from "./repositories/transportRepository.js";

for (const mode of ["BILICO_ESSEPI", "RITIRA_CLIENTE", "TERZI_PER_ESSEPI"] as const) {
  test(`completamento separato dalla partenza: ${mode}, risorse e seconda connessione`, async () => {
    const dir=mkdtempSync(join(tmpdir(),"sislog-completion-")),databasePath=join(dir,"test.sqlite");
    const app=await buildApp({environment:"test",databasePath,port:3198,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath:null,httpsKeyPath:null,httpsCertPath:null});
    const db=new DatabaseSync(databasePath),other=new DatabaseSync(databasePath);
    const transport=new TransportRepository(other),concurrent=new LoadingService(new LoadingRepository(other,transport),transport);
    const snapshot=()=>Object.fromEntries(["Loads","LoadingSessions","Panels","Packages","LoadingUnits","ShipmentPlans","TransportAssignments","OperationalEvents"].map(table=>[table,db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
    try {
      const operatorId=String(db.prepare("SELECT id FROM Operators WHERE active=1 LIMIT 1").get()!.id);
      const carrierId=String(db.prepare("SELECT id FROM Carriers WHERE active=1 LIMIT 1").get()!.id);
      const trailerId=String(db.prepare("SELECT id FROM Trailers WHERE active=1 LIMIT 1").get()!.id);
      const detail=await app.inject({method:"POST",url:"/api/third-party-transport-modes",payload:{name:"TEST completion",active:true}});
      const detailId=detail.json<{id:string}>().id;
      const payload={commessa:"COMPLETION-TEST",cliente:"Test",numeroCliente:"",riferimentoOrdine:"TEST",pannelli:[{numeroPannello:"E1",numeroCliente:"",numeroMasterPanel:"1",camion:"C1",lato1:"",lato2:"",tipoPannello:"CLT",quantita:1,spessore:100,lunghezza:1000,altezza:1000,superficie:1,volume:.1,peso:50}]};
      const imported=await app.inject({method:"POST",url:"/api/loads/import",payload});assert.equal(imported.statusCode,201);
      const load=imported.json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
      const planned=await app.inject({method:"POST",url:"/api/shipments",payload:{loadId:load.id,commessa:payload.commessa,cliente:payload.cliente,camion:"C1",transportType:mode,...(mode==="TERZI_PER_ESSEPI"?{plannedCarrierId:carrierId}:{})}});
      assert.equal(planned.statusCode,200);const planId=planned.json<{id:string}>().id;
      if(mode==="BILICO_ESSEPI")assert.equal((await app.inject({method:"POST",url:`/api/trailers/${trailerId}/reservation`,payload:{commessa:payload.commessa,cliente:payload.cliente,carico:"C1"}})).statusCode,200);
      const created=await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId,destinationType:mode==="BILICO_ESSEPI"?"RIMORCHIO_ESSEPI":"TRASPORTATORE",transportMode:mode,...(mode==="BILICO_ESSEPI"?{carrierId}:mode==="TERZI_PER_ESSEPI"?{transportDetailId:detailId}:{})}});
      assert.equal(created.statusCode,201);const id=created.json<{id:string}>().id;
      const complete=()=>app.inject({method:"POST",url:`/api/loading-sessions/${id}/complete`});
      const beforeIncomplete=snapshot();assert.equal((await complete()).statusCode,409);assert.deepEqual(snapshot(),beforeIncomplete);
      assert.equal((await app.inject({method:"PATCH",url:`/api/panels/${load.pannelli[0]!.id}/close-single`,payload:{operatorId}})).statusCode,200);
      const loaded=await app.inject({method:"POST",url:`/api/loading-sessions/${id}/units`,payload:{operatorId,unitType:"PANEL",panelId:load.pannelli[0]!.id}});
      assert.equal(loaded.statusCode,200);const unitId=loaded.json<{units:Array<{id:string}>}>().units[0]!.id;
      const stale=concurrent.get(id);assert.equal(stale.stato,"ATTESA_SPEDIZIONE");assert.equal(stale.closureConfirmedAt,null);
      const automaticallyReady=snapshot();
      const response=await complete();assert.equal(response.statusCode,200,response.body);
      assert.equal(response.json().stato,"ATTESA_SPEDIZIONE");assert.ok(response.json().closureConfirmedAt);
      const explicitlyClosed=snapshot();
      for(const table of Object.keys(automaticallyReady))if(table!=="OperationalEvents")assert.deepEqual(explicitlyClosed[table],automaticallyReady[table]);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM OperationalEvents WHERE loadingSessionId=? AND type='LOADING_CLOSURE_CONFIRMED'").get(id)!.n,1);
      assert.ok(response.json().completedAt);assert.equal(response.json().shippedAt,null);
      assert.equal(response.json().trailerId,mode==="BILICO_ESSEPI"?trailerId:null);
      assert.equal(db.prepare("SELECT stato FROM Loads WHERE id=?").get(load.id)!.stato,"ATTESA_SPEDIZIONE");
      assert.equal(db.prepare("SELECT stato FROM Panels WHERE loadId=?").get(load.id)!.stato,"CARICATO");
      assert.equal(db.prepare("SELECT actualDepartureDate FROM ShipmentPlans WHERE id=?").get(planId)!.actualDepartureDate,null);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM OperationalEvents WHERE loadId=? AND type='PARTENZA_CONFERMATA'").get(load.id)!.n,0);
      const shipment=(await app.inject({method:"GET",url:"/api/shipments"})).json<Array<{id:string;operationalStatus:string;shipmentStatus:string}>>().find(p=>p.id===planId)!;
      assert.equal(shipment.operationalStatus,"ATTESA_SPEDIZIONE");assert.equal(shipment.shipmentStatus,"PRONTA");
      if(mode==="BILICO_ESSEPI"){
        const assignment=db.prepare("SELECT * FROM TransportAssignments WHERE loadId=? AND releasedAt IS NULL").get(load.id)!;
        assert.equal(assignment.stato,"CARICATO");assert.equal(assignment.departedAt,null);assert.equal(assignment.availableFrom,null);assert.equal(assignment.releasedAt,null);
        assert.equal((await app.inject({method:"DELETE",url:`/api/trailers/${trailerId}/reservation`})).statusCode,409);
        assert.equal((await app.inject({method:"POST",url:`/api/trailers/${trailerId}/reservation`,payload:{commessa:"OTHER",cliente:"Other",carico:"C2"}})).statusCode,409);
      }
      const waiting=snapshot();assert.equal((await complete()).statusCode,200);assert.deepEqual(snapshot(),waiting);
      assert.equal(concurrent.get(id).closureConfirmedAt,response.json().closureConfirmedAt);
      assert.equal(concurrent.complete(id).closureConfirmedAt,response.json().closureConfirmedAt);assert.deepEqual(snapshot(),waiting);
      if(mode==="TERZI_PER_ESSEPI"){
        const before=snapshot();
        const missing=await app.inject({method:"POST",url:`/api/shipments/${planId}/depart`,payload:{operatorId}});
        assert.equal(missing.statusCode,400);assert.equal(missing.json().error.code,"ACTUAL_CARRIER_REQUIRED");assert.deepEqual(snapshot(),before);
        const invalid=await app.inject({method:"POST",url:`/api/shipments/${planId}/depart`,payload:{operatorId,carrierId:"missing"}});
        assert.equal(invalid.statusCode,400);assert.deepEqual(snapshot(),before);
      }
      // A definitive DDT is now required; the fixture keeps this test focused on completion/departure transitions.
      seedDepartureDdtForApp(app,id,mode==="TERZI_PER_ESSEPI"?carrierId:undefined);
      const shipped=await app.inject({method:"POST",url:`/api/shipments/${planId}/depart`,payload:{operatorId,...(mode==="TERZI_PER_ESSEPI"?{carrierId}:{})}});
      assert.equal(shipped.statusCode,200,shipped.body);
      const saved=db.prepare("SELECT * FROM LoadingSessions WHERE id=?").get(id)!;
      assert.equal(saved.stato,"SPEDITO");assert.ok(saved.shippedAt);assert.equal(saved.completedAt,response.json().completedAt);
      assert.equal(db.prepare("SELECT actualDepartureDate FROM ShipmentPlans WHERE id=?").get(planId)!.actualDepartureDate,saved.shippedAt);
      assert.equal(db.prepare("SELECT stato FROM Panels WHERE loadId=?").get(load.id)!.stato,"SPEDITO");
      const events=db.prepare("SELECT timestamp FROM OperationalEvents WHERE loadId=? AND type='PARTENZA_CONFERMATA'").all(load.id);
      assert.equal(events.length,1);assert.equal(events[0]!.timestamp,saved.shippedAt);
      const departed=snapshot();
      assert.equal((await complete()).statusCode,409);
      assert.equal((await app.inject({method:"POST",url:`/api/shipments/${planId}/depart`,payload:{operatorId}})).statusCode,409);
      assert.throws(()=>concurrent.ship(id,{}),/spedibile|spedito/);
      assert.throws(()=>concurrent.complete(id),/spedito/);
      assert.throws(()=>concurrent.removeUnit(id,unitId,{operatorId}),/non modificabile/);
      assert.throws(()=>concurrent.reopen(id,{}),/attesa/);
      assert.deepEqual(snapshot(),departed);assert.equal(db.prepare("SELECT loadId FROM ShipmentPlans WHERE id=?").get(planId)!.loadId,load.id);
    } finally {other.close();db.close();await app.close();rmSync(dir,{recursive:true,force:true});}
  });
}
