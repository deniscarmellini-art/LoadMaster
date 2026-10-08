import type { DatabaseSync } from "node:sqlite";
import { certifiedPlanMetrics, type ShipmentHistoryMetrics } from "./shipmentHistoryMetrics.js";
import { certifiedRescheduling } from "./planningHistory.js";

export interface HistoryQuery { search?:string; from?:string; to?:string; client?:string; sort?:string; asc?:boolean; page?:number; pageSize?:number }
type Row = Record<string, unknown>;
const dayFormatter=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"});
const localDay=(value:string)=>dayFormatter.format(new Date(value));
export function historyKpis(rows:Array<{shippedAt:string;historyMetrics:ShipmentHistoryMetrics;rescheduled?:boolean|null}>) {
 let programmed=0,respected=0,certified=0,sum=0;
 for(const row of rows){const m=row.historyMetrics;if(m.originalPlannedDepartureDate){programmed++;if(m.originalPlannedDepartureDate===localDay(row.shippedAt))respected++;}if(m.warehouseDays!==null){certified++;sum+=m.warehouseDays;}}
 let deviation=0,planningCertified=0,rescheduled=0;
 for(const row of rows){const first=row.historyMetrics.originalPlannedDepartureDate;if(first)deviation+=Math.abs(Date.parse(localDay(row.shippedAt)+'T00:00:00Z')-Date.parse(first+'T00:00:00Z'))/86400000;if(typeof row.rescheduled==='boolean'){planningCertified++;if(row.rescheduled)rescheduled++;}}
 return {respected,programmed,percentage:programmed?respected/programmed*100:null,certified,averageDays:certified?sum/certified:null,averageDeviationDays:programmed?deviation/programmed:null,planningCertified,rescheduled,rescheduledPercentage:planningCertified?rescheduled/planningCertified*100:null};
}

// Read-only summary projection: no reconciliation or replay of availability events.
export function historyPage(db:DatabaseSync, query:HistoryQuery={}) {
  const rows=db.prepare(`SELECT s.*,l.commessa,l.cliente,l.camion,a.warehouseDays,p.id planId,p.plannedDepartureDate planDate,p.originalPlannedDepartureDate planOriginal,p.plannedDepartureDateChangedAt planChangedAt
    FROM LoadingSessions s JOIN Loads l ON l.id=s.loadId
    LEFT JOIN LoadMaterialAvailabilityShipments a ON a.loadId=s.loadId
    LEFT JOIN ShipmentPlans p ON p.loadId=s.loadId
    WHERE s.stato='SPEDITO' AND s.shippedAt IS NOT NULL`).all() as Row[];
  const clients=[...new Set(rows.map(r=>String(r.cliente)))].sort((a,b)=>a.localeCompare(b,"it"));
  const events=new Map<string,Array<{type:string;timestamp:string;note:string|null}>>();
  for(const event of db.prepare(`SELECT e.loadId,e.type,e.timestamp,e.note FROM OperationalEvents e
    JOIN LoadingSessions s ON s.loadId=e.loadId WHERE s.stato='SPEDITO'
    AND e.type IN ('SHIPMENT_PLAN_CREATED','SHIPMENT_PLAN_UPDATED','SHIPMENT_PLAN_DELETED') ORDER BY e.timestamp,e.id`).all() as Array<{loadId:string;type:string;timestamp:string;note:string|null}>) {
    const list=events.get(event.loadId)??[];list.push(event);events.set(event.loadId,list);
  }
  const counts=new Map((db.prepare(`SELECT u.loadingSessionId,
    SUM(CASE WHEN u.unitType='PACKAGE' THEN COALESCE(k.numeroPannelli,0) ELSE 1 END) panels,
    SUM(CASE WHEN u.unitType='PACKAGE' THEN 1 ELSE 0 END) packs,
    SUM(COALESCE(p.peso,k.pesoTotale,0)) weight,SUM(COALESCE(p.volume,k.volumeTotale,0)) volume
    FROM LoadingUnits u JOIN LoadingSessions s ON s.id=u.loadingSessionId
    LEFT JOIN Panels p ON p.id=u.panelId LEFT JOIN Packages k ON k.id=u.packageId
    WHERE u.active=1 AND s.stato='SPEDITO' GROUP BY u.loadingSessionId`).all() as Row[]).map(r=>[String(r.loadingSessionId),{panels:Number(r.panels),packs:Number(r.packs),weight:Number(r.weight),volume:Number(r.volume)}]));
  const departureOperators=new Map((db.prepare(`SELECT loadingSessionId,operatorId FROM OperationalEvents WHERE type='PARTENZA_CONFERMATA' ORDER BY timestamp DESC,id DESC`).all() as Row[]).map(r=>[String(r.loadingSessionId),r.operatorId]));
  const filtered=rows.filter(r=>{
    const day=localDay(String(r.shippedAt));return String(r.commessa).toLocaleLowerCase("it").includes((query.search??"").trim().toLocaleLowerCase("it"))&&(!query.from||day>=query.from)&&(!query.to||day<=query.to)&&(!query.client||r.cliente===query.client);
  }).map(r=>({...r,id:String(r.id),shippedAt:String(r.shippedAt),departureOperatorId:departureOperators.get(String(r.id))??r.operatorId,
    totals:counts.get(String(r.id))??{panels:0,packs:0,weight:0,volume:0},
    rescheduled:certifiedRescheduling(String(r.loadId),String(r.shippedAt),events.get(String(r.loadId))??[],{id:r.planId,date:r.planDate,original:r.planOriginal,changedAt:r.planChangedAt}),
    historyMetrics:certifiedPlanMetrics(String(r.loadId),String(r.shippedAt),(events.get(String(r.loadId))??[]).filter(e=>e.type!=='SHIPMENT_PLAN_DELETED'),{originalPlannedDepartureDate:null,warehouseDays:typeof r.warehouseDays==='number'&&Number.isInteger(r.warehouseDays)&&r.warehouseDays>=0?r.warehouseDays:null})}));
  const kpis=historyKpis(filtered);
  const key=query.sort??'date';const value=(r:typeof filtered[number]):string|number=>key==='date'?String(r.shippedAt):key in r.totals?r.totals[key as keyof typeof r.totals]:String((r as Row)[key]??r.shippedAt);
  filtered.sort((a,b)=>{const av=value(a),bv=value(b);return(typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'it'))*(query.asc?1:-1)||String(a.id).localeCompare(String(b.id));});
  const pageSize=Math.min(100,Math.max(1,query.pageSize??25));const page=Math.min(Math.max(0,query.page??0),Math.max(0,Math.ceil(filtered.length/pageSize)-1));
  return {rows:filtered.slice(page*pageSize,(page+1)*pageSize),total:filtered.length,page,pageSize,clients,kpis};
}
