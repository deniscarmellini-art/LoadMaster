import assert from "node:assert/strict";
import test from "node:test";

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
