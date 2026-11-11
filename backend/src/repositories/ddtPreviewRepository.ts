import { classifyVerifiedBulkLot, type DdtBulkLotElement } from "../services/ddtBulkLotPolicy.js";
import type { DatabaseSync } from "node:sqlite";
import { ApiError } from "../utils/apiError.js";
import { recognizeCustomer } from "./customerRecognition.js";
import { documentTransport } from "../services/documentTransport.js";

export interface DdtPanelElement {
  kind?: "PANEL";
  id: string; number: string; quantity: number; length: number; width: number;
  type: string; area: number; weight: number;
}
export type DdtElement = DdtPanelElement | DdtBulkLotElement;
export interface DdtGroup { label: string; packageId: string | null; elements: DdtElement[] }
export interface DdtPreview {
  kind: "DDT_PREVIEW"; sessionId: string; reference: string; date: string;
  order: string; orderReference: string; truck: string; customer: string; vat: string; destination: string; notes: string;
  transport:ReturnType<typeof documentTransport>;carrier: string; groups: DdtGroup[]; totals: { elements: number; weight: number; bulkLots?: number; ordinaryElements?: number; totalWeightKnown?: boolean; knownPanelVolume?: number };
}
type Row = Record<string, unknown>;
function missing(message: string): never { throw new ApiError(422, "DDT_PREVIEW_DATA_MISSING", message); }
const required = (value: unknown, label: string): string =>
  typeof value === "string" && value.trim() ? value.trim() : missing(`Anteprima DDT: ${label} non disponibile.`);

/** Only SELECTs: deliberately avoids operational repositories whose reads reconcile state. */
export function ddtPreview(db: DatabaseSync, sessionId: string, now = new Date(), autoRecognizeCustomer = false, allowPlannedTransport = false): DdtPreview {
  // A read transaction provides a consistent view of units, package contents and planning.
  db.exec("BEGIN DEFERRED");
  try {
    const result = readPreview(db, sessionId, now, autoRecognizeCustomer, allowPlannedTransport);
    db.exec("COMMIT");
    return result;
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

export function readPreview(db: DatabaseSync, sessionId: string, now: Date, autoRecognizeCustomer: boolean, allowPlannedTransport = false): DdtPreview {
  const session = db.prepare("SELECT s.*,l.commessa,l.cliente,l.camion FROM LoadingSessions s JOIN Loads l ON l.id=s.loadId WHERE s.id=?").get(sessionId) as Row | undefined;
  if (!session) throw new ApiError(404, "RESOURCE_NOT_FOUND", "Sessione di carico non trovata");
  const plan = db.prepare("SELECT * FROM ShipmentPlans WHERE loadId=?").get(String(session.loadId)) as Row | undefined;
  if (!plan) missing("Anteprima DDT: collegare al carico una spedizione pianificata nel calendario.");
  let customerId = typeof plan.customerId === "string" && plan.customerId ? plan.customerId : null;
  if (!customerId && autoRecognizeCustomer) {
    const recognition = recognizeCustomer(db, String(session.cliente ?? ""));
    if (recognition.status !== "UNIQUE") missing(recognition.status === "AMBIGUOUS"
      ? "Anteprima DDT: più clienti anagrafici corrispondono esattamente al nome della commessa. Selezionare esplicitamente il cliente nella pianificazione."
      : "Anteprima DDT: nessuna corrispondenza esatta nell'anagrafica cliente. Selezionare esplicitamente il cliente nella pianificazione.");
    customerId = recognition.customerId;
  }
  const customer = customerId ? db.prepare("SELECT * FROM Customers WHERE id=?").get(customerId) : undefined;
  if (!customer) missing("Anteprima DDT: collegare l'anagrafica cliente alla spedizione pianificata.");
  const vat = required(customer.partitaIva, "partita IVA del cliente collegato");
  const destination = required(plan.deliveryAddress, "destinazione merce nella spedizione pianificata");
  const resolveTransport = (mode:unknown, carrierId:unknown) => {
    const row = mode!=="RITIRA_CLIENTE" && typeof carrierId==="string" && carrierId
      ? db.prepare("SELECT name FROM Carriers WHERE id=?").get(carrierId) : undefined;
    return documentTransport(mode,carrierId,row as {name:unknown}|undefined);
  };
  const transport = (() => {
    try { return resolveTransport(session.transportMode,session.carrierId); }
    catch (actualError) {
      // Temporary TEST preview opt-in. Issuance calls readPreview with the strict default.
      if (!allowPlannedTransport || session.stato!=="ATTESA_SPEDIZIONE" || !session.completedAt || session.shippedAt
        || !(actualError instanceof ApiError) || actualError.code!=="DDT_PREVIEW_DATA_MISSING") throw actualError;
      const mode=plan.transportMode ?? plan.transportType;
      const carrierId=plan.plannedCarrierId ?? (mode==="BILICO_ESSEPI" ? plan.transportDetailId : null) ?? plan.carrierId;
      try { return resolveTransport(mode,carrierId); }
      catch (plannedError) {
        if (plannedError instanceof ApiError && plannedError.code==="DDT_PREVIEW_DATA_MISSING") throw actualError;
        throw plannedError;
      }
    }
  })();
  const carrier=transport.documentText;
  const units = db.prepare("SELECT unitType,panelId,packageId FROM LoadingUnits WHERE loadingSessionId=? AND active=1 ORDER BY id").all(sessionId) as Row[];
  if (!units.length) missing("Anteprima DDT: nessuna unità effettivamente caricata.");
  const singles = new Set(units.filter(u => u.unitType === "PANEL").map(u => String(u.panelId)));
  const packageIds = [...new Set(units.filter(u => u.unitType === "PACKAGE").map(u => String(u.packageId)))];
  const allPanels = db.prepare("SELECT * FROM Panels WHERE loadId=? ORDER BY numeroPannello,id").all(String(session.loadId)) as Row[];
  const packages = packageIds.map(id => {
    const pack = db.prepare("SELECT id,codicePacco,loadId FROM Packages WHERE id=?").get(id);
    if (!pack || pack.loadId !== session.loadId) missing("Anteprima DDT: pacco caricato non coerente con il carico.");
    return { id, code: required(pack.codicePacco, "codice pacco") };
  }).sort((a, b) => a.code.localeCompare(b.code, "it", { numeric: true }));
  if ([...singles].some(id => !allPanels.some(p => p.id === id))) missing("Anteprima DDT: elemento caricato non coerente con il carico.");
  const number = (p: Row, field: string, positive = false): number => {
    const value = p[field];
    if (typeof value !== "number" || !Number.isFinite(value) || (positive ? value <= 0 : value < 0))
      missing(`Anteprima DDT: ${field} non valido per l'elemento ${p.numeroPannello}.`);
    return value as number;
  };
  const ordinaryElement = (p: Row): DdtPanelElement => ({ id: String(p.id), number: required(p.numeroPannello, "codice elemento"),
    quantity: number(p, "quantita", true), length: number(p, "lunghezza", true), width: number(p, "altezza", true),
    type: required(p.tipoPannello, `tipologia dell'elemento ${p.numeroPannello}`), area: number(p, "superficie", true), weight: number(p, "peso", true) });
  const element = (p: Row): DdtElement => classifyVerifiedBulkLot(p, { loadId: session.loadId, order: session.commessa, truck: session.camion, packageCode: packages.find(pack => pack.id === p.packageId)?.code }) ?? ordinaryElement(p);
  const sort = (rows: Row[]) => rows.sort((a, b) => String(a.numeroPannello).localeCompare(String(b.numeroPannello), "it", { numeric: true }));
  const loadedPacks = new Set(packageIds);
  const singleRows = sort(allPanels.filter(p => singles.has(String(p.id)) && !loadedPacks.has(String(p.packageId))));
  if (singleRows.some(p => p.packageId)) missing("Anteprima DDT: elemento singolo appartenente a un pacco non caricato.");
  const groups: DdtGroup[] = singleRows.length ? [{ label: "ELEMENTI SINGOLI", packageId: null, elements: singleRows.map(element) }] : [];
  for (const pack of packages) {
    const children = sort(allPanels.filter(p => p.packageId === pack.id));
    if (!children.length) missing(`Anteprima DDT: il pacco ${pack.code} non contiene elementi.`);
    groups.push({ label: `PACCO ${pack.code}`, packageId: pack.id, elements: children.map(element) });
  }
  const elements = groups.flatMap(g => g.elements);
  const bulkLots = elements.filter(p => p.kind === "BULK_LOT").length;
  const ordinary = elements.filter((p): p is DdtPanelElement => p.kind !== "BULK_LOT");
  const knownWeight = ordinary.reduce((sum, p) => sum + p.weight, 0);
  const volumes = bulkLots ? ordinary.map(p => allPanels.find(row => row.id === p.id)?.volume) : [];
  const knownVolume = volumes.length > 0 && volumes.every((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0) ? (volumes as number[]).reduce((sum, v) => sum + v, 0) : undefined;
  const bulkNote = bulkLots ? `SFRIDO: 1 lotto sfuso; misure, superficie, peso e volume non disponibili. Dati noti dei ${ordinary.length} pannelli: ${knownWeight.toLocaleString("it-IT", { maximumFractionDigits: 3 })} kg${knownVolume === undefined ? "" : `; ${knownVolume.toLocaleString("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³`}. Totali complessivi non determinabili.` : "";
  const date = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
  return { kind: "DDT_PREVIEW", sessionId, reference: `X-Lam/ANTEPRIMA/${date.slice(-4)}`, date,
    order: required(session.commessa, "numero commessa importata"), customer: required(session.cliente, "cliente della commessa importata"),
    orderReference: typeof plan.orderReference === "string" ? plan.orderReference.trim() : "",
    truck: typeof session.camion === "string" ? session.camion.trim() : "",
    vat, destination, notes: [typeof plan.notes === "string" ? plan.notes : "", bulkNote].filter(Boolean).join("\n"), transport,carrier, groups,
    totals: { elements: elements.length, weight: knownWeight, ...(bulkLots ? { bulkLots, ordinaryElements: ordinary.length, totalWeightKnown: false, ...(knownVolume === undefined ? {} : { knownPanelVolume: knownVolume }) } : {}) } };
}
