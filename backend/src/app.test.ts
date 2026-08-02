import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildApp } from "./app.js";
import type { AppConfig } from "./config/environment.js";

const config: AppConfig = {
  port: 3001,
  host: "127.0.0.1",
  environment: "test",
  databasePath: ":memory:",
  frontendOrigin: "http://localhost:5173",
};

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

test("commesse e pannelli persistono dopo il riavvio backend",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"loads-persistence-"));const persistentConfig={...config,databasePath:join(directory,"operational.sqlite")};
  try{const first=await buildApp(persistentConfig);await first.inject({method:"POST",url:"/api/loads/import",payload:importedLoad([importedPanel("77","C7")])});await first.close();const second=await buildApp(persistentConfig);const loads=await second.inject({method:"GET",url:"/api/loads"});assert.equal(loads.json<Array<{pannelli:unknown[]}>>()[0]?.pannelli.length,1);await second.close();}finally{rmSync(directory,{recursive:true,force:true});}
});
