import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import QrCodeScannerOutlinedIcon from "@mui/icons-material/QrCodeScannerOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { Box, Button, Paper } from "@mui/material";

export type PrimaryNavigationPage=
  | "dashboard"
  | "import"
  | "labels"
  | "scanning-list"
  | "warehouse"
  | "loading"
  | "transports"
  | "shipments"
  | "history"
  | "settings";

interface Props {
  activePage:PrimaryNavigationPage;
  onNavigate:(page:PrimaryNavigationPage)=>void;
}

const items:ReadonlyArray<{page:PrimaryNavigationPage;label:string;icon:React.ReactNode}>=[
  {page:"dashboard",label:"Dashboard",icon:<DashboardOutlinedIcon/>},
  {page:"import",label:"Importa",icon:<UploadFileOutlinedIcon/>},
  {page:"labels",label:"Etichette",icon:<PrintOutlinedIcon/>},
  {page:"scanning-list",label:"Scansione",icon:<QrCodeScannerOutlinedIcon/>},
  {page:"warehouse",label:"Magazzino",icon:<Inventory2OutlinedIcon/>},
  {page:"loading",label:"Carico camion",icon:<LocalShippingOutlinedIcon/>},
  {page:"transports",label:"Trasporti",icon:<RouteOutlinedIcon/>},
  {page:"shipments",label:"Spedizioni",icon:<EventNoteOutlinedIcon/>},
  {page:"history",label:"Storico",icon:<HistoryOutlinedIcon/>},
  {page:"settings",label:"Impostazioni",icon:<SettingsOutlinedIcon/>},
];

export default function PrimaryNavigation({activePage,onNavigate}:Props){
  return <Paper component="nav" aria-label="Navigazione principale" className="no-print" variant="outlined" sx={{mb:1.5,p:.5,borderRadius:2,bgcolor:"background.paper"}}>
    <Box sx={{display:"grid",gridTemplateColumns:{xs:"repeat(2,minmax(0,1fr))",sm:"repeat(5,minmax(0,1fr))",md:"repeat(10,minmax(0,1fr))"},gap:.35}}>
      {items.map(item=>{
        const active=item.page===activePage;
        return <Button key={item.page} aria-current={active?"page":undefined} onClick={()=>onNavigate(item.page)} startIcon={item.icon} variant={active?"contained":"text"} color={active?"primary":"inherit"} sx={{minWidth:0,minHeight:38,px:{xs:.5,md:.35,lg:.75},fontSize:{xs:".72rem",md:".69rem",lg:".76rem"},fontWeight:active?900:700,lineHeight:1.1,whiteSpace:"nowrap","& .MuiButton-startIcon":{display:{xs:"inherit",md:"none",xl:"inherit"},m:0,mr:{xs:.5,md:0,xl:.5}},"& .MuiSvgIcon-root":{fontSize:"1rem"}}}>{item.label}</Button>;
      })}
    </Box>
  </Paper>;
}
