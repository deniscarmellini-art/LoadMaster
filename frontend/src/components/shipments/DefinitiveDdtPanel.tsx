import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { apiRequest } from "../../services/apiClient";
import { cancelDdtAndRefresh, issueDefinitiveDdt, originalDdtPdf, originalDdtPdfUrl, type IssuedDdt } from "../../services/definitiveDdtApi";
import { createDdtRequestKey } from "../../services/ddtRequestKey";
import HistoricalTransportDialog,{type CompletedHistoricalTransport} from "./HistoricalTransportDialog";

type Document = IssuedDdt;
interface Status {document:Document|null;canIssue:boolean;canCancel?:boolean;departed?:boolean;history?:Document[];reason?:string}
interface Props {sessionId:string;operatorId:string;revision:string;onLocked:()=>void;onChanged?:()=>Promise<void>;archiveOnly?:boolean;operators?:Array<{id:string;label:string}>;carriers?:Array<{id:string;nome:string;attivo:boolean}>;transportDetails?:Array<{id:string;nome:string;attivo:boolean}>;onTransportCompleted?:(value:CompletedHistoricalTransport)=>void}
export default function DefinitiveDdtPanel(props:Props) {
  if(import.meta.env.VITE_SISLOG_TEST!==true)return null;
  return <TestDdtPanel {...props}/>;
}
function TestDdtPanel({sessionId,operatorId,revision,onLocked,onChanged,archiveOnly=false,operators=[],carriers=[],transportDetails=[],onTransportCompleted}:Props) {
  const [transportRevision,setTransportRevision]=useState(0);
  const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[url,setUrl]=useState<string|null>(null);
  const pending=useRef(false),generation=useRef(0),key=useRef("");
  const [cancelTarget,setCancelTarget]=useState<Document|null>(null),[reason,setReason]=useState(""),[cancelOperator,setCancelOperator]=useState("");
  const [viewed,setViewed]=useState<Document|null>(null);
  const onLockedRef=useRef(onLocked);onLockedRef.current=onLocked;
  const storageKey=`sislog-test-ddt-${sessionId}`;
  const accept=(value:Status)=>{setStatus(value);setViewed(current=>current?(value.history??[]).find(doc=>doc.id===current.id)??current:null);if(value.document){if(!archiveOnly)onLockedRef.current();try{sessionStorage.setItem(`${storageKey}-issued`,"1");}catch{/* Storage may be unavailable. */}}};
  useEffect(()=>{
    const current=++generation.current;setStatus(null);setError(null);key.current="";setCancelTarget(null);setViewed(null);setUrl(null);setConfirm(false);
    if(sessionId)void apiRequest<Status>(`/loading-sessions/${encodeURIComponent(sessionId)}/ddt`).then(value=>{
      if(current!==generation.current)return;
      if(!value.document){try{if(sessionStorage.getItem(`${storageKey}-issued`)){sessionStorage.removeItem(storageKey);sessionStorage.removeItem(`${storageKey}-issued`);}}catch{/* Best effort only. */}}
      accept(value);
    }).catch(reason=>{if(current===generation.current)setError(reason instanceof Error?reason.message:"Impossibile verificare il DDT");});
    return()=>{generation.current++;};
  },[sessionId,revision,transportRevision]);
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
  const emit=async()=>{
    if(pending.current||!status?.canIssue||!operatorId)return;
    pending.current=true;setBusy(true);setError(null);const current=generation.current;
    try{
      if(!key.current){try{key.current=sessionStorage.getItem(storageKey)??"";}catch{/* Use the in-memory key. */}}
      if(!key.current){key.current=createDdtRequestKey();try{sessionStorage.setItem(storageKey,key.current);}catch{/* Use the in-memory key. */}}
      const document=await issueDefinitiveDdt(sessionId,operatorId,key.current);
      if(current!==generation.current)return;
      if(document.status!=="EMESSO"){key.current="";try{sessionStorage.removeItem(storageKey);}catch{/* Best effort. */}throw new Error("Il precedente tentativo riguarda un DDT annullato. Confermare una nuova emissione.");}
      accept({document,canIssue:false,canCancel:true,history:[document,...(status.history??[])]});setConfirm(false);
    }catch(reason){if(current===generation.current){
      setError(reason instanceof Error?reason.message:"Emissione non riuscita. Riprovare con lo stesso tentativo.");
      // Reconcile a lost response or a document issued meanwhile by another operator.
      try{const latest=await apiRequest<Status>(`/loading-sessions/${encodeURIComponent(sessionId)}/ddt`);
        if(current===generation.current){accept(latest);if(latest.document){setConfirm(false);setError(null);}}
      }catch{/* Keep the original error and the same idempotency key for retry. */}
    }}
    finally{pending.current=false;setBusy(false);}
  };
  const show=async(document:Document)=>{if(pending.current)return;pending.current=true;setBusy(true);setError(null);const current=generation.current;
    try{await originalDdtPdf(document.id);if(current===generation.current){setViewed(document);setUrl(originalDdtPdfUrl(document.id));}}
    catch(reason){if(current===generation.current)setError(reason instanceof Error?reason.message:"Ristampa non disponibile");}finally{pending.current=false;setBusy(false);}
  };
  const cancel=async()=>{
    if(!cancelTarget||!reason.trim()||!cancelOperator||pending.current||!status?.canCancel)return;
    pending.current=true;setBusy(true);setError(null);const current=generation.current,target=cancelTarget;
    try{
      const latest=await cancelDdtAndRefresh(target.id,cancelOperator,reason.trim(),sessionId);
      if(current!==generation.current)return;
      accept(latest);
      key.current="";try{sessionStorage.removeItem(storageKey);sessionStorage.removeItem(`${storageKey}-issued`);}catch{/* Best effort only. */}
      setCancelTarget(null);setReason("");await onChanged?.();
    }catch(cause){if(current===generation.current)setError(cause instanceof Error?cause.message:"Annullamento non riuscito: riprovare dopo la verifica.");}
    finally{pending.current=false;setBusy(false);}
  };
  return <Stack sx={{gap:1,my:1}}>
    {!archiveOnly&&!status?.document&&<HistoricalTransportDialog sessionId={sessionId} revision={`${revision}:${transportRevision}`} operators={operators} carriers={carriers} details={transportDetails} onCompleted={async value=>{setStatus(null);setConfirm(false);onTransportCompleted?.(value);setTransportRevision(n=>n+1);await onChanged?.();}}/>}
    {status?.document?<><Alert severity="info">Carico bloccato perché esiste un DDT valido. Per correggerlo è necessario annullare prima il documento.</Alert><Typography>DDT <b>{status.document.fullNumber}</b> del {status.document.documentDate.split("-").reverse().join("/")}</Typography><Button variant="outlined" disabled={busy} onClick={()=>void show(status.document!)}>Visualizza / Ristampa DDT</Button>{!archiveOnly&&status.canCancel&&<Button variant="outlined" color="error" disabled={busy} onClick={()=>{setError(null);setCancelTarget(status.document);setReason("");setCancelOperator(operatorId);}}>Annulla DDT</Button>}</>:!archiveOnly&&<><Button variant="contained" disabled={!sessionId||!operatorId||!status?.canIssue||busy} onClick={()=>{setError(null);setConfirm(true);}}>Emetti DDT definitivo</Button>{status?.reason&&<Typography variant="body2">{status.reason}</Typography>}</>}
    {(status?.history??[]).filter(doc=>doc.status==="ANNULLATO").map(doc=><Box key={doc.id} sx={{border:1,borderColor:"warning.main",p:1.5}}><Typography sx={{fontWeight:700}}>ANNULLATO — {doc.fullNumber} del {doc.documentDate.split("-").reverse().join("/")}</Typography><Typography variant="body2">Motivo: {doc.cancellationReason} · Operatore: {operators.find(op=>op.id===doc.cancelledByOperatorId)?.label??doc.cancelledByOperatorId??"—"} · {doc.cancelledAt?new Date(doc.cancelledAt).toLocaleString("it-IT"):"—"}</Typography>{doc.replacedByDdtId&&<Typography variant="body2">Sostituito da {(status?.history??[]).find(next=>next.id===doc.replacedByDdtId)?.fullNumber??doc.replacedByDdtId}</Typography>}<Button disabled={busy} onClick={()=>void show(doc)}>Visualizza / Ristampa originale annullato</Button></Box>)}
    {!archiveOnly&&!status?.document&&status?.history?.some(doc=>doc.status==="ANNULLATO")&&<Alert severity="warning">Nessun DDT valido: partenza non consentita. Correggere i dati documentali nel Calendario e riemettere, oppure riaprire il carico dalla Dashboard per correggere il materiale. Il carico non è stato riaperto automaticamente.</Alert>}
    {error&&<Alert severity="error">{error}</Alert>}
    <Dialog open={confirm} onClose={()=>{if(!busy)setConfirm(false);}}><DialogTitle>Emetti DDT definitivo</DialogTitle><DialogContent>Il numero e la data verranno assegnati ora. Il PDF sarà archiviato e il carico verrà bloccato. La partenza non viene confermata.{error&&<Alert severity="error">{error}</Alert>}</DialogContent><DialogActions><Button disabled={busy} onClick={()=>setConfirm(false)}>Annulla</Button><Button disabled={busy||!status?.canIssue} onClick={()=>void emit()}>Conferma emissione</Button></DialogActions></Dialog>
    <Dialog open={cancelTarget!==null} onClose={()=>{if(!busy)setCancelTarget(null);}} fullWidth maxWidth="sm"><DialogTitle>Annulla DDT definitivo</DialogTitle><DialogContent><Typography sx={{mb:2}}>Annullare {cancelTarget?.fullNumber} del {cancelTarget?.documentDate.split("-").reverse().join("/")}? Numero, snapshot e PDF originale saranno conservati. Il carico resterà nello stato attuale e la partenza non verrà registrata.</Typography>{operators.length>0?<TextField select fullWidth required label="Operatore annullamento" value={cancelOperator} disabled={busy} onChange={event=>setCancelOperator(event.target.value)} sx={{mb:2}}>{operators.map(op=><MenuItem key={op.id} value={op.id}>{op.label}</MenuItem>)}</TextField>:<Typography>Operatore: {cancelOperator||"Selezionare un operatore attivo in Carico camion"}</Typography>}<TextField fullWidth required multiline minRows={3} label="Motivazione annullamento" value={reason} disabled={busy} onChange={event=>setReason(event.target.value)} slotProps={{htmlInput:{maxLength:2000}}}/>{error&&<Alert severity="error" sx={{mt:1}}>{error}</Alert>}</DialogContent><DialogActions><Button disabled={busy} onClick={()=>setCancelTarget(null)}>Mantieni DDT</Button><Button variant="contained" color="error" disabled={busy||!reason.trim()||!cancelOperator||!status?.canCancel} onClick={()=>void cancel()}>Conferma annullamento</Button></DialogActions></Dialog>
    <Dialog open={url!==null} onClose={()=>setUrl(null)} fullWidth maxWidth="lg"><DialogTitle>DDT originale archiviato — {viewed?.fullNumber}{viewed?.status==="ANNULLATO"?" — ANNULLATO":""}</DialogTitle><DialogContent>{viewed?.status==="ANNULLATO"&&<Alert severity="warning" sx={{mb:1}}>DOCUMENTO ANNULLATO — copia dell'originale conservata per lo storico. Il PDF non è stato modificato.</Alert>}<Box component="iframe" title="DDT definitivo archiviato" src={url??""} sx={{width:"100%",height:"65vh",border:0}}/><Button component="a" href={url??""} target="_blank" rel="noopener">Apri / Stampa PDF originale</Button></DialogContent><DialogActions>{url&&<Button component="a" href={`${url}?download=1`}>Scarica PDF</Button>}<Button onClick={()=>setUrl(null)}>Chiudi</Button></DialogActions></Dialog>
  </Stack>;
}
