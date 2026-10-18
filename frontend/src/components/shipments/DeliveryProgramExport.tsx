import { useRef, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import type { ShipmentItem } from "../../services/shipmentsApi";
import type { ShipmentListDetail } from "../../services/shipmentListFilters";
import { prepareDeliveryProgram,deliveryProgramDisclaimer,type DeliveryProgram } from "../../services/deliveryProgramModel";

interface Props {filtered:ShipmentItem[];details:ReadonlyMap<string,ShipmentListDetail>;from:string;to:string;carrierId?:string;carrierName?:string}
export default function DeliveryProgramExport(props:Props) {
  if(import.meta.env.VITE_SISLOG_TEST!==true)return null;
  return <TestDeliveryProgramExport {...props}/>;
}
function TestDeliveryProgramExport({filtered,details,from,to,carrierId,carrierName}:Props) {
  const [model,setModel]=useState<DeliveryProgram|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const pending=useRef(false);
  const open=()=>{setError("");try{setModel(prepareDeliveryProgram(filtered,details,{from,to,carrierId,carrierName,generatedAt:new Date().toISOString()}));}catch(error){setError(error instanceof Error?error.message:"Esportazione non disponibile");}};
  const download=async(format:"pdf"|"excel")=>{
    if(!model||pending.current)return;
    pending.current=true;setBusy(true);setError("");
    try{
      let blob:Blob;
      if(format==="pdf"){
        const module=await import("../../services/deliveryProgramPdf");
        blob=module.createDeliveryProgramPdf(model,await module.loadDeliveryProgramAssets()).output("blob");
      }else{
        const module=await import("../../services/deliveryProgramExcel");
        const bytes=module.deliveryProgramExcelBytes(model);
        blob=new Blob([new Uint8Array(bytes).buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
      }
      const url=URL.createObjectURL(blob),anchor=document.createElement("a");
      anchor.href=url;anchor.download=`${model.filename}.${format==="pdf"?"pdf":"xlsx"}`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(error){setError(error instanceof Error?error.message:"Generazione non riuscita");}
    finally{pending.current=false;setBusy(false);}
  };
  return <>
    <Stack sx={{gap:1,mb:1.5,alignItems:"flex-start"}}><Button variant="outlined" onClick={open} disabled={busy}>Esporta pianificazione</Button>{error&&!model&&<Alert severity="info">{error}</Alert>}</Stack>
    <Dialog open={!!model} onClose={()=>{if(!busy)setModel(null);}} fullWidth maxWidth="sm">
      <DialogTitle>Esporta pianificazione</DialogTitle>
      <DialogContent><Typography sx={{mb:1}}>{model?.rows.length} consegne da effettuare, ordinate per data prevista.</Typography>{model?.options.carrierName&&<Typography>Trasportatore: {model.options.carrierName}</Typography>}<Typography>{model?.period}</Typography><Alert severity="info" sx={{mt:2}}>{deliveryProgramDisclaimer}. Le spedizioni già partite sono escluse.</Alert>{error&&<Alert severity="error" sx={{mt:1}}>{error}</Alert>}{busy&&<Typography sx={{mt:1}}>Generazione in corso…</Typography>}</DialogContent>
      <DialogActions sx={{flexWrap:"wrap"}}><Button disabled={busy} onClick={()=>setModel(null)}>Chiudi</Button><Button disabled={busy||!model} onClick={()=>void download("excel")}>Scarica Excel</Button><Button variant="contained" disabled={busy||!model} onClick={()=>void download("pdf")}>Scarica PDF</Button></DialogActions>
    </Dialog>
  </>;
}
