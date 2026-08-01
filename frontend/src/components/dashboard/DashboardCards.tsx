import { Card, CardContent, Grid, Typography } from "@mui/material";
import type { Camion } from "../../models/Camion";

interface Props {
  rows: Camion[];
}

export default function DashboardCards({ rows }: Props) {
  const aperte = rows.filter(r => r.stato !== "Partita").length;
  const inCarico = rows.filter(r => r.stato === "In carico").length;
  const attesa = rows.filter(r => r.stato === "Attesa spedizione").length;
  const spedite = rows.filter(r => r.stato === "Partita").length;

  const cards = [
    { titolo: "Commesse Aperte", valore: aperte },
    { titolo: "In Carico", valore: inCarico },
    { titolo: "Attesa Ritiro", valore: attesa },
    { titolo: "Spedite", valore: spedite }
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {cards.map(card => (
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.titolo}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {card.titolo}
              </Typography>

              <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                {card.valore}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}













































