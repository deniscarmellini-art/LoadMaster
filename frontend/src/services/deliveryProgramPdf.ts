import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import logoUrl from "../../../backend/assets/ddt/essepi-v3.png?url";
import regularFontUrl from "../../../backend/assets/ddt/DejaVuSans.ttf?url";
import boldFontUrl from "../../../backend/assets/ddt/DejaVuSans-Bold.ttf?url";
import { deliveryProgramColumns, deliveryProgramDisclaimer, type DeliveryProgram } from "./deliveryProgramModel";

export interface DeliveryProgramPdfAssets {logo:string|Uint8Array;regular:string;bold:string}
export async function loadDeliveryProgramAssets():Promise<DeliveryProgramPdfAssets> {
  const response=await fetch(logoUrl);
  if(!response.ok)throw new Error("Logo ESSEPI non disponibile. Impossibile generare il PDF.");
  const blob=await response.blob();
  const logo=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Logo ESSEPI non leggibile"));reader.readAsDataURL(blob);});
  const font=async(url:string)=>{const response=await fetch(url);if(!response.ok)throw new Error("Caratteri PDF non disponibili");const bytes=new Uint8Array(await response.arrayBuffer());let binary="";for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(binary);};
  const [regular,bold]=await Promise.all([font(regularFontUrl),font(boldFontUrl)]);
  return {logo,regular,bold};
}

export function createDeliveryProgramPdf(model:DeliveryProgram,{logo,regular,bold}:DeliveryProgramPdfAssets):jsPDF {
  if(!model.rows.length)throw new Error("Nessuna spedizione da esportare");
  const doc=new jsPDF({orientation:"landscape",format:"a4",unit:"mm",compress:true});
  doc.addFileToVFS("Program-Regular.ttf",regular);doc.addFont("Program-Regular.ttf","EssepiProgram","normal");
  doc.addFileToVFS("Program-Bold.ttf",bold);doc.addFont("Program-Bold.ttf","EssepiProgram","bold");doc.setFont("EssepiProgram","normal");
  const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight();
  // Same V3 resources, point dimensions, issuer wording and palette as the DDT.
  // Keep this browser renderer independent: importing the DDT service would load node:fs.
  const pt=(value:number)=>value*25.4/72;
  const left=pt(34),right=width-left,tableWidth=right-left;
  const green="#24813F",ink="#26352E",muted="#68746D",line="#D5E0DB";
  const text=(value:string|string[],x:number,y:number,size:number,strong=false,color=ink,align:"left"|"right"="left")=>{
    doc.setFont("EssepiProgram",strong?"bold":"normal");doc.setFontSize(size);doc.setTextColor(color);doc.text(value,x,y,{align,lineHeightFactor:1.35});
  };
  const half=tableWidth/2;
  const metadata=[
    [{label:"TRASPORTATORE DESTINATARIO",value:model.options.carrierName??"Tutti (secondo i filtri selezionati)"},{label:"PERIODO DI PIANIFICAZIONE",value:model.period}],
    [{label:"DATA E ORA DI GENERAZIONE",value:model.generatedLabel},{label:"CONSEGNE DA EFFETTUARE",value:String(model.rows.length)}],
  ].map(fields=>{
    doc.setFont("EssepiProgram","normal");doc.setFontSize(9.2);
    const cells=fields.map(field=>({...field,lines:doc.splitTextToSize(field.value,half-pt(22)) as string[]}));
    return {cells,height:Math.max(pt(40),pt(27)+Math.max(...cells.map(cell=>cell.lines.length))*pt(13))};
  });
  const top=pt(163)+metadata.reduce((sum,row)=>sum+row.height,0)+5;
  if(top>height-55)throw new Error("Intestazione della pianificazione troppo lunga per un PDF leggibile.");
  doc.setProperties({title:"Programma consegne",author:"ESSEPI S.r.l.",subject:deliveryProgramDisclaimer});
  const header=()=>{
    doc.addImage(logo,"PNG",left,pt(35),pt(85),pt(85));
    text("ESSEPI S.r.l.",pt(133),pt(57),12,true);
    text("Viale Degasperi 1/A  ·  38073 Cavedine (TN)",pt(133),pt(73),8.1);
    text("P. IVA / C.F. 01572950226  ·  Tel. +39 0461 569199",pt(133),pt(88),8.1);
    text("www.essepi.it  ·  info@essepi.it",pt(133),pt(103),8.1);
    doc.setFillColor(green);doc.roundedRect(left,pt(124),tableWidth,pt(29),pt(4),pt(4),"F");
    text("PROGRAMMA CONSEGNE",pt(47),pt(144),12,true,"#FFFFFF");
    let y=pt(163);
    for(const row of metadata){
      row.cells.forEach((cell,index)=>{
        const x=left+index*half;doc.setDrawColor(line);doc.setLineWidth(pt(.6));doc.rect(x,y,half,row.height);
        text(cell.label,x+pt(11),y+pt(14),8,true,muted);
        text(cell.lines,x+pt(11),y+pt(32),9.2);
      });
      y+=row.height;
    }
  };
  // Project eight columns only in the PDF. Excel and the shared model keep all nine.
  const indices=[0,1,2,3,4,5,7,8];
  doc.setFont("EssepiProgram","normal");doc.setFontSize(8.5);
  const referenceWidth=Math.min(46,Math.max(35,...model.rows.map(row=>doc.getTextWidth(row.values[3]??"—")+4.4)));
  const extra=referenceWidth-35;
  const widths=[24,24,30,referenceWidth,19,56-extra*.45,25,tableWidth-213-extra*.55];
  autoTable(doc,{
    head:[indices.map(index=>deliveryProgramColumns[index]!)],body:model.rows.map(row=>indices.map(index=>{
      const value=row.values[index]??"—";
      return index===5&&(!value.trim()||value.trim()==="—")
        ? {content:"INDIRIZZO MANCANTE",styles:{textColor:[156,39,28] as [number,number,number],fillColor:[255,237,222] as [number,number,number],fontStyle:"bold" as const}}
        : value;
    })),
    startY:top,margin:{top,bottom:17,left,right:left},tableWidth,
    theme:"striped",showHead:"everyPage",rowPageBreak:"avoid",
    styles:{font:"EssepiProgram",fontSize:8.5,cellPadding:2.2,overflow:"linebreak",valign:"top",lineColor:[220,228,222],lineWidth:.1,textColor:[35,45,39]},
    headStyles:{fillColor:green,textColor:255,fontStyle:"bold",fontSize:8.5},
    alternateRowStyles:{fillColor:[243,247,244]},
    columnStyles:Object.fromEntries(widths.map((cellWidth,index)=>[index,{cellWidth}])),
    didParseCell:({section,column,cell})=>{
      if(section!=="body"||column.index!==3)return;
      // Keep a reference on one line when a small, bounded reduction is sufficient.
      doc.setFont("EssepiProgram","normal");doc.setFontSize(8.5);
      const natural=doc.getTextWidth(String(cell.raw??""));
      if(natural>referenceWidth-4.4)cell.styles.fontSize=Math.max(7.3,8.5*(referenceWidth-4.4)/natural);
    },
    willDrawPage:header,
  });
  const total=doc.getNumberOfPages();
  for(let page=1;page<=total;page++){
    doc.setPage(page);doc.setFont("EssepiProgram","normal");doc.setFontSize(8);doc.setTextColor(80);
    doc.setDrawColor(210);doc.setLineWidth(.2);doc.line(left,height-13,right,height-13);
    doc.text(deliveryProgramDisclaimer,left,height-8);
    text(`Pagina ${page} di ${total}`,right-pt(13),pt(143),8.5,true,"#FFFFFF","right");
  }
  return doc;
}
