import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Worker } from "node:worker_threads";
import { openSqliteDatabase } from "./database/sqliteDatabase.js";
import { migrateDefinitiveDdt } from "./database/definitiveDdtMigration.js";
import { DefinitiveDdtRepository, pdfHash } from "./repositories/definitiveDdtRepository.js";
import { DefinitiveDdtService, type DdtIssuanceContext } from "./services/definitiveDdtService.js";

// Synthetic bytes exercise storage/transactions, not production document generation.
const render=(_snapshot:Record<string,unknown>,context:DdtIssuanceContext)=>Buffer.from(`%PDF-TEST-ONLY ${context.fullNumber}`);
const snapshot=()=>({customer:"Cliente fixture",materials:[{id:"fixture",quantity:1}]});
function fixture(path=":memory:") {
  const connection=openSqliteDatabase(path,{enableDefinitiveDdt:true}),db=connection.database;
  const operator=String(db.prepare("SELECT id FROM Operators WHERE active=1 LIMIT 1").get()!.id);
  for(let n=1;n<=4;n++){
    db.prepare("INSERT INTO Loads(id,commessa,cliente,camion,stato,createdAt,updatedAt) VALUES(?, 'FIXTURE','Cliente fixture',?,'ATTESA_SPEDIZIONE','now','now')").run(`L${n}`,`C${n}`);
    db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,transportMode,completedAt,startedAt,createdAt,updatedAt) VALUES(?,?,'ATTESA_SPEDIZIONE',?,'TRASPORTATORE','RITIRA_CLIENTE','2026-01-01T08:00:00Z','now','now','now')").run(`S${n}`,`L${n}`,operator);
    db.prepare("INSERT INTO OperationalEvents(id,loadId,loadingSessionId,type,operatorId,timestamp) VALUES(?,?,?,'LOADING_CLOSURE_CONFIRMED',?,'2026-01-01T08:00:00Z')").run(`E${n}`,`L${n}`,`S${n}`,operator);
  }
  const repo=new DefinitiveDdtRepository(db);
  let time="2026-10-17T10:00:00Z";
  const service=new DefinitiveDdtService(repo,"test",()=>new Date(time));
  const issue=(id="S1")=>service.issue(id,operator,snapshot,render);
  const state=()=>JSON.stringify([db.prepare("SELECT * FROM DdtDocuments ORDER BY id").all(),db.prepare("SELECT * FROM DdtSequences ORDER BY year").all()]);
  return {db,repo,service,operator,issue,state,setTime:(value:string)=>{time=value;},close:connection.close};
}

test("DDT Fase 2A: normale avvio senza attivazione dello schema definitivo",()=>{
  const connection=openSqliteDatabase(":memory:");try{
    assert.equal(connection.database.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('DdtDocuments','DdtSequences')").get()!.n,0);
  }finally{connection.close();}
});

test("DDT migration additive/idempotent: nessun documento, contatore o modifica operativa",()=>{
  const f=fixture();try{
    const before=JSON.stringify(f.db.prepare("SELECT * FROM LoadingSessions ORDER BY id").all());
    migrateDefinitiveDdt(f.db);migrateDefinitiveDdt(f.db);
    assert.equal(f.repo.valid("S1"),undefined);assert.equal(f.state(),"[[],[]]");
    assert.equal(JSON.stringify(f.db.prepare("SELECT * FROM LoadingSessions ORDER BY id").all()),before);
    assert.throws(()=>f.repo.nextNumber(2026),/TRANSACTION_REQUIRED/);
  }finally{f.close();}
});

test("DDT: progressivo annuale, cambio anno Europe/Rome e nessuna data partenza inventata",()=>{
  const f=fixture();try{
    f.setTime("2026-12-31T22:59:59Z");const first=f.issue();
    assert.equal(first.fullNumber,"X-Lam/0001/2026");assert.equal(first.documentDate,"2026-12-31");
    f.setTime("2026-12-31T23:00:00Z");const second=f.issue("S2"),third=f.issue("S3");
    assert.equal(second.fullNumber,"X-Lam/0001/2027");assert.equal(third.fullNumber,"X-Lam/0002/2027");
    assert.equal(second.documentDate,"2027-01-01");assert.equal(second.issuedAt,"2026-12-31T23:00:00.000Z");
    assert.equal(f.db.prepare("SELECT shippedAt FROM LoadingSessions WHERE id='S1'").get()!.shippedAt,null);
    assert.equal(f.db.prepare("SELECT stato FROM Loads WHERE id='L1'").get()!.stato,"ATTESA_SPEDIZIONE");
  }finally{f.close();}
});

test("DDT: unicità sessione, annullamento motivato, sostituzione e numero mai riutilizzato",()=>{
  const f=fixture();try{
    const first=f.issue(),before=f.state(),pdf=f.repo.originalPdf(first.id);
    assert.throws(()=>f.issue(),/ALREADY_VALID/);assert.equal(f.state(),before);
    assert.throws(()=>f.service.cancel(first.id,f.operator,"  "),/REASON_REQUIRED/);assert.equal(f.state(),before);
    f.setTime("2026-10-17T11:00:00Z");
    const cancelled=f.service.cancel(first.id,f.operator," Correzione destinazione ");
    assert.equal(cancelled.status,"ANNULLATO");assert.equal(cancelled.cancellationReason,"Correzione destinazione");
    assert.equal(cancelled.cancelledAt,"2026-10-17T11:00:00.000Z");assert.equal(cancelled.cancelledByOperatorId,f.operator);
    assert.throws(()=>f.service.cancel(first.id,f.operator,"Altro"),/ALREADY_CANCELLED/);
    const second=f.issue();assert.equal(second.fullNumber,"X-Lam/0002/2026");
    assert.equal(f.repo.find(first.id)!.replacedByDdtId,second.id);assert.equal(f.repo.valid("S1")!.id,second.id);
    assert.equal(f.repo.find(first.id)!.snapshotJson,first.snapshotJson);assert.deepEqual(f.repo.originalPdf(first.id),pdf);
    f.service.cancel(second.id,f.operator,"Seconda correzione");const third=f.issue();
    assert.equal(third.sequence,3);assert.equal(f.repo.find(second.id)!.replacedByDdtId,third.id);
    assert.equal(f.repo.find(first.id)!.replacedByDdtId,second.id);
  }finally{f.close();}
});

test("DDT: PDF originale, hash, snapshot immutabile e vincoli anche contro SQL diretto",()=>{
  const f=fixture();try{
    const data={customer:"Originale"};
    const doc=f.service.issue("S1",f.operator,()=>data,(value,context)=>{(value.data as {customer:string}).customer="Mutato dal renderer";return render(value,context);});
    data.customer="Mutato dopo";
    assert.equal(JSON.parse(doc.snapshotJson).data.customer,"Originale");
    const pdf=f.repo.originalPdf(doc.id);assert.equal(pdfHash(pdf),doc.pdfSha256);
    assert.equal(doc.pdfReference,`sqlite:ddt/${doc.id}`);
    for(const sql of ["UPDATE DdtDocuments SET snapshotJson='{}'","UPDATE DdtDocuments SET fullNumber='alterato'","UPDATE DdtDocuments SET pdfBytes=X'00'","UPDATE DdtDocuments SET pdfSha256='"+"0".repeat(64)+"'","DELETE FROM DdtDocuments","UPDATE DdtSequences SET lastNumber=1-1","DELETE FROM DdtSequences","DELETE FROM LoadingSessions WHERE id='S1'","DELETE FROM Loads WHERE id='L1'"]){assert.throws(()=>f.db.exec(sql),sql);}
    assert.deepEqual(f.repo.originalPdf(doc.id),pdf);
    assert.throws(()=>f.db.prepare("UPDATE Loads SET cliente='Modificato' WHERE id='L1'").run(),/DDT_LOAD_LOCKED/);
    f.db.prepare("UPDATE LoadingSessions SET shippedAt='2026-10-18T08:00:00Z',stato='SPEDITO' WHERE id='S1'").run();
    assert.deepEqual(f.repo.find(doc.id),doc);assert.deepEqual(f.repo.originalPdf(doc.id),pdf);
    assert.throws(()=>f.service.cancel(doc.id,f.operator,"Dopo partenza"),/ALREADY_DEPARTED/);
    assert.throws(()=>f.db.prepare("UPDATE DdtDocuments SET status='ANNULLATO',cancelledAt='now',cancelledByOperatorId=?,cancellationReason='SQL' WHERE id=?").run(f.operator,doc.id),/ALREADY_DEPARTED/);
    assert.equal(f.repo.find(doc.id)!.status,"EMESSO");
  }finally{f.close();}
});

test("DDT: rollback completo su snapshot, rendering, PDF e scrittura; nessun progressivo parziale",()=>{
  const f=fixture();try{
    const before=f.state();
    assert.throws(()=>f.service.issue("S1",f.operator,()=>{throw new Error("snapshot failure");},render),/snapshot failure/);assert.equal(f.state(),before);
    assert.throws(()=>f.service.issue("S1",f.operator,snapshot,()=>{throw new Error("render failure");}),/render failure/);assert.equal(f.state(),before);
    assert.throws(()=>f.service.issue("S1",f.operator,snapshot,()=>Buffer.from("bad")),/INVALID_PDF/);assert.equal(f.state(),before);
    f.db.exec("CREATE TRIGGER fail_ddt BEFORE INSERT ON DdtDocuments BEGIN SELECT RAISE(ABORT,'archive failure'); END;");
    assert.throws(()=>f.issue(),/archive failure/);assert.equal(f.state(),before);f.db.exec("DROP TRIGGER fail_ddt");
    assert.equal(f.issue().sequence,1);
    const first=f.repo.valid("S1")!;f.service.cancel(first.id,f.operator,"Correzione");const cancelled=f.state();
    f.db.exec("CREATE TRIGGER fail_replacement BEFORE UPDATE OF replacedByDdtId ON DdtDocuments BEGIN SELECT RAISE(ABORT,'replacement failure'); END;");
    assert.throws(()=>f.issue(),/replacement failure/);assert.equal(f.state(),cancelled);f.db.exec("DROP TRIGGER fail_replacement");
    assert.equal(f.issue().sequence,2);
  }finally{f.close();}
});

test("DDT: indice valido unico e identità sessione/carico protetti anche nel repository",()=>{
  const f=fixture();try{
    const first=f.issue(),before=f.state(),bytes=f.repo.originalPdf(first.id);
    assert.throws(()=>f.repo.transaction(()=>{
      const sequence=f.repo.nextNumber(2026);
      f.repo.insert({...first,id:"duplicate",sequence,fullNumber:`X-Lam/000${sequence}/2026`,pdfReference:"sqlite:ddt/duplicate"},bytes);
    }),/UNIQUE/);
    assert.equal(f.state(),before);
    assert.throws(()=>f.repo.transaction(()=>{
      const sequence=f.repo.nextNumber(2026);
      f.repo.insert({...first,id:"mismatch",loadId:"L2",sequence,fullNumber:`X-Lam/000${sequence}/2026`,pdfReference:"sqlite:ddt/mismatch"},bytes);
    }),/INVALID_INSERT/);
    assert.equal(f.state(),before);
    assert.throws(()=>f.db.prepare("UPDATE DdtDocuments SET status='ANNULLATO',cancelledAt='now',cancelledByOperatorId=?,cancellationReason=NULL WHERE id=?").run(f.operator,first.id),/CHECK/);
    f.service.cancel(first.id,f.operator,"Motivo");
    assert.throws(()=>f.db.exec("UPDATE DdtDocuments SET status='EMESSO',cancelledAt=NULL,cancelledByOperatorId=NULL,cancellationReason=NULL"),/IMMUTABLE/);
    assert.throws(()=>f.db.exec("UPDATE DdtDocuments SET cancellationReason='Riscritto'"),/IMMUTABLE/);
    assert.equal(f.issue().sequence,2);
  }finally{f.close();}
});

test("DDT: carico chiuso, operatore, trasporto effettivo e protezione fuori TEST",()=>{
  const f=fixture();try{
    for(const env of ["production","demo","development"]){const s=new DefinitiveDdtService(f.repo,env);assert.throws(()=>s.issue("S1",f.operator,snapshot,render),/TEST_ONLY/);assert.throws(()=>s.cancel("absent",f.operator,"Motivo"),/TEST_ONLY/);}
    assert.throws(()=>f.service.issue("S1","missing",snapshot,render),/ACTIVE_OPERATOR/);
    f.db.exec("UPDATE OperationalEvents SET type='LOADING_REOPENED' WHERE loadingSessionId='S1'");assert.throws(()=>f.issue(),/CLOSED_LOAD/);
    f.db.exec("UPDATE OperationalEvents SET type='LOADING_CLOSURE_CONFIRMED' WHERE loadingSessionId='S1'");
    f.db.exec("UPDATE LoadingSessions SET transportMode='TERZI_PER_ESSEPI' WHERE id='S1'");assert.throws(()=>f.issue(),/vettore effettivo/);
    assert.equal(f.state(),"[[],[]]");
    f.db.exec("UPDATE LoadingSessions SET transportMode='RITIRA_CLIENTE' WHERE id='S1'");assert.equal(f.issue().sequence,1);
  }finally{f.close();}
});

test("DDT: archivio persistente e hash verificato sulle ristampe dopo riavvio",()=>{
  const dir=mkdtempSync(join(tmpdir(),"sislog-ddt-archive-")),path=join(dir,"test.sqlite"),f=fixture(path);
  const doc=f.issue(),pdf=f.repo.originalPdf(doc.id);f.close();
  const connection=openSqliteDatabase(path,{enableDefinitiveDdt:true});try{
    const repo=new DefinitiveDdtRepository(connection.database);assert.deepEqual(repo.find(doc.id),doc);assert.deepEqual(repo.originalPdf(doc.id),pdf);
    // Simulate external corruption by deliberately bypassing the immutable-storage trigger.
    connection.database.exec("DROP TRIGGER ddt_immutable; UPDATE DdtDocuments SET pdfBytes=X'00'");
    assert.throws(()=>repo.originalPdf(doc.id),/INTEGRITY_ERROR/);
  }finally{connection.close();rmSync(dir,{recursive:true,force:true});}
});

async function simultaneous(path:string,operator:string,sessions:string[]) {
  const workers=sessions.map(session=>new Worker(`
    const {parentPort,workerData}=require('node:worker_threads');
    (async()=>{
      const {DatabaseSync}=await import('node:sqlite');
      const {DefinitiveDdtRepository}=await import(workerData.repo);
      const {DefinitiveDdtService}=await import(workerData.service);
      const db=new DatabaseSync(workerData.path);db.exec('PRAGMA foreign_keys=ON');
      const repo=new DefinitiveDdtRepository(db),service=new DefinitiveDdtService(repo,'test',()=>new Date('2026-10-17T10:00:00Z'));
      parentPort.once('message',()=>{
        try{const doc=service.issue(workerData.session,workerData.operator,()=>({fixture:true}),()=>Buffer.from('%PDF-TEST-CONCURRENT'));parentPort.postMessage({ok:true,number:doc.fullNumber});}
        catch(error){parentPort.postMessage({ok:false,error:error.message});}
        finally{db.close();parentPort.close();}
      });parentPort.postMessage({ready:true});
    })().catch(error=>{throw error;});
  `,{eval:true,workerData:{path,operator,session,repo:new URL("./repositories/definitiveDdtRepository.js",import.meta.url).href,service:new URL("./services/definitiveDdtService.js",import.meta.url).href}}));
  try {
    await Promise.all(workers.map(worker=>new Promise<void>((resolve,reject)=>{worker.once("message",()=>resolve());worker.once("error",reject);} )));
    const results=workers.map(worker=>new Promise<{ok:boolean;number?:string;error?:string}>((resolve,reject)=>{worker.once("message",resolve);worker.once("error",reject);}));
    workers.forEach(worker=>worker.postMessage("start"));return await Promise.all(results);
  }finally{await Promise.all(workers.map(worker=>worker.terminate()));}
}
test("DDT: emissioni simultanee reali, connessioni distinte, sessioni diverse e stessa sessione",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"sislog-ddt-concurrent-")),path=join(dir,"test.sqlite"),f=fixture(path);
  try{
    const different=await simultaneous(path,f.operator,["S1","S2"]);
    assert.ok(different.every(r=>r.ok),JSON.stringify(different));assert.deepEqual(different.map(r=>r.number).sort(),["X-Lam/0001/2026","X-Lam/0002/2026"]);
    const same=await simultaneous(path,f.operator,["S3","S3"]);
    assert.equal(same.filter(r=>r.ok).length,1);assert.equal(same.find(r=>!r.ok)!.error,"DDT_ALREADY_VALID");
    assert.equal(f.db.prepare("SELECT lastNumber FROM DdtSequences WHERE year=2026").get()!.lastNumber,3);
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM DdtDocuments").get()!.n,3);
  }finally{f.close();rmSync(dir,{recursive:true,force:true});}
});
