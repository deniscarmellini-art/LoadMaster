import { Box, Paper, Stack, Typography } from "@mui/material";

import ImportExcel from "../ImportExcel";

import type { Commessa } from "../../types/excel";

interface DashboardHeaderProps {
  onImported: (commessa: Commessa) => void;
}

export default function DashboardHeader({ onImported }: DashboardHeaderProps) {
  return (
    <Paper component="header" elevation={0} sx={{ mb: 3, p: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{
        alignItems: { md: "center" },
        justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography component="h1" variant="h4">
            LoadMaster
          </Typography>
          <Typography color="text.secondary">
            Panoramica delle commesse importate.
          </Typography>
        </Box>
        <ImportExcel onImported={onImported} />
      </Stack>
    </Paper>
  );
}




























