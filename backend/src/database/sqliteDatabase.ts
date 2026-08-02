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
    CREATE INDEX IF NOT EXISTS idx_events_load ON OperationalEvents(loadId,timestamp);
  `);
  migratePanelScanningColumns(database);
  const eventColumns=new Set((database.prepare("PRAGMA table_info(OperationalEvents)").all() as Array<{name:string}>).map(item=>item.name));
  if(!eventColumns.has("loadingSessionId"))database.exec("ALTER TABLE OperationalEvents ADD COLUMN loadingSessionId TEXT NULL");
  database.exec("CREATE INDEX IF NOT EXISTS idx_panels_package ON Panels(packageId)");
  migrateLegacyUniqueConstraints(database);
  seedSettings(database);
  return {
    database,
    close: () => database.close(),
  };
};

const migratePanelScanningColumns = (database: DatabaseSync): void => {
  const columns = new Set((database.prepare("PRAGMA table_info(Panels)").all() as Array<{name:string}>).map(item=>item.name));
  if(!columns.has("packageId")) database.exec("ALTER TABLE Panels ADD COLUMN packageId TEXT NULL");
  if(!columns.has("scannedAt")) database.exec("ALTER TABLE Panels ADD COLUMN scannedAt TEXT NULL");
  if(!columns.has("scannedByOperatorId")) database.exec("ALTER TABLE Panels ADD COLUMN scannedByOperatorId TEXT NULL");
  database.exec("UPDATE Panels SET stato='MANCANTE' WHERE stato='DA_COMPLETARE'");
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
  if (count("Carriers") === 0) {
    const insert = database.prepare("INSERT INTO Carriers (id, name, active, sortOrder, createdAt, updatedAt) VALUES (?, ?, 1, ?, ?, ?)");
    ["Cristelli", "BRT", "Fercam", "Arcese"].forEach((name, index) => insert.run(crypto.randomUUID(), name, index + 1, now, now));
  }
};
