import ForkliftIcon from "@mui/icons-material/Forklift";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
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
      icon: <ForkliftIcon />,
      color: "#ffb74d",
    },
    {
      label: "Attesa spedizione",
      value: rows.filter((row) => row.stato === "Attesa ritiro").length,
      icon: <LocalShippingOutlinedIcon />,
      color: "#81c784",
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 1, md: 2 },
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        mb: 2,
      }}
    >
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          variant="outlined"
          sx={{
            bgcolor: "#131b25",
            borderColor: "rgba(255,255,255,0.12)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            height: 158,
          }}
        >
          <CardContent
            sx={{ display: "flex", flexDirection: "column", height: "100%", p: 2.25, "&:last-child": { pb: 2.25 } }}
          >
            <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
              <Typography color="text.primary" sx={{ fontSize: "1rem", fontWeight: 700, pt: 0.25 }}>
                {metric.label}
              </Typography>
              <Box
                sx={{
                  alignItems: "center",
                  bgcolor: `${metric.color}30`,
                  border: `1px solid ${metric.color}52`,
                  borderRadius: "50%",
                  boxShadow: `0 6px 18px ${metric.color}20`,
                  color: metric.color,
                  display: "flex",
                  flex: "0 0 auto",
                  height: 56,
                  justifyContent: "center",
                  width: 56,
                  "& svg": { fontSize: 30 },
                }}
              >
                {metric.icon}
              </Box>
            </Stack>
            <Box sx={{ alignItems: "flex-end", display: "flex", flex: 1, justifyContent: "center" }}>
              <Typography
                component="p"
                sx={{ fontSize: 64, fontWeight: 950, letterSpacing: -2, lineHeight: 0.9, textShadow: "0 3px 12px rgba(0,0,0,0.3)" }}
              >
                {metric.value}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
