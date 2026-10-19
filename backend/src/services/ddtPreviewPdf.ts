import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";
import type { DdtPreview } from "../repositories/ddtPreviewRepository.js";
import { ApiError } from "../utils/apiError.js";

const asset = (name: string) => readFileSync(fileURLToPath(new URL(`../../assets/ddt/${name}`, import.meta.url)));
const normal = asset("DejaVuSans.ttf").toString("base64");
const bold = asset("DejaVuSans-Bold.ttf").toString("base64");
const logo = asset("essepi-v3.png");
export const previewNotice = "ANTEPRIMA — NON VALIDO COME DDT";
// Exact wording from the approved V3; kept independent of operational/anagraphic data.
export const ddtConditions = [
  "1) La merce viaggia sempre a rischio e pericolo del committente.",
  "2) Eventuali reclami verranno presi in considerazione solo se comunicati entro e non oltre 8 giorni dal ricevimento della merce.",
  "3) Gli unici pagamenti riconosciuti sono quelli fatti direttamente alla ditta.",
  "4) Tutta la merce rimane di esclusiva proprietà della Essepi fino al pagamento totale della presente fattura.",
  "5) Per qualsiasi contestazione, unico foro è quello di Trento.",
  "6) In caso di ritardato pagamento verranno addebitati interessi al Prime Rate ABI maggiorati di 6 punti percentuali.",
];
export const ddtIssuer = {"name": "ESSEPI S.r.l.", "address": "Viale Degasperi 1/A  ·  38073 Cavedine (TN)", "taxAndPhone": "P. IVA / C.F. 01572950226  ·  Tel. +39 0461 569199", "contacts": "www.essepi.it  ·  info@essepi.it"} as const;
const green = "#24813F", ink = "#26352E", muted = "#68746D", line = "#D5E0DB";
const left = 34, right = 561.28, width = right - left, bottom = 700;
const columns = [34, 147, 194, 285, 396, 457, right];
export interface DdtPlacement { page: number; elementId: string; top: number; bottom: number; group: string }

/** Preview-only renderer. No numbering, persistence, departure or printing operations. */
export function renderDdtPreview(model: DdtPreview, compactContinuation = false) { return renderDdtLayout(model, false, compactContinuation); }

export function renderDefinitiveDdt(model: Omit<DdtPreview,"kind">, compactContinuation = false) { return renderDdtLayout(model, true, compactContinuation); }

function renderDdtLayout(model: Omit<DdtPreview,"kind">, definitive: boolean, compactContinuation: boolean): { pdf: Buffer; pages: number; placements: DdtPlacement[]; summaryPage: number } {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS("DejaVuSans.ttf", normal); doc.addFont("DejaVuSans.ttf", "V3", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", bold); doc.addFont("DejaVuSans-Bold.ttf", "V3", "bold");
  doc.setProperties({ title: `${definitive?"DDT":"Anteprima DDT"} ${model.order}`, subject: definitive?model.reference:previewNotice, author: "ESSEPI S.r.l." });
  const text = (value: string | string[], x: number, y: number, size = 9, strong = false, color = ink, align: "left" | "right" = "left") => {
    doc.setFont("V3", strong ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(color);
    doc.text(value, x, y, { align, lineHeightFactor: 1.35 });
  };
  const wrap = (value: string, maxWidth: number, size: number, strong = false): string[] => {
    doc.setFont("V3", strong ? "bold" : "normal"); doc.setFontSize(size);
    return doc.splitTextToSize(value, maxWidth) as string[];
  };
  const box = (x: number, y: number, w: number, h: number) => { doc.setDrawColor(line); doc.setLineWidth(.6); doc.rect(x, y, w, h); };
  const fill = (y: number, h: number, color: string) => { doc.setFillColor(color); doc.rect(left, y, width, h, "F"); };
  const half = 258.36, third = width / 3;
  const customerLines = wrap(model.customer, half-22, 10.3, true), vatLines = wrap(model.vat, width-half-22, 10.3, true);
  const customerHeight = Math.max(40, 27 + Math.max(customerLines.length, vatLines.length) * 14);
  const orderLines = wrap(model.order, third-22, 10.3, true);
  const referenceLines = wrap(model.orderReference, third-22, 10.3, true), truckLines = wrap(model.truck, third-22, 10.3, true);
  const identityY = 203 + customerHeight;
  const identityHeight = Math.max(40, 27 + Math.max(orderLines.length, referenceLines.length, truckLines.length) * 14);
  const destinationLines = wrap(model.destination, 268, 10.2), noteLines = wrap(model.notes, 205, 9);
  const addressY = identityY + identityHeight;
  const addressHeight = Math.max(76, 31 + Math.max(destinationLines.length * 14, noteLines.length * 12.2));
  const tableY = Math.max(333, addressY + addressHeight + 14);
  if (tableY > 510) throw new ApiError(422, "DDT_PREVIEW_TEXT_TOO_LONG", "Anteprima DDT: intestazione troppo lunga; ridurre i testi dei campi dell'intestazione per mantenere il layout V3 leggibile.");
  let page = 1;
  const pageTableY = () => compactContinuation && page > 1 ? 153 : tableY;
  const pageBottom = () => compactContinuation && page > 1 ? 790 : bottom;
  const header = () => {
    if(!definitive)text(previewNotice, right, 21, 8, true, "#A32D25", "right");
    doc.addImage(logo, "PNG", 34, 35, 85, 85);
    text(ddtIssuer.name, 133, 57, 12, true);
    text(ddtIssuer.address, 133, 73, 8.1);
    text(ddtIssuer.taxAndPhone, 133, 88, 8.1);
    text(ddtIssuer.contacts, 133, 103, 8.1);
    doc.setFillColor(green); doc.roundedRect(left, 124, width, 29, 4, 4, "F");
    text("DOCUMENTO DI TRASPORTO", 47, 144, 12, true, "#FFFFFF");
    if (!compactContinuation || page === 1) {
    box(left, 163, 258.36, 40); box(292.36, 163, width - 258.36, 40);
    text("NUMERO DDT", 45, 177, 8, true, muted); text(model.reference, 45, 195, 12, true);
    text("DATA DOCUMENTO", 303.36, 177, 8, true, muted); text(model.date, 303.36, 195, 10, true);
    const customerFields = [{x:left,w:half,label:"CLIENTE",lines:customerLines},{x:left+half,w:width-half,label:"PARTITA IVA",lines:vatLines}];
    for (const f of customerFields) { box(f.x, 203, f.w, customerHeight); text(f.label, f.x+11, 217, 8, true, muted); text(f.lines, f.x+11, 235, 10.3, true); }
    const fields = [{label:"NUMERO COMMESSA",lines:orderLines},{label:"RIFERIMENTO ORDINE",lines:referenceLines},{label:"NUMERO CAMION",lines:truckLines}];
    fields.forEach((f,i) => { const x=left+i*third; box(x,identityY,third,identityHeight); text(f.label,x+11,identityY+14,8,true,muted); text(f.lines,x+11,identityY+32,10.3,true); });
    box(left, addressY, 290, addressHeight); box(324, addressY, right-324, addressHeight);
    text("DESTINAZIONE MERCE", 45, addressY+18, 10, true, green); text(destinationLines, 45, addressY+39, 10.2);
    text("NOTE", 335, addressY+18, 10, true, green); text(noteLines, 335, addressY+39, 9);
    }
    const top = pageTableY();
    fill(top, 23, "#EDF5EF"); doc.setDrawColor(green); doc.line(left,top,right,top);
    ["N° ELEMENTO","Q.TÀ","MISURE (mm)","TIPOLOGIA","m²","PESO (kg)"].forEach((label,i)=>text(label,columns[i]!+7,top+15,7.4,true,green));
  };
  let y = tableY+23;
  const nextPage = () => { text("Segue dettaglio merce nella pagina successiva →", 42, pageBottom()-10, 7.8, true, muted); doc.addPage(); page++; header(); y=pageTableY()+23; };
  const groupHeader = (label: string, count: number, pack: boolean, continued: boolean) => {
    if (wrap(label+(continued?" (CONTINUA)":""),width-150,8.2,true).length>1)
      throw new ApiError(422,"DDT_PREVIEW_TEXT_TOO_LONG","Anteprima DDT: codice pacco troppo lungo per il layout V3.");
    fill(y,24,"#E3EFE7"); text(label+(continued?" (CONTINUA)":""),42,y+16,8.2,true,green);
    text(`${count} elementi ${pack?"nel pacco":"singoli"}`,right-8,y+16,7.5,true,green,"right"); y+=24;
  };
  const fmt = (n: number, digits = 2, minimum = 0) => n.toLocaleString("it-IT", { maximumFractionDigits: digits, minimumFractionDigits: minimum, useGrouping: "always" });
  const measure = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 2, useGrouping: false });
  const placements: DdtPlacement[] = [];
  header();
  for (const group of model.groups) {
    const rows = group.elements.map(p => {
      const values=[p.number,fmt(p.quantity),`${measure(p.length)} × ${measure(p.width)}`,p.type,fmt(p.area,2,2),fmt(p.weight)];
      const lines=values.map((v,i)=>wrap(v,columns[i+1]!-columns[i]!-14,7.6));
      return {p,lines,rowHeight:Math.max(19,Math.max(...lines.map(l=>l.length))*10.3+8)};
    });
    const nextTableY = compactContinuation ? 153 : tableY;
    const nextBottom = compactContinuation ? 790 : bottom;
    const groupHeight = 24 + rows.reduce((sum,row)=>sum+row.rowHeight,0);
    // Keep a complete package together when it fits on a fresh continuation page.
    if (compactContinuation && group.packageId && y+groupHeight>pageBottom()-18 && groupHeight<=nextBottom-18-(nextTableY+23)) nextPage();
    let continued = false;
    for (let index=0;index<group.elements.length;index++) {
      const {p,lines,rowHeight}=rows[index]!;
      if (rowHeight+24 > nextBottom-18-(nextTableY+23)) throw new ApiError(422,"DDT_PREVIEW_TEXT_TOO_LONG",`Anteprima DDT: descrizione troppo lunga per l'elemento ${p.number}.`);
      if (y+rowHeight+(index===0?24:0)>pageBottom()-18) { nextPage(); continued=!compactContinuation||index>0; }
      if(index===0||continued) { groupHeader(group.label,group.elements.length-index,!!group.packageId,continued); continued=false; }
      if(index%2===1)fill(y,rowHeight,"#F4F7F5");
      lines.forEach((l,i)=>text(l,i===1||i>=4?columns[i+1]!-8:columns[i]!+7,y+13,7.6,false,ink,i===1||i>=4?"right":"left"));
      placements.push({page,elementId:p.id,top:y,bottom:y+rowHeight,group:group.label}); y+=rowHeight;
    }
  }
  const carrierLines=wrap(model.carrier,174,9);
  const summaryHeight=90+Math.max(28,carrierLines.length*12.2+10);
  if(summaryHeight+(compactContinuation?18:0)>(compactContinuation?790:bottom)-((compactContinuation?153:tableY)+23))throw new ApiError(422,"DDT_PREVIEW_TEXT_TOO_LONG","Anteprima DDT: nominativo vettore troppo lungo.");
  if(y+18+summaryHeight>pageBottom())nextPage();
  y+=18; doc.setFillColor("#278044");doc.roundedRect(left,y,width,22,3,3,"F");text("RIEPILOGO E DATI DI TRASPORTO",42,y+15,8.5,true,"#FFFFFF");y+=22;
  const summary=[{x:left,w:184,label:"CAUSALE DEL TRASPORTO",value:"Vendita"},{x:218,w:183,label:"ASPETTO ESTERIORE DEI BENI",value:"A vista"},{x:401,w:78,label:"N. ELEMENTI",value:String(model.totals.elements)},{x:479,w:right-479,label:"PESO KG",value:fmt(model.totals.weight)}];
  for(const f of summary){box(f.x,y,f.w,40);text(f.label,f.x+8,y+13,6.5,true,muted);text(f.value,f.x+8,y+30,10,true);}y+=40;
  const transportHeight=Math.max(46,carrierLines.length*12.2+27);
  const transport=[{x:left,w:190,label:"VETTORE / CONDUCENTE"},{x:224,w:130,label:"DATA INIZIO TRASPORTO"},{x:354,w:45,label:"ORA"},{x:399,w:right-399,label:"FIRMA DEL CONDUCENTE"}];
  for(const f of transport){box(f.x,y,f.w,transportHeight);text(f.label,f.x+8,y+13,6.5,true,muted);}text(carrierLines,42,y+32,9);
  const summaryPage=page;
  for(let n=1;n<=page;n++){
    doc.setPage(n);text(`Pagina ${n} di ${page}`,right-13,143,8.5,true,"#FFFFFF","right");
    const shortFooter = compactContinuation && n > 1;
    doc.setDrawColor(green);doc.setLineWidth(1.2);doc.line(left,shortFooter?806:726,right,shortFooter?806:726);
    text("100% CERTIFICATO PEFC DNVSE-PEFC-COC-401",left,shortFooter?819:739,8,true);
    if (!compactContinuation || n === 1) {
      text("CONDIZIONI GENERALI DI VENDITA",left,752,6.6,true);
      ddtConditions.forEach((condition,i)=>text(condition,left,763+i*8.3,6.15));
    }
    text("CONTRIBUTO CONAI ASSOLTO OVE DOVUTO",left,shortFooter?832:820,6.8,true);
  }
  return { pdf: Buffer.from(doc.output("arraybuffer")), pages: page, placements, summaryPage };
}
