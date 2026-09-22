import { useMemo, useState } from "react";
import { Box, Button, ButtonBase, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import dayjs from "dayjs";
import "dayjs/locale/it";
import type { ShipmentItem } from "../../services/shipmentsApi";
import { shipmentTransportPresentation } from "../../services/shipmentTransportPresentation";

interface Props {
  items: ShipmentItem[];
  onSelectShipment: (item: ShipmentItem) => void;
  onSelectDate: (date: string) => void;
}

const weekdays = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

export default function ShipmentCalendar({ items, onSelectShipment, onSelectDate }: Props) {
  const [month, setMonth] = useState(() => dayjs().startOf("month"));
  const today = dayjs().format("YYYY-MM-DD");
  const events = useMemo(() => {
    const result = new Map<string, ShipmentItem[]>();
    for (const item of items) {
      if (!item.plannedDepartureDate || !dayjs(item.plannedDepartureDate).isValid()) continue;
      const date = dayjs(item.plannedDepartureDate).format("YYYY-MM-DD");
      result.set(date, [...(result.get(date) ?? []), item]);
    }
    return result;
  }, [items]);
  // Anchor each row to a real Monday; advance seven calendar days per row,
  // but generate only its six operational dates. No dates are derived on click.
  const firstOperationalDay = month.day() === 0 ? month.add(1, "day") : month;
  const first = firstOperationalDay.subtract((firstOperationalDay.day() + 6) % 7, "day");
  const end = month.endOf("month").startOf("day");
  const lastOperationalDay = end.day() === 0 ? end.subtract(1, "day") : end;
  const weekCount = Math.ceil((lastOperationalDay.diff(first, "day") + 1) / 7);
  const days = Array.from({ length: weekCount }, (_, week) =>
    weekdays.map((_, weekday) => first.add(week * 7 + weekday, "day")),
  ).flat();

  return <Box>
    <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", columnGap: 2, rowGap: 0.5, mb: 0.5 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
      <IconButton size="small" aria-label="Mese precedente" onClick={() => setMonth(month.subtract(1, "month"))}><ChevronLeftIcon /></IconButton>
      <Typography aria-live="polite" variant="h6" sx={{ fontWeight: 800, minWidth: 190, textAlign: "center", textTransform: "uppercase" }}>{month.locale("it").format("MMMM YYYY")}</Typography>
      <IconButton size="small" aria-label="Mese successivo" onClick={() => setMonth(month.add(1, "month"))}><ChevronRightIcon /></IconButton>
      </Stack>
      <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap" }}>
      {Object.values(shipmentTransportPresentation).map(({ label, color }) => <Stack key={label} direction="row" sx={{ alignItems: "center", gap: 0.75 }}><Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color }} /><Typography variant="caption">{label}</Typography></Stack>)}
      </Stack>
    </Stack>
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(150px, 1fr))", minWidth: 900, borderTop: 1, borderLeft: 1, borderColor: "divider" }}>
        {weekdays.map((day) => <Typography key={day} sx={{ p: 1, textAlign: "center", fontWeight: 700, bgcolor: "action.hover", borderRight: 1, borderBottom: 1, borderColor: "divider" }}>{day}</Typography>)}
        {days.map((day) => {
          const date = day.format("YYYY-MM-DD");
          const current = date === today;
          return <Box key={date} data-calendar-date={date} onClick={() => onSelectDate(date)} sx={{ position: "relative", minHeight: { xs: 155, md: `max(120px, calc((100dvh - 300px) / ${weekCount}))` }, p: 0.75, borderRight: 1, borderBottom: 1, borderColor: "divider", bgcolor: current ? "action.selected" : day.month() === month.month() ? "background.paper" : "action.hover", cursor: "pointer" }}>
            <Button size="small" aria-label={`Pianifica spedizione il ${day.format("DD/MM/YYYY")}`} aria-current={current ? "date" : undefined} onClick={(event) => { event.stopPropagation(); onSelectDate(date); }} sx={{ minWidth: 30, mb: 0.5, borderRadius: "50%", color: current ? "primary.contrastText" : day.month() === month.month() ? "text.primary" : "text.secondary", bgcolor: current ? "primary.main" : undefined }}>{day.date()}</Button>
            <Stack sx={{ gap: 0.75 }}>
              {(events.get(date) ?? []).map((item) => {
                const presentation = item.transportType ? shipmentTransportPresentation[item.transportType] : { label: "Trasporto da definire", color: "#b0bec5" };
                const transportText=[presentation.label,item.transportDetailLabel].filter(Boolean).join(" · ");
                const heading=[item.commessa,item.camion,item.cliente].filter(Boolean).join(" · ");
                const reference=item.orderReference?.trim();
                const note=item.notes?.trim();
                const fullText=[heading,reference?`Rif. ${reference}`:null,transportText,note?`Nota: ${note}`:null].filter(Boolean).join("\n");
                const compactText={overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"} as const;
                return <ButtonBase key={item.id} title={fullText} onClick={(event) => { event.stopPropagation(); onSelectShipment(item); }} sx={{ display: "block", width: "100%", textAlign: "left", p: 0.75, borderRadius: 1, borderLeft: `3px solid ${presentation.color}`, bgcolor: alpha(presentation.color, 0.13), "&:hover": { bgcolor: alpha(presentation.color, 0.24) }, "&.Mui-focusVisible": { outline: `2px solid ${presentation.color}` }, minWidth:0 }}>
                  <Typography variant="body2" sx={{fontWeight:800,...compactText}}>{heading}</Typography>
                  {reference&&<Typography variant="caption" component="div" sx={compactText}>Rif. {reference}</Typography>}
                  <Typography variant="caption" component="div" sx={{color:"text.secondary",...compactText}}>{transportText}</Typography>
                  {note&&<Typography variant="caption" component="div" sx={compactText}>Nota: <Box component="span" sx={{fontStyle:"italic"}}>{note}</Box></Typography>}
                </ButtonBase>;
              })}
            </Stack>
          </Box>;
        })}
      </Box>
    </Box>
  </Box>;
}
