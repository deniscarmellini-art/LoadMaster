import { useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, MenuItem, Stack, TextField } from "@mui/material";
import LoadingTransportFields from "./LoadingTransportFields";
import { createTransportReservation, releaseTransportReservation, type TransportItem } from "../../services/transportsApi";
import type { ShipmentTransportType } from "../../services/shipmentsApi";

interface Props {
  load: {id:string;commessa:string;cliente:string;camion:string};
  mode: ShipmentTransportType | "";
  detailId:string;
  detailLabel?:string|null;
  options:Array<{id:string;nome:string;attivo:boolean}>;
  assigned?:TransportItem;
  transports:TransportItem[];
  saving:boolean;
  onRefresh:()=>Promise<void>;
  onBusyChange:(busy:boolean)=>void;
  onModeChange:(mode:ShipmentTransportType|"")=>void;
  onDetailChange:(id:string)=>void;
}

export const availableLoadingTrailers=(items:readonly TransportItem[])=>items.filter(item=>item.active&&item.status==="DISPONIBILE"&&!item.assignmentId);

export default function TruckLoadingTransportFields({load,mode,detailId,detailLabel,options,assigned,transports,saving,onRefresh,onBusyChange,onModeChange,onDetailChange}:Props){
  const [selected,setSelected]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [release,setRelease]=useState<{trailer:TransportItem;nextMode?:ShipmentTransportType|""}|null>(null);
  const available=availableLoadingTrailers(transports);
  const changeMode=(next:ShipmentTransportType|"")=>{
    setError(null);
    if(assigned&&next!=="BILICO_ESSEPI"){
      if(!assigned.canRelease){setError("Cambio modalità bloccato: il carico fisico è già iniziato o il rimorchio non è disimpegnabile.");return;}
      setRelease({trailer:assigned,nextMode:next});return;
    }
    onModeChange(next);
  };
  const operate=async(action:()=>Promise<unknown>,success:()=>void)=>{
    setBusy(true);onBusyChange(true);setError(null);
    try{await action();await onRefresh();success();}
    catch(reason){setError(reason instanceof Error?reason.message:"Operazione sul rimorchio non riuscita.");await onRefresh().catch(()=>{});}
    finally{setBusy(false);onBusyChange(false);}
  };
  const reserve=()=>{
    if(busy||saving||assigned||!available.some(item=>item.id===selected))return;
    return operate(()=>createTransportReservation(selected,{loadId:load.id,commessa:load.commessa,cliente:load.cliente,carico:load.camion}),()=>setSelected(""));
  };
  const confirmRelease=()=>{
    if(!release?.trailer.assignmentId||busy||saving)return;
    const {trailer,nextMode}=release;
    return operate(()=>releaseTransportReservation(trailer.id,trailer.assignmentId!),()=>{setRelease(null);if(nextMode!==undefined)onModeChange(nextMode);});
  };
  const trailerControl=<Stack sx={{gap:1}}>
    {assigned?<>
      <TextField label="Rimorchio Essepi" value={[assigned.plate,assigned.description].filter(Boolean).join(" — ")} slotProps={{input:{readOnly:true}}}/>
      {assigned.canRelease&&<Button disabled={busy||saving} onClick={()=>setRelease({trailer:assigned})}>Disimpegna</Button>}
    </>:<>
      <TextField select label="Rimorchio Essepi" value={available.some(item=>item.id===selected)?selected:""} disabled={busy||saving} onChange={event=>{setSelected(event.target.value);setError(null);}} helperText="Seleziona un rimorchio disponibile e conferma l'impegno.">
        <MenuItem value="">Seleziona rimorchio</MenuItem>
        {available.map(item=><MenuItem key={item.id} value={item.id}>{[item.plate,item.description].filter(Boolean).join(" — ")}</MenuItem>)}
      </TextField>
      <Button variant="outlined" disabled={busy||saving||!available.some(item=>item.id===selected)} onClick={reserve}>Impegna rimorchio</Button>
      {!available.length&&<Alert severity="info">Nessun rimorchio attivo disponibile.</Alert>}
    </>}
  </Stack>;
  return <>
    <LoadingTransportFields mode={mode} detailId={detailId} detailLabel={detailLabel} options={options} disabled={busy||saving} trailerControl={trailerControl} onModeChange={changeMode} onDetailChange={onDetailChange}/>
    {error&&<Alert severity="error" onClose={()=>setError(null)}>{error}</Alert>}
    <Dialog open={release!==null} onClose={()=>{if(!busy)setRelease(null);}}>
      <DialogTitle>Disimpegna rimorchio</DialogTitle>
      <DialogContent><DialogContentText>Disimpegnare {release?.trailer.plate}{release?.nextMode?" e cambiare modalità di trasporto":""}? Il backend verifica che il carico fisico non sia iniziato.</DialogContentText>{error&&<Alert severity="error">{error}</Alert>}</DialogContent>
      <DialogActions><Button disabled={busy} onClick={()=>setRelease(null)}>Annulla</Button><Button disabled={busy||saving} onClick={confirmRelease}>Conferma disimpegno</Button></DialogActions>
    </Dialog>
  </>;
}
