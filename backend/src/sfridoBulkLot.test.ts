import assert from "node:assert/strict";
import test from "node:test";
import { openSqliteDatabase } from "./database/sqliteDatabase.js";
import { readPreview } from "./repositories/ddtPreviewRepository.js";
import { IssuedDdtService } from "./services/issuedDdtService.js";
import { renderDdtPreview } from "./services/ddtPreviewPdf.js";
import { SFRIDO_BULK_LOT_POLICY as policy, classifyVerifiedBulkLot } from "./services/ddtBulkLotPolicy.js";

function fixture(quantity = 1) {
  const connection = openSqliteDatabase(":memory:", { enableDefinitiveDdt: true }), db = connection.database;
  const at = "2026-11-09T12:00:00Z", operator = String(db.prepare("SELECT id FROM Operators WHERE active=1 LIMIT 1").get()!.id);
  db.prepare("INSERT INTO Loads(id,commessa,cliente,camion,stato,createdAt,updatedAt) VALUES(?,?,? ,?,'ATTESA_SPEDIZIONE',?,?)").run(policy.loadId,policy.order,"Cliente sintetico",policy.truck,at,at);
  db.prepare("INSERT INTO Customers(id,denominazione,partitaIva,createdAt,updatedAt) VALUES('customer','Cliente sintetico','00123456789',?,?)").run(at,at);
  db.prepare("INSERT INTO ShipmentPlans(id,loadId,customerId,deliveryAddress,createdAt,updatedAt) VALUES('plan',?,'customer','Destinazione sintetica',?,?)").run(policy.loadId,at,at);
  db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,transportMode,startedAt,completedAt,createdAt,updatedAt) VALUES('session',?,'ATTESA_SPEDIZIONE',?,'TRASPORTATORE','RITIRA_CLIENTE',?,?,?,?)").run(policy.loadId,operator,at,at,at,at);
  db.prepare("INSERT INTO Packages(id,codicePacco,loadId,commessa,cliente,camion,stato,numeroPannelli,pesoTotale,volumeTotale,operatoreId,openedAt,closedAt,createdAt,updatedAt) VALUES(?,?,?,?,?,?,'CARICATO',6,520,1.04,?,?,?,?,?)").run(policy.packageId,policy.packageCode,policy.loadId,policy.order,"Cliente sintetico",policy.truck,operator,at,at,at,at);
  const insert = db.prepare("INSERT INTO Panels(id,loadId,numeroPannello,camion,tipoPannello,quantita,spessore,lunghezza,altezza,superficie,peso,volume,packageId,stato,scannedAt,scannedByOperatorId,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'CARICATO',?,?,?,?)");
  for(let n=101;n<=105;n++) insert.run(`panel-${n}`,policy.loadId,String(n),policy.truck,"L5-100",1,100,5200,400,2.08,104,.208,policy.packageId,at,operator,at,at);
  insert.run(policy.panelId,policy.loadId,policy.panelNumber,policy.truck,policy.material,quantity,0,0,0,0,0,0,policy.packageId,at,operator,at,at);
  db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,packageId,loadedAt,loadedByOperatorId,createdAt,updatedAt) VALUES('unit','session','PACKAGE',?,?,?,?,?)").run(policy.packageId,at,operator,at,at);
  db.prepare("INSERT INTO OperationalEvents(id,loadId,loadingSessionId,type,operatorId,timestamp) VALUES('closed',?,'session','LOADING_CLOSURE_CONFIRMED',?,?)").run(policy.loadId,operator,at);
  for(const row of db.prepare("SELECT id FROM Panels").all()) db.prepare("INSERT INTO OperationalEvents(id,loadId,panelId,packageId,type,operatorId,timestamp) VALUES(?,?,?,?, 'PANEL_SCANNED',?,?)").run(`scan-${row.id}`,policy.loadId,String(row.id),policy.packageId,operator,at);
  const model = () => readPreview(db,"session",new Date(at),true);
  const snapshot = () => JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r=>[r.name,db.prepare(`SELECT * FROM "${String(r.name)}" ORDER BY rowid`).all()]));
  return {db,operator,model,snapshot,service:new IssuedDdtService(db,"test"),close:()=>connection.close()};
}

test("SFRIDO: one explicit lot, five unchanged panels, partial known totals and read-only preview",()=>{
  const f=fixture();try{
    const before=f.snapshot(),model=f.model(),rows=model.groups.flatMap(g=>g.elements),lot=rows.find(p=>p.id===policy.panelId)!;
    assert.equal(model.groups[0]!.label,`PACCO ${policy.packageCode}`);assert.equal(rows.length,6);
    assert.equal(lot.kind,"BULK_LOT");assert.equal(lot.quantity,1);assert.equal(lot.length,null);assert.equal(lot.width,null);assert.equal(lot.area,null);assert.equal(lot.weight,null);
    assert.deepEqual(rows.filter(p=>p.kind!=="BULK_LOT").map(p=>[p.number,p.quantity,p.length,p.width,p.area,p.weight]),[101,102,103,104,105].map(n=>[String(n),1,5200,400,2.08,104]));
    assert.equal(model.totals.elements,6);assert.equal(model.totals.weight,520);assert.equal(model.totals.ordinaryElements,5);assert.equal(model.totals.bulkLots,1);assert.equal(model.totals.totalWeightKnown,false);assert(Math.abs(model.totals.knownPanelVolume!-1.04)<1e-10);
    assert.match(model.notes,/520 kg; 1,040 m³/);assert.match(model.notes,/Totali complessivi non determinabili/);
    const pdf=renderDdtPreview(model,true);assert(pdf.pdf.subarray(0,5).equals(Buffer.from("%PDF-")));assert.equal(pdf.placements.length,6);assert.equal(new Set(pdf.placements.map(p=>p.elementId)).size,6);
    assert.equal(f.service.status("session").canIssue,true);assert.equal(f.snapshot(),before);
  }finally{f.close();}
});

for(const field of ["quantita","lunghezza","altezza","superficie","peso"] as const) test(`ordinary panels remain strict: ${field}=0`,()=>{
  const f=fixture();try{f.db.prepare(`UPDATE Panels SET ${field}=0 WHERE id='panel-101'`).run();assert.throws(f.model,(e:unknown)=>e instanceof Error&&e.message.includes(field)&&e.message.includes("101"));}finally{f.close();}
});
for(const quantity of [0,2]) test(`SFRIDO requires explicitly corrected quantity 1, rejects ${quantity}`,()=>{
  const f=fixture(quantity);try{assert.throws(f.model,/rettifica autorizzata/);assert.equal(f.service.status("session").canIssue,false);}finally{f.close();}
});
test("SFRIDO classification cannot apply to namesakes or a different context",()=>{
  const f=fixture();try{
    const row=f.db.prepare("SELECT * FROM Panels WHERE id=?").get(policy.panelId)!;
    const context={loadId:policy.loadId,order:policy.order,truck:policy.truck,packageCode:policy.packageCode};
    assert.equal(classifyVerifiedBulkLot({...row,id:"another-row"},context),null);
    for(const changed of [{loadId:"other"},{packageId:"other"},{numeroPannello:"OTHER"},{tipoPannello:"OTHER"},{peso:10}])assert.throws(()=>classifyVerifiedBulkLot({...row,...changed},context));
    for(const changed of [{loadId:"other"},{order:"other"},{truck:"C2"},{packageCode:"other"}])assert.throws(()=>classifyVerifiedBulkLot(row,{...context,...changed}));
    f.db.prepare("UPDATE Panels SET tipoPannello='SFRIDO XLAM',lunghezza=0 WHERE id='panel-101'").run();assert.throws(f.model,/lunghezza non valido/);
  }finally{f.close();}
});
test("SFRIDO fixture: immutable archive, requestKey retry, sequence and cancellation remain intact",()=>{
  const f=fixture();try{
    const before=f.db.prepare("SELECT * FROM Panels ORDER BY id").all(),key=crypto.randomUUID();
    const doc=f.service.issue("session",f.operator,key),pdf=f.service.repo.originalPdf(doc.id);
    assert.match(doc.fullNumber,/^X-Lam\/0001\/\d{4}$/);assert.equal(f.service.issue("session",f.operator,key).id,doc.id);assert.deepEqual(f.service.repo.originalPdf(doc.id),pdf);
    const snapshot=JSON.parse(doc.snapshotJson);assert.equal(snapshot.data.model.groups[0].elements.find((p:{id:string})=>p.id===policy.panelId).kind,"BULK_LOT");assert.equal(snapshot.data.model.totals.totalWeightKnown,false);
    assert.throws(()=>f.db.prepare("UPDATE Panels SET quantita=2 WHERE id=?").run(policy.panelId),/DDT_LOAD_LOCKED/);
    f.service.documents.cancel(doc.id,f.operator,"Annullamento sintetico di regressione");assert.deepEqual(f.service.repo.originalPdf(doc.id),pdf);
    const replacement=f.service.issue("session",f.operator,crypto.randomUUID());assert.equal(replacement.sequence,2);assert.deepEqual(f.db.prepare("SELECT * FROM Panels ORDER BY id").all(),before);
  }finally{f.close();}
});
