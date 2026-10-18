import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";

export interface DefinitiveDdt {
  id: string; loadingSessionId: string; loadId: string; sequence: number; year: number; fullNumber: string;
  issuedAt: string; documentDate: string; issuedByOperatorId: string; status: "EMESSO" | "ANNULLATO";
  cancelledAt: string | null; cancelledByOperatorId: string | null; cancellationReason: string | null;
  replacedByDdtId: string | null; snapshotVersion: number; snapshotJson: string; pdfReference: string; pdfSha256: string;
}
export const pdfHash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export class DefinitiveDdtRepository {
  constructor(readonly db: DatabaseSync) { db.exec("PRAGMA busy_timeout=5000"); }
  transaction<T>(operation: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = operation(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  find(id: string): DefinitiveDdt | undefined {
    return this.db.prepare(`SELECT id,loadingSessionId,loadId,sequence,year,fullNumber,issuedAt,documentDate,issuedByOperatorId,status,
      cancelledAt,cancelledByOperatorId,cancellationReason,replacedByDdtId,snapshotVersion,snapshotJson,pdfReference,pdfSha256
      FROM DdtDocuments WHERE id=?`).get(id) as unknown as DefinitiveDdt | undefined;
  }
  valid(sessionId: string) { const row=this.db.prepare("SELECT id FROM DdtDocuments WHERE loadingSessionId=? AND status='EMESSO'").get(sessionId);return row?this.find(String(row.id)):undefined; }
  history(sessionId:string) {
    return this.db.prepare(`SELECT id,loadingSessionId,loadId,fullNumber,documentDate,issuedAt,issuedByOperatorId,status,
      cancelledAt,cancelledByOperatorId,cancellationReason,replacedByDdtId
      FROM DdtDocuments WHERE loadingSessionId=? ORDER BY year DESC,sequence DESC`).all(sessionId);
  }
  hasDeparted(sessionId:string):boolean {
    return Boolean(this.db.prepare(`SELECT 1 FROM LoadingSessions s JOIN Loads l ON l.id=s.loadId WHERE s.id=? AND (
      s.shippedAt IS NOT NULL OR s.stato='SPEDITO' OR l.stato='SPEDITO'
      OR EXISTS(SELECT 1 FROM ShipmentPlans p WHERE p.loadId=s.loadId AND p.actualDepartureDate IS NOT NULL)
      OR EXISTS(SELECT 1 FROM OperationalEvents e WHERE e.loadId=s.loadId AND e.type='PARTENZA_CONFERMATA')
      OR EXISTS(SELECT 1 FROM TransportAssignments a WHERE a.loadId=s.loadId AND (a.departedAt IS NOT NULL OR a.stato='IN_VIAGGIO')))
      `).get(sessionId));
  }
  originalPdf(id: string): Buffer {
    const row=this.db.prepare("SELECT pdfBytes,pdfSha256 FROM DdtDocuments WHERE id=?").get(id);
    if(!row)throw new Error("DDT_NOT_FOUND");
    const bytes=Buffer.from(row.pdfBytes as Uint8Array);
    if(pdfHash(bytes)!==row.pdfSha256)throw new Error("DDT_PDF_INTEGRITY_ERROR");
    return bytes;
  }
  /** Called exclusively inside the issuance transaction. */
  nextNumber(year: number): number {
    if(!this.db.isTransaction)throw new Error("DDT_TRANSACTION_REQUIRED");
    const row=this.db.prepare("INSERT INTO DdtSequences(year,lastNumber) VALUES(?,1) ON CONFLICT(year) DO UPDATE SET lastNumber=lastNumber+1 RETURNING lastNumber").get(year)!;
    return Number(row.lastNumber);
  }
  insert(doc: DefinitiveDdt, bytes: Uint8Array, requestKey?:string): void {
    if(!this.db.isTransaction)throw new Error("DDT_TRANSACTION_REQUIRED");
    this.db.prepare(`INSERT INTO DdtDocuments(id,loadingSessionId,loadId,sequence,year,fullNumber,issuedAt,documentDate,issuedByOperatorId,status,snapshotVersion,snapshotJson,pdfReference,pdfSha256,pdfBytes${requestKey?",requestKey":""})
      VALUES(?,?,?,?,?,?,?,?,?,'EMESSO',1,?,?,?,?${requestKey?",?":""})`).run(doc.id,doc.loadingSessionId,doc.loadId,doc.sequence,doc.year,doc.fullNumber,doc.issuedAt,doc.documentDate,doc.issuedByOperatorId,doc.snapshotJson,doc.pdfReference,doc.pdfSha256,bytes,...(requestKey?[requestKey]:[]));
  }
}
