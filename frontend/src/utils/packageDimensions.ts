import type { Pacco } from "../models/Scanning";
export const hasPackageDimensions=(pack:Pacco)=>[pack.lunghezzaPacco,pack.larghezzaPacco,pack.altezzaPacco].every(value=>typeof value==="number"&&Number.isFinite(value)&&value>0);
export const formatPackageDimensions=(pack:Pacco)=>hasPackageDimensions(pack)?`${pack.lunghezzaPacco} × ${pack.larghezzaPacco} × ${pack.altezzaPacco} mm`:"Dimensioni non disponibili";
