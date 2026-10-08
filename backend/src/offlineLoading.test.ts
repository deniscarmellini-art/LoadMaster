import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteDatabase} from './database/sqliteDatabase.js';
import {LoadRepository} from './repositories/loadRepository.js';
import {LoadService} from './services/loadService.js';
import {ScanningRepository} from './repositories/scanningRepository.js';
import {ScanningService} from './services/scanningService.js';
import {LoadingRepository} from './repositories/loadingRepository.js';
import {LoadingService} from './services/loadingService.js';
import {decodeLoadingQr,offlineLines} from './services/offlineQr.js';
import {buildApp} from './app.js';
const panel=(n:string,camion='C1')=>({numeroPannello:n,numeroCliente:'NC',numeroMasterPanel:'MP',camion,lato1:'A',lato2:'B',tipoPannello:'X',quantita:1,spessore:100,lunghezza:1200,altezza:2400,superficie:2.88,volume:.288,peso:10});
const qr=(n:string,truck='C1')=>`C=OFFLINE|CL=Test|N=${n}|CA=${truck}|S=100|L=1200|H=2400|P=10`;
const packQr='PK=PK-OFFLINE|C=OFFLINE|CL=Test|CA=C1|PZ=2|KG=20.0|MC=0.576';
function fixture(path=':memory:',count=6){
 const connection=openSqliteDatabase(path),db=connection.database;
 const repo=new LoadRepository(db),loader=new LoadService(repo),scan=new ScanningService(new ScanningRepository(db)),loading=new LoadingService(new LoadingRepository(db));
 const op=String(db.prepare('SELECT id FROM Operators LIMIT 1').get()!.id);
 const loads=loader.import({commessa:'OFFLINE',cliente:'Test',numeroCliente:'NC',riferimentoOrdine:'TEST',pannelli:[...Array.from({length:count},(_,i)=>panel(String(i+1))),panel('OTHER','C2')]});
 const load=loads.find(l=>l.camion==='C1')!;
 for(const p of load.pannelli.filter(p=>p.numeroPannello!=='1'&&p.numeroPannello!=='2'))scan.closeSingle(p.id,{operatorId:op});
 const pack=scan.createPackage({loadId:load.id,panelId:load.pannelli.find(p=>p.numeroPannello==='1')!.id,operatorId:op});scan.addPanel(pack.id,{panelId:load.pannelli.find(p=>p.numeroPannello==='2')!.id,operatorId:op});
 scan.closePackage(pack.id,{codicePacco:'PK-OFFLINE',operatoreId:op,lunghezzaPacco:1,larghezzaPacco:1,altezzaPacco:1});
 const session=loading.create(load.id,{operatorId:op,destinationType:'TRASPORTATORE',transportMode:'RITIRA_CLIENTE'});
 const run=(text:string,confirm=false)=>loading.offline(session.id,{text,operatorId:op},confirm);
 return{...connection,db,loading,scan,op,load,pack,session,run};
}
test('Offline QR: singolo, pacco, blocco misto, duplicati, sovrapposizioni e verifica senza scritture',()=>{
 const f=fixture();try{
  const text=[qr('3'),packQr,qr('3'),qr('1'),qr('OTHER','C2'),'N=3',qr('NOPE'),qr('4')].join('\r\n');
  const before=f.db.prepare('SELECT total_changes() n').get()!.n;
  const preview=f.run(text);assert.equal(f.db.prepare('SELECT total_changes() n').get()!.n,before);
  assert.equal(f.run(packQr.replace('PZ=2','PZ=999')).rows[0]!.elements,2);
  f.run('N=3',true);assert.equal(f.db.prepare('SELECT total_changes() n').get()!.n,before);
  assert.deepEqual(preview.rows.map(r=>r.status),['VALID','VALID','DUPLICATE','ERROR','ERROR','ERROR','ERROR','VALID']);
  assert.equal(preview.counts.received,8);assert.equal(preview.counts.valid,3);assert.equal(preview.counts.packages,1);assert.equal(preview.counts.singles,2);assert.equal(preview.counts.elements,4);assert.equal(preview.counts.duplicates,1);assert.equal(preview.counts.errors,4);
  const composition=f.db.prepare('SELECT id,packageId FROM Panels WHERE packageId=? ORDER BY id').all(f.pack.id);
  const done=f.run(text,true);assert.equal(done.counts.loaded,3);assert.equal(done.counts.loadedElements,4);assert.equal(done.session!.units.length,3);
  assert.deepEqual(f.db.prepare('SELECT id,packageId FROM Panels WHERE packageId=? ORDER BY id').all(f.pack.id),composition);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM Packages").get()!.n,1);
  const again=f.run(text,true);assert.equal(again.counts.loaded,0);assert.equal(again.rows[0]!.status,'ALREADY_LOADED');assert.equal(again.rows[1]!.status,'ALREADY_LOADED');assert.equal(again.session!.units.length,3);
  // Regular scan API service retains its behavior, including duplicate protection.
  f.loading.addUnit(f.session.id,{unitType:'PANEL',panelId:f.load.pannelli[4]!.id,operatorId:f.op});
  assert.throws(()=>f.loading.addUnit(f.session.id,{unitType:'PANEL',panelId:f.load.pannelli[4]!.id,operatorId:f.op}),/Unità non disponibile/);
 }finally{f.close();}
});
test('Offline QR: CR/LF/CRLF, trasferimento rapido e blocco ripetuto',()=>{
 assert.deepEqual(offlineLines('a\rb\nc\r\nd\r\n'),['a','b','c','d']);
 assert.equal(decodeLoadingQr('N=3'),null);assert.equal(decodeLoadingQr(qr('3').replace('P=10','P=bad')),null);
 const f=fixture(':memory:',102);try{
  const block=[packQr,...Array.from({length:100},(_,i)=>qr(String(i+3)))].join('\n');
  assert.equal(f.run(block).counts.received,101);const done=f.run(block,true);assert.equal(done.counts.loaded,101);assert.equal(done.counts.loadedElements,102);
  assert.equal(f.run(block,true).counts.loaded,0);assert.equal(f.loading.get(f.session.id).units.length,101);
 }finally{f.close();}
});
test('Offline QR: postazione concorrente, stato cambiato, spediti e operatore disattivato',()=>{
 const dir=mkdtempSync(join(tmpdir(),'offline-qr-')),path=join(dir,'test.sqlite'),f=fixture(path);const second=openSqliteDatabase(path),other=new LoadingService(new LoadingRepository(second.database));
 try{
  assert.equal(f.run(qr('3')).counts.valid,1);
  other.addUnit(f.session.id,{unitType:'PANEL',panelId:f.load.pannelli[2]!.id,operatorId:f.op});
  assert.equal(f.run(qr('3'),true).rows[0]!.status,'ALREADY_LOADED');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM LoadingUnits WHERE active=1').get()!.n,1);
  f.scan.cancelPanel(f.load.pannelli[3]!.id,{operatorId:f.op});assert.equal(f.run(qr('4'),true).counts.loaded,0);
  f.run([packQr,qr('5'),qr('6')].join('\n'),true);
  assert.throws(()=>other.addUnit(f.session.id,{unitType:'PANEL',panelId:f.load.pannelli[0]!.id,operatorId:f.op}));
  // Prepare the cancelled single normally, then complete and ship normally.
  f.scan.closeSingle(f.load.pannelli[3]!.id,{operatorId:f.op});f.run(qr('4'),true);f.loading.ship(f.session.id,{});
  assert.equal(f.run(packQr,true).rows[0]!.status,'ERROR');
  const before=f.db.prepare('SELECT total_changes() n').get()!.n;f.run(packQr);assert.equal(f.db.prepare('SELECT total_changes() n').get()!.n,before);
  f.db.prepare('UPDATE Operators SET active=0 WHERE id=?').run(f.op);assert.match(f.run(qr('3'),true).rows[0]!.message,/Operatore/);
 }finally{second.close();f.close();rmSync(dir,{recursive:true,force:true});}
});
test('Offline QR API: anteprima read-only, conferma esplicita, replay e schema',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'offline-api-')),path=join(dir,'test.sqlite'),f=fixture(path);
 const app=await buildApp({environment:'test',port:3002,host:'127.0.0.1',databasePath:path,frontendOrigin:'http://localhost:5174',frontendDistPath:null,httpsKeyPath:null,httpsCertPath:null});
 try{
  const snapshot=()=>JSON.stringify(['Loads','Panels','Packages','LoadingSessions','LoadingUnits','OperationalEvents','LoadMaterialAvailabilityEvents'].map(table=>f.db.prepare(`SELECT * FROM ${table}`).all()));
  const before=snapshot(),payload={text:[qr('3'),packQr,'garbage'].join('\r\n'),operatorId:f.op};
  const preview=await app.inject({method:'POST',url:`/api/loading-sessions/${f.session.id}/offline/preview`,payload});assert.equal(preview.statusCode,200,preview.body);assert.equal(preview.json().counts.valid,2);assert.equal(snapshot(),before);
  assert.equal((await app.inject({method:'POST',url:`/api/loading-sessions/${f.session.id}/offline/confirm`,payload:{text:qr('3')}})).statusCode,400);assert.equal(snapshot(),before);
  const confirm=await app.inject({method:'POST',url:`/api/loading-sessions/${f.session.id}/offline/confirm`,payload});assert.equal(confirm.statusCode,200,confirm.body);assert.equal(confirm.json().counts.loaded,2);assert.equal(confirm.json().counts.loadedElements,3);assert.equal(confirm.json().rows[2].status,'ERROR');
  const after=snapshot();const replay=await app.inject({method:'POST',url:`/api/loading-sessions/${f.session.id}/offline/confirm`,payload});assert.equal(replay.json().counts.loaded,0);assert.equal(snapshot(),after);
 }finally{await app.close();f.close();rmSync(dir,{recursive:true,force:true});}
});
test('Offline QR: fallimento di una riga, rollback e successi dichiarati',()=>{
 const f=fixture();try{
  const failed=f.load.pannelli.find(p=>p.numeroPannello==='4')!;
  f.db.exec(`CREATE TRIGGER offline_failure BEFORE INSERT ON LoadingUnits WHEN NEW.panelId='${failed.id}' BEGIN SELECT RAISE(ABORT,'offline test failure'); END`);
  const result=f.run([qr('3'),qr('4'),qr('5')].join('\n'),true);
  assert.deepEqual(result.rows.map(r=>r.status),['LOADED','ERROR','LOADED']);assert.equal(result.counts.loaded,2);assert.equal(result.counts.loadedElements,2);
  assert.equal(f.db.prepare('SELECT stato FROM Panels WHERE id=?').get(failed.id)!.stato,'DISPONIBILE');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM LoadingUnits WHERE panelId=?').get(failed.id)!.n,0);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM OperationalEvents WHERE type='UNIT_LOADED'").get()!.n,2);
 }finally{f.close();}
});
