import CompactOperationalSummary from "../shared/CompactOperationalSummary";
import { Box, Paper, Typography } from "@mui/material";
import { panelScanningSummaryFields, type PanelScanningSummaryData } from "../../services/panelScanningSummary";

export default function PanelScanningSummary(props: PanelScanningSummaryData) {
  if(import.meta.env.VITE_SISLOG_TEST===true){
    const fields=panelScanningSummaryFields(props);
    const ordered=[fields[0]!,fields[2]!,fields[1]!,fields[3]!,...fields.slice(4)];
    return <CompactOperationalSummary fields={ordered} label="Riepilogo scansione elemento finito"/>;
  }
  return <Box aria-label="Riepilogo scansione elemento finito" sx={{
    display: "grid", gridTemplateColumns: {
      xs: "repeat(2,minmax(0,1fr))", sm: "repeat(4,minmax(0,1fr))",
      lg: "minmax(0,1.7fr) minmax(0,1.7fr) repeat(6,minmax(0,1fr))",
    }, gap: 1.5, alignItems: "stretch",
  }}>
    {panelScanningSummaryFields(props).map(([label, value], index) => <Paper key={label} sx={{ p: 1.5, minWidth: 0, textAlign: index < 4 ? "left" : "center" }}>
      <Typography color="text.secondary" variant="caption" sx={{ fontWeight: index < 4 ? 700 : undefined, textTransform: index < 4 ? "uppercase" : undefined }}>{label}</Typography>
      <Typography variant={index < 4 ? "body1" : "h6"} sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>{value}</Typography>
    </Paper>)}
  </Box>;
}
