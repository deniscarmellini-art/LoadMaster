import { Box, Typography } from "@mui/material";
import type { Camion } from "../../models/Camion";
import type { Commessa } from "../../types/excel";
import { truckLoadingHeaderRows } from "../../services/truckLoadingHeader";

export default function TruckLoadingHeader({ selected, commesse }: { selected: Camion; commesse: Commessa[] }) {
  return <Box aria-label="Dati del carico selezionato" sx={{ flex: 1, minWidth: 0, width: "100%", maxWidth: 1240, mx: "auto" }}>
    {truckLoadingHeaderRows(selected, commesse).map((row, index) => <Box key={index} sx={{
      display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", md: "minmax(0,320px) minmax(0,300px) minmax(0,180px) minmax(0,180px)" },
      justifyContent: "center", columnGap: 1.5, rowGap: 1, alignItems: "start", mt: index ? 1.5 : 0,
    }}>
      {[["CLIENTE", row.customer], ["RIFERIMENTO ORDINE", row.orderReference], ["COMMESSA", row.order], ["CAMION", row.truck]].map(([label, value]) =>
        <Box key={label} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: { xs: 13, md: 14 } }}>{label}</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, md: 22, lg: 24 }, overflowWrap: "anywhere" }}>{value}</Typography>
        </Box>)}
    </Box>)}
  </Box>;
}
