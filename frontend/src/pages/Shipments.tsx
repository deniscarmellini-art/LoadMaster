import { useMemo, useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Alert,
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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import "dayjs/locale/it";
import type { Rimorchio, Trasportatore } from "../models/Settings";
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
import { operationalStatusPresentation } from "../services/dashboardService";
interface Props {
  items: ShipmentItem[];
  trailers: Rimorchio[];
  carriers: Trasportatore[];
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
  { label: "Tipo trasporto", sortKey: "transportType" },
  { label: "Mezzo / Trasportatore", sortKey: "vehicle" },
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
  const [editing, setEditing] = useState<ShipmentItem | null | "new">(null),
    [form, setForm] = useState<ShipmentInput>(empty),
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
  const open = (item?: ShipmentItem) => {
    setEditing(item ?? "new");
    setForm(
      item
        ? {
            loadId: item.loadId,
            commessa: item.commessa,
            cliente: item.cliente,
            camion: item.camion,
            plannedLoadingDate: item.plannedLoadingDate,
            plannedDepartureDate: item.plannedDepartureDate,
            transportType: item.transportType,
            trailerId: null,
            carrierId: null,
            notes: item.notes,
          }
        : empty,
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
      setNotice({ severity: "success", text: "Spedizione eliminata." });
    } catch {
      setNotice({
        severity: "error",
        text: "La spedizione collegata non può essere eliminata.",
      });
    }
  };
  const depart = async (item: ShipmentItem) => {
    try {
      await departShipment(item.id);
      await onRefresh();
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
      <Button
        variant="contained"
        size="small"
        onClick={() => void depart(item)}
      >
        Conferma partenza
      </Button>
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
  const vehicle = (item: ShipmentItem) =>
    item.transportType === "BILICO_ESSEPI"
      ? item.trailerId
        ? (trailers.find((x) => x.id === item.trailerId)?.targa ?? "—")
        : "Bilico Essepi — Da assegnare"
      : item.transportType === "TRASPORTATORE_ESTERNO"
        ? "Ritira Cliente"
        : "—";
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
          return item.transportType === "BILICO_ESSEPI"
            ? "Bilico Essepi"
            : item.transportType === "TRASPORTATORE_ESTERNO"
              ? "Ritira Cliente"
              : null;
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
  }, [filtered, sortKey, sortDirection, trailers]);
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
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{
            alignItems: { xs: "stretch", sm: "center" },
            gap: { xs: 1, sm: 0 },
            mb: 2,
          }}
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={{ alignSelf: { xs: "flex-start", sm: "auto" } }}
          >
            Dashboard
          </Button>
          <Typography
            variant={mobile ? "h5" : "h4"}
            sx={{
              fontWeight: 800,
              mx: { xs: 0, sm: "auto" },
              textAlign: "center",
            }}
          >
            Spedizioni
          </Typography>
          <Button
            variant="contained"
            onClick={() => open()}
            sx={{ alignSelf: { xs: "flex-end", sm: "auto" } }}
          >
            + Pianifica spedizione
          </Button>
        </Stack>
        <Box
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
        </Box>
        {legacyCount > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {legacyCount} spedizion{legacyCount === 1 ? "e" : "i"} conclus
            {legacyCount === 1 ? "a" : "e"} senza data di partenza effettiva:
            restano visibili perché non è possibile calcolare il limite di 7 giorni.
          </Alert>
        )}
        <Paper sx={{ p: { xs: 1, md: 2 } }}>
          <Box
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
              label="Tipo trasporto"
              value={type}
              onChange={(e) =>
                setType(e.target.value as ShipmentTransportType | "")
              }
            >
              <MenuItem value="">Tutti</MenuItem>
              <MenuItem value="BILICO_ESSEPI">Bilico Essepi</MenuItem>
              <MenuItem value="TRASPORTATORE_ESTERNO">Ritira Cliente</MenuItem>
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
          </Box>
          {mobile ? (
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
                      {item.transportType === "BILICO_ESSEPI"
                        ? "Bilico Essepi"
                        : item.transportType === "TRASPORTATORE_ESTERNO"
                          ? "Ritira Cliente"
                          : "—"}
                    </Typography>
                    <Typography variant="body2">
                      Mezzo: {vehicle(item)}
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
                          {item.persisted && !item.loadId && (
                            <Button
                              color="error"
                              size="small"
                              onClick={() => void remove(item)}
                            >
                              Elimina
                            </Button>
                          )}
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
                        {item.transportType === "BILICO_ESSEPI"
                          ? "Bilico Essepi"
                          : item.transportType === "TRASPORTATORE_ESTERNO"
                            ? "Ritira Cliente"
                            : "—"}
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
            {editing === "new"
              ? "Pianifica spedizione"
              : "Pianificazione spedizione"}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: "grid", gap: 1.5, pt: 1 }}>
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
                label="Tipo trasporto"
                value={form.transportType ?? ""}
                onChange={(e) => {
                  const value = e.target.value as ShipmentTransportType;
                  setForm({
                    ...form,
                    transportType: value,
                    trailerId: null,
                    carrierId: null,
                  });
                }}
              >
                <MenuItem value="" disabled>
                  Seleziona tipo trasporto
                </MenuItem>
                <MenuItem value="BILICO_ESSEPI">Bilico Essepi</MenuItem>
                <MenuItem value="TRASPORTATORE_ESTERNO">
                  Ritira Cliente
                </MenuItem>
              </TextField>
              <TextField
                multiline
                minRows={2}
                label="Note"
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Box>
          </DialogContent>
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
