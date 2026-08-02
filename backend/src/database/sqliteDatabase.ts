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
  `);
  migrateLegacyUniqueConstraints(database);
  seedSettings(database);
  return {
    database,
    close: () => database.close(),
  };
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
