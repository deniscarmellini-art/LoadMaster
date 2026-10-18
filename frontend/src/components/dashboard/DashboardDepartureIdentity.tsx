import { TextField } from "@mui/material";
import type { Camion } from "../../models/Camion";
import type { ShipmentTransportType } from "../../services/shipmentsApi";
import { shipmentTransportLabel } from "../../services/shipmentTransportPresentation";

export default function DashboardDepartureIdentity({row,mode}:{row:Camion|null;mode:ShipmentTransportType|null}) {
  return <>
    <TextField label="Commessa" value={row?.commessa??""} slotProps={{input:{readOnly:true}}}/>
    <TextField label="Cliente" value={row?.cliente??""} slotProps={{input:{readOnly:true}}}/>
    <TextField label="Camion" value={row?.camion??""} slotProps={{input:{readOnly:true}}}/>
    <TextField label="Modalità di trasporto" value={mode?shipmentTransportLabel(mode):"—"} slotProps={{input:{readOnly:true}}} sx={{gridColumn:"1 / -1"}}/>
  </>;
}
