import * as XLSX from "xlsx";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { deliveryProgramColumns,deliveryProgramDisclaimer,type DeliveryProgram } from "./deliveryProgramModel";

// SheetJS CE preserves dates but does not serialize alignment. Extend only the
// generated archive's cell formats, retaining its number formats unchanged.
function wrapWorkbook(bytes:Uint8Array):Uint8Array {
  const files=unzipSync(bytes),path="xl/styles.xml",styles=strFromU8(files[path]!);
  const formats=styles.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/);
  if(!formats)throw new Error("Formato Excel non riconosciuto");
  const count=Number(formats[1]);
  const wrapped=formats[2]!.replace(/<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g,(_match,attributes:string,contents:string|undefined)=>
    `<xf${attributes.replace(/\sapplyAlignment="[^"]*"/g,"")} applyAlignment="1">${(contents??"").replace(/<alignment\b[^>]*\/>/g,"")}<alignment vertical="top" wrapText="1"/></xf>`);
  files[path]=strToU8(styles.replace(formats[0],`<cellXfs count="${count*2}">${formats[2]}${wrapped}</cellXfs>`));
  const sheet="xl/worksheets/sheet1.xml";
  files[sheet]=strToU8(strFromU8(files[sheet]!).replace(/<c\b([^>]*)>/g,(_match,attributes:string)=>{
    const original=Number(attributes.match(/\bs="(\d+)"/)?.[1]??0);
    return `<c${attributes.replace(/\ss="\d+"/,"")} s="${original+count}">`;
  }));
  return zipSync(files,{level:6});
}

export function deliveryProgramExcelBytes(model:DeliveryProgram):Uint8Array {
  if(!model.rows.length)throw new Error("Nessuna spedizione da esportare");
  const widths=[16,18,28,25,19,55,24,24,65];
  const metadata=[['ESSEPI S.r.l. — Programma consegne'],['Trasportatore',model.options.carrierName??'Tutti (secondo i filtri selezionati)'],['Periodo',model.period],['Generato il',model.generatedLabel],[deliveryProgramDisclaimer],[],[...deliveryProgramColumns]];
  const data=model.rows.map(row=>row.values.map((value,index)=>index===0?(row.date?new Date(`${row.date}T00:00:00Z`):null):value));
  for(const row of [...metadata,...data])for(const value of row)if(typeof value==="string"&&value.length>32767)throw new Error("Una nota o un indirizzo supera il limite Excel di 32767 caratteri. Utilizzare il PDF.");
  const sheet=XLSX.utils.aoa_to_sheet([...metadata,...data],{cellDates:true,dateNF:'dd/mm/yyyy'});
  // Use numeric Excel dates in local calendar coordinates, independent of browser timezone.
  model.rows.forEach((row,index)=>{if(row.date)sheet[`A${index+8}`]={t:'n',v:(Date.parse(`${row.date}T00:00:00Z`)-Date.UTC(1899,11,30))/86400000,z:'dd/mm/yyyy'};});
  sheet['!cols']=widths.map(wch=>({wch}));
  sheet['!merges']=[...[0,4].map(r=>({s:{r,c:0},e:{r,c:8}})),...[1,2,3].map(r=>({s:{r,c:1},e:{r,c:8}}))];
  sheet['!rows']=[{hpt:26},{hpt:24},{hpt:24},{hpt:24},{hpt:26},{hpt:10},{hpt:30},...model.rows.map(row=>({hpt:Math.min(409,Math.max(34,...row.values.map((value,col)=>value.split('\n').reduce((lines,line)=>lines+Math.max(1,Math.ceil(line.length/(widths[col]!-3))),0)*15+8)))}))];
  sheet['!autofilter']={ref:`A7:I${model.rows.length+7}`};
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Programma consegne');
  return wrapWorkbook(new Uint8Array(XLSX.write(book,{type:'array',bookType:'xlsx',compression:true})));
}
