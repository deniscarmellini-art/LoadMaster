import { useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
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
  onCancelPackage: (pack: Pacco) => void;
  onRemoveDraftPanel: (key: string, panel: Pannello) => void;
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
type SortKey =
  | "commessa"
  | "cliente"
  | "camion"
  | "pannello"
  | "masterPanel"
  | "dimensioni"
  | "peso"
  | "volume"
  | "dataScansione"
  | "operatore"
  | "stato";
type SortDirection = "asc" | "desc";
const singleColumns: ReadonlyArray<{
  label: string;
  width: number;
  sortKey?: SortKey;
}> = [
  { label: "Commessa", width: 90, sortKey: "commessa" },
  { label: "Cliente", width: 120, sortKey: "cliente" },
  { label: "Camion", width: 65, sortKey: "camion" },
  { label: "Pannello", width: 75, sortKey: "pannello" },
  { label: "Master panel", width: 90, sortKey: "masterPanel" },
  { label: "Dimensioni", width: 150, sortKey: "dimensioni" },
  { label: "Peso", width: 75, sortKey: "peso" },
  { label: "Volume", width: 80, sortKey: "volume" },
  { label: "Data scansione", width: 135, sortKey: "dataScansione" },
  { label: "Operatore", width: 120, sortKey: "operatore" },
  { label: "Stato", width: 90, sortKey: "stato" },
  { label: "Azioni", width: 50 },
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
}: Props) {
  const [search, setSearch] = useState(""),
    [order, setOrder] = useState(""),
    [client, setClient] = useState(""),
    [truck, setTruck] = useState(""),
    [type, setType] = useState("all"),
    [sortKey, setSortKey] = useState<SortKey | null>(null),
    [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pending, setPending] = useState<Pending | null>(null),
    [printPack, setPrintPack] = useState<Pacco | null>(null),
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
  const visibleSingles = singles.filter(
    (unit) =>
      panelFor(unit) &&
      match(
        [unit.commessa, clientFor(unit), unit.camion, unit.numeroPannello],
        "single",
      ),
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
              case "stato":
                return panel.caricato ? "CARICATO" : "DISPONIBILE";
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
  const visiblePackages = packages.filter((pack) =>
    match([pack.codice, pack.commessa, pack.cliente, pack.camion], "package"),
  );
  const confirm = () => {
    if (!pending) return;
    if (pending.kind === "single") {
      onCancelSingle(pending.unit);
      setNotice({
        message: "Scansione del pannello annullata",
        severity: "success",
      });
    } else if (pending.kind === "package") {
      onCancelPackage(pending.pack);
      setNotice({
        message: "Pacco annullato e pannelli riportati a MANCANTE",
        severity: "success",
      });
    } else {
      onRemoveDraftPanel(pending.key, pending.panel);
      setNotice({
        message: "Pannello rimosso dal pacco aperto",
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
              md: "2fr repeat(4,minmax(130px,1fr))",
            },
            gap: 1,
          }}
        >
          <TextField
            label="Cerca pannello, pacco, commessa o cliente"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
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
        </Box>
      </Paper>
      {(type === "all" || type === "single") && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Pannelli singoli disponibili
          </Typography>
          <TableContainer sx={{ display: { xs: "none", sm: "block" } }}>
            <Table
              size="small"
              sx={{ tableLayout: "fixed", minWidth: { xs: 1140, lg: "100%" } }}
            >
              <TableHead>
                <TableRow>
                  {singleColumns.map(
                    ({ label, width, sortKey: columnSortKey }) => (
                      <TableCell
                        key={label}
                        align={label === "Azioni" ? "center" : "left"}
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
                      <TableCell sx={nowrap}>{unit.camion}</TableCell>
                      <TableCell sx={nowrap}>{panel.numeroPannello}</TableCell>
                      <TableCell sx={nowrap}>
                        {panel.numeroMasterPanel}
                      </TableCell>
                      <TableCell sx={nowrap}>{dimensions(panel)}</TableCell>
                      <TableCell sx={nowrap}>
                        {panel.peso.toFixed(1)} kg
                      </TableCell>
                      <TableCell sx={nowrap}>
                        {panel.volume.toFixed(3)} m³
                      </TableCell>
                      <TableCell sx={nowrap}>
                        {new Date(unit.chiusaIl).toLocaleString("it-IT")}
                      </TableCell>
                      <TableCell sx={nowrap}>{unit.operatore}</TableCell>
                      <TableCell>
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
                        Pannello {panel.numeroPannello}
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
                    ].map(([label, value]) => (
                      <Box key={label} sx={{ minWidth: 0, gridColumn: label === "Data scansione" ? "1 / -1" : undefined }}>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{value}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Stack direction="row" sx={{ justifyContent: "flex-end", mt: 1 }}>
                    <Tooltip title="Elimina">
                      <IconButton
                        color="error"
                        aria-label={`Elimina pannello ${panel.numeroPannello}`}
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
          <Stack sx={{ gap: 1.25 }}>
            {visiblePackages.map((pack) => (
              <PackageCard
                key={pack.codice}
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
              />
            ))}
            {Array.from(drafts.entries())
              .filter(([, items]) => items.length)
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
                        {items.length} pannelli)
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
                            ↳ Pannello {panel.numeroPannello} · MP{" "}
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
                ? "Il pannello è CARICATO o SPEDITO e non può essere eliminato."
                : "Annullare la scansione del pannello e riportarlo a MANCANTE?"
              : pending?.kind === "package"
                ? pending.blocked
                  ? "Il pacco è CARICATO o SPEDITO e non può essere annullato."
                  : `Annullare il pacco ${pending.pack.codice} e riportare tutti i pannelli a MANCANTE?`
                : "Rimuovere il pannello dal pacco aperto?"}
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
}: {
  pack: Pacco;
  onPrint: () => void;
  onDelete: () => void;
}) {
  const fields = [
    ["Commessa", pack.commessa],
    ["Cliente", pack.cliente],
    ["Camion", pack.camion],
    ["Codice pacco", pack.codice],
    ["Numero pannelli", pack.numeroPezzi],
    ["Dimensioni", formatPackageDimensions(pack)],
    ["Peso", `${pack.pesoTotale.toFixed(1)} kg`],
    ["Volume pannelli", `${pack.volumeTotale.toFixed(3)} m³`],
    [
      "Data chiusura",
      pack.chiusoIl ? new Date(pack.chiusoIl).toLocaleString("it-IT") : "—",
    ],
    ["Operatore", pack.operatore || "—"],
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
              lg: "90px 120px 65px 105px 90px minmax(140px,1fr) 75px 95px 135px 120px 90px 50px",
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
                  color={label === "Codice pacco" ? "primary.main" : undefined}
                  sx={{
                    fontWeight: label === "Codice pacco" ? 800 : 400,
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
                  color={label === "Codice pacco" ? "primary.main" : undefined}
                  sx={{
                    fontWeight: label === "Codice pacco" ? 800 : 400,
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
        <Box
          sx={{
            borderLeft: 3,
            borderColor: "primary.dark",
            pl: { xs: 1, md: 2 },
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Pannelli contenuti nel pacco {pack.codice}
          </Typography>
          <TableContainer sx={{ display: { xs: "none", sm: "block" } }}>
            <Table size="small" sx={{ minWidth: 620 }}>
              <TableHead>
                <TableRow>
                  {[
                    ["Pannello", 120],
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
                    <TableCell sx={nowrap}>
                      {panel.peso.toFixed(1)} kg
                    </TableCell>
                    <TableCell sx={nowrap}>
                      {panel.volume.toFixed(3)} m³
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack sx={{ display: { xs: "flex", sm: "none" }, gap: 1 }}>
            {pack.pannelli.map((panel) => (
              <Paper key={panel.numeroPannello} variant="outlined" sx={{ p: 1.25 }}>
                <Typography sx={{ fontWeight: 900 }}>
                  Pannello {panel.numeroPannello}
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
      </AccordionDetails>
    </Accordion>
  );
}
