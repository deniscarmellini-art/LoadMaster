export interface DocumentReference { id:string; label:string|null }
export interface ShipmentDocumentElement {
 id:string; unitType:"Singolo"|"Pacco"; packageCode:string|null; number:string; masterPanel:string;
 thickness:number; length:number; width:number; weight:number; volume:number;
 scanOperator:DocumentReference|null; scannedAt:string|null; state:"SPEDITO";
}
export interface ShipmentDocument {
 schemaVersion:1; kind:"SHIPMENT_SHEET"; shipmentId:string; loadId:string; order:string; customer:string; truck:string;
 shippedAt:string; firstPlannedDate:string|null; transportMode:string|null; transportDetail:string|null;
 carrier:DocumentReference|null; trailer:(DocumentReference & {plate:string})|null;
 operators:{start:DocumentReference|null;close:DocumentReference|null;departure:DocumentReference|null};
 totals:{expected:number;shipped:number;packages:number;weight:number;volume:number;warehouseDays:number|null};
 elements:ShipmentDocumentElement[]; warnings:string[];
 events:Array<{type:string;timestamp:string;operator:DocumentReference|null;note:string|null}>;
}
