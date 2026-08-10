import ForkliftIcon from "@mui/icons-material/Forklift";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import { Box, Card, CardContent, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";

import type { Camion } from "../../models/Camion";
import { dashboardColors } from "../../theme/theme";

interface DashboardKpiProps {
  rows: Camion[];
}

export default function DashboardKpi({ rows }: DashboardKpiProps) {
  const theme = useTheme();
  const narrowPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const landscapePhone = useMediaQuery("(max-width:950px) and (max-height:500px)");
  const mobile = narrowPhone || landscapePhone;
  const metrics = [
    {
      label: "Aperte",
      value: rows.filter((row) => row.stato === "Da completare" || row.stato === "Da caricare").length,
      detail: rows.filter((row) => row.stato === "Da completare").length,
      detailLabel: "da completare",
      icon: <AssignmentOutlinedIcon />,
      color: "#ef5350",
    },
    {
      label: "Da caricare",
      value: rows.filter((row) => row.stato === "Da caricare").length,
      detail: rows.filter((row) => row.stato === "Da caricare").reduce((total, row) => total + row.pronti, 0),
      detailLabel: "pannelli pronti",
      icon: <Inventory2OutlinedIcon />,
      color: "#fdd835",
    },
    {
      label: "In carico",
      value: rows.filter((row) => row.stato === "In carico").length,
      detail: rows.filter((row) => row.stato === "In carico").reduce((total, row) => total + row.peso, 0),
      detailLabel: "kg attualmente in carico",
      icon: <ForkliftIcon />,
      color: "#ff9800",
    },
    {
      label: "Attesa ritiro",
      value: rows.filter((row) => row.stato === "Attesa spedizione").length,
      detail: rows.filter((row) => row.stato === "Attesa spedizione").length,
      detailLabel: "carichi in attesa",
      icon: <LocalShippingOutlinedIcon />,
      color: "#66bb6a",
    },
  ];

  if (mobile) {
    return <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, mb: 1.5 }}>{metrics.map((metric) => <Card key={metric.label} variant="outlined" sx={{ bgcolor: dashboardColors.card, borderColor: dashboardColors.divider, height: 88 }}><CardContent sx={{ alignItems: "center", display: "flex", height: "100%", justifyContent: "space-between", p: 1.25, "&:last-child": { pb: 1.25 } }}><Box><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{metric.label}</Typography><Typography sx={{ fontSize: "2rem", fontWeight: 950, lineHeight: 1.05 }}>{metric.value}</Typography></Box><Box sx={{ alignItems: "center", bgcolor: `${metric.color}24`, borderRadius: "50%", color: metric.color, display: "flex", height: 38, justifyContent: "center", width: 38, "& svg": { fontSize: 23 } }}>{metric.icon}</Box></CardContent></Card>)}</Box>;
  }

  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 1, md: 2 },
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        mb: 2,
      }}
    >
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          variant="outlined"
          sx={{
            bgcolor: dashboardColors.card,
            borderColor: dashboardColors.divider,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            height: 130,
          }}
        >
          <CardContent
            sx={{ display: "flex", flexDirection: "column", height: "100%", p: 1.75, "&:last-child": { pb: 1.5 } }}
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
                  height: 48,
                  justifyContent: "center",
                  width: 48,
                  "& svg": { fontSize: 29 },
                }}
              >
                {metric.icon}
              </Box>
            </Stack>
            <Box sx={{ alignItems: "center", display: "flex", flex: 1, flexDirection: "column", justifyContent: "flex-end" }}>
              <Typography
                component="p"
                sx={{ fontSize: 48, fontWeight: 950, letterSpacing: -1.5, lineHeight: 0.86, textShadow: "0 3px 12px rgba(0,0,0,0.3)" }}
              >
                {metric.value}
              </Typography>
              <Typography sx={{ color: dashboardColors.subtleText, fontSize: "0.72rem", lineHeight: 1.2, mt: 0.75 }}>
                {metric.detail > 0 ? `${metric.detail.toLocaleString("it-IT", { maximumFractionDigits: 1 })} ${metric.detailLabel}` : "—"}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
