import {
  Box,
  CardActionArea,
  Chip,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import type { ShipmentItem, ShipmentStatus } from "../../services/shipmentsApi";
import type { Trasportatore } from "../../models/Settings";
import type { TransportItem } from "../../services/transportsApi";
import { dashboardColors } from "../../theme/theme";
import { getNextBusinessDays } from "../../utils/businessDays";
import PlannedDepartureDate from "../shipments/PlannedDepartureDate";
import { operationalStatusPresentation } from "../../services/dashboardService";
import { dashboardTransportPresentation } from "./dashboardTransport";

interface Props {
  shipments: ShipmentItem[];
  carriers: Trasportatore[];
  transports: TransportItem[];
  onOpenShipments: () => void;
}

const statusLabels: Partial<Record<ShipmentStatus, string>> = {
  PIANIFICATA: "Pianificata",
  PRONTA: "Pronta",
  IN_VIAGGIO: "In viaggio",
};
const statusColors: Partial<
  Record<ShipmentStatus, "warning" | "success" | "info">
> = {
  PIANIFICATA: "warning",
  PRONTA: "success",
  IN_VIAGGIO: "info",
};

const statusChipSx = {
  height: 24,
  fontSize: "0.78rem",
  "& .MuiChip-label": { px: 1.25 },
};

export default function UpcomingShipments({
  shipments,
  carriers,
  transports,
  onOpenShipments,
}: Props) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const days = getNextBusinessDays(new Date());

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: dashboardColors.surface,
        border: 1,
        borderColor: "divider",
        p: 1.5,
        mb: 2,
      }}
    >
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
        <CalendarMonthOutlinedIcon color="primary" sx={{ fontSize: 21 }} />
        <Typography
          component="h2"
          sx={{ fontSize: "1.08rem", fontWeight: 700, letterSpacing: 0.3 }}
        >
          Spedizioni prossimi 5 giorni lavorativi
        </Typography>
      </Stack>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: mobile ? "1fr" : "repeat(5, minmax(0, 1fr))",
          alignItems: "stretch",
          gap: 1,
        }}
      >
        {days.map(({ iso, date }) => {
          const dayShipments = shipments.filter(
            (shipment) =>
              shipment.shipmentStatus !== "CONCLUSA" &&
              shipment.plannedDepartureDate === iso,
          );
          const heading = date
            .toLocaleDateString("it-IT", {
              weekday: mobile ? "long" : "short",
              day: "2-digit",
              month: "2-digit",
            })
            .replace(",", "")
            .toLocaleUpperCase("it-IT");
          return (
            <Box
              key={iso}
              sx={{
                minWidth: 0,
                border: 1,
                borderColor: dashboardColors.divider,
                borderRadius: 1.5,
                p: 1.25,
                bgcolor: dashboardColors.card,
                minHeight: mobile ? "auto" : 108,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ color: "primary.main", fontWeight: 800, mb: 0.75 }}
              >
                {heading}
              </Typography>
              {!dayShipments.length ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 0.25 }}
                >
                  Nessuna spedizione
                </Typography>
              ) : (
                <Stack sx={{ gap: 0.5 }}>
                  {dayShipments.map((shipment) => (
                    <CardActionArea
                      key={shipment.id}
                      onClick={onOpenShipments}
                      sx={{
                        border: 1,
                        borderColor: dashboardColors.divider,
                        borderRadius: 1,
                        bgcolor: dashboardColors.grid,
                        p: 0.875,
                        transition: "background-color 180ms ease",
                        "&:hover": { bgcolor: dashboardColors.rowHover },
                      }}
                    >
                      <Stack
                        direction="row"
                        sx={{
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 0.5,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 800 }}
                          noWrap
                        >
                          {shipment.commessa} / {shipment.camion ?? "—"}
                        </Typography>
                        {statusLabels[shipment.shipmentStatus] && (
                          <Chip
                            size="small"
                            label={statusLabels[shipment.shipmentStatus]}
                            color={statusColors[shipment.shipmentStatus]}
                            sx={{
                              ...statusChipSx,
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </Stack>
                      <Typography
                        variant="caption"
                        sx={{ display: "block" }}
                        noWrap
                      >
                        {shipment.cliente}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {
                          dashboardTransportPresentation(
                            shipment,
                            transports,
                            carriers,
                          ).label
                        }
                      </Typography>
                      {shipment.operationalStatus && (
                        <Chip
                          size="small"
                          variant="outlined"
                          color={
                            operationalStatusPresentation(
                              shipment.operationalStatus,
                            ).color
                          }
                          label={
                            operationalStatusPresentation(
                              shipment.operationalStatus,
                            ).label
                          }
                          sx={{ ...statusChipSx, mt: 0.5 }}
                        />
                      )}
                      <Box sx={{ mt: 0.25 }}>
                        <PlannedDepartureDate shipment={shipment} />
                      </Box>
                    </CardActionArea>
                  ))}
                </Stack>
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
