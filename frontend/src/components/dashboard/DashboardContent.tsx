import { useMemo, useState } from "react";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import { Box, InputAdornment, Paper, Stack, TextField, Typography } from "@mui/material";

import type { Camion } from "../../models/Camion";
import DashboardGrid from "./DashboardGrid";
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
}

export default function DashboardContent({ rows, onDelete, onOpenScanning, onStartLoad, onPrintPackages, hasPackages, onUpdate, onReopen, onContinueLoad, onConfirmDeparture, onOpenHistory }: DashboardContentProps) {
  const [search, setSearch] = useState("");

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

  return (
    <Paper elevation={0} sx={{ bgcolor: dashboardColors.surface, border: 1, borderColor: "divider", p: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
        <LocalShippingOutlinedIcon color="primary" sx={{ fontSize: 21 }} />
        <Typography component="h2" sx={{ fontSize: "1.08rem", fontWeight: 700, letterSpacing: 0.3 }}>
          Carichi attivi
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
      <Box sx={{ height: 620 }}>
        <DashboardGrid hasPackages={hasPackages} onConfirmDeparture={onConfirmDeparture} onContinueLoad={onContinueLoad} onDelete={onDelete} onOpenHistory={onOpenHistory} onOpenScanning={onOpenScanning} onPrintPackages={onPrintPackages} onReopen={onReopen} onStartLoad={onStartLoad} onUpdate={onUpdate} rows={visibleRows} />
      </Box>
    </Paper>
  );
}
