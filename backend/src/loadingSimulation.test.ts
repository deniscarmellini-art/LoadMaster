import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { buildApp } from "./app.js";
import { parsePanelQr, parsePackageQr, panelQrText, packageQrText } from "./utils/labelQr.js";
import type { SimulationCandidate } from "./models/loadingSimulation.js";

test("simulatore TEST: QR reali, disponibilità, pacchi, scansioni normali e assenza di scritture in elenco",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"sislog-qr-simulator-")),databasePath=join(dir,"test.sqlite");
  const app=await buildApp({environment:"test",databasePath,port:3198,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath:null,httpsKeyPath:null,httpsCertPath:null});
  const db=new DatabaseSync(databasePath);
  try{
    const op=String(db.prepare("SELECT id FROM Operators WHERE active=1 LIMIT 1").get()!.id);
    for(const id of ["L","OTHER"])db.prepare("INSERT INTO Loads(id,commessa,cliente,camion,stato,createdAt,updatedAt) VALUES(?,?,'Cliente TEST','C1','IN_CARICO','now','now')").run(id,id);
    db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,transportMode,startedAt,createdAt,updatedAt) VALUES('S','L','IN_CARICO',?,'TRASPORTATORE','RITIRA_CLIENTE','now','now','now')").run(op);
    for(const [id,state] of [["PACK","DISPONIBILE"],["OPEN","APERTO"]])db.prepare("INSERT INTO Packages(id,codicePacco,loadId,commessa,cliente,camion,stato,operatoreId,openedAt,createdAt,updatedAt) VALUES(?,?,'L','L','Cliente TEST','C1',?,?,'now','now','now')").run(id!,`PK-${id}`,state!,op);
    for(const [id,loadId,state,pack] of [["single","L","DISPONIBILE",null],["child1","L","DISPONIBILE","PACK"],["child2","L","DISPONIBILE","PACK"],["open-child","L","IN_LAVORAZIONE_PACCO","OPEN"],["missing","L","MANCANTE",null],["loaded","L","CARICATO",null],["foreign","OTHER","DISPONIBILE",null]])
      db.prepare("INSERT INTO Panels(id,loadId,numeroPannello,camion,stato,packageId,spessore,lunghezza,altezza,peso,volume,createdAt,updatedAt) VALUES(?,?,?,'C1',?,?,100,1000,2000,50,.2,'now','now')").run(id!,loadId!,id!,state!,pack??null);
    const snapshot=()=>JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r=>[r.name,db.prepare(`SELECT * FROM "${String(r.name)}" ORDER BY rowid`).all()]));
    const list=()=>app.inject({method:"GET",url:"/api/loading-sessions/S/test-qr-candidates"});
    const before=snapshot(),listed=await list();assert.equal(listed.statusCode,200);assert.equal(listed.headers["cache-control"],"no-store");assert.equal(snapshot(),before);
    const items=listed.json<SimulationCandidate[]>();assert.deepEqual(items.map(i=>i.id),["single","PACK"]);
    const single=items[0]!,pack=items[1]!;
    assert.equal(single.qr,panelQrText({commessa:"L",cliente:"Cliente TEST",camion:"C1",numeroPannello:"single",spessore:100,lunghezza:1000,altezza:2000,peso:50}));
    assert.equal(pack.qr,packageQrText("PK-PACK","L","Cliente TEST","C1",2,100,.4));
    assert.equal(parsePanelQr(single.qr)!.numeroPannello,"single");assert.equal(parsePackageQr(pack.qr)!.numeroPannelli,2);
    const scan=(type:"PANEL"|"PACKAGE",id:string)=>app.inject({method:"POST",url:"/api/loading-sessions/S/units",payload:{operatorId:op,unitType:type,...(type==="PANEL"?{panelId:id}:{packageId:id})}});
    assert.equal((await scan("PANEL","foreign")).statusCode,409);assert.equal((await scan("PANEL","child1")).statusCode,409);assert.equal((await scan("PACKAGE","OPEN")).statusCode,409);
    assert.equal((await scan("PANEL",single.id)).statusCode,200);
    assert.deepEqual((await list()).json<SimulationCandidate[]>().map(i=>i.id),["PACK"]);
    assert.equal((await scan("PANEL",single.id)).statusCode,409);
    assert.equal((await scan("PACKAGE",pack.id)).statusCode,200);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM Panels WHERE packageId='PACK' AND stato='CARICATO'").get()!.n,2);
    assert.deepEqual((await list()).json(),[]);assert.equal((await scan("PACKAGE",pack.id)).statusCode,409);
    db.exec("UPDATE LoadingSessions SET stato='SPEDITO',shippedAt='2026-10-17' WHERE id='S';UPDATE Loads SET stato='SPEDITO' WHERE id='L'");
    const shipped=snapshot();assert.deepEqual((await list()).json(),[]);assert.equal(snapshot(),shipped);
    assert.equal((await scan("PANEL","single")).statusCode,409);
    assert.equal((await app.inject({method:"GET",url:"/api/loading-sessions/missing/test-qr-candidates"})).statusCode,404);
  }finally{db.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});

for(const environment of ["development","demo","production"] as const)test(`simulatore assente nel backend ${environment}, anche tramite richiesta diretta`,async()=>{
  const dir=mkdtempSync(join(tmpdir(),"sislog-qr-gate-"));writeFileSync(join(dir,"index.html"),"<html>Fixture TEST</html>");
  const app=await buildApp({environment,databasePath:":memory:",port:3198,host:"127.0.0.1",frontendOrigin:"http://localhost",frontendDistPath:environment==="production"?dir:null,httpsKeyPath:null,httpsCertPath:null});
  try{
    for(const method of ["GET","POST"] as const){const response=await app.inject({method,url:"/api/loading-sessions/S/test-qr-candidates"});assert.equal(response.statusCode,404);assert.ok(!response.body.includes('"qr":'));}
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
