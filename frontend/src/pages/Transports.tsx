import { useMemo, useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Snackbar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { ApiClientError } from "../services/apiClient";
import { disableTrailer, enableTrailer, type TransportItem, type TransportStatus } from "../services/transportsApi";
import { formatOptionalDate, parseOptionalDate } from "../utils/dateFormatting";

interface Props { items: TransportItem[]; onBack: () => void; onRefresh: () => Promise<void>; }
const labels: Record<TransportStatus,string>={DISPONIBILE:"Disponibile",IMPEGNATO:"Impegnato",IN_VIAGGIO:"In viaggio",FUORI_SERVIZIO:"Fuori servizio"};
const colors: Record<TransportStatus,"success"|"warning"|"info"|"error">={DISPONIBILE:"success",IMPEGNATO:"warning",IN_VIAGGIO:"info",FUORI_SERVIZIO:"error"};
const dateTime=(value:string|null)=>value?new Date(value).toLocaleString("it-IT"):"—";

export default function Transports({items,onBack,onRefresh}:Props){
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState<TransportStatus|"">("");
  const [dueOnly,setDueOnly]=useState(false);
  const [disableId,setDisableId]=useState<string|null>(null);
  const [reason,setReason]=useState("");
  const [notes,setNotes]=useState("");
  const [notice,setNotice]=useState<{severity:"success"|"error";text:string}|null>(null);
  const filtered=useMemo(()=>{const needle=search.trim().toLocaleUpperCase("it-IT"),limit=Date.now()+30*86400000;return items.filter(item=>{const inspection=parseOptionalDate(item.nextInspectionDate);return(!needle||[item.plate,item.commessa,item.cliente].some(value=>value?.toLocaleUpperCase("it-IT").includes(needle)))&&(!status||item.status===status)&&(!dueOnly||(inspection!==null&&inspection.getTime()<=limit));});},[items,search,status,dueOnly]);
  const performDisable=async()=>{if(!disableId||!reason)return;try{await disableTrailer(disableId,reason,notes);await onRefresh();setDisableId(null);setReason("");setNotes("");setNotice({severity:"success",text:"Rimorchio messo fuori servizio."});}catch{setNotice({severity:"error",text:"Errore durante la disabilitazione."});}};
  const performEnable=async(id:string)=>{try{await enableTrailer(id);await onRefresh();setNotice({severity:"success",text:"Rimorchio riattivato."});}catch(error){setNotice({severity:"error",text:error instanceof ApiClientError&&error.code==="RESOURCE_IN_USE"?"Il rimorchio ha un trasporto attivo e non può essere riattivato.":"Errore durante la riattivazione."});}};
  return <Box>
    <Box sx={{display:"flex",alignItems:"center",mb:2}}><Button startIcon={<ArrowBackIcon/>} onClick={onBack}>Dashboard</Button><Typography variant="h4" sx={{fontWeight:800,mx:"auto"}}>Trasporti</Typography></Box>
    <Paper sx={{p:2}}>
      <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"minmax(280px,1fr) 220px auto"},gap:1.5,mb:2}}>
        <TextField label="Cerca targa, commessa o cliente" value={search} onChange={event=>setSearch(event.target.value)}/>
        <TextField select label="Stato" value={status} onChange={event=>setStatus(event.target.value as TransportStatus|"")}><MenuItem value="">Tutti</MenuItem>{Object.entries(labels).map(([key,label])=><MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField>
        <Button variant={dueOnly?"contained":"outlined"} onClick={()=>setDueOnly(value=>!value)}>Revisione in scadenza</Button>
      </Box>
      <TableContainer><Table sx={{minWidth:1120}} size="small"><TableHead><TableRow>{["Targa","Descrizione","Stato","Commessa associata","Cliente","Camion","Data partenza","Rientro previsto","Prossima revisione","Azioni"].map(label=><TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>
        {filtered.map(item=>{const inspectionDate=parseOptionalDate(item.nextInspectionDate),inspection=inspectionDate?.getTime()??null,days=inspection===null?null:Math.ceil((inspection-Date.now())/86400000),inspectionColor=days!==null&&days<0?"error.main":days!==null&&days<=30?"warning.main":"text.primary";return <TableRow key={item.id} hover><TableCell sx={{fontWeight:700,color:"primary.main",whiteSpace:"nowrap"}}>{item.plate}</TableCell><TableCell>{item.description||"—"}</TableCell><TableCell><Chip label={labels[item.status]} color={colors[item.status]} size="small" sx={{minWidth:112}}/></TableCell><TableCell>{item.commessa??"—"}</TableCell><TableCell>{item.cliente??"—"}</TableCell><TableCell>{item.camion??"—"}</TableCell><TableCell sx={{whiteSpace:"nowrap"}}>{dateTime(item.departedAt)}</TableCell><TableCell sx={{whiteSpace:"nowrap"}}>{dateTime(item.availableFrom)}</TableCell><TableCell sx={{color:inspectionColor,fontWeight:days!==null&&days<=30?700:400,whiteSpace:"nowrap"}}>{formatOptionalDate(item.nextInspectionDate)}</TableCell><TableCell><Box sx={{display:"flex",alignItems:"center",gap:1}}>{item.status==="FUORI_SERVIZIO"?<Button size="small" onClick={()=>void performEnable(item.id)}>Riattiva</Button>:<Button size="small" color="error" onClick={()=>{setDisableId(item.id);setReason("");setNotes("");}}>Disabilita</Button>}</Box>{item.disabledReason&&<Typography variant="caption" color="error.main" sx={{display:"block",mt:.5}}>{item.disabledReason}</Typography>}</TableCell></TableRow>;})}
        {!filtered.length&&<TableRow><TableCell colSpan={10} align="center" sx={{py:4,color:"text.secondary"}}>Nessun rimorchio corrisponde ai filtri.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
    </Paper>
    <Dialog open={disableId!==null} onClose={()=>setDisableId(null)} fullWidth maxWidth="sm"><DialogTitle>Metti rimorchio fuori servizio</DialogTitle><DialogContent><TextField select required fullWidth label="Motivo" value={reason} onChange={event=>setReason(event.target.value)} sx={{mt:1,mb:2}}><MenuItem value="" disabled>Seleziona motivo</MenuItem>{["Revisione","Manutenzione","Guasto","Altro"].map(value=><MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField><TextField fullWidth multiline minRows={3} label="Note (facoltative)" value={notes} onChange={event=>setNotes(event.target.value)}/><TextField fullWidth label="Data inizio" value={new Date().toLocaleString("it-IT")} slotProps={{input:{readOnly:true}}} sx={{mt:2}}/></DialogContent><DialogActions><Button onClick={()=>setDisableId(null)}>Annulla</Button><Button color="error" variant="contained" disabled={!reason} onClick={()=>void performDisable()}>Disabilita</Button></DialogActions></Dialog>
    <Snackbar open={notice!==null} autoHideDuration={3500} onClose={()=>setNotice(null)}><Alert severity={notice?.severity??"success"}>{notice?.text}</Alert></Snackbar>
  </Box>;
}
