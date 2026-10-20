import assert from 'node:assert/strict';
import test from 'node:test';
import {customerNameKey,searchCustomers,proposeCustomer} from '../src/services/customerNameMatching.ts';
const rd={id:'rd',denominazione:'RD CHALET S.R.L.',partitaIva:'00123456789'};
test('RD Chalet: case, spaces, punctuation and corporate suffixes',()=>{
 for(const name of ['RD Chalet','  rd  CHALET ','R.D. Chalet S.R.L.','RD Chalet SPA','RD Chalet S.N.C.','RD Chalet S.A.S.','RD Chalet SRLS'])assert.equal(customerNameKey(name),customerNameKey(rd.denominazione));
 assert.equal(proposeCustomer([rd],'RD Chalet'),rd);
 assert.equal(proposeCustomer([rd],'RD Cha'),null);
 assert.notEqual(customerNameKey('Spa Resort'),customerNameKey('Resort'));
 for(const name of ['', ' ', 'S.R.L.'])assert.equal(proposeCustomer([rd],name),null);
});
test('similar customers remain ambiguous, partial queries and tax identifiers are searchable',()=>{
 const similar={id:'other',denominazione:'RD Chalet Legnami SPA'};
 const duplicate={id:'dup',denominazione:'RD CHALET SPA'};
 for(const other of [similar,duplicate]){assert.equal(proposeCustomer([rd,other],'RD Chalet'),null);assert.equal(searchCustomers([other,rd],'rd cha').length,2);}
 assert.deepEqual(searchCustomers([rd],'chalet'),[rd]);assert.deepEqual(searchCustomers([rd],'001234'),[rd]);
 assert.deepEqual(searchCustomers([rd],'inesistente'),[]);
 const before=JSON.stringify(rd);searchCustomers([rd],'RD');proposeCustomer([rd],'RD Chalet');assert.equal(JSON.stringify(rd),before);
});
