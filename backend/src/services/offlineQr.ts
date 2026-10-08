import {parsePanelQr,parsePackageQr} from '../utils/labelQr.js';
export interface OfflineQrRow {line:number;raw:string;type:'PANEL'|'PACKAGE'|null;code:string;commessa:string;camion:string;elements:number;status:'VALID'|'DUPLICATE'|'ALREADY_LOADED'|'ERROR'|'LOADED';message:string;unitId?:string}
// The same label fields used by panelQrText/packageQrText and their parsers.
export function decodeLoadingQr(raw:string){
 if(raw.trim().startsWith('PK=')){const qr=parsePackageQr(raw);return qr?{type:'PACKAGE' as const,code:qr.codicePacco,commessa:qr.commessa,camion:qr.camion}:null;}
 const qr=parsePanelQr(raw);return qr?{type:'PANEL' as const,code:qr.numeroPannello,commessa:qr.commessa,camion:qr.camion}:null;
}
export const offlineLines=(text:string)=>text.split(/\r\n|\r|\n/).map(s=>s.trim()).filter(Boolean);
export function offlineCounts(rows:OfflineQrRow[]){const valid=rows.filter(r=>r.status==='VALID'||r.status==='LOADED');const loaded=rows.filter(r=>r.status==='LOADED');return{received:rows.length,valid:valid.length,packages:valid.filter(r=>r.type==='PACKAGE').length,singles:valid.filter(r=>r.type==='PANEL').length,elements:valid.reduce((s,r)=>s+r.elements,0),duplicates:rows.filter(r=>r.status==='DUPLICATE').length,errors:rows.filter(r=>r.status==='ERROR'||r.status==='ALREADY_LOADED').length,loaded:loaded.length,loadedElements:loaded.reduce((s,r)=>s+r.elements,0)};}
