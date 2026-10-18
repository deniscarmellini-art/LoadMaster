import { Chip } from "@mui/material";
import type { Camion } from "../../models/Camion";
import { dashboardVisualStatus } from "./dashboardVisualStatus";

export default function DashboardStatusBadge({row,onConfirmDeparture,mobile=false}:{row:Camion;onConfirmDeparture:(row:Camion)=>void;mobile?:boolean}) {
  const status=dashboardVisualStatus(row);
  const waiting=row.stato==="Attesa spedizione";
  return <Chip
    color={status.color}
    label={mobile?status.label.toUpperCase():status.label}
    size="small"
    variant="outlined"
    {...(waiting?{
      clickable:true,
      title:"Apri conferma partenza",
      onClick:(event:React.MouseEvent)=>{event.stopPropagation();onConfirmDeparture(row);},
      onDoubleClick:(event:React.MouseEvent)=>event.stopPropagation(),
    }:{})}
    sx={mobile?{flexShrink:0,fontWeight:800}:{fontWeight:700,height:30,minWidth:0,maxWidth:"100%","& .MuiChip-label":{px:1,textAlign:"center",width:"100%"}}}
  />;
}
