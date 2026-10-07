import type { DatabaseSync } from "node:sqlite";

export type TransportStatus =
  "DISPONIBILE" | "IMPEGNATO" | "CARICATO" | "IN_VIAGGIO" | "FUORI_SERVIZIO";
export type AssignmentSource = "MANUAL" | "LOAD";
export interface ManualReservationInput {
  loadId?: string;
  commessa: string;
  cliente: string;
  carico: string;
  plannedDepartureDate?: string | null;
}
export interface TransportRecord {
  id: string;
  plate: string;
  description: string;
  active: boolean;
  status: TransportStatus;
  source: AssignmentSource | null;
  assignmentId: string | null;
  loadId: string | null;
  commessa: string | null;
  cliente: string | null;
  camion: string | null;
  plannedDepartureDate: string | null;
  departedAt: string | null;
  availableFrom: string | null;
  nextInspectionDate: string | null;
  disabledReason: string | null;
  loadingSessionId: string | null;
  canRelease: boolean;
}

const nullable = (value: unknown) => (typeof value === "string" ? value : null);
const normalize = (value: string) =>
  value
    .trim()
    .toLocaleUpperCase("it-IT")
    .replace(/[\s-]+/g, "");

export class TransportRepository {
  constructor(private readonly db: DatabaseSync) {}
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  refreshExpired(now = new Date().toISOString()): void {
    this.db
      .prepare(
        "UPDATE TransportAssignments SET stato='CONCLUSO',releasedAt=?,updatedAt=? WHERE releasedAt IS NULL AND stato='IN_VIAGGIO' AND availableFrom IS NOT NULL AND availableFrom<=?",
      )
      .run(now, now, now);
  }
  list(): TransportRecord[] {
    this.refreshExpired();
    return this.db
      .prepare(
        `SELECT t.*,a.id assignmentId,a.source,COALESCE(a.loadId,manualLoad.id) loadId,a.stato assignmentStatus,
          (SELECT p.plannedDepartureDate FROM ShipmentPlans p WHERE
            (a.loadId IS NOT NULL AND (p.loadId=a.loadId OR
              (p.loadId IS NULL
                AND UPPER(TRIM(p.manualCommessa))=UPPER(TRIM(l.commessa))
                AND UPPER(REPLACE(REPLACE(TRIM(COALESCE(p.manualCarico,'')),' ',''),'-',''))=
                    UPPER(REPLACE(REPLACE(TRIM(COALESCE(l.camion,'')),' ',''),'-',''))))) OR
            (a.loadId IS NULL AND p.loadId IS NULL
              AND UPPER(TRIM(p.manualCommessa))=UPPER(TRIM(a.manualCommessa))
              AND UPPER(REPLACE(REPLACE(TRIM(COALESCE(p.manualCarico,'')),' ',''),'-',''))=
                  UPPER(REPLACE(REPLACE(TRIM(COALESCE(a.manualCarico,'')),' ',''),'-','')))
            ORDER BY p.updatedAt DESC LIMIT 1) plannedDepartureDate,
          a.departedAt,a.availableFrom,a.loadingSessionId,
          COALESCE(l.commessa,a.manualCommessa) commessa,
          COALESCE(l.cliente,a.manualCliente) cliente,
          COALESCE(l.camion,a.manualCarico) camion
        FROM Trailers t
        LEFT JOIN TransportAssignments a ON a.trailerId=t.id AND a.releasedAt IS NULL
        LEFT JOIN Loads l ON l.id=a.loadId
        LEFT JOIN Loads manualLoad ON a.loadId IS NULL AND a.source='MANUAL'
          AND UPPER(TRIM(manualLoad.commessa))=UPPER(TRIM(a.manualCommessa))
          AND UPPER(REPLACE(REPLACE(TRIM(manualLoad.camion),' ',''),'-',''))=
              UPPER(REPLACE(REPLACE(TRIM(a.manualCarico),' ',''),'-',''))
        WHERE t.archived=0
        ORDER BY t.sortOrder,t.plate`,
      )
      .all()
      .map(this.map);
  }
  find(id: string): TransportRecord | null {
    return this.list().find((item) => item.id === id) ?? null;
  }
  setInspection(id: string, date: string | null): TransportRecord | null {
    const result = this.db
      .prepare(
        "UPDATE Trailers SET nextInspectionDate=?,updatedAt=? WHERE id=?",
      )
      .run(date, new Date().toISOString(), id);
    return result.changes ? this.find(id) : null;
  }
  disable(id: string, reason: string, notes: string): TransportRecord | null {
    const current = this.find(id);
    if (!current) return null;
    if (current.assignmentId) throw new Error("TRAILER_IN_USE");
    const now = new Date().toISOString(),
      label = notes.trim() ? `${reason}: ${notes.trim()}` : reason;
    this.db
      .prepare(
        "UPDATE Trailers SET disabled=1,disabledReason=?,disabledAt=?,updatedAt=? WHERE id=?",
      )
      .run(label, now, now, id);
    return this.find(id);
  }
  enable(id: string): TransportRecord | null {
    const current = this.find(id);
    if (!current) return null;
    if (current.assignmentId) throw new Error("TRAILER_IN_USE");
    this.db
      .prepare(
        "UPDATE Trailers SET disabled=0,disabledReason=NULL,disabledAt=NULL,active=1,updatedAt=? WHERE id=?",
      )
      .run(new Date().toISOString(), id);
    return this.find(id);
  }
  reserve(
    trailerId: string,
    input: ManualReservationInput,
  ): TransportRecord | null {
    return this.transaction(() => {
      const current = this.find(trailerId);
      if (!current) return null;
      if (!current.active || current.status !== "DISPONIBILE")
        throw new Error("TRAILER_NOT_AVAILABLE");
      const load = input.loadId ? this.db.prepare("SELECT * FROM Loads WHERE id=?").get(input.loadId) : undefined;
      if (input.loadId && (!load || normalize(String(load.commessa)) !== normalize(input.commessa) || normalize(String(load.camion)) !== normalize(input.carico)))
        throw new Error("INVALID_RESERVATION_LOAD");
      const session = load ? this.db.prepare("SELECT * FROM LoadingSessions WHERE loadId=?").get(input.loadId!) : undefined;
      if (load && (load.stato === "SPEDITO" || (session?.transportMode && session.transportMode !== "BILICO_ESSEPI")))
        throw new Error("INVALID_RESERVATION_LOAD");
      // Include manual reservations for this order/truck: their Load link may not
      // have been adopted by a loading session yet.
      if (this.list().some(item => item.assignmentId && ((input.loadId !== undefined && item.loadId === input.loadId) ||
          normalize(item.commessa ?? "") === normalize(input.commessa) && normalize(item.camion ?? "") === normalize(input.carico))))
        throw new Error("LOAD_ALREADY_ASSIGNED");
      const now = new Date().toISOString();
      if (load) {
        this.db.prepare("INSERT INTO TransportAssignments(id,trailerId,loadId,loadingSessionId,source,stato,assignedAt,createdAt,updatedAt) VALUES(?,?,?,?,'LOAD','IMPEGNATO',?,?,?)")
          .run(crypto.randomUUID(),trailerId,input.loadId!,session?.id ?? null,now,now,now);
        if (session) this.db.prepare("UPDATE LoadingSessions SET trailerId=?,updatedAt=? WHERE id=?").run(trailerId,now,String(session.id));
        return this.find(trailerId);
      }
      this.db
        .prepare(
          "INSERT INTO TransportAssignments(id,trailerId,loadId,loadingSessionId,source,manualCommessa,manualCliente,manualCarico,plannedDepartureDate,stato,assignedAt,createdAt,updatedAt)VALUES(?,?,NULL,NULL,'MANUAL',?,?,?,NULL,'IMPEGNATO',?,?,?)",
        )
        .run(
          crypto.randomUUID(),
          trailerId,
          input.commessa.trim(),
          input.cliente.trim(),
          input.carico.trim(),
          now,
          now,
          now,
        );
      return this.find(trailerId);
    });
  }
  updateReservation(
    trailerId: string,
    input: ManualReservationInput,
  ): TransportRecord | null {
    const current = this.find(trailerId);
    if (!current) return null;
    if (current.source !== "MANUAL" || !current.assignmentId)
      throw new Error("RESERVATION_NOT_EDITABLE");
    const now = new Date().toISOString();
    this.db
      .prepare(
        "UPDATE TransportAssignments SET manualCommessa=?,manualCliente=?,manualCarico=?,updatedAt=? WHERE id=? AND releasedAt IS NULL AND source='MANUAL'",
      )
      .run(
        input.commessa.trim(),
        input.cliente.trim(),
        input.carico.trim(),
        now,
        current.assignmentId,
      );
    return this.find(trailerId);
  }
  setPlannedDeparture(
    trailerId: string,
    date: string | null,
  ): TransportRecord | null {
    const current = this.find(trailerId);
    if (!current) return null;
    if (
      !current.assignmentId ||
      !(["IMPEGNATO", "CARICATO"] as TransportStatus[]).includes(current.status)
    )
      throw new Error("PLANNED_DEPARTURE_NOT_EDITABLE");
    const now = new Date().toISOString();
    this.db
      .prepare(
        "UPDATE TransportAssignments SET plannedDepartureDate=?,updatedAt=? WHERE id=? AND releasedAt IS NULL AND stato IN('IMPEGNATO','CARICATO')",
      )
      .run(date?.trim() || null, now, current.assignmentId);
    return this.find(trailerId);
  }
  releaseReservation(trailerId: string, expectedAssignmentId?: string): TransportRecord | null {
    return this.transaction(() => {
      if (!this.db.prepare("SELECT 1 FROM Trailers WHERE id=?").get(trailerId)) return null;
      const assignment = this.db.prepare("SELECT id FROM TransportAssignments WHERE trailerId=? AND releasedAt IS NULL").get(trailerId);
      const id = assignment ? String(assignment.id) : null;
      if (!id || (expectedAssignmentId !== undefined && id !== expectedAssignmentId) || !this.canRelease(id))
        throw new Error("RESERVATION_NOT_RELEASABLE");
      const now = new Date().toISOString();
      // Clear only the live trailer link on empty sessions. Keep the assignment's
      // session reference for history and prevent startup from recreating the link.
      this.db.prepare("UPDATE LoadingSessions SET trailerId=NULL,updatedAt=? WHERE trailerId=? AND shippedAt IS NULL").run(now, trailerId);
      this.db.prepare("UPDATE TransportAssignments SET stato='CONCLUSO',releasedAt=?,updatedAt=? WHERE id=? AND releasedAt IS NULL").run(now, now, id);
      return this.find(trailerId);
    });
  }
  private canRelease(assignmentId: string): boolean {
    const a = this.db.prepare("SELECT * FROM TransportAssignments WHERE id=?").get(assignmentId);
    if (!a || a.releasedAt !== null || a.stato !== "IMPEGNATO" || a.departedAt !== null || a.availableFrom !== null) return false;
    const matches = (commessa: unknown, camion: unknown) =>
      normalize(String(commessa ?? "")) === normalize(String(a.manualCommessa ?? "")) &&
      normalize(String(camion ?? "")) === normalize(String(a.manualCarico ?? ""));
    const loads = this.db.prepare("SELECT id,commessa,camion,stato FROM Loads").all().filter(l =>
      l.id === a.loadId || (a.loadId === null && matches(l.commessa, l.camion)));
    const loadIds = new Set(loads.map(l => String(l.id)));
    const sessions = this.db.prepare("SELECT * FROM LoadingSessions").all().filter(s =>
      s.id === a.loadingSessionId || loadIds.has(String(s.loadId)) || (s.trailerId === a.trailerId && s.shippedAt === null));
    for (const s of sessions) {
      loadIds.add(String(s.loadId));
      // startedAt records session creation, not the first physical loading.
      if (s.stato !== "DA_CARICARE" || s.completedAt !== null || s.reopenedAt !== null || s.shippedAt !== null ||
          this.db.prepare("SELECT 1 FROM LoadingUnits WHERE loadingSessionId=? LIMIT 1").get(String(s.id)) ||
          this.db.prepare("SELECT 1 FROM OperationalEvents WHERE loadingSessionId=? AND type IN ('UNIT_LOADED','LOADING_COMPLETED','LOADING_REOPENED','PARTENZA_CONFERMATA') LIMIT 1").get(String(s.id))) return false;
    }
    for (const id of loadIds) {
      if (this.db.prepare("SELECT 1 FROM Loads WHERE id=? AND stato IN ('IN_CARICO','ATTESA_SPEDIZIONE','SPEDITO')").get(id) ||
          this.db.prepare("SELECT 1 FROM Panels WHERE loadId=? AND stato IN ('CARICATO','SPEDITO') LIMIT 1").get(id) ||
          this.db.prepare("SELECT 1 FROM Packages WHERE loadId=? AND stato IN ('CARICATO','SPEDITO') LIMIT 1").get(id)) return false;
    }
    const departed = this.db.prepare("SELECT * FROM ShipmentPlans WHERE actualDepartureDate IS NOT NULL").all().some(p =>
      loadIds.has(String(p.loadId)) || (p.loadId === null && (matches(p.manualCommessa, p.manualCarico) ||
        loads.some(l => normalize(String(l.commessa)) === normalize(String(p.manualCommessa ?? "")) && normalize(String(l.camion)) === normalize(String(p.manualCarico ?? ""))))));
    return !departed;
  }
  assign(trailerId: string, loadId: string, sessionId: string): void {
    const now = new Date().toISOString(),
      load = this.db
        .prepare("SELECT commessa,camion FROM Loads WHERE id=?")
        .get(loadId) as { commessa: string; camion: string } | undefined;
    if (!load) throw new Error("LOAD_NOT_FOUND");
    const trailer = this.db.prepare("SELECT active,archived FROM Trailers WHERE id=?").get(trailerId) as {active:number;archived:number}|undefined;
    if (!trailer || !trailer.active || trailer.archived) throw new Error("TRAILER_NOT_AVAILABLE");
    const trailerAssignment = this.db
      .prepare(
        "SELECT id,source,loadId,manualCommessa,manualCarico FROM TransportAssignments WHERE trailerId=? AND releasedAt IS NULL",
      )
      .get(trailerId) as
      | {
          id: string;
          source: AssignmentSource;
          loadId: string | null;
          manualCommessa: string | null;
          manualCarico: string | null;
        }
      | undefined;
    if (
      trailerAssignment?.source === "LOAD" &&
      trailerAssignment.loadId === loadId
    ) {
      this.db
        .prepare(
          "UPDATE TransportAssignments SET loadingSessionId=?,updatedAt=? WHERE id=?",
        )
        .run(sessionId, now, trailerAssignment.id);
      return;
    }
    if (trailerAssignment?.source === "MANUAL") {
      if (
        normalize(trailerAssignment.manualCommessa ?? "") !==
          normalize(load.commessa) ||
        normalize(trailerAssignment.manualCarico ?? "") !==
          normalize(load.camion)
      )
        throw new Error("TRAILER_NOT_AVAILABLE");
      const prior = this.db
        .prepare(
          "SELECT id FROM TransportAssignments WHERE loadId=? AND releasedAt IS NULL AND id<>?",
        )
        .get(loadId, trailerAssignment.id) as { id: string } | undefined;
      if (prior)
        this.db
          .prepare(
            "UPDATE TransportAssignments SET stato='CONCLUSO',releasedAt=?,updatedAt=? WHERE id=?",
          )
          .run(now, now, prior.id);
      this.db
        .prepare(
          "UPDATE TransportAssignments SET source='LOAD',loadId=?,loadingSessionId=?,manualCommessa=NULL,manualCliente=NULL,manualCarico=NULL,stato='IMPEGNATO',updatedAt=? WHERE id=?",
        )
        .run(loadId, sessionId, now, trailerAssignment.id);
      return;
    }
    if (trailerAssignment) throw new Error("TRAILER_NOT_AVAILABLE");
    const existing = this.db
      .prepare(
        "SELECT id,trailerId FROM TransportAssignments WHERE loadId=? AND releasedAt IS NULL",
      )
      .get(loadId) as { id: string; trailerId: string } | undefined;
    if (existing) this.releaseByLoad(loadId, now);
    this.db
      .prepare(
        "INSERT INTO TransportAssignments(id,trailerId,loadId,loadingSessionId,source,stato,assignedAt,createdAt,updatedAt)VALUES(?,?,?,?,'LOAD','IMPEGNATO',?,?,?)",
      )
      .run(crypto.randomUUID(), trailerId, loadId, sessionId, now, now, now);
  }
  markLoadedBySession(sessionId: string, at = new Date().toISOString()): void {
    this.db
      .prepare(
        "UPDATE TransportAssignments SET stato='CARICATO',updatedAt=? WHERE loadingSessionId=? AND source='LOAD' AND releasedAt IS NULL",
      )
      .run(at, sessionId);
  }
  markLoadingBySession(sessionId: string, at = new Date().toISOString()): void {
    this.db
      .prepare(
        "UPDATE TransportAssignments SET stato='IMPEGNATO',updatedAt=? WHERE loadingSessionId=? AND source='LOAD' AND releasedAt IS NULL",
      )
      .run(at, sessionId);
  }
  departBySession(sessionId: string, departedAt: string): void {
    const availableFrom = addBusinessDays(departedAt, 2);
    this.db
      .prepare(
        "UPDATE TransportAssignments SET stato='IN_VIAGGIO',departedAt=?,availableFrom=?,updatedAt=? WHERE loadingSessionId=? AND source='LOAD' AND releasedAt IS NULL",
      )
      .run(departedAt, availableFrom, departedAt, sessionId);
  }
  releaseByLoad(loadId: string, at = new Date().toISOString()): void {
    this.db
      .prepare(
        "UPDATE TransportAssignments SET stato='CONCLUSO',releasedAt=?,updatedAt=? WHERE loadId=? AND source='LOAD' AND releasedAt IS NULL",
      )
      .run(at, at, loadId);
  }
  isAvailable(id: string, loadId?: string): boolean {
    const item = this.find(id);
    if (!item || !item.active || item.status === "FUORI_SERVIZIO") return false;
    if (item.status === "DISPONIBILE") return true;
    if (!loadId || !item.assignmentId) return false;
    if (item.source === "LOAD")
      return Boolean(
        this.db
          .prepare(
            "SELECT 1 FROM TransportAssignments WHERE id=? AND loadId=? AND releasedAt IS NULL",
          )
          .get(item.assignmentId, loadId),
      );
    const load = this.db
      .prepare("SELECT commessa,camion FROM Loads WHERE id=?")
      .get(loadId) as { commessa: string; camion: string } | undefined;
    return Boolean(
      load &&
      normalize(item.commessa ?? "") === normalize(load.commessa) &&
      normalize(item.camion ?? "") === normalize(load.camion),
    );
  }
  private map = (value: unknown): TransportRecord => {
    const row = value as Record<string, unknown>,
      disabled = Boolean(row.disabled) || !Boolean(row.active),
      assignment = nullable(row.assignmentStatus),
      source = nullable(row.source) as AssignmentSource | null;
    const status: TransportStatus = disabled
      ? "FUORI_SERVIZIO"
      : assignment === "CARICATO"
        ? "CARICATO"
        : assignment === "IN_VIAGGIO"
          ? "IN_VIAGGIO"
          : assignment
            ? "IMPEGNATO"
            : "DISPONIBILE";
    return {
      id: String(row.id),
      plate: String(row.plate),
      description: String(row.description),
      active: Boolean(row.active),
      status,
      source,
      assignmentId: nullable(row.assignmentId),
      loadId: nullable(row.loadId),
      commessa: nullable(row.commessa),
      cliente: nullable(row.cliente),
      camion: nullable(row.camion),
      plannedDepartureDate: nullable(row.plannedDepartureDate),
      departedAt: nullable(row.departedAt),
      availableFrom: nullable(row.availableFrom),
      nextInspectionDate: nullable(row.nextInspectionDate),
      disabledReason: nullable(row.disabledReason),
      loadingSessionId: nullable(row.loadingSessionId),
      canRelease: status === "IMPEGNATO" && Boolean(row.assignmentId) && this.canRelease(String(row.assignmentId)),
    };
  };
}

export const addBusinessDays = (iso: string, days: number): string => {
  const date = new Date(iso);
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date.toISOString();
};
