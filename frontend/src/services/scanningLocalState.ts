import type { Pacco, UnitaSingola } from "../models/Scanning";
import type { Commessa, Pannello } from "../types/excel";

export interface ScanningChange {
  commessa: string;
  camion: string;
  panels: Pannello[];
  pack?: Pacco;
  single?: UnitaSingola;
}

export function updateScanningPanels(orders: Commessa[], change: ScanningChange): Commessa[] {
  const byId = new Map(change.panels.map(panel => [panel.backendId, panel]));
  return orders.map(order => order.ordine !== change.commessa ? order : {
    ...order,
    pannelli: order.pannelli.map(panel => {
      const updated = panel.numeroCamion === change.camion && panel.backendId ? byId.get(panel.backendId) : undefined;
      // The mutation response describes the panel, not the operational load status.
      // Keep the latter until the next authoritative periodic snapshot.
      return updated ? {...updated, loadStatus: panel.loadStatus} : panel;
    }),
  });
}

export function updateScanningSingles(singles: UnitaSingola[], change: ScanningChange): UnitaSingola[] {
  const affected = new Set(change.panels.map(panel => panel.numeroPannello));
  const retained = singles.filter(unit => unit.commessa !== change.commessa || unit.camion !== change.camion || !affected.has(unit.numeroPannello));
  return change.single ? [...retained, change.single] : retained;
}

export function updateScanningPackages(packages: Pacco[], change: ScanningChange, suspended = false): Pacco[] {
  if (!change.pack) return packages;
  const pack = change.pack;
  const retained = packages.filter(item => item.id !== pack.id);
  const belongs = suspended ? pack.stato === "APERTO" && pack.workflowState === "SOSPESO" : pack.stato !== "APERTO";
  return belongs ? [...retained, pack] : retained;
}

export function updateScanningDrafts<T extends Pannello[] | string>(drafts: Map<string, T>, change: ScanningChange, ids: boolean): Map<string, T> {
  if (!change.pack) return drafts;
  const next = new Map(drafts), key = `${change.commessa}\u0000${change.camion}`;
  if (change.pack.stato === "APERTO" && change.pack.workflowState === "ATTIVO") {
    next.set(key, (ids ? change.pack.id : change.pack.pannelli) as T);
  } else if (!ids || next.get(key) === change.pack.id) next.delete(key);
  return next;
}

// A snapshot can only replace local state if no confirmed mutation superseded it.
export class ScanningRevision {
  private value = 0;
  capture() { return this.value; }
  invalidate() { this.value++; }
  isCurrent(version: number) { return version === this.value; }
}
