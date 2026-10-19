import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { IssuedDdtService } from "../services/issuedDdtService.js";
import { ApiError } from "../utils/apiError.js";
import { ddtContentDisposition } from "../services/ddtDownloadName.js";

export function definitiveDdtRoutes(app:FastifyInstance,db:DatabaseSync):void {
  const service=new IssuedDdtService(db);
  const convert=(error:unknown):never=>{
    if(error instanceof Error&&error.message.startsWith("DDT_")&&error.message!=="DDT_LOAD_LOCKED")throw new ApiError(error.message==="DDT_NOT_FOUND"?404:409,error.message,{
      DDT_ALREADY_VALID:"Esiste già un DDT valido per il carico.",DDT_ALREADY_DEPARTED:"Operazione non consentita dopo la partenza.",
      DDT_ACTIVE_OPERATOR_REQUIRED:"Selezionare un operatore attivo.",DDT_CANCELLATION_REASON_REQUIRED:"Indicare il motivo dell'annullamento.",
      DDT_ALREADY_CANCELLED:"Il DDT è già annullato.",DDT_CLOSED_LOAD_REQUIRED:"Completare formalmente il carico prima dell'emissione.",
      DDT_PDF_INTEGRITY_ERROR:"Integrità del PDF archiviato non verificata: ristampa bloccata.",
    }[error.message]??error.message);
    throw error;
  };
  app.get<{Params:{id:string}}>("/api/loading-sessions/:id/ddt",async(request,reply)=>{reply.header("Cache-Control","no-store");return service.status(request.params.id);});
  app.post<{Params:{id:string};Body:{operatorId:string;requestKey:string}}>("/api/loading-sessions/:id/ddt",{schema:{body:{type:"object",additionalProperties:false,required:["operatorId","requestKey"],properties:{operatorId:{type:"string",minLength:1},requestKey:{type:"string",minLength:16,maxLength:128,pattern:"^[a-zA-Z0-9-]+$"}}}}},async(request,reply)=>{
    reply.header("Cache-Control","no-store");try{return service.issue(request.params.id,request.body.operatorId,request.body.requestKey);}catch(error){return convert(error);}
  });
  app.get<{Params:{id:string};Querystring:{download?:string}}>("/api/ddt/:id/pdf",async(request,reply)=>{
    try{const doc=service.repo.find(request.params.id);if(!doc)throw new Error("DDT_NOT_FOUND");
      return reply.header("Cache-Control","no-store").header("Content-Disposition",ddtContentDisposition(doc.snapshotJson,request.query.download==="1")).header("X-DDT-Status",doc.status).type("application/pdf").send(service.repo.originalPdf(doc.id));
    }catch(error){return convert(error);}
  });
  app.post<{Params:{id:string};Body:{operatorId:string;reason:string}}>("/api/ddt/:id/cancel",{schema:{body:{type:"object",additionalProperties:false,required:["operatorId","reason"],properties:{operatorId:{type:"string",minLength:1},reason:{type:"string",minLength:1,maxLength:2000}}}}},async(request,reply)=>{
    reply.header("Cache-Control","no-store");try{return service.documents.cancel(request.params.id,request.body.operatorId,request.body.reason);}catch(error){return convert(error);}
  });
}
