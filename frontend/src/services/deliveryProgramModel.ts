import type { ShipmentItem } from "./shipmentsApi";
import type { ShipmentListDetail } from "./shipmentListFilters";
import { plannedDateKey } from "./shipmentListFilters";
import { shipmentHasDeparted } from "./shipmentDeparture";
import { shipmentTransportLabel } from "./shipmentTransportPresentation";

export const deliveryProgramColumns=["Data prevista","Commessa","Cliente","Riferimento ordine","Camion / Carico","Indirizzo di consegna","Modalità di trasporto","Tipo di mezzo","Note"] as const;
export const deliveryProgramDisclaimer="Documento di pianificazione — non sostituisce il DDT";
export interface DeliveryProgramOptions {from:string;to:string;carrierId?:string;carrierName?:string;generatedAt:string}
export interface DeliveryProgramRow {id:string;date:string|null;values:string[]}
export interface DeliveryProgram {rows:DeliveryProgramRow[];options:DeliveryProgramOptions;period:string;generatedLabel:string;filename:string}
const text=(value:string|null|undefined)=>value?.trim()?value:"—";
export const programDate=(value:string|null)=>value?value.split("-").reverse().join("/"):"—";

/** Receives precisely the filtered list, before screen sorting/pagination. Never mutates it. */
export function prepareDeliveryProgram(filtered:readonly ShipmentItem[],details:ReadonlyMap<string,ShipmentListDetail>,options:DeliveryProgramOptions):DeliveryProgram {
  if(options.carrierId&&!options.carrierName?.trim())throw new Error("Nome del trasportatore selezionato non disponibile. Aggiornare l'Elenco.");
  const rows=filtered.filter(item=>!shipmentHasDeparted(item))
    .map((item,index)=>({item,index,date:plannedDateKey(item.plannedDepartureDate)}))
    // Defensive period check also protects standalone callers of the exporter.
    .filter(({date})=>(!options.from||!!date&&date>=options.from)&&(!options.to||!!date&&date<=options.to))
    .sort((a,b)=>(a.date??"9999-99-99").localeCompare(b.date??"9999-99-99")||a.index-b.index)
    .map(({item,date})=>{
      const detail=details.get(item.id);
      if(!detail)throw new Error("Dati della pianificazione non disponibili. Aggiornare l'Elenco.");
      return {id:item.id,date,values:[programDate(date),text(item.commessa),text(item.cliente),text(item.orderReference),text(item.camion),text(item.deliveryAddress),shipmentTransportLabel(detail.mode),detail.vehicleType,text(item.notes)]};
    });
  if(!rows.length)throw new Error("Nessuna spedizione da esportare con i filtri selezionati. Le spedizioni già partite sono sempre escluse.");
  const generated=new Date(options.generatedAt);
  if(!Number.isFinite(generated.getTime()))throw new Error("Data di generazione non valida");
  const generatedLabel=new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(generated);
  const period=options.from&&options.to?`Dal ${programDate(options.from)} al ${programDate(options.to)}`:options.from?`Dal ${programDate(options.from)} · senza limite finale`:options.to?`Fino al ${programDate(options.to)}`:"Tutte le date · comprese le pianificazioni senza data";
  return {rows,options:{...options},period,generatedLabel,filename:`Programma_consegne_${options.generatedAt.slice(0,10)}`};
}
