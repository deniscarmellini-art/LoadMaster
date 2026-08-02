export type LoadStatus="DA_COMPLETARE"|"DA_CARICARE"|"IN_CARICO"|"ATTESA_SPEDIZIONE"|"SPEDITO";
export type PanelStatus="DA_COMPLETARE"|"DISPONIBILE"|"CARICATO"|"SPEDITO";
export interface PanelImport{numeroPannello:string;numeroCliente:string;numeroMasterPanel:string;camion:string;lato1:string;lato2:string;tipoPannello:string;quantita:number;spessore:number;lunghezza:number;altezza:number;superficie:number;volume:number;peso:number;}
export interface LoadImport{commessa:string;cliente:string;numeroCliente:string;riferimentoOrdine:string;pannelli:PanelImport[];removeMissing?:boolean;}
export interface PanelRecord extends PanelImport{id:string;loadId:string;stato:PanelStatus;createdAt:string;updatedAt:string;}
export interface LoadRecord{id:string;commessa:string;cliente:string;numeroCliente:string;riferimentoOrdine:string;camion:string;stato:LoadStatus;createdAt:string;updatedAt:string;pannelli:PanelRecord[];}
