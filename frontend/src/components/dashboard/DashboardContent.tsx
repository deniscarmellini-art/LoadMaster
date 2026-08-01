import { useMemo, useState } from "react";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { Box, InputAdornment, Paper, TextField, Typography } from "@mui/material";

import type { Camion } from "../../models/Camion";
import DashboardGrid from "./DashboardGrid";

interface DashboardContentProps {
  rows: Camion[];
  onDelete: (row: Camion) => void;
  onPrintLabels: () => void;
  onUpdate: () => void;
}

export default function DashboardContent({ rows, onDelete, onPrintLabels, onUpdate }: DashboardContentProps) {
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
    <Paper elevation={0} sx={{ bgcolor: "#121922", border: 1, borderColor: "divider", p: 1.5 }}>
      <Typography component="h2" sx={{ fontWeight: 800, mb: 1.5, letterSpacing: 0.6 }} variant="h6">
        CARICHI ATTIVI
      </Typography>
      <TextField
        fullWidth
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Cerca commessa, cliente o camion..."
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start"><SearchOutlinedIcon /></InputAdornment>
            ),
          },
        }}
        sx={{
          mb: 1.5,
          "& .MuiOutlinedInput-root": { bgcolor: "rgba(0,0,0,0.2)", minHeight: 52 },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.12)" },
        }}
        value={search}
      />
      <Box sx={{ height: 620 }}>
        <DashboardGrid onDelete={onDelete} onPrintLabels={onPrintLabels} onUpdate={onUpdate} rows={visibleRows} />
      </Box>
    </Paper>
  );
}
