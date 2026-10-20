import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { ApiError } from "../utils/apiError.js";
import { DefinitiveDdtRepository } from "../repositories/definitiveDdtRepository.js";
import { LoadingRepository } from "../repositories/loadingRepository.js";
import { resolveLoadingTransport } from "../repositories/loadingTransport.js";
import { deriveOperationalLoadStatus } from "../repositories/operationalLoadStatus.js";
import { documentTransport } from "./documentTransport.js";
import type { ShipmentTransportType } from "../repositories/shipmentRepository.js";

type Row = Record<string, unknown>;
export interface HistoricalTransportInput {
  operatorId: string; transportMode: ShipmentTransportType; carrierId?: string;
  transportDetailId?: string; confirmed: boolean; revision: string;
}
const fields = (row: Row) => Object.fromEntries(["transportMode","carrierId","transportDetailId","transportDetailLabel"].map(key=>[key,row[key]??null]));

/** No reconciliation, assignment or material writes. Registered exclusively in TEST. */
export class HistoricalTransportService {
  constructor(private readonly db: DatabaseSync) {}
  status(id: string) {
    const session=this.db.prepare("SELECT * FROM LoadingSessions WHERE id=?").get(id);
    if(!session)throw new ApiError(404,"RESOURCE_NOT_FOUND","Carico non trovato");
    const closure=this.db.prepare("SELECT type,note FROM OperationalEvents WHERE loadingSessionId=? AND type IN ('LOADING_COMPLETED','LOADING_CLOSURE_CONFIRMED','LOADING_REOPENED','UNIT_UNLOADED') ORDER BY rowid DESC LIMIT 1").get(id);
    const missing=!session.transportMode || (session.transportMode!=="RITIRA_CLIENTE"&&!session.carrierId) || (session.transportMode==="TERZI_PER_ESSEPI"&&!session.transportDetailId);
    const candidate=Boolean(missing&&closure?.type==="LOADING_COMPLETED"&&closure.note===null&&session.stato==="ATTESA_SPEDIZIONE"&&session.completedAt&&!session.shippedAt);
    const assignments=this.db.prepare("SELECT * FROM TransportAssignments WHERE loadId=? AND releasedAt IS NULL").all(session.loadId as string);
    const trailer=session.trailerId?this.db.prepare("SELECT plate FROM Trailers WHERE id=?").get(session.trailerId as string):undefined;
    const load=this.db.prepare("SELECT stato FROM Loads WHERE id=?").get(session.loadId as string);
    const locked=Boolean(this.db.prepare("SELECT 1 FROM DdtDocuments WHERE status='EMESSO' AND (loadId=? OR loadingSessionId=?)").get(session.loadId as string,id));
    const departed=new DefinitiveDdtRepository(this.db).hasDeparted(id);
    let reason="";
    if(locked)reason="Carico bloccato da un DDT definitivo valido.";
    else if(departed)reason="Carico già spedito.";
    else if(!candidate)reason="Il carico non richiede il completamento storico dei dati di trasporto.";
    else if(load?.stato!=="ATTESA_SPEDIZIONE"||deriveOperationalLoadStatus(this.db,String(session.loadId))!=="ATTESA_SPEDIZIONE"||!new LoadingRepository(this.db).isComplete(id,String(session.loadId))
      ||this.db.prepare("SELECT 1 FROM Panels WHERE loadId=? AND stato<>'CARICATO' LIMIT 1").get(session.loadId as string)
      ||this.db.prepare("SELECT 1 FROM LoadingUnits u LEFT JOIN Panels p ON p.id=u.panelId LEFT JOIN Packages k ON k.id=u.packageId WHERE u.loadingSessionId=? AND u.active=1 AND ((u.unitType='PANEL' AND (p.id IS NULL OR p.loadId<>?)) OR (u.unitType='PACKAGE' AND (k.id IS NULL OR k.loadId<>? OR k.stato<>'CARICATO'))) LIMIT 1").get(id,session.loadId as string,session.loadId as string))reason="Materiale o stato del carico non coerenti con la chiusura storica.";
    else if(session.destinationType==="RIMORCHIO_ESSEPI") {
      if(!trailer||assignments.length!==1||assignments[0]!.trailerId!==session.trailerId||assignments[0]!.loadingSessionId!==id||assignments[0]!.stato!=="CARICATO"||assignments[0]!.departedAt||session.transportMode&&session.transportMode!=="BILICO_ESSEPI"||session.transportDetailId)reason="Rimorchio, assegnazione o modalità storica incongruenti: completamento non consentito.";
    }else if(session.destinationType!=="TRASPORTATORE"||session.trailerId||assignments.length||session.transportMode==="BILICO_ESSEPI")reason="Destinazione storica incongruente: completamento non consentito.";
    const revision=createHash("sha256").update(JSON.stringify({session,assignments,closure,load})).digest("hex");
    return {candidate:candidate&&!locked&&!departed,eligible:!reason,reason,revision,destinationType:String(session.destinationType),trailerPlate:trailer?String(trailer.plate):null,
      transportMode:(session.transportMode??(session.destinationType==="RIMORCHIO_ESSEPI"?"BILICO_ESSEPI":"")) as ShipmentTransportType|"",
      carrierId:session.carrierId as string|null,transportDetailId:session.transportDetailId as string|null};
  }
  complete(id: string,input: HistoricalTransportInput) {
    const repo=new DefinitiveDdtRepository(this.db);
    return repo.transaction(()=>{
      const status=this.status(id);
      if(!status.eligible)throw new ApiError(409,"HISTORICAL_TRANSPORT_BLOCKED",status.reason);
      if(status.revision!==input.revision)throw new ApiError(409,"HISTORICAL_TRANSPORT_CONFLICT","Dati cambiati: riaprire la finestra e verificare nuovamente.");
      if(input.confirmed!==true)throw new ApiError(400,"TRANSPORT_CONFIRMATION_REQUIRED","Confermare esplicitamente i dati di trasporto.");
      if(!this.db.prepare("SELECT 1 FROM Operators WHERE id=? AND active=1").get(input.operatorId))throw new ApiError(400,"INVALID_OPERATOR","Selezionare un operatore attivo.");
      const before=this.db.prepare("SELECT * FROM LoadingSessions WHERE id=?").get(id)!;
      if(before.transportMode&&before.transportMode!==input.transportMode || status.destinationType==="RIMORCHIO_ESSEPI"&&input.transportMode!=="BILICO_ESSEPI" || status.destinationType==="TRASPORTATORE"&&input.transportMode==="BILICO_ESSEPI")throw new ApiError(409,"INVALID_TRANSPORT_DETAIL","Modalità incompatibile con i dati storici.");
      if(before.carrierId&&input.carrierId!==before.carrierId || before.transportDetailId&&input.transportDetailId!==before.transportDetailId)throw new ApiError(409,"INVALID_TRANSPORT_DETAIL","I dati storici già registrati non possono essere sostituiti.");
      const carrier=input.carrierId?this.db.prepare("SELECT name,active FROM Carriers WHERE id=?").get(input.carrierId):undefined;
      if(input.carrierId&&(!carrier||!carrier.active))throw new ApiError(400,"INVALID_TRANSPORT_DETAIL","Selezionare un vettore attivo.");
      documentTransport(input.transportMode,input.carrierId,carrier as {name:unknown}|undefined);
      if(input.transportMode==="TERZI_PER_ESSEPI"&&!input.transportDetailId)throw new ApiError(400,"INVALID_TRANSPORT_DETAIL","Selezionare la modalità Terzi per Essepi.");
      const resolved=resolveLoadingTransport(this.db,String(before.loadId),{operatorId:String(before.operatorId),destinationType:status.destinationType as "RIMORCHIO_ESSEPI"|"TRASPORTATORE",transportMode:input.transportMode,carrierId:input.carrierId,transportDetailId:input.transportDetailId??null});
      if((resolved.trailerId??null)!==before.trailerId||resolved.destinationType!==before.destinationType)throw new ApiError(409,"INVALID_DESTINATION","Il completamento non può cambiare destinazione o rimorchio.");
      this.db.prepare("UPDATE LoadingSessions SET transportMode=COALESCE(transportMode,?),carrierId=COALESCE(carrierId,?),transportDetailId=COALESCE(transportDetailId,?),transportDetailLabel=COALESCE(transportDetailLabel,?) WHERE id=?").run(resolved.transportMode??null,resolved.carrierId??null,resolved.transportDetailId??null,resolved.transportDetailLabel??null,id);
      if(deriveOperationalLoadStatus(this.db,String(before.loadId))!=="ATTESA_SPEDIZIONE")throw new ApiError(409,"INVALID_STATUS","Il completamento renderebbe incoerente il carico chiuso.");
      const after=this.db.prepare("SELECT * FROM LoadingSessions WHERE id=?").get(id)!;
      const confirmedAt=new Date().toISOString();
      this.db.prepare("INSERT INTO OperationalEvents(id,loadId,loadingSessionId,type,operatorId,timestamp,note) VALUES(?,?,?,'HISTORICAL_TRANSPORT_CONFIRMED',?,?,?)").run(randomUUID(),String(before.loadId),id,input.operatorId,confirmedAt,JSON.stringify({version:1,confirmedAt,before:fields(before),after:fields(after),historical:{destinationType:before.destinationType,trailerId:before.trailerId},source:"EXPLICIT_OPERATOR_CONFIRMATION",planningUsed:false}));
      return {transportMode:after.transportMode,carrierId:after.carrierId,transportDetailId:after.transportDetailId,transportDetailLabel:after.transportDetailLabel,confirmedAt};
    });
  }
}
