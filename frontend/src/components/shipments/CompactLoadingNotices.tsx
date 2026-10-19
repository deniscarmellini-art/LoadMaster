import { Box, Typography } from "@mui/material";

export default function CompactLoadingNotices({problem,planId,loadId,truck,viewOnly,previous}:{problem?:string|null;planId?:string;loadId:string;truck:string;viewOnly:boolean;previous?:{completatoIl?:string;operatore:string}|null}) {
  const detailsSx={fontSize:12,border:1,borderColor:"divider",borderRadius:1,px:1,py:.5,minWidth:0,overflowWrap:"anywhere","& > summary":{cursor:"pointer",fontWeight:700}};
  return <Box sx={{display:"flex",flexWrap:"wrap",alignItems:"start",gap:1,my:1}}>
    <Box component="details" sx={{...detailsSx,color:problem?"warning.main":"info.main"}}>
      <Box component="summary">{problem??"Pianificazione collegata"}</Box>
      <Typography variant="caption" component="div">Camion: {truck}<br/>ID carico: {loadId}{planId&&<><br/>ID pianificazione: {planId}</>}</Typography>
    </Box>
    {previous&&<Box component="details" sx={{...detailsSx,color:"info.main"}}>
      <Box component="summary">{viewOnly?"Consultazione carico - nessuna modifica automatica":"Carico riaperto - modifiche in corso"}</Box>
      <Typography variant="caption" component="div">Chiusura precedente: {previous.completatoIl?new Date(previous.completatoIl).toLocaleString("it-IT"):"—"}<br/>Operatore: {previous.operatore||"—"}</Typography>
    </Box>}
  </Box>;
}
