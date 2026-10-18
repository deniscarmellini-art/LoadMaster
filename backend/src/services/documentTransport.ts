import { transportResponsibilityByMode } from "../models/transportResponsibility.js";
import { ApiError } from "../utils/apiError.js";

/** Document rule shared by preview and future issuance. Only actual session data. */
export function documentTransport(mode:unknown,carrierId:unknown,carrier?:{name:unknown}) {
  if(typeof mode!=="string"||!Object.hasOwn(transportResponsibilityByMode,mode))
    throw new ApiError(422,"DDT_PREVIEW_DATA_MISSING","DDT: modalità effettiva di trasporto non disponibile in Carico camion.");
  const rule=transportResponsibilityByMode[mode as keyof typeof transportResponsibilityByMode];
  if(mode==="RITIRA_CLIENTE")return {responsibility:rule.subject,responsibilityLabel:rule.label,carrierId:null,carrierName:null,documentText:rule.label};
  const name=typeof carrier?.name==="string"?carrier.name.trim():"";
  if(typeof carrierId!=="string"||!carrierId||!name)
    throw new ApiError(422,"DDT_PREVIEW_DATA_MISSING","DDT: vettore effettivo confermato non disponibile in Carico camion.");
  return {responsibility:rule.subject,responsibilityLabel:rule.label,carrierId,carrierName:name,documentText:`${rule.label}\n${name}`};
}
