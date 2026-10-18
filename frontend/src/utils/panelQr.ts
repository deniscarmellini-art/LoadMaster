export type { PanelQrData, PackageQrData } from "../../../backend/src/utils/labelQr";
export { parsePanelQr, parsePackageQr, panelQrText, packageQrText } from "../../../backend/src/utils/labelQr";
export function parseOperationalQr(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized === "CHIUDI_SINGOLO" || normalized === "CHIUDI_PACCO" ? normalized : null;
}

export const packageWeight = (panels: { peso:number }[]) => panels.reduce((total,panel)=>total+panel.peso,0);
export const packageVolume = (panels: { volume:number }[]) => panels.reduce((total,panel)=>total+panel.volume,0);
export function nextPackageCode(packages:{codice:string}[], year=new Date().getFullYear()) {
  const max = packages.reduce((current,item)=>Math.max(current,Number(item.codice.match(/(\d+)$/)?.[1] ?? 0)),0);
  return `PK-${year}-${String(max+1).padStart(6,"0")}`;
}
