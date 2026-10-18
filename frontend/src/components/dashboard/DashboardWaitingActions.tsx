import { useEffect, useState } from "react";
import { MenuItem, ListItemText } from "@mui/material";
import { apiRequest } from "../../services/apiClient";
import { definitiveDdtStatus } from "../../services/definitiveDdtApi";

interface Props {sessionId?:string;onViewLoad:()=>void;onViewDdt:()=>void;onConfirmDeparture:()=>void}
export function DashboardWaitingActionsList({sessionId,available,reason,canDepart,documentNumber,onViewLoad,onViewDdt,onConfirmDeparture}:Props&{available:boolean;reason:string;canDepart:boolean;documentNumber?:string}) {
  return <>
    <MenuItem disabled={!sessionId} onClick={onViewLoad}><ListItemText>Visualizza carico</ListItemText></MenuItem>
    <MenuItem disabled={!available} title={reason} sx={{whiteSpace:"normal",maxWidth:420}} onClick={onViewDdt}><ListItemText primary={documentNumber?`Visualizza / Stampa DDT ${documentNumber}`:"Visualizza / Stampa DDT (anteprima)"} secondary={!available?reason:undefined}/></MenuItem>
    <MenuItem disabled={!sessionId} sx={{whiteSpace:"normal",maxWidth:420}} onClick={onConfirmDeparture}><ListItemText primary="Conferma partenza" secondary={!canDepart?"Emettere un DDT definitivo valido in Carico camion. Un DDT annullato non consente la partenza.":undefined}/></MenuItem>
  </>;
}
export default function DashboardWaitingActions({sessionId,onViewLoad,onViewDdt,onConfirmDeparture}:Props) {
  const [available,setAvailable]=useState(false),[reason,setReason]=useState("Verifica disponibilità anteprima DDT…");
  const [canDepart,setCanDepart]=useState(false),[documentNumber,setDocumentNumber]=useState<string|undefined>();
  useEffect(()=>{
    let current=true;setAvailable(false);setCanDepart(false);setDocumentNumber(undefined);
    if(import.meta.env.VITE_SISLOG_TEST!==true||!sessionId){setReason("Anteprima DDT non disponibile");setCanDepart(import.meta.env.VITE_SISLOG_TEST!==true&&!!sessionId);return;}
    void Promise.allSettled([definitiveDdtStatus(sessionId),apiRequest<{available:boolean;reason?:string}>(`/loading-sessions/${encodeURIComponent(sessionId)}/ddt-preview/availability`)]).then(([ddt,preview])=>{
      if(!current)return;
      const valid=ddt.status==="fulfilled"&&ddt.value.document?.status==="EMESSO"&&!ddt.value.departed;
      const number=ddt.status==="fulfilled"?ddt.value.document?.fullNumber:undefined;
      setCanDepart(!!valid);setDocumentNumber(number);setAvailable(!!number||(preview.status==="fulfilled"&&preview.value.available));setReason(preview.status==="fulfilled"?preview.value.reason??"":"DDT non disponibile");
    }).catch(()=>{if(current)setReason("Anteprima DDT non disponibile");});
    return()=>{current=false;};
  },[sessionId]);
  return <DashboardWaitingActionsList sessionId={sessionId} available={available} reason={reason} canDepart={canDepart} {...(documentNumber?{documentNumber}:{})} onViewLoad={onViewLoad} onViewDdt={onViewDdt} onConfirmDeparture={onConfirmDeparture}/>;
}
