import { Tooltip, Typography } from "@mui/material";
import type { ShipmentItem } from "../../services/shipmentsApi";
import { formatOptionalDate } from "../../utils/dateFormatting";

interface Props {
  shipment: ShipmentItem;
}

export default function PlannedDepartureDate({ shipment }: Props) {
  if (!shipment.plannedDepartureDate)
    return (
      <Typography component="span" variant="body2" color="text.secondary">
        —
      </Typography>
    );

  const changed = Boolean(shipment.plannedDepartureDateChangedAt);
  const content = (
    <Typography
      component="span"
      variant="body2"
      sx={{
        color: changed ? "error.main" : "success.main",
        fontWeight: 700,
      }}
    >
      {formatOptionalDate(shipment.plannedDepartureDate)}
    </Typography>
  );

  return changed && shipment.originalPlannedDepartureDate ? (
    <Tooltip
      title={`Data iniziale: ${formatOptionalDate(shipment.originalPlannedDepartureDate)}`}
      arrow
    >
      {content}
    </Tooltip>
  ) : (
    content
  );
}
