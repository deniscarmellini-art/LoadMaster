import { useMemo, useRef, useState } from "react";
import { Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import dayjs from "dayjs";
import "dayjs/locale/it";
import type { ShipmentItem } from "../../services/shipmentsApi";
import { shipmentTransportPresentation } from "../../services/shipmentTransportPresentation";
import { ApiClientError } from "../../services/apiClient";

export const shipmentHasDeparted = (item: ShipmentItem) => Boolean(item.actualDepartureDate || item.operationalStatus === "SPEDITO" || item.shipmentStatus === "IN_VIAGGIO" || item.shipmentStatus === "CONCLUSA");

interface Props {
  items: ShipmentItem[];
  onSelectShipment: (item: ShipmentItem) => void;
  onSelectDate: (date: string) => void;
  onReschedule?: (item: ShipmentItem, date: string) => Promise<void>;
}

const weekdays = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

export default function ShipmentCalendar({ items, onSelectShipment, onSelectDate, onReschedule }: Props) {
  const [month, setMonth] = useState(() => dayjs().startOf("month"));
  const [dragId, setDragId] = useState<string | null>(null);
  const dragging = useRef<string | null>(null);
  const suppressClickUntil = useRef(0);
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [move, setMove] = useState<{item:ShipmentItem;date:string} | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDrag = (item: ShipmentItem) => Boolean(onReschedule && item.persisted && item.updatedAt && !shipmentHasDeparted(item) && !saving && !move);
  const finishDrag = () => {dragging.current=null;setDragId(null);setTargetDate(null);suppressClickUntil.current=Date.now()+400;};
  const confirmMove = async () => {
    if (!move || !onReschedule || saving) return;
    setSaving(true);setError(null);
    try {await onReschedule(move.item,move.date);setMove(null);}
    catch (cause) {setError(cause instanceof ApiClientError ? cause.message : "Impossibile spostare la spedizione. La data precedente resta invariata.");}
    finally {setSaving(false);}
  };
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
          return <Box key={date} data-calendar-date={date}
            onDragOver={event=>{const item=items.find(item=>item.id===dragging.current);if(!item||!canDrag(item))return;event.preventDefault();event.dataTransfer.dropEffect="move";setTargetDate(date);}}
            onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setTargetDate(null);}}
            onDrop={event=>{event.preventDefault();event.stopPropagation();const item=items.find(item=>item.id===dragging.current);finishDrag();if(!item||!canDrag(item)||dayjs(item.plannedDepartureDate).format("YYYY-MM-DD")===date)return;setError(null);setMove({item,date});}}
            onClick={() => {if(Date.now()>=suppressClickUntil.current)onSelectDate(date);}}
            sx={{ position: "relative", outline:targetDate===date?"2px solid":"none",outlineColor:"primary.main",outlineOffset:-2,minHeight: { xs: 155, md: `max(120px, calc((100dvh - 300px) / ${weekCount}))` }, p: 0.75, borderRight: 1, borderBottom: 1, borderColor: "divider", bgcolor: targetDate===date?"action.selected":current ? "action.selected" : day.month() === month.month() ? "background.paper" : "action.hover", cursor: "pointer" }}>
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
                const departed=shipmentHasDeparted(item);
                return <ButtonBase key={item.id} data-shipment-id={item.id} aria-disabled={departed || undefined} tabIndex={departed ? -1 : 0} disableRipple={departed} draggable={canDrag(item)} title={fullText+(departed?"\nSPEDITA":canDrag(item)?"\nTrascina per cambiare la data prevista":"")}
                  onDragStart={event=>{if(!canDrag(item)){event.preventDefault();return;}dragging.current=item.id;setDragId(item.id);event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",item.id);}}
                  onDragEnd={finishDrag}
                  onClick={(event) => { event.stopPropagation();if(departed||Date.now()<suppressClickUntil.current)return;onSelectShipment(item); }}
                  sx={{ display: "block", cursor:departed?"default":dragId===item.id?"grabbing":canDrag(item)?"grab":"pointer",opacity:dragId===item.id?.65:1,width: "100%", textAlign: "left", p: 0.75, borderRadius: 1, borderLeft: `3px solid ${presentation.color}`, bgcolor: alpha(presentation.color, 0.13), "&:hover": { bgcolor: alpha(presentation.color, departed ? 0.13 : 0.24) }, "&.Mui-focusVisible": { outline: `2px solid ${presentation.color}` }, minWidth:0 }}>
                  <Box sx={{display:"flex",alignItems:"center",gap:.5}}><Typography variant="body2" sx={{fontWeight:800,flex:1,minWidth:0,...compactText}}>{heading}</Typography>{departed&&<Box component="span" sx={{flexShrink:0,fontSize:"0.65rem",fontWeight:800,lineHeight:1.5,px:.5,border:1,borderColor:"success.main",bgcolor:theme=>alpha(theme.palette.success.main,.18),borderRadius:.5,color:"success.light"}}>✓ SPEDITA</Box>}</Box>
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
    <Dialog open={move!==null} onClose={()=>{if(!saving)setMove(null);}} fullWidth maxWidth="xs">
      <DialogTitle>Spostare la spedizione?</DialogTitle>
      <DialogContent><Typography>{move?.item.commessa}{move?.item.camion?` / ${move.item.camion}`:""}<br/>dal {move?dayjs(move.item.plannedDepartureDate).format("DD/MM/YYYY"):""} al {move?dayjs(move.date).format("DD/MM/YYYY"):""}?</Typography>{error&&<Alert severity="error" sx={{mt:2}}>{error}</Alert>}</DialogContent>
      <DialogActions><Button disabled={saving} onClick={()=>setMove(null)}>Annulla</Button><Button variant="contained" disabled={saving} onClick={()=>void confirmMove()}>Conferma spostamento</Button></DialogActions>
    </Dialog>
  </Box>;
}
