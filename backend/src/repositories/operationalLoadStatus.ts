import type { DatabaseSync } from "node:sqlite";

import type { LoadStatus } from "../models/operational.js";

interface StatusCounts {
  expected: number;
  ready: number;
  loaded: number;
}

export const deriveOperationalLoadStatus = (
  database: DatabaseSync,
  loadId: string,
): LoadStatus => {
  const session = database
    .prepare("SELECT stato FROM LoadingSessions WHERE loadId=?")
    .get(loadId) as { stato: string } | undefined;
  const departed = database
    .prepare(
      "SELECT 1 FROM ShipmentPlans WHERE loadId=? AND actualDepartureDate IS NOT NULL LIMIT 1",
    )
    .get(loadId);
  if (session?.stato === "SPEDITO" || departed) return "SPEDITO";
  if (session?.stato === "ATTESA_SPEDIZIONE") return "ATTESA_SPEDIZIONE";

  const counts = database
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM Panels WHERE loadId=?) expected,
        (SELECT COUNT(*) FROM Panels WHERE loadId=? AND stato IN ('DISPONIBILE','CARICATO','SPEDITO')) ready,
        (SELECT COUNT(*) FROM LoadingUnits u
          JOIN LoadingSessions s ON s.id=u.loadingSessionId
          WHERE s.loadId=? AND u.active=1) loaded`,
    )
    .get(loadId, loadId, loadId) as unknown as StatusCounts;

  if (counts.loaded > 0) return "IN_CARICO";
  if (counts.expected > 0 && counts.ready === counts.expected)
    return "DA_CARICARE";
  return "DA_COMPLETARE";
};

export const reconcileOperationalLoadStatus = (
  database: DatabaseSync,
  loadId: string,
): LoadStatus => {
  const status = deriveOperationalLoadStatus(database, loadId);
  const now = new Date().toISOString();
  database
    .prepare("UPDATE Loads SET stato=?,updatedAt=? WHERE id=? AND stato<>?")
    .run(status, now, loadId, status);
  const sessionStatus =
    status === "DA_COMPLETARE" ? "DA_CARICARE" : status;
  database
    .prepare(
      "UPDATE LoadingSessions SET stato=?,updatedAt=? WHERE loadId=? AND stato<>?",
    )
    .run(sessionStatus, now, loadId, sessionStatus);
  return status;
};

export const reconcileAllOperationalLoadStatuses = (
  database: DatabaseSync,
): void => {
  const loads = database.prepare("SELECT id FROM Loads").all() as Array<{
    id: string;
  }>;
  for (const load of loads) reconcileOperationalLoadStatus(database, load.id);
};
