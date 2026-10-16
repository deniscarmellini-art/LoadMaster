import * as XLSX from "xlsx";
import { customerFields,emptyCustomer,type CustomerImportRow } from "../models/Customer";

const key=(value:string)=>value.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/[^a-z0-9]/g,"");
export function parseCustomerWorkbook(buffer:ArrayBuffer){
 const workbook=XLSX.read(buffer,{cellText:true,cellDates:false,cellNF:true});
 const candidates:Array<{sheet:string;header:number;columns:Map<string,number>}>=[];
 for(const sheetName of workbook.SheetNames){
  const sheet=workbook.Sheets[sheetName]!;const range=XLSX.utils.decode_range(sheet["!ref"]??"A1");
  if(range.e.c-range.s.c>100||range.e.r-range.s.r>10050)throw new Error("Foglio troppo esteso: massimo 100 colonne e 10.000 clienti");
  for(let r=range.s.r;r<=Math.min(range.e.r,range.s.r+29);r++){
   const columns=new Map<string,number>();let duplicate=false;
   for(let c=range.s.c;c<=range.e.c;c++){const cell=sheet[XLSX.utils.encode_cell({r,c})];const label=key(String(cell?.w??cell?.v??""));if(customerFields.some(([,title])=>key(title)===label)){if(columns.has(label))duplicate=true;columns.set(label,c);}}
   if(customerFields.every(([,label])=>columns.has(key(label)))){if(duplicate)throw new Error("Intestazioni duplicate: correggere il file prima dell'importazione");candidates.push({sheet:sheetName,header:r,columns});}
  }
 }
 if(candidates.length!==1)throw new Error(candidates.length?"Più intestazioni o fogli compatibili: fornire un solo elenco clienti per file":"Intestazioni non riconosciute: sono richieste tutte le 11 colonne dell'anagrafica clienti");
 const candidate=candidates[0]!,sheet=workbook.Sheets[candidate.sheet]!,range=XLSX.utils.decode_range(sheet["!ref"]!);
 const rows:CustomerImportRow[]=[];
 for(let r=candidate.header+1;r<=range.e.r;r++){
  const data=emptyCustomer(),issues:string[]=[],warnings:string[]=[];
  for(const [field,label] of customerFields){
   const cell=sheet[XLSX.utils.encode_cell({r,c:candidate.columns.get(key(label))!})];
   if(!cell)continue;
   if(cell.f)issues.push(`${label}: formula da sostituire con un valore verificato`);
   if(cell.t==="e")issues.push(`${label}: errore Excel`);
   data[field]=String(cell.w??XLSX.utils.format_cell(cell)??cell.v??"").trim();
   if(cell.t==="n"&&["cap","telefono","cellulare","partitaIva","codiceFiscale"].includes(field)){
    if(!Number.isSafeInteger(cell.v as number)||/e[+-]?\d+/i.test(data[field])||String(Math.abs(cell.v as number)).length>15)issues.push(`${label}: numero potenzialmente alterato da Excel, usare celle di testo`);
    else if(!cell.z||cell.z==="General")warnings.push(`${label}: origine numerica, gli zeri non memorizzati nel file non possono essere recuperati`);
   }
  }
  if(customerFields.every(([field])=>!data[field])&&!issues.length)continue;
  rows.push({rowNumber:r+1,data,issues,warnings});
 }
 if(!rows.length)throw new Error("Nessun cliente presente nel file");
 if(rows.length>10000)throw new Error("Massimo 10.000 clienti per importazione");
 return {sheet:candidate.sheet,headerRow:candidate.header+1,rows};
}
