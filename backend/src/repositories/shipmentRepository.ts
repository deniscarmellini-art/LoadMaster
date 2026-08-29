import type { DatabaseSync } from "node:sqlite";

export type ShipmentStatus =
  "DA_PIANIFICARE" | "PIANIFICATA" | "PRONTA" | "IN_VIAGGIO" | "CONCLUSA";
export type ShipmentTransportType = "BILICO_ESSEPI" | "TRASPORTATORE_ESTERNO";
export interface ShipmentInput {
  loadId?: string | null;
  commessa: string;
  cliente: string;
  camion?: string | null;
  plannedLoadingDate?: string | null;
  plannedDepartureDate?: string | null;
  transportType?: ShipmentTransportType | null;
  trailerId?: string | null;
  carrierId?: string | null;
  notes?: string | null;
}
export interface ShipmentRecord {
  id: string;
  persisted: boolean;
  loadId: string | null;
  commessa: string;
  cliente: string;
  camion: string | null;
  plannedLoadingDate: string | null;
  plannedDepartureDate: string | null;
  originalPlannedDepartureDate: string | null;
  plannedDepartureDateChangedAt: string | null;
  actualDepartureDate: string | null;
  transportType: ShipmentTransportType | null;
  trailerId: string | null;
  carrierId: string | null;
  notes: string | null;
  shipmentStatus: ShipmentStatus;
  operationalStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
const nullable = (r: Record<string, unknown>, k: string) =>
  typeof r[k] === "string" ? (r[k] as string) : null;
const norm = (v: string) =>
  v
    .trim()
    .toLocaleUpperCase("it-IT")
    .replace(/[\s-]+/g, "");
export class ShipmentRepository {
  constructor(private readonly db: DatabaseSync) {}
  list(): ShipmentRecord[] {
    const plans = this.db
      .prepare(
        `SELECT p.*,
          COALESCE(l.commessa,p.manualCommessa) commessa,
          COALESCE(l.cliente,p.manualCliente) cliente,
          COALESCE(l.camion,p.manualCarico) camion,
          l.stato operationalStatus,
          COALESCE((
            SELECT a.trailerId FROM TransportAssignments a
            WHERE a.releasedAt IS NULL AND (
              (p.loadId IS NOT NULL AND a.loadId=p.loadId) OR
              (p.trailerId IS NOT NULL AND a.trailerId=p.trailerId) OR
              (p.loadId IS NULL AND a.source='MANUAL'
                AND UPPER(TRIM(a.manualCommessa))=UPPER(TRIM(p.manualCommessa))
                AND UPPER(REPLACE(REPLACE(TRIM(COALESCE(a.manualCarico,'')),' ',''),'-',''))=
                    UPPER(REPLACE(REPLACE(TRIM(COALESCE(p.manualCarico,'')),' ',''),'-','')))
            ) ORDER BY a.assignedAt DESC LIMIT 1
          ),p.trailerId) resolvedTrailerId,
          (SELECT a.stato FROM TransportAssignments a
            WHERE a.releasedAt IS NULL AND (
              (p.loadId IS NOT NULL AND a.loadId=p.loadId) OR
              (p.trailerId IS NOT NULL AND a.trailerId=p.trailerId) OR
              (p.loadId IS NULL AND a.source='MANUAL'
                AND UPPER(TRIM(a.manualCommessa))=UPPER(TRIM(p.manualCommessa))
                AND UPPER(REPLACE(REPLACE(TRIM(COALESCE(a.manualCarico,'')),' ',''),'-',''))=
                    UPPER(REPLACE(REPLACE(TRIM(COALESCE(p.manualCarico,'')),' ',''),'-','')))
            ) ORDER BY a.assignedAt DESC LIMIT 1) assignmentStatus
        FROM ShipmentPlans p
        LEFT JOIN Loads l ON l.id=p.loadId
        ORDER BY COALESCE(p.plannedDepartureDate,'9999-12-31'),commessa,camion`,
      )
      .all()
      .map((v) => this.map(v, true));
    const plannedLoads = new Set(plans.map((p) => p.loadId).filter(Boolean));
    const virtual = this.db
      .prepare(
        `SELECT l.id loadId,l.commessa,l.cliente,l.camion,l.stato operationalStatus,
          l.createdAt,l.updatedAt,
          (SELECT a.trailerId FROM TransportAssignments a
            WHERE a.loadId=l.id AND a.releasedAt IS NULL
            ORDER BY a.assignedAt DESC LIMIT 1) resolvedTrailerId,
          (SELECT a.stato FROM TransportAssignments a
            WHERE a.loadId=l.id AND a.releasedAt IS NULL
            ORDER BY a.assignedAt DESC LIMIT 1) assignmentStatus
        FROM Loads l WHERE l.stato<>'SPEDITO' ORDER BY l.commessa,l.camion`,
      )
      .all()
      .filter(
        (v) => !plannedLoads.has(String((v as Record<string, unknown>).loadId)),
      )
      .map((v) => this.map(v, false));
    return [...plans, ...virtual];
  }
  find(id: string): ShipmentRecord | null {
    return this.list().find((x) => x.id === id) ?? null;
  }
  create(input: ShipmentInput): ShipmentRecord {
    const now = new Date().toISOString(),
      id = crypto.randomUUID();
    this.transaction(() => {
      this.assertUnique(input);
      this.db
        .prepare(
          "INSERT INTO ShipmentPlans(id,loadId,manualCommessa,manualCliente,manualCarico,plannedLoadingDate,plannedDepartureDate,originalPlannedDepartureDate,plannedDepartureDateChangedAt,transportType,trailerId,carrierId,notes,createdAt,updatedAt)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          input.loadId || null,
          input.loadId ? null : input.commessa.trim(),
          input.loadId ? null : input.cliente.trim(),
          input.loadId ? null : input.camion?.trim() || null,
          input.plannedLoadingDate || null,
          input.plannedDepartureDate || null,
          input.plannedDepartureDate || null,
          null,
          input.transportType || null,
          input.trailerId || null,
          input.carrierId || null,
          input.notes?.trim() || null,
          now,
          now,
        );
    });
    return this.find(id)!;
  }
  update(id: string, input: ShipmentInput): ShipmentRecord | null {
    const old = this.find(id);
    if (!old || !old.persisted) return null;
    const now = new Date().toISOString();
    const nextPlannedDepartureDate = input.plannedDepartureDate || null;
    const hadOriginalDepartureDate = Boolean(
      old.originalPlannedDepartureDate ?? old.plannedDepartureDate,
    );
    const originalPlannedDepartureDate =
      old.originalPlannedDepartureDate ??
      old.plannedDepartureDate ??
      nextPlannedDepartureDate;
    const plannedDepartureDateChangedAt =
      nextPlannedDepartureDate !== old.plannedDepartureDate &&
      hadOriginalDepartureDate
        ? now
        : old.plannedDepartureDateChangedAt;
    this.transaction(() => {
      this.assertUnique(input, id);
      this.db
        .prepare(
          "UPDATE ShipmentPlans SET loadId=?,manualCommessa=?,manualCliente=?,manualCarico=?,plannedLoadingDate=?,plannedDepartureDate=?,originalPlannedDepartureDate=?,plannedDepartureDateChangedAt=?,transportType=?,trailerId=?,carrierId=?,notes=?,updatedAt=? WHERE id=?",
        )
        .run(
          input.loadId || null,
          input.loadId ? null : input.commessa.trim(),
          input.loadId ? null : input.cliente.trim(),
          input.loadId ? null : input.camion?.trim() || null,
          input.plannedLoadingDate || null,
          nextPlannedDepartureDate,
          originalPlannedDepartureDate,
          plannedDepartureDateChangedAt,
          input.transportType || null,
          input.trailerId || null,
          input.carrierId || null,
          input.notes?.trim() || null,
          now,
          id,
        );
    });
    return this.find(id);
  }
  link(id: string, loadId: string): ShipmentRecord | null {
    const old = this.find(id);
    if (!old || !old.persisted) return null;
    const load = this.db
      .prepare("SELECT commessa,cliente,camion FROM Loads WHERE id=?")
      .get(loadId) as
      { commessa: string; cliente: string; camion: string } | undefined;
    if (!load) throw new Error("LOAD_NOT_FOUND");
    this.assertUnique(
      {
        ...old,
        loadId,
        commessa: load.commessa,
        cliente: load.cliente,
        camion: load.camion,
      },
      id,
    );
    this.transaction(() => {
      this.db
        .prepare(
          "UPDATE ShipmentPlans SET loadId=?,manualCommessa=NULL,manualCliente=NULL,manualCarico=NULL,updatedAt=? WHERE id=?",
        )
        .run(loadId, new Date().toISOString(), id);
    });
    return this.find(id);
  }
  depart(id: string, at: string, carrierId?: string): ShipmentRecord | null {
    const current = this.find(id);
    if (!current || !current.persisted) return null;
    this.db
      .prepare(
        "UPDATE ShipmentPlans SET actualDepartureDate=?,carrierId=COALESCE(?,carrierId),updatedAt=? WHERE id=?",
      )
      .run(at, carrierId ?? null, at, id);
    return this.find(id);
  }
  delete(id: string): boolean {
    const old = this.find(id);
    if (!old || !old.persisted || old.loadId) return false;
    return this.transaction(() => {
      return (
        this.db.prepare("DELETE FROM ShipmentPlans WHERE id=?").run(id)
          .changes > 0
      );
    });
  }
  private assertUnique(input: ShipmentInput, exclude?: string) {
    if (
      input.loadId &&
      this.db
        .prepare(
          "SELECT 1 FROM ShipmentPlans WHERE loadId=? AND id<>COALESCE(?,'')",
        )
        .get(input.loadId, exclude ?? null)
    )
      throw new Error("SHIPMENT_DUPLICATE");
    if (
      !input.loadId &&
      this.db
        .prepare(
          "SELECT 1 FROM ShipmentPlans WHERE loadId IS NULL AND UPPER(TRIM(manualCommessa))=UPPER(TRIM(?)) AND UPPER(REPLACE(REPLACE(TRIM(COALESCE(manualCarico,'')),' ',''),'-',''))=? AND id<>COALESCE(?,'')",
        )
        .get(input.commessa, norm(input.camion ?? ""), exclude ?? null)
    )
      throw new Error("SHIPMENT_DUPLICATE");
  }
  private map = (v: unknown, persisted: boolean): ShipmentRecord => {
    const r = v as Record<string, unknown>,
      loadId = nullable(r, "loadId"),
      operational = nullable(r, "operationalStatus"),
      planned = nullable(r, "plannedDepartureDate"),
      actual = nullable(r, "actualDepartureDate"),
      type = nullable(r, "transportType") as ShipmentTransportType | null,
      assignment = nullable(r, "assignmentStatus");
    let status: ShipmentStatus = !planned ? "DA_PIANIFICARE" : "PIANIFICATA";
    if (operational === "ATTESA_SPEDIZIONE") status = "PRONTA";
    if (actual)
      status =
        type === "BILICO_ESSEPI" && assignment === "IN_VIAGGIO"
          ? "IN_VIAGGIO"
          : "CONCLUSA";
    if (operational === "SPEDITO" && !actual)
      status =
        type === "BILICO_ESSEPI" && assignment === "IN_VIAGGIO"
          ? "IN_VIAGGIO"
          : "CONCLUSA";
    return {
      id: persisted ? String(r.id) : `load:${loadId}`,
      persisted,
      loadId,
      commessa: String(r.commessa ?? ""),
      cliente: String(r.cliente ?? ""),
      camion: nullable(r, "camion"),
      plannedLoadingDate: nullable(r, "plannedLoadingDate"),
      plannedDepartureDate: planned,
      originalPlannedDepartureDate: nullable(
        r,
        "originalPlannedDepartureDate",
      ),
      plannedDepartureDateChangedAt: nullable(
        r,
        "plannedDepartureDateChangedAt",
      ),
      actualDepartureDate: actual,
      transportType: type,
      trailerId: nullable(r, "resolvedTrailerId") ?? nullable(r, "trailerId"),
      carrierId: nullable(r, "carrierId"),
      notes: nullable(r, "notes"),
      shipmentStatus: status,
      operationalStatus: operational,
      createdAt: nullable(r, "createdAt"),
      updatedAt: nullable(r, "updatedAt"),
    };
  };
  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      this.db.exec("COMMIT");
      return out;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
}
