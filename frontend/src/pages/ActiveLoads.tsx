import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { Box, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useState } from "react";
import type { Camion } from "../models/Camion";
import type { Pacco } from "../models/Scanning";
import type { Commessa } from "../types/excel";
import { dashboardVisualStatus } from "../components/dashboard/dashboardVisualStatus";
import { scanningActiveLoads } from "../services/scanningActiveLoads";
import { sortOperationalRows, type OperationalSortDirection } from "../services/operationalTableSorting";

interface Props { rows:Camion[]; commesse:Commessa[]; packages:Pacco[]; activeSessions:Set<string>; onOpen:(row:Camion)=>void; }
const sessionKey=(row:Camion)=>`${row.commessa}\u0000${row.camion}`;
type SortKey="commessa"|"cliente"|"camion"|"previsti"|"pronti"|"mancanti"|"packages"|"stato";
const columns:Array<{label:string;key?:SortKey}>=[{label:"Commessa",key:"commessa"},{label:"Cliente",key:"cliente"},{label:"Camion",key:"camion"},{label:"Previsti",key:"previsti"},{label:"Disponibili",key:"pronti"},{label:"Mancanti",key:"mancanti"},{label:"Pacchi creati",key:"packages"},{label:"Stato",key:"stato"},{label:"Operazione"}];
export default function ActiveLoads({rows,commesse,packages,activeSessions,onOpen}:Props){
  const theme=useTheme();
  const narrowPhone=useMediaQuery(theme.breakpoints.down("sm"));
  const landscapePhone=useMediaQuery("(max-width:950px) and (max-height:500px)");
  const mobile=narrowPhone||landscapePhone;
  const active=scanningActiveLoads(rows,commesse,packages);
  const [sortKey,setSortKey]=useState<SortKey|null>(null);
  const [sortDirection,setSortDirection]=useState<OperationalSortDirection>("asc");
  const requestSort=(key:SortKey)=>{if(sortKey===key)setSortDirection(current=>current==="asc"?"desc":"asc");else{setSortKey(key);setSortDirection("asc");}};
  const packageCounts=new Map<string,number>();
  for(const pack of packages){const key=`${pack.commessa}\u0000${pack.camion}`;packageCounts.set(key,(packageCounts.get(key)??0)+1);}
  const packsFor=(row:Camion)=>packageCounts.get(sessionKey(row))??0;
  const sorted=sortOperationalRows(active,sortKey,sortDirection,(row,key)=>key==="packages"?packsFor(row):key==="stato"?dashboardVisualStatus(row).label:row[key]);
  return <Box sx={mobile?{mx:-1,overflowX:"hidden",pb:2}:undefined}>{mobile?<Stack sx={{gap:1.25,px:1}}>{active.map(row=>{const started=activeSessions.has(sessionKey(row));const packs=packsFor(row);const status=dashboardVisualStatus(row);return <Paper key={row.id} variant="outlined" sx={{boxSizing:"border-box",p:1.5,width:"100%"}}><Stack direction="row" sx={{alignItems:"flex-start",justifyContent:"space-between",gap:1}}><Box sx={{minWidth:0}}><Typography sx={{fontSize:"1.08rem",fontWeight:900}}>Commessa {row.commessa}</Typography><Typography sx={{fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.cliente}</Typography><Typography color="text.secondary" variant="body2">Camion {row.camion}</Typography></Box><Chip color={status.color} label={status.label} size="small" variant="outlined" sx={{fontWeight:700}}/></Stack><Box sx={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:.75,mt:1.5}}>{[["Previsti",row.previsti],["Disponibili",row.pronti],["Mancanti",row.mancanti]].map(([label,value])=><Box key={String(label)} sx={{minWidth:0,textAlign:"center"}}><Typography sx={{fontWeight:900,lineHeight:1.2}}>{value}</Typography><Typography color="text.secondary" variant="caption" sx={{display:"block",lineHeight:1.2}}>{label}</Typography></Box>)}</Box><Typography color="text.secondary" variant="body2" sx={{mt:1.25}}>Pacchi: {packs}</Typography><Button fullWidth size="large" startIcon={<PlayArrowIcon/>} sx={{mt:1.5}} variant="contained" onClick={()=>onOpen(row)}>{started?"Continua":"Apri scansione"}</Button></Paper>})}{!active.length&&<Typography color="text.secondary" sx={{py:4,textAlign:"center"}}>Nessuna commessa da scansionare</Typography>}</Stack>:<Paper sx={{p:2}}><Typography variant="h6" sx={{mb:1.5}}>Liste di carico attive</Typography><Table><TableHead><TableRow>{columns.map(({label,key})=><TableCell key={label}>{key?<TableSortLabel active={sortKey===key} direction={sortKey===key?sortDirection:"asc"} onClick={()=>requestSort(key)}>{label}</TableSortLabel>:label}</TableCell>)}</TableRow></TableHead><TableBody sx={{"& > .MuiTableRow-root > .MuiTableCell-root":{paddingTop:"7px !important",paddingBottom:"7px !important"}}}>{sorted.map(row=>{const started=activeSessions.has(sessionKey(row));const packs=packsFor(row);const status=dashboardVisualStatus(row);return <TableRow hover key={row.id} onClick={()=>onOpen(row)} sx={{cursor:"pointer"}}><TableCell>{row.commessa}</TableCell><TableCell>{row.cliente}</TableCell><TableCell>{row.camion}</TableCell><TableCell>{row.previsti}</TableCell><TableCell>{row.pronti}</TableCell><TableCell>{row.mancanti}</TableCell><TableCell>{packs}</TableCell><TableCell><Chip label={status.label.toLocaleUpperCase("it-IT")} color={status.color} variant="outlined"/></TableCell><TableCell><Button variant="contained" onClick={event=>{event.stopPropagation();onOpen(row);}}>{started?"Continua":"Apri scansione"}</Button></TableCell></TableRow>})}</TableBody></Table>{!sorted.length&&<Typography color="text.secondary" sx={{py:4,textAlign:"center"}}>Nessuna commessa da scansionare</Typography>}</Paper>}</Box>;
}
