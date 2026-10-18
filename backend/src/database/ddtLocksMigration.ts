import type { DatabaseSync } from "node:sqlite";

/** Protect document sources across every writer, including imports and concurrent connections. */
export function migrateDdtLocks(db:DatabaseSync):void {
  const valid=(expression:string)=>`EXISTS(SELECT 1 FROM DdtDocuments d WHERE d.status='EMESSO' AND (${expression}))`;
  const load=(row:string)=>valid(`d.loadId=${row}.loadId`);
  const quote=(value:string)=>`"${value.replaceAll('"','""')}"`;
  db.exec("BEGIN IMMEDIATE");
  try{
    if(!db.prepare("PRAGMA table_info(DdtDocuments)").all().some(r=>r.name==="requestKey"))db.exec("ALTER TABLE DdtDocuments ADD COLUMN requestKey TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_ddt_request_key ON DdtDocuments(requestKey) WHERE requestKey IS NOT NULL; CREATE TRIGGER IF NOT EXISTS ddt_request_key_immutable BEFORE UPDATE OF requestKey ON DdtDocuments WHEN NEW.requestKey IS NOT OLD.requestKey BEGIN SELECT RAISE(ABORT,'DDT_IMMUTABLE'); END;");
    const protect=(table:string,scope:(row:string)=>string,allowed:string[]=[],extra="0",insert=true)=>{
      const columns=db.prepare(`PRAGMA table_info(${quote(table)})`).all().map(r=>String(r.name));
      const changed=columns.filter(c=>!allowed.includes(c)).map(c=>`NEW.${quote(c)} IS NOT OLD.${quote(c)}`).join(" OR ")||"0";
      const old=scope("OLD"),next=scope("NEW");
      db.exec(`DROP TRIGGER IF EXISTS ddt_lock_${table}_update; DROP TRIGGER IF EXISTS ddt_lock_${table}_delete; DROP TRIGGER IF EXISTS ddt_lock_${table}_insert;
        CREATE TRIGGER IF NOT EXISTS ddt_lock_${table}_update BEFORE UPDATE ON ${quote(table)} WHEN ((${old}) OR (${next})) AND ((${changed}) OR (${extra})) BEGIN SELECT RAISE(ABORT,'DDT_LOAD_LOCKED'); END;
        CREATE TRIGGER IF NOT EXISTS ddt_lock_${table}_delete BEFORE DELETE ON ${quote(table)} WHEN ${old} BEGIN SELECT RAISE(ABORT,'DDT_LOAD_LOCKED'); END;`);
      if(insert)db.exec(`CREATE TRIGGER IF NOT EXISTS ddt_lock_${table}_insert BEFORE INSERT ON ${quote(table)} WHEN ${next} BEGIN SELECT RAISE(ABORT,'DDT_LOAD_LOCKED'); END;`);
    };
    protect("Loads",r=>valid(`d.loadId=${r}.id`),["stato","updatedAt"],"NEW.stato IS NOT OLD.stato AND NOT (OLD.stato='ATTESA_SPEDIZIONE' AND NEW.stato='SPEDITO')");
    protect("LoadingSessions",r=>valid(`d.loadingSessionId=${r}.id OR d.loadId=${r}.loadId`),["stato","shippedAt","updatedAt"],"(NEW.stato IS NOT OLD.stato AND NOT (OLD.stato='ATTESA_SPEDIZIONE' AND NEW.stato='SPEDITO')) OR (NEW.shippedAt IS NOT OLD.shippedAt AND NOT (OLD.shippedAt IS NULL AND NEW.stato='SPEDITO' AND NEW.shippedAt IS NOT NULL))");
    protect("LoadingUnits",r=>valid(`d.loadingSessionId=${r}.loadingSessionId`));
    for(const table of ["Panels","Packages"])protect(table,load,["stato","updatedAt"],"NEW.stato IS NOT OLD.stato AND NOT (OLD.stato='CARICATO' AND NEW.stato='SPEDITO')");
    protect("ShipmentPlans",load,["plannedLoadingDate","plannedDepartureDate","originalPlannedDepartureDate","plannedDepartureDateChangedAt","actualDepartureDate","carrierId","updatedAt"],`(NEW.actualDepartureDate IS NOT OLD.actualDepartureDate AND NOT (OLD.actualDepartureDate IS NULL AND NEW.actualDepartureDate IS NOT NULL))
      OR (NEW.carrierId IS NOT OLD.carrierId AND NOT (NEW.actualDepartureDate IS NOT NULL AND EXISTS(SELECT 1 FROM LoadingSessions s WHERE s.loadId=OLD.loadId AND s.carrierId IS NEW.carrierId)))`);
    protect("TransportAssignments",load,["stato","departedAt","availableFrom","releasedAt","updatedAt"],`(NEW.stato IS NOT OLD.stato AND NOT ((OLD.stato='CARICATO' AND NEW.stato='IN_VIAGGIO') OR (OLD.stato='IN_VIAGGIO' AND NEW.stato='CONCLUSO')))
      OR (NEW.releasedAt IS NOT OLD.releasedAt AND OLD.stato<>'IN_VIAGGIO')`);
    // Registry identities used by a waiting document are protected too. After departure,
    // historical documents continue to use their archived snapshot, never the registry.
    protect("Customers",r=>valid(`EXISTS(SELECT 1 FROM LoadingSessions s WHERE s.id=d.loadingSessionId AND s.shippedAt IS NULL AND (json_extract(d.snapshotJson,'$.data.customer.id')=${r}.id OR EXISTS(SELECT 1 FROM ShipmentPlans p WHERE p.loadId=d.loadId AND p.customerId=${r}.id)))`),[],"0",false);
    protect("Carriers",r=>valid(`EXISTS(SELECT 1 FROM LoadingSessions s WHERE s.id=d.loadingSessionId AND s.carrierId=${r}.id AND s.shippedAt IS NULL)`),[],"0",false);
    protect("Trailers",r=>valid(`EXISTS(SELECT 1 FROM LoadingSessions s WHERE s.id=d.loadingSessionId AND s.trailerId=${r}.id AND s.shippedAt IS NULL)`),[],"0",false);
    db.exec("COMMIT");
  }catch(error){db.exec("ROLLBACK");throw error;}
}
