import type { DatabaseSync } from "node:sqlite";

/** Additive only: no historical readiness is inferred or backfilled. */
export function migrateMaterialAvailability(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS LoadMaterialAvailabilityEvents (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      loadId TEXT NOT NULL REFERENCES Loads(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('BASELINE','MANIFEST_CHANGED','COMPLETE','INVALIDATED')),
      manifestVersion INTEGER NOT NULL,
      manifestHash TEXT NOT NULL,
      manifestJson TEXT NOT NULL,
      expectedCount INTEGER NOT NULL,
      availableCount INTEGER NOT NULL,
      occurredAt TEXT NOT NULL,
      reason TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_material_availability_load ON LoadMaterialAvailabilityEvents(loadId,sequence);
    CREATE TABLE IF NOT EXISTS LoadMaterialAvailabilityState (
      loadId TEXT PRIMARY KEY REFERENCES Loads(id) ON DELETE CASCADE,
      manifestVersion INTEGER NOT NULL,
      manifestHash TEXT NOT NULL,
      manifestJson TEXT NOT NULL,
      isComplete INTEGER NOT NULL CHECK(isComplete IN(0,1)),
      availableAt TEXT NULL,
      availabilityEventId TEXT NULL REFERENCES LoadMaterialAvailabilityEvents(id),
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS LoadMaterialAvailabilityShipments (
      loadId TEXT PRIMARY KEY REFERENCES Loads(id) ON DELETE CASCADE,
      manifestVersion INTEGER NOT NULL,
      manifestHash TEXT NOT NULL,
      manifestJson TEXT NOT NULL,
      availabilityEventId TEXT NULL REFERENCES LoadMaterialAvailabilityEvents(id),
      availableAt TEXT NULL,
      shippedAt TEXT NOT NULL,
      calendarTimeZone TEXT NOT NULL,
      warehouseDays INTEGER NULL CHECK(warehouseDays IS NULL OR warehouseDays>=0),
      anomaly TEXT NULL
    );
    CREATE TRIGGER IF NOT EXISTS material_availability_events_no_update
      BEFORE UPDATE ON LoadMaterialAvailabilityEvents BEGIN SELECT RAISE(ABORT,'MATERIAL_AVAILABILITY_EVENT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS material_availability_shipments_no_update
      BEFORE UPDATE ON LoadMaterialAvailabilityShipments BEGIN SELECT RAISE(ABORT,'MATERIAL_AVAILABILITY_SNAPSHOT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS material_availability_shipments_no_delete
      BEFORE DELETE ON LoadMaterialAvailabilityShipments BEGIN SELECT RAISE(ABORT,'MATERIAL_AVAILABILITY_SNAPSHOT_IMMUTABLE'); END;
  `);
}
