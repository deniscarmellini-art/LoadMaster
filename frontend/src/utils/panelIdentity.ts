export interface PanelIdentity{commessa:string;cliente:string;camion:string;numeroPannello:string}
const text=(value:unknown)=>String(value??"").trim().replace(/\s+/g," ");
const insensitive=(value:unknown)=>text(value).toLocaleUpperCase("it-IT");
const normalizeTruck=(value:unknown)=>insensitive(value).replace(/[‐‑‒–—−]/g,"-").replace(/\s*-\s*/g,"-").replace(/\s/g,"");
export const buildPanelKey=(panel:PanelIdentity)=>[text(panel.commessa),insensitive(panel.cliente),normalizeTruck(panel.camion),insensitive(panel.numeroPannello)].join("|");
export const isSamePanel=(left:PanelIdentity,right:PanelIdentity)=>buildPanelKey(left)===buildPanelKey(right);
