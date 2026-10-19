import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from "@mui/material";
import { apiPdfRequest, apiRequest } from "../../services/apiClient";

export default function DdtPreviewButton({ sessionId, disabled, preferArchived=false, autoOpen=false, showButton=true, onClosed }: { sessionId: string; disabled: boolean; preferArchived?:boolean; autoOpen?:boolean;showButton?:boolean;onClosed?:()=>void }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null), [url, setUrl] = useState<string | null>(null);
  const [archived,setArchived]=useState(false);
  const generation = useRef(0), pending = useRef(false);
  useEffect(() => { generation.current++; setOpen(false); setUrl(null); setError(null); setBusy(false); pending.current=false;
    return () => { generation.current++; }; }, [sessionId]);
  useEffect(() => () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); }, [url]);
  const preview = async () => {
    if (pending.current) return;
    pending.current=true;const current=++generation.current;
    setOpen(true);setBusy(true);setError(null);setUrl(null);
    try {
      let archiveId:string|null=null;
      if(preferArchived&&import.meta.env.VITE_SISLOG_TEST===true){const status=await apiRequest<{document:{id:string}|null}>(`/loading-sessions/${encodeURIComponent(sessionId)}/ddt`);archiveId=status.document?.id??null;}
      const blob=await apiPdfRequest(archiveId?`/ddt/${encodeURIComponent(archiveId)}/pdf`:`/loading-sessions/${encodeURIComponent(sessionId)}/ddt-preview`);
      if(current===generation.current)setArchived(Boolean(archiveId));
      if(current===generation.current)setUrl(archiveId?`/api/ddt/${encodeURIComponent(archiveId)}/pdf`:import.meta.env.VITE_SISLOG_TEST===true?`/api/loading-sessions/${encodeURIComponent(sessionId)}/ddt-preview`:URL.createObjectURL(blob));
    } catch (e) { if(current===generation.current)setError(e instanceof Error?e.message:"Impossibile generare l'anteprima DDT"); }
    finally { if(current===generation.current){setBusy(false);pending.current=false;} }
  };
  useEffect(()=>{if(autoOpen&&!disabled&&sessionId)void preview();},[autoOpen,sessionId,disabled]);
  const close=()=>{setOpen(false);onClosed?.();};
  return <>{showButton&&<Button variant="outlined" disabled={disabled||!sessionId||busy} onClick={() => void preview()}>Anteprima DDT</Button>}
    <Dialog open={open} onClose={close} fullWidth maxWidth="lg">
      <DialogTitle>{archived?"DDT originale archiviato":"Anteprima DDT"}</DialogTitle><DialogContent>
        <Alert severity={archived?"info":"warning"} sx={{mb:1}}>{archived?"PDF originale archiviato: ristampa identica all'emissione.":<>ANTEPRIMA — NON VALIDO COME DDT. La partenza non viene confermata.</>}</Alert>
        {busy&&<Stack direction="row" spacing={2} sx={{p:3,alignItems:"center"}}><CircularProgress size={24}/><span>Generazione PDF…</span></Stack>}
        {error&&<Alert severity="error">{error}</Alert>}
        {url&&<><Box component="iframe" title="Anteprima PDF DDT" src={url} sx={{width:"100%",height:"65vh",border:0}}/><Button component="a" href={url} target="_blank" rel="noopener">Apri PDF in una nuova scheda</Button></>}
      </DialogContent><DialogActions>{url&&<Button component="a" href={import.meta.env.VITE_SISLOG_TEST===true?`${url}?download=1`:url} download={import.meta.env.VITE_SISLOG_TEST===true?undefined:"anteprima-ddt.pdf"}>Scarica PDF</Button>}{error&&<Button onClick={() => void preview()}>Riprova</Button>}<Button onClick={close}>Chiudi</Button></DialogActions>
    </Dialog></>;
}
