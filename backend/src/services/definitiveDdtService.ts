import { randomUUID } from "node:crypto";
import { DefinitiveDdtRepository, pdfHash, type DefinitiveDdt } from "../repositories/definitiveDdtRepository.js";
import { documentTransport } from "./documentTransport.js";

export interface DdtIssuanceContext {
  id: string; loadingSessionId: string; loadId: string; fullNumber: string; issuedAt: string; documentDate: string;
  transport: ReturnType<typeof documentTransport>;
}
/** TEST-only lifecycle. Issuance and cancellation share the departure transaction lock. */
export class DefinitiveDdtService {
  constructor(private readonly repo: DefinitiveDdtRepository, private readonly environment: string, private readonly clock=()=>new Date()) {}
  private testOnly(){if(this.environment!=="test")throw new Error("DDT_TEST_ONLY");}
  private operator(id:string){if(!this.repo.db.prepare("SELECT 1 FROM Operators WHERE id=? AND active=1").get(id))throw new Error("DDT_ACTIVE_OPERATOR_REQUIRED");}
  private notDeparted(sessionId:string){
    const row=this.repo.db.prepare(`SELECT s.*,l.stato loadStatus FROM LoadingSessions s JOIN Loads l ON l.id=s.loadId WHERE s.id=?`).get(sessionId);
    if(!row)throw new Error("DDT_SESSION_NOT_FOUND");
    if(this.repo.hasDeparted(sessionId))throw new Error("DDT_ALREADY_DEPARTED");
    return row;
  }
  issue(sessionId:string,operatorId:string,buildSnapshot:(context:DdtIssuanceContext)=>Record<string,unknown>,render:(snapshot:Record<string,unknown>,context:DdtIssuanceContext)=>Uint8Array,requestKey?:string):DefinitiveDdt {
    this.testOnly();
    return this.repo.transaction(()=>{
      this.operator(operatorId);
      if(requestKey){
        const existing=this.repo.db.prepare("SELECT id,loadingSessionId FROM DdtDocuments WHERE requestKey=?").get(requestKey);
        if(existing){if(existing.loadingSessionId!==sessionId)throw new Error("DDT_REQUEST_CONFLICT");return this.repo.find(String(existing.id))!;}
      }
      const session=this.notDeparted(sessionId);
      const closure=this.repo.db.prepare("SELECT type FROM OperationalEvents WHERE loadingSessionId=? AND (type IN ('LOADING_CLOSURE_CONFIRMED','LOADING_REOPENED','UNIT_UNLOADED') OR (type='LOADING_COMPLETED' AND note IS NULL)) ORDER BY rowid DESC LIMIT 1").get(sessionId);
      if(session.stato!=="ATTESA_SPEDIZIONE"||!session.completedAt||!closure||!["LOADING_CLOSURE_CONFIRMED","LOADING_COMPLETED"].includes(String(closure.type)))throw new Error("DDT_CLOSED_LOAD_REQUIRED");
      if(this.repo.valid(sessionId))throw new Error("DDT_ALREADY_VALID");
      const carrier=session.carrierId?this.repo.db.prepare("SELECT name FROM Carriers WHERE id=?").get(String(session.carrierId)):undefined;
      const transport=documentTransport(session.transportMode,session.carrierId,carrier as {name:unknown}|undefined);
      const now=this.clock();const issuedAt=now.toISOString();
      const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
      const part=(key:string)=>parts.find(p=>p.type===key)!.value;
      const year=Number(part("year")),sequence=this.repo.nextNumber(year),id=randomUUID();
      const context:DdtIssuanceContext={id,loadingSessionId:sessionId,loadId:String(session.loadId),fullNumber:`X-Lam/${String(sequence).padStart(4,"0")}/${year}`,issuedAt,documentDate:`${part("year")}-${part("month")}-${part("day")}`,transport};
      const snapshotJson=JSON.stringify({schemaVersion:1,document:context,data:buildSnapshot(structuredClone(context))});
      const bytes=Buffer.from(render(JSON.parse(snapshotJson) as Record<string,unknown>,structuredClone(context)));
      if(bytes.length<5||bytes.subarray(0,5).toString()!=="%PDF-")throw new Error("DDT_INVALID_PDF");
      const doc:DefinitiveDdt={...context,sequence,year,issuedByOperatorId:operatorId,status:"EMESSO",cancelledAt:null,cancelledByOperatorId:null,cancellationReason:null,replacedByDdtId:null,snapshotVersion:1,snapshotJson,pdfReference:`sqlite:ddt/${id}`,pdfSha256:pdfHash(bytes)};
      this.repo.insert(doc,bytes,requestKey);
      this.repo.db.prepare("UPDATE DdtDocuments SET replacedByDdtId=? WHERE id=(SELECT id FROM DdtDocuments WHERE loadingSessionId=? AND status='ANNULLATO' AND replacedByDdtId IS NULL ORDER BY year DESC,sequence DESC LIMIT 1)").run(id,sessionId);
      return this.repo.find(id)!;
    });
  }
  cancel(id:string,operatorId:string,reason:string):DefinitiveDdt {
    this.testOnly();
    return this.repo.transaction(()=>{
      this.operator(operatorId);
      if(!reason.trim())throw new Error("DDT_CANCELLATION_REASON_REQUIRED");
      const doc=this.repo.find(id);if(!doc)throw new Error("DDT_NOT_FOUND");
      if(doc.status!=="EMESSO")throw new Error("DDT_ALREADY_CANCELLED");
      this.notDeparted(doc.loadingSessionId);
      const cancelledAt=this.clock().toISOString();
      this.repo.db.prepare("UPDATE DdtDocuments SET status='ANNULLATO',cancelledAt=?,cancelledByOperatorId=?,cancellationReason=? WHERE id=? AND status='EMESSO'").run(cancelledAt,operatorId,reason.trim(),id);
      this.repo.db.prepare("INSERT INTO OperationalEvents(id,loadId,loadingSessionId,type,operatorId,timestamp,note) VALUES(?,?,?,'DDT_CANCELLED',?,?,?)").run(randomUUID(),doc.loadId,doc.loadingSessionId,operatorId,cancelledAt,JSON.stringify({ddtId:id,fullNumber:doc.fullNumber,reason:reason.trim()}));
      return this.repo.find(id)!;
    });
  }
}
