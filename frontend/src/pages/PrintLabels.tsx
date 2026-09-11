import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintIcon from "@mui/icons-material/Print";
import { Alert, Box, Button, Checkbox, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
import LabelPreview from "../components/labels/LabelPreview";
import "../components/labels/elementLabel.css";
import type { LabelFields } from "../components/labels/LabelPreview";
import type { Commessa, Pannello } from "../types/excel";
import type { ImpostazioneOperativa } from "../models/Settings";

interface Props { commesse:Commessa[]; listeOperative:ImpostazioneOperativa[]; onBack:()=>void; }
const now = () => new Intl.DateTimeFormat("it-IT", { dateStyle:"short", timeStyle:"medium" }).format(new Date());
const initialFields=(listeOperative:ImpostazioneOperativa[]):LabelFields => ({ anno:String(new Date().getFullYear()), commessa:"", cliente:"", riferimento:"", tipologia:"CLT L3-100", dtp:"Jlenia Pedrotti", operatore:"T.T.", autMin:"59/15-CL", codiceEta:"ETA-12/0362", cpr:listeOperative.find(item=>item.chiave==="CPR"&&item.attivo)?.valore??"", dataOra:now(), rotate:false });
const labelWidthPx=200*96/25.4;
const labelHeightPx=100*96/25.4;

function MobileLabelPreview({panel,fields,index}:{panel:Pannello;fields:LabelFields;index:number}) {
  const containerRef=useRef<HTMLDivElement>(null);
  const [scale,setScale]=useState(0);
  useEffect(()=>{const element=containerRef.current;if(!element)return;const resize=()=>setScale(Math.min(1,element.clientWidth/labelWidthPx));resize();const observer=new ResizeObserver(resize);observer.observe(element);return()=>observer.disconnect();},[]);
  return <Box ref={containerRef} className="scaled-label-preview" sx={{height:scale?labelHeightPx*scale:0,overflow:"hidden",position:"relative",width:"100%"}}><Box className="scaled-label-preview-inner" sx={{left:"50%",position:"absolute",top:0,transform:`translateX(-50%) scale(${scale})`,transformOrigin:"top center",width:labelWidthPx}}><LabelPreview panel={panel} fields={fields} index={index}/></Box></Box>;
}

export default function PrintLabels({ commesse, listeOperative, onBack }:Props) {
  const theme=useTheme();
  const mobile=useMediaQuery(theme.breakpoints.down("sm"));
  const [selectedOrder,setSelectedOrder] = useState(commesse[0]?.ordine ?? "");
  const [panels,setPanels] = useState<Pannello[]>([]); const [selected,setSelected] = useState<Set<number>>(new Set());
  const [fields,setFields] = useState(()=>initialFields(listeOperative));
  const commessa = commesse.find(item => item.ordine === selectedOrder);
  useEffect(() => { if (!commessa) { setPanels([]); setSelected(new Set()); return; } setPanels(commessa.pannelli.map(p=>({...p}))); setSelected(new Set(commessa.pannelli.map((_,i)=>i))); setFields(c=>({...c,commessa:commessa.ordine,cliente:commessa.cliente,riferimento:commessa.riferimento})); },[commessa]);
  const preview = useMemo(()=>panels.filter((_,index)=>selected.has(index)),[panels,selected]);
  const trucks = useMemo(() => Array.from(new Set(panels.map(panel => String(panel.numeroCamion).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "it", { numeric:true, sensitivity:"base" })), [panels]);
  const setField=(name:keyof LabelFields,value:string|boolean)=>setFields(c=>({...c,[name]:value}));
  const update=(index:number,name:"spessore"|"lunghezza"|"altezza"|"peso",raw:string)=>setPanels(c=>c.map((p,i)=>i===index?{...p,[name]:Number(raw)||0}:p));
  const toggle=(index:number)=>setSelected(c=>{const n=new Set(c);if(n.has(index)) n.delete(index);else n.add(index);return n;});
  const selectTruck=(truck:string)=>setSelected(new Set(panels.map((panel,index)=>String(panel.numeroCamion).trim()===truck?index:-1).filter(index=>index>=0)));
  const printLabels=()=>{flushSync(()=>setFields(c=>({...c,dataOra:now()})));window.print();};
  return <Box>

    <Stack className="no-print" direction={{xs:"column",sm:"row"}} sx={{alignItems:{xs:"stretch",sm:"center"},justifyContent:"space-between",gap:{xs:1,sm:0},mb:2}}><Button startIcon={<ArrowBackIcon/>} onClick={onBack} sx={{alignSelf:{xs:"flex-start",sm:"auto"}}}>Dashboard</Button><Typography variant={mobile?"h5":"h4"} sx={{fontWeight:800,textAlign:"center"}}>Stampa etichette</Typography><Box sx={{display:{xs:"none",sm:"block"},width:110}}/></Stack>
    <Paper className="no-print" sx={{p:{xs:1.5,sm:2.5},mb:2}}><Typography variant="h6" sx={{mb:2}}>1. Commessa e dati etichetta</Typography>
      {commesse.length===0?<Alert severity="info">Importa prima una commessa dalla Dashboard.</Alert>:<Stack sx={{gap:1.5}}>
        <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"repeat(5,minmax(0,1fr))"},gap:1.5}}>
          <TextField select label="Commessa importata" value={selectedOrder} onChange={e=>setSelectedOrder(e.target.value)}>{commesse.map((c,i)=><MenuItem key={`${c.ordine}-${i}`} value={c.ordine}>{c.ordine} — {c.cliente}</MenuItem>)}</TextField>
          <TextField label="Anno matricola" value={fields.anno} onChange={e=>setField("anno",e.target.value)}/><TextField label="Commessa" value={fields.commessa} onChange={e=>setField("commessa",e.target.value)}/><TextField label="Cliente" value={fields.cliente} onChange={e=>setField("cliente",e.target.value)}/><TextField label="Riferimento ordine" value={fields.riferimento} onChange={e=>setField("riferimento",e.target.value)}/>
        </Box>
        <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"repeat(5,minmax(0,1fr))"},gap:1.5}}>
          <TextField label="Tipologia" value={fields.tipologia} onChange={e=>setField("tipologia",e.target.value)}/><TextField label="DTP" value={fields.dtp} onChange={e=>setField("dtp",e.target.value)}/><TextField label="Operatore" value={fields.operatore} onChange={e=>setField("operatore",e.target.value)}/><TextField label="Aut-Min" value={fields.autMin} onChange={e=>setField("autMin",e.target.value)}/><TextField label="Codice ETA" value={fields.codiceEta} onChange={e=>setField("codiceEta",e.target.value)}/>
        </Box>
      </Stack>}
    </Paper>
    {commessa&&<Paper className="no-print" sx={{p:{xs:1.5,sm:2.5},mb:2}}><Typography variant="h6" sx={{mb:2}}>2. Elementi da stampare</Typography><Stack direction={{xs:"column",sm:"row"}} sx={{alignItems:{xs:"stretch",sm:"center"},gap:1,mb:1.5,flexWrap:"wrap"}}><Button size={mobile?"large":"medium"} variant="outlined" onClick={()=>setSelected(new Set(panels.map((_,i)=>i)))}>Seleziona tutti</Button><Button size={mobile?"large":"medium"} variant="outlined" onClick={()=>setSelected(new Set())}>Deseleziona tutti</Button>{trucks.length>0&&<Stack direction="row" sx={{alignItems:"center",gap:1,ml:{xs:0,sm:1},flexWrap:"wrap"}}><Typography variant="body2" color="text.secondary">Seleziona carico:</Typography>{trucks.map(truck=><Button key={truck} variant="outlined" size={mobile?"medium":"small"} onClick={()=>selectTruck(truck)}>{truck}</Button>)}</Stack>}</Stack><Typography color="text.secondary" sx={{mb:1.5,fontWeight:700}}>{selected.size} {selected.size===1?"elemento selezionato":"elementi selezionati"}</Typography>
      {!mobile?<TableContainer sx={{maxHeight:460}}><Table stickyHeader size="small"><TableHead><TableRow>{["","Elemento","Master panel","Camion","Spessore","Lunghezza","Altezza","Peso (kg)"].map(h=><TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead><TableBody>{panels.map((panel,index)=><TableRow hover key={index}><TableCell><Checkbox checked={selected.has(index)} onChange={()=>toggle(index)}/></TableCell><TableCell><b>{panel.numeroPannello}</b></TableCell><TableCell>{panel.numeroMasterPanel}</TableCell><TableCell>{panel.numeroCamion}</TableCell>{(["spessore","lunghezza","altezza","peso"] as const).map(name=><TableCell key={name}><TextField type="number" size="small" value={panel[name]} onChange={e=>update(index,name,e.target.value)} sx={{width:100}}/></TableCell>)}</TableRow>)}</TableBody></Table></TableContainer>:<Stack sx={{gap:1.25}}>{panels.map((panel,index)=><Paper key={`${panel.numeroPannello}-${index}`} variant="outlined" sx={{p:1.5,borderColor:selected.has(index)?"primary.main":"divider"}}><Stack direction="row" sx={{alignItems:"center",gap:1,mb:1.25}}><Checkbox checked={selected.has(index)} onChange={()=>toggle(index)} slotProps={{input:{"aria-label":`Seleziona elemento ${panel.numeroPannello}`}}} sx={{p:.5,"& .MuiSvgIcon-root":{fontSize:32}}}/><Box sx={{minWidth:0}}><Typography sx={{fontWeight:900,fontSize:"1.05rem"}}>Elemento {panel.numeroPannello}</Typography><Typography variant="body2" color="text.secondary">Master Panel {panel.numeroMasterPanel} · Camion {panel.numeroCamion}</Typography></Box></Stack><Box sx={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:1}}>{(["spessore","lunghezza","altezza","peso"] as const).map(name=><TextField key={name} fullWidth type="number" size="small" label={name==="spessore"?"Spessore":name==="lunghezza"?"Lunghezza":name==="altezza"?"Altezza":"Peso (kg)"} value={panel[name]} onChange={e=>update(index,name,e.target.value)}/>)}</Box></Paper>)}</Stack>}
    </Paper>}
    {commessa&&<Paper className="labels-preview" sx={{p:{xs:1.5,sm:2.5},overflowX:"hidden"}}><Stack className="no-print" direction={{xs:"column",sm:"row"}} sx={{justifyContent:"space-between",alignItems:{xs:"stretch",sm:"center"},gap:1.5}}><Typography variant="h6">3. Anteprima — {selected.size} etichette</Typography><Button fullWidth={mobile} size={mobile?"large":"medium"} variant="contained" color="secondary" startIcon={<PrintIcon/>} disabled={!selected.size} onClick={printLabels}>Stampa etichette</Button></Stack>{preview.length===0?<Typography className="no-print" color="text.secondary" sx={{py:3,textAlign:"center"}}>Nessun elemento selezionato</Typography>:preview.map((p,i)=>mobile?<MobileLabelPreview key={`${p.numeroPannello}-${i}`} panel={p} fields={fields} index={panels.indexOf(p)}/>:<LabelPreview key={`${p.numeroPannello}-${i}`} panel={p} fields={fields} index={panels.indexOf(p)}/>)}</Paper>}
  </Box>;
}
