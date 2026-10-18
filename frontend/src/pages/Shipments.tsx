import { normalizeShipmentPlanningInput } from "../services/shipmentPlanningInput";
import DeliveryProgramExport from "../components/shipments/DeliveryProgramExport";
import { filterShipmentList } from "../services/shipmentListFilters";
import { shipmentLinkSuggestions } from "../services/shipmentLinkSuggestions";
import ShipmentCustomerPicker from "../components/shipments/ShipmentCustomerPicker";
import ShipmentDateFilter from "../components/shipments/ShipmentDateFilter";
import type { CaricoCamion } from "../models/Loading";
import { shipmentListDetails } from "../services/shipmentListPresentation";
import { shipmentCalendarTransportDetails } from "../services/shipmentCalendarPresentation";
import { useEffect, useMemo, useState } from "react";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import "dayjs/locale/it";
import type { Rimorchio, Trasportatore, VoceTrasporto } from "../models/Settings";
import {
  createShipment,
  deleteShipment,
  linkShipment,
  updateShipment,
  type ShipmentInput,
  type ShipmentItem,
  type ShipmentStatus,
  type ShipmentTransportType,
} from "../services/shipmentsApi";
import type { TransportItem } from "../services/transportsApi";
import PlannedDepartureDate from "../components/shipments/PlannedDepartureDate";
import { demoBranding } from "../services/demoBranding";
import ShipmentCalendar, { shipmentHasDeparted } from "../components/shipments/ShipmentCalendar";
import { operationalStatusPresentation } from "../services/dashboardService";
import { ApiClientError } from "../services/apiClient";
import { shipmentTransportLabel } from "../services/shipmentTransportPresentation";
interface Props {
  items: ShipmentItem[];
  loads?: CaricoCamion[];
  trailers: Rimorchio[];
  carriers: Trasportatore[];
  clientVehicleTypes: VoceTrasporto[];
  thirdPartyTransportModes: VoceTrasporto[];
  transports: TransportItem[];
  onRefresh: () => Promise<void>;
}
const labels: Record<ShipmentStatus, string> = {
  DA_PIANIFICARE: "Da pianificare",
  PIANIFICATA: "Pianificata",
  PRONTA: "Pronta",
  IN_VIAGGIO: "In viaggio",
  CONCLUSA: "Spedita",
};
const empty: ShipmentInput = {
  commessa: "",
  cliente: "",
  camion: "",
  plannedLoadingDate: "",
  plannedDepartureDate: "",
  transportType: null,
  transportDetailId: null,
  vehicleTypeId: null,
  plannedCarrierId: null,
  trailerId: null,
  carrierId: null,
  customerId: null,
  notes: "",
};
const remainsInOperationalView = (item: ShipmentItem) => {
  if (!item.actualDepartureDate) return true;
  const departure = new Date(item.actualDepartureDate);
  if (Number.isNaN(departure.getTime())) return true;
  const expiry = new Date(
    departure.getFullYear(),
    departure.getMonth(),
    departure.getDate() + 7,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today <= expiry;
};
type SortKey = "commessa" | "cliente" | "camion" | "plannedDepartureDate" | "operationalStatus" | "transportType";
type SortDirection = "asc" | "desc";
const columns: ReadonlyArray<{ label: string; sortKey?: SortKey }> = [
  { label: "Commessa", sortKey: "commessa" },
  { label: "Cliente", sortKey: "cliente" },
  { label: "Carico", sortKey: "camion" },
  { label: "Partenza prevista", sortKey: "plannedDepartureDate" },
  { label: "Stato operativo carico", sortKey: "operationalStatus" },
  { label: "Modalità di trasporto", sortKey: "transportType" },
  { label: "Ritiro / Consegna" },
  { label: "Tipo mezzo" },
  { label: "Targa bilico" },
  { label: "Indirizzo di consegna" },
  { label: "Note" },
];
const collator = new Intl.Collator("it-IT", {
  numeric: true,
  sensitivity: "base",
});
const OperationalStatusChip = ({
  status,
}: {
  status: ShipmentItem["operationalStatus"];
}) => {
  if (!status) return <>—</>;
  const presentation = operationalStatusPresentation(status);
  return (
    <Chip
      size="small"
      color={presentation.color}
      variant="outlined"
      label={presentation.label}
    />
  );
};
export default function Shipments({
  items,
  loads = [],
  transports,
  trailers,
  carriers,
  clientVehicleTypes,
  thirdPartyTransportModes,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState<ShipmentStatus | "">(""),
    [type, setType] = useState<ShipmentTransportType | "">(""),
    [carrierFilter, setCarrierFilter] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [sortKey, setSortKey] = useState<SortKey | null>("plannedDepartureDate"),
    [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [calendarDate, setCalendarDate] = useState<string | null>(null);
  const [movedItems,setMovedItems]=useState<Record<string,ShipmentItem>>({});
  const visibleItems=useMemo(()=>items.map(item=>{const moved=movedItems[item.id];return moved&&(moved.updatedAt??"")>(item.updatedAt??"")?moved:item;}),[items,movedItems]);
  const hasDeparted = (item: ShipmentItem) => shipmentHasDeparted(item) || shipmentHasDeparted(items.find(current=>current.id===item.id) ?? item) || shipmentHasDeparted(visibleItems.find(current=>current.id===item.id) ?? item);
  const reschedule=async(item:ShipmentItem,date:string)=>{
    if(hasDeparted(item))throw new Error("La spedizione è già partita.");
    if(!item.updatedAt)throw new Error("Pianificazione non aggiornata");
    const saved=await updateShipment(item.id,{plannedDepartureDate:date,expectedUpdatedAt:item.updatedAt});
    setMovedItems(current=>({...current,[saved.id]:saved}));
    try {await onRefresh();setNotice({severity:"success",text:"Data prevista aggiornata."});}
    catch {setNotice({severity:"error",text:"Data salvata. Impossibile aggiornare gli altri dati: ricaricare la pagina."});}
  };
  const [editing, setEditing] = useState<ShipmentItem | null | "new">(null),
    [form, setForm] = useState<ShipmentInput>(empty),
    [deleteItem, setDeleteItem] = useState<ShipmentItem | null>(null),
    [notice, setNotice] = useState<{
      severity: "success" | "error";
      text: string;
    } | null>(null);
  useEffect(() => {
    const departed = (item: ShipmentItem) => shipmentHasDeparted(item) || items.some(current=>current.id===item.id&&shipmentHasDeparted(current));
    if(editing && editing!=="new" && departed(editing))setEditing(null);
    if(deleteItem && departed(deleteItem))setDeleteItem(null);
  }, [items, editing, deleteItem]);
  const operationalItems = useMemo(
    () => visibleItems.filter(remainsInOperationalView),
    [visibleItems],
  );
  const legacyCount = useMemo(
    () =>
      items.filter(
        (item) =>
          !item.actualDepartureDate &&
          (item.shipmentStatus === "CONCLUSA" ||
            item.operationalStatus === "SPEDITO"),
      ).length,
    [items],
  );
  // The explicit shipped filter also searches older departures. The default
  // operational list keeps its existing seven-day window.
  const listItems = status === "CONCLUSA" ? visibleItems : operationalItems;
  const listDetails = useMemo(() => new Map(visibleItems.map(item => [item.id,
    shipmentListDetails(item, carriers, trailers, transports, loads, clientVehicleTypes),
  ])), [visibleItems, carriers, trailers, transports, loads, clientVehicleTypes]);
  const calendarUnplaced = visibleItems.filter(item => !hasDeparted(item) &&
    (!item.plannedDepartureDate || !dayjs(item.plannedDepartureDate).isValid() || dayjs(item.plannedDepartureDate).day() === 0));
  const calendarTransportDetails = useMemo(() => new Map(visibleItems.map(item => [item.id,
    shipmentCalendarTransportDetails(item, carriers, clientVehicleTypes, trailers, transports, loads),
  ])), [visibleItems, carriers, clientVehicleTypes, trailers, transports, loads]);
  const filtered = useMemo(
    () => filterShipmentList(listItems,listDetails,{search,status,type,carrierFilter,from,to}),
    [listItems, search, status, type, carrierFilter, from, to, listDetails],
  );
  const open = (item?: ShipmentItem, date?: string) => {
    if(item && hasDeparted(item))return;
    setCalendarDate(date ?? null);
    setEditing(item ?? "new");
    setForm(
      normalizeShipmentPlanningInput(item
        ? {
            loadId: item.loadId,
            commessa: item.commessa,
            cliente: item.cliente,
            orderReference: item.orderReference ?? "",
            deliveryAddress: item.deliveryAddress ?? "",
            customerId: item.customerId ?? null,
            camion: item.camion,
            plannedLoadingDate: item.plannedLoadingDate,
            plannedDepartureDate: date ?? item.plannedDepartureDate,
            transportType: item.transportType,
            transportDetailId: item.transportDetailId,
            vehicleTypeId: item.vehicleTypeId ?? null,
            trailerId: null,
            carrierId: null,
            plannedCarrierId: item.plannedCarrierId,
            notes: item.notes,
          }
        : { ...empty, orderReference: "", deliveryAddress: "", plannedDepartureDate: date ?? empty.plannedDepartureDate }),
    );
  };
  const valid = Boolean(
    form.commessa?.trim() && form.cliente?.trim() && form.transportType,
  );
  const save = async () => {
    if (!valid) return;
    if(editing && editing!=="new" && hasDeparted(editing))return;
    try {
      let saved: ShipmentItem | undefined;
      if (editing === "new" || (editing && !editing.persisted))
        saved = await createShipment({
          ...form,
          trailerId: null,
          carrierId: null,
          loadId: editing === "new" ? null : editing.loadId,
        });
      else if (editing)
        saved = await updateShipment(editing.id, {
          ...form,
          trailerId: null,
          carrierId: null,
        });
      await onRefresh();
      setEditing(null);
      setNotice({ severity: "success", text: import.meta.env.VITE_SISLOG_TEST && !saved?.customerId
        ? "Pianificazione salvata. Per il DDT selezionare esplicitamente il cliente anagrafico: nessuna corrispondenza esatta univoca."
        : "Pianificazione salvata." });
    } catch (error) {
      setNotice({
        severity: "error",
        text: error instanceof ApiClientError ? error.message : "Impossibile salvare la pianificazione.",
      });
    }
  };
  const remove = async (item: ShipmentItem) => {
    if(hasDeparted(item))return;
    try {
      await deleteShipment(item.id);
      await onRefresh();
      setDeleteItem(null);
      setEditing(null);
      setNotice({ severity: "success", text: "Spedizione eliminata." });
    } catch (error:unknown) {
      setNotice({
        severity: "error",
        text: error instanceof ApiClientError?error.message:"Impossibile eliminare la pianificazione.",
      });
    }
  };
  const detailOptions=form.transportType==="BILICO_ESSEPI"?carriers:form.transportType==="RITIRA_CLIENTE"?clientVehicleTypes:form.transportType==="TERZI_PER_ESSEPI"?thirdPartyTransportModes:[];
  const detailLabel=form.transportType==="BILICO_ESSEPI"?"Trasportatore":form.transportType==="RITIRA_CLIENTE"?"Tipo di mezzo":"Modalità Terzi per Essepi";
  const transportLabel=(value:ShipmentTransportType|null)=>value==="BILICO_ESSEPI"?demoBranding.bilico:shipmentTransportLabel(value);
  const connect = async (item: ShipmentItem, target: ShipmentItem) => {
    if (hasDeparted(item) || item.loadId || !target.loadId) return;
    if (!window.confirm(`Confermare il collegamento della pianificazione ${item.id} (${item.commessa}) al carico ${target.camion ?? "-"}, commessa ${target.commessa}, ID ${target.loadId}?`)) return;
    try {
      await linkShipment(item.id, target.loadId!);
      await onRefresh();
      setNotice({
        severity: "success",
        text: "Spedizione collegata al carico reale.",
      });
      setEditing(null);
    } catch (error) {
      setNotice({
        severity: "error",
        text: error instanceof ApiClientError ? error.message : "Impossibile collegare la spedizione.",
      });
    }
  };
  const planningDirty = editing && editing!=="new" &&
    (["commessa","cliente","camion","orderReference","deliveryAddress","customerId","plannedLoadingDate","plannedDepartureDate","transportType","transportDetailId","vehicleTypeId","plannedCarrierId","notes"] as const)
      .some(key => (form[key] ?? "") !== (editing[key] ?? ""));
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const value = (item: ShipmentItem): string | number | null => {
      switch (sortKey) {
        case "plannedDepartureDate":
          return item.plannedDepartureDate
            ? Date.parse(item.plannedDepartureDate)
            : null;
        case "transportType":
          return listDetails.get(item.id)?.mode ? transportLabel(listDetails.get(item.id)!.mode) : null;
        default:
          return item[sortKey];
      }
    };
    return filtered
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const a = value(left.item);
        const b = value(right.item);
        const aEmpty = a === null || a === "";
        const bEmpty = b === null || b === "";
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
        if (aEmpty && bEmpty) return left.index - right.index;
        const comparison =
          typeof a === "number" && typeof b === "number"
            ? a - b
            : collator.compare(String(a), String(b));
        return comparison === 0
          ? left.index - right.index
          : sortDirection === "asc"
            ? comparison
            : -comparison;
      })
      .map(({ item }) => item);
  }, [filtered, sortKey, sortDirection, listDetails]);
  const requestSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="it">
      <Box>
        {legacyCount > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {legacyCount} spedizion{legacyCount === 1 ? "e" : "i"} spedit
            {legacyCount === 1 ? "a" : "e"} senza data di partenza effettiva:
            restano visibili perché non è possibile calcolare il limite di 7 giorni.
          </Alert>
        )}
        <Paper sx={{ p: { xs: 1, md: 2 }, ...(view === "calendar" && { py: 1 }) }}>
          <ToggleButtonGroup exclusive value={view} onChange={(_, value) => { if (value) setView(value); }} aria-label="Visualizzazione spedizioni" size="small" sx={{ mb: 1 }}>
            <ToggleButton value="calendar">Calendario</ToggleButton>
            <ToggleButton value="list">Elenco</ToggleButton>
          </ToggleButtonGroup>
          {view === "list" && <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0,1fr)",
                sm: "repeat(2,minmax(0,1fr))",
                md: "repeat(3,minmax(0,1fr))",
                lg: "minmax(220px,1.6fr) minmax(130px,1fr) minmax(150px,1.1fr) minmax(130px,1fr) repeat(2,minmax(180px,1.1fr))",
              },
              gap: 1,
              mb: 1.5,
              "& > .MuiFormControl-root": { minWidth: 0 },
            }}
          >
            <TextField
              size="small"
              label="Cerca Commessa / Cliente"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <TextField
              size="small"
              select
              label="Stato spedizione"
              value={status}
              onChange={(e) => setStatus(e.target.value as ShipmentStatus | "")}
            >
              <MenuItem value="">Tutti</MenuItem>
              {Object.entries(labels).map(([v, l]) => (
                <MenuItem key={v} value={v}>
                  {l}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              select
              label="Modalità di trasporto"
              value={type}
              onChange={(e) =>
                setType(e.target.value as ShipmentTransportType | "")
              }
            >
              <MenuItem value="">Tutti</MenuItem>
              <MenuItem value="BILICO_ESSEPI">{demoBranding.bilico}</MenuItem>
              <MenuItem value="RITIRA_CLIENTE">Ritira Cliente</MenuItem>
              <MenuItem value="TERZI_PER_ESSEPI">Terzi per Essepi</MenuItem>
            </TextField>
            <TextField size="small" select label="Trasportatore" value={carrierFilter} onChange={e=>setCarrierFilter(e.target.value)}>
              <MenuItem value="">Tutti</MenuItem>
              {carriers.map(carrier=><MenuItem key={carrier.id} value={carrier.id}>{carrier.nome}{!carrier.attivo?" (non attivo)":""}</MenuItem>)}
            </TextField>
            <ShipmentDateFilter label="Partenza da" value={from} onChange={setFrom}/>
            <ShipmentDateFilter label="Partenza a" value={to} onChange={setTo}/>
          </Box>}
          {view==="list"&&<DeliveryProgramExport filtered={filtered} details={listDetails} from={from} to={to} carrierId={carrierFilter||undefined} carrierName={carrierFilter?carriers.find(carrier=>carrier.id===carrierFilter)?.nome:undefined}/>}
          {view === "calendar" ? (
            <>
              {!!calendarUnplaced.length && <Box sx={{mb:2}}>
                <Typography variant="subtitle2" sx={{mb:1}}>Pianificazioni senza data o con partenza di domenica</Typography>
                <Stack direction="row" sx={{gap:1,flexWrap:"wrap"}}>{calendarUnplaced.map(item =>
                  <Button key={item.id} variant="outlined" onClick={()=>open(item)}>
                    {[item.commessa,item.camion,item.cliente].filter(Boolean).join(" · ")}
                    {item.plannedDepartureDate ? ` · ${dayjs(item.plannedDepartureDate).format("DD/MM/YYYY")}` : " · Senza data"}
                  </Button>
                )}</Stack>
              </Box>}
              <ShipmentCalendar items={visibleItems} transportDetails={calendarTransportDetails} onReschedule={reschedule} onSelectShipment={(item) => open(item)} onSelectDate={(date) => open(undefined, date)} />
            </>
          ) : (
            <TableContainer sx={{overflowX:"auto",maxWidth:"100%"}}>
              <Table size="small" aria-label="Organizzazione ritiri e consegne" sx={{minWidth:1200,tableLayout:"fixed","& th":{whiteSpace:"normal",fontSize:12},"& th, & td":{px:1},"& th .MuiTableSortLabel-icon":{fontSize:16,ml:.25,mr:0},"& td":{verticalAlign:"top",overflowWrap:"anywhere"},"& .MuiChip-root":{maxWidth:"100%",height:"auto"},"& .MuiChip-label":{whiteSpace:"normal",py:.25}}}>
                <colgroup>{[7.5,9,6,9,10,10,9,7,6.5,13,13].map((width,index)=><col key={columns[index]!.label} style={{width:`${width}%`}}/>)}</colgroup>
                <TableHead><TableRow>
                  {columns.map(({label,sortKey:columnSortKey}) => <TableCell key={label}>
                    {columnSortKey ? <TableSortLabel active={sortKey===columnSortKey} direction={sortKey===columnSortKey?sortDirection:"asc"} onClick={()=>requestSort(columnSortKey)}>{label}</TableSortLabel> : label}
                  </TableCell>)}
                </TableRow></TableHead>
                <TableBody>{sorted.map(item => {
                  const detail=listDetails.get(item.id)!;
                  return <TableRow key={item.id}>
                    <TableCell>{item.commessa || "—"}</TableCell>
                    <TableCell>{item.cliente?.trim() || "—"}</TableCell>
                    <TableCell>{item.camion?.trim() || "—"}</TableCell>
                    <TableCell sx={{whiteSpace:"nowrap"}}><PlannedDepartureDate shipment={item}/></TableCell>
                    <TableCell><OperationalStatusChip status={item.operationalStatus}/></TableCell>
                    <TableCell>{transportLabel(detail.mode)}</TableCell>
                    <TableCell>{detail.party}</TableCell>
                    <TableCell>{detail.vehicleType}</TableCell>
                    <TableCell>{detail.plate}</TableCell>
                    <TableCell sx={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{detail.address}</TableCell>
                    <TableCell sx={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{detail.notes}</TableCell>
                  </TableRow>;
                })}</TableBody>
              </Table>
              {!sorted.length&&<Typography sx={{p:3,textAlign:"center"}} color="text.secondary">Nessuna spedizione trovata</Typography>}
            </TableContainer>
          )}
        </Paper>
        <Dialog
          open={editing !== null}
          onClose={() => setEditing(null)}
          fullWidth
          maxWidth={false}
          slotProps={{paper:{sx:{width:{xs:"calc(100% - 16px)",sm:780},maxWidth:"calc(100% - 32px)",maxHeight:"calc(100% - 32px)",m:2}}}}
        >
          <DialogTitle sx={{py:1.5}}>
            {editing === "new" || (editing && !editing.persisted)
              ? "Pianifica spedizione"
              : "Modifica pianificazione"}
          </DialogTitle>
          {notice?.severity === "error" && <Alert severity="error" sx={{mx:{xs:2,sm:3},mb:1,flexShrink:0}}>{notice.text}</Alert>}
          <DialogContent sx={{px:{xs:2,sm:3},py:1,minHeight:0}}>
            <Box sx={{ display: "grid", gridTemplateColumns:{xs:"minmax(0,1fr)",sm:"repeat(2,minmax(0,1fr))"}, gap:1.25, pt:.5, "& > .MuiFormControl-root":{minWidth:0} }}>
              {calendarDate && <Autocomplete
                size="small"
                sx={{gridColumn:"1 / -1"}}
                options={items.filter((item) => !item.persisted && item.loadId && !item.plannedDepartureDate && !shipmentHasDeparted(item))}
                value={editing && editing !== "new" ? editing : null}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                getOptionLabel={(item) => [item.commessa, item.camion, item.cliente].filter(Boolean).join(" · ")}
                onChange={(_, item) => open(item ?? undefined, calendarDate)}
                renderInput={(params) => <TextField {...params} size="small" label="Carico da pianificare" />}
                noOptionsText="Nessun carico da pianificare"
              />}
              <TextField
                size="small"
                required
                label="Commessa"
                disabled={editing !== "new" && Boolean(editing?.loadId)}
                value={form.commessa}
                onChange={(e) => setForm({ ...form, commessa: e.target.value })}
              />
              <TextField
                size="small"
                required
                label="Cliente"
                disabled={editing !== "new" && Boolean(editing?.loadId)}
                value={form.cliente}
                onChange={(e) => setForm({ ...form, cliente: e.target.value })}
              />
              {editing!==null && <ShipmentCustomerPicker value={form.customerId} customerName={editing!=="new"&&editing.loadId?editing.cliente:form.cliente} onChange={customerId=>setForm({...form,customerId})}/>}
              <TextField
                size="small"
                label="Riferimento ordine"
                value={form.orderReference ?? ""}
                onChange={(event) => setForm({ ...form, orderReference: event.target.value })}
              />
              <TextField
                size="small"
                label="Carico / Camion"
                disabled={editing !== "new" && Boolean(editing?.loadId)}
                value={form.camion ?? ""}
                onChange={(e) => setForm({ ...form, camion: e.target.value })}
              />
              <TextField
                size="small"
                label="Indirizzo di consegna"
                sx={{gridColumn:"1 / -1"}}
                multiline
                minRows={2}
                maxRows={3}
                value={form.deliveryAddress ?? ""}
                onChange={(event) => setForm({ ...form, deliveryAddress: event.target.value })}
              />
              <DatePicker
                label="Partenza prevista"
                format="DD/MM/YYYY"
                value={
                  form.plannedDepartureDate
                    ? dayjs(form.plannedDepartureDate)
                    : null
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    plannedDepartureDate: value?.isValid()
                      ? value.format("YYYY-MM-DD")
                      : null,
                  })
                }
                slotProps={{
                  textField: { fullWidth: true, size:"small" },
                }}
              />
              <TextField
                size="small"
                select
                required
                label="Modalità di trasporto"
                value={form.transportType ?? ""}
                onChange={(e) => {
                  const value = e.target.value as ShipmentTransportType;
                  setForm({
                    ...form,
                    transportType: value,
                    transportDetailId: null,
                    vehicleTypeId: null,
                    plannedCarrierId: null,
                    trailerId: null,
                    carrierId: null,
                  });
                }}
              >
                <MenuItem value="" disabled>
                  Seleziona modalità di trasporto
                </MenuItem>
                <MenuItem value="BILICO_ESSEPI">{demoBranding.bilico}</MenuItem>
                <MenuItem value="RITIRA_CLIENTE">Ritira Cliente</MenuItem>
                <MenuItem value="TERZI_PER_ESSEPI">Terzi per Essepi</MenuItem>
              </TextField>
              {form.transportType && form.transportType!=="TERZI_PER_ESSEPI" &&<TextField size="small" select label={detailLabel} value={form.transportDetailId??""} sx={{gridColumn:"1 / -1"}} onChange={e=>setForm({...form,transportDetailId:e.target.value||null,plannedCarrierId:null})}>
                <MenuItem value="">Non specificato</MenuItem>
                {detailOptions.filter(item=>item.attivo||item.id===form.transportDetailId).map(item=><MenuItem key={item.id} value={item.id} disabled={!item.attivo}>{item.nome}{!item.attivo?" (non attivo)":""}</MenuItem>)}
                {form.transportDetailId&&!detailOptions.some(item=>item.id===form.transportDetailId)&&<MenuItem value={form.transportDetailId} disabled>{editing&&editing!=="new"?editing.transportDetailLabel??"Voce storica":"Voce storica"} (non disponibile)</MenuItem>}
              </TextField>}
              {form.transportType==="TERZI_PER_ESSEPI" && <>
                <TextField size="small" select label="Trasportatore" value={form.plannedCarrierId??""} onChange={e=>setForm({...form,plannedCarrierId:e.target.value||null})}>
                  <MenuItem value="">Non specificato</MenuItem>
                  {carriers.filter(item=>item.attivo||item.id===form.plannedCarrierId).map(item=><MenuItem key={item.id} value={item.id} disabled={!item.attivo}>{item.nome}{!item.attivo?" (non attivo)":""}</MenuItem>)}
                </TextField>
                <TextField size="small" select label="Tipo mezzo" value={form.vehicleTypeId??""} onChange={e=>setForm({...form,vehicleTypeId:e.target.value||null})}>
                  <MenuItem value="">Non specificato</MenuItem>
                  {clientVehicleTypes.filter(item=>item.attivo||item.id===form.vehicleTypeId).map(item=><MenuItem key={item.id} value={item.id} disabled={!item.attivo}>{item.nome}{!item.attivo?" (non attivo)":""}</MenuItem>)}
                </TextField>
                {form.transportDetailId && editing && editing!=="new" && <Alert severity="info" sx={{gridColumn:"1 / -1",py:0}}>Valore storico conservato: {editing.transportDetailLabel ?? "Voce non disponibile"}{!form.plannedCarrierId ? ". Trasportatore da verificare." : ""}</Alert>}
              </>}
              <TextField
                size="small"
                multiline
                minRows={2}
                sx={{gridColumn:"1 / -1"}}
                maxRows={3}
                label="Note"
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Box>
          {editing && editing!=="new" && editing.persisted && !editing.loadId && !hasDeparted(editing) && <Box sx={{mt:1.5}}>
            <Typography variant="subtitle2">Possibili carichi da collegare - conferma richiesta</Typography>
            <Typography variant="caption" color="text.secondary">La commessa suggerisce i candidati; verifica il carico prima di confermare. Nessun collegamento viene applicato dall'importazione.</Typography>
            <Stack sx={{gap:1,mt:1}}>{shipmentLinkSuggestions(editing,items).map(target=><Button key={target.loadId} variant="outlined" disabled={!!planningDirty} sx={{justifyContent:"flex-start",textAlign:"left",overflowWrap:"anywhere"}} onClick={()=>void connect(editing,target)}>Conferma collegamento: {target.commessa} / Carico {target.camion ?? "-"} / {target.cliente} / ID: {target.loadId}</Button>)}</Stack>
            {!shipmentLinkSuggestions(editing,items).length && <Typography variant="body2" color="text.secondary">Nessun carico disponibile suggerito. I carichi già collegati o spediti sono esclusi.</Typography>}
          </Box>}
          {editing!=="new"&&editing?.persisted&&<Box sx={{mt:1.5,pt:1,borderTop:1,borderColor:"divider"}}><Button color="error" variant="outlined" startIcon={<DeleteOutlinedIcon/>} onClick={()=>setDeleteItem(editing)}>Elimina spedizione</Button></Box>}
          {editing && editing!=="new" && <Stack direction="row" sx={{mt:1,gap:1,flexWrap:"wrap",alignItems:"center"}}>{planningDirty&&<Typography variant="caption" color="text.secondary">Salva le modifiche prima di collegare il carico.</Typography>}</Stack>}
          </DialogContent>
          <DialogActions sx={{px:{xs:2,sm:3},py:1.25,flexShrink:0,borderTop:1,borderColor:"divider"}}>
            <Button onClick={() => setEditing(null)}>Annulla</Button>
            <Button
              variant="contained"
              disabled={!valid}
              onClick={() => void save()}
            >
              Salva
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={deleteItem!==null} onClose={()=>setDeleteItem(null)} fullWidth maxWidth="xs">
          <DialogTitle>Elimina spedizione</DialogTitle>
          <DialogContent><Typography>Vuoi eliminare la pianificazione della spedizione {deleteItem?.commessa}{deleteItem?.camion?` / ${deleteItem.camion}`:""}?<br/>La commessa e il carico non verranno eliminati.</Typography></DialogContent>
          <DialogActions><Button onClick={()=>setDeleteItem(null)}>Annulla</Button><Button color="error" variant="contained" startIcon={<DeleteOutlinedIcon/>} onClick={()=>deleteItem&&void remove(deleteItem)}>Elimina spedizione</Button></DialogActions>
        </Dialog>
        <Snackbar
          open={notice !== null && !(editing !== null && notice.severity === "error")}
          autoHideDuration={3500}
          onClose={() => setNotice(null)}
        >
          <Alert severity={notice?.severity ?? "success"}>{notice?.text}</Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
}
