import {
  Box,
  Button,
  CardActionArea,
  Chip,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import type { ShipmentItem, ShipmentStatus } from "../../services/shipmentsApi";
import type { Trasportatore } from "../../models/Settings";
import type { TransportItem } from "../../services/transportsApi";
import { dashboardColors } from "../../theme/theme";
import { getNextBusinessDays } from "../../utils/businessDays";
import { operationalStatusPresentation } from "../../services/dashboardService";
import { shipmentTransportLabel } from "../../services/shipmentTransportPresentation";

interface Props {
  shipments: ShipmentItem[];
  carriers: Trasportatore[];
  transports: TransportItem[];
  onOpenShipments: () => void;
}

const statusLabels: Partial<Record<ShipmentStatus, string>> = {
  PRONTA: "Pronta",
  IN_VIAGGIO: "In viaggio",
};
const statusColors: Partial<
  Record<ShipmentStatus, "warning" | "success" | "info">
> = {
  PRONTA: "success",
  IN_VIAGGIO: "info",
};

const statusChipSx = {
  height: 24,
  fontSize: "0.78rem",
  "& .MuiChip-label": { px: 1.25 },
};

export const getOverdueShipments = (shipments: ShipmentItem[], today: Date) => {
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return shipments.filter(shipment =>
    shipment.persisted &&
    shipment.plannedDepartureDate && shipment.plannedDepartureDate < todayIso &&
    !shipment.actualDepartureDate &&
    shipment.shipmentStatus !== "CONCLUSA" && shipment.shipmentStatus !== "IN_VIAGGIO" &&
    shipment.operationalStatus !== "SPEDITO",
  ).sort((left, right) => left.plannedDepartureDate!.localeCompare(right.plannedDepartureDate!));
};

export default function UpcomingShipments({
  shipments,
  carriers,
  onOpenShipments,
}: Props) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const today = new Date();
  const days = getNextBusinessDays(today, 4);
  const overdue = getOverdueShipments(shipments, today);

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
          Spedizioni scadute e prossimi 4 giorni lavorativi
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
        <Box sx={{ minWidth: 0, border: 1, borderColor: dashboardColors.divider, borderRadius: 1.5, p: 1.25, bgcolor: dashboardColors.card, minHeight: mobile ? "auto" : 108 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 0.5, mb: 0.75 }}>
            {overdue.length > 0 && <WarningAmberOutlinedIcon color="error" sx={{ fontSize: 18, flexShrink: 0 }} />}
            <Typography variant="subtitle2" sx={{ fontWeight: 800, flex: 1, color: overdue.length ? "error.main" : "text.secondary" }}>Spedizioni scadute</Typography>
            <Typography variant="caption" sx={{ fontWeight: 800, color: overdue.length ? "error.main" : "text.secondary" }}>{overdue.length}</Typography>
          </Stack>
          {!overdue.length ? <Typography variant="body2" color="text.secondary" sx={{ py: 0.25 }}>Nessuna spedizione scaduta</Typography> : (
            <Stack sx={{ gap: 0.5 }}>
              {overdue.slice(0, 3).map(shipment => (
                <Box key={shipment.id} sx={{ py: 0.5, minWidth: 0 }}>
                  <Stack direction="row" sx={{ alignItems: "baseline", gap: 0.5 }}>
                    <Typography variant="body2" noWrap title={`${shipment.commessa} / ${shipment.camion ?? "—"} - ${shipment.cliente}`} sx={{ flex: 1, minWidth: 0 }}><Box component="span" sx={{ fontWeight: 800 }}>{shipment.commessa} / {shipment.camion ?? "—"}</Box> - {shipment.cliente}</Typography>
                    <Typography variant="caption" color="error.main" sx={{ flexShrink: 0 }} title={shipment.plannedDepartureDate!}>{shipment.plannedDepartureDate!.slice(8, 10)}/{shipment.plannedDepartureDate!.slice(5, 7)}</Typography>
                  </Stack>
                </Box>
              ))}
              {overdue.length > 3 && <Button size="small" onClick={onOpenShipments} sx={{ alignSelf: "flex-start", minHeight: 24, py: 0 }}>Vedi tutte ({overdue.length})</Button>}
            </Stack>
          )}
        </Box>
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
                  {dayShipments.map((shipment) => {
                    const detail = shipment.transportType === "BILICO_ESSEPI"
                      ? carriers.find(carrier => carrier.id === shipment.carrierId)?.nome
                        || shipment.transportDetailLabel
                        || carriers.find(carrier => carrier.id === shipment.plannedCarrierId)?.nome
                      : shipment.transportDetailLabel;
                    const transportText = shipment.transportType
                      ? [shipmentTransportLabel(shipment.transportType), detail?.trim()].filter(Boolean).join(" · ")
                      : "";
                    const heading = `${shipment.commessa} / ${shipment.camion ?? "—"} - ${shipment.cliente}`;
                    return (
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
                          sx={{ flex: 1, minWidth: 0 }}
                          title={heading}
                          noWrap
                        >
                          <Box component="span" sx={{ fontWeight: 800 }}>{shipment.commessa} / {shipment.camion ?? "—"}</Box> - {shipment.cliente}
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
                      {transportText && <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                        noWrap
                        title={transportText}
                      >
                        {transportText}
                      </Typography>}
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
                    </CardActionArea>
                  );})}
                </Stack>
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
