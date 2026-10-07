import { useMemo } from "react";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import { Box, Paper, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";

import type { Camion } from "../../models/Camion";
import type { Trasportatore } from "../../models/Settings";
import type { ShipmentItem } from "../../services/shipmentsApi";
import type { TransportItem } from "../../services/transportsApi";
import DashboardGrid from "./DashboardGrid";
import DashboardMobileCards from "./DashboardMobileCards";
import {
  dashboardTransportPresentation,
  type DashboardTransportPresentation,
} from "./dashboardTransport";
import { dashboardColors } from "../../theme/theme";

interface DashboardContentProps {
  rows: Camion[];
  referenceFor: (row: Camion) => string;
  onDelete: (row: Camion) => void;
  onOpenScanning: (row: Camion) => void;
  onStartLoad: (row: Camion) => void;
  onPrintPackages: (row: Camion) => void;
  hasPackages: (row: Camion) => boolean;
  onUpdate: () => void;
  onReopen: (row: Camion) => void;
  onContinueLoad: (row: Camion) => void;
  onConfirmDeparture: (row: Camion) => void;
  onOpenHistory: (row: Camion) => void;
  shipments: ShipmentItem[];
  carriers: Trasportatore[];
  transports: TransportItem[];
}

export default function DashboardContent({ rows, referenceFor, onDelete, onOpenScanning, onStartLoad, onPrintPackages, hasPackages, onUpdate, onReopen, onContinueLoad, onConfirmDeparture, onOpenHistory, shipments, carriers, transports }: DashboardContentProps) {
  const theme = useTheme();
  const narrowPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const landscapePhone = useMediaQuery("(max-width:950px) and (max-height:500px)");
  const mobile = narrowPhone || landscapePhone;
  const visibleRows = useMemo(
    () => rows.filter((row) => row.stato !== "Partita"),
    [rows],
  );
  const activeRowCount = visibleRows.length;
  const shipmentFor = (row: Camion) =>
    shipments.find((shipment) => shipment.loadId === row.id) ??
    shipments.find(
      (shipment) =>
        shipment.commessa === row.commessa && shipment.camion === row.camion,
    );
  const transportFor = (row: Camion): DashboardTransportPresentation =>
    dashboardTransportPresentation(shipmentFor(row), transports, carriers);

  return (
    <Paper elevation={0} sx={{ bgcolor: dashboardColors.surface, border: 1, borderColor: "divider", p: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
        <LocalShippingOutlinedIcon color="primary" sx={{ fontSize: 21 }} />
        <Typography component="h2" noWrap sx={{ minWidth: 0, fontSize: "1.08rem", fontWeight: 700, letterSpacing: 0.3 }}>
          Commesse attive ({activeRowCount})
        </Typography>
      </Stack>
      {mobile
        ? <DashboardMobileCards hasPackages={hasPackages} onConfirmDeparture={onConfirmDeparture} onContinueLoad={onContinueLoad} onOpenHistory={onOpenHistory} onOpenScanning={onOpenScanning} onPrintPackages={onPrintPackages} onStartLoad={onStartLoad} rows={visibleRows} shipmentFor={shipmentFor} transportFor={transportFor} />
        : <Box sx={{ height: 620, width: "100%" }}><DashboardGrid referenceFor={referenceFor} hasPackages={hasPackages} onConfirmDeparture={onConfirmDeparture} onContinueLoad={onContinueLoad} onDelete={onDelete} onOpenHistory={onOpenHistory} onOpenScanning={onOpenScanning} onPrintPackages={onPrintPackages} onReopen={onReopen} onStartLoad={onStartLoad} onUpdate={onUpdate} rows={visibleRows} shipmentFor={shipmentFor} transportFor={transportFor} /></Box>}
    </Paper>
  );
}
