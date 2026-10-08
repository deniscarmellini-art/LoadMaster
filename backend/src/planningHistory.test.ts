import test from 'node:test';
import assert from 'node:assert/strict';
import {certifiedRescheduling} from './repositories/planningHistory.js';
import {historyKpis} from './repositories/historyRepository.js';
const created={type:'SHIPMENT_PLAN_CREATED',timestamp:'2026-10-01T12:00:00Z',note:JSON.stringify({id:'p',loadId:'l',plannedDepartureDate:'2026-10-05',planningAuditVersion:1})};
const update=(before:string,after:string,day:number)=>({type:'SHIPMENT_PLAN_UPDATED',timestamp:`2026-10-0${day}T12:00:00Z`,note:JSON.stringify({before:{id:'p',loadId:'l',plannedDepartureDate:before},after:{plannedDepartureDate:after}})});
const plan={id:'p',date:'2026-10-05',original:'2026-10-05',changedAt:null};
const certify=(events:typeof created[],p:Parameters<typeof certifiedRescheduling>[3]=plan)=>certifiedRescheduling('l','2026-10-09T12:00:00Z',events,p);
test('Riprogrammazione: cronologia completa, cambi multipli, ritorno, salvataggio identico e lacune',()=>{
 assert.equal(certify([created]),false);
 const legacy={...created,note:JSON.stringify({id:'p',loadId:'l',plannedDepartureDate:'2026-10-05'})};
 assert.equal(certify([legacy]),null);
 assert.equal(certify([created,update('2026-10-05','2026-10-05',2)]),false);
 assert.equal(certify([created,update('2026-10-05','2026-10-06',2)],{...plan,date:'2026-10-06',changedAt:'2026-10-02T11:59:59.999Z'}),true);
 const reverted=[created,update('2026-10-05','2026-10-06',2),update('2026-10-06','2026-10-05',3)];
 assert.equal(certify(reverted,{...plan,changedAt:'2026-10-03T11:59:59.999Z'}),true);
 assert.equal(certify([]),null);
 assert.equal(certify([created],{...plan,id:null}),null);
 assert.equal(certify([created],{...plan,changedAt:'2026-10-02T12:00:00Z'}),null);
 assert.equal(certify([created,update('2026-10-06','2026-10-06',3)],{...plan,date:'2026-10-06',changedAt:'2026-10-02T12:00:00Z'}),null);
 assert.equal(certify([created,{...created,type:'SHIPMENT_PLAN_DELETED',timestamp:'2026-10-02T12:00:00Z'}]),null);
 assert.equal(certify([created,update('2026-10-05','2026-10-06',2)],{...plan,date:'2026-10-06',changedAt:'2026-10-04T12:00:00Z'}),null);
});
test('Scostamento: giorni assoluti, puntualità, anticipo, ritardo e denominatori indipendenti',()=>{
 const rows=['2026-10-05','2026-10-03','2026-10-08'].map((date,i)=>({shippedAt:date+'T12:00:00Z',historyMetrics:{originalPlannedDepartureDate:'2026-10-05',warehouseDays:null},rescheduled:i===0?false:i===1?true:null}));
 const k=historyKpis([...rows,{shippedAt:'2026-10-05T12:00:00Z',historyMetrics:{originalPlannedDepartureDate:null,warehouseDays:null},rescheduled:null}]);
 assert.equal(k.averageDeviationDays,5/3);assert.equal(k.programmed,3);assert.equal(k.planningCertified,2);assert.equal(k.rescheduled,1);assert.equal(k.rescheduledPercentage,50);
 assert.equal(historyKpis([]).averageDeviationDays,null);assert.equal(historyKpis([]).rescheduledPercentage,null);
});
