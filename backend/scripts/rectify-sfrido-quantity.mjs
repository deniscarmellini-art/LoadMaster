import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createConnection } from 'node:net';

export const TARGET = Object.freeze({panel:'04a5c37a-a3f5-4fbf-975e-f14b2d1cc0e5',load:'bdb815b9-8438-4b52-a7a3-bfb83ba96fab',pack:'061d5710-464e-402c-9c14-6563da944eaa',code:'PK-2026-000240',order:'265852',truck:'C1-',key:'SFRIDO_BULK_LOT_265852_PK240_V1'});
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const rows = (db,sql,...args) => db.prepare(sql).all(...args);
const fail = message => {throw new Error(message);};

/** No application imports, migrations, document issuance or session state transitions. */
export function rectifyInTransaction(db,{operatorId,reason,authorizationReference,now=new Date().toISOString()}) {
  if(!operatorId||!reason?.trim()||!authorizationReference?.trim())fail('Operator, reason and explicit authorization reference required');
  db.exec('BEGIN IMMEDIATE');
  try {
    const panel=db.prepare('SELECT * FROM Panels WHERE id=?').get(TARGET.panel),pack=db.prepare('SELECT * FROM Packages WHERE id=?').get(TARGET.pack),load=db.prepare('SELECT * FROM Loads WHERE id=?').get(TARGET.load);
    if(!panel||!pack||!load||panel.loadId!==TARGET.load||panel.packageId!==TARGET.pack||panel.numeroPannello!=='SFRIDO'||panel.tipoPannello!=='SFRIDO XLAM'||panel.camion!==TARGET.truck||pack.codicePacco!==TARGET.code||pack.loadId!==TARGET.load||pack.commessa!==TARGET.order||pack.camion!==TARGET.truck||load.commessa!==TARGET.order||load.camion!==TARGET.truck)fail('Target identity/context mismatch');
    if(['spessore','lunghezza','altezza','superficie','peso','volume'].some(k=>panel[k]!==0))fail('Unexpected measurements; do not overwrite real measurements');
    if(panel.stato!=='CARICATO'||pack.stato!=='CARICATO'||load.stato!=='ATTESA_SPEDIZIONE')fail('Unexpected operational state');
    const sessions=rows(db,'SELECT * FROM LoadingSessions WHERE loadId=?',TARGET.load);
    if(sessions.length!==1||sessions[0].stato!=='ATTESA_SPEDIZIONE'||!sessions[0].completedAt||sessions[0].shippedAt)fail('Load is not closed and waiting for departure');
    const session=sessions[0];
    const closure=db.prepare("SELECT type FROM OperationalEvents WHERE loadingSessionId=? AND (type IN ('LOADING_CLOSURE_CONFIRMED','LOADING_REOPENED','UNIT_UNLOADED') OR (type='LOADING_COMPLETED' AND note IS NULL)) ORDER BY rowid DESC LIMIT 1").get(session.id);
    if(!closure||!['LOADING_CLOSURE_CONFIRMED','LOADING_COMPLETED'].includes(closure.type))fail('Explicit closure required');
    if(rows(db,'SELECT id FROM DdtDocuments WHERE loadId=? OR loadingSessionId=?',TARGET.load,session.id).length)fail('Document history exists; no automatic rectification allowed');
    if(!db.prepare('SELECT 1 FROM Operators WHERE id=? AND active=1').get(operatorId))fail('Active operator required');
    const units=rows(db,'SELECT * FROM LoadingUnits WHERE packageId=?',TARGET.pack);
    if(units.length!==1||units[0].active!==1||units[0].loadingSessionId!==session.id||units[0].unitType!=='PACKAGE')fail('Unexpected package loading references');
    if(rows(db,'SELECT id FROM LoadingUnits WHERE panelId=?',TARGET.panel).length)fail('Unexpected direct loading reference');
    const others=rows(db,'SELECT * FROM Panels WHERE packageId=? AND id<>? ORDER BY numeroPannello',TARGET.pack,TARGET.panel);
    if(others.length!==5||others.some((p,i)=>p.numeroPannello!==String(101+i)||p.stato!=='CARICATO'||p.loadId!==TARGET.load||Math.abs(p.peso-104)>1e-8||Math.abs(p.volume-.208)>1e-10))fail('Five original panels no longer match verified case');
    if(pack.numeroPannelli!==6||Math.abs(pack.pesoTotale-520)>1e-8||Math.abs(pack.volumeTotale-1.04)>1e-10)fail('Package totals differ from verified case');
    const audits=rows(db,"SELECT id,note FROM OperationalEvents WHERE panelId=? AND type='SFRIDO_QUANTITY_RECTIFIED'",TARGET.panel).filter(e=>{try{return JSON.parse(e.note).correctionKey===TARGET.key;}catch{return false;}});
    if(panel.quantita===1&&audits.length===1){db.exec('ROLLBACK');return {alreadyApplied:true,auditId:audits[0].id};}
    if(panel.quantita!==0||audits.length)fail('Expected uncorrected quantity zero and no previous correction audit');
    const eventId=randomUUID(),note={correctionKey:TARGET.key,authorizationReference,reason,operatorId,before:{quantita:0},after:{quantita:1},classification:'BULK_LOT',unknownMeasurementsPreserved:true,packageCode:TARGET.code,loadId:TARGET.load};
    if(db.prepare('UPDATE Panels SET quantita=1 WHERE id=? AND quantita=0').run(TARGET.panel).changes!==1)fail('Unexpected update count');
    db.prepare("INSERT INTO OperationalEvents(id,loadId,panelId,packageId,loadingSessionId,type,operatorId,timestamp,note) VALUES(?,?,?,?,?,'SFRIDO_QUANTITY_RECTIFIED',?,?,?)").run(eventId,TARGET.load,TARGET.panel,TARGET.pack,session.id,operatorId,now,JSON.stringify(note));
    const after=db.prepare('SELECT * FROM Panels WHERE id=?').get(TARGET.panel);
    if(JSON.stringify(after)!==JSON.stringify({...panel,quantita:1})||JSON.stringify(rows(db,'SELECT * FROM Panels WHERE packageId=? AND id<>? ORDER BY numeroPannello',TARGET.pack,TARGET.panel))!==JSON.stringify(others)||JSON.stringify(db.prepare('SELECT * FROM Packages WHERE id=?').get(TARGET.pack))!==JSON.stringify(pack)||JSON.stringify(rows(db,'SELECT * FROM LoadingUnits WHERE packageId=?',TARGET.pack))!==JSON.stringify(units))fail('Unexpected side effect');
    if(db.prepare('PRAGMA foreign_key_check').all().length)fail('Foreign key check failed');
    db.exec('COMMIT');return {alreadyApplied:false,auditId:eventId,changedBusinessFields:['Panels.quantita'],before:0,after:1};
  } catch(error) {try{db.exec('ROLLBACK');}catch{}throw error;}
}

async function main() {
  const args=process.argv.slice(2),options={};
  if(args.length===1&&args[0]==='--help'){console.log('Deferred PROD tool. Required: --apply --confirm PROD-265852-PK-2026-000240-QUANTITY-1 --backup <verified.sqlite> --software-inventory <runtime-inventory.json> --operator-id <id> --reason <text> --authorization-reference <ref> --report <new protected report outside Git>. Does not start/stop services or resume maintenance.');return;}
  for(let i=0;i<args.length;i++){const key=args[i];if(key==='--apply')options.apply=true;else if(['--confirm','--backup','--software-inventory','--operator-id','--reason','--authorization-reference','--report'].includes(key)&&args[i+1])options[key.slice(2)]=args[++i];else fail('Invalid arguments; use --help');}
  if(!options.apply||options.confirm!=='PROD-265852-PK-2026-000240-QUANTITY-1'||!options.backup||!options['software-inventory']||!options['operator-id']||!options.reason||!options['authorization-reference']||!options.report)fail('No changes: all explicit authorization, backup, software and report arguments required');
  if(process.env.COMPUTERNAME!=='NAC25087')fail('Unexpected host');
  const root=realpathSync('C:/Sviluppo/LoadMaster'),database=join(root,'backend/data/sistema-logistico.sqlite'),maintenance='C:/ProgramData/SisLog/PROD/maintenance-state.json';
  const outside=p=>{if(!isAbsolute(p))return false;const r=relative(root,resolve(p));return r.startsWith('..')||isAbsolute(r);};
  if(!outside(options.backup)||!outside(options.report)||existsSync(options.report))fail('Backup and new report must be outside repository');
  const notice=JSON.parse(readFileSync(maintenance,'utf8'));
  if(notice.state!=='scheduled'||Date.parse(notice.scheduledAt)>Date.now())fail('PROD maintenance must already be effective');
  await new Promise((ok,no)=>{const socket=createConnection({host:'127.0.0.1',port:3001});socket.setTimeout(3000,()=>{socket.destroy();no(Error('Cannot verify port'));});socket.once('connect',()=>{socket.destroy();no(Error('Backend PROD must be stopped by the operator'));});socket.once('error',e=>e.code==='ECONNREFUSED'?ok():no(e));});
  for(const suffix of ['-wal','-shm','-journal'])if(existsSync(database+suffix))fail('Original database has SQLite sidecars');
  const software=JSON.parse(readFileSync(options['software-inventory'],'utf8')),required=['backend/dist/repositories/ddtPreviewRepository.js','backend/dist/services/ddtPreviewPdf.js','backend/dist/services/ddtBulkLotPolicy.js'];
  if(software.correctionKey!==TARGET.key||JSON.stringify(software.files.map(f=>f.path).sort())!==JSON.stringify(required.sort()))fail('Unexpected corrective software inventory');
  for(const f of software.files)if(hash(join(root,f.path))!==f.sha256)fail('Corrective software is not installed: '+f.path);
  if(!readFileSync(join(root,'backend/dist/services/ddtBulkLotPolicy.js'),'utf8').includes(TARGET.key))fail('Correction policy marker missing');
  const backup=realpathSync(options.backup);if(backup===realpathSync(database)||hash(backup)!==hash(database))fail('Fresh coherent backup must match stopped PROD byte-for-byte');
  const check=new DatabaseSync(backup,{readOnly:true});try{if(JSON.stringify(check.prepare('PRAGMA integrity_check').all().map(r=>r.integrity_check))!==JSON.stringify(['ok'])||check.prepare('PRAGMA foreign_key_check').all().length)fail('Backup SQLite verification failed');}finally{check.close();}
  const beforeHash=hash(database),maintenanceHash=hash(maintenance);writeFileSync(options.report,JSON.stringify({state:'PREFLIGHT_COMPLETE',authorizationReference:options['authorization-reference'],backup,sourceSha256:beforeHash},null,2),{flag:'wx'});
  const db=new DatabaseSync(database);let result;try{db.exec('PRAGMA foreign_keys=ON');result=rectifyInTransaction(db,{operatorId:options['operator-id'],reason:options.reason,authorizationReference:options['authorization-reference']});}finally{db.close();}
  if(hash(maintenance)!==maintenanceHash)fail('Maintenance state changed externally');
  const report={state:'QUANTITY_RECTIFIED_BACKEND_STILL_STOPPED',...result,authorizationReference:options['authorization-reference'],backup,sourceSha256Before:beforeHash,sourceSha256After:hash(database),ddtIssued:false,resumeExecuted:false};writeFileSync(options.report,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
