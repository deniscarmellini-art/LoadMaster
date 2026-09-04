import { Fragment, useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
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
  Tooltip,
  Typography,
} from "@mui/material";
import type { Pacco, UnitaSingola } from "../models/Scanning";
import type { Commessa, Pannello } from "../types/excel";
import PackagePrintPreview from "../components/scanning/PackagePrintPreview";
import { buildPanelKey } from "../utils/panelIdentity";
import { formatPackageDimensions } from "../utils/packageDimensions";

interface Props {
  commesse: Commessa[];
  singles: UnitaSingola[];
  packages: Pacco[];
  drafts: Map<string, Pannello[]>;
  onBack: () => void;
  onCancelSingle: (unit: UnitaSingola) => void;
  onCancelPackage: (pack: Pacco) => Promise<void>;
  onRemoveDraftPanel: (key: string, panel: Pannello) => void;
  onUpdatePanelLocation: (panel: Pannello, location: string) => Promise<void>;
  onUpdatePackageLocation: (pack: Pacco, location: string) => Promise<void>;
  trailerLocationByLoadId: ReadonlyMap<string, string>;
}
type Pending =
  | { kind: "single"; unit: UnitaSingola; blocked: boolean }
  | { kind: "package"; pack: Pacco; blocked: boolean }
  | { kind: "draft"; key: string; panel: Pannello };
const draftParts = (key: string) => key.split("\u0000");
const nowrap = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
} as const;
const dimensions = (panel: Pannello) =>
  `${Math.round(panel.spessore)} × ${Math.round(panel.lunghezza)} × ${Math.round(panel.altezza)}`;
const operatorCode = (operator: string) => operator.split("—")[0]?.trim() || operator || "—";
type SortKey =
  | "commessa"
  | "cliente"
  | "camion"
  | "pannello"
  | "codicePacco"
  | "numeroPannelli"
  | "masterPanel"
  | "dimensioni"
  | "peso"
  | "volume"
  | "dataScansione"
  | "chiusura"
  | "operatore"
  | "ubicazione"
  | "stato";
type SortDirection = "asc" | "desc";
type WarehouseStatus = "all" | "DISPONIBILE" | "CARICATO" | "APERTO";
const singleColumns: ReadonlyArray<{
  label: string;
  width: number;
  sortKey?: SortKey;
}> = [
  { label: "Commessa", width: 90, sortKey: "commessa" },
  { label: "Cliente", width: 120, sortKey: "cliente" },
  { label: "Camion", width: 65, sortKey: "camion" },
  { label: "Elemento", width: 75, sortKey: "pannello" },
  { label: "Master panel", width: 90, sortKey: "masterPanel" },
  { label: "Dimensioni", width: 150, sortKey: "dimensioni" },
  { label: "Peso", width: 75, sortKey: "peso" },
  { label: "Volume", width: 80, sortKey: "volume" },
  { label: "Data scansione", width: 135, sortKey: "dataScansione" },
  { label: "Oper.", width: 75, sortKey: "operatore" },
  { label: "Ubicazione", width: 105, sortKey: "ubicazione" },
  { label: "Stato", width: 90, sortKey: "stato" },
  { label: "Azioni", width: 82 },
];
const packageColumns: ReadonlyArray<{
  label: string;
  width: number;
  sortKey?: SortKey;
}> = [
  { label: "Commessa", width: 105, sortKey: "commessa" },
  { label: "Cliente", width: 130, sortKey: "cliente" },
  { label: "Camion", width: 85, sortKey: "camion" },
  { label: "Codice pacco", width: 165, sortKey: "codicePacco" },
  { label: "N. elementi", width: 85, sortKey: "numeroPannelli" },
  { label: "Dimensioni", width: 205, sortKey: "dimensioni" },
  { label: "Peso", width: 105, sortKey: "peso" },
  { label: "Volume", width: 105, sortKey: "volume" },
  { label: "Chiusura", width: 145, sortKey: "chiusura" },
  { label: "Oper.", width: 75, sortKey: "operatore" },
  { label: "Ubicazione", width: 105, sortKey: "ubicazione" },
  { label: "Dettaglio", width: 95 },
  { label: "Stato", width: 130, sortKey: "stato" },
  { label: "Azioni", width: 90 },
];
const collator = new Intl.Collator("it-IT", {
  numeric: true,
  sensitivity: "base",
});

export default function Warehouse({
  commesse,
  singles,
  packages,
  drafts,
  onBack,
  onCancelSingle,
  onCancelPackage,
  onRemoveDraftPanel,
  onUpdatePanelLocation,
  onUpdatePackageLocation,
  trailerLocationByLoadId,
}: Props) {
  const [search, setSearch] = useState(""),
    [order, setOrder] = useState(""),
    [client, setClient] = useState(""),
    [truck, setTruck] = useState(""),
    [type, setType] = useState("all"),
    [status, setStatus] = useState<WarehouseStatus>("all"),
    [sortKey, setSortKey] = useState<SortKey | null>(null),
    [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pending, setPending] = useState<Pending | null>(null),
    [printPack, setPrintPack] = useState<Pacco | null>(null),
    [locationPanel, setLocationPanel] = useState<Pannello | null>(null),
    [locationValue, setLocationValue] = useState(""),
    [savingLocation, setSavingLocation] = useState(false),
    [packageLocation, setPackageLocation] = useState<Pacco | null>(null),
    [packageLocationValue, setPackageLocationValue] = useState(""),
    [savingPackageLocation, setSavingPackageLocation] = useState(false),
    [expandedPackageId, setExpandedPackageId] = useState<string | null>(null),
    [notice, setNotice] = useState<{
      message: string;
      severity: "success" | "error";
    } | null>(null);
  const clientFor = (unit: UnitaSingola) =>
    commesse.find((c) => c.ordine === unit.commessa)?.cliente ?? "";
  const panelFor = (unit: UnitaSingola) =>
    commesse
      .find((c) => c.ordine === unit.commessa)
      ?.pannelli.find(
        (panel) =>
          buildPanelKey({
            commessa: unit.commessa,
            cliente: clientFor(unit),
            camion: unit.camion,
            numeroPannello: unit.numeroPannello,
          }) ===
          buildPanelKey({
            commessa: unit.commessa,
            cliente: clientFor(unit),
            camion: panel.numeroCamion,
            numeroPannello: panel.numeroPannello,
          }),
      );
  const locationFor = (panel: Pannello) =>
    panel.caricato
      ? trailerLocationByLoadId.get(panel.loadId ?? "") ?? "Da assegnare"
      : panel.manualLocation?.trim() || "—";
  const openLocationEditor = (panel: Pannello) => {
    setLocationPanel(panel);
    setLocationValue(panel.manualLocation ?? "");
  };
  const saveLocation = async () => {
    if (!locationPanel) return;
    setSavingLocation(true);
    try {
      await onUpdatePanelLocation(locationPanel, locationValue);
      setLocationPanel(null);
      setNotice({ message: "Ubicazione aggiornata", severity: "success" });
    } catch {
      setNotice({
        message: "Non è stato possibile aggiornare l'ubicazione.",
        severity: "error",
      });
    } finally {
      setSavingLocation(false);
    }
  };
  const packageLocationFor = (pack: Pacco) =>
    pack.stato === "CARICATO" || pack.stato === "SPEDITO"
      ? trailerLocationByLoadId.get(pack.loadId ?? "") ?? "Da assegnare"
      : pack.manualLocation?.trim() || "—";
  const openPackageLocationEditor = (pack: Pacco) => {
    setPackageLocation(pack);
    setPackageLocationValue(pack.manualLocation ?? "");
  };
  const savePackageLocation = async () => {
    if (!packageLocation) return;
    setSavingPackageLocation(true);
    try {
      await onUpdatePackageLocation(packageLocation, packageLocationValue);
      setPackageLocation(null);
      setNotice({ message: "Ubicazione pacco aggiornata", severity: "success" });
    } catch {
      setNotice({
        message: "Non è stato possibile aggiornare l'ubicazione del pacco.",
        severity: "error",
      });
    } finally {
      setSavingPackageLocation(false);
    }
  };
  const match = (values: string[], kind: "single" | "package") => {
    const text = values.join(" ").toLowerCase();
    return (
      (!search || text.includes(search.toLowerCase())) &&
      (!order || values.includes(order)) &&
      (!client || values.includes(client)) &&
      (!truck || values.includes(truck)) &&
      (type === "all" || type === kind)
    );
  };
  const matchesStatus = (value: Exclude<WarehouseStatus, "all">) =>
    status === "all" || status === value;
  const visibleSingles = singles.filter(
    (unit) => {
      const panel = panelFor(unit);
      return (
        panel !== undefined &&
        !panel.spedito &&
        matchesStatus(panel.caricato ? "CARICATO" : "DISPONIBILE") &&
        match(
          [unit.commessa, clientFor(unit), unit.camion, unit.numeroPannello],
          "single",
        )
      );
    },
  );
  const sortedSingles = sortKey
    ? visibleSingles
        .map((unit, index) => ({ unit, index }))
        .sort((left, right) => {
          const value = (unit: UnitaSingola): string | number | null => {
            const panel = panelFor(unit);
            if (!panel) return null;
            switch (sortKey) {
              case "commessa":
                return unit.commessa;
              case "cliente":
                return clientFor(unit);
              case "camion":
                return unit.camion;
              case "pannello":
                return Number.isFinite(Number(panel.numeroPannello))
                  ? Number(panel.numeroPannello)
                  : panel.numeroPannello;
              case "masterPanel":
                return Number.isFinite(Number(panel.numeroMasterPanel))
                  ? Number(panel.numeroMasterPanel)
                  : panel.numeroMasterPanel;
              case "dimensioni":
                return dimensions(panel);
              case "peso":
                return panel.peso;
              case "volume":
                return panel.volume;
              case "dataScansione": {
                const timestamp = Date.parse(unit.chiusaIl);
                return Number.isNaN(timestamp) ? null : timestamp;
              }
              case "operatore":
                return unit.operatore;
              case "ubicazione":
                return locationFor(panel);
              case "stato":
                return panel.caricato ? "CARICATO" : "DISPONIBILE";
              default:
                return null;
            }
          };
          const a = value(left.unit);
          const b = value(right.unit);
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
        .map(({ unit }) => unit)
    : visibleSingles;
  const requestSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };
  const visiblePackages = packages.filter(
    (pack) =>
      pack.stato !== "SPEDITO" &&
      matchesStatus(pack.stato) &&
      match([pack.codice, pack.commessa, pack.cliente, pack.camion], "package"),
  );
  const sortedPackages = sortKey
    ? visiblePackages
        .map((pack, index) => ({ pack, index }))
        .sort((left, right) => {
          const value = (pack: Pacco): string | number | null => {
            switch (sortKey) {
              case "commessa":
                return pack.commessa;
              case "cliente":
                return pack.cliente;
              case "camion":
                return pack.camion;
              case "codicePacco":
                return pack.codice;
              case "numeroPannelli":
                return pack.numeroPezzi;
              case "dimensioni":
                return formatPackageDimensions(pack);
              case "peso":
                return pack.pesoTotale;
              case "volume":
                return pack.volumeTotale;
              case "chiusura": {
                const timestamp = Date.parse(pack.chiusoIl);
                return Number.isNaN(timestamp) ? null : timestamp;
              }
              case "operatore":
                return pack.operatore;
              case "ubicazione":
                return packageLocationFor(pack);
              case "stato":
                return pack.stato;
              default:
                return null;
            }
          };
          const a = value(left.pack);
          const b = value(right.pack);
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
        .map(({ pack }) => pack)
    : visiblePackages;
  const confirm = async () => {
    if (!pending) return;
    if (pending.kind === "single") {
      onCancelSingle(pending.unit);
      setNotice({
        message: "Scansione dell'elemento annullata",
        severity: "success",
      });
    } else if (pending.kind === "package") {
      try {
        await onCancelPackage(pending.pack);
        setNotice({message:"Pacco annullato ed elementi riportati a MANCANTE",severity:"success"});
      } catch(error:unknown) {
        setNotice({message:error instanceof Error?error.message:"Impossibile eliminare il pacco",severity:"error"});
      }
    } else {
      onRemoveDraftPanel(pending.key, pending.panel);
      setNotice({
        message: "Elemento rimosso dal pacco aperto",
        severity: "success",
      });
    }
    setPending(null);
  };
  const options = (selector: (commessa: Commessa) => string) =>
    Array.from(new Set(commesse.map(selector).filter(Boolean)));
  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ alignItems: { xs: "stretch", sm: "center" }, gap: { xs: 1, sm: 0 }, mb: 2 }}
      >
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ alignSelf: { xs: "flex-start", sm: "auto" } }}>
          Dashboard
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 800, mx: { xs: 0, sm: "auto" }, textAlign: "center" }}>
          Magazzino
        </Typography>
      </Stack>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(3,minmax(0,1fr))",
              xl: "2fr repeat(5,minmax(130px,1fr))",
            },
            gap: 1,
          }}
        >
          <TextField
            label="Cerca elemento, pacco, commessa o cliente"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ gridColumn: { md: "span 3", xl: "auto" } }}
          />
          <TextField
            select
            label="Commessa"
            value={order}
            onChange={(event) => setOrder(event.target.value)}
          >
            <MenuItem value="">Tutte</MenuItem>
            {options((c) => c.ordine).map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Cliente"
            value={client}
            onChange={(event) => setClient(event.target.value)}
          >
            <MenuItem value="">Tutti</MenuItem>
            {options((c) => c.cliente).map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Camion"
            value={truck}
            onChange={(event) => setTruck(event.target.value)}
          >
            <MenuItem value="">Tutti</MenuItem>
            {Array.from(
              new Set(
                commesse.flatMap((c) => c.pannelli.map((p) => p.numeroCamion)),
              ),
            ).map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Tipo unità"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <MenuItem value="all">Tutti</MenuItem>
            <MenuItem value="single">Singoli</MenuItem>
            <MenuItem value="package">Pacchi</MenuItem>
          </TextField>
          <TextField
            select
            label="Stato"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as WarehouseStatus)
            }
          >
            <MenuItem value="all">Tutti</MenuItem>
            <MenuItem value="DISPONIBILE">Disponibile</MenuItem>
            <MenuItem value="CARICATO">Caricato</MenuItem>
            <MenuItem value="APERTO">Aperto</MenuItem>
          </TextField>
        </Box>
      </Paper>
      {(type === "all" || type === "single") && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Elementi singoli disponibili
          </Typography>
          <TableContainer sx={{ display: { xs: "none", sm: "block" } }}>
            <Table
              size="small"
              sx={{ tableLayout: "fixed", minWidth: { xs: 1232, lg: "100%" } }}
            >
              <TableHead>
                <TableRow>
                  {singleColumns.map(
                    ({ label, width, sortKey: columnSortKey }) => (
                      <TableCell
                        key={label}
                        align={
                          label === "Camion" || label === "Elemento" || label === "Master panel" || label === "Stato" || label === "Azioni"
                            ? "center"
                            : label === "Peso" || label === "Volume"
                              ? "right"
                              : "left"
                        }
                        sx={{ width, ...nowrap }}
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
                    ),
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedSingles.map((unit) => {
                  const panel = panelFor(unit)!;
                  return (
                    <TableRow
                      hover
                      key={`${unit.commessa}-${unit.camion}-${unit.numeroPannello}`}
                    >
                      <TableCell sx={nowrap}>{unit.commessa}</TableCell>
                      <TableCell sx={nowrap}>{clientFor(unit)}</TableCell>
                      <TableCell align="center" sx={nowrap}>{unit.camion}</TableCell>
                      <TableCell align="center" sx={nowrap}>{panel.numeroPannello}</TableCell>
                      <TableCell align="center" sx={nowrap}>
                        {panel.numeroMasterPanel}
                      </TableCell>
                      <TableCell sx={nowrap}>{dimensions(panel)}</TableCell>
                      <TableCell align="right" sx={nowrap}>
                        {panel.peso.toFixed(1)} kg
                      </TableCell>
                      <TableCell align="right" sx={nowrap}>
                        {panel.volume.toFixed(3)} m³
                      </TableCell>
                      <TableCell sx={nowrap}>
                        {new Date(unit.chiusaIl).toLocaleString("it-IT")}
                      </TableCell>
                      <TableCell sx={nowrap}>{operatorCode(unit.operatore)}</TableCell>
                      <TableCell sx={nowrap}>
                        <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                          <Typography variant="body2" sx={nowrap}>
                            {locationFor(panel)}
                          </Typography>
                          {!panel.caricato && (
                            <Tooltip title="Modifica ubicazione">
                              <IconButton
                                size="small"
                                aria-label={`Modifica ubicazione elemento ${panel.numeroPannello}`}
                                onClick={() => openLocationEditor(panel)}
                              >
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          color={panel.caricato ? "warning" : "success"}
                          variant="outlined"
                          label={panel.caricato ? "CARICATO" : "DISPONIBILE"}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Elimina">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() =>
                              setPending({
                                kind: "single",
                                unit,
                                blocked: panel.caricato,
                              })
                            }
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack sx={{ display: { xs: "flex", sm: "none" }, gap: 1.25 }}>
            {sortedSingles.map((unit) => {
              const panel = panelFor(unit)!;
              const loaded = panel.caricato;
              return (
                <Paper
                  key={`${unit.commessa}-${unit.camion}-${unit.numeroPannello}`}
                  variant="outlined"
                  sx={{ p: 1.5 }}
                >
                  <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: "1.1rem", fontWeight: 900 }}>
                        Elemento {panel.numeroPannello}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Master Panel {panel.numeroMasterPanel}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={loaded ? "warning" : "success"}
                      variant="outlined"
                      label={loaded ? "CARICATO" : "DISPONIBILE"}
                    />
                  </Stack>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 1, mt: 1.5 }}>
                    {[
                      ["Commessa", unit.commessa],
                      ["Cliente", clientFor(unit)],
                      ["Camion", unit.camion],
                      ["Dimensioni", `${dimensions(panel)} mm`],
                      ["Peso", `${panel.peso.toFixed(1)} kg`],
                      ["Volume", `${panel.volume.toFixed(3)} m³`],
                      ["Data scansione", new Date(unit.chiusaIl).toLocaleString("it-IT")],
                      ["Operatore", unit.operatore],
                      ["Ubicazione", locationFor(panel)],
                    ].map(([label, value]) => (
                      <Box key={label} sx={{ minWidth: 0, gridColumn: label === "Data scansione" ? "1 / -1" : undefined }}>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{value}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Stack direction="row" sx={{ justifyContent: "space-between", mt: 1 }}>
                    {!loaded && (
                      <Button
                        size="small"
                        startIcon={<EditOutlinedIcon />}
                        onClick={() => openLocationEditor(panel)}
                        sx={{ minHeight: 44 }}
                      >
                        Modifica ubicazione
                      </Button>
                    )}
                    <Tooltip title="Elimina">
                      <IconButton
                        color="error"
                        aria-label={`Elimina elemento ${panel.numeroPannello}`}
                        onClick={() => setPending({ kind: "single", unit, blocked: loaded })}
                        sx={{ minHeight: 48, minWidth: 48 }}
                      >
                        <DeleteOutlinedIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Paper>
      )}
      {(type === "all" || type === "package") && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Pacchi
          </Typography>
          <TableContainer sx={{ display: { xs: "none", sm: "block" } }}>
            <Table size="small" sx={{ tableLayout: "fixed", minWidth: 1625 }}>
              <TableHead>
                <TableRow>
                  {packageColumns.map(({ label, width, sortKey: columnSortKey }) => (
                    <TableCell
                      key={label}
                      align={
                        label === "Camion" || label === "N. elementi" || label === "Dettaglio" || label === "Stato" || label === "Azioni"
                          ? "center"
                          : label === "Peso" || label === "Volume"
                            ? "right"
                            : "left"
                      }
                      sx={{
                        width,
                        ...nowrap,
                        ...(label === "Azioni"
                          ? {
                              position: "sticky",
                              right: 0,
                              zIndex: 2,
                              bgcolor: "background.paper",
                              boxShadow: "-4px 0 8px rgba(0, 0, 0, 0.12)",
                            }
                          : {}),
                      }}
                    >
                      {columnSortKey ? (
                        <TableSortLabel
                          active={sortKey === columnSortKey}
                          direction={sortKey === columnSortKey ? sortDirection : "asc"}
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
                {sortedPackages.map((pack) => {
                  const packageId = pack.id ?? pack.codice;
                  const expanded = expandedPackageId === packageId;
                  const editableLocation = pack.stato === "DISPONIBILE";
                  return (
                    <Fragment key={packageId}>
                      <TableRow hover>
                        <TableCell sx={nowrap}>{pack.commessa}</TableCell>
                        <TableCell sx={nowrap}>{pack.cliente}</TableCell>
                        <TableCell align="center" sx={nowrap}>{pack.camion}</TableCell>
                        <TableCell sx={{ color: "primary.main", fontWeight: 800, ...nowrap }}>{pack.codice}</TableCell>
                        <TableCell align="center" sx={nowrap}>{pack.numeroPezzi}</TableCell>
                        <TableCell sx={nowrap}>{formatPackageDimensions(pack)}</TableCell>
                        <TableCell align="right" sx={nowrap}>{pack.pesoTotale.toFixed(1)} kg</TableCell>
                        <TableCell align="right" sx={nowrap}>{pack.volumeTotale.toFixed(3)} m³</TableCell>
                        <TableCell sx={nowrap}>{pack.chiusoIl ? new Date(pack.chiusoIl).toLocaleString("it-IT") : "—"}</TableCell>
                        <TableCell sx={nowrap}>{operatorCode(pack.operatore)}</TableCell>
                        <TableCell sx={nowrap}>
                          <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                            <Typography variant="body2" sx={nowrap}>
                              {packageLocationFor(pack)}
                            </Typography>
                            {editableLocation && (
                              <Tooltip title="Modifica ubicazione">
                                <IconButton size="small" onClick={() => openPackageLocationEditor(pack)}>
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title={expanded ? "Nascondi dettaglio" : "Espandi dettaglio"}>
                            <IconButton size="small" onClick={() => setExpandedPackageId(expanded ? null : packageId)}>
                              <ExpandMoreIcon fontSize="small" sx={{ transform: expanded ? "rotate(180deg)" : "none" }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            color={pack.stato === "CARICATO" ? "warning" : "info"}
                            variant="outlined"
                            label={pack.stato}
                          />
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{
                            position: "sticky",
                            right: 0,
                            zIndex: 1,
                            bgcolor: "background.paper",
                            boxShadow: "-4px 0 8px rgba(0, 0, 0, 0.12)",
                          }}
                        >
                          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "center", gap: 0.25 }}>
                            <Tooltip title="Stampa etichetta pacco">
                              <IconButton size="small" onClick={() => setPrintPack(pack)}>
                                <PrintOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Elimina">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setPending({ kind: "package", pack, blocked: pack.stato === "CARICATO" || pack.stato === "SPEDITO" })}
                              >
                                <DeleteOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow>
                          <TableCell colSpan={packageColumns.length} sx={{ p: 0 }}>
                            <PackageContents pack={pack} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack sx={{ display: { xs: "flex", sm: "none" }, gap: 1.25 }}>
            {sortedPackages.map((pack) => (
              <PackageCard
                key={pack.id ?? pack.codice}
                pack={pack}
                onDelete={() =>
                  setPending({
                    kind: "package",
                    pack,
                    blocked:
                      pack.stato === "CARICATO" || pack.stato === "SPEDITO",
                  })
                }
                onPrint={() => setPrintPack(pack)}
                location={packageLocationFor(pack)}
                onEditLocation={
                  pack.stato === "DISPONIBILE"
                    ? () => openPackageLocationEditor(pack)
                    : undefined
                }
              />
            ))}
          </Stack>
          <Stack sx={{ gap: 1.25, mt: 1.25 }}>
            {Array.from(drafts.entries())
              .filter(([key, items]) => {
                if (!items.length || !matchesStatus("APERTO")) return false;
                const [draftOrder, draftTruck] = draftParts(key);
                const draftCliente = commesse.find(
                  (commessa) => commessa.ordine === draftOrder,
                )?.cliente;
                return match([draftOrder, draftCliente ?? "", draftTruck], "package");
              })
              .map(([key, items]) => {
                const [draftOrder, draftTruck] = draftParts(key);
                const draftCommessa = commesse.find(
                  (c) => c.ordine === draftOrder,
                );
                return (
                  <Accordion
                    key={key}
                    disableGutters
                    sx={{
                      border: 1,
                      borderColor: "divider",
                      "&:before": { display: "none" },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <b>
                        Pacco aperto — {draftOrder} / {draftTruck} (
                        {items.length} elementi)
                      </b>
                    </AccordionSummary>
                    <AccordionDetails>
                      {items.map((panel) => (
                        <Box
                          key={panel.numeroPannello}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            pl: 2,
                            py: 0.5,
                          }}
                        >
                          <span>
                            ↳ Elemento {panel.numeroPannello} · MP{" "}
                            {panel.numeroMasterPanel} · {panel.peso.toFixed(1)}{" "}
                            kg · {draftCommessa?.cliente}
                          </span>
                          <IconButton
                            color="error"
                            sx={{ ml: "auto" }}
                            onClick={() =>
                              setPending({ kind: "draft", key, panel })
                            }
                          >
                            <DeleteOutlinedIcon />
                          </IconButton>
                        </Box>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                );
              })}
          </Stack>
        </Paper>
      )}
      <Dialog open={pending !== null} onClose={() => setPending(null)}>
        <DialogTitle>
          {pending && "blocked" in pending && pending.blocked
            ? "Operazione non consentita"
            : "Conferma annullamento"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pending?.kind === "single"
              ? pending.blocked
                ? "L'elemento è CARICATO o SPEDITO e non può essere eliminato."
                : "Annullare la scansione dell'elemento e riportarlo a MANCANTE?"
              : pending?.kind === "package"
                ? pending.blocked
                  ? "Il pacco è CARICATO o SPEDITO e non può essere annullato."
                  : `Annullare il pacco ${pending.pack.codice} e riportare tutti gli elementi a MANCANTE?`
                : "Rimuovere l'elemento dal pacco aperto?"}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>
            {pending && "blocked" in pending && pending.blocked
              ? "Chiudi"
              : "Annulla"}
          </Button>
          {!(pending && "blocked" in pending && pending.blocked) && (
            <Button color="error" variant="contained" onClick={confirm}>
              Conferma
            </Button>
          )}
        </DialogActions>
      </Dialog>
      <Dialog
        fullWidth
        maxWidth="sm"
        open={locationPanel !== null}
        onClose={() => !savingLocation && setLocationPanel(null)}
      >
        <DialogTitle>Ubicazione elemento {locationPanel?.numeroPannello}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Inserisci la posizione fisica dell'elemento disponibile. Lascia il campo vuoto per rimuoverla.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Posizione"
            value={locationValue}
            slotProps={{ htmlInput: { maxLength: 120 } }}
            onChange={(event) => setLocationValue(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={savingLocation} onClick={() => setLocationPanel(null)}>
            Annulla
          </Button>
          <Button disabled={savingLocation} variant="contained" onClick={() => void saveLocation()}>
            Salva
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        fullWidth
        maxWidth="lg"
        open={printPack !== null}
        onClose={() => setPrintPack(null)}
      >
        <DialogTitle className="no-print">
          Ristampa pacco {printPack?.codice}
        </DialogTitle>
        <DialogContent>
          {printPack && <PackagePrintPreview pack={printPack} />}
        </DialogContent>
        <DialogActions className="no-print">
          <Button onClick={() => setPrintPack(null)}>Chiudi</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        fullWidth
        maxWidth="sm"
        open={packageLocation !== null}
        onClose={() => !savingPackageLocation && setPackageLocation(null)}
      >
        <DialogTitle>Ubicazione pacco {packageLocation?.codice}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Inserisci la posizione fisica del pacco disponibile. Lascia il campo vuoto per rimuoverla.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Posizione"
            value={packageLocationValue}
            slotProps={{ htmlInput: { maxLength: 120 } }}
            onChange={(event) => setPackageLocationValue(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={savingPackageLocation} onClick={() => setPackageLocation(null)}>
            Annulla
          </Button>
          <Button disabled={savingPackageLocation} variant="contained" onClick={() => void savePackageLocation()}>
            Salva
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={notice !== null}
        autoHideDuration={3500}
        onClose={() => setNotice(null)}
      >
        <Alert
          severity={notice?.severity ?? "success"}
          onClose={() => setNotice(null)}
        >
          {notice?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function PackageCard({
  pack,
  onPrint,
  onDelete,
  location,
  onEditLocation,
}: {
  pack: Pacco;
  onPrint: () => void;
  onDelete: () => void;
  location: string;
  onEditLocation?: () => void;
}) {
  const fields = [
    ["Commessa / Cliente", `${pack.commessa} · ${pack.cliente}`],
    ["Camion", pack.camion],
    ["Pacco / Elementi", `${pack.codice} · ${pack.numeroPezzi} elementi`],
    ["Dimensioni", formatPackageDimensions(pack)],
    ["Peso", `${pack.pesoTotale.toFixed(1)} kg`],
    ["Volume", `${pack.volumeTotale.toFixed(3)} m³`],
    [
      "Chiusura",
      pack.chiusoIl ? new Date(pack.chiusoIl).toLocaleString("it-IT") : "—",
    ],
    ["Operatore", pack.operatore || "—"],
    ["Ubicazione", location],
  ] as const;
  return (
    <Accordion
      disableGutters
      sx={{
        bgcolor: "rgba(255,255,255,.018)",
        border: 1,
        borderColor: "divider",
        borderRadius: "8px!important",
        "&:before": { display: "none" },
        overflow: "hidden",
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: 2,
          "& .MuiAccordionSummary-content": { minWidth: 0, my: 1.25 },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr auto",
              lg: "minmax(150px,1.25fr) 65px minmax(170px,1.4fr) minmax(140px,1fr) 80px 85px 135px minmax(140px,1fr) minmax(150px,1.2fr) 90px 110px",
            },
            alignItems: "center",
            gap: { xs: 1, lg: 1 },
            width: "100%",
            minWidth: 0,
          }}
        >
          <Box sx={{ display: { xs: "none", lg: "contents" } }}>
            {fields.map(([label, value]) => (
              <Box key={label} sx={{ minWidth: 0 }}>
                <Typography
                  color="text.secondary"
                  variant="caption"
                  sx={{ display: "block", ...nowrap }}
                >
                  {label}
                </Typography>
                <Typography
                  variant="body2"
                  color={label === "Pacco / Elementi" ? "primary.main" : undefined}
                  sx={{
                    fontWeight: label === "Pacco / Elementi" ? 800 : 400,
                    ...nowrap,
                  }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
            <Box sx={{ minWidth: 0 }}>
              <Typography
                color="text.secondary"
                variant="caption"
                sx={{ display: "block", ...nowrap }}
              >
                Stato
              </Typography>
              <Chip
                size="small"
                color={
                  pack.stato === "SPEDITO"
                    ? "success"
                    : pack.stato === "CARICATO"
                      ? "warning"
                      : "info"
                }
                variant="outlined"
                label={pack.stato}
              />
            </Box>
          </Box>
          <Stack
            direction="row"
            className="package-actions"
            sx={{ gap: 0.5, alignItems: "center", pr: 1 }}
          >
            <Tooltip title="Stampa etichetta pacco">
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onPrint();
                }}
              >
                <PrintOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {onEditLocation && (
              <Tooltip title="Modifica ubicazione">
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditLocation();
                  }}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Elimina">
              <IconButton
                size="small"
                color="error"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
              >
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Box
            sx={{
              display: { xs: "grid", lg: "none" },
              gridColumn: "1 / -1",
              gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)" },
              gap: 1,
            }}
          >
            {fields.map(([label, value]) => (
              <Box key={label}>
                <Typography color="text.secondary" variant="caption">
                  {label}
                </Typography>
                <Typography
                  variant="body2"
                  color={label === "Pacco / Elementi" ? "primary.main" : undefined}
                  sx={{
                    fontWeight: label === "Pacco / Elementi" ? 800 : 400,
                    ...nowrap,
                  }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
            <Box>
              <Typography color="text.secondary" variant="caption">
                Stato
              </Typography>
              <Box>
                <Chip
                  size="small"
                  color={
                    pack.stato === "SPEDITO"
                      ? "success"
                      : pack.stato === "CARICATO"
                        ? "warning"
                        : "info"
                  }
                  variant="outlined"
                  label={pack.stato}
                />
              </Box>
            </Box>
            {onEditLocation && (
              <Box sx={{ gridColumn: "1 / -1" }}>
                <Button
                  size="small"
                  startIcon={<EditOutlinedIcon />}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditLocation();
                  }}
                  sx={{ minHeight: 44 }}
                >
                  Modifica ubicazione
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </AccordionSummary>
      <AccordionDetails
        sx={{
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "rgba(0,0,0,.12)",
          px: { xs: 1, md: 4 },
          py: 2,
        }}
      >
        <PackageContents pack={pack} />
      </AccordionDetails>
    </Accordion>
  );
}

function PackageContents({ pack }: { pack: Pacco }) {
  return (
    <Box
      sx={{
        borderLeft: 3,
        borderColor: "primary.dark",
        pl: { xs: 1, md: 2 },
        py: 2,
        px: { xs: 1, md: 2 },
        bgcolor: "rgba(0,0,0,.12)",
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Elementi contenuti nel pacco {pack.codice}
      </Typography>
      <TableContainer sx={{ display: { xs: "none", sm: "block" } }}>
        <Table size="small" sx={{ minWidth: 620 }}>
          <TableHead>
            <TableRow>
              {[
                ["Elemento", 120],
                ["Master panel", 140],
                ["Dimensioni", 200],
                ["Peso", 100],
                ["Volume", 100],
              ].map(([label, width]) => (
                <TableCell key={label} sx={{ width, ...nowrap }}>
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pack.pannelli.map((panel) => (
              <TableRow key={panel.numeroPannello}>
                <TableCell sx={nowrap}>{panel.numeroPannello}</TableCell>
                <TableCell sx={nowrap}>{panel.numeroMasterPanel}</TableCell>
                <TableCell sx={nowrap}>{dimensions(panel)}</TableCell>
                <TableCell sx={nowrap}>{panel.peso.toFixed(1)} kg</TableCell>
                <TableCell sx={nowrap}>{panel.volume.toFixed(3)} m³</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack sx={{ display: { xs: "flex", sm: "none" }, gap: 1 }}>
        {pack.pannelli.map((panel) => (
          <Paper key={panel.numeroPannello} variant="outlined" sx={{ p: 1.25 }}>
            <Typography sx={{ fontWeight: 900 }}>
              Elemento {panel.numeroPannello}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Master Panel {panel.numeroMasterPanel}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 0.75 }}>
              {[
                ["Commessa", pack.commessa],
                ["Camion", pack.camion],
                ["Dimensioni", `${dimensions(panel)} mm`],
                ["Peso", `${panel.peso.toFixed(1)} kg`],
                ["Volume", `${panel.volume.toFixed(3)} m³`],
              ].map(([label, value]) => (
                <Box key={label} sx={{ minWidth: 0, gridColumn: label === "Dimensioni" ? "1 / -1" : undefined }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="body2">{value}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
