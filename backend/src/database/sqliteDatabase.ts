import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface DatabaseConnection {
  database: DatabaseSync;
  close: () => void;
}

export const openSqliteDatabase = (databasePath: string): DatabaseConnection => {
  if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS Operators (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS Trailers (
      id TEXT PRIMARY KEY,
      plate TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      sortOrder INTEGER NOT NULL DEFAULT 0,
      nextInspectionDate TEXT NULL,
      disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
      disabledReason TEXT NULL,
      disabledAt TEXT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS Carriers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS OperationalSettings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS Loads (
      id TEXT PRIMARY KEY,
      commessa TEXT NOT NULL,
      cliente TEXT NOT NULL,
      numeroCliente TEXT NOT NULL DEFAULT '',
      riferimentoOrdine TEXT NOT NULL DEFAULT '',
      camion TEXT NOT NULL,
      stato TEXT NOT NULL DEFAULT 'DA_COMPLETARE',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_loads_active_order_truck ON Loads (commessa, camion) WHERE stato <> 'SPEDITO';
    CREATE TABLE IF NOT EXISTS Panels (
      id TEXT PRIMARY KEY,
      loadId TEXT NOT NULL REFERENCES Loads(id) ON DELETE CASCADE,
      numeroPannello TEXT NOT NULL,
      numeroCliente TEXT NOT NULL DEFAULT '',
      numeroMasterPanel TEXT NOT NULL DEFAULT '',
      camion TEXT NOT NULL,
      lato1 TEXT NOT NULL DEFAULT '',
      lato2 TEXT NOT NULL DEFAULT '',
      tipoPannello TEXT NOT NULL DEFAULT '',
      quantita REAL NOT NULL DEFAULT 0,
      spessore REAL NOT NULL DEFAULT 0,
      lunghezza REAL NOT NULL DEFAULT 0,
      altezza REAL NOT NULL DEFAULT 0,
      superficie REAL NOT NULL DEFAULT 0,
      volume REAL NOT NULL DEFAULT 0,
      peso REAL NOT NULL DEFAULT 0,
      stato TEXT NOT NULL DEFAULT 'MANCANTE',
      packageId TEXT NULL,
      manualLocation TEXT NULL,
      scannedAt TEXT NULL,
      scannedByOperatorId TEXT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE (loadId, numeroPannello)
    );
    CREATE TABLE IF NOT EXISTS Packages (
      id TEXT PRIMARY KEY,
      codicePacco TEXT NOT NULL UNIQUE,
      loadId TEXT NOT NULL REFERENCES Loads(id) ON DELETE CASCADE,
      commessa TEXT NOT NULL, cliente TEXT NOT NULL, camion TEXT NOT NULL,
      stato TEXT NOT NULL CHECK (stato IN ('APERTO','DISPONIBILE','CARICATO','SPEDITO')),
      numeroPannelli INTEGER NOT NULL DEFAULT 0,
      pesoTotale REAL NOT NULL DEFAULT 0, volumeTotale REAL NOT NULL DEFAULT 0,
      lunghezzaPacco REAL NULL, larghezzaPacco REAL NULL, altezzaPacco REAL NULL,
      manualLocation TEXT NULL,
      operatoreId TEXT NOT NULL, openedAt TEXT NOT NULL, closedAt TEXT NULL,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS OperationalEvents (
      id TEXT PRIMARY KEY, loadId TEXT NOT NULL REFERENCES Loads(id) ON DELETE CASCADE,
      panelId TEXT NULL REFERENCES Panels(id) ON DELETE SET NULL,
      packageId TEXT NULL REFERENCES Packages(id) ON DELETE SET NULL,
      type TEXT NOT NULL, operatorId TEXT NULL, timestamp TEXT NOT NULL, note TEXT NULL
    );
    CREATE TABLE IF NOT EXISTS LoadingSessions (
      id TEXT PRIMARY KEY, loadId TEXT NOT NULL REFERENCES Loads(id) ON DELETE CASCADE,
      stato TEXT NOT NULL CHECK(stato IN ('DA_CARICARE','IN_CARICO','ATTESA_SPEDIZIONE','SPEDITO')),
      operatorId TEXT NOT NULL, destinationType TEXT NOT NULL CHECK(destinationType IN ('RIMORCHIO_ESSEPI','TRASPORTATORE')),
      trailerId TEXT NULL, carrierId TEXT NULL, startedAt TEXT NOT NULL, completedAt TEXT NULL,
      reopenedAt TEXT NULL, shippedAt TEXT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
      CHECK((destinationType='RIMORCHIO_ESSEPI' AND trailerId IS NOT NULL) OR (destinationType='TRASPORTATORE' AND carrierId IS NOT NULL))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_loading_session_load ON LoadingSessions(loadId);
    CREATE TABLE IF NOT EXISTS LoadingUnits (
      id TEXT PRIMARY KEY, loadingSessionId TEXT NOT NULL REFERENCES LoadingSessions(id) ON DELETE CASCADE,
      unitType TEXT NOT NULL CHECK(unitType IN ('PANEL','PACKAGE')), panelId TEXT NULL REFERENCES Panels(id),
      packageId TEXT NULL REFERENCES Packages(id), loadedAt TEXT NOT NULL, loadedByOperatorId TEXT NOT NULL,
      removedAt TEXT NULL, removedByOperatorId TEXT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
      CHECK((unitType='PANEL' AND panelId IS NOT NULL AND packageId IS NULL) OR (unitType='PACKAGE' AND packageId IS NOT NULL AND panelId IS NULL))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_loading_active_panel ON LoadingUnits(loadingSessionId,panelId) WHERE active=1 AND panelId IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_loading_active_package ON LoadingUnits(loadingSessionId,packageId) WHERE active=1 AND packageId IS NOT NULL;
    CREATE TABLE IF NOT EXISTS TransportAssignments (
      id TEXT PRIMARY KEY, trailerId TEXT NOT NULL REFERENCES Trailers(id), loadId TEXT NULL REFERENCES Loads(id),
      loadingSessionId TEXT NULL REFERENCES LoadingSessions(id), source TEXT NOT NULL DEFAULT 'LOAD' CHECK(source IN('MANUAL','LOAD')),
      manualCommessa TEXT NULL, manualCliente TEXT NULL, manualCarico TEXT NULL, plannedDepartureDate TEXT NULL,
      stato TEXT NOT NULL CHECK(stato IN('IMPEGNATO','CARICATO','IN_VIAGGIO','CONCLUSO')),
      assignedAt TEXT NOT NULL, departedAt TEXT NULL, availableFrom TEXT NULL, releasedAt TEXT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transport_active_trailer ON TransportAssignments(trailerId) WHERE releasedAt IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transport_active_load ON TransportAssignments(loadId) WHERE releasedAt IS NULL;
    CREATE TABLE IF NOT EXISTS ShipmentPlans (
      id TEXT PRIMARY KEY, loadId TEXT NULL REFERENCES Loads(id), manualCommessa TEXT NULL, manualCliente TEXT NULL,
      manualCarico TEXT NULL, plannedLoadingDate TEXT NULL, plannedDepartureDate TEXT NULL,
      originalPlannedDepartureDate TEXT NULL, plannedDepartureDateChangedAt TEXT NULL, actualDepartureDate TEXT NULL,
      transportType TEXT NULL CHECK(transportType IS NULL OR transportType IN('BILICO_ESSEPI','TRASPORTATORE_ESTERNO')),
      trailerId TEXT NULL REFERENCES Trailers(id), carrierId TEXT NULL REFERENCES Carriers(id), notes TEXT NULL,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
      CHECK(NOT(trailerId IS NOT NULL AND carrierId IS NOT NULL))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_plan_load ON ShipmentPlans(loadId) WHERE loadId IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_plan_manual ON ShipmentPlans(UPPER(TRIM(manualCommessa)),UPPER(REPLACE(REPLACE(TRIM(COALESCE(manualCarico,'')),' ',''),'-',''))) WHERE loadId IS NULL;
    CREATE INDEX IF NOT EXISTS idx_events_load ON OperationalEvents(loadId,timestamp);
  `);
  migratePanelScanningColumns(database);
  migratePackageLocationColumn(database);
  const eventColumns=new Set((database.prepare("PRAGMA table_info(OperationalEvents)").all() as Array<{name:string}>).map(item=>item.name));
  if(!eventColumns.has("loadingSessionId"))database.exec("ALTER TABLE OperationalEvents ADD COLUMN loadingSessionId TEXT NULL");
  createOperationalDeleteTriggers(database);
  database.exec("CREATE INDEX IF NOT EXISTS idx_panels_package ON Panels(packageId)");
  migrateLegacyUniqueConstraints(database);
  migrateTransportColumns(database);
  migrateTransportAssignmentSchema(database);
  migratePlannedDepartureDate(database);
  migrateShipmentPlanDepartureTracking(database);
  migrateTransportAssignments(database);
  seedSettings(database);
  return {
    database,
    close: () => database.close(),
  };
};

const migrateTransportColumns=(database:DatabaseSync):void=>{const columns=new Set((database.prepare("PRAGMA table_info(Trailers)").all() as Array<{name:string}>).map(item=>item.name));if(!columns.has("nextInspectionDate"))database.exec("ALTER TABLE Trailers ADD COLUMN nextInspectionDate TEXT NULL");if(!columns.has("disabled"))database.exec("ALTER TABLE Trailers ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0");if(!columns.has("disabledReason"))database.exec("ALTER TABLE Trailers ADD COLUMN disabledReason TEXT NULL");if(!columns.has("disabledAt"))database.exec("ALTER TABLE Trailers ADD COLUMN disabledAt TEXT NULL");};

const migrateTransportAssignmentSchema=(database:DatabaseSync):void=>{const definition=database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='TransportAssignments'").get() as {sql:string}|undefined,columns=new Set((database.prepare("PRAGMA table_info(TransportAssignments)").all() as Array<{name:string}>).map(item=>item.name));if(columns.has("source")&&columns.has("manualCommessa")&&definition?.sql.includes("'CARICATO'"))return;database.exec("PRAGMA foreign_keys=OFF; DROP INDEX IF EXISTS idx_transport_active_trailer; DROP INDEX IF EXISTS idx_transport_active_load; ALTER TABLE TransportAssignments RENAME TO TransportAssignmentsLegacy; CREATE TABLE TransportAssignments(id TEXT PRIMARY KEY,trailerId TEXT NOT NULL REFERENCES Trailers(id),loadId TEXT NULL REFERENCES Loads(id),loadingSessionId TEXT NULL REFERENCES LoadingSessions(id),source TEXT NOT NULL DEFAULT 'LOAD' CHECK(source IN('MANUAL','LOAD')),manualCommessa TEXT NULL,manualCliente TEXT NULL,manualCarico TEXT NULL,plannedDepartureDate TEXT NULL,stato TEXT NOT NULL CHECK(stato IN('IMPEGNATO','CARICATO','IN_VIAGGIO','CONCLUSO')),assignedAt TEXT NOT NULL,departedAt TEXT NULL,availableFrom TEXT NULL,releasedAt TEXT NULL,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);");database.exec("INSERT INTO TransportAssignments(id,trailerId,loadId,loadingSessionId,source,manualCommessa,manualCliente,manualCarico,plannedDepartureDate,stato,assignedAt,departedAt,availableFrom,releasedAt,createdAt,updatedAt) SELECT a.id,a.trailerId,a.loadId,a.loadingSessionId,'LOAD',NULL,NULL,NULL,NULL,CASE WHEN a.stato='IMPEGNATO' AND EXISTS(SELECT 1 FROM LoadingSessions s WHERE s.id=a.loadingSessionId AND s.stato='ATTESA_SPEDIZIONE') THEN 'CARICATO' ELSE a.stato END,a.assignedAt,a.departedAt,a.availableFrom,a.releasedAt,a.createdAt,a.updatedAt FROM TransportAssignmentsLegacy a; DROP TABLE TransportAssignmentsLegacy; CREATE UNIQUE INDEX idx_transport_active_trailer ON TransportAssignments(trailerId) WHERE releasedAt IS NULL; CREATE UNIQUE INDEX idx_transport_active_load ON TransportAssignments(loadId) WHERE releasedAt IS NULL AND loadId IS NOT NULL; PRAGMA foreign_keys=ON;");};
const migratePlannedDepartureDate=(database:DatabaseSync):void=>{const columns=new Set((database.prepare("PRAGMA table_info(TransportAssignments)").all() as Array<{name:string}>).map(item=>item.name));if(!columns.has("plannedDepartureDate"))database.exec("ALTER TABLE TransportAssignments ADD COLUMN plannedDepartureDate TEXT NULL");};
const migrateShipmentPlanDepartureTracking=(database:DatabaseSync):void=>{const columns=new Set((database.prepare("PRAGMA table_info(ShipmentPlans)").all() as Array<{name:string}>).map(item=>item.name));if(!columns.has("originalPlannedDepartureDate"))database.exec("ALTER TABLE ShipmentPlans ADD COLUMN originalPlannedDepartureDate TEXT NULL");if(!columns.has("plannedDepartureDateChangedAt"))database.exec("ALTER TABLE ShipmentPlans ADD COLUMN plannedDepartureDateChangedAt TEXT NULL");database.exec("UPDATE ShipmentPlans SET originalPlannedDepartureDate=plannedDepartureDate WHERE originalPlannedDepartureDate IS NULL AND plannedDepartureDate IS NOT NULL");};

const addWeekdays=(iso:string,days:number):string=>{const date=new Date(iso);let added=0;while(added<days){date.setUTCDate(date.getUTCDate()+1);if(date.getUTCDay()!==0&&date.getUTCDay()!==6)added++;}return date.toISOString();};
const migrateTransportAssignments=(database:DatabaseSync):void=>{const rows=database.prepare("SELECT id,loadId,trailerId,stato,startedAt,shippedAt FROM LoadingSessions WHERE trailerId IS NOT NULL AND stato IN('DA_CARICARE','IN_CARICO','ATTESA_SPEDIZIONE','SPEDITO') ORDER BY startedAt DESC").all() as Array<{id:string;loadId:string;trailerId:string;stato:string;startedAt:string;shippedAt:string|null}>;const now=new Date().toISOString(),insert=database.prepare("INSERT INTO TransportAssignments(id,trailerId,loadId,loadingSessionId,stato,assignedAt,departedAt,availableFrom,releasedAt,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,NULL,?,?)");for(const row of rows){if(database.prepare("SELECT 1 FROM TransportAssignments WHERE (trailerId=? OR loadId=?) AND releasedAt IS NULL").get(row.trailerId,row.loadId))continue;const departed=row.stato==="SPEDITO"?row.shippedAt:null,available=departed?addWeekdays(departed,2):null;if(row.stato==="SPEDITO"&&(!available||available<=now))continue;insert.run(crypto.randomUUID(),row.trailerId,row.loadId,row.id,row.stato==="SPEDITO"?"IN_VIAGGIO":"IMPEGNATO",row.startedAt,departed,available,now,now);}};

const createOperationalDeleteTriggers=(database:DatabaseSync):void=>database.exec(`
  CREATE TRIGGER IF NOT EXISTS trg_panels_unload_before_delete BEFORE DELETE ON Panels BEGIN
    INSERT INTO OperationalEvents(id,loadId,loadingSessionId,panelId,type,operatorId,timestamp,note)
      SELECT lower(hex(randomblob(16))),OLD.loadId,loadingSessionId,OLD.id,'UNIT_UNLOADED',loadedByOperatorId,datetime('now'),'Elemento rimosso durante aggiornamento distinta' FROM LoadingUnits WHERE panelId=OLD.id;
    UPDATE LoadingSessions SET stato='IN_CARICO',completedAt=NULL,updatedAt=datetime('now') WHERE id IN(SELECT loadingSessionId FROM LoadingUnits WHERE panelId=OLD.id) AND stato<>'SPEDITO';
    UPDATE Loads SET stato='IN_CARICO',updatedAt=datetime('now') WHERE id=OLD.loadId AND EXISTS(SELECT 1 FROM LoadingUnits WHERE panelId=OLD.id);
    DELETE FROM LoadingUnits WHERE panelId=OLD.id;
  END;
  CREATE TRIGGER IF NOT EXISTS trg_panels_package_totals_after_delete AFTER DELETE ON Panels WHEN OLD.packageId IS NOT NULL BEGIN
    UPDATE Packages SET numeroPannelli=(SELECT COUNT(*) FROM Panels WHERE packageId=OLD.packageId),pesoTotale=COALESCE((SELECT SUM(peso) FROM Panels WHERE packageId=OLD.packageId),0),volumeTotale=COALESCE((SELECT SUM(volume) FROM Panels WHERE packageId=OLD.packageId),0),updatedAt=datetime('now') WHERE id=OLD.packageId;
  END;
`);

const migratePanelScanningColumns = (database: DatabaseSync): void => {
  const columns = new Set((database.prepare("PRAGMA table_info(Panels)").all() as Array<{name:string}>).map(item=>item.name));
  if(!columns.has("packageId")) database.exec("ALTER TABLE Panels ADD COLUMN packageId TEXT NULL");
  if(!columns.has("manualLocation")) database.exec("ALTER TABLE Panels ADD COLUMN manualLocation TEXT NULL");
  if(!columns.has("scannedAt")) database.exec("ALTER TABLE Panels ADD COLUMN scannedAt TEXT NULL");
  if(!columns.has("scannedByOperatorId")) database.exec("ALTER TABLE Panels ADD COLUMN scannedByOperatorId TEXT NULL");
  database.exec("UPDATE Panels SET stato='MANCANTE' WHERE stato='DA_COMPLETARE'");
};

const migratePackageLocationColumn = (database: DatabaseSync): void => {
  const columns = new Set((database.prepare("PRAGMA table_info(Packages)").all() as Array<{name:string}>).map(item=>item.name));
  if(!columns.has("manualLocation")) database.exec("ALTER TABLE Packages ADD COLUMN manualLocation TEXT NULL");
};

const migrateLegacyUniqueConstraints = (database: DatabaseSync): void => {
  const definitions = database.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name IN ('Operators','Trailers','Carriers')").all() as Array<{name:string;sql:string}>;
  if (!definitions.some(item => item.sql.includes("UNIQUE"))) return;
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`
      ALTER TABLE Operators RENAME TO Operators_legacy;
      ALTER TABLE Trailers RENAME TO Trailers_legacy;
      ALTER TABLE Carriers RENAME TO Carriers_legacy;
      CREATE TABLE Operators (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), sortOrder INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
      CREATE TABLE Trailers (id TEXT PRIMARY KEY, plate TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), sortOrder INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
      CREATE TABLE Carriers (id TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), sortOrder INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
      INSERT INTO Operators SELECT id,code,name,active,sortOrder,createdAt,updatedAt FROM Operators_legacy;
      INSERT INTO Trailers SELECT id,plate,description,active,sortOrder,createdAt,updatedAt FROM Trailers_legacy;
      INSERT INTO Carriers SELECT id,name,active,sortOrder,createdAt,updatedAt FROM Carriers_legacy;
      DROP TABLE Operators_legacy;
      DROP TABLE Trailers_legacy;
      DROP TABLE Carriers_legacy;
      COMMIT;
    `);
  } catch (error: unknown) {
    database.exec("ROLLBACK");
    throw error;
  }
};

const seedSettings = (database: DatabaseSync): void => {
  const now = new Date().toISOString();
  const count = (table: "Operators" | "Trailers" | "Carriers"): number => {
    const row = database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number };
    return Number(row.total);
  };
  const countOperationalSettings = (): number => {
    const row = database.prepare("SELECT COUNT(*) AS total FROM OperationalSettings").get() as { total: number };
    return Number(row.total);
  };
  const seedDemoCarriers =
    count("Operators") === 0 &&
    count("Trailers") === 0 &&
    count("Carriers") === 0 &&
    countOperationalSettings() === 0;

  if (count("Operators") === 0) {
    const insert = database.prepare("INSERT INTO Operators (id, code, name, active, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?, ?)");
    const operators: ReadonlyArray<readonly [string, string]> = [["AM", "Ariel Muca"], ["TT", "Tommaso Toccoli"], ["GT", "Giorgio Tamburini"]];
    operators.forEach(([code, name], index) => {
      insert.run(crypto.randomUUID(), code, name, index + 1, now, now);
    });
  }
  if (count("Trailers") === 0) {
    const insert = database.prepare("INSERT INTO Trailers (id, plate, description, active, sortOrder, createdAt, updatedAt) VALUES (?, ?, '', 1, ?, ?, ?)");
    ["Rimorchio 1", "Rimorchio 2"].forEach((plate, index) => insert.run(crypto.randomUUID(), plate, index + 1, now, now));
  }
  if (seedDemoCarriers) {
    const insert = database.prepare("INSERT INTO Carriers (id, name, active, sortOrder, createdAt, updatedAt) VALUES (?, ?, 1, ?, ?, ?)");
    ["Cristelli", "BRT", "Fercam", "Arcese"].forEach((name, index) => insert.run(crypto.randomUUID(), name, index + 1, now, now));
  }
  const insertOperationalSetting = database.prepare("INSERT OR IGNORE INTO OperationalSettings (key, value, description, active, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?, ?)");
  const operationalSettings: ReadonlyArray<readonly [string, string, string]> = [
    ["DTP", "Jlenia Pedrotti", "Direttore tecnico di produzione"],
    ["Aut-Min", "59/15-CL", "C. TRASF. Aut-Min."],
    ["Codice ETA", "ETA-12/0362", "Codice ETA"],
    ["CPR", "0809-CPR-1049", "CPR"],
  ];
  operationalSettings.forEach(([key, value, description], index) => insertOperationalSetting.run(key, value, description, index, now, now));
};
