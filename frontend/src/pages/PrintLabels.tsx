import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintIcon from "@mui/icons-material/Print";
import { Alert, Box, Button, Checkbox, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import LabelPreview from "../components/labels/LabelPreview";
import type { LabelFields } from "../components/labels/LabelPreview";
import type { Commessa, Pannello } from "../types/excel";
import type { ImpostazioneOperativa } from "../models/Settings";

interface Props { commesse:Commessa[]; listeOperative:ImpostazioneOperativa[]; onBack:()=>void; }
const now = () => new Intl.DateTimeFormat("it-IT", { dateStyle:"short", timeStyle:"medium" }).format(new Date());
const initialFields=(listeOperative:ImpostazioneOperativa[]):LabelFields => ({ anno:String(new Date().getFullYear()), commessa:"", cliente:"", riferimento:"", tipologia:"CLT L3-100", dtp:"Jlenia Pedrotti", operatore:"T.T.", autMin:"59/15-CL", codiceEta:"ETA-12/0362", cpr:listeOperative.find(item=>item.chiave==="CPR"&&item.attivo)?.valore??"", dataOra:now(), rotate:false });

export default function PrintLabels({ commesse, listeOperative, onBack }:Props) {
  const [selectedOrder,setSelectedOrder] = useState(commesse[0]?.ordine ?? "");
  const [panels,setPanels] = useState<Pannello[]>([]); const [selected,setSelected] = useState<Set<number>>(new Set());
  const [fields,setFields] = useState(()=>initialFields(listeOperative));
  const commessa = commesse.find(item => item.ordine === selectedOrder);
  useEffect(() => { if (!commessa) { setPanels([]); setSelected(new Set()); return; } setPanels(commessa.pannelli.map(p=>({...p}))); setSelected(new Set(commessa.pannelli.map((_,i)=>i))); setFields(c=>({...c,commessa:commessa.ordine,cliente:commessa.cliente,riferimento:commessa.riferimento})); },[commessa]);
  const preview = useMemo(()=>panels.filter((_,index)=>selected.has(index)),[panels,selected]);
  const setField=(name:keyof LabelFields,value:string|boolean)=>setFields(c=>({...c,[name]:value}));
  const update=(index:number,name:"spessore"|"lunghezza"|"altezza"|"peso",raw:string)=>setPanels(c=>c.map((p,i)=>i===index?{...p,[name]:Number(raw)||0}:p));
  const toggle=(index:number)=>setSelected(c=>{const n=new Set(c);if(n.has(index)) n.delete(index);else n.add(index);return n;});
  const printLabels=()=>{flushSync(()=>setFields(c=>({...c,dataOra:now()})));window.print();};
  return <Box>
    <style>{`
      .print-label{width:250mm;height:100mm;background:#fff;color:#151515;border:1px solid #777;padding:6mm 8mm;display:grid;grid-template-columns:26mm 1fr 50mm;grid-template-rows:27mm 1fr;gap:3mm 5mm;position:relative;font:10.5pt Arial,sans-serif;box-sizing:border-box;margin:28px auto;box-shadow:0 4px 18px #0008;transform-origin:center}.label-brand{display:flex;align-items:flex-start;justify-content:center;border-bottom:1.5px solid}.label-logo{display:block;width:23mm;height:23mm;object-fit:contain;filter:none;opacity:1;mix-blend-mode:normal;-webkit-print-color-adjust:exact;print-color-adjust:exact}.label-heading{border-bottom:1.5px solid;display:grid;grid-template-columns:1fr 1.35fr .75fr .8fr;column-gap:5mm;align-items:start}.label-heading>div:not(.heading-ce){display:grid;grid-template-rows:4mm 11mm auto;align-items:start}.label-heading small,.label-details span,.label-codes small{text-transform:uppercase;font-size:7pt;letter-spacing:.04em}.label-heading .heading-value{font-family:Arial,sans-serif;font-size:28pt;font-weight:900;line-height:11mm;white-space:nowrap;align-self:start}.label-heading span{font-size:7.5pt;margin-top:1mm}.label-heading .heading-ce{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center;line-height:1.05;padding-top:0}.label-heading .heading-ce-mark{display:block;width:9mm;height:5mm;object-fit:contain;filter:none;opacity:1;mix-blend-mode:normal;margin-bottom:.5mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}.label-heading .heading-ce>b{font-size:7pt;line-height:3mm}.label-heading .heading-ce>small{font-size:5.5pt;line-height:2.5mm;letter-spacing:0;white-space:nowrap}.label-heading .heading-ce>small+ b{margin-top:1mm}.label-heading .heading-ce>.heading-cpr-label{font-size:5pt;line-height:2mm;margin-top:.3mm}.label-heading .heading-ce>.heading-cpr-value{font-size:6pt;line-height:2.5mm;margin-top:0}.label-details{grid-column:1/3;display:grid;grid-template-columns:40mm 1fr;gap:1.8mm 3mm;align-content:start}.label-details>b{font-size:12pt;border-bottom:1px dotted #aaa;padding-bottom:.7mm}.label-details .large{font-size:14pt}.label-codes{grid-column:3;grid-row:1/3;border-left:1.5px solid;padding-left:4mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.5mm}.label-codes svg{width:27mm;height:27mm}.label-codes>div{width:100%;border-top:1px solid #ddd;padding-top:1.5mm;text-align:center;display:flex;flex-direction:column}.label-codes>div b{font-size:9pt}.preview-caption{position:absolute;top:-20px;left:0;color:#aaa;font-size:11px}.print-label--rotated{transform:rotate(90deg);margin:82mm auto}@media print{@page{size:250mm 100mm;margin:0}body{background:#fff!important}.no-print,footer{display:none!important}.labels-preview{padding:0!important}.print-label{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-shadow:none;border:0;margin:0;break-after:page;page-break-after:always}.label-logo,.heading-ce-mark{-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-label--rotated{transform:rotate(90deg);margin:75mm auto}.preview-caption{display:none!important}}
      .label-heading .heading-ce-mark{width:12mm;height:8mm}
      .label-codes>svg{transform:translateY(-3mm)}
    `}</style>
    <Stack className="no-print" direction="row" sx={{alignItems:"center",justifyContent:"space-between",mb:2}}><Button startIcon={<ArrowBackIcon/>} onClick={onBack}>Dashboard</Button><Typography variant="h4">Stampa etichette</Typography><Box sx={{width:110}}/></Stack>
    <Paper className="no-print" sx={{p:2.5,mb:2}}><Typography variant="h6" sx={{mb:2}}>1. Commessa e dati etichetta</Typography>
      {commesse.length===0?<Alert severity="info">Importa prima una commessa dalla Dashboard.</Alert>:<Stack sx={{gap:1.5}}>
        <Box sx={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:1.5}}>
          <TextField select label="Commessa importata" value={selectedOrder} onChange={e=>setSelectedOrder(e.target.value)}>{commesse.map((c,i)=><MenuItem key={`${c.ordine}-${i}`} value={c.ordine}>{c.ordine} — {c.cliente}</MenuItem>)}</TextField>
          <TextField label="Anno matricola" value={fields.anno} onChange={e=>setField("anno",e.target.value)}/><TextField label="Commessa" value={fields.commessa} onChange={e=>setField("commessa",e.target.value)}/><TextField label="Cliente" value={fields.cliente} onChange={e=>setField("cliente",e.target.value)}/><TextField label="Riferimento ordine" value={fields.riferimento} onChange={e=>setField("riferimento",e.target.value)}/>
        </Box>
        <Box sx={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:1.5}}>
          <TextField label="Tipologia" value={fields.tipologia} onChange={e=>setField("tipologia",e.target.value)}/><TextField label="DTP" value={fields.dtp} onChange={e=>setField("dtp",e.target.value)}/><TextField label="Operatore" value={fields.operatore} onChange={e=>setField("operatore",e.target.value)}/><TextField label="Aut-Min" value={fields.autMin} onChange={e=>setField("autMin",e.target.value)}/><TextField label="Codice ETA" value={fields.codiceEta} onChange={e=>setField("codiceEta",e.target.value)}/>
        </Box>
      </Stack>}
    </Paper>
    {commessa&&<Paper className="no-print" sx={{p:2.5,mb:2}}><Typography variant="h6" sx={{mb:2}}>2. Pannelli da stampare</Typography><Stack direction="row" sx={{gap:1,mb:1.5}}><Button variant="outlined" onClick={()=>setSelected(new Set(panels.map((_,i)=>i)))}>Seleziona tutti</Button><Button variant="outlined" onClick={()=>setSelected(new Set())}>Deseleziona tutti</Button></Stack>
      <TableContainer sx={{maxHeight:460}}><Table stickyHeader size="small"><TableHead><TableRow>{["","Pannello","Master panel","Camion","Spessore","Lunghezza","Altezza","Peso (kg)"].map(h=><TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead><TableBody>{panels.map((panel,index)=><TableRow hover key={index}><TableCell><Checkbox checked={selected.has(index)} onChange={()=>toggle(index)}/></TableCell><TableCell><b>{panel.numeroPannello}</b></TableCell><TableCell>{panel.numeroMasterPanel}</TableCell><TableCell>{panel.numeroCamion}</TableCell>{(["spessore","lunghezza","altezza","peso"] as const).map(name=><TableCell key={name}><TextField type="number" size="small" value={panel[name]} onChange={e=>update(index,name,e.target.value)} sx={{width:100}}/></TableCell>)}</TableRow>)}</TableBody></Table></TableContainer>
    </Paper>}
    {commessa&&<Paper className="labels-preview" sx={{p:2.5}}><Stack className="no-print" direction="row" sx={{justifyContent:"space-between",alignItems:"center"}}><Typography variant="h6">3. Anteprima — {selected.size} etichette</Typography><Button variant="contained" color="secondary" startIcon={<PrintIcon/>} disabled={!selected.size} onClick={printLabels}>Stampa etichette</Button></Stack>{preview.length===0?<Typography className="no-print" color="text.secondary" sx={{py:3,textAlign:"center"}}>Nessun pannello selezionato</Typography>:preview.map((p,i)=><LabelPreview key={`${p.numeroPannello}-${i}`} panel={p} fields={fields} index={panels.indexOf(p)}/>)}</Paper>}
  </Box>;
}
