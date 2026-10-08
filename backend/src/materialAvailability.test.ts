import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSqliteDatabase } from "./database/sqliteDatabase.js";
import { migrateMaterialAvailability } from "./database/materialAvailabilityMigration.js";
import { LoadRepository } from "./repositories/loadRepository.js";
import { LoadService } from "./services/loadService.js";
import { ScanningRepository } from "./repositories/scanningRepository.js";
import { ScanningService } from "./services/scanningService.js";
import { LoadingRepository } from "./repositories/loadingRepository.js";
import { LoadingService } from "./services/loadingService.js";
import { calendarWarehouseDays, materialAvailabilityDetails } from "./repositories/materialAvailability.js";
import { shipmentHistoryMetrics } from "./repositories/shipmentHistoryMetrics.js";

const panel=(numeroPannello:string,camion="C1")=>({numeroPannello,numeroCliente:"NC",numeroMasterPanel:"MP",camion,lato1:"A",lato2:"B",tipoPannello:"X",quantita:1,spessore:100,lunghezza:1200,altezza:2400,superficie:2.88,volume:.288,peso:10});
const manifest=(pannelli:ReturnType<typeof panel>[])=>({commessa:"TEST-AVAILABILITY",cliente:"Test",numeroCliente:"NC",riferimentoOrdine:"TEST",pannelli});
function fixture(path=":memory:") {
  const connection=openSqliteDatabase(path),db=connection.database;
  const loadRepo=new LoadRepository(db),loadService=new LoadService(loadRepo),scanRepo=new ScanningRepository(db),scan=new ScanningService(scanRepo),loadingRepo=new LoadingRepository(db),loading=new LoadingService(loadingRepo);
  const op=String(db.prepare("SELECT id FROM Operators LIMIT 1").get()!.id);
  const load=loadService.import(manifest([panel("1"),panel("2"),panel("3")]))[0]!;
  const close=(index:number)=>scan.closeSingle(loadRepo.panels(load.id)[index]!.id,{operatorId:op});
  const details=()=>materialAvailabilityDetails(db,load.id);
  const completeEvents=()=>db.prepare("SELECT * FROM LoadMaterialAvailabilityEvents WHERE loadId=? AND type='COMPLETE' ORDER BY sequence").all(load.id);
  const createSession=()=>loading.create(load.id,{operatorId:op,destinationType:"TRASPORTATORE",transportMode:"RITIRA_CLIENTE"});
  return{...connection,db,loadRepo,loadService,scanRepo,scan,loadingRepo,loading,op,load,prepare:close,details,completeEvents,createSession};
}

test("disponibilità materiale: transizioni, manifest, snapshot e compatibilità",async t=>{
  await t.test("ultima preparazione: stesso timestamp dell'evento, scansione semplice non certifica",()=>{
    const f=fixture();try{
      f.scan.scan(f.load.pannelli[0]!.id,{operatorId:f.op});
      assert.equal(f.completeEvents().length,0);
      f.prepare(0);f.prepare(1);assert.equal(f.completeEvents().length,0);
      const last=f.prepare(2),completed=f.completeEvents();
      assert.equal(completed.length,1);assert.equal(completed[0]!.occurredAt,last.scannedAt);
      assert.equal(f.details().current?.availableAt,last.scannedAt);
      assert.equal(completed[0]!.expectedCount,3);assert.equal(completed[0]!.availableCount,3);
    }finally{f.close();}
  });
  await t.test("scansione duplicata e operazioni su carico completo non duplicano eventi",()=>{
    const f=fixture();try{
      for(let i=0;i<3;i++)f.prepare(i);
      const before=f.completeEvents();
      assert.throws(()=>f.prepare(2),/Elemento non disponibile/);
      f.scan.updateManualLocation(f.load.pannelli[0]!.id,{location:"Area Test"});
      f.loadService.updateOrderImport(f.load.commessa,manifest([panel("3"),panel("2"),panel("1")]));
      assert.deepEqual(f.completeEvents(),before);
    }finally{f.close();}
  });
  await t.test("carico preesistente completo: nessuna retrodatazione o completamento inventato",()=>{
    const f=fixture();try{
      f.db.prepare("UPDATE Panels SET stato='DISPONIBILE' WHERE loadId=?").run(f.load.id);
      assert.equal(f.completeEvents().length,0);
      f.scan.updateManualLocation(f.load.pannelli[0]!.id,{location:"Test"});
      const s=f.createSession();for(const p of f.load.pannelli)f.loading.addUnit(s.id,{unitType:"PANEL",panelId:p.id,operatorId:f.op});
      const shipped=f.loading.ship(s.id,{});
      assert.equal(shipped.historyMetrics?.warehouseDays,null);
      assert.equal(f.details().shipment?.availableAt,null);
      assert.equal(f.completeEvents().length,0);
    }finally{f.close();}
  });
  await t.test("pacco in preparazione non disponibile, chiusura dell'ultimo pacco completa",()=>{
    const f=fixture();try{
      f.prepare(2);
      const pack=f.scan.createPackage({loadId:f.load.id,panelId:f.load.pannelli[0]!.id,operatorId:f.op});
      f.scan.addPanel(pack.id,{panelId:f.load.pannelli[1]!.id,operatorId:f.op});
      assert.equal(f.completeEvents().length,0);
      const closed=f.scan.closePackage(pack.id,{codicePacco:"PK-TEST",operatoreId:f.op,lunghezzaPacco:1,larghezzaPacco:1,altezzaPacco:1});
      assert.equal(f.completeEvents().length,1);assert.equal(f.details().current?.availableAt,closed.closedAt);
      const s=f.createSession();f.loading.addUnit(s.id,{unitType:"PACKAGE",packageId:pack.id,operatorId:f.op});
      f.loading.addUnit(s.id,{unitType:"PANEL",panelId:f.load.pannelli[2]!.id,operatorId:f.op});
      assert.equal(f.loading.ship(s.id,{}).historyMetrics?.warehouseDays,0);
    }finally{f.close();}
  });
  await t.test("materiale già caricato conta come disponibile, caricamento fisico non resetta data",()=>{
    const f=fixture();try{
      f.prepare(0);f.prepare(1);const s=f.createSession();
      for(let i=0;i<2;i++)f.loading.addUnit(s.id,{unitType:"PANEL",panelId:f.load.pannelli[i]!.id,operatorId:f.op});
      assert.equal(f.completeEvents().length,0);
      const last=f.prepare(2),date=f.details().current?.availableAt;
      assert.equal(date,last.scannedAt);assert.equal(f.completeEvents().length,1);
      f.loading.addUnit(s.id,{unitType:"PANEL",panelId:last.id,operatorId:f.op});
      assert.equal(f.details().current?.availableAt,date);assert.equal(f.completeEvents().length,1);
    }finally{f.close();}
  });
  await t.test("import identico conserva versione; aggiunta invalida e nuovo completamento",()=>{
    const f=fixture();try{
      for(let i=0;i<3;i++)f.prepare(i);const before=f.details();
      f.loadService.updateOrderImport(f.load.commessa,manifest([panel("1"),panel("2"),panel("3")]));
      assert.deepEqual(f.details(),before);
      f.loadService.updateOrderImport(f.load.commessa,manifest([panel("1"),panel("2"),panel("3"),panel("4")]));
      assert.equal(f.details().current?.manifestVersion,2);assert.equal(f.details().current?.availableAt,null);
      assert.equal(f.details().events.filter(e=>e.type==="INVALIDATED").length,1);
      f.prepare(3);assert.equal(f.completeEvents().length,2);
      assert.equal(f.completeEvents()[1]!.manifestVersion,2);
    }finally{f.close();}
  });
  await t.test("stesso conteggio ma altri elementi, o dati materiali diversi, cambiano versione",()=>{
    const f=fixture();try{
      for(let i=0;i<3;i++)f.prepare(i);const originalHash=f.details().current?.manifestHash;
      f.loadService.updateOrderImport(f.load.commessa,{...manifest([panel("1"),panel("2"),panel("4")]),removeMissing:true});
      assert.equal(f.loadRepo.panels(f.load.id).length,3);assert.notEqual(f.details().current?.manifestHash,originalHash);
      f.prepare(2);const secondHash=f.details().current?.manifestHash;
      f.loadService.updateOrderImport(f.load.commessa,manifest([panel("1"),panel("2"),{...panel("4"),peso:20}]));
      assert.notEqual(f.details().current?.manifestHash,secondHash);assert.equal(f.details().current?.manifestVersion,3);
    }finally{f.close();}
  });
  await t.test("205/212/222 riassegnati tra C2/C3 conservano ID, preparazione e storico",()=>{
    const f=fixture();try{
      const input=manifest([panel("205","C2"),panel("212","C2"),panel("222","C2"),panel("C3-A","C3")]);
      f.loadService.updateOrderImport(f.load.commessa,input);
      const c2=f.loadRepo.findByOrderTruck(f.load.commessa,"C2")!,c3=f.loadRepo.findByOrderTruck(f.load.commessa,"C3")!;
      for(const p of c2.pannelli)f.scan.closeSingle(p.id,{operatorId:f.op});
      const originals=f.loadRepo.panels(c2.id),history=f.db.prepare("SELECT * FROM OperationalEvents WHERE panelId IN (?,?,?) ORDER BY id").all(...originals.map(p=>p.id));
      const move=manifest([panel("205","C3"),panel("212","C3"),panel("222","C3"),panel("C3-A","C3")]);
      f.loadService.updateOrderImport(f.load.commessa,move);
      for(const p of originals){const actual=f.scanRepo.findPanel(p.id)!;assert.equal(actual.loadId,c3.id);assert.equal(actual.scannedAt,p.scannedAt);assert.equal(actual.stato,"DISPONIBILE");}
      for(const event of history)assert.deepEqual(f.db.prepare("SELECT * FROM OperationalEvents WHERE id=?").get(String(event.id)),event);
      assert.equal(materialAvailabilityDetails(f.db,c2.id).current?.availableAt,null);
      assert.equal(materialAvailabilityDetails(f.db,c3.id).current?.isComplete,0);
      f.scan.closeSingle(c3.pannelli[0]!.id,{operatorId:f.op});
      assert.equal(materialAvailabilityDetails(f.db,c3.id).current?.isComplete,1);
      assert.equal(f.db.prepare("SELECT COUNT(*) n FROM Panels WHERE numeroPannello IN ('205','212','222')").get()!.n,3);
    }finally{f.close();}
  });
  await t.test("annullamento e nuovo completamento: usa la continuità più recente",child=>{
    child.mock.timers.enable({apis:["Date"],now:new Date("2026-10-05T08:00:00Z")});
    const f=fixture();try{
      for(let i=0;i<3;i++)f.prepare(i);const first=f.details().current?.availableAt;
      child.mock.timers.setTime(new Date("2026-10-06T08:00:00Z").getTime());
      f.scan.cancelPanel(f.load.pannelli[2]!.id,{operatorId:f.op});assert.equal(f.details().current?.availableAt,null);
      child.mock.timers.setTime(new Date("2026-10-07T08:00:00Z").getTime());f.prepare(2);
      assert.notEqual(f.details().current?.availableAt,first);assert.equal(f.completeEvents().length,2);
      const s=f.createSession();for(const p of f.load.pannelli)f.loading.addUnit(s.id,{unitType:"PANEL",panelId:p.id,operatorId:f.op});
      child.mock.timers.setTime(new Date("2026-10-08T08:00:00Z").getTime());
      assert.equal(f.loading.ship(s.id,{}).historyMetrics?.warehouseDays,1);
    }finally{f.close();}
  });
  await t.test("partenza: snapshot immutabile, stessa transazione e riapertura senza invalidazione materiale",child=>{
    child.mock.timers.enable({apis:["Date"],now:new Date("2026-10-05T08:00:00Z")});
    const f=fixture();try{
      for(let i=0;i<3;i++)f.prepare(i);const readiness=f.details().current;
      const s=f.createSession();for(const p of f.load.pannelli)f.loading.addUnit(s.id,{unitType:"PANEL",panelId:p.id,operatorId:f.op});
      f.loading.reopen(s.id,{});assert.deepEqual(f.details().current,readiness);
      child.mock.timers.setTime(new Date("2026-10-08T08:00:00Z").getTime());
      assert.throws(()=>f.loadingRepo.transaction(()=>{f.loadingRepo.ship(s.id);throw new Error("ROLLBACK_PROBE");}),/ROLLBACK_PROBE/);
      assert.equal(f.details().shipment,null);assert.equal(f.loading.get(s.id).shippedAt,null);
      const shipped=f.loading.ship(s.id,{}),snapshot=f.details().shipment!;
      assert.equal(shipped.historyMetrics?.warehouseDays,3);assert.equal(snapshot.shippedAt,shipped.shippedAt);
      assert.equal(snapshot.manifestHash,readiness?.manifestHash);assert.equal(snapshot.availableAt,readiness?.availableAt);
      assert.throws(()=>f.db.prepare("UPDATE LoadMaterialAvailabilityShipments SET warehouseDays=999 WHERE loadId=?").run(f.load.id),/SNAPSHOT_IMMUTABLE/);
      assert.throws(()=>f.db.prepare("UPDATE LoadMaterialAvailabilityEvents SET occurredAt='1999' WHERE loadId=?").run(f.load.id),/EVENT_IMMUTABLE/);
      f.db.prepare("UPDATE Panels SET numeroMasterPanel='external corruption' WHERE loadId=?").run(f.load.id);
      assert.equal(shipmentHistoryMetrics(f.db,f.load.id,shipped.shippedAt).warehouseDays,3);
      assert.deepEqual(f.details().shipment,snapshot);
    }finally{f.close();}
  });
  await t.test("spedizioni precedenti e GET non inventano disponibilità",()=>{
    const f=fixture();try{
      f.db.prepare("UPDATE Panels SET stato='SPEDITO' WHERE loadId=?").run(f.load.id);
      f.db.prepare("UPDATE Loads SET stato='SPEDITO' WHERE id=?").run(f.load.id);
      const before=f.details();f.loadService.list();f.loadService.get(f.load.id);f.loading.list();
      assert.deepEqual(f.details(),before);
      assert.equal(shipmentHistoryMetrics(f.db,f.load.id,"2026-10-08T08:00:00Z").warehouseDays,null);
    }finally{f.close();}
  });
  await t.test("due connessioni: scrittori serializzati, duplicate dopo commit e rollback",()=>{
    const dir=mkdtempSync(join(tmpdir(),"availability-concurrency-")),f=fixture(join(dir,"test.sqlite")),second=openSqliteDatabase(join(dir,"test.sqlite"));
    try{
      const other=new ScanningService(new ScanningRepository(second.database));f.prepare(0);f.prepare(1);
      f.scanRepo.transaction(()=>{
        f.scanRepo.closeSingle(f.load.pannelli[2]!.id,f.op);
        assert.throws(()=>other.closeSingle(f.load.pannelli[2]!.id,{operatorId:f.op}),/locked/);
      });
      assert.equal(f.completeEvents().length,1);
      assert.throws(()=>other.closeSingle(f.load.pannelli[2]!.id,{operatorId:f.op}),/Elemento non disponibile/);
      assert.equal(f.completeEvents().length,1);
      const before=f.details();assert.throws(()=>f.scanRepo.transaction(()=>{f.scanRepo.cancelSingle(f.load.pannelli[2]!.id,f.op);throw new Error("abort");}),/abort/);
      assert.deepEqual(f.details(),before);
      assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(),[]);
    }finally{second.close();f.close();rmSync(dir,{recursive:true,force:true});}
  });
  await t.test("migration incrementale e idempotente, persistenza dopo riavvio",()=>{
    const dir=mkdtempSync(join(tmpdir(),"availability-migration-")),path=join(dir,"test.sqlite"),f=fixture(path);
    let closed=false;try{
      for(let i=0;i<3;i++)f.prepare(i);const before=f.details(),panels=f.loadRepo.panels(f.load.id);
      migrateMaterialAvailability(f.db);migrateMaterialAvailability(f.db);
      assert.deepEqual(f.details(),before);assert.deepEqual(f.loadRepo.panels(f.load.id),panels);
      f.close();closed=true;const reopened=openSqliteDatabase(path);
      try{assert.deepEqual(materialAvailabilityDetails(reopened.database,f.load.id),before);assert.deepEqual(reopened.database.prepare("PRAGMA foreign_key_check").all(),[]);}finally{reopened.close();}
    }finally{if(!closed)f.close();rmSync(dir,{recursive:true,force:true});}
  });
  await t.test("errore nella registrazione: rollback anche dell'ultima preparazione",()=>{
    const f=fixture();try{
      f.prepare(0);f.prepare(1);const before=f.details(),events=f.db.prepare("SELECT * FROM OperationalEvents ORDER BY id").all();
      f.db.exec("CREATE TRIGGER availability_failure BEFORE INSERT ON LoadMaterialAvailabilityEvents WHEN NEW.type='COMPLETE' BEGIN SELECT RAISE(ABORT,'AVAILABILITY_WRITE_FAILED'); END");
      assert.throws(()=>f.prepare(2),/AVAILABILITY_WRITE_FAILED/);
      assert.equal(f.scanRepo.findPanel(f.load.pannelli[2]!.id)!.stato,"MANCANTE");
      assert.deepEqual(f.details(),before);assert.deepEqual(f.db.prepare("SELECT * FROM OperationalEvents ORDER BY id").all(),events);
    }finally{f.close();}
  });
  await t.test("anomalia cronologica esplicita nello snapshot, nessun numero negativo",()=>{
    const f=fixture();try{
      for(let i=0;i<3;i++)f.prepare(i);
      // Isolated fixture simulates a bad clock; historical timestamps are retained.
      const future=new Date(Date.now()+86400000).toISOString();
      f.db.prepare("UPDATE LoadMaterialAvailabilityState SET availableAt=? WHERE loadId=?").run(future,f.load.id);
      const s=f.createSession();for(const p of f.load.pannelli)f.loading.addUnit(s.id,{unitType:"PANEL",panelId:p.id,operatorId:f.op});
      const shipped=f.loading.ship(s.id,{});
      assert.equal(shipped.historyMetrics?.warehouseDays,null);
      assert.equal(f.details().shipment?.availableAt,future);
      assert.equal(f.details().shipment?.anomaly,"AVAILABILITY_CHRONOLOGY_INVALID");
    }finally{f.close();}
  });
  await t.test("giorni di calendario: 0,1,3, DST, mezzanotte locale e anomalie",()=>{
    assert.equal(calendarWarehouseDays("2026-10-08T00:00:00+02:00","2026-10-08T23:59:00+02:00"),0);
    assert.equal(calendarWarehouseDays("2026-10-07T23:59:00+02:00","2026-10-08T00:01:00+02:00"),1);
    assert.equal(calendarWarehouseDays("2026-10-05T23:59:00+02:00","2026-10-08T00:01:00+02:00"),3);
    assert.equal(calendarWarehouseDays("2026-03-28T23:59:00+01:00","2026-03-30T00:01:00+02:00"),2);
    assert.equal(calendarWarehouseDays("2026-10-24T23:59:00+02:00","2026-10-26T00:01:00+01:00"),2);
    assert.equal(calendarWarehouseDays("2026-10-07T22:01:00Z","2026-10-08T10:00:00Z"),0);
    assert.equal(calendarWarehouseDays(null,"2026-10-08T10:00:00Z"),null);
    assert.equal(calendarWarehouseDays("invalid","2026-10-08T10:00:00Z"),null);
    assert.equal(calendarWarehouseDays("2026-10-08T11:00:00Z","2026-10-08T10:00:00Z"),null);
  });
});
