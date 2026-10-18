import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { buildApp, seedDepartureDdtForApp } from "./fixtures/departureDdt.js";

test("Dashboard: servizio esistente, due conferme concorrenti, calendario/storico e obbligo DDT",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"sislog-dashboard-departure-"));
  const config={environment:"test" as const,databasePath:join(dir,"test.sqlite"),port:3198,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath:null,httpsKeyPath:null,httpsCertPath:null};
  const first=await buildApp(config),second=await buildApp(config),db=new DatabaseSync(config.databasePath);
  try{
    const op=String(db.prepare("SELECT id FROM Operators WHERE active=1 LIMIT 1").get()!.id);
    const imported=await first.inject({method:"POST",url:"/api/loads/import",payload:{commessa:"DASHBOARD-TEST",cliente:"Cliente test",numeroCliente:"",riferimentoOrdine:"TEST",pannelli:[{numeroPannello:"1",numeroCliente:"",numeroMasterPanel:"1",camion:"C1",lato1:"",lato2:"",tipoPannello:"CLT",quantita:1,spessore:100,lunghezza:1000,altezza:1000,superficie:1,volume:.1,peso:50}]}});
    assert.equal(imported.statusCode,201);const load=imported.json()[0];
    const plan=await first.inject({method:"POST",url:"/api/shipments",payload:{loadId:load.id,commessa:load.commessa,cliente:load.cliente,camion:load.camion,transportType:"RITIRA_CLIENTE"}});assert.equal(plan.statusCode,200);
    const created=await first.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:op,destinationType:"TRASPORTATORE",transportMode:"RITIRA_CLIENTE"}});assert.equal(created.statusCode,201);const session=created.json();
    assert.equal((await first.inject({method:"PATCH",url:`/api/panels/${load.pannelli[0].id}/close-single`,payload:{operatorId:op}})).statusCode,200);
    assert.equal((await first.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{operatorId:op,unitType:"PANEL",panelId:load.pannelli[0].id}})).statusCode,200);
    assert.equal((await first.inject({method:"POST",url:`/api/loading-sessions/${session.id}/complete`})).statusCode,200);
    const before=JSON.stringify(db.prepare("SELECT * FROM OperationalEvents ORDER BY rowid").all());
    const availability=await first.inject({method:"GET",url:`/api/loading-sessions/${session.id}/ddt-preview/availability`});
    assert.equal(availability.statusCode,200);assert.equal(availability.json().available,false);
    assert.equal(JSON.stringify(db.prepare("SELECT * FROM OperationalEvents ORDER BY rowid").all()),before);
    const blocked=await first.inject({method:"POST",url:`/api/shipments/${plan.json().id}/depart`,payload:{operatorId:op}});assert.equal(blocked.statusCode,409);assert.equal(blocked.json().error.code,"DDT_VALID_REQUIRED");
    seedDepartureDdtForApp(first,session.id);
    const responses=await Promise.all([
      first.inject({method:"POST",url:`/api/shipments/${plan.json().id}/depart`,payload:{operatorId:op}}),
      second.inject({method:"POST",url:`/api/loading-sessions/${session.id}/ship`,payload:{operatorId:op}}),
    ]);
    assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);
    const saved=db.prepare("SELECT * FROM LoadingSessions WHERE id=?").get(session.id)!;
    assert.equal(saved.stato,"SPEDITO");assert.ok(saved.shippedAt);
    const events=db.prepare("SELECT * FROM OperationalEvents WHERE loadingSessionId=? AND type='PARTENZA_CONFERMATA'").all(session.id);
    assert.equal(events.length,1);assert.equal(events[0]!.timestamp,saved.shippedAt);
    assert.equal(db.prepare("SELECT stato FROM Loads WHERE id=?").get(load.id)!.stato,"SPEDITO");
    const calendar=(await first.inject({method:"GET",url:"/api/shipments"})).json().find((p:{id:string})=>p.id===plan.json().id);
    assert.equal(calendar.actualDepartureDate,saved.shippedAt);assert.equal(calendar.operationalStatus,"SPEDITO");
    const history=(await first.inject({method:"GET",url:"/api/history"})).json();assert.equal(history.total,1);assert.equal(history.rows[0].id,session.id);assert.equal(history.rows[0].shippedAt,saved.shippedAt);
    assert.equal((await first.inject({method:"POST",url:`/api/shipments/${plan.json().id}/depart`,payload:{operatorId:op}})).statusCode,409);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM OperationalEvents WHERE loadingSessionId=? AND type='PARTENZA_CONFERMATA'").get(session.id)!.n,1);
  }finally{db.close();await second.close();await first.close();rmSync(dir,{recursive:true,force:true});}
});
