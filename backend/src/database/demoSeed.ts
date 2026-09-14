import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { demoDatabase } from "../config/demoEnvironment.js";
import { openSqliteDatabase } from "./sqliteDatabase.js";

type DemoLoad = { id:string; commessa:string; cliente:string; camion:string; panels:number; scale:number; status:string; packagePanels:number[]; ready:number[]; loaded:number[]; shipped:boolean; plan:"BILICO_ESSEPI"|"TRASPORTATORE_ESTERNO"; day:number; trailerId?:string; carrierId?:string };

const now = new Date();
const iso = (date: Date) => date.toISOString();
const businessDay = (offset: number) => {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10));
  let passed = 0;
  while (passed < offset) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) passed++;
  }
  return iso(date);
};
const past = (days: number) => iso(new Date(now.getTime() - days * 86_400_000));

const operators = [
  ["demo-op-01", "LM", "Livia Montesi"],
  ["demo-op-02", "RS", "Renzo Sarti"],
  ["demo-op-03", "NP", "Nadia Perri"],
  ["demo-op-04", "DV", "Dario Valli"],
] as const;
const trailers = [
  ["demo-trailer-01", "DEMO-TR01", "Bilico Aurora — disponibile"],
  ["demo-trailer-02", "DEMO-TR02", "Bilico Boreale — assegnato"],
  ["demo-trailer-03", "DEMO-TR03", "Bilico Corallo — caricato"],
  ["demo-trailer-04", "DEMO-TR04", "Bilico Duna — in viaggio"],
] as const;
const carriers = [
  ["demo-carrier-01", "Trasporti Valmer"],
  ["demo-carrier-02", "Logistica Sereno"],
] as const;

const loads: DemoLoad[] = [
  { id:"demo-load-01", commessa:"SL-2601", cliente:"ArcoLinea Srl", camion:"ALFA-01", panels:4, scale:.8, status:"DA_CARICARE", packagePanels:[0,1], ready:[0,1,2,3], loaded:[], shipped:false, plan:"BILICO_ESSEPI", day:1 },
  { id:"demo-load-02", commessa:"SL-2602", cliente:"Novalume Industrie", camion:"BETA-02", panels:8, scale:1, status:"IN_CARICO", packagePanels:[0,1,2], ready:[0,1,2,3,4,5,6,7], loaded:[0,1,2,3], shipped:false, plan:"TRASPORTATORE_ESTERNO", day:1, carrierId:"demo-carrier-01" },
  { id:"demo-load-03", commessa:"SL-2603", cliente:"Quercia Progetti", camion:"GAMMA-03", panels:10, scale:1.12, status:"DA_COMPLETARE", packagePanels:[0,1,2], ready:[0,1,2,3], loaded:[], shipped:false, plan:"TRASPORTATORE_ESTERNO", day:2, carrierId:"demo-carrier-02" },
  { id:"demo-load-04", commessa:"SL-2604", cliente:"Linea Forma Srl", camion:"DELTA-04", panels:12, scale:1.22, status:"ATTESA_SPEDIZIONE", packagePanels:[0,1,2,3,4], ready:[0,1,2,3,4,5,6,7,8,9,10,11], loaded:[0,1,2,3,4,5,6,7,8,9,10,11], shipped:false, plan:"BILICO_ESSEPI", day:2, trailerId:"demo-trailer-03" },
  { id:"demo-load-05", commessa:"SL-2605", cliente:"Prisma Cantieri", camion:"EPSILON-05", panels:14, scale:1.32, status:"DA_CARICARE", packagePanels:[0,1,2,3], ready:[0,1,2,3,4,5,6,7,8,9,10,11,12,13], loaded:[], shipped:false, plan:"BILICO_ESSEPI", day:3, trailerId:"demo-trailer-02" },
  { id:"demo-load-06", commessa:"SL-2606", cliente:"Officina Terra", camion:"ZETA-06", panels:16, scale:1.4, status:"DA_CARICARE", packagePanels:[0,1,2,3,4], ready:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], loaded:[], shipped:false, plan:"TRASPORTATORE_ESTERNO", day:3, carrierId:"demo-carrier-02" },
  { id:"demo-load-07", commessa:"SL-2607", cliente:"NordVetro Sistemi", camion:"ETA-07", panels:18, scale:1.5, status:"SPEDITO", packagePanels:[0,1,2,3,4,5], ready:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17], loaded:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17], shipped:true, plan:"BILICO_ESSEPI", day:1, trailerId:"demo-trailer-04" },
  { id:"demo-load-08", commessa:"SL-2608", cliente:"Spazio Modulare", camion:"THETA-08", panels:6, scale:.92, status:"DA_COMPLETARE", packagePanels:[], ready:[0], loaded:[], shipped:false, plan:"BILICO_ESSEPI", day:4 },
  { id:"demo-load-09", commessa:"SL-2609", cliente:"Aurea Costruzioni", camion:"IOTA-09", panels:15, scale:1.36, status:"SPEDITO", packagePanels:[0,1,2,3,4], ready:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14], loaded:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14], shipped:true, plan:"TRASPORTATORE_ESTERNO", day:5, carrierId:"demo-carrier-02" },
];

export function seedDemoDatabase(): void {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) if (existsSync(`${demoDatabase}${suffix}`)) rmSync(`${demoDatabase}${suffix}`);
  const connection = openSqliteDatabase(demoDatabase);
  const db = connection.database;
  try {
    db.exec("DELETE FROM OperationalEvents; DELETE FROM LoadingUnits; DELETE FROM LoadingSessions; DELETE FROM TransportAssignments; DELETE FROM ShipmentPlans; DELETE FROM Packages; DELETE FROM Panels; DELETE FROM Loads; DELETE FROM Operators; DELETE FROM Trailers; DELETE FROM Carriers; DELETE FROM OperationalSettings;");
    const createdAt = past(4);
    const insertOperator = db.prepare("INSERT INTO Operators(id,code,name,active,sortOrder,createdAt,updatedAt) VALUES(?,?,?,1,?,?,?)");
    operators.forEach(([id, code, name], index) => insertOperator.run(id, code, name, index + 1, createdAt, createdAt));
    const insertTrailer = db.prepare("INSERT INTO Trailers(id,plate,description,active,sortOrder,createdAt,updatedAt) VALUES(?,?,?,1,?,?,?)");
    trailers.forEach(([id, plate, description], index) => insertTrailer.run(id, plate, description, index + 1, createdAt, createdAt));
    const insertCarrier = db.prepare("INSERT INTO Carriers(id,name,active,sortOrder,createdAt,updatedAt) VALUES(?,?,1,?,?,?)");
    carriers.forEach(([id, name], index) => insertCarrier.run(id, name, index + 1, createdAt, createdAt));

    const insertLoad = db.prepare("INSERT INTO Loads(id,commessa,cliente,numeroCliente,riferimentoOrdine,camion,stato,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?)");
    const insertPanel = db.prepare("INSERT INTO Panels(id,loadId,numeroPannello,numeroCliente,numeroMasterPanel,camion,lato1,lato2,tipoPannello,quantita,spessore,lunghezza,altezza,superficie,volume,peso,stato,packageId,manualLocation,scannedAt,scannedByOperatorId,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    const insertPackage = db.prepare("INSERT INTO Packages(id,codicePacco,loadId,commessa,cliente,camion,stato,workflowState,numeroPannelli,pesoTotale,volumeTotale,lunghezzaPacco,larghezzaPacco,altezzaPacco,manualLocation,operatoreId,openedAt,closedAt,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    const insertEvent = db.prepare("INSERT INTO OperationalEvents(id,loadId,panelId,packageId,loadingSessionId,type,operatorId,timestamp,note) VALUES(?,?,?,?,?,?,?,?,?)");
    const insertPlan = db.prepare("INSERT INTO ShipmentPlans(id,loadId,plannedLoadingDate,plannedDepartureDate,originalPlannedDepartureDate,plannedDepartureDateChangedAt,actualDepartureDate,transportType,trailerId,carrierId,plannedCarrierId,notes,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    const insertSession = db.prepare("INSERT INTO LoadingSessions(id,loadId,stato,operatorId,destinationType,trailerId,carrierId,startedAt,completedAt,reopenedAt,shippedAt,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)");
    const insertUnit = db.prepare("INSERT INTO LoadingUnits(id,loadingSessionId,unitType,panelId,packageId,loadedAt,loadedByOperatorId,active,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,1,?,?)");
    const insertAssignment = db.prepare("INSERT INTO TransportAssignments(id,trailerId,loadId,loadingSessionId,source,stato,assignedAt,departedAt,availableFrom,createdAt,updatedAt) VALUES(?,?,?,?, 'LOAD', ?,?,?,?,?,?)");

    for (const [index, load] of loads.entries()) {
      const base = 101 + index * 10;
      const operatorId = operators[index % operators.length]![0];
      insertLoad.run(load.id, load.commessa, load.cliente, `CLI-DEMO-${index + 1}`, `ORD-DEMO-${2600 + index}`, load.camion, load.status, createdAt, createdAt);
      const packageId = load.packagePanels.length ? `demo-pack-${String(index + 1).padStart(2, "0")}` : null;
      const panels = Array.from({ length: load.panels }, (_, panelIndex) => {
        const id = `${load.id}-panel-${panelIndex + 1}`;
        const packagePanel = load.packagePanels.includes(panelIndex);
        const shipped = load.shipped;
        const loaded = load.loaded.includes(panelIndex);
        const ready = load.ready.includes(panelIndex);
        const status = shipped ? "SPEDITO" : loaded ? "CARICATO" : ready ? "DISPONIBILE" : "MANCANTE";
        const scannedAt = ready || loaded || shipped ? past(2) : null;
        const location = status === "DISPONIBILE" && panelIndex === 5 ? "Zona DEMO A" : null;
        const length = Math.round((1800 + index * 135 + panelIndex * 145) * load.scale);
        const height = Math.round((950 + index * 58 + panelIndex * 52) * load.scale);
        const thickness = [80, 100, 120][(index + panelIndex) % 3]!;
        const volume = Number((thickness * length * height / 1_000_000_000).toFixed(3));
        const weight = Number((volume * (430 + index * 24)).toFixed(1));
        const scanningOperatorId = operators[panelIndex % operators.length]![0];
        insertPanel.run(id, load.id, String(base + panelIndex), `CLI-DEMO-${index + 1}`, String(1000 + panelIndex), load.camion, "Bianco Demo", "Rovere Demo", "Pannello coibentato", 1, thickness, length, height, Number((length * height / 1_000_000).toFixed(2)), volume, weight, status, packagePanel ? packageId : null, location, scannedAt, ready || loaded || shipped ? scanningOperatorId : null, createdAt, createdAt);
        if (scannedAt) insertEvent.run(`demo-event-scan-${index}-${panelIndex}`, load.id, id, null, null, "PANEL_SCANNED", scanningOperatorId, scannedAt, "Scansione DEMO");
        return { id, volume, weight, packagePanel };
      });
      if (packageId) {
        const grouped = panels.filter(panel => panel.packagePanel);
        const packageState = load.shipped ? "SPEDITO" : grouped.some(panel => load.loaded.includes(Number(panel.id.split("-").at(-1)) - 1)) ? "CARICATO" : "DISPONIBILE";
        insertPackage.run(packageId, `PK-SL-${String(2601 + index).padStart(4, "0")}`, load.id, load.commessa, load.cliente, load.camion, packageState, "ATTIVO", grouped.length, grouped.reduce((total, panel) => total + panel.weight, 0), grouped.reduce((total, panel) => total + panel.volume, 0), 2450 + index * 70, 1120 + index * 35, 760 + index * 20, packageState === "DISPONIBILE" ? "Area imballi" : null, operatorId, past(2), past(1), createdAt, createdAt);
        insertEvent.run(`demo-event-pack-${index}`, load.id, null, packageId, null, "PACKAGE_CLOSED", operatorId, past(1), "Pacco DEMO chiuso");
      }
      const sessionId = `demo-session-${String(index + 1).padStart(2, "0")}`;
      if (load.status === "IN_CARICO" || load.status === "ATTESA_SPEDIZIONE" || load.shipped) {
        const destination = load.trailerId ? "RIMORCHIO_ESSEPI" : "TRASPORTATORE";
        const sessionStatus = load.shipped ? "SPEDITO" : load.status;
        const shippedAt = load.shipped ? past(index + 2) : null;
        insertSession.run(sessionId, load.id, sessionStatus, operatorId, destination, load.trailerId ?? null, load.carrierId ?? null, past(2), load.status === "ATTESA_SPEDIZIONE" ? past(1) : null, null, shippedAt, createdAt, createdAt);
        const packageUnit = packageId && load.loaded.some(panelIndex => load.packagePanels.includes(panelIndex));
        if (packageUnit) insertUnit.run(`demo-unit-pack-${index}`, sessionId, "PACKAGE", null, packageId, past(1), operatorId, createdAt, createdAt);
        for (const panelIndex of load.loaded.filter(item => !load.packagePanels.includes(item))) insertUnit.run(`demo-unit-panel-${index}-${panelIndex}`, sessionId, "PANEL", panels[panelIndex]!.id, null, past(1), operatorId, createdAt, createdAt);
        insertEvent.run(`demo-event-load-start-${index}`, load.id, null, null, sessionId, "LOADING_STARTED", operatorId, past(2), "Sessione DEMO avviata");
        if (load.status === "ATTESA_SPEDIZIONE") insertEvent.run(`demo-event-complete-${index}`, load.id, null, null, sessionId, "LOADING_COMPLETED", operatorId, past(1), "Carico DEMO completato");
        if (load.shipped) insertEvent.run(`demo-event-depart-${index}`, load.id, null, null, sessionId, "PARTENZA_CONFERMATA", operatorId, shippedAt, "Partenza DEMO confermata");
      }
      const actualDeparture = load.shipped ? past(index + 2) : null;
      insertPlan.run(`demo-plan-${String(index + 1).padStart(2, "0")}`, load.id, businessDay(Math.max(1, load.day - 1)), businessDay(load.day), businessDay(load.day), index === 5 ? past(1) : null, actualDeparture, load.plan, load.trailerId ?? null, load.trailerId ? null : (load.shipped ? load.carrierId ?? null : null), load.carrierId ?? null, "Pianificazione dimostrativa — dati fittizi", createdAt, createdAt);
      if (load.trailerId) {
        const sessionIdForAssignment = load.status === "ATTESA_SPEDIZIONE" || load.shipped ? sessionId : null;
        const assignmentStatus = load.shipped ? "IN_VIAGGIO" : load.status === "ATTESA_SPEDIZIONE" ? "CARICATO" : "IMPEGNATO";
        insertAssignment.run(`demo-assignment-${String(index + 1).padStart(2, "0")}`, load.trailerId, load.id, sessionIdForAssignment, assignmentStatus, past(2), load.shipped ? past(1) : null, load.shipped ? businessDay(8) : null, createdAt, createdAt);
      }
    }
    db.exec("CREATE INDEX IF NOT EXISTS idx_demo_marker ON Loads(commessa)");
  } finally { connection.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  seedDemoDatabase();
