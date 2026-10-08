import type { DocumentReference, ShipmentDocument } from "../models/ShipmentDocument";
export const documentNumber=(value:number,digits=1)=>value.toLocaleString("it-IT",{minimumFractionDigits:digits,maximumFractionDigits:digits});
export const documentMeasure=(value:number)=>value.toLocaleString("it-IT",{maximumFractionDigits:3});
export const documentDate=(value:string|null,time=false)=>value?new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",day:"2-digit",month:"2-digit",year:"numeric",...(time?{hour:"2-digit",minute:"2-digit"}: {})}).format(new Date(value)):"—";
export const documentReference=(value:DocumentReference|null)=>value?.label??(value?`Riferimento ${value.id} (nome storico non disponibile)`:"—");
export function prepareShipmentDocument(data:ShipmentDocument){
 const date=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(data.shippedAt));
 const safe=(value:string)=>value.replace(/[^\p{L}\p{N}_-]/gu,"_").slice(0,80);
 const transport=data.transportMode==="BILICO_ESSEPI"?"Bilico Essepi":data.transportMode==="RITIRA_CLIENTE"?"Ritira Cliente":data.transportMode==="TERZI_PER_ESSEPI"?"Terzi per Essepi":"—";
 return {...data,filename:`Scheda_Spedizione_${safe(data.order)}_${safe(data.truck)}_${date}`,transport,
  general:[['Commessa',data.order],['Cliente',data.customer],['Camion',data.truck],['Data spedizione',documentDate(data.shippedAt)],['Prima data prevista certificata',documentDate(data.firstPlannedDate)],['Modalità trasporto',transport],['Dettaglio trasporto',data.transportDetail??'—'],['Trasportatore',documentReference(data.carrier)],['Rimorchio Essepi',data.trailer?`${data.trailer.plate||'—'} - ${documentReference(data.trailer)}`:'—'],['Operatore avvio',documentReference(data.operators.start)],['Operatore chiusura',documentReference(data.operators.close)],['Operatore partenza',documentReference(data.operators.departure)]],
  summary:[['Elementi previsti',String(data.totals.expected)],['Elementi spediti',String(data.totals.shipped)],['Pacchi spediti',String(data.totals.packages)],['Peso totale',`${documentNumber(data.totals.weight)} kg`],['Volume totale',`${documentNumber(data.totals.volume,3)} m³`],['Permanenza in magazzino',data.totals.warehouseDays===null?'—':`${data.totals.warehouseDays} gg`]]};
}
export type PreparedShipmentDocument=ReturnType<typeof prepareShipmentDocument>;
