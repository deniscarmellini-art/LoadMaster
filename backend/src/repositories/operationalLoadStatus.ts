import type { DatabaseSync } from "node:sqlite";

import type { LoadStatus } from "../models/operational.js";
import type { LoadingSessionRecord } from "../models/operational.js";
import { assignedTrailer, resolveLoadingTransport } from "./loadingTransport.js";
import { ApiError } from "../utils/apiError.js";
import { TransportRepository } from "./transportRepository.js";

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
    .prepare("SELECT * FROM LoadingSessions WHERE loadId=?")
    .get(loadId) as unknown as LoadingSessionRecord | undefined;
  const departed = database
    .prepare(
      "SELECT 1 FROM ShipmentPlans WHERE loadId=? AND actualDepartureDate IS NOT NULL LIMIT 1",
    )
    .get(loadId);
  const shippedLoad = database.prepare("SELECT 1 FROM Loads WHERE id=? AND stato='SPEDITO'").get(loadId);
  if (shippedLoad || session?.shippedAt || session?.stato === "SPEDITO" || departed) return "SPEDITO";

  const counts = database
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM Panels WHERE loadId=?) expected,
        (SELECT COUNT(*) FROM Panels WHERE loadId=? AND stato IN ('DISPONIBILE','CARICATO','SPEDITO')) ready,
        (SELECT COUNT(*) FROM Panels p WHERE p.loadId=? AND EXISTS(
          SELECT 1 FROM LoadingUnits u JOIN LoadingSessions s ON s.id=u.loadingSessionId
          WHERE s.loadId=p.loadId AND u.active=1 AND
          (u.panelId=p.id OR (p.packageId IS NOT NULL AND u.packageId=p.packageId)))) loaded`,
    )
    .get(loadId, loadId, loadId) as unknown as StatusCounts;

  if (session && counts.expected > 0 && counts.loaded === counts.expected && completionTransportReady(database, session))
    return "ATTESA_SPEDIZIONE";
  if (counts.loaded > 0) return "IN_CARICO";
  if (counts.expected > 0 && counts.ready === counts.expected)
    return "DA_CARICARE";
  return "DA_COMPLETARE";
};

function completionTransportReady(database: DatabaseSync, session: LoadingSessionRecord): boolean {
  if (!session.transportMode) return session.destinationType === "RIMORCHIO_ESSEPI" ? Boolean(session.trailerId) : Boolean(session.carrierId);
  if (session.transportMode === "BILICO_ESSEPI" && (!session.carrierId || !session.trailerId || assignedTrailer(database, session.loadId) !== session.trailerId)) return false;
  if (session.transportMode === "TERZI_PER_ESSEPI" && !session.transportDetailId) return false;
  try {
    resolveLoadingTransport(database, session.loadId, {operatorId: session.operatorId, destinationType: session.destinationType, transportMode: session.transportMode, carrierId: session.carrierId ?? undefined, transportDetailId: session.transportDetailId}, session);
    return true;
  } catch (error) {
    if (error instanceof ApiError) return false;
    throw error;
  }
}

export const reconcileOperationalLoadStatus = (
  database: DatabaseSync,
  loadId: string,
): LoadStatus => {
  const status = deriveOperationalLoadStatus(database, loadId);
  const now = new Date().toISOString();
  const previous = database.prepare("SELECT id,stato,operatorId FROM LoadingSessions WHERE loadId=?").get(loadId) as {id:string;stato:string;operatorId:string}|undefined;
  if (previous && previous.stato !== status && (status === "ATTESA_SPEDIZIONE" || previous.stato === "ATTESA_SPEDIZIONE") && status !== "SPEDITO") {
    const completed = status === "ATTESA_SPEDIZIONE";
    const transports = new TransportRepository(database);
    if (completed) transports.markLoadedBySession(previous.id, now);
    else transports.markLoadingBySession(previous.id, now);
    database.prepare("INSERT INTO OperationalEvents(id,loadId,loadingSessionId,type,operatorId,timestamp,note) VALUES(?,?,?,?,?,?,?)").run(crypto.randomUUID(),loadId,previous.id,completed?"LOADING_COMPLETED":"LOADING_REOPENED",previous.operatorId,now,"Ricalcolo stato operativo");
  }
  database.prepare("UPDATE LoadingSessions SET completedAt=CASE WHEN ?='ATTESA_SPEDIZIONE' THEN COALESCE(completedAt,?) ELSE NULL END WHERE loadId=? AND stato<>'SPEDITO'").run(status, now, loadId);
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
