import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import logoUrl from "../assets/essepi-logo-print.png";
import { documentDate,documentNumber,documentMeasure, type PreparedShipmentDocument } from "./shipmentDocumentModel";
export async function loadDocumentLogo(){const response=await fetch(logoUrl);if(!response.ok)throw Error("Logo ESSEPI non disponibile");const blob=await response.blob();return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error("Logo non leggibile"));reader.readAsDataURL(blob);});}
export function createShipmentPdf(model:PreparedShipmentDocument,logo:string|Uint8Array){
 const doc=new jsPDF({format:"a4",unit:"mm",compress:true});const ink:[number,number,number]=[30,58,76];
 doc.setProperties({title:`Scheda spedizione ${model.order} ${model.truck}`,subject:"Scheda spedizione - documento operativo",author:"ESSEPI S.r.l."});
 const image=doc.getImageProperties(logo);const height=Math.min(25,38*image.height/image.width),width=height*image.width/image.height;
 doc.addImage(logo,"PNG",15,12,width,height);doc.setTextColor(...ink);doc.setFont("helvetica","bold");doc.setFontSize(20);doc.text("SCHEDA SPEDIZIONE",55,23);
 doc.setFontSize(12);doc.text(`Commessa ${model.order} - Camion ${model.truck}`,55,32);
 doc.setDrawColor(...ink);doc.line(15,43,195,43);
 autoTable(doc,{startY:49,margin:{left:15,right:15,bottom:18},body:model.general.map(row=>row.map(value=>value.replaceAll('—','-'))),theme:"plain",styles:{fontSize:10,cellPadding:2.5,textColor:ink},columnStyles:{0:{cellWidth:60,fontStyle:"bold"},1:{cellWidth:120}},rowPageBreak:"avoid"});
 const end=(doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY;
 autoTable(doc,{startY:end+7,margin:{left:15,right:15,bottom:18},head:[["Riepilogo spedizione","Quantità"]],body:model.summary,theme:"striped",headStyles:{fillColor:ink},styles:{fontSize:10,cellPadding:2.5},columnStyles:{0:{cellWidth:120},1:{cellWidth:60}},rowPageBreak:"avoid"});
 let y=(doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY+8;
 if(y>255){doc.addPage();y=24;}
 doc.setFont("helvetica","normal");doc.setFontSize(9);doc.text("Distinta completa degli elementi nelle pagine successive.",15,y);doc.text("Documento operativo. Non costituisce un DDT ufficiale.",15,y+6);
 if(model.warnings.length)autoTable(doc,{startY:y+12,head:[["Informazioni storiche"]],body:model.warnings.map(w=>[w]),theme:"plain",margin:{left:15,right:15,top:20,bottom:20},styles:{fontSize:8.5,cellPadding:2},headStyles:{textColor:ink},rowPageBreak:"avoid"});
 doc.addPage();
 autoTable(doc,{startY:26,margin:{top:26,left:15,right:15,bottom:20},head:[["Elemento","Codice pacco","Master panel","Spessore\nmm","Dimensioni\nmm","Peso\nkg","Volume\nm³"]],body:model.elements.map(e=>[e.number,e.packageCode??"-",e.masterPanel,documentMeasure(e.thickness),`${documentMeasure(e.length)} × ${documentMeasure(e.width)}`,documentNumber(e.weight),documentNumber(e.volume,3)]),foot:[[{content:"Totali",colSpan:5},documentNumber(model.totals.weight),documentNumber(model.totals.volume,3)]],showHead:"everyPage",showFoot:"lastPage",rowPageBreak:"avoid",theme:"striped",styles:{fontSize:9,cellPadding:2.3,overflow:"linebreak"},headStyles:{fillColor:ink},footStyles:{fillColor:[229,236,240],textColor:ink},columnStyles:{0:{cellWidth:21},1:{cellWidth:33},2:{cellWidth:29},3:{cellWidth:19,halign:"right"},4:{cellWidth:34},5:{cellWidth:22,halign:"right"},6:{cellWidth:22,halign:"right"}},didDrawPage:()=>{doc.setFont("helvetica","bold");doc.setFontSize(13);doc.setTextColor(...ink);doc.text("DISTINTA ELEMENTI SPEDITI",15,20);}});
 const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){doc.setPage(page);doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(95);doc.text(`Commessa ${model.order} - ${model.truck} - ${documentDate(model.shippedAt)}`,15,287);doc.text(`Pagina ${page} di ${pages}`,195,287,{align:"right"});}
 return doc;
}
