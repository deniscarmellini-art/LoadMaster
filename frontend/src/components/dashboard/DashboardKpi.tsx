import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import ScheduleSendOutlinedIcon from "@mui/icons-material/ScheduleSendOutlined";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";

import type { Camion } from "../../models/Camion";

interface DashboardKpiProps {
  rows: Camion[];
}

export default function DashboardKpi({ rows }: DashboardKpiProps) {
  const metrics = [
    {
      label: "Da caricare",
      value: rows.filter((row) => row.previsti === row.pronti).length,
      icon: <Inventory2OutlinedIcon />,
      color: "#64b5f6",
    },
    {
      label: "In carico",
      value: rows.filter((row) => row.stato === "In carico").length,
      icon: <LocalShippingOutlinedIcon />,
      color: "#ffb74d",
    },
    {
      label: "Attesa spedizione",
      value: rows.filter((row) => row.stato === "Attesa ritiro").length,
      icon: <ScheduleSendOutlinedIcon />,
      color: "#81c784",
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
        mb: 2,
      }}
    >
      {metrics.map((metric) => (
        <Card key={metric.label} variant="outlined" sx={{ bgcolor: "#151c25", borderColor: "divider", height: "100%" }}>
          <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
            <Stack spacing={0.75} sx={{ alignItems: "center", textAlign: "center" }}>
              <Box
                sx={{
                  alignItems: "center",
                  bgcolor: `${metric.color}18`,
                  borderRadius: 3,
                  color: metric.color,
                  display: "flex",
                  height: 46,
                  justifyContent: "center",
                  width: 46,
                }}
              >
                {metric.icon}
              </Box>
              <Typography color="text.secondary" variant="body2">{metric.label}</Typography>
              <Typography component="p" sx={{ fontSize: 44, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>
                {metric.value}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
