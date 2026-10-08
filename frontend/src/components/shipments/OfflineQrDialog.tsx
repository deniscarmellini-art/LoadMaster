import {useRef,useState} from 'react';
import {Alert,Box,Button,Dialog,DialogActions,DialogContent,DialogTitle,Stack,Table,TableBody,TableCell,TableHead,TableRow,TextField,Typography} from '@mui/material';
import {importOfflineQr,type OfflineResult} from '../../services/offlineLoadingApi';
import type {ApiSession} from '../../services/loadingApi';
interface Props {sessionId:string;operatorId:string;onClose:()=>void;onImported:(session:ApiSession)=>Promise<void>}
export default function OfflineQrDialog({sessionId,operatorId,onClose,onImported}:Props){
 const [text,setText]=useState(''),[result,setResult]=useState<OfflineResult|null>(null),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 const working=useRef(false);
 const run=async(confirm:boolean)=>{
  if(working.current)return;working.current=true;setBusy(true);setError('');
  try{const data=await importOfflineQr(sessionId,text,operatorId,confirm);setResult(data);setDone(confirm);if(data.session){try{await onImported(data.session);}catch{setError('Importazione registrata. Aggiornamento della pagina non riuscito: ricarica per verificare i contatori.');}}}
  catch(e){setError(`${e instanceof Error?e.message:'Richiesta non riuscita'}${confirm?' Alcune unità potrebbero essere già registrate: verifica nuovamente il blocco prima di riprovare.':''}`);if(confirm)setResult(null);}
  finally{working.current=false;setBusy(false);}
 };
 const c=result?.counts;
 return <Dialog open fullWidth maxWidth="lg" onClose={()=>{if(!working.current)onClose();}} aria-labelledby="offline-qr-title">
  <DialogTitle id="offline-qr-title">Importa QR offline</DialogTitle>
  <DialogContent>
   <Alert severity="info" sx={{mb:2}}>Posiziona il cursore nel campo e utilizza Barcode Upload sul lettore. Puoi anche incollare il testo. Le scansioni saranno elaborate soltanto premendo Verifica scansioni.</Alert>
   <TextField autoFocus fullWidth multiline minRows={5} maxRows={12} label="Scansioni del Collector" value={text} disabled={busy||done} onChange={e=>{setText(e.target.value);setResult(null);setError('');}} onKeyDown={e=>{if(e.key==='Enter')e.stopPropagation();}}/>
   <Button sx={{my:1.5}} variant="outlined" disabled={busy||done||!text.trim()} onClick={()=>void run(false)}>{busy?'Elaborazione in corso…':'Verifica scansioni'}</Button>
   {error&&<Alert severity="error" sx={{mb:1.5}}>{error}</Alert>}
   {c&&<Stack sx={{gap:1,mb:1.5}}>
    <Typography>Scansioni ricevute: <b>{c.received}</b> · Unità valide: <b>{c.valid}</b> · Pacchi validi: <b>{c.packages}</b> · Singoli validi: <b>{c.singles}</b> · Elementi rappresentati: <b>{c.elements}</b> · Duplicati: <b>{c.duplicates}</b> · Errori / già caricati: <b>{c.errors}</b></Typography>
    {done&&<Alert severity={c.errors||c.duplicates||!c.loaded?'warning':'success'}>Caricate {c.loaded} unità, per {c.loadedElements} elementi. Verifica gli esiti delle righe scartate prima di cancellare manualmente la memoria del Collector.</Alert>}
   </Stack>}
   {result&&<Box sx={{overflowX:'auto',maxHeight:400}}><Table size="small" stickyHeader><TableHead><TableRow>{['Riga','Tipo','Codice unità','Commessa','Camion','Elementi','Esito','Motivazione'].map(title=><TableCell key={title}>{title}</TableCell>)}</TableRow></TableHead><TableBody>{result.rows.map(row=><TableRow key={row.line}><TableCell>{row.line}</TableCell><TableCell>{row.type==='PACKAGE'?'Pacco':row.type==='PANEL'?'Singolo':'—'}</TableCell><TableCell>{row.code}</TableCell><TableCell>{row.commessa}</TableCell><TableCell>{row.camion}</TableCell><TableCell>{row.elements}</TableCell><TableCell sx={{color:row.status==='VALID'||row.status==='LOADED'?'success.main':row.status==='DUPLICATE'||row.status==='ALREADY_LOADED'?'warning.main':'error.main'}}>{{VALID:'Valida',LOADED:'Caricata',DUPLICATE:'Duplicata',ALREADY_LOADED:'Già caricata',ERROR:'Errore'}[row.status]}</TableCell><TableCell>{row.message}</TableCell></TableRow>)}</TableBody></Table></Box>}
  </DialogContent>
  <DialogActions><Button disabled={busy} onClick={onClose}>{done?'Chiudi':'Annulla'}</Button><Button variant="contained" disabled={busy||done||!result?.counts.valid} onClick={()=>void run(true)}>Conferma importazione</Button></DialogActions>
 </Dialog>;
}
