import assert from 'node:assert/strict';
import test from 'node:test';
import {completedPastShipmentWeeks,shipmentCalendarAnchoredScrollTop,shipmentCalendarVisibleMonth,shipmentCalendarWeeks} from '../src/services/shipmentCalendarWeeks.ts';

const today='2026-10-20';
const item=(date,extra={})=>({id:date,plannedDepartureDate:date,actualDepartureDate:null,shipmentStatus:'PIANIFICATA',operationalStatus:'ATTESA_SPEDIZIONE',...extra});
const sent=date=>item(date,{actualDepartureDate:`${date}T09:00:00Z`});

test('calendario continuo: ottobre, novembre e dicembre senza settimane duplicate',()=>{
 const weeks=shipmentCalendarWeeks('2026-10','2026-12');
 const dates=weeks.flatMap(week=>week.days);
 assert.equal(new Set(dates).size,dates.length);
 for(let index=1;index<weeks.length;index++)
  assert.equal(Date.parse(`${weeks[index].days[0]}T00:00:00Z`)-Date.parse(`${weeks[index-1].days.at(-1)}T00:00:00Z`),2*24*60*60*1000);
 const octoberLast=weeks.find(week=>week.key==='2026-10-26');
 assert.deepEqual(octoberLast?.days,['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31']);
 assert.equal(weeks.find(week=>week.monthStart==='2026-11')?.key,'2026-11-02');
 assert.equal(weeks.find(week=>week.monthStart==='2026-12')?.key,'2026-11-30');
 assert.deepEqual(shipmentCalendarWeeks('2026-12','2026-10'),[]);
});

test('titolo calendario: settimana 26 ottobre resta ottobre con filtro completati attivo o disattivo',()=>{
 const week=shipmentCalendarWeeks('2026-09','2026-11').find(value=>value.key==='2026-10-26');
 assert.ok(week);
 assert.equal(week.monthStart,null);
 // Il marcatore di settembre è su un'altra settimana e non deve prevalere.
 assert.equal(shipmentCalendarVisibleMonth(week.days[0],null),'2026-10');
 assert.equal(shipmentCalendarVisibleMonth(week.days[1],null),'2026-10');
});

test('titolo calendario: usa il cambio mese solo se appartiene alla cella visibile',()=>{
 const weeks=shipmentCalendarWeeks('2026-09','2026-12');
 const octoberStartWeek=weeks.find(week=>week.monthStart==='2026-10');
 assert.ok(octoberStartWeek);
 assert.equal(shipmentCalendarVisibleMonth(octoberStartWeek.days[0],octoberStartWeek.monthStart),'2026-10');
 assert.equal(shipmentCalendarVisibleMonth('2026-10-26',null),'2026-10');
});

test('cambio filtro: la settimana visibile mantiene la posizione della cella ancorata',()=>{
 const anchor={date:'2026-10-26',top:184};
 const newScrollTop=shipmentCalendarAnchoredScrollTop(1200,764,anchor.top);
 assert.equal(newScrollTop,1780);
 assert.equal(764-(newScrollTop-1200),anchor.top);
});

test('titolo segue avanti, indietro e cambio anno in base alla settimana visibile',()=>{
 const weeks=shipmentCalendarWeeks('2026-10','2027-01');
 const transitions=[
  ['2026-10-26','2026-10'],['2026-11-02','2026-11'],['2026-11-30','2026-12'],
  ['2026-12-28','2027-01'],['2026-11-30','2026-12'],['2026-11-02','2026-11'],['2026-10-26','2026-10'],
 ];
 for(const [weekKey,expectedMonth] of transitions){
  const week=weeks.find(value=>value.key===weekKey);
  assert.ok(week,`manca la settimana ${weekKey}`);
  const visibleMonth=shipmentCalendarVisibleMonth(week.days[0],week.monthStart);
  assert.equal(visibleMonth,expectedMonth,`titolo errato per ${weekKey}`);
 }
});

test('calendario: il mese corrente resta raggiungibile quando è preceduto da mesi caricati',()=>{
 const weeks=shipmentCalendarWeeks('2026-09','2026-11');
 assert.equal(weeks.filter(week=>week.monthStart==='2026-10').length,1);
 assert.equal(weeks.find(week=>week.monthStart==='2026-10')?.key,'2026-09-28');
 assert.equal(new Set(weeks.map(week=>week.key)).size,weeks.length);
});

test('calendario continuo: cambio anno e mese gennaio ancorato alla settimana visibile',()=>{
 const weeks=shipmentCalendarWeeks('2026-12','2027-01');
 const decemberLast=weeks.find(week=>week.key==='2026-12-28');
 assert.deepEqual(decemberLast?.days,['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02']);
 assert.equal(decemberLast?.monthStart,'2027-01');
 assert.equal(weeks.find(week=>week.key==='2027-01-04')?.ownerMonth,'2027-01');
});

test('calendario: settimana passata interamente spedita, mista e sola data trascorsa',()=>{
 const items=[sent('2026-10-05'),sent('2026-10-10'),sent('2026-10-12'),item('2026-10-13'),item('2026-09-30')];
 const before=structuredClone(items);
 assert.deepEqual([...completedPastShipmentWeeks(items,today)],['2026-10-05']);
 assert.deepEqual(items,before);
});

test('calendario: settimana corrente e settimane future sempre conservate, anche tutte spedite',()=>{
 assert.deepEqual([...completedPastShipmentWeeks([sent('2026-10-19'),sent('2026-10-20'),sent('2026-10-26'),sent('2026-11-02')],today)],[]);
 assert.deepEqual([...completedPastShipmentWeeks([sent('2026-10-18')],today)],['2026-10-12']);
});

test('calendario: settimane e mese senza spedizioni non sono completati',()=>{
 assert.equal(completedPastShipmentWeeks([],today).size,0);
 assert.equal(completedPastShipmentWeeks([item(null),item('invalid')],today).size,0);
});

test('calendario: domenica aperta impedisce di nascondere la settimana e confine mese coerente',()=>{
 assert.equal(completedPastShipmentWeeks([sent('2026-10-05'),item('2026-10-11')],today).size,0);
 assert.deepEqual([...completedPastShipmentWeeks([sent('2026-09-30'),sent('2026-10-03')],today)],['2026-09-28']);
});

test('calendario: usa la stessa evidenza di partenza del badge SPEDITA, non uno stato di preparazione',()=>{
 for(const extra of [{operationalStatus:'SPEDITO'},{shipmentStatus:'IN_VIAGGIO'},{shipmentStatus:'CONCLUSA'}])
  assert.deepEqual([...completedPastShipmentWeeks([item('2026-10-05',extra)],today)],['2026-10-05']);
 for(const extra of [{shipmentStatus:'PRONTA'},{operationalStatus:'ATTESA_SPEDIZIONE'},{shipmentStatus:'PIANIFICATA'}])
  assert.equal(completedPastShipmentWeeks([item('2026-10-05',extra)],today).size,0);
});
