export type LoadStatus="DA_COMPLETARE"|"DA_CARICARE"|"IN_CARICO"|"ATTESA_SPEDIZIONE"|"SPEDITO";
export type PanelStatus="MANCANTE"|"IN_LAVORAZIONE_PACCO"|"DISPONIBILE"|"CARICATO"|"SPEDITO";
export type PackageStatus="APERTO"|"DISPONIBILE"|"CARICATO"|"SPEDITO";
export type PackageWorkflowState="ATTIVO"|"SOSPESO";
export interface PanelImport{numeroPannello:string;numeroCliente:string;numeroMasterPanel:string;camion:string;lato1:string;lato2:string;tipoPannello:string;quantita:number;spessore:number;lunghezza:number;altezza:number;superficie:number;volume:number;peso:number;}
export interface LoadImport{commessa:string;cliente:string;numeroCliente:string;riferimentoOrdine:string;pannelli:PanelImport[];removeMissing?:boolean;}
export interface PanelRecord extends PanelImport{id:string;loadId:string;stato:PanelStatus;packageId:string|null;manualLocation:string|null;scannedAt:string|null;scannedByOperatorId:string|null;createdAt:string;updatedAt:string;}
export interface LoadRecord{id:string;commessa:string;cliente:string;numeroCliente:string;riferimentoOrdine:string;camion:string;stato:LoadStatus;createdAt:string;updatedAt:string;pannelli:PanelRecord[];}
export interface PackageRecord{id:string;codicePacco:string;loadId:string;commessa:string;cliente:string;camion:string;stato:PackageStatus;workflowState:PackageWorkflowState;numeroPannelli:number;pesoTotale:number;volumeTotale:number;lunghezzaPacco:number|null;larghezzaPacco:number|null;altezzaPacco:number|null;manualLocation:string|null;operatoreId:string;openedAt:string;closedAt:string|null;createdAt:string;updatedAt:string;pannelli:PanelRecord[];}
export interface WarehouseRecord{singles:PanelRecord[];packages:PackageRecord[];openPackages:PackageRecord[];suspendedPackages:PackageRecord[];}
export type LoadingStatus=LoadStatus;
export type DestinationType="RIMORCHIO_ESSEPI"|"TRASPORTATORE";
export interface LoadingUnitRecord{id:string;loadingSessionId:string;unitType:"PANEL"|"PACKAGE";panelId:string|null;packageId:string|null;code:string;weight:number;volume:number;loadedAt:string;loadedByOperatorId:string;active:boolean;}
export interface LoadingSessionRecord{id:string;loadId:string;commessa:string;cliente:string;camion:string;stato:LoadingStatus;operatorId:string;destinationType:DestinationType;trailerId:string|null;carrierId:string|null;startedAt:string;completedAt:string|null;reopenedAt:string|null;shippedAt:string|null;createdAt:string;updatedAt:string;units:LoadingUnitRecord[];events:Array<{type:string;operatorId:string|null;timestamp:string;note:string|null}>;}
