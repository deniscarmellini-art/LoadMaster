import { Box, Paper, Typography } from "@mui/material";

import type { Camion } from "../../models/Camion";
import DashboardGrid from "./DashboardGrid";

interface DashboardContentProps {
  rows: Camion[];
}

export default function DashboardContent({ rows }: DashboardContentProps) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography component="h2" sx={{ mb: 2 }} variant="h6">
        Situazione carichi
      </Typography>
      <Box sx={{ height: 650 }}>
        <DashboardGrid rows={rows} />
      </Box>
    </Paper>
  );
}
