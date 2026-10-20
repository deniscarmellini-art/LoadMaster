import assert from 'node:assert/strict';
import test from 'node:test';
import {completedPastShipmentWeeks} from '../src/services/shipmentCalendarWeeks.ts';

const today='2026-10-20';
const item=(date,extra={})=>({id:date,plannedDepartureDate:date,actualDepartureDate:null,shipmentStatus:'PIANIFICATA',operationalStatus:'ATTESA_SPEDIZIONE',...extra});
const sent=date=>item(date,{actualDepartureDate:`${date}T09:00:00Z`});

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
