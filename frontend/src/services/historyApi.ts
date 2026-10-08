import { apiRequest } from "./apiClient";
import { toLoad, type ApiSession } from "./loadingApi";
export interface HistoryTotals {panels:number;packs:number;weight:number;volume:number}
export interface HistoryKpis {respected:number;programmed:number;percentage:number|null;certified:number;averageDays:number|null;averageDeviationDays:number|null;planningCertified:number;rescheduled:number;rescheduledPercentage:number|null}
export interface HistoryResponse {rows:Array<ApiSession & {totals:HistoryTotals;departureOperatorId:string}>;total:number;page:number;pageSize:number;clients:string[];kpis:HistoryKpis}
export async function getHistory(params:Record<string,string>,signal:AbortSignal,operatorName:(id:string)=>string){
  const data=await apiRequest<HistoryResponse>(`/history?${new URLSearchParams(params)}`,{signal});
  return {...data,loads:data.rows.map(row=>({...toLoad({...row,units:[],events:[]},operatorName),operatore:operatorName(row.departureOperatorId)}))};
}
export const formatHistoryKpi=(value:number|null,suffix:string)=>value===null?"—":`${value.toLocaleString("it-IT",{minimumFractionDigits:1,maximumFractionDigits:1})}${suffix}`;
