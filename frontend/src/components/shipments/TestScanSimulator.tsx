import { useRef, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { listSimulationCandidates, type SimulationCandidate } from "../../services/loadingSimulationApi";

interface Props {
  sessionId:string;
  enabled:boolean;
  loadLabel?:string;
  onScan:(qr:string)=>Promise<void>;
  result:{severity:"success"|"error";text:string}|null;
  onOpenChange?:(open:boolean)=>void;
}

export default function TestScanSimulator({sessionId,enabled,loadLabel,onScan,result,onOpenChange}:Props) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[items,setItems]=useState<SimulationCandidate[]>([]),[error,setError]=useState("");
  const working=useRef(false);
  if(import.meta.env.VITE_SISLOG_TEST!==true)return null;
  const reload=async()=>setItems(await listSimulationCandidates(sessionId));
  const show=async()=>{
    if(!enabled||working.current)return;
    setOpen(true);onOpenChange?.(true);working.current=true;setBusy(true);setItems([]);setError("");
    try{await reload();}catch(e){setError(e instanceof Error?e.message:"Elenco non disponibile");}
    finally{working.current=false;setBusy(false);}
  };
  const scan=async(item:SimulationCandidate)=>{
    if(!enabled||working.current)return;
    working.current=true;setBusy(true);setError("");
    try{await onScan(item.qr);await reload();}
    catch(e){setError(e instanceof Error?e.message:"Simulazione non riuscita");}
    finally{working.current=false;setBusy(false);}
  };
  const close=()=>{if(working.current)return;setOpen(false);onOpenChange?.(false);};
  return <>
    <Button variant="outlined" color="warning" sx={{mt:1}} disabled={!enabled||busy} onClick={()=>void show()}>Simula scansione — TEST</Button>
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Simula scansione — TEST</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{mb:2}}>Funzione di TEST: ogni simulazione esegue una vera scansione e registra il materiale nel carico selezionato.</Alert>
        {loadLabel&&<Typography variant="subtitle2" sx={{mb:1}}>{loadLabel}</Typography>}
        <Typography variant="body2" sx={{mb:1}}>Scegli un elemento o un pacco disponibile. Puoi ripetere l'operazione senza digitare codici QR.</Typography>
        {result&&<Alert severity={result.severity} sx={{mb:1}}>{result.text}</Alert>}
        {error&&<Alert severity="error" sx={{mb:1}}>{error}</Alert>}
        {busy&&<Typography role="status" sx={{my:1}}>Operazione in corso…</Typography>}
        <Stack sx={{gap:1}}>{items.map(item=><Button key={`${item.type}:${item.id}`} variant="outlined" disabled={busy||!enabled} sx={{justifyContent:"flex-start",textAlign:"left",overflowWrap:"anywhere"}} onClick={()=>void scan(item)}>{item.type==="PACKAGE"?"Pacco":"Elemento"} {item.code} — {item.elements} {item.elements===1?"elemento":"elementi"}</Button>)}</Stack>
        {!busy&&!error&&!items.length&&<Alert severity="info" sx={{mt:1}}>Nessuna unità disponibile da simulare: il carico è completo, chiuso oppure il materiale deve ancora essere preparato.</Alert>}
      </DialogContent>
      <DialogActions><Button disabled={busy} onClick={close}>Chiudi</Button></DialogActions>
    </Dialog>
  </>;
}
