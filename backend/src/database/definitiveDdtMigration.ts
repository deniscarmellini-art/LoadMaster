import type { DatabaseSync } from "node:sqlite";

/** Additive, idempotent: no numbering, backfill or document creation. */
export function migrateDefinitiveDdt(db: DatabaseSync): void {
  db.exec("BEGIN IMMEDIATE");
  try { db.exec(`
    CREATE TABLE IF NOT EXISTS DdtSequences (
      year INTEGER PRIMARY KEY CHECK(year BETWEEN 2000 AND 9999),
      lastNumber INTEGER NOT NULL CHECK(lastNumber > 0)
    );
    CREATE TABLE IF NOT EXISTS DdtDocuments (
      id TEXT PRIMARY KEY,
      loadingSessionId TEXT NOT NULL REFERENCES LoadingSessions(id) ON DELETE RESTRICT,
      loadId TEXT NOT NULL REFERENCES Loads(id) ON DELETE RESTRICT,
      sequence INTEGER NOT NULL CHECK(sequence > 0),
      year INTEGER NOT NULL CHECK(year BETWEEN 2000 AND 9999),
      fullNumber TEXT NOT NULL UNIQUE,
      issuedAt TEXT NOT NULL,
      documentDate TEXT NOT NULL,
      issuedByOperatorId TEXT NOT NULL REFERENCES Operators(id),
      status TEXT NOT NULL CHECK(status IN ('EMESSO','ANNULLATO')),
      cancelledAt TEXT,
      cancelledByOperatorId TEXT REFERENCES Operators(id),
      cancellationReason TEXT,
      replacedByDdtId TEXT UNIQUE REFERENCES DdtDocuments(id),
      snapshotVersion INTEGER NOT NULL CHECK(snapshotVersion=1),
      snapshotJson TEXT NOT NULL CHECK(json_valid(snapshotJson) AND json_type(snapshotJson)='object'),
      pdfReference TEXT NOT NULL UNIQUE,
      pdfSha256 TEXT NOT NULL CHECK(length(pdfSha256)=64 AND pdfSha256 NOT GLOB '*[^0-9a-f]*'),
      pdfBytes BLOB NOT NULL CHECK(typeof(pdfBytes)='blob' AND length(pdfBytes)>0),
      UNIQUE(year,sequence),
      CHECK(fullNumber='X-Lam/' || printf('%04d',sequence) || '/' || year),
      CHECK(pdfReference='sqlite:ddt/' || id),
      CHECK(replacedByDdtId IS NULL OR (status='ANNULLATO' AND replacedByDdtId<>id)),
      CHECK((status='EMESSO' AND cancelledAt IS NULL AND cancelledByOperatorId IS NULL AND cancellationReason IS NULL)
        OR (status='ANNULLATO' AND cancelledAt IS NOT NULL AND cancelledByOperatorId IS NOT NULL AND cancellationReason IS NOT NULL AND length(trim(cancellationReason))>0))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ddt_one_valid_session ON DdtDocuments(loadingSessionId) WHERE status='EMESSO';
    CREATE TRIGGER IF NOT EXISTS ddt_no_delete BEFORE DELETE ON DdtDocuments BEGIN SELECT RAISE(ABORT,'DDT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS ddt_sequence_no_delete BEFORE DELETE ON DdtSequences BEGIN SELECT RAISE(ABORT,'DDT_SEQUENCE_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS ddt_sequence_increasing BEFORE UPDATE ON DdtSequences
      WHEN NEW.year<>OLD.year OR NEW.lastNumber<>OLD.lastNumber+1 BEGIN SELECT RAISE(ABORT,'DDT_SEQUENCE_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS ddt_insert_guard BEFORE INSERT ON DdtDocuments BEGIN
      SELECT CASE WHEN NEW.status<>'EMESSO' OR NEW.replacedByDdtId IS NOT NULL
        OR NOT EXISTS(SELECT 1 FROM LoadingSessions WHERE id=NEW.loadingSessionId AND loadId=NEW.loadId)
        OR NOT EXISTS(SELECT 1 FROM DdtSequences WHERE year=NEW.year AND lastNumber=NEW.sequence)
        OR NEW.sequence<>COALESCE((SELECT MAX(sequence)+1 FROM DdtDocuments WHERE year=NEW.year),1)
        THEN RAISE(ABORT,'DDT_INVALID_INSERT') END;
    END;
    CREATE TRIGGER IF NOT EXISTS ddt_immutable BEFORE UPDATE ON DdtDocuments BEGIN
      SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.loadingSessionId IS NOT OLD.loadingSessionId OR NEW.loadId IS NOT OLD.loadId
        OR NEW.sequence IS NOT OLD.sequence OR NEW.year IS NOT OLD.year OR NEW.fullNumber IS NOT OLD.fullNumber
        OR NEW.issuedAt IS NOT OLD.issuedAt OR NEW.documentDate IS NOT OLD.documentDate OR NEW.issuedByOperatorId IS NOT OLD.issuedByOperatorId
        OR NEW.snapshotVersion IS NOT OLD.snapshotVersion OR NEW.snapshotJson IS NOT OLD.snapshotJson
        OR NEW.pdfReference IS NOT OLD.pdfReference OR NEW.pdfSha256 IS NOT OLD.pdfSha256 OR NEW.pdfBytes IS NOT OLD.pdfBytes
        OR (OLD.status='ANNULLATO' AND (NEW.status IS NOT OLD.status OR NEW.cancelledAt IS NOT OLD.cancelledAt
          OR NEW.cancelledByOperatorId IS NOT OLD.cancelledByOperatorId OR NEW.cancellationReason IS NOT OLD.cancellationReason))
        OR (OLD.replacedByDdtId IS NOT NULL AND NEW.replacedByDdtId IS NOT OLD.replacedByDdtId)
        THEN RAISE(ABORT,'DDT_IMMUTABLE') END;
      SELECT CASE WHEN OLD.status='EMESSO' AND NEW.status='ANNULLATO' AND (
        EXISTS(SELECT 1 FROM LoadingSessions WHERE id=OLD.loadingSessionId AND (shippedAt IS NOT NULL OR stato='SPEDITO'))
        OR EXISTS(SELECT 1 FROM Loads WHERE id=OLD.loadId AND stato='SPEDITO')
        OR EXISTS(SELECT 1 FROM ShipmentPlans WHERE loadId=OLD.loadId AND actualDepartureDate IS NOT NULL))
        THEN RAISE(ABORT,'DDT_ALREADY_DEPARTED') END;
      SELECT CASE WHEN NEW.replacedByDdtId IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM DdtDocuments d WHERE d.id=NEW.replacedByDdtId AND d.loadingSessionId=OLD.loadingSessionId
          AND d.status='EMESSO' AND (d.year>OLD.year OR (d.year=OLD.year AND d.sequence>OLD.sequence)))
        THEN RAISE(ABORT,'DDT_INVALID_REPLACEMENT') END;
    END;
    `);
    db.exec("COMMIT");
  } catch(error) { db.exec("ROLLBACK");throw error; }
}
