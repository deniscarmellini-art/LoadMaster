import { useMemo, useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import "dayjs/locale/it";
import type { Rimorchio, Trasportatore, VoceTrasporto } from "../models/Settings";
import {
  createShipment,
  deleteShipment,
  departShipment,
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
import ShipmentCalendar from "../components/shipments/ShipmentCalendar";
import { operationalStatusPresentation } from "../services/dashboardService";
import { ApiClientError } from "../services/apiClient";
import { shipmentTransportLabel } from "../services/shipmentTransportPresentation";
interface Props {
  items: ShipmentItem[];
  trailers: Rimorchio[];
  carriers: Trasportatore[];
  clientVehicleTypes: VoceTrasporto[];
  thirdPartyTransportModes: VoceTrasporto[];
  transports: TransportItem[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
}
const labels: Record<ShipmentStatus, string> = {
  DA_PIANIFICARE: "Da pianificare",
  PIANIFICATA: "Pianificata",
  PRONTA: "Pronta",
  IN_VIAGGIO: "In viaggio",
  CONCLUSA: "Conclusa",
};
const empty: ShipmentInput = {
  commessa: "",
  cliente: "",
  camion: "",
  plannedLoadingDate: "",
  plannedDepartureDate: "",
  transportType: null,
  transportDetailId: null,
  trailerId: null,
  carrierId: null,
  notes: "",
};
const statusColor = (s: ShipmentStatus) =>
  s === "PRONTA"
    ? "success"
    : s === "IN_VIAGGIO"
      ? "info"
      : s === "PIANIFICATA"
        ? "warning"
        : s === "CONCLUSA"
          ? "default"
          : "error";
const actualDepartureLabel = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("it-IT") : "—";
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
type SortKey =
  | "commessa"
  | "cliente"
  | "camion"
  | "shipmentStatus"
  | "plannedDepartureDate"
  | "operationalStatus"
  | "transportType"
  | "vehicle"
  | "actualDepartureDate";
type SortDirection = "asc" | "desc";
const columns: ReadonlyArray<{ label: string; sortKey?: SortKey }> = [
  { label: "Azioni" },
  { label: "Commessa", sortKey: "commessa" },
  { label: "Cliente", sortKey: "cliente" },
  { label: "Carico / Camion", sortKey: "camion" },
  { label: "Stato spedizione", sortKey: "shipmentStatus" },
  { label: "Partenza prevista", sortKey: "plannedDepartureDate" },
  { label: "Stato operativo carico", sortKey: "operationalStatus" },
  { label: "Modalità di trasporto", sortKey: "transportType" },
  { label: "Dettaglio / Mezzo", sortKey: "vehicle" },
  { label: "Data partenza effettiva", sortKey: "actualDepartureDate" },
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
  trailers,
  carriers,
  clientVehicleTypes,
  thirdPartyTransportModes,
  onBack,
  onRefresh,
}: Props) {
  const theme = useTheme(),
    mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState<ShipmentStatus | "">(""),
    [type, setType] = useState<ShipmentTransportType | "">(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [sortKey, setSortKey] = useState<SortKey | null>(null),
    [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [calendarDate, setCalendarDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShipmentItem | null | "new">(null),
    [form, setForm] = useState<ShipmentInput>(empty),
    [deleteItem, setDeleteItem] = useState<ShipmentItem | null>(null),
    [departureItem, setDepartureItem] = useState<ShipmentItem | null>(null),
    [departureCarrierId, setDepartureCarrierId] = useState(""),
    [notice, setNotice] = useState<{
      severity: "success" | "error";
      text: string;
    } | null>(null);
  const operationalItems = useMemo(
    () => items.filter(remainsInOperationalView),
    [items],
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
  const filtered = useMemo(
    () =>
      operationalItems.filter((x) => {
        const q = search.trim().toLocaleUpperCase("it-IT");
        return (
          (!q ||
            [x.commessa, x.cliente, x.camion].some((v) =>
              v?.toLocaleUpperCase("it-IT").includes(q),
            )) &&
          (!status || x.shipmentStatus === status) &&
          (!type || x.transportType === type) &&
          (!from ||
            Boolean(
              x.plannedDepartureDate && x.plannedDepartureDate >= from,
            )) &&
          (!to ||
            Boolean(x.plannedDepartureDate && x.plannedDepartureDate <= to))
        );
      }),
    [operationalItems, search, status, type, from, to],
  );
  const open = (item?: ShipmentItem, date?: string) => {
    setCalendarDate(date ?? null);
    setEditing(item ?? "new");
    setForm(
      item
        ? {
            loadId: item.loadId,
            commessa: item.commessa,
            cliente: item.cliente,
            orderReference: item.orderReference ?? "",
            camion: item.camion,
            plannedLoadingDate: item.plannedLoadingDate,
            plannedDepartureDate: date ?? item.plannedDepartureDate,
            transportType: item.transportType,
            transportDetailId: item.transportDetailId,
            trailerId: null,
            carrierId: null,
            plannedCarrierId: item.plannedCarrierId,
            notes: item.notes,
          }
        : { ...empty, orderReference: "", plannedDepartureDate: date ?? empty.plannedDepartureDate },
    );
  };
  const valid = Boolean(
    form.commessa?.trim() && form.cliente?.trim() && form.transportType,
  );
  const save = async () => {
    if (!valid) return;
    try {
      if (editing === "new" || (editing && !editing.persisted))
        await createShipment({
          ...form,
          trailerId: null,
          carrierId: null,
          loadId: editing === "new" ? null : editing.loadId,
        });
      else if (editing)
        await updateShipment(editing.id, {
          ...form,
          trailerId: null,
          carrierId: null,
        });
      await onRefresh();
      setEditing(null);
      setNotice({ severity: "success", text: "Pianificazione salvata." });
    } catch {
      setNotice({
        severity: "error",
        text: "Impossibile salvare la pianificazione.",
      });
    }
  };
  const remove = async (item: ShipmentItem) => {
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
  const activeCarriers = carriers.filter((carrier) => carrier.attivo);
  const detailOptions=form.transportType==="BILICO_ESSEPI"?carriers:form.transportType==="RITIRA_CLIENTE"?clientVehicleTypes:form.transportType==="TERZI_PER_ESSEPI"?thirdPartyTransportModes:[];
  const detailLabel=form.transportType==="BILICO_ESSEPI"?"Trasportatore Essepi":form.transportType==="RITIRA_CLIENTE"?"Tipo di mezzo":"Modalità Terzi per Essepi";
  const transportLabel=(value:ShipmentTransportType|null)=>value==="BILICO_ESSEPI"?demoBranding.bilico:shipmentTransportLabel(value);
  const depart = async (item: ShipmentItem, carrierId?: string) => {
    try {
      await departShipment(item.id, carrierId);
      await onRefresh();
      setDepartureItem(null);
      setNotice({ severity: "success", text: "Partenza confermata." });
    } catch {
      setNotice({
        severity: "error",
        text: "Impossibile confermare la partenza.",
      });
    }
  };
  const connect = async (item: ShipmentItem) => {
    const candidates = items.filter(
      (x) =>
        !x.persisted &&
        x.loadId &&
        x.commessa.trim().toLocaleUpperCase("it-IT") ===
          item.commessa.trim().toLocaleUpperCase("it-IT") &&
        (!item.camion ||
          x.camion?.replace(/[\s-]+/g, "").toLocaleUpperCase("it-IT") ===
            item.camion.replace(/[\s-]+/g, "").toLocaleUpperCase("it-IT")),
    );
    if (!candidates.length) {
      setNotice({
        severity: "error",
        text: "Nessun carico reale compatibile trovato.",
      });
      return;
    }
    let target = candidates[0];
    if (candidates.length > 1) {
      const truck = window
        .prompt(
          `Scegli il camion da collegare: ${candidates.map((x) => x.camion).join(", ")}`,
        )
        ?.replace(/[\s-]+/g, "")
        .toLocaleUpperCase("it-IT");
      target =
        candidates.find(
          (x) =>
            x.camion?.replace(/[\s-]+/g, "").toLocaleUpperCase("it-IT") ===
            truck,
        ) ?? target;
    }
    if (
      !window.confirm(
        `Collegare la pianificazione ${item.commessa} al carico ${target.camion}?`,
      )
    )
      return;
    try {
      await linkShipment(item.id, target.loadId!);
      await onRefresh();
      setNotice({
        severity: "success",
        text: "Spedizione collegata al carico reale.",
      });
    } catch {
      setNotice({
        severity: "error",
        text: "Impossibile collegare la spedizione.",
      });
    }
  };
  const action = (item: ShipmentItem) =>
    item.persisted && item.shipmentStatus === "PRONTA" ? (
      <Stack direction="row" spacing={1}>
      <Button size="small" onClick={()=>open(item)}>Modifica pianificazione</Button>
      <Button
        variant="contained"
        size="small"
        onClick={() => {
          if (item.transportType === "BILICO_ESSEPI") {
            setDepartureItem(item);
            setDepartureCarrierId(item.carrierId ?? (activeCarriers.some(c=>c.id===item.plannedCarrierId) ? item.plannedCarrierId : null) ?? "");
            return;
          }
          void depart(item);
        }}
      >
        Conferma partenza
      </Button>
      </Stack>
    ) : item.shipmentStatus === "IN_VIAGGIO" ||
      item.shipmentStatus === "CONCLUSA" ? null : (
      <Stack direction="row">
        <Button size="small" onClick={() => open(item)}>
          {item.persisted ? "Modifica pianificazione" : "Pianifica"}
        </Button>
        {item.persisted &&
          !item.loadId &&
          items.some(
            (x) =>
              !x.persisted &&
              x.commessa.trim().toLocaleUpperCase("it-IT") ===
                item.commessa.trim().toLocaleUpperCase("it-IT"),
          ) && (
            <Button size="small" onClick={() => void connect(item)}>
              Collega
            </Button>
          )}
      </Stack>
    );
  const vehicle = (item: ShipmentItem) => {
    if (item.transportType !== "BILICO_ESSEPI") return item.transportDetailLabel??"Non specificato";
    const trailer = item.trailerId
      ? trailers.find((entry) => entry.id === item.trailerId)?.targa ?? "Rimorchio assegnato"
      : null;
    const planned = item.transportDetailLabel ? " — Previsto: " + item.transportDetailLabel : "";
    if (!trailer) return `${demoBranding.bilico} — Da assegnare` + planned;
    const carrier = item.carrierId ? carriers.find(c=>c.id===item.carrierId)?.nome ?? "Trasportatore non disponibile" : null;
    return (carrier ? trailer + " — " + carrier : trailer + " — Trasportatore da definire") + planned;
  };
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const value = (item: ShipmentItem): string | number | null => {
      switch (sortKey) {
        case "shipmentStatus":
          return labels[item.shipmentStatus];
        case "plannedDepartureDate":
          return item.plannedDepartureDate
            ? Date.parse(item.plannedDepartureDate)
            : null;
        case "actualDepartureDate":
          return item.actualDepartureDate
            ? Date.parse(item.actualDepartureDate)
            : null;
        case "transportType":
          return item.transportType?transportLabel(item.transportType):null;
        case "vehicle":
          return item.transportType ? vehicle(item) : null;
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
  }, [filtered, sortKey, sortDirection, trailers, carriers]);
  const requestSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };
  const kpis = (
    [
      "DA_PIANIFICARE",
      "PIANIFICATA",
      "PRONTA",
      "IN_VIAGGIO",
    ] as ShipmentStatus[]
  ).map((s) => ({
    label: labels[s],
    value: operationalItems.filter((x) => x.shipmentStatus === s).length,
  }));
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="it">
      <Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr auto 1fr" },
            alignItems: "center",
            gap: { xs: 1, sm: 0 },
            mb: view === "calendar" ? 0.5 : 2,
          }}
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={{ justifySelf: "start" }}
          >
            Dashboard
          </Button>
          <Typography
            variant={mobile ? "h5" : "h4"}
            sx={{
              fontWeight: 800,
              textAlign: "center",
            }}
          >
            Spedizioni
          </Typography>
        </Box>
        {view === "list" && <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2,1fr)", md: "repeat(4,1fr)" },
            gap: 1.5,
            mb: 2,
          }}
        >
          {kpis.map((k) => (
            <Card key={k.label} variant="outlined">
              <CardContent
                sx={{
                  textAlign: "center",
                  p: 1.5,
                  "&:last-child": { pb: 1.5 },
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {k.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900 }}>
                  {k.value}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>}
        {legacyCount > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {legacyCount} spedizion{legacyCount === 1 ? "e" : "i"} conclus
            {legacyCount === 1 ? "a" : "e"} senza data di partenza effettiva:
            restano visibili perché non è possibile calcolare il limite di 7 giorni.
          </Alert>
        )}
        <Paper sx={{ p: { xs: 1, md: 2 }, ...(view === "calendar" && { py: 1 }) }}>
          <ToggleButtonGroup exclusive value={view} onChange={(_, value) => { if (value) setView(value); }} aria-label="Visualizzazione spedizioni" size="small" sx={{ mb: view === "calendar" ? 1 : 2 }}>
            <ToggleButton value="calendar">Calendario</ToggleButton>
            <ToggleButton value="list">Elenco</ToggleButton>
          </ToggleButtonGroup>
          {view === "list" && <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "2fr repeat(4,1fr)" },
              gap: 1,
              mb: 2,
            }}
          >
            <TextField
              label="Cerca Commessa / Cliente"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <TextField
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
            <TextField
              type="date"
              label="Partenza da"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              type="date"
              label="Partenza a"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>}
          {view === "calendar" ? (
            <ShipmentCalendar items={operationalItems} onSelectShipment={(item) => open(item)} onSelectDate={(date) => open(undefined, date)} />
          ) : mobile ? (
            <Stack sx={{ gap: 1 }}>
              {filtered.map((item) => (
                <Card key={item.id} variant="outlined">
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", gap: 1 }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 900 }}>
                          {item.commessa}
                          {item.camion ? ` / ${item.camion}` : ""}
                        </Typography>
                        <Typography>{item.cliente}</Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={statusColor(item.shipmentStatus)}
                        label={labels[item.shipmentStatus]}
                      />
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Partenza prevista:{" "}
                      <PlannedDepartureDate shipment={item} />
                    </Typography>
                    <Typography variant="body2">
                      Trasporto:{" "}
                      {transportLabel(item.transportType)}
                    </Typography>
                    <Typography variant="body2">
                      Mezzo / Trasportatore: {vehicle(item)}
                    </Typography>
                    <Typography variant="body2">
                      Partenza effettiva: {actualDepartureLabel(item.actualDepartureDate)}
                    </Typography>
                    <Stack direction="row" sx={{ alignItems: "center", gap: 1, mt: 1 }}>
                      <Typography variant="body2">Stato operativo:</Typography>
                      <OperationalStatusChip status={item.operationalStatus} />
                    </Stack>
                    <Box sx={{ mt: 1 }}>{action(item)}</Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer>
              <Table size="small" sx={{ minWidth: 1350 }}>
                <TableHead>
                  <TableRow>
                    {columns.map(({ label, sortKey: columnSortKey }) => (
                      <TableCell
                        key={label}
                        sx={
                          label === "Azioni"
                            ? { minWidth: 190, width: 190 }
                            : undefined
                        }
                      >
                        {columnSortKey ? (
                          <TableSortLabel
                            active={sortKey === columnSortKey}
                            direction={
                              sortKey === columnSortKey ? sortDirection : "asc"
                            }
                            onClick={() => requestSort(columnSortKey)}
                          >
                            {label}
                          </TableSortLabel>
                        ) : (
                          label
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sorted.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell sx={{ minWidth: 190, width: 190 }}>
                        <Stack
                          direction="row"
                          sx={{
                            alignItems: "flex-start",
                            justifyContent: "flex-start",
                            width: "100%",
                            "& .MuiButton-root": {
                              justifyContent: "flex-start",
                              minWidth: 0,
                            },
                          }}
                        >
                          {action(item)}
                        </Stack>
                      </TableCell>
                      <TableCell>{item.commessa}</TableCell>
                      <TableCell>{item.cliente}</TableCell>
                      <TableCell>{item.camion ?? "—"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={statusColor(item.shipmentStatus)}
                          label={labels[item.shipmentStatus]}
                        />
                      </TableCell>
                      <TableCell>
                        <PlannedDepartureDate shipment={item} />
                      </TableCell>
                      <TableCell>
                        <OperationalStatusChip status={item.operationalStatus} />
                      </TableCell>
                      <TableCell>
                        {transportLabel(item.transportType)}
                      </TableCell>
                      <TableCell>{vehicle(item)}</TableCell>
                      <TableCell>
                        {actualDepartureLabel(item.actualDepartureDate)}
                      </TableCell>
                      <TableCell>{item.notes ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
        <Dialog
          open={editing !== null}
          onClose={() => setEditing(null)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            {editing === "new" || (editing && !editing.persisted)
              ? "Pianifica spedizione"
              : "Modifica pianificazione"}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: "grid", gap: 1.5, pt: 1 }}>
              {calendarDate && <Autocomplete
                options={items.filter((item) => !item.persisted && item.loadId && !item.plannedDepartureDate)}
                value={editing && editing !== "new" ? editing : null}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                getOptionLabel={(item) => [item.commessa, item.camion, item.cliente].filter(Boolean).join(" · ")}
                onChange={(_, item) => open(item ?? undefined, calendarDate)}
                renderInput={(params) => <TextField {...params} label="Carico da pianificare" helperText="Seleziona un carico esistente oppure compila una nuova pianificazione." />}
                noOptionsText="Nessun carico da pianificare"
              />}
              <TextField
                required
                label="Commessa"
                disabled={editing !== "new" && Boolean(editing?.loadId)}
                value={form.commessa}
                onChange={(e) => setForm({ ...form, commessa: e.target.value })}
              />
              <TextField
                required
                label="Cliente"
                disabled={editing !== "new" && Boolean(editing?.loadId)}
                value={form.cliente}
                onChange={(e) => setForm({ ...form, cliente: e.target.value })}
              />
              <TextField
                label="Riferimento ordine"
                value={form.orderReference ?? ""}
                onChange={(event) => setForm({ ...form, orderReference: event.target.value })}
                helperText="Facoltativo. Salvato solo nella pianificazione."
              />
              <TextField
                label="Carico / Camion"
                disabled={editing !== "new" && Boolean(editing?.loadId)}
                value={form.camion ?? ""}
                onChange={(e) => setForm({ ...form, camion: e.target.value })}
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
                  textField: { fullWidth: true, helperText: "Facoltativa" },
                }}
              />
              <TextField
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
              {form.transportType&&<TextField select label={detailLabel} value={form.transportDetailId??""} onChange={e=>setForm({...form,transportDetailId:e.target.value||null,plannedCarrierId:null})} helperText="Facoltativo">
                <MenuItem value="">Non specificato</MenuItem>
                {detailOptions.filter(item=>item.attivo||item.id===form.transportDetailId).map(item=><MenuItem key={item.id} value={item.id} disabled={!item.attivo}>{item.nome}{!item.attivo?" (non attivo)":""}</MenuItem>)}
                {form.transportDetailId&&!detailOptions.some(item=>item.id===form.transportDetailId)&&<MenuItem value={form.transportDetailId} disabled>{editing&&editing!=="new"?editing.transportDetailLabel??"Voce storica":"Voce storica"} (non disponibile)</MenuItem>}
              </TextField>}
              <TextField
                multiline
                minRows={2}
                label="Note"
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Box>
          </DialogContent>
          {editing!=="new"&&editing?.persisted&&<Box sx={{mx:3,pt:2,borderTop:1,borderColor:"divider"}}><Button color="error" variant="outlined" startIcon={<DeleteOutlinedIcon/>} onClick={()=>setDeleteItem(editing)}>Elimina spedizione</Button></Box>}
          <DialogActions>
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
        <Dialog
          open={departureItem !== null}
          onClose={() => setDepartureItem(null)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Conferma partenza</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 2 }}>
              {departureItem?.commessa}
              {departureItem?.camion ? ` / ${departureItem.camion}` : ""} — {departureItem?.cliente}
            </Typography>
            <TextField
              select
              required
              fullWidth
              label="Trasportatore effettivo"
              value={departureCarrierId}
              onChange={(event) => setDepartureCarrierId(event.target.value)}
            >
              <MenuItem value="" disabled>
                Seleziona trasportatore
              </MenuItem>
              {activeCarriers.map((carrier) => (
                <MenuItem key={carrier.id} value={carrier.id}>
                  {carrier.nome}
                </MenuItem>
              ))}
            </TextField>
            {!activeCarriers.length && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Nessun trasportatore attivo disponibile. Configurarlo nelle Impostazioni.
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDepartureItem(null)}>Annulla</Button>
            <Button
              variant="contained"
              disabled={!departureCarrierId || !activeCarriers.length}
              onClick={() => {
                if (departureItem) void depart(departureItem, departureCarrierId);
              }}
            >
              Conferma partenza
            </Button>
          </DialogActions>
        </Dialog>
        <Snackbar
          open={notice !== null}
          autoHideDuration={3500}
          onClose={() => setNotice(null)}
        >
          <Alert severity={notice?.severity ?? "success"}>{notice?.text}</Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
}
