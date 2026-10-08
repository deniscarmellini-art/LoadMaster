import type { PanelQrData } from "../../../backend/src/utils/labelQr";
export type { PanelQrData, PackageQrData } from "../../../backend/src/utils/labelQr";
export { parsePanelQr, parsePackageQr } from "../../../backend/src/utils/labelQr";
export function parseOperationalQr(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized === "CHIUDI_SINGOLO" || normalized === "CHIUDI_PACCO" ? normalized : null;
}

export function panelQrText(panel: PanelQrData) {
  return `C=${panel.commessa}|CL=${panel.cliente}|N=${panel.numeroPannello}|CA=${panel.camion}|S=${panel.spessore}|L=${panel.lunghezza}|H=${panel.altezza}|P=${panel.peso}`;
}
export const packageWeight = (panels: { peso:number }[]) => panels.reduce((total,panel)=>total+panel.peso,0);
export const packageVolume = (panels: { volume:number }[]) => panels.reduce((total,panel)=>total+panel.volume,0);
export const packageQrText = (code:string, order:string, client:string, truck:string, pieces:number, kg:number, mc:number) => `PK=${code}|C=${order}|CL=${client}|CA=${truck}|PZ=${pieces}|KG=${kg.toFixed(1)}|MC=${mc.toFixed(3)}`;
export function nextPackageCode(packages:{codice:string}[], year=new Date().getFullYear()) {
  const max = packages.reduce((current,item)=>Math.max(current,Number(item.codice.match(/(\d+)$/)?.[1] ?? 0)),0);
  return `PK-${year}-${String(max+1).padStart(6,"0")}`;
}
