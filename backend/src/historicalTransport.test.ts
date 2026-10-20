import assert from "node:assert/strict";
import test from "node:test";
import {DatabaseSync} from "node:sqlite";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Worker} from "node:worker_threads";
import {buildApp} from "./app.js";
import {HistoricalTransportService} from "./services/historicalTransportService.js";
import {DefinitiveDdtRepository} from "./repositories/definitiveDdtRepository.js";
import {DefinitiveDdtService} from "./services/definitiveDdtService.js";

async function fixture(environment:"test"|"development"="test"){
 const dir=mkdtempSync(join(tmpdir(),"sislog-historical-transport-")),path=join(dir,"test.sqlite");
 const app=await buildApp({environment,databasePath:path,port:3198,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath:null,httpsKeyPath:null,httpsCertPath:null});
 const db=new DatabaseSync(path),at="2026-09-17T07:13:11.334Z";
 const operator=String(db.prepare("SELECT id FROM Operators WHERE active=1 LIMIT 1").get()!.id),carrier=String(db.prepare("SELECT id FROM Carriers WHERE active=1 LIMIT 1").get()!.id),trailer=String(db.prepare("SELECT id FROM Trailers WHERE active=1 LIMIT 1").get()!.id);
 db.prepare("INSERT INTO Loads(id,commessa,cliente,camion,stato,createdAt,updatedAt) VALUES('L','265484','Wood Solution','C1-','ATTESA_SPEDIZIONE',?,?)").run(at,at);
 db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,trailerId,startedAt,completedAt,createdAt,updatedAt) VALUES('S','L','ATTESA_SPEDIZIONE',?,'RIMORCHIO_ESSEPI',?,?,?,?,?)").run(operator,trailer,at,at,at,at);
 db.prepare("INSERT INTO TransportAssignments(id,trailerId,loadId,loadingSessionId,source,stato,assignedAt,createdAt,updatedAt) VALUES('A',?,'L','S','LOAD','CARICATO',?,?,?)").run(trailer,at,at,at);
 db.prepare("INSERT INTO Panels(id,loadId,numeroPannello,camion,tipoPannello,quantita,spessore,lunghezza,altezza,superficie,peso,volume,stato,createdAt,updatedAt) VALUES('P','L','1','C1-','CLT',1,100,1000,1000,1,50,.1,'CARICATO',?,?)").run(at,at);
 db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,panelId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES('U','S','PANEL','P',?,?,?,?)").run(at,operator,at,at);
 db.prepare("INSERT INTO OperationalEvents(id,loadId,loadingSessionId,type,operatorId,timestamp) VALUES('CLOSE','L','S','LOADING_COMPLETED',?,?)").run(operator,at);
 db.prepare("INSERT INTO Customers(id,denominazione,partitaIva,createdAt,updatedAt) VALUES('C','Wood Solution','00123456789',?,?)").run(at,at);
 db.prepare("INSERT INTO ShipmentPlans(id,loadId,customerId,deliveryAddress,transportType,transportMode,plannedCarrierId,createdAt,updatedAt) VALUES('PLAN','L','C','Via TEST','BILICO_ESSEPI','BILICO_ESSEPI',?,?,?)").run(carrier,at,at);
 const service=new HistoricalTransportService(db);
 const input=()=>({operatorId:operator,carrierId:carrier,transportMode:"BILICO_ESSEPI" as const,confirmed:true,revision:service.status('S').revision});
 const snapshot=()=>JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(t=>[t.name,db.prepare(`SELECT * FROM "${t.name}" ORDER BY rowid`).all()]));
 const stable=()=>JSON.stringify(['Loads','Panels','Packages','LoadingUnits','TransportAssignments','ShipmentPlans'].map(t=>[t,db.prepare(`SELECT * FROM ${t}`).all()]));
 return {app,db,path,dir,service,input,snapshot,stable,operator,carrier,trailer,close:async()=>{db.close();await app.close();rmSync(dir,{recursive:true,force:true});}};
}

test('historical transport: read-only eligibility, explicit confirmation, audit, unchanged history and normal DDT readiness',async()=>{
 const f=await fixture();try{
  const original=f.snapshot(),before=f.db.prepare("SELECT * FROM LoadingSessions WHERE id='S'").get()!,stable=f.stable();
  const status=await f.app.inject({method:'GET',url:'/api/loading-sessions/S/historical-transport'});
  assert.equal(status.json().eligible,true,status.body);assert.equal(status.json().transportMode,'BILICO_ESSEPI');assert.equal(status.json().carrierId,null);assert.equal(f.snapshot(),original);
  const call=(payload:unknown)=>f.app.inject({method:'POST',url:'/api/loading-sessions/S/historical-transport',payload:payload as object});
  for(const payload of [{...f.input(),confirmed:false},{...f.input(),carrierId:undefined},{...f.input(),operatorId:'missing'},{...f.input(),carrierId:'missing'},{...f.input(),transportMode:'RITIRA_CLIENTE'},{...f.input(),revision:'a'.repeat(64)}]){const r=await call(payload);assert(r.statusCode>=400,JSON.stringify(payload)+r.body);assert.equal(f.snapshot(),original);}
  assert.equal((await f.app.inject({method:'GET',url:'/api/loading-sessions/S/ddt'})).json().canIssue,false);
  const saved=await call(f.input());assert.equal(saved.statusCode,200,saved.body);assert.equal(saved.json().carrierId,f.carrier);assert.equal(f.stable(),stable);
  const after=f.db.prepare("SELECT * FROM LoadingSessions WHERE id='S'").get()!;
  for(const key of Object.keys(before).filter(k=>!['transportMode','carrierId','transportDetailId','transportDetailLabel'].includes(k)))assert.equal(after[key],before[key],key);
  const events=f.db.prepare("SELECT * FROM OperationalEvents WHERE type='HISTORICAL_TRANSPORT_CONFIRMED'").all();assert.equal(events.length,1);
  const audit=JSON.parse(String(events[0]!.note));assert.equal(events[0]!.operatorId,f.operator);assert.equal(audit.before.transportMode,null);assert.equal(audit.after.carrierId,f.carrier);assert.equal(audit.planningUsed,false);assert.equal(audit.confirmedAt,events[0]!.timestamp);
  assert.equal(f.service.status('S').eligible,false);
  const ready=await f.app.inject({method:'GET',url:'/api/loading-sessions/S/ddt'});assert.equal(ready.json().canIssue,true,ready.body);
  assert.equal(f.db.prepare('SELECT count(*) n FROM DdtDocuments').get()!.n,0);assert.equal(f.db.prepare('SELECT count(*) n FROM DdtSequences').get()!.n,0);
 }finally{await f.close();}
});

test('historical transport: inconsistent assignment, material, modern closure, departure and inactive carrier fail closed',async()=>{
 for(const sql of ["UPDATE TransportAssignments SET releasedAt='2026-10-20'", "UPDATE TransportAssignments SET loadingSessionId=NULL", "UPDATE TransportAssignments SET stato='IMPEGNATO'", "UPDATE Panels SET stato='DISPONIBILE'", "UPDATE OperationalEvents SET type='LOADING_CLOSURE_CONFIRMED' WHERE id='CLOSE'", "UPDATE ShipmentPlans SET actualDepartureDate='2026-10-20'", "UPDATE LoadingSessions SET stato='IN_CARICO'", "UPDATE Carriers SET active=0"]){
  const f=await fixture();try{const payload=f.input();f.db.exec(sql);const before=f.snapshot();const r=await f.app.inject({method:'POST',url:'/api/loading-sessions/S/historical-transport',payload});assert(r.statusCode>=400,sql+': '+r.body);assert.equal(f.snapshot(),before);}finally{await f.close();}
 }
});

test('historical transport: a valid DDT blocks endpoint and database changes; non-TEST has no routes',async()=>{
 const f=await fixture();try{
  f.service.complete('S',f.input());
  // Synthetic document in a disposable fixture only; never issue on the real TEST load.
  new DefinitiveDdtService(new DefinitiveDdtRepository(f.db),'test').issue('S',f.operator,()=>({synthetic:true}),()=>Buffer.from('%PDF-TEST-SYNTHETIC'));
  const before=f.snapshot();assert.equal(f.service.status('S').eligible,false);
  const r=await f.app.inject({method:'POST',url:'/api/loading-sessions/S/historical-transport',payload:f.input()});assert.equal(r.statusCode,409);assert.equal(f.snapshot(),before);
  assert.throws(()=>f.db.prepare("UPDATE LoadingSessions SET carrierId=NULL WHERE id='S'").run(),/DDT_LOAD_LOCKED/);
 }finally{await f.close();}
 const other=await fixture('development');try{for(const method of ['GET','POST'] as const)assert.equal((await other.app.inject({method,url:'/api/loading-sessions/S/historical-transport',...(method==='POST'?{payload:{operatorId:other.operator}}:{})})).statusCode,404);}finally{await other.close();}
});

test('historical transport: simultaneous confirmations on separate connections write once',async()=>{
 const f=await fixture(),payload=f.input();
 const workers=[0,1].map(()=>new Worker(`const {parentPort,workerData}=require('node:worker_threads');(async()=>{const {DatabaseSync}=await import('node:sqlite');const {HistoricalTransportService}=await import(workerData.module);const db=new DatabaseSync(workerData.path);db.exec('PRAGMA busy_timeout=5000');parentPort.once('message',()=>{try{new HistoricalTransportService(db).complete('S',workerData.input);parentPort.postMessage({ok:true});}catch(e){parentPort.postMessage({ok:false,code:e.code});}finally{db.close();parentPort.close();}});parentPort.postMessage('ready');})();`,{eval:true,workerData:{path:f.path,input:payload,module:new URL('./services/historicalTransportService.js',import.meta.url).href}}));
 try{await Promise.all(workers.map(w=>new Promise((ok,no)=>{w.once('message',ok);w.once('error',no);})));const results=workers.map(w=>new Promise<{ok:boolean}>( (ok,no)=>{w.once('message',ok);w.once('error',no);}));workers.forEach(w=>w.postMessage('go'));const values=await Promise.all(results);assert.equal(values.filter(v=>v.ok).length,1);assert.equal(f.db.prepare("SELECT count(*) n FROM OperationalEvents WHERE type='HISTORICAL_TRANSPORT_CONFIRMED'").get()!.n,1);assert.equal(f.db.prepare('SELECT count(*) n FROM DdtDocuments').get()!.n,0);
 }finally{await Promise.all(workers.map(w=>w.terminate()));await f.close();}
});

test('historical transport: audit failure rolls back the completion and already recorded transport cannot be replaced',async()=>{
 const f=await fixture();try{
  f.db.exec("CREATE TRIGGER fail_confirmation BEFORE INSERT ON OperationalEvents WHEN NEW.type='HISTORICAL_TRANSPORT_CONFIRMED' BEGIN SELECT RAISE(ABORT,'SIMULATED_AUDIT_FAILURE'); END");
  const before=f.snapshot();assert.throws(()=>f.service.complete('S',f.input()),/SIMULATED_AUDIT_FAILURE/);assert.equal(f.snapshot(),before);
  f.db.exec('DROP TRIGGER fail_confirmation');
  f.db.prepare("UPDATE LoadingSessions SET carrierId=? WHERE id='S'").run(f.carrier);
  const carrierBefore=f.snapshot();assert.throws(()=>f.service.complete('S',{...f.input(),carrierId:'different'}),/non possono essere sostituiti/);assert.equal(f.snapshot(),carrierBefore);
  f.service.complete('S',f.input());assert.equal(f.db.prepare("SELECT carrierId FROM LoadingSessions WHERE id='S'").get()!.carrierId,f.carrier);
 }finally{await f.close();}
});

test('historical transport: concurrent completion and DDT issuance share the same lock',async()=>{
 const f=await fixture(),input=f.input();
 const modules={historical:new URL('./services/historicalTransportService.js',import.meta.url).href,repo:new URL('./repositories/definitiveDdtRepository.js',import.meta.url).href,ddt:new URL('./services/definitiveDdtService.js',import.meta.url).href};
 const workers=['complete','issue'].map(action=>new Worker(`const {parentPort,workerData}=require('node:worker_threads');(async()=>{const {DatabaseSync}=await import('node:sqlite');const {HistoricalTransportService}=await import(workerData.modules.historical);const {DefinitiveDdtRepository}=await import(workerData.modules.repo);const {DefinitiveDdtService}=await import(workerData.modules.ddt);const db=new DatabaseSync(workerData.path);db.exec('PRAGMA busy_timeout=5000');parentPort.once('message',()=>{try{if(workerData.action==='complete')new HistoricalTransportService(db).complete('S',workerData.input);else new DefinitiveDdtService(new DefinitiveDdtRepository(db),'test').issue('S',workerData.input.operatorId,()=>({synthetic:true}),()=>Buffer.from('%PDF-TEST-RACE'));parentPort.postMessage({ok:true,action:workerData.action});}catch(e){parentPort.postMessage({ok:false,action:workerData.action});}finally{db.close();parentPort.close();}});parentPort.postMessage('ready');})();`,{eval:true,workerData:{path:f.path,input,action,modules}}));
 try{await Promise.all(workers.map(w=>new Promise((ok,no)=>{w.once('message',ok);w.once('error',no);})));const results=workers.map(w=>new Promise<{ok:boolean;action:string}>((ok,no)=>{w.once('message',ok);w.once('error',no);}));workers.forEach(w=>w.postMessage('go'));const values=await Promise.all(results);assert(values.find(v=>v.action==='complete')!.ok);assert.equal(f.db.prepare("SELECT count(*) n FROM OperationalEvents WHERE type='HISTORICAL_TRANSPORT_CONFIRMED'").get()!.n,1);assert.equal(f.db.prepare("SELECT carrierId FROM LoadingSessions WHERE id='S'").get()!.carrierId,f.carrier);
  const doc=f.db.prepare('SELECT snapshotJson FROM DdtDocuments').get();if(doc){assert.equal(JSON.parse(String(doc.snapshotJson)).document.transport.carrierId,f.carrier);assert.throws(()=>f.db.prepare("UPDATE LoadingSessions SET carrierId=NULL WHERE id='S'").run(),/DDT_LOAD_LOCKED/);}
 }finally{await Promise.all(workers.map(w=>w.terminate()));await f.close();}
});
