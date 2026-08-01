import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { Box, Button, Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import type { Camion } from "../models/Camion";
import type { Pacco } from "../models/Scanning";

interface Props { rows:Camion[]; packages:Pacco[]; activeSessions:Set<string>; onBack:()=>void; onOpen:(row:Camion)=>void; }
const sessionKey=(row:Camion)=>`${row.commessa}\u0000${row.camion}`;
export default function ActiveLoads({rows,packages,activeSessions,onBack,onOpen}:Props){
  const active=rows.filter(row=>row.stato!=="Partita");
  return <Box><Box sx={{display:"flex",alignItems:"center",mb:2}}><Button startIcon={<ArrowBackIcon/>} onClick={onBack}>Dashboard</Button><Typography variant="h4" sx={{fontWeight:800,mx:"auto"}}>Scansione pannelli</Typography></Box><Paper sx={{p:2}}><Typography variant="h6" sx={{mb:1.5}}>Liste di carico attive</Typography><Table><TableHead><TableRow>{["Commessa","Cliente","Camion","Previsti","Disponibili","Mancanti","Pacchi creati","Stato","Operazione"].map(h=><TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead><TableBody>{active.map(row=>{const started=activeSessions.has(sessionKey(row));const packs=packages.filter(pack=>pack.commessa===row.commessa&&pack.camion===row.camion).length;return <TableRow hover key={row.id} onClick={()=>onOpen(row)} sx={{cursor:"pointer"}}><TableCell>{row.commessa}</TableCell><TableCell>{row.cliente}</TableCell><TableCell>{row.camion}</TableCell><TableCell>{row.previsti}</TableCell><TableCell>{row.pronti}</TableCell><TableCell>{row.mancanti}</TableCell><TableCell>{packs}</TableCell><TableCell><Chip label={row.stato} size="small" variant="outlined"/></TableCell><TableCell><Button startIcon={<PlayArrowIcon/>} variant="outlined" onClick={event=>{event.stopPropagation();onOpen(row);}}>{started?"Continua":"Apri scansione"}</Button></TableCell></TableRow>})}</TableBody></Table>{!active.length&&<Typography color="text.secondary" sx={{py:4,textAlign:"center"}}>Nessuna lista di carico attiva</Typography>}</Paper></Box>;
}
