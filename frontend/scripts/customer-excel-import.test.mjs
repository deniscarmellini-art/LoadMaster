import assert from 'node:assert/strict';import test from 'node:test';import * as XLSX from 'xlsx';
import {parseCustomerWorkbook} from '../src/services/customerExcelImport.ts';
import {customerFields} from '../src/models/Customer.ts';
const headers=customerFields.map(([,label])=>label);
const buffer=(sheet,second)=>{const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Clienti');if(second)XLSX.utils.book_append_sheet(book,second,'Secondo');return XLSX.write(book,{type:'array',bookType:'xlsx'});};
test('client Excel: reordered/case-insensitive headers, formatted zeros and phone/tax strings',()=>{
 const labels=[...headers].reverse().map(h=>' '+h.toUpperCase()+' ');const values={Denominazione:'Cliente TEST',Via:'Via 1',Nazione:'IT',CAP:'00123',Luogo:'Roma',Telefono:'0039 001-22','Nome Contatto':'Contatto',Cellulare:'000123',eMail:'test@example.invalid','Partita IVA':'00123456789','Codice fiscale':'000CF'};
 const sheet=XLSX.utils.aoa_to_sheet([['Elenco clienti'],labels,[...headers].reverse().map(h=>values[h])]);
 const cap=headers.length-1-headers.indexOf('CAP');sheet[XLSX.utils.encode_cell({r:2,c:cap})]={t:'n',v:123,z:'00000'};
 const result=parseCustomerWorkbook(buffer(sheet));assert.equal(result.headerRow,2);assert.equal(result.rows[0].rowNumber,3);assert.equal(result.rows[0].data.cap,'00123');assert.equal(result.rows[0].data.telefono,'0039 001-22');assert.equal(result.rows[0].data.partitaIva,'00123456789');assert.equal(result.rows[0].data.codiceFiscale,'000CF');assert.deepEqual(result.rows[0].issues,[]);
});
test('client Excel: missing/duplicate/ambiguous headers rejected',()=>{
 assert.throws(()=>parseCustomerWorkbook(buffer(XLSX.utils.aoa_to_sheet([headers.slice(1)]))),/Intestazioni/);
 assert.throws(()=>parseCustomerWorkbook(buffer(XLSX.utils.aoa_to_sheet([[...headers,'CAP']]))),/duplicate/);
 const sheet=XLSX.utils.aoa_to_sheet([headers,['TEST']]);assert.throws(()=>parseCustomerWorkbook(buffer(sheet,sheet)),/Più/);
});
test('client Excel: blank rows skipped, incomplete rows retained, formulas/precision problems flagged',()=>{
 const sheet=XLSX.utils.aoa_to_sheet([headers,['TEST'],[],['','Via senza denominazione'],['Formula'],['Numero lungo']]);
 sheet.B5={t:'s',v:'Cached',f:'"Cached"'};sheet.J6={t:'n',v:1234567890123456};
 const result=parseCustomerWorkbook(buffer(sheet));assert.equal(result.rows.length,4);assert.equal(result.rows[1].data.denominazione,'');assert.ok(result.rows[2].issues.some(i=>i.includes('formula')));assert.ok(result.rows[3].issues.some(i=>i.includes('alterato')));
});
