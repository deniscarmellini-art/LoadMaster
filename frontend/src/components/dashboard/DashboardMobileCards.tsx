import { useState } from "react";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import QrCodeScannerOutlinedIcon from "@mui/icons-material/QrCodeScannerOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import { Box, Button, Chip, IconButton, Menu, MenuItem, Paper, Stack, Typography } from "@mui/material";

import type { Camion } from "../../models/Camion";
import type { ShipmentItem } from "../../services/shipmentsApi";
import PlannedDepartureDate from "../shipments/PlannedDepartureDate";
import { dashboardPrimaryLabel, runDashboardPrimaryAction, type DashboardPrimaryHandlers } from "./dashboardPrimaryAction";
import type { DashboardTransportPresentation } from "./dashboardTransport";

interface Props extends DashboardPrimaryHandlers {
  hasPackages: (row: Camion) => boolean;
  onPrintPackages: (row: Camion) => void;
  rows: Camion[];
  shipmentFor: (row: Camion) => ShipmentItem | undefined;
  transportFor: (row: Camion) => DashboardTransportPresentation;
}

const statusColor = (status: Camion["stato"]) => status === "In carico" ? "warning" : status === "Attesa spedizione" || status === "Partita" ? "success" : status === "Da caricare" ? "info" : "error";

export default function DashboardMobileCards(props: Props) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuRow, setMenuRow] = useState<Camion | null>(null);
  const handlers: DashboardPrimaryHandlers = props;
  const closeMenu = () => { setMenuAnchor(null); setMenuRow(null); };
  const secondary = (action: (row: Camion) => void) => { if (menuRow) action(menuRow); closeMenu(); };

  return <Stack sx={{ gap: 1 }}>
    {props.rows.map((row) => {
      const shipment = props.shipmentFor(row);
      const transport = props.transportFor(row);
      return <Paper key={row.id} variant="outlined" onClick={() => runDashboardPrimaryAction(row, handlers)} sx={{ p: 1.5, cursor: "pointer", overflow: "hidden", "&:active": { bgcolor: "action.selected" } }}>
      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.02rem", fontWeight: 900 }}>Commessa {row.commessa}</Typography>
          <Typography noWrap sx={{ fontWeight: 700 }}>{row.cliente}</Typography>
          <Typography variant="body2" color="text.secondary">Camion {row.camion}</Typography>
        </Box>
        <Chip color={statusColor(row.stato)} label={row.stato.toUpperCase()} size="small" variant="outlined" sx={{ flexShrink: 0, fontWeight: 800 }} />
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", my: 1.25 }}>
        {[["Previsti", row.previsti], ["Pronti", row.pronti], ["Caricati", row.caricati]].map(([label, value]) => <Box key={label} sx={{ textAlign: "center" }}><Typography sx={{ fontWeight: 900 }}>{value}</Typography><Typography variant="caption" color="text.secondary">{label}</Typography></Box>)}
      </Box>
      <Stack direction="row" sx={{ color: "text.secondary", justifyContent: "space-between", mb: 1.25 }}>
        <Typography variant="body2">Peso <b>{row.peso.toLocaleString("it-IT", { maximumFractionDigits: 1 })} kg</b></Typography>
        <Typography variant="body2">Volume <b>{row.volume.toLocaleString("it-IT", { maximumFractionDigits: 2 })} m³</b></Typography>
      </Stack>
      <Typography variant="body2" sx={{ mb: 1.25 }}>
        Partenza prevista: {shipment ? <PlannedDepartureDate shipment={shipment} /> : "—"}
      </Typography>
      <Typography variant="body2">
        Trasporto: {transport.transport}
      </Typography>
      {transport.trailer && (
        <Typography variant="body2">Rimorchio: {transport.trailer}</Typography>
      )}
      {transport.carrier && (
        <Typography variant="body2">Trasportatore: {transport.carrier}</Typography>
      )}
      <Stack direction="row" sx={{ gap: 1, mt: 1.25 }}>
        <Button fullWidth size="large" variant="contained" onClick={(event) => { event.stopPropagation(); runDashboardPrimaryAction(row, handlers); }}>{dashboardPrimaryLabel(row)}</Button>
        <IconButton aria-label={`Altre azioni commessa ${row.commessa}`} onClick={(event) => { event.stopPropagation(); setMenuAnchor(event.currentTarget); setMenuRow(row); }} sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, minHeight: 44, minWidth: 44 }}><MoreVertIcon /></IconButton>
      </Stack>
    </Paper>;
    })}
    {!props.rows.length && <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>Nessun carico attivo</Typography>}
    <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
      {menuRow?.stato === "Da completare" && <MenuItem onClick={() => secondary(props.onOpenScanning)}><QrCodeScannerOutlinedIcon sx={{ mr: 1.5 }} />Scansione pannelli</MenuItem>}
      {(menuRow?.stato === "Da caricare" || menuRow?.stato === "In carico") && <MenuItem onClick={() => secondary(menuRow.stato === "In carico" ? props.onContinueLoad : props.onStartLoad)}><LocalShippingOutlinedIcon sx={{ mr: 1.5 }} />Carico camion</MenuItem>}
      {menuRow && props.hasPackages(menuRow) && <MenuItem onClick={() => secondary(props.onPrintPackages)}><PrintOutlinedIcon sx={{ mr: 1.5 }} />Stampa etichette</MenuItem>}
    </Menu>
  </Stack>;
}
