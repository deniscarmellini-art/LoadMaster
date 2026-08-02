import type { Pacco,UnitaSingola } from "../models/Scanning";
import type { Pannello } from "../types/excel";
import { apiRequest } from "./apiClient";
import { toPanel,type ApiPanel } from "./loadsApi";

interface ApiPackage{id:string;codicePacco:string;loadId:string;commessa:string;cliente:string;camion:string;stato:Pacco["stato"];numeroPannelli:number;pesoTotale:number;volumeTotale:number;lunghezzaPacco:number|null;larghezzaPacco:number|null;altezzaPacco:number|null;operatoreId:string;openedAt:string;closedAt:string|null;pannelli:ApiPanel[];}
interface ApiWarehouse{singles:ApiPanel[];packages:ApiPackage[];openPackages:ApiPackage[];}
export interface ScanningSnapshot{singles:UnitaSingola[];packages:Pacco[];drafts:Map<string,Pannello[]>;draftIds:Map<string,string>}
const key=(commessa:string,camion:string)=>`${commessa}\u0000${camion}`;
const toPackage=(pack:ApiPackage,operatorName:(id:string)=>string):Pacco=>({id:pack.id,codice:pack.codicePacco,stato:pack.stato,commessa:pack.commessa,cliente:pack.cliente,camion:pack.camion,pannelli:pack.pannelli.map(toPanel),numeroPezzi:pack.numeroPannelli,pesoTotale:pack.pesoTotale,volumeTotale:pack.volumeTotale,...(pack.lunghezzaPacco?{lunghezzaPacco:pack.lunghezzaPacco}:{}),...(pack.larghezzaPacco?{larghezzaPacco:pack.larghezzaPacco}:{}),...(pack.altezzaPacco?{altezzaPacco:pack.altezzaPacco}:{}),operatore:operatorName(pack.operatoreId),operatoreId:pack.operatoreId,chiusoIl:pack.closedAt??pack.openedAt,apertoIl:pack.openedAt});
export const loadScanningSnapshot=async(operatorName:(id:string)=>string):Promise<ScanningSnapshot>=>{const data=await apiRequest<ApiWarehouse>("/warehouse");const drafts=new Map<string,Pannello[]>(),draftIds=new Map<string,string>();for(const pack of data.openPackages){drafts.set(key(pack.commessa,pack.camion),pack.pannelli.map(toPanel));draftIds.set(key(pack.commessa,pack.camion),pack.id);}return{singles:data.singles.map(panel=>({tipo:"SINGOLO",commessa:panel.commessa??"",camion:panel.camion,numeroPannello:panel.numeroPannello,operatore:operatorName(panel.scannedByOperatorId??""),...(panel.scannedByOperatorId?{operatoreId:panel.scannedByOperatorId}:{}),chiusaIl:panel.scannedAt??panel.updatedAt})),packages:data.packages.map(pack=>toPackage(pack,operatorName)),drafts,draftIds};};
export const createPackage= (loadId:string,operatorId:string)=>apiRequest<ApiPackage>("/packages",{method:"POST",body:JSON.stringify({loadId,operatorId})});
export const scanPanel=(panelId:string,operatorId:string)=>apiRequest<ApiPanel>(`/panels/${panelId}/scan`,{method:"PATCH",body:JSON.stringify({operatorId})});
export const closeSinglePanel=(panelId:string,operatorId:string)=>apiRequest<ApiPanel>(`/panels/${panelId}/close-single`,{method:"PATCH",body:JSON.stringify({operatorId})});
export const addPanelToPackage=(packageId:string,panelId:string,operatorId:string)=>apiRequest<ApiPackage>(`/packages/${packageId}/panels`,{method:"POST",body:JSON.stringify({panelId,operatorId})});
export const removePanelFromPackage=(packageId:string,panelId:string,operatorId:string)=>apiRequest<ApiPackage>(`/packages/${packageId}/panels/${panelId}`,{method:"DELETE",body:JSON.stringify({operatorId})});
export const closePackageApi=(packageId:string,input:{codicePacco:string;operatoreId:string;lunghezzaPacco:number;larghezzaPacco:number;altezzaPacco:number})=>apiRequest<ApiPackage>(`/packages/${packageId}/close`,{method:"POST",body:JSON.stringify(input)});
export const cancelPanelApi=(panelId:string,operatorId?:string)=>apiRequest<{success:boolean}>(`/panels/${panelId}`,{method:"DELETE",body:JSON.stringify({operatorId})});
export const cancelPackageApi=(packageId:string,operatorId?:string)=>apiRequest<{success:boolean}>(`/packages/${packageId}`,{method:"DELETE",body:JSON.stringify({operatorId})});
