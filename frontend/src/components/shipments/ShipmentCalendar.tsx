import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, Switch, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import dayjs from "dayjs";
import "dayjs/locale/it";
import type { ShipmentItem } from "../../services/shipmentsApi";
import { shipmentTransportPresentation } from "../../services/shipmentTransportPresentation";
import { ApiClientError } from "../../services/apiClient";
import { calendarTodayInRome, completedPastShipmentWeeks, shipmentCalendarAnchoredScrollTop, shipmentCalendarVisibleMonth, shipmentCalendarWeeks } from "../../services/shipmentCalendarWeeks";

import { shipmentHasDeparted } from "../../services/shipmentDeparture";
export { shipmentHasDeparted } from "../../services/shipmentDeparture";

interface Props {
  items: ShipmentItem[];
  transportDetails?: ReadonlyMap<string, string>;
  onSelectShipment: (item: ShipmentItem) => void;
  onSelectDate: (date: string) => void;
  onReschedule?: (item: ShipmentItem, date: string) => Promise<void>;
}

const weekdays = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const calendarShipmentColors:Record<string,{accent:string;background:string}>={
  BILICO_ESSEPI:{accent:"#66a978",background:"#e8f5e9"},
  RITIRA_CLIENTE:{accent:"#dc8585",background:"#ffebee"},
  TERZI_PER_ESSEPI:{accent:"#78a9d2",background:"#e3f2fd"},
};

export default function ShipmentCalendar({ items, transportDetails, onSelectShipment, onSelectDate, onReschedule }: Props) {
  const [month, setMonth] = useState(() => dayjs().startOf("month"));
  const [loadedRange, setLoadedRange] = useState(() => ({ start: dayjs().startOf("month").subtract(1, "month"), end: dayjs().startOf("month").add(1, "month") }));
  const loadedRangeRef = useRef(loadedRange);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stickyHeaderRef = useRef<HTMLDivElement | null>(null);
  const initialPositioned = useRef(false);
  const navigationTarget = useRef<string | null>(null);
  const prependAnchor = useRef<{ height: number; top: number } | null>(null);
  const filterAnchor = useRef<{ date: string; top: number } | null>(null);
  const loadingPrevious = useRef(false);
  const loadingNext = useRef(false);
  const testCalendar=import.meta.env.VITE_SISLOG_TEST===true;
  const [showCompletedWeeks,setShowCompletedWeeks]=useState(false);
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
  const today = testCalendar?calendarTodayInRome():dayjs().format("YYYY-MM-DD");
  const events = useMemo(() => {
    const result = new Map<string, ShipmentItem[]>();
    for (const item of items) {
      if (!item.plannedDepartureDate || !dayjs(item.plannedDepartureDate).isValid()) continue;
      const date = dayjs(item.plannedDepartureDate).format("YYYY-MM-DD");
      result.set(date, [...(result.get(date) ?? []), item]);
    }
    return result;
  }, [items]);
  const weeks = useMemo(() => shipmentCalendarWeeks(loadedRange.start.format("YYYY-MM"), loadedRange.end.format("YYYY-MM")), [loadedRange]);
  const completedWeeks=useMemo(()=>testCalendar?completedPastShipmentWeeks(items,today):new Set<string>(),[items,today,testCalendar]);
  const hiddenWeekCount=weeks.filter(week=>completedWeeks.has(week.key)).length;
  const visibleWeeks=weeks.filter(week=>!testCalendar||showCompletedWeeks||!completedWeeks.has(week.key));

  const changeCompletedWeeksVisibility=(show:boolean)=>{
    const scroller=scrollerRef.current;
    const headerBottom=stickyHeaderRef.current?.getBoundingClientRect().bottom??scroller?.getBoundingClientRect().top??0;
    const firstVisibleCell=[...(scroller?.querySelectorAll<HTMLElement>("[data-calendar-date]")??[])].find(node=>node.getBoundingClientRect().bottom>headerBottom);
    const date=firstVisibleCell?.dataset.calendarDate;
    if(firstVisibleCell&&date)filterAnchor.current={date,top:firstVisibleCell.getBoundingClientRect().top};
    setShowCompletedWeeks(show);
  };

  const scrollToMonth = (monthKey: string) => {
    const scroller = scrollerRef.current;
    const marker = scroller?.querySelector<HTMLElement>(`[data-calendar-month-start="${monthKey}"]`)
      ?? scroller?.querySelector<HTMLElement>(`[data-calendar-date^="${monthKey}-"]`);
    if (!scroller || !marker) return false;
    const headerHeight = stickyHeaderRef.current?.offsetHeight ?? 0;
    scroller.scrollTop += marker.getBoundingClientRect().top - scroller.getBoundingClientRect().top - headerHeight;
    return true;
  };

  const navigateMonth = (offset: number) => {
    const target = month.add(offset, "month").startOf("month");
    const targetKey = target.format("YYYY-MM");
    navigationTarget.current = targetKey;
    setMonth(target);
    let nextRange = loadedRangeRef.current;
    if (target.isBefore(nextRange.start, "month")) nextRange = { ...nextRange, start: target };
    if (target.isAfter(nextRange.end, "month")) nextRange = { ...nextRange, end: target };
    if (nextRange !== loadedRangeRef.current) {
      loadedRangeRef.current = nextRange;
      setLoadedRange(nextRange);
    } else {
      requestAnimationFrame(() => { scrollToMonth(targetKey); navigationTarget.current = null; });
    }
  };

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const anchor = prependAnchor.current;
    if (anchor) {
      scroller.scrollTop = anchor.top + (scroller.scrollHeight - anchor.height);
      prependAnchor.current = null;
      loadingPrevious.current = false;
    }
    const filteredAnchor=filterAnchor.current;
    if(filteredAnchor){
      const cells=[...scroller.querySelectorAll<HTMLElement>("[data-calendar-date]")];
      const cell=cells.find(node=>node.dataset.calendarDate===filteredAnchor.date)
        ??cells.find(node=>(node.dataset.calendarDate??"")>filteredAnchor.date)
        ??cells.at(-1);
      if(cell){
        scroller.scrollTop=shipmentCalendarAnchoredScrollTop(scroller.scrollTop,cell.getBoundingClientRect().top,filteredAnchor.top);
        const visibleMonthKey=shipmentCalendarVisibleMonth(cell.dataset.calendarDate,cell.dataset.calendarMonthStart);
        if(visibleMonthKey){
          const visibleMonth=dayjs(`${visibleMonthKey}-01`).startOf("month");
          setMonth(current=>current.isSame(visibleMonth,"month")?current:visibleMonth);
        }
      }
      filterAnchor.current=null;
    }
    if (!initialPositioned.current) {
      initialPositioned.current = scrollToMonth(month.format("YYYY-MM"));
    }
    const target = navigationTarget.current;
    if (target) {
      scrollToMonth(target);
      navigationTarget.current = null;
    }
    if (loadingNext.current) loadingNext.current = false;
  }, [loadedRange, visibleWeeks.length, month, showCompletedWeeks]);

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const headerBottom = stickyHeaderRef.current?.getBoundingClientRect().bottom ?? scrollerRect.top;
    const visibleCell = [...scroller.querySelectorAll<HTMLElement>("[data-calendar-date]")]
      .find(node => node.getBoundingClientRect().bottom > headerBottom);
    const visibleMonthKey=shipmentCalendarVisibleMonth(visibleCell?.dataset.calendarDate,visibleCell?.dataset.calendarMonthStart);
    if (visibleMonthKey) {
      const visibleMonth = dayjs(`${visibleMonthKey}-01`).startOf("month");
      setMonth(current => current.isSame(visibleMonth, "month") ? current : visibleMonth);
    }
    if (scroller.scrollTop < 220 && !loadingPrevious.current) {
      loadingPrevious.current = true;
      prependAnchor.current = { height: scroller.scrollHeight, top: scroller.scrollTop };
      const nextRange = { ...loadedRangeRef.current, start: loadedRangeRef.current.start.subtract(1, "month") };
      loadedRangeRef.current = nextRange;
      setLoadedRange(nextRange);
    } else if (scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 360 && !loadingNext.current) {
      loadingNext.current = true;
      const nextRange = { ...loadedRangeRef.current, end: loadedRangeRef.current.end.add(1, "month") };
      loadedRangeRef.current = nextRange;
      setLoadedRange(nextRange);
    }
  };

  return <Box>
    <Box ref={scrollerRef} onScroll={handleScroll} sx={{ height: { xs: "65dvh", md: "min(72dvh, calc(100dvh - 320px))" }, minHeight: 360, overflow: "auto", overscrollBehaviorY: "contain", position: "relative", bgcolor: "#ffffff", color: "#263238" }}>
      <Box sx={{ minWidth: 900 }}>
        <Box ref={stickyHeaderRef} sx={{ position: "sticky", top: 0, zIndex: 4, bgcolor: "#ffffff", color: "#263238", borderBottom: "1px solid #d9dee2" }}>
    <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", columnGap: 2, rowGap: 0.5, mb: 0.5 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
              <IconButton size="small" aria-label="Mese precedente" onClick={() => navigateMonth(-1)} sx={{color:"#37474f"}}><ChevronLeftIcon /></IconButton>
              <Typography aria-live="polite" variant="h6" sx={{ color: "#263238", fontWeight: 800, minWidth: 190, textAlign: "center", textTransform: "uppercase" }}>{month.locale("it").format("MMMM YYYY")}</Typography>
              <IconButton size="small" aria-label="Mese successivo" onClick={() => navigateMonth(1)} sx={{color:"#37474f"}}><ChevronRightIcon /></IconButton>
      </Stack>
      <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap" }}>
              {Object.entries(shipmentTransportPresentation).map(([type,{label}]) => { const colors=calendarShipmentColors[type]; return <Stack key={label} direction="row" sx={{ alignItems: "center", gap: 0.75 }}><Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: colors.accent }} /><Typography variant="caption" sx={{color:"#455a64"}}>{label}</Typography></Stack>; })}
      </Stack>
      {testCalendar&&hiddenWeekCount>0&&<FormControlLabel sx={{m:0}} control={<Switch size="small" checked={showCompletedWeeks} onChange={event=>changeCompletedWeeksVisibility(event.target.checked)}/>} label={<Typography variant="caption">Mostra settimane passate completate ({hiddenWeekCount})</Typography>}/>}
    </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(150px, 1fr))", borderTop: "1px solid #d9dee2", borderLeft: "1px solid #d9dee2" }}>
            {weekdays.map((day) => <Typography key={day} sx={{ p: 1, textAlign: "center", fontWeight: 700, color: "#37474f", bgcolor: "#f3f5f6", borderRight: "1px solid #d9dee2", borderBottom: "1px solid #d9dee2" }}>{day}</Typography>)}
          </Box>
        </Box>
        {testCalendar&&weeks.some(week=>week.ownerMonth===month.format("YYYY-MM")&&completedWeeks.has(week.key))&&weeks.filter(week=>week.ownerMonth===month.format("YYYY-MM")).every(week=>completedWeeks.has(week.key))&&!showCompletedWeeks&&<Alert severity="info" sx={{m:1,bgcolor:"#eaf3f9",color:"#263238","& .MuiAlert-icon":{color:"#527a96"}}}>Tutte le settimane del mese sono completate. Attiva “Mostra settimane passate completate” per consultarle.</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(150px, 1fr))", minWidth: 900, borderTop: "1px solid #d9dee2", borderLeft: "1px solid #d9dee2" }}>
        {visibleWeeks.flatMap(week=>week.days.map(date=>({day:dayjs(date),week}))).map(({day,week}) => {
          const date = day.format("YYYY-MM-DD");
          const current = date === today;
          const monthStartDate=week.monthStart;
          return <Box key={date} data-calendar-date={date} data-calendar-month-start={week.key===date?monthStartDate??undefined:undefined}
            onDragOver={event=>{const item=items.find(item=>item.id===dragging.current);if(!item||!canDrag(item))return;event.preventDefault();event.dataTransfer.dropEffect="move";setTargetDate(date);}}
            onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setTargetDate(null);}}
            onDrop={event=>{event.preventDefault();event.stopPropagation();const item=items.find(item=>item.id===dragging.current);finishDrag();if(!item||!canDrag(item)||dayjs(item.plannedDepartureDate).format("YYYY-MM-DD")===date)return;setError(null);setMove({item,date});}}
            onClick={() => {if(Date.now()>=suppressClickUntil.current)onSelectDate(date);}}
            sx={{ position: "relative", outline:targetDate===date?"2px solid":"none",outlineColor:"#78909c",outlineOffset:-2,minHeight: { xs: 155, md: 145 }, p: 0.75, borderRight: "1px solid #d9dee2", borderBottom: "1px solid #d9dee2", borderColor: "#d9dee2", bgcolor: targetDate===date?"#eaf2f8":current ? "#f7fbff" : "#ffffff", cursor: "pointer" }}>
            <Button size="small" aria-label={`Pianifica spedizione il ${day.format("DD/MM/YYYY")}`} aria-current={current ? "date" : undefined} onClick={(event) => { event.stopPropagation(); onSelectDate(date); }} sx={{ minWidth: 30, mb: 0.5, borderRadius: "50%", color: day.format("YYYY-MM") === month.format("YYYY-MM") ? "#263238" : "#607d8b", bgcolor: current ? "#dcebf7" : undefined, boxShadow: current ? "0 0 0 1px #a8c7df" : "none", "&:hover": { bgcolor: current ? "#dcebf7" : "#edf1f3" } }}>{day.date()}</Button>
            <Stack sx={{ gap: 0.75 }}>
              {(events.get(date) ?? []).map((item) => {
                const presentation = item.transportType ? shipmentTransportPresentation[item.transportType] : { label: "Trasporto da definire", color: "#90a4ae" };
                const colors=item.transportType?calendarShipmentColors[item.transportType]:{accent:"#90a4ae",background:"#eceff1"};
                const detail = item.transportType === "RITIRA_CLIENTE" ? null
                  : transportDetails?.has(item.id) ? transportDetails.get(item.id) : item.transportDetailLabel?.trim();
                const transportText=[presentation.label,detail && detail !== "—" ? detail : null].filter(Boolean).join(" · ");
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
                  sx={{ display: "block", cursor:departed?"default":dragId===item.id?"grabbing":canDrag(item)?"grab":"pointer",opacity:dragId===item.id?.65:1,width: "100%", textAlign: "left", p: 0.75, borderRadius: 1, borderLeft: `3px solid ${colors.accent}`, color:"#263238", bgcolor: colors.background, "&:hover": { bgcolor: colors.background, filter: "brightness(0.97)" }, "&.Mui-focusVisible": { outline: `2px solid ${colors.accent}` }, minWidth:0 }}>
                  <Box sx={{display:"flex",alignItems:"center",gap:.5}}><Typography variant="body2" sx={{fontWeight:800,flex:1,minWidth:0,color:"#263238",...compactText}}>{heading}</Typography>{departed&&<Box component="span" sx={{flexShrink:0,fontSize:"0.65rem",fontWeight:800,lineHeight:1.5,px:.5,border:1,borderColor:"#5b9b6d",bgcolor:"#d8efdd",borderRadius:.5,color:"#245c34"}}>✓ SPEDITA</Box>}</Box>
                  {reference&&<Typography variant="caption" component="div" sx={{...compactText,color:"#37474f"}}>Rif. {reference}</Typography>}
                  <Typography variant="caption" component="div" data-calendar-transport-details sx={{color:"#455a64",whiteSpace:"normal",overflowWrap:"anywhere"}}>{transportText}</Typography>
                  {note&&<Typography variant="caption" component="div" sx={{...compactText,color:"#37474f"}}>Nota: <Box component="span" sx={{fontStyle:"italic"}}>{note}</Box></Typography>}
                </ButtonBase>;
              })}
            </Stack>
          </Box>;
        })}
      </Box>
    </Box>
    </Box>
    <Dialog open={move!==null} onClose={()=>{if(!saving)setMove(null);}} fullWidth maxWidth="xs">
      <DialogTitle>Spostare la spedizione?</DialogTitle>
      <DialogContent><Typography>{move?.item.commessa}{move?.item.camion?` / ${move.item.camion}`:""}<br/>dal {move?dayjs(move.item.plannedDepartureDate).format("DD/MM/YYYY"):""} al {move?dayjs(move.date).format("DD/MM/YYYY"):""}?</Typography>{error&&<Alert severity="error" sx={{mt:2}}>{error}</Alert>}</DialogContent>
      <DialogActions><Button disabled={saving} onClick={()=>setMove(null)}>Annulla</Button><Button variant="contained" disabled={saving} onClick={()=>void confirmMove()}>Conferma spostamento</Button></DialogActions>
    </Dialog>
  </Box>;
}
