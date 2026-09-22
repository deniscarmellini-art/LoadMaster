import { MenuItem, TextField } from "@mui/material";
import type { ShipmentTransportType } from "../../services/shipmentsApi";
import { shipmentTransportPresentation } from "../../services/shipmentTransportPresentation";

interface Props {
  mode: ShipmentTransportType | "";
  detailId: string;
  detailLabel?: string | null;
  options: Array<{id:string;nome:string;attivo:boolean}>;
  trailerPlate?: string;
  onModeChange:(mode:ShipmentTransportType)=>void;
  onDetailChange:(id:string)=>void;
}
export default function LoadingTransportFields({mode,detailId,detailLabel,options,trailerPlate,onModeChange,onDetailChange}:Props){
  const label=mode==="BILICO_ESSEPI"?"Trasportatore Essepi":mode==="RITIRA_CLIENTE"?"Tipo di mezzo":"Modalità Terzi per Essepi";
  return <>
    <TextField select label="Modalità di trasporto" value={mode} onChange={event=>onModeChange(event.target.value as ShipmentTransportType)}>
      <MenuItem value="">Da definire</MenuItem>
      {Object.entries(shipmentTransportPresentation).map(([value,presentation])=><MenuItem key={value} value={value}>{presentation.label}</MenuItem>)}
    </TextField>
    {mode==="BILICO_ESSEPI"&&<TextField label="Rimorchio Essepi" value={trailerPlate||"Non ancora assegnato"} slotProps={{input:{readOnly:true}}} helperText="Assegnazione dalla pagina Trasporti"/>}
    {mode&&<TextField select label={label} value={detailId} onChange={event=>onDetailChange(event.target.value)} helperText={mode==="RITIRA_CLIENTE"?"Facoltativo":"Obbligatorio alla conclusione"}>
      <MenuItem value="">Non specificato</MenuItem>
      {options.filter(option=>option.attivo||option.id===detailId).map(option=><MenuItem key={option.id} value={option.id} disabled={!option.attivo}>{option.nome}{!option.attivo?" (non attivo)":""}</MenuItem>)}
      {detailId&&!options.some(option=>option.id===detailId)&&<MenuItem value={detailId} disabled>{detailLabel||"Voce non disponibile"}</MenuItem>}
    </TextField>}
  </>;
}
