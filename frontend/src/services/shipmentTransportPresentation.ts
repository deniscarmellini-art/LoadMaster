import type { ShipmentTransportType } from "./shipmentsApi";

export const shipmentTransportPresentation:Record<ShipmentTransportType,{label:string;color:string}>={
  BILICO_ESSEPI:{label:"Bilico Essepi",color:"#2e7d32"},
  RITIRA_CLIENTE:{label:"Ritira Cliente",color:"#d32f2f"},
  TERZI_PER_ESSEPI:{label:"Terzi per Essepi",color:"#1976d2"},
};

export const shipmentTransportLabel=(type:ShipmentTransportType|null|undefined):string=>type?shipmentTransportPresentation[type].label:"—";
