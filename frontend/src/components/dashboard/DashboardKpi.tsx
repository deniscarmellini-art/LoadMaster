import { Box, Card, CardContent, Typography } from "@mui/material";


import type { Camion } from "../../models/Camion";


interface DashboardKpiProps {
  rows: Camion[];
}


export default function DashboardKpi({ rows }: DashboardKpiProps) {
  const metrics = [
    { label: "Camion", value: rows.length },
    {
      label: "Non completi",
      value: rows.filter((row) => row.stato === "Non completa").length,
    },
    {
      label: "In carico",
      value: rows.filter((row) => row.stato === "In carico").length,
    },
    {
      label: "Pronti al ritiro",
      value: rows.filter((row) => row.stato === "Attesa ritiro").length,
    },
  ];


  return (
    <Box
      display="grid"
      gap={2}
      gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))"
      mb={3}
    >
      {metrics.map((metric) => (
        <Card key={metric.label} variant="outlined">
          <CardContent>
            <Typography color="text.secondary" variant="body2">
              {metric.label}
            </Typography>
            <Typography component="p" variant="h4">
              {metric.value}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

