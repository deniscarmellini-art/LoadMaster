import { useMemo, useState } from "react";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import { Box, InputAdornment, Paper, Stack, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";

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

export default function DashboardContent({ rows, onDelete, onOpenScanning, onStartLoad, onPrintPackages, hasPackages, onUpdate, onReopen, onContinueLoad, onConfirmDeparture, onOpenHistory, shipments, carriers, transports }: DashboardContentProps) {
  const [search, setSearch] = useState("");
  const theme = useTheme();
  const narrowPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const landscapePhone = useMediaQuery("(max-width:950px) and (max-height:500px)");
  const mobile = narrowPhone || landscapePhone;
  const activeRowCount = useMemo(
    () => rows.filter((row) => row.stato !== "Partita").length,
    [rows],
  );

  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("it-IT");
    const activeRows = rows.filter((row) => row.stato !== "Partita");

    if (!term) return activeRows;

    return activeRows.filter((row) =>
      [row.commessa, row.cliente, row.camion].some((value) =>
        value.toLocaleLowerCase("it-IT").includes(term),
      ),
    );
  }, [rows, search]);
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
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
        <LocalShippingOutlinedIcon color="primary" sx={{ fontSize: 21 }} />
        <Typography component="h2" noWrap sx={{ minWidth: 0, fontSize: "1.08rem", fontWeight: 700, letterSpacing: 0.3 }}>
          Commesse attive ({activeRowCount})
        </Typography>
      </Stack>
      <TextField
        fullWidth
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Cerca commessa, cliente o camion..."
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start" sx={{ mr: 0.75 }}><SearchOutlinedIcon /></InputAdornment>
            ),
          },
        }}
        sx={{
          mb: 2.5,
          "& .MuiOutlinedInput-root": { bgcolor: dashboardColors.search, minHeight: 52 },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: dashboardColors.divider },
        }}
        value={search}
      />
      {mobile
        ? <DashboardMobileCards hasPackages={hasPackages} onConfirmDeparture={onConfirmDeparture} onContinueLoad={onContinueLoad} onOpenHistory={onOpenHistory} onOpenScanning={onOpenScanning} onPrintPackages={onPrintPackages} onStartLoad={onStartLoad} rows={visibleRows} shipmentFor={shipmentFor} transportFor={transportFor} />
        : <Box sx={{ height: 620, width: "100%" }}><DashboardGrid hasPackages={hasPackages} onConfirmDeparture={onConfirmDeparture} onContinueLoad={onContinueLoad} onDelete={onDelete} onOpenHistory={onOpenHistory} onOpenScanning={onOpenScanning} onPrintPackages={onPrintPackages} onReopen={onReopen} onStartLoad={onStartLoad} onUpdate={onUpdate} rows={visibleRows} shipmentFor={shipmentFor} transportFor={transportFor} /></Box>}
    </Paper>
  );
}
