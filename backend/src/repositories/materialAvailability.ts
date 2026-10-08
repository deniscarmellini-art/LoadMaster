import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

interface Manifest {
  loadId: string;
  hash: string;
  json: string;
  expected: number;
  available: number;
  complete: boolean;
  departed: boolean;
}
interface AvailabilityState {
  loadId: string;
  manifestVersion: number;
  manifestHash: string;
  manifestJson: string;
  isComplete: number;
  availableAt: string | null;
  availabilityEventId: string | null;
}

/** All material attributes, excluding operational state, package and scan metadata. */
const manifestColumns = "p.id,p.numeroPannello,p.numeroCliente,p.numeroMasterPanel,p.lato1,p.lato2,p.tipoPannello,p.quantita,p.spessore,p.lunghezza,p.altezza,p.superficie,p.volume,p.peso";

function manifests(database: DatabaseSync): Map<string, Manifest> {
  const loads = database.prepare(`SELECT l.id, (l.stato='SPEDITO'
    OR EXISTS(SELECT 1 FROM LoadingSessions s WHERE s.loadId=l.id AND (s.shippedAt IS NOT NULL OR s.stato='SPEDITO'))
    OR EXISTS(SELECT 1 FROM ShipmentPlans s WHERE s.loadId=l.id AND s.actualDepartureDate IS NOT NULL)) departed FROM Loads l`).all() as Array<{id:string;departed:number}>;
  const rows = database.prepare(`SELECT p.loadId,${manifestColumns},
    (p.stato IN ('DISPONIBILE','CARICATO','SPEDITO') AND
      (p.packageId IS NULL OR EXISTS(SELECT 1 FROM Packages k WHERE k.id=p.packageId AND k.loadId=p.loadId AND k.stato IN ('DISPONIBILE','CARICATO','SPEDITO')))) available
    FROM Panels p ORDER BY p.loadId,p.id`).all() as Array<Record<string, unknown>>;
  const groups = new Map<string, {panels:Record<string,unknown>[];available:number}>();
  for (const row of rows) {
    const {loadId, available, ...identity} = row;
    const key=String(loadId), group=groups.get(key) ?? {panels:[],available:0};
    group.panels.push(identity); group.available+=Number(available); groups.set(key,group);
  }
  return new Map(loads.map(load => {
    const group=groups.get(load.id) ?? {panels:[],available:0};
    const json=JSON.stringify({schema:1,loadId:load.id,panels:group.panels});
    return [load.id,{loadId:load.id,hash:createHash("sha256").update(json).digest("hex"),json,
      expected:group.panels.length,available:group.available,complete:group.panels.length>0&&group.available===group.panels.length,departed:Boolean(load.departed)}];
  }));
}

function state(database: DatabaseSync, loadId: string): AvailabilityState | undefined {
  return database.prepare("SELECT * FROM LoadMaterialAvailabilityState WHERE loadId=?").get(loadId) as unknown as AvailabilityState | undefined;
}

function event(database: DatabaseSync, manifest: Manifest, version: number, type: string, at: string, reason: string): string {
  const id=randomUUID();
  database.prepare("INSERT INTO LoadMaterialAvailabilityEvents(id,loadId,type,manifestVersion,manifestHash,manifestJson,expectedCount,availableCount,occurredAt,reason) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run(id,manifest.loadId,type,version,manifest.hash,manifest.json,manifest.expected,manifest.available,at,reason);
  return id;
}

function save(database: DatabaseSync, manifest: Manifest, version: number, availableAt: string | null, eventId: string | null, at: string): AvailabilityState {
  database.prepare(`INSERT INTO LoadMaterialAvailabilityState(loadId,manifestVersion,manifestHash,manifestJson,isComplete,availableAt,availabilityEventId,updatedAt) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(loadId) DO UPDATE SET manifestVersion=excluded.manifestVersion,manifestHash=excluded.manifestHash,manifestJson=excluded.manifestJson,isComplete=excluded.isComplete,availableAt=excluded.availableAt,availabilityEventId=excluded.availabilityEventId,updatedAt=excluded.updatedAt`)
    .run(manifest.loadId,version,manifest.hash,manifest.json,manifest.complete?1:0,availableAt,eventId,at);
  return state(database,manifest.loadId)!;
}

/** Establish what is known BEFORE a mutation; existing complete material has no invented date. */
function baseline(database: DatabaseSync, manifest: Manifest, at: string): AvailabilityState {
  const previous=state(database,manifest.loadId);
  if (previous && previous.manifestHash===manifest.hash && Boolean(previous.isComplete)===manifest.complete) return previous;
  let version=previous?.manifestVersion ?? 1;
  if (previous) {
    if (previous.isComplete) event(database,{...manifest,hash:previous.manifestHash,json:previous.manifestJson},version,"INVALIDATED",at,"Untracked change observed; prior continuity cannot be certified");
    if (previous.manifestHash!==manifest.hash) version++;
  }
  event(database,manifest,version,"BASELINE",at,"Observed baseline; prior completion time unknown");
  return save(database,manifest,version,null,null,at);
}

/** Called by the existing BEGIN IMMEDIATE repository transactions, never by GETs.
 * Comparing before/after centrally covers import, reassignment, package workflows,
 * preparation and loading without duplicating rules in controllers.
 */
export function trackMaterialAvailability<T>(database: DatabaseSync, operation: () => T): T {
  const before=manifests(database);
  const startSequence=Number((database.prepare("SELECT COALESCE(MAX(rowid),0) n FROM OperationalEvents").get() as {n:number}).n);
  const result=operation();
  const after=manifests(database);
  const now=new Date().toISOString();
  for (const current of after.values()) {
    const original=before.get(current.loadId);
    if (original?.departed || current.departed) continue;
    if (original && original.hash===current.hash && original.complete===current.complete) continue;
    // The preparation event supplies the exact operation timestamp. Manifest
    // changes without an operational event are timestamped in this transaction.
    const cause=database.prepare(`SELECT timestamp FROM OperationalEvents WHERE rowid>? AND loadId=?
      AND type IN ('SINGLE_CLOSED','PACKAGE_CLOSED','PACKAGE_CANCELLED','SCAN_CANCELLED','PANEL_ADDED_TO_PACKAGE','PANEL_REMOVED_FROM_PACKAGE','PANEL_REASSIGNED','UNIT_LOADED','UNIT_UNLOADED') ORDER BY rowid DESC LIMIT 1`).get(startSequence,current.loadId) as {timestamp:string}|undefined;
    const at=cause?.timestamp ?? now;
    if (!original) {
      event(database,current,1,"MANIFEST_CHANGED",at,"Initial manifest");
      const id=current.complete?event(database,current,1,"COMPLETE",at,"Initial manifest completely available"):null;
      save(database,current,1,id?at:null,id,at); continue;
    }
    const previous=baseline(database,original,at);
    const changed=original.hash!==current.hash;
    const version=previous.manifestVersion+(changed?1:0);
    if (previous.isComplete && (changed || !current.complete)) event(database,original,previous.manifestVersion,"INVALIDATED",at,changed?"Manifest changed":"Material no longer completely available");
    if (changed) event(database,current,version,"MANIFEST_CHANGED",at,"Composition or material attributes changed");
    const id=current.complete?event(database,current,version,"COMPLETE",at,changed?"New manifest completely available":"Last unavailable material became available"):null;
    save(database,current,version,id?at:null,id,at);
  }
  return result;
}

const localDay = (value: string, timeZone: string): number | null => {
  const date=new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts=new Intl.DateTimeFormat("en",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const part=(type:string)=>Number(parts.find(item=>item.type===type)?.value);
  return Date.UTC(part("year"),part("month")-1,part("day"))/86400000;
};

export function calendarWarehouseDays(availableAt: string | null, shippedAt: string, timeZone="Europe/Rome"): number | null {
  if (!availableAt || !Number.isFinite(Date.parse(availableAt)) || !Number.isFinite(Date.parse(shippedAt)) || Date.parse(availableAt)>Date.parse(shippedAt)) return null;
  const available=localDay(availableAt,timeZone), shipped=localDay(shippedAt,timeZone);
  return available===null||shipped===null||shipped<available?null:shipped-available;
}

/** Called after existing departure validations and inside their transaction. */
export function consolidateMaterialAvailability(database: DatabaseSync, loadId: string, shippedAt: string): void {
  if (database.prepare("SELECT 1 FROM LoadMaterialAvailabilityShipments WHERE loadId=?").get(loadId)) return;
  const manifest=manifests(database).get(loadId);
  if (!manifest) throw new Error("LOAD_NOT_FOUND");
  const current=baseline(database,manifest,shippedAt);
  const availableAt=manifest.complete?current.availableAt:null;
  const timeZone="Europe/Rome", days=calendarWarehouseDays(availableAt,shippedAt,timeZone);
  const anomaly=availableAt&&days===null?"AVAILABILITY_CHRONOLOGY_INVALID":null;
  database.prepare(`INSERT INTO LoadMaterialAvailabilityShipments(loadId,manifestVersion,manifestHash,manifestJson,availabilityEventId,availableAt,shippedAt,calendarTimeZone,warehouseDays,anomaly) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(loadId,current.manifestVersion,manifest.hash,manifest.json,manifest.complete?current.availabilityEventId:null,availableAt,shippedAt,timeZone,days,anomaly);
}

export function materialAvailabilityDetails(database: DatabaseSync, loadId: string) {
  return {
    current: state(database,loadId) ?? null,
    events: database.prepare("SELECT * FROM LoadMaterialAvailabilityEvents WHERE loadId=? ORDER BY sequence").all(loadId),
    shipment: database.prepare("SELECT * FROM LoadMaterialAvailabilityShipments WHERE loadId=?").get(loadId) ?? null,
  };
}
