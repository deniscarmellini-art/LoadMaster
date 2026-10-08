type Event = {type:string;timestamp:string;note:string|null};
export interface PlanningEvidence {id:unknown;date:unknown;original:unknown;changedAt:unknown}
const day=(v:unknown):string|null|undefined=>{
 if(v===null||v===undefined||v==='')return null;
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return undefined;
 const parsed=new Date(`${v}T00:00:00Z`);if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==v)return undefined;
 return v;
};
// Unknown is deliberately distinct from a certified, unchanged planning history.
export function certifiedRescheduling(loadId:string,shippedAt:string,events:Event[],plan:PlanningEvidence):boolean|null {
 let id:string|undefined,date:string|null=null,first:string|null=null,changed=false,coverage=false;
 let lastEventTime=0,lastChangeWindow:[number,number]|undefined;
 for(const event of events){
  const at=Date.parse(event.timestamp);
  if(!Number.isFinite(at))return null;
  if(at>Date.parse(shippedAt))continue;
  try {
   const payload=JSON.parse(event.note??'null');
   if(event.type==='SHIPMENT_PLAN_CREATED'){
    if(id||payload?.loadId!==loadId||typeof payload.id!=='string')return null;
    id=payload.id;coverage=payload.planningAuditVersion===1;const initial=day(payload.plannedDepartureDate);if(initial===undefined)return null;
    date=initial;first=initial;
   }else if(event.type==='SHIPMENT_PLAN_UPDATED'){
    if(!id||payload?.before?.id!==id||payload.before.loadId!==loadId||day(payload.before.plannedDepartureDate)!==date||!payload.after||!('plannedDepartureDate' in payload.after))return null;
    const next=day(payload.after.plannedDepartureDate);if(next===undefined)return null;
    if(next!==date&&first){changed=true;lastChangeWindow=[lastEventTime,at];}
    date=next;first??=next;
   }else return null; // Deleted/recreated plans require additional immutable evidence.
   lastEventTime=at;
  }catch{return null;}
 }
 if(!id||!first||plan.id!==id||day(plan.date)!==date||day(plan.original)!==first)return null;
 if(!changed)return coverage&&plan.changedAt==null?false:null;
 const marker=typeof plan.changedAt==='string'?Date.parse(plan.changedAt):NaN;
 return lastChangeWindow&&marker>=lastChangeWindow[0]&&marker<=lastChangeWindow[1]?true:null;
}
