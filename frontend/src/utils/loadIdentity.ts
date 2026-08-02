const text=(value:unknown)=>String(value??"").trim().replace(/\s+/g," ");
export const normalizeOrder=(value:unknown)=>text(value);
export const normalizeTruck=(value:unknown)=>text(value).toLocaleUpperCase("it-IT").replace(/[‐‑‒–—−]/g,"-").replace(/\s*-\s*/g,"-").replace(/\s/g,"");
export const buildLoadKey=(commessa:unknown,camion:unknown)=>`${normalizeOrder(commessa)}|${normalizeTruck(camion)}`;
