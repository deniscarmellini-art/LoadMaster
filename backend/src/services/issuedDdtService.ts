import type { DatabaseSync } from "node:sqlite";
import { DefinitiveDdtRepository } from "../repositories/definitiveDdtRepository.js";
import { DefinitiveDdtService, type DdtIssuanceContext } from "./definitiveDdtService.js";
import { readPreview, type DdtPreview } from "../repositories/ddtPreviewRepository.js";
import { renderDefinitiveDdt, ddtConditions, ddtIssuer } from "./ddtPreviewPdf.js";
import { LoadingRepository } from "../repositories/loadingRepository.js";
import { deriveOperationalLoadStatus } from "../repositories/operationalLoadStatus.js";
import { ApiError } from "../utils/apiError.js";
import { recognizeCustomer } from "../repositories/customerRecognition.js";

export class IssuedDdtService {
  readonly repo:DefinitiveDdtRepository;
  readonly documents:DefinitiveDdtService;
  constructor(private readonly db:DatabaseSync){this.repo=new DefinitiveDdtRepository(db);this.documents=new DefinitiveDdtService(this.repo,"test");}
  private model(sessionId:string,now:Date):DdtPreview {
    const session=this.db.prepare("SELECT * FROM LoadingSessions WHERE id=?").get(sessionId);
    if(!session)throw new ApiError(404,"RESOURCE_NOT_FOUND","Carico non trovato");
    const last=this.db.prepare("SELECT type FROM OperationalEvents WHERE loadingSessionId=? AND (type IN ('LOADING_CLOSURE_CONFIRMED','LOADING_REOPENED','UNIT_UNLOADED') OR (type='LOADING_COMPLETED' AND note IS NULL)) ORDER BY rowid DESC LIMIT 1").get(sessionId);
    if(session.stato!=="ATTESA_SPEDIZIONE"||session.shippedAt||!session.completedAt||!last||!["LOADING_CLOSURE_CONFIRMED","LOADING_COMPLETED"].includes(String(last.type)))throw new ApiError(409,"DDT_CLOSED_LOAD_REQUIRED","Completare formalmente il carico prima di emettere il DDT.");
    if(deriveOperationalLoadStatus(this.db,String(session.loadId))!=="ATTESA_SPEDIZIONE"||!new LoadingRepository(this.db).isComplete(sessionId,String(session.loadId)))throw new ApiError(409,"DDT_LOADING_INCOMPLETE","Materiale o assegnazioni del carico non coerenti con la chiusura.");
    const plans=this.db.prepare("SELECT id FROM ShipmentPlans WHERE loadId=?").all(String(session.loadId));
    if(plans.length!==1)throw new ApiError(422,"DDT_PLANNING_REQUIRED","Collegare una sola pianificazione identificata tramite loadId.");
    const model=readPreview(this.db,sessionId,now,true);
    const count=this.db.prepare("SELECT COUNT(*) n FROM Panels WHERE loadId=? AND stato='CARICATO'").get(String(session.loadId))!;
    if(count.n!==model.totals.elements)throw new ApiError(409,"DDT_LOADING_INCOMPLETE","La composizione caricata non corrisponde al materiale effettivo.");
    return model;
  }
  status(sessionId:string){
    this.db.exec("BEGIN DEFERRED");
    try{
      const current=this.repo.valid(sessionId);
      const history=this.repo.history(sessionId),departed=this.repo.hasDeparted(sessionId);
      if(current){this.db.exec("COMMIT");return {document:current,history,canCancel:!departed,departed,canIssue:false,reason:"Carico bloccato da un DDT valido."};}
      try{const model=this.model(sessionId,new Date());renderDefinitiveDdt(model);this.db.exec("COMMIT");return {document:null,history,canCancel:false,departed,canIssue:true};}
      catch(error){if(error instanceof ApiError){this.db.exec("COMMIT");return {document:null,history,canCancel:false,departed,canIssue:false,reason:error.message};}throw error;}
    }catch(error){this.db.exec("ROLLBACK");throw error;}
  }
  issue(sessionId:string,operatorId:string,requestKey:string){
    return this.documents.issue(sessionId,operatorId,(context:DdtIssuanceContext)=>{
      const model=this.model(sessionId,new Date(context.issuedAt));
      model.reference=context.fullNumber;model.date=context.documentDate.split("-").reverse().join("/");
      const session=this.db.prepare("SELECT * FROM LoadingSessions WHERE id=?").get(sessionId)!;
      const plan=this.db.prepare("SELECT * FROM ShipmentPlans WHERE loadId=?").get(String(session.loadId))!;
      const recognized=recognizeCustomer(this.db,String(session.cliente??""));
      const customerId=plan.customerId??(recognized.status==="UNIQUE"?recognized.customerId:null);
      const customer=customerId?this.db.prepare("SELECT * FROM Customers WHERE id=?").get(String(customerId)):null;
      const load=this.db.prepare("SELECT * FROM Loads WHERE id=?").get(String(session.loadId));
      const units=this.db.prepare("SELECT * FROM LoadingUnits WHERE loadingSessionId=? AND active=1 ORDER BY id").all(sessionId);
      const panels=this.db.prepare("SELECT * FROM Panels WHERE loadId=? AND stato='CARICATO' ORDER BY id").all(String(session.loadId));
      const packages=this.db.prepare("SELECT * FROM Packages WHERE id IN (SELECT packageId FROM LoadingUnits WHERE loadingSessionId=? AND active=1 AND packageId IS NOT NULL) ORDER BY id").all(sessionId);
      const carrier=session.carrierId?this.db.prepare("SELECT * FROM Carriers WHERE id=?").get(String(session.carrierId)):null;
      const trailer=session.trailerId?this.db.prepare("SELECT * FROM Trailers WHERE id=?").get(String(session.trailerId)):null;
      return {model:{...model,kind:"DDT_DEFINITIVO"},session,load,plan,customer,units,panels,packages,carrier,trailer,template:{version:"ESSEPI_V3",issuer:ddtIssuer,conditions:ddtConditions}};
    },snapshot=>renderDefinitiveDdt((snapshot.data as {model:Omit<DdtPreview,"kind">}).model).pdf,requestKey);
  }
}
