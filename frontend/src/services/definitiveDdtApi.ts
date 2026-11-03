import { apiPdfRequest, apiRequest } from "./apiClient";
import { definitiveDdtEnabled } from "./ddtAvailability";
export interface IssuedDdt {id:string;fullNumber:string;documentDate:string;issuedAt:string;status:"EMESSO"|"ANNULLATO";cancelledAt?:string|null;cancelledByOperatorId?:string|null;cancellationReason?:string|null;replacedByDdtId?:string|null}
export interface DdtStatus {document:IssuedDdt|null;history:IssuedDdt[];canIssue:boolean;canCancel:boolean;departed:boolean;reason?:string}
const pending=new Map<string,Promise<IssuedDdt>>();
function requireDdt(){if(!definitiveDdtEnabled())throw new Error("DDT definitivi non disponibili in questo ambiente");}
export function issueDefinitiveDdt(sessionId:string,operatorId:string,requestKey:string):Promise<IssuedDdt>{
  requireDdt();const key=JSON.stringify([sessionId,requestKey]);const existing=pending.get(key);if(existing)return existing;
  const request=apiRequest<IssuedDdt>(`/loading-sessions/${encodeURIComponent(sessionId)}/ddt`,{method:"POST",body:JSON.stringify({operatorId,requestKey})}).finally(()=>pending.delete(key));
  pending.set(key,request);return request;
}
export function originalDdtPdf(id:string){requireDdt();return apiPdfRequest(`/ddt/${encodeURIComponent(id)}/pdf`);}
export function cancelDefinitiveDdt(id:string,operatorId:string,reason:string):Promise<IssuedDdt>{
  requireDdt();return apiRequest(`/ddt/${encodeURIComponent(id)}/cancel`,{method:"POST",body:JSON.stringify({operatorId,reason})});
}
export function definitiveDdtStatus(sessionId:string):Promise<DdtStatus>{
  requireDdt();return apiRequest(`/loading-sessions/${encodeURIComponent(sessionId)}/ddt`);
}
export interface DdtRequestStatus {status:"CONFIRMED"|"UNKNOWN";document:{id:string;fullNumber:string;status:"EMESSO"|"ANNULLATO"}|null}
export function definitiveDdtRequestStatus(sessionId:string,requestKey:string):Promise<DdtRequestStatus>{
  requireDdt();return apiRequest(`/loading-sessions/${encodeURIComponent(sessionId)}/ddt/requests/${encodeURIComponent(requestKey)}`);
}
export async function cancelDdtAndRefresh(id:string,operatorId:string,reason:string,sessionId:string):Promise<DdtStatus>{
  let failure:unknown;
  try{await cancelDefinitiveDdt(id,operatorId,reason);}catch(error){failure=error;}
  const status=await definitiveDdtStatus(sessionId);
  if(!status.history.some(doc=>doc.id===id&&doc.status==="ANNULLATO"))throw failure??new Error("Annullamento non confermato. Verificare lo stato del documento.");
  return status;
}

export function originalDdtPdfUrl(id:string){requireDdt();return `/api/ddt/${encodeURIComponent(id)}/pdf`;}
