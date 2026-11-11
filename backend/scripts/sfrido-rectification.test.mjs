import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rectifyInTransaction, TARGET as t } from './rectify-sfrido-quantity.mjs';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE Loads(id TEXT PRIMARY KEY,commessa TEXT,camion TEXT,stato TEXT);
 CREATE TABLE Packages(id TEXT PRIMARY KEY,codicePacco TEXT,loadId TEXT,commessa TEXT,camion TEXT,stato TEXT,numeroPannelli INTEGER,pesoTotale REAL,volumeTotale REAL);
 CREATE TABLE Panels(id TEXT PRIMARY KEY,loadId TEXT,packageId TEXT,numeroPannello TEXT,tipoPannello TEXT,quantita REAL,spessore REAL,lunghezza REAL,altezza REAL,superficie REAL,peso REAL,volume REAL,stato TEXT,scannedAt TEXT,scannedByOperatorId TEXT);
 CREATE TABLE LoadingSessions(id TEXT PRIMARY KEY,loadId TEXT,stato TEXT,completedAt TEXT,shippedAt TEXT);
 CREATE TABLE LoadingUnits(id TEXT PRIMARY KEY,packageId TEXT,panelId TEXT,loadingSessionId TEXT,active INTEGER,unitType TEXT);
 CREATE TABLE DdtDocuments(id TEXT PRIMARY KEY,loadId TEXT,loadingSessionId TEXT); CREATE TABLE DdtSequences(year INTEGER,lastNumber INTEGER);
 CREATE TABLE Operators(id TEXT PRIMARY KEY,active INTEGER);
 CREATE TABLE OperationalEvents(id TEXT PRIMARY KEY,loadId TEXT,panelId TEXT,packageId TEXT,loadingSessionId TEXT,type TEXT,operatorId TEXT,timestamp TEXT,note TEXT);
 INSERT INTO Operators VALUES('op',1);`);
 db.prepare("INSERT INTO Loads VALUES(?,?,?,'ATTESA_SPEDIZIONE')").run(t.load,t.order,t.truck);
 db.prepare("INSERT INTO Packages VALUES(?,?,?,?,?,'CARICATO',6,520,1.04)").run(t.pack,t.code,t.load,t.order,t.truck);
 db.prepare("INSERT INTO LoadingSessions VALUES('session',?,'ATTESA_SPEDIZIONE','closed',NULL)").run(t.load);
 db.prepare("INSERT INTO LoadingUnits VALUES('unit',?,NULL,'session',1,'PACKAGE')").run(t.pack);
 db.prepare("INSERT INTO OperationalEvents VALUES('close',?,NULL,NULL,'session','LOADING_CLOSURE_CONFIRMED','op','closed',NULL)").run(t.load);
 for(let n=101;n<=105;n++)db.prepare("INSERT INTO Panels VALUES(?,?,?,?,?,1,100,5200,400,2.08,104,.208,'CARICATO','original-scan','op')").run(String(n),t.load,t.pack,String(n),'L5-100');
 db.prepare("INSERT INTO Panels VALUES(?,?,?,?,?,0,0,0,0,0,0,0,'CARICATO','original-scrap-scan','op')").run(t.panel,t.load,t.pack,'SFRIDO','SFRIDO XLAM');
 db.prepare("INSERT INTO OperationalEvents VALUES('scan',?,?,?,NULL,'PANEL_SCANNED','op','original-scrap-scan',NULL)").run(t.load,t.panel,t.pack);
 db.exec("ALTER TABLE Panels ADD COLUMN camion TEXT; UPDATE Panels SET camion='C1-'");
 const snapshot=()=>Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r=>[r.name,db.prepare(`SELECT * FROM ${r.name} ORDER BY rowid`).all().map(row=>({...row}))]));
 const run=()=>rectifyInTransaction(db,{operatorId:'op',reason:'Rettifica sintetica',authorizationReference:'FIXTURE-AUTHORIZATION',now:'2026-11-09T12:00:00Z'});
 return {db,snapshot,run};
}
test('rectification: one business field plus append-only audit; all other records and scans unchanged',()=>{
 const f=fixture();try{const before=f.snapshot(),result=f.run(),after=f.snapshot();assert.equal(result.alreadyApplied,false);for(const key of Object.keys(before))if(!['Panels','OperationalEvents'].includes(key))assert.deepEqual(after[key],before[key]);
 assert.deepEqual(after.Panels,before.Panels.map(p=>p.id===t.panel?{...p,quantita:1}:p));assert.deepEqual(after.OperationalEvents.slice(0,-1),before.OperationalEvents);const audit=after.OperationalEvents.at(-1);assert.equal(audit.type,'SFRIDO_QUANTITY_RECTIFIED');assert.equal(audit.operatorId,'op');assert.equal(JSON.parse(audit.note).authorizationReference,'FIXTURE-AUTHORIZATION');assert.deepEqual(JSON.parse(audit.note).before,{quantita:0});assert.deepEqual(JSON.parse(audit.note).after,{quantita:1});const stable=f.snapshot();assert.equal(f.run().alreadyApplied,true);assert.deepEqual(f.snapshot(),stable);
 }finally{f.db.close();}
});
test('rectification: audit failure rolls back quantity and leaves no partial correction',()=>{
 const f=fixture();try{f.db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON OperationalEvents WHEN NEW.type='SFRIDO_QUANTITY_RECTIFIED' BEGIN SELECT RAISE(ABORT,'AUDIT_FAILURE'); END;");const before=f.snapshot();assert.throws(f.run,/AUDIT_FAILURE/);assert.deepEqual(f.snapshot(),before);}finally{f.db.close();}
});
for(const [name,sql] of [
 ['document history',`INSERT INTO DdtDocuments VALUES('doc','${t.load}','session')`],
 ['quantity already changed without audit',`UPDATE Panels SET quantita=1 WHERE id='${t.panel}'`],
 ['inactive operator',"UPDATE Operators SET active=0"],
 ['wrong package',"UPDATE Packages SET codicePacco='OTHER'"],
 ['unexpected material measurement',`UPDATE Panels SET peso=10 WHERE id='${t.panel}'`],
 ['load reopened',"UPDATE LoadingSessions SET stato='IN_CARICO'"],
])test(`rectification refuses ${name} without changing anything`,()=>{const f=fixture();try{f.db.exec(sql);const before=f.snapshot();assert.throws(f.run);assert.deepEqual(f.snapshot(),before);}finally{f.db.close();}});
test('CLI requires explicit gates; help and missing args never rectify',()=>{
 const script=fileURLToPath(new URL('./rectify-sfrido-quantity.mjs',import.meta.url));assert.equal(spawnSync(process.execPath,[script,'--help'],{encoding:'utf8'}).status,0);const rejected=spawnSync(process.execPath,[script],{encoding:'utf8'});assert.equal(rejected.status,1);assert.match(rejected.stderr,/No changes/);
});
test('rectification works with actual migrated schema and foreign keys on a wholly synthetic fixture',async()=>{
 const {openSqliteDatabase}=await import('../.release-candidate/database/sqliteDatabase.js');
 const minimal=fixture(),connection=openSqliteDatabase(':memory:',{enableDefinitiveDdt:true}),db=connection.database,at='2026-11-09T12:00:00Z';
 try{
  const defaults={Operators:{code:'FIX',name:'Operatore sintetico',createdAt:at,updatedAt:at},Loads:{cliente:'Cliente sintetico',createdAt:at,updatedAt:at},Packages:{cliente:'Cliente sintetico',operatoreId:'op',openedAt:at,closedAt:at,createdAt:at,updatedAt:at},Panels:{createdAt:at,updatedAt:at},LoadingSessions:{operatorId:'op',destinationType:'TRASPORTATORE',transportMode:'RITIRA_CLIENTE',startedAt:at,createdAt:at,updatedAt:at},LoadingUnits:{loadedAt:at,loadedByOperatorId:'op',createdAt:at,updatedAt:at}};
  const source=minimal.snapshot();
  for(const table of ['Operators','Loads','Packages','Panels','LoadingSessions','LoadingUnits','OperationalEvents'])for(const row of source[table]){
   const data={...defaults[table],...row},columns=Object.keys(data);db.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).run(...Object.values(data));
  }
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  const result=rectifyInTransaction(db,{operatorId:'op',reason:'Solo fixture sintetica',authorizationReference:'FULL-SCHEMA-TEST'});
  assert.equal(result.after,1);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM DdtDocuments').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM DdtSequences').get().n,0);
 }finally{minimal.db.close();connection.close();}
});
