import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "./app.js";

const config=()=>({environment:"test" as const,databasePath:join(mkdtempSync(join(tmpdir(),"vehicle-types-")),"test.sqlite"),port:3193,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath:null,httpsKeyPath:null,httpsCertPath:null});

test("vehicle types: create/edit reject case and whitespace duplicates, including inactive, without changing legacy registries",async()=>{
 const app=await buildApp(config());
 try {
  const carriers=(await app.inject({method:"GET",url:"/api/carriers"})).json();
  const legacy=await app.inject({method:"POST",url:"/api/third-party-transport-modes",payload:{name:"Cristelli Motrice"}});assert.equal(legacy.statusCode,201);
  const modes=(await app.inject({method:"GET",url:"/api/third-party-transport-modes"})).json();
  const create=(name:string)=>app.inject({method:"POST",url:"/api/client-vehicle-types",payload:{name}});
  const first=await create("  Motrice  ");assert.equal(first.statusCode,201);assert.equal(first.json().name,"Motrice");
  for(const name of ["MOTRICE"," motrice ","Mo trice","Mo\tTRI\nce"]){const response=await create(name);assert.equal(response.statusCode,409,response.body);assert.equal(response.json().error.code,"DUPLICATE_VEHICLE_TYPE");}
  const second=await create("Pianale");assert.equal(second.statusCode,201);
  const duplicate=await app.inject({method:"PUT",url:`/api/client-vehicle-types/${second.json().id}`,payload:{name:"MOT RICE"}});assert.equal(duplicate.statusCode,409);
  const self=await app.inject({method:"PUT",url:`/api/client-vehicle-types/${first.json().id}`,payload:{name:"MOTRICE"}});assert.equal(self.statusCode,200);
  await app.inject({method:"PATCH",url:`/api/client-vehicle-types/${first.json().id}`,payload:{active:false}});
  assert.equal((await create("motrice")).statusCode,409);
  assert.equal((await create(" \t\n ")).statusCode,400);
  assert.deepEqual((await app.inject({method:"GET",url:"/api/carriers"})).json(),carriers);
  assert.deepEqual((await app.inject({method:"GET",url:"/api/third-party-transport-modes"})).json(),modes);
  assert.equal((await app.inject({method:"GET",url:"/api/client-vehicle-types"})).json().length,2);
 } finally {await app.close();}
});

test("vehicle types: inactive selection retained on saved plans, excluded from new plans, edit and restart persist",async()=>{
 const cfg=config();let app=await buildApp(cfg);
 try {
  const carrier=(await app.inject({method:"GET",url:"/api/carriers"})).json()[0];
  const created=await app.inject({method:"POST",url:"/api/client-vehicle-types",payload:{name:"Autotreno"}});const type=created.json();
  const input={commessa:"VEHICLE",cliente:"Cliente",transportType:"TERZI_PER_ESSEPI",plannedCarrierId:carrier.id,vehicleTypeId:type.id};
  const plan=await app.inject({method:"POST",url:"/api/shipments",payload:input});assert.equal(plan.statusCode,200);
  const id=plan.json().id;
  assert.equal((await app.inject({method:"PUT",url:`/api/client-vehicle-types/${type.id}`,payload:{name:"Autotreno lungo"}})).statusCode,200);
  assert.equal((await app.inject({method:"PATCH",url:`/api/client-vehicle-types/${type.id}`,payload:{active:false}})).statusCode,200);
  const rejected=await app.inject({method:"POST",url:"/api/shipments",payload:{...input,commessa:"NEW"}});assert.equal(rejected.statusCode,400);
  const current=(await app.inject({method:"GET",url:"/api/shipments"})).json().find((p:{id:string})=>p.id===id)!;
  const retained=await app.inject({method:"PUT",url:`/api/shipments/${id}`,payload:{...input,notes:"Saved inactive selection",expectedUpdatedAt:current.updatedAt}});assert.equal(retained.statusCode,200,retained.body);
  await app.close();app=await buildApp(cfg);
  const restoredType=(await app.inject({method:"GET",url:"/api/client-vehicle-types"})).json().find((t:{id:string})=>t.id===type.id);assert.equal(restoredType.name,"Autotreno lungo");assert.equal(restoredType.active,false);
  const restored=(await app.inject({method:"GET",url:"/api/shipments"})).json().find((p:{id:string})=>p.id===id);assert.equal(restored.vehicleTypeId,type.id);assert.equal(restored.plannedCarrierId,carrier.id);
  await app.inject({method:"PATCH",url:`/api/client-vehicle-types/${type.id}`,payload:{active:true}});
  assert.equal((await app.inject({method:"POST",url:"/api/shipments",payload:{...input,commessa:"NEW-ACTIVE"}})).statusCode,200);
 } finally {await app.close();}
});

test("vehicle types: simultaneous creation through two connections cannot duplicate a normalized name",async()=>{
 const cfg=config();const first=await buildApp(cfg),second=await buildApp(cfg);
 try {
  const responses=await Promise.all([first.inject({method:"POST",url:"/api/client-vehicle-types",payload:{name:"Auto treno"}}),second.inject({method:"POST",url:"/api/client-vehicle-types",payload:{name:" AUTOTRENO "}})]);
  assert.deepEqual(responses.map(response=>response.statusCode).sort(),[201,409]);
  assert.equal((await first.inject({method:"GET",url:"/api/client-vehicle-types"})).json().length,1);
 } finally {await first.close();await second.close();}
});
