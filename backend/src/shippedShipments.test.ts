import assert from 'node:assert/strict';
import test from 'node:test';
import {openSqliteDatabase} from './database/sqliteDatabase.js';
import {ShipmentRepository} from './repositories/shipmentRepository.js';
import {historyPage} from './repositories/historyRepository.js';

test('spedizioni: storiche senza piano, concluse con piano e in viaggio senza duplicati o scritture',()=>{
 const {database:db,close}=openSqliteDatabase(':memory:');
 try{
  const now='2026-10-01T10:00:00Z',repo=new ShipmentRepository(db);
  const carrier=String(db.prepare('SELECT id FROM Carriers LIMIT 1').get()!.id);
  const trailer=String(db.prepare('SELECT id FROM Trailers LIMIT 1').get()!.id);
  for(const id of ['HISTORY','PLANNED','TRAVEL','NO-DATE','READY','FUTURE'])db.prepare('INSERT INTO Loads(id,commessa,cliente,camion,stato,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)').run(id,id,'Cliente','C1',id==='READY'?'ATTESA_SPEDIZIONE':id==='FUTURE'?'DA_COMPLETARE':'SPEDITO',now,now);
  for(const id of ['HISTORY','PLANNED','TRAVEL'])db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,carrierId,transportMode,shippedAt,startedAt,createdAt,updatedAt) VALUES(?,?,'SPEDITO','TEST','TRASPORTATORE',?,?,?,?,?,?)").run('S-'+id,id,carrier,id==='TRAVEL'?'BILICO_ESSEPI':'RITIRA_CLIENTE',now,now,now,now);
  for(const id of ['PLANNED','READY','FUTURE'])db.prepare("INSERT INTO ShipmentPlans(id,loadId,plannedDepartureDate,transportMode,createdAt,updatedAt) VALUES(?,?,'2026-09-30','RITIRA_CLIENTE',?,?)").run('P-'+id,id,now,now);
  db.prepare("INSERT INTO TransportAssignments(id,trailerId,loadId,source,stato,departedAt,assignedAt,createdAt,updatedAt) VALUES('A',?,'TRAVEL','LOAD','IN_VIAGGIO',?,?,?,?)").run(trailer,now,now,now,now);
  const tables=['Loads','LoadingSessions','ShipmentPlans','TransportAssignments','OperationalEvents'];
  const snapshot=()=>tables.map(t=>db.prepare(`SELECT * FROM ${t} ORDER BY id`).all());const before=snapshot();
  const rows=repo.list(false),byLoad=(id:string)=>rows.filter(r=>r.loadId===id);
  assert.equal(byLoad('HISTORY').length,1);assert.equal(byLoad('HISTORY')[0]!.persisted,false);assert.equal(byLoad('HISTORY')[0]!.id,'load:HISTORY');assert.equal(byLoad('HISTORY')[0]!.shipmentStatus,'CONCLUSA');assert.equal(byLoad('HISTORY')[0]!.actualDepartureDate,now);assert.equal(byLoad('HISTORY')[0]!.plannedDepartureDate,null);assert.equal(byLoad('HISTORY')[0]!.transportType,'RITIRA_CLIENTE');
  assert.equal(byLoad('PLANNED').length,1);assert.equal(byLoad('PLANNED')[0]!.id,'P-PLANNED');assert.equal(byLoad('PLANNED')[0]!.actualDepartureDate,now);assert.equal(byLoad('PLANNED')[0]!.shipmentStatus,'CONCLUSA');
  assert.equal(byLoad('TRAVEL')[0]!.shipmentStatus,'IN_VIAGGIO');assert.equal(byLoad('TRAVEL')[0]!.operationalStatus,'SPEDITO');
  assert.equal(byLoad('NO-DATE')[0]!.shipmentStatus,'CONCLUSA');assert.equal(byLoad('NO-DATE')[0]!.actualDepartureDate,null);
  assert.equal(byLoad('READY')[0]!.shipmentStatus,'PRONTA');assert.equal(byLoad('FUTURE')[0]!.shipmentStatus,'PIANIFICATA');
  const history=historyPage(db,{pageSize:100});assert.equal(history.rows.length,3);assert.ok(history.rows.every(r=>byLoad(String(db.prepare('SELECT loadId FROM LoadingSessions WHERE id=?').get(r.id)!.loadId)).length===1));
  assert.deepEqual(repo.list(false),rows);assert.deepEqual(snapshot(),before);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 }finally{close();}
});
