import type { ShipmentItem, ShipmentStatus, ShipmentTransportType } from "./shipmentsApi";
import type { shipmentListDetails } from "./shipmentListPresentation";

export type ShipmentListDetail=ReturnType<typeof shipmentListDetails>;
export interface ShipmentListFilters {search:string;status:ShipmentStatus|"";type:ShipmentTransportType|"";carrierFilter:string;from:string;to:string}
/** Calendar dates, including legacy ISO timestamps; do not compare a time against an inclusive end date. */
export function plannedDateKey(value:string|null):string|null {
  const match=value?.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  if(!match)return null;
  const date=new Date(`${match[1]}T00:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===match[1]?match[1]!:null;
}
export function filterShipmentList(items:readonly ShipmentItem[],details:ReadonlyMap<string,ShipmentListDetail>,filters:ShipmentListFilters):ShipmentItem[] {
  const {search,status,type,carrierFilter,from,to}=filters,q=search.trim().toLocaleUpperCase("it-IT");
  return items.filter(item=>{
    const date=plannedDateKey(item.plannedDepartureDate);
    return (!q||[item.commessa,item.cliente,item.camion].some(value=>value?.toLocaleUpperCase("it-IT").includes(q)))
      &&(!status||item.shipmentStatus===status)&&(!type||details.get(item.id)?.mode===type)
      &&(!carrierFilter||details.get(item.id)?.carrierId===carrierFilter)
      &&(!from||!!date&&date>=from)&&(!to||!!date&&date<=to);
  });
}
