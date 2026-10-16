import assert from "node:assert/strict";
import test from "node:test";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {buildApp} from "./app.js";
import {migrateCustomers} from "./database/customerMigration.js";
import {customerFields,type CustomerData} from "./models/customer.js";

const config=()=>({environment:"test" as const,databasePath:join(mkdtempSync(join(tmpdir(),"customers-")),"test.sqlite"),port:3191,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath:null,httpsKeyPath:null,httpsCertPath:null});
const data=(changes:Partial<CustomerData>={}):CustomerData=>({...Object.fromEntries(customerFields.map(f=>[f,""])),denominazione:"Cliente TEST",via:"Via anagrafica 1",cap:"00123",telefono:"0039 0123-456",cellulare:"000123",partitaIva:"00123456789",codiceFiscale:"001TESTCF",...changes}) as CustomerData;

test("customer migration: additive, idempotent, historical values unchanged and all links initially null",()=>{
 const db=new DatabaseSync(":memory:");try{
  db.exec("PRAGMA foreign_keys=ON;CREATE TABLE ShipmentPlans(id TEXT PRIMARY KEY,manualCliente TEXT,deliveryAddress TEXT);INSERT INTO ShipmentPlans VALUES('old','Cliente libero','Cantiere separato')");
  migrateCustomers(db);migrateCustomers(db);
  assert.deepEqual({...db.prepare("SELECT * FROM ShipmentPlans").get()},{id:"old",manualCliente:"Cliente libero",deliveryAddress:"Cantiere separato",customerId:null});
  assert.equal(db.prepare("SELECT COUNT(*) n FROM Customers").get()!.n,0);
  assert.throws(()=>db.exec("UPDATE ShipmentPlans SET customerId='missing'"));
 }finally{db.close();}
});

test("customer API: strings and zeros, create/edit, validation, duplicate identities and optimistic conflict",async()=>{
 const app=await buildApp(config());try{
  const created=await app.inject({method:"POST",url:"/api/customers",payload:data()});assert.equal(created.statusCode,201,created.body);const customer=created.json();assert.equal(customer.cap,"00123");assert.equal(customer.telefono,"0039 0123-456");assert.equal(customer.partitaIva,"00123456789");
  assert.equal((await app.inject({method:"POST",url:"/api/customers",payload:data({denominazione:"  CLIENTE   test  "})})).statusCode,409);
  assert.equal((await app.inject({method:"POST",url:"/api/customers",payload:data({denominazione:"Altro",partitaIva:"00 123456789"})})).statusCode,409);
  for(const payload of [{...data(),cap:123},{...data(),denominazione:" "},{...data(),email:"invalid"}])assert.equal((await app.inject({method:"POST",url:"/api/customers",payload})).statusCode,400);
  const multiple=data({denominazione:"Email multiple TEST",partitaIva:"MULTI",codiceFiscale:"MULTI",email:"Nome Contatto <uno@example.invalid>; due@example.invalid"});
  const emailList=await app.inject({method:"POST",url:"/api/customers",payload:multiple});assert.equal(emailList.statusCode,201,emailList.body);assert.equal(emailList.json().email,multiple.email);
  const updated=await app.inject({method:"PUT",url:`/api/customers/${customer.id}`,payload:{...data({nomeContatto:"Contatto TEST",email:"test@example.invalid"}),expectedUpdatedAt:customer.updatedAt}});assert.equal(updated.statusCode,200,updated.body);
  assert.equal((await app.inject({method:"PUT",url:`/api/customers/${customer.id}`,payload:{...data(),expectedUpdatedAt:customer.updatedAt}})).statusCode,409);
  assert.equal((await app.inject({method:"DELETE",url:`/api/customers/${customer.id}`})).statusCode,404);
 }finally{await app.close();}
});

test("customer import: preview read-only, explicit confirmation, invalid and duplicate rows, replay and repeated file",async()=>{
 const app=await buildApp(config());try{
  const rows=[{rowNumber:2,data:data()},{rowNumber:3,data:data()},{rowNumber:4,data:data({denominazione:"",partitaIva:"",codiceFiscale:""})},{rowNumber:5,data:data({denominazione:"Altro",partitaIva:"",codiceFiscale:"",email:"bad"})}];
  const preview=await app.inject({method:"POST",url:"/api/customers/import/preview",payload:{rows}});assert.equal(preview.statusCode,200,preview.body);const parsed=preview.json();assert.deepEqual(parsed.rows.map((r:{status:string})=>r.status),["NEW","DUPLICATE_FILE","INVALID","INVALID"]);
  assert.equal((await app.inject({method:"GET",url:"/api/customers"})).json().length,0);
  assert.equal((await app.inject({method:"POST",url:"/api/customers/import/confirm",payload:{token:parsed.token,confirmed:false,updateRows:[]}})).statusCode,400);
  const confirm=()=>app.inject({method:"POST",url:"/api/customers/import/confirm",payload:{token:parsed.token,confirmed:true,updateRows:[]}});
  const response=await confirm();assert.equal(response.statusCode,200,response.body);assert.equal(response.json().inserted,1);assert.equal(response.json().discarded,3);assert.deepEqual((await confirm()).json(),response.json());
  const repeated=(await app.inject({method:"POST",url:"/api/customers/import/preview",payload:{rows}})).json();assert.equal(repeated.rows[0].status,"UNCHANGED");
  const done=await app.inject({method:"POST",url:"/api/customers/import/confirm",payload:{token:repeated.token,confirmed:true,updateRows:[]}});assert.equal(done.json().inserted,0);assert.equal(done.json().unchanged,1);
  assert.equal((await app.inject({method:"GET",url:"/api/customers"})).json().length,1);
 }finally{await app.close();}
});

test("customer import: changes require explicit per-row choice, conflicts/ambiguous IDs and same-name candidates never overwrite",async()=>{
 const app=await buildApp(config());try{
  const first=(await app.inject({method:"POST",url:"/api/customers",payload:data()})).json();
  await app.inject({method:"POST",url:"/api/customers",payload:data({denominazione:"Secondo",partitaIva:"002",codiceFiscale:"CF2"})});
  const rows=[{rowNumber:2,data:data({via:"Nuovo indirizzo",telefono:""})}];
  const preview=async(input=rows)=>(await app.inject({method:"POST",url:"/api/customers/import/preview",payload:{rows:input}})).json();
  const p=await preview();assert.equal(p.rows[0].status,"UPDATE");assert.equal(p.rows[0].existing.via,"Via anagrafica 1");
  let done=await app.inject({method:"POST",url:"/api/customers/import/confirm",payload:{token:p.token,confirmed:true,updateRows:[]}});assert.equal(done.json().updated,0);
  const again=await preview();done=await app.inject({method:"POST",url:"/api/customers/import/confirm",payload:{token:again.token,confirmed:true,updateRows:[2]}});assert.equal(done.json().updated,1);
  const saved=(await app.inject({method:"GET",url:"/api/customers"})).json().find((c:{id:string})=>c.id===first.id);assert.equal(saved.via,"Nuovo indirizzo");assert.equal(saved.telefono,"");
  const ambiguous=await preview([{rowNumber:7,data:data({codiceFiscale:"CF2"})}]);assert.equal(ambiguous.rows[0].status,"AMBIGUOUS");
  const nameOnly=await preview([{rowNumber:8,data:data({partitaIva:"",codiceFiscale:"",via:"Differente"})}]);assert.equal(nameOnly.rows[0].status,"POSSIBLE_DUPLICATE");
  const conflict=await preview([{rowNumber:9,data:data({codiceFiscale:"DIFFERENT"})}]);assert.equal(conflict.rows[0].status,"AMBIGUOUS");
  const inFile=await preview([{rowNumber:10,data:data({denominazione:"Nuovo A",partitaIva:"NEW",codiceFiscale:"NEW"})},{rowNumber:11,data:data({denominazione:"Nuovo B",partitaIva:"NEW",codiceFiscale:"NEW"})}]);assert.deepEqual(inFile.rows.map((r:{status:string})=>r.status),["AMBIGUOUS","AMBIGUOUS"]);
 }finally{await app.close();}
});

test("customer import: second connection invalidates preview and rollback protects the entire batch",async()=>{
 const cfg=config(),app=await buildApp(cfg),other=await buildApp(cfg);try{
  const preview=(await app.inject({method:"POST",url:"/api/customers/import/preview",payload:{rows:[{rowNumber:2,data:data()}]}})).json();
  await other.inject({method:"POST",url:"/api/customers",payload:data({denominazione:"Concurrent",partitaIva:"OTHER",codiceFiscale:"OTHER"})});
  const done=await app.inject({method:"POST",url:"/api/customers/import/confirm",payload:{token:preview.token,confirmed:true,updateRows:[]}});assert.equal(done.statusCode,409);assert.equal(done.json().error.code,"IMPORT_STALE");
  const db=new DatabaseSync(cfg.databasePath);db.exec("CREATE TRIGGER test_customer_failure BEFORE INSERT ON Customers WHEN NEW.denominazione='Fail' BEGIN SELECT RAISE(ABORT,'test failure'); END");db.close();
  const p=(await app.inject({method:"POST",url:"/api/customers/import/preview",payload:{rows:[{rowNumber:2,data:data()},{rowNumber:3,data:data({denominazione:"Fail",partitaIva:"FAIL",codiceFiscale:"FAIL"})}]}})).json();
  assert.ok((await app.inject({method:"POST",url:"/api/customers/import/confirm",payload:{token:p.token,confirmed:true,updateRows:[]}})).statusCode>=400);
  assert.equal((await app.inject({method:"GET",url:"/api/customers"})).json().length,1);
 }finally{await app.close();await other.close();}
});

test("customer links: no automatic matching, separate delivery address, omission/date edits and restart preserve explicit IDs",async()=>{
 const cfg=config();let app=await buildApp(cfg);try{
  const customer=(await app.inject({method:"POST",url:"/api/customers",payload:data()})).json();
  const input={commessa:"CUSTOMER-LINK",cliente:"Testo cliente storico diverso",transportType:"RITIRA_CLIENTE",plannedDepartureDate:"2026-10-20",deliveryAddress:"Cantiere di consegna"};
  const legacy=(await app.inject({method:"POST",url:"/api/shipments",payload:input})).json();assert.equal(legacy.customerId,null);
  const linked=await app.inject({method:"PUT",url:`/api/shipments/${legacy.id}`,payload:{...input,customerId:customer.id}});assert.equal(linked.statusCode,200,linked.body);assert.equal(linked.json().cliente,input.cliente);assert.equal(linked.json().deliveryAddress,input.deliveryAddress);
  assert.equal((await app.inject({method:"PUT",url:`/api/shipments/${legacy.id}`,payload:{...input,customerId:"missing"}})).statusCode,400);
  const omitted=(await app.inject({method:"PUT",url:`/api/shipments/${legacy.id}`,payload:input})).json();assert.equal(omitted.customerId,customer.id);
  const date=await app.inject({method:"PUT",url:`/api/shipments/${legacy.id}`,payload:{plannedDepartureDate:"2026-10-21",expectedUpdatedAt:omitted.updatedAt}});assert.equal(date.json().customerId,customer.id);
  const imported=await app.inject({method:"POST",url:"/api/loads/import",payload:{commessa:input.commessa,cliente:input.cliente,numeroCliente:"",riferimentoOrdine:"",pannelli:[{numeroPannello:"1",numeroCliente:"",numeroMasterPanel:"1",camion:"C1",lato1:"",lato2:"",tipoPannello:"TEST",quantita:1,spessore:100,lunghezza:1000,altezza:1000,superficie:1,volume:.1,peso:50}]}});assert.equal(imported.statusCode,201,imported.body);const load=imported.json()[0];
  const link=await app.inject({method:"PATCH",url:`/api/shipments/${legacy.id}/link`,payload:{loadId:load.id}});assert.equal(link.statusCode,200,link.body);assert.equal(link.json().customerId,customer.id);
  const operatorId=(await app.inject({method:"GET",url:"/api/operators"})).json()[0].id;
  await app.inject({method:"PATCH",url:`/api/panels/${load.pannelli[0].id}/close-single`,payload:{operatorId}});
  const session=await app.inject({method:"POST",url:`/api/loads/${load.id}/loading-session`,payload:{operatorId,destinationType:"TRASPORTATORE",transportMode:"RITIRA_CLIENTE"}});assert.equal(session.statusCode,201,session.body);
  await app.inject({method:"POST",url:`/api/loading-sessions/${session.json().id}/units`,payload:{operatorId,unitType:"PANEL",panelId:load.pannelli[0].id}});
  const shipped=await app.inject({method:"POST",url:`/api/loading-sessions/${session.json().id}/ship`,payload:{operatorId}});assert.equal(shipped.statusCode,200,shipped.body);
  await app.close();app=await buildApp(cfg);
  const plan=(await app.inject({method:"GET",url:"/api/shipments"})).json().find((p:{id:string})=>p.id===legacy.id);assert.equal(plan.customerId,customer.id);assert.equal(plan.deliveryAddress,"Cantiere di consegna");assert.equal((await app.inject({method:"GET",url:"/api/customers"})).json()[0].cap,"00123");
  assert.equal(plan.shipmentStatus,"CONCLUSA");assert.equal(plan.cliente,input.cliente);
  const db=new DatabaseSync(cfg.databasePath);db.exec("PRAGMA foreign_keys=ON");assert.throws(()=>db.prepare("DELETE FROM Customers WHERE id=?").run(customer.id));assert.equal(db.prepare("PRAGMA foreign_key_check").all().length,0);db.close();
 }finally{await app.close();}
});

test("customer concurrent creation: same fiscal identity cannot be inserted twice",async()=>{
 const cfg=config(),first=await buildApp(cfg),second=await buildApp(cfg);
 try{
  const responses=await Promise.all([first.inject({method:"POST",url:"/api/customers",payload:data()}),second.inject({method:"POST",url:"/api/customers",payload:data({denominazione:"Stessa identità fiscale"})})]);
  assert.deepEqual(responses.map(r=>r.statusCode).sort(),[201,409]);
  assert.equal((await first.inject({method:"GET",url:"/api/customers"})).json().length,1);
 }finally{await first.close();await second.close();}
});
