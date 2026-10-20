import {useEffect,useRef,useState} from "react";
import {Alert,Button,Checkbox,Dialog,DialogActions,DialogContent,DialogTitle,FormControlLabel,MenuItem,Stack,TextField,Typography} from "@mui/material";
import {apiRequest} from "../../services/apiClient";
import type {ShipmentTransportType} from "../../services/shipmentsApi";

interface Status {candidate:boolean;eligible:boolean;reason:string;revision:string;destinationType:string;trailerPlate:string|null;transportMode:ShipmentTransportType|"";carrierId:string|null;transportDetailId:string|null}
export interface CompletedHistoricalTransport {transportMode:ShipmentTransportType;carrierId:string|null;transportDetailId:string|null;transportDetailLabel:string|null}
interface Props {sessionId:string;revision:string;operators:Array<{id:string;label:string}>;carriers:Array<{id:string;nome:string;attivo:boolean}>;details:Array<{id:string;nome:string;attivo:boolean}>;onCompleted:(value:CompletedHistoricalTransport)=>Promise<void>}
export default function HistoricalTransportDialog(props:Props){
 if(import.meta.env.VITE_SISLOG_TEST!==true)return null;
 return <TestHistoricalTransport {...props}/>;
}
function TestHistoricalTransport({sessionId,revision,operators,carriers,details,onCompleted}:Props){
 const [status,setStatus]=useState<Status|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [operator,setOperator]=useState(""),[mode,setMode]=useState<ShipmentTransportType|"">(""),[carrier,setCarrier]=useState(""),[detail,setDetail]=useState(""),[confirmed,setConfirmed]=useState(false),[success,setSuccess]=useState(false);
 const pending=useRef(false),generation=useRef(0);
 const path=`/loading-sessions/${encodeURIComponent(sessionId)}/historical-transport`;
 useEffect(()=>{const current=++generation.current;setStatus(null);setOpen(false);setError("");if(sessionId)void apiRequest<Status>(path).then(value=>{if(current===generation.current)setStatus(value);}).catch(()=>{/* No unsafe fallback if eligibility cannot be verified. */});return()=>{generation.current++;};},[sessionId,revision,path]);
 const show=async()=>{if(pending.current)return;pending.current=true;setBusy(true);setError("");setSuccess(false);const current=generation.current;
  try{const value=await apiRequest<Status>(path);if(current!==generation.current)return;setStatus(value);if(!value.eligible)return;setMode(value.transportMode);setCarrier(value.carrierId??"");setDetail(value.transportDetailId??"");setOperator("");setConfirmed(false);setOpen(true);}
  catch(cause){if(current===generation.current)setError(cause instanceof Error?cause.message:"Verifica non disponibile");}finally{pending.current=false;setBusy(false);}
 };
 const save=async()=>{if(pending.current||!status||!mode||!operator||!confirmed)return;pending.current=true;setBusy(true);setError("");const current=generation.current;
  try{const value=await apiRequest<CompletedHistoricalTransport>(path,{method:"POST",body:JSON.stringify({operatorId:operator,transportMode:mode,...(carrier?{carrierId:carrier}:{}),...(detail?{transportDetailId:detail}:{}),confirmed:true,revision:status.revision})});
   if(current!==generation.current)return;setOpen(false);setStatus(null);setSuccess(true);
   try{await onCompleted(value);}catch{setError("Dati confermati. Aggiornamento schermata non riuscito: ricaricare prima di proseguire con il DDT.");}
  }catch(cause){if(current===generation.current)setError(cause instanceof Error?cause.message:"Conferma non riuscita");}finally{pending.current=false;setBusy(false);}
 };
 const valid=Boolean(status?.eligible&&mode&&operator&&confirmed&&(mode==="RITIRA_CLIENTE"||carrier)&&(mode!=="TERZI_PER_ESSEPI"||detail));
 return <>
  {status?.eligible&&<Button size="small" variant="outlined" disabled={busy} onClick={()=>void show()}>Completa dati trasporto</Button>}
  {status?.candidate&&!status.eligible&&<Alert severity="warning">{status.reason}</Alert>}
  {success&&<Alert severity="success">Dati di trasporto confermati. Nessun DDT è stato emesso.</Alert>}
  {error&&!open&&<Alert severity="error">{error}</Alert>}
  <Dialog open={open} fullWidth maxWidth="sm" onClose={()=>{if(!busy)setOpen(false);}}><DialogTitle>Completa dati trasporto</DialogTitle><DialogContent><Stack sx={{gap:2,pt:1}}>
   <Typography variant="body2">Conferma i dati effettivi per il DDT. Il carico rimane chiuso.</Typography>
   <TextField size="small" label="Destinazione storica" value={status?.destinationType==="RIMORCHIO_ESSEPI"?"Rimorchio Essepi":"Trasportatore"} slotProps={{input:{readOnly:true}}}/>
   <TextField size="small" label="Rimorchio storico assegnato" value={status?.trailerPlate??"Non presente"} slotProps={{input:{readOnly:true}}}/>
   <TextField size="small" select required label="Modalità di trasporto" value={mode} disabled={busy||status?.destinationType==="RIMORCHIO_ESSEPI"||!!status?.transportMode} onChange={e=>{setMode(e.target.value as ShipmentTransportType);setCarrier(status?.carrierId??"");setDetail(status?.transportDetailId??"");setConfirmed(false);}}>
    {(status?.destinationType==="RIMORCHIO_ESSEPI"?["BILICO_ESSEPI"]:status?.carrierId?["TERZI_PER_ESSEPI"]:["RITIRA_CLIENTE","TERZI_PER_ESSEPI"]).map(value=><MenuItem key={value} value={value}>{value==="BILICO_ESSEPI"?"Bilico Essepi":value==="RITIRA_CLIENTE"?"Ritira cliente":"Terzi per Essepi"}</MenuItem>)}
   </TextField>
   {mode!=="RITIRA_CLIENTE"&&<TextField size="small" select required label="Vettore effettivo" value={carrier} disabled={busy||!!status?.carrierId} onChange={e=>{setCarrier(e.target.value);setConfirmed(false);}} helperText="Selezione esplicita: nessun recupero dalla pianificazione."><MenuItem value="" disabled>Seleziona vettore</MenuItem>{carriers.filter(c=>c.attivo||c.id===status?.carrierId).map(c=><MenuItem key={c.id} value={c.id}>{c.nome}</MenuItem>)}</TextField>}
   {mode==="TERZI_PER_ESSEPI"&&<TextField size="small" select required label="Modalità Terzi per Essepi" value={detail} disabled={busy||!!status?.transportDetailId} onChange={e=>{setDetail(e.target.value);setConfirmed(false);}}>{details.filter(d=>d.attivo||d.id===status?.transportDetailId).map(d=><MenuItem key={d.id} value={d.id}>{d.nome}</MenuItem>)}</TextField>}
   <TextField size="small" select required label="Operatore confermante" value={operator} disabled={busy} onChange={e=>{setOperator(e.target.value);setConfirmed(false);}}>{operators.map(op=><MenuItem key={op.id} value={op.id}>{op.label}</MenuItem>)}</TextField>
   <FormControlLabel control={<Checkbox checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>} label="Confermo i dati effettivi di trasporto per l’emissione DDT"/>
   {error&&<Alert severity="error">{error}</Alert>}
  </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={()=>setOpen(false)}>Annulla</Button><Button variant="contained" disabled={busy||!valid} onClick={()=>void save()}>Conferma dati trasporto</Button></DialogActions></Dialog>
 </>;
}
