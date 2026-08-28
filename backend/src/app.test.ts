import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { buildApp } from "./app.js";
import { loadConfig, type AppConfig } from "./config/environment.js";
import { addBusinessDays } from "./repositories/transportRepository.js";

const config: AppConfig = {
  port: 3001,
  host: "127.0.0.1",
  environment: "test",
  databasePath: ":memory:",
  frontendOrigin: "http://localhost:5173",
  frontendDistPath: null,
};

test("la configurazione di produzione richiede percorsi assoluti per frontend e database",()=>{
  const base={NODE_ENV:"production",PORT:"3001",HOST:"0.0.0.0",FRONTEND_ORIGIN:"http://server:3001"};
  assert.throws(()=>loadConfig({...base,DATABASE_URL:"D:/SisLog/data/app.sqlite"}),/FRONTEND_DIST_PATH è obbligatorio/);
  assert.throws(()=>loadConfig({...base,FRONTEND_DIST_PATH:"D:/SisLog/frontend/dist"}),/DATABASE_URL è obbligatorio/);
  assert.throws(()=>loadConfig({...base,DATABASE_URL:"./data/app.sqlite",FRONTEND_DIST_PATH:"D:/SisLog/frontend/dist"}),/DATABASE_URL deve essere un percorso assoluto/);
  const loaded=loadConfig({...base,DATABASE_URL:"D:/SisLog/data/app.sqlite",FRONTEND_DIST_PATH:"D:/SisLog/frontend/dist"});
  assert.equal(loaded.host,"0.0.0.0");assert.equal(loaded.port,3001);assert.equal(loaded.databasePath,"D:/SisLog/data/app.sqlite");
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
    const pickup=await first.inject({method:"POST",url:"/api/shipments",payload:{commessa:"265701",cliente:"BIANCHI",camion:"C2",plannedDepartureDate:null,transportType:"TRASPORTATORE_ESTERNO",trailerId:null,carrierId:null}});assert.equal(pickup.statusCode,200);
    assert.deepEqual((await first.inject({method:"GET",url:"/api/loads"})).json(),[]);
    const trailer=(await first.inject({method:"GET",url:"/api/trailers"})).json<Array<{id:string}>>()[0]!;const reserved=await first.inject({method:"POST",url:`/api/trailers/${trailer.id}/reservation`,payload:{commessa:"265700",cliente:"ROSSI",carico:"C1",plannedDepartureDate:"2026-09-12"}});assert.equal(reserved.statusCode,200);const assigned=(await first.inject({method:"GET",url:"/api/shipments"})).json<Array<{commessa:string;trailerId:string|null}>>().find(item=>item.commessa==="265700");assert.equal(assigned?.trailerId,trailer.id);
    await first.close();
    const second=await buildApp({...config,databasePath});
    const shipments=(await second.inject({method:"GET",url:"/api/shipments"})).json<Array<{commessa:string;camion:string|null}>>();
    assert.equal(shipments.length,2);assert.equal(shipments[0]?.commessa,"265700");assert.equal(shipments[0]?.camion,"C1");
    await second.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("la prima partenza prevista resta originale e le modifiche sono persistenti",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"shipment-departure-history-"));const persistentConfig={...config,databasePath:join(directory,"shipment-history.sqlite")};
  try{const first=await buildApp(persistentConfig);
    const base={commessa:"HISTORY-1",cliente:"Cliente",camion:"C1",transportType:"BILICO_ESSEPI",trailerId:null,carrierId:null};
    const created=(await first.inject({method:"POST",url:"/api/shipments",payload:{...base,plannedDepartureDate:"2026-08-29"}})).json<{id:string;plannedDepartureDate:string;originalPlannedDepartureDate:string;plannedDepartureDateChangedAt:string|null}>();assert.equal(created.plannedDepartureDate,"2026-08-29");assert.equal(created.originalPlannedDepartureDate,"2026-08-29");assert.equal(created.plannedDepartureDateChangedAt,null);
    const changed=(await first.inject({method:"PUT",url:`/api/shipments/${created.id}`,payload:{...base,plannedDepartureDate:"2026-08-31"}})).json<{originalPlannedDepartureDate:string;plannedDepartureDateChangedAt:string|null}>();assert.equal(changed.originalPlannedDepartureDate,"2026-08-29");assert.ok(changed.plannedDepartureDateChangedAt);
    const changedAgain=(await first.inject({method:"PUT",url:`/api/shipments/${created.id}`,payload:{...base,plannedDepartureDate:"2026-09-02"}})).json<{plannedDepartureDate:string;originalPlannedDepartureDate:string;plannedDepartureDateChangedAt:string|null}>();assert.equal(changedAgain.plannedDepartureDate,"2026-09-02");assert.equal(changedAgain.originalPlannedDepartureDate,"2026-08-29");assert.ok(changedAgain.plannedDepartureDateChangedAt);
    const laterBase={commessa:"HISTORY-2",cliente:"Cliente",camion:"C2",transportType:"TRASPORTATORE_ESTERNO",trailerId:null,carrierId:null};const withoutDate=(await first.inject({method:"POST",url:"/api/shipments",payload:{...laterBase,plannedDepartureDate:null}})).json<{id:string}>();const firstDate=(await first.inject({method:"PUT",url:`/api/shipments/${withoutDate.id}`,payload:{...laterBase,plannedDepartureDate:"2026-09-10"}})).json<{originalPlannedDepartureDate:string;plannedDepartureDateChangedAt:string|null}>();assert.equal(firstDate.originalPlannedDepartureDate,"2026-09-10");assert.equal(firstDate.plannedDepartureDateChangedAt,null);
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

test("le anagrafiche sono inizializzate e supportano CRUD con DELETE logica", async () => {
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
  assert.equal(list.json<Array<{id:string;active:boolean}>>().find(item=>item.id===operator.id)?.active,false);
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
    const logicallyDeleted=await app.inject({method:"DELETE",url:`/api/${path}/${record.id}`});
    assert.equal(logicallyDeleted.statusCode,200);
    assert.equal(logicallyDeleted.json<{active:boolean}>().active,false);
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
  const updated=await app.inject({method:"PUT",url:`/api/loads/${load.id}/import`,payload:importedLoad([importedPanel("1","C1",99),importedPanel("1","C1",99),importedPanel("3","C1")],true)});
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
    const opened=(await first.inject({method:"POST",url:"/api/packages",payload:{loadId:created.id,operatorId:operator.id}})).json<{id:string;stato:string}>();
    assert.equal(opened.stato,"APERTO");
    await first.inject({method:"PATCH",url:`/api/panels/${panel1!.id}/scan`,payload:{operatorId:operator.id}});
    await first.inject({method:"POST",url:`/api/packages/${opened.id}/panels`,payload:{panelId:panel1!.id,operatorId:operator.id}});
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
    assert.equal((await second.inject({method:"POST",url:`/api/loading-sessions/${session.id}/reopen`,payload:{note:"Nuova unità"}})).json<{stato:string}>().stato,"IN_CARICO");
    await second.inject({method:"POST",url:`/api/loading-sessions/${session.id}/complete`});
    const shipped=await second.inject({method:"POST",url:`/api/loading-sessions/${session.id}/ship`,payload:{carrierId:carrier.id}});assert.equal(shipped.json<{stato:string;carrierId:string}>().stato,"SPEDITO");assert.equal(shipped.json<{carrierId:string}>().carrierId,carrier.id);
    const travelling=(await second.inject({method:"GET",url:"/api/transports"})).json<Array<{id:string;status:string;departedAt:string;availableFrom:string}>>().find(item=>item.id===trailer.id);
    assert.equal(travelling?.status,"IN_VIAGGIO");assert.ok(travelling?.departedAt);assert.equal(travelling?.availableFrom,addBusinessDays(travelling!.departedAt,2));
    await second.close();const database=new DatabaseSync(persistentConfig.databasePath);database.prepare("UPDATE TransportAssignments SET availableFrom=? WHERE trailerId=? AND releasedAt IS NULL").run("2020-01-01T00:00:00.000Z",trailer.id);database.close();const third=await buildApp(persistentConfig);const persisted=await third.inject({method:"GET",url:`/api/loads/${load.id}/loading-session`});assert.equal(persisted.json<{stato:string}>().stato,"SPEDITO");const available=(await third.inject({method:"GET",url:"/api/transports"})).json<Array<{id:string;status:string}>>().find(item=>item.id===trailer.id);assert.equal(available?.status,"DISPONIBILE");await third.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test("aggiornare la distinta può scaricare e rimuovere un pannello già caricato",async()=>{
  const app=await buildApp(config);const operator=(await app.inject({method:"GET",url:"/api/operators"})).json<Array<{id:string}>>()[0]!;const trailer=(await app.inject({method:"GET",url:"/api/trailers"})).json<Array<{id:string}>>()[0]!;
  const load=(await app.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("R1","C1"),importedPanel("R2","C1")])})).json<Array<{id:string;pannelli:Array<{id:string}>}>>()[0]!;
  for(const panel of load.pannelli)await app.inject({method:"PATCH",url:`/api/panels/${panel.id}/close-single`,payload:{operatorId:operator.id}});
  const session=(await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId:operator.id,destinationType:"RIMORCHIO_ESSEPI",trailerId:trailer.id}})).json<{id:string}>();
  await app.inject({method:"POST",url:`/api/loading-sessions/${session.id}/units`,payload:{unitType:"PANEL",panelId:load.pannelli[1]!.id,operatorId:operator.id}});
  const update=await app.inject({method:"PUT",url:`/api/loads/${load.id}/import`,payload:importedLoad([importedPanel("R1","C1")],true)});
  assert.equal(update.statusCode,200);assert.deepEqual(update.json<{pannelli:Array<{numeroPannello:string}>}>().pannelli.map(panel=>panel.numeroPannello),["R1"]);
  const restored=await app.inject({method:"GET",url:`/api/loads/${load.id}/loading-session`});assert.equal(restored.json<{units:unknown[]}>().units.length,0);
  await app.close();
});
