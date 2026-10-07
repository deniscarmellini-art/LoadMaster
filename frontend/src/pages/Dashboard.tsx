import { useMemo, useState } from "react";
import { demoBranding } from "../services/demoBranding";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import DashboardContent from "../components/dashboard/DashboardContent";
import UpcomingShipments from "../components/dashboard/UpcomingShipments";
import { creaDashboardOperativa } from "../services/dashboardService";

import type { Commessa } from "../types/excel";
import type { Camion } from "../models/Camion";
import type { CaricoCamion } from "../models/Loading";
import type { Pacco } from "../models/Scanning";
import type { Operatore, Rimorchio, Trasportatore } from "../models/Settings";
import type { ShipmentItem } from "../services/shipmentsApi";
import type { TransportItem } from "../services/transportsApi";
import { operatorLabel } from "../models/Settings";
import PackagePrintPreview from "../components/scanning/PackagePrintPreview";
import { ApiClientError } from "../services/apiClient";
import { confirmDeparture, departureTransport, departureTrailerId } from "../services/departureConfirmation";
import { shipmentTransportLabel } from "../services/shipmentTransportPresentation";

interface DashboardProps {
  commesse: Commessa[];
  onImportClick:()=>void;
  onDeleteLoad: (row: Camion, confirmPlanning?: boolean) => Promise<void>;
  onOpenScanning: (row: Camion) => void;
  onOpenShipments: () => void;
  onOpenHistory: (row?: Camion) => void;
  truckLoads: CaricoCamion[];
  packages: Pacco[];
  operators: Operatore[];
  trailers: Rimorchio[];
  carriers: Trasportatore[];
  transports: TransportItem[];
  shipments: ShipmentItem[];
  onReopenLoad: (row: Camion, operator: Operatore, reason: string) => void;
  onContinueLoad: (loadId: string) => void;
  onStartLoad: (row: Camion) => void;
  onConfirmDeparture: (
    row: Camion,
    carrierId: string | undefined,
    operatorId: string,
  ) => Promise<void>;
}

function Dashboard({
  commesse,
  onImportClick,
  onDeleteLoad,
  onOpenScanning,
  onOpenShipments,
  onOpenHistory,
  truckLoads,
  packages,
  operators,
  trailers,
  carriers,
  transports,
  shipments,
  onReopenLoad,
  onContinueLoad,
  onStartLoad,
  onConfirmDeparture,
}: DashboardProps) {
  const theme = useTheme();
  const narrowPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const landscapePhone = useMediaQuery(
    "(max-width:950px) and (max-height:500px)",
  );
  const mobile = narrowPhone || landscapePhone;
  const [deleteRow, setDeleteRow] = useState<Camion | null>(null);
  const [deletePlanningWarning, setDeletePlanningWarning] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reopenRow, setReopenRow] = useState<Camion | null>(null);
  const [reopenOperatorId, setReopenOperatorId] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [departureRow, setDepartureRow] = useState<Camion | null>(null);
  const [departureCarrierId, setDepartureCarrierId] = useState("");
  const [departureAt, setDepartureAt] = useState("");
  const [departureOperatorId, setDepartureOperatorId] = useState("");
  const [departureError, setDepartureError] = useState<string | null>(null);
  const [isDeparting, setIsDeparting] = useState(false);
  const [packagePrintRow, setPackagePrintRow] = useState<Camion | null>(null);
  const [selectedPackageCodes, setSelectedPackageCodes] = useState<Set<string>>(
    new Set(),
  );

  const dashboard = useMemo(
    () => creaDashboardOperativa(commesse, truckLoads),
    [commesse, truckLoads],
  );

  const activeRows = useMemo(
    () =>
      dashboard.filter(
        (row) =>
          !truckLoads.some(
            (load) =>
              load.commessa === row.commessa &&
              load.camion === row.camion &&
              load.stato === "SPEDITO",
          ) && row.stato !== "Partita",
      ),
    [dashboard, truckLoads],
  );
  const printablePackages = useMemo(
    () =>
      packagePrintRow
        ? packages.filter(
            (pack) =>
              pack.commessa === packagePrintRow.commessa &&
              pack.camion === packagePrintRow.camion,
          )
        : [],
    [packagePrintRow, packages],
  );
  const selectedPackages = printablePackages.filter((pack) =>
    selectedPackageCodes.has(pack.codice),
  );
  const departureLoad = departureRow
    ? truckLoads.find(
        (load) =>
          load.commessa === departureRow.commessa &&
          load.camion === departureRow.camion &&
          load.stato === "ATTESA_SPEDIZIONE",
      )
    : undefined;
  const departureTrailer = trailers.find(
    (trailer) => trailer.id === departureTrailerId(departureLoad, transports),
  );
  const departurePlan = shipments.find(plan => plan.loadId === departureLoad?.backendLoadId);
  const transport = departureTransport(departureLoad, departurePlan);
  const activeCarriers = carriers.filter(carrier => carrier.attivo || carrier.id === departureLoad?.trasportatoreId);
  const activeOperators = operators.filter(operator => operator.attivo);
  const openPackagePrint = (row: Camion) => {
    const codes = packages
      .filter(
        (pack) => pack.commessa === row.commessa && pack.camion === row.camion,
      )
      .map((pack) => pack.codice);
    setSelectedPackageCodes(new Set(codes));
    setPackagePrintRow(row);
  };
  const closeDeleteDialog=()=>{setDeleteRow(null);setDeletePlanningWarning(false);setDeleteError(null);};
  const confirmDelete = async (confirmPlanning=false) => {
    if (!deleteRow || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteLoad(deleteRow,confirmPlanning);
      closeDeleteDialog();
    } catch(error:unknown) {
      if(error instanceof ApiClientError&&error.code==="PREVENTIVE_PLAN_CONFIRMATION_REQUIRED"){
        setDeletePlanningWarning(true);setDeleteError(null);return;
      }
      setDeleteError(error instanceof Error?error.message:"Errore durante l'eliminazione del carico.");
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <Box sx={{ order: mobile ? 3 : 1 }}>
          <UpcomingShipments
            carriers={carriers}
            shipments={shipments}
            transports={transports}
            onOpenShipments={onOpenShipments}
          />
        </Box>
        <Box sx={{ order: mobile ? 2 : 2 }}>
          <DashboardContent
            referenceFor={row=>commesse.find(order=>order.ordine===row.commessa&&order.cliente===row.cliente)?.riferimento || "—"}
            onDelete={(row) => {setDeleteRow(row);setDeletePlanningWarning(false);setDeleteError(null);}}
            onContinueLoad={(row) => {
              const load = truckLoads.find(
                (item) =>
                  item.commessa === row.commessa &&
                  item.camion === row.camion &&
                  item.stato === "IN_CARICO",
              );
              if (load) onContinueLoad(load.loadId);
            }}
            onOpenScanning={onOpenScanning}
            onStartLoad={onStartLoad}
            onPrintPackages={openPackagePrint}
            hasPackages={(row) =>
              packages.some(
                (pack) =>
                  pack.commessa === row.commessa && pack.camion === row.camion,
              )
            }
            onReopen={(row) => {
              setReopenRow(row);
              setReopenOperatorId("");
              setReopenReason("");
            }}
            onConfirmDeparture={(row) => {
              setDepartureRow(row);
              const plan = shipments.find(item=>item.loadId===row.id);
              const load = truckLoads.find(item => item.commessa === row.commessa && item.camion === row.camion);
              const selected = departureTransport(load, plan).carrierId;
              setDepartureCarrierId(carriers.some(c=>c.id===selected&&(c.attivo||c.id===load?.trasportatoreId)) ? selected : "");
              setDepartureOperatorId(activeOperators.some(op => op.id === load?.operatoreId) ? load!.operatoreId : "");
              setDepartureError(null);
              setDepartureAt(new Date().toISOString());
            }}
            onOpenHistory={onOpenHistory}
            onUpdate={onImportClick}
            rows={activeRows}
            shipments={shipments}
            carriers={carriers}
            transports={transports}
          />
        </Box>
      </Box>
      <Dialog open={deleteRow !== null} onClose={closeDeleteDialog}>
        <DialogTitle>
          {deletePlanningWarning
            ? "Elimina carico e pianificazione"
            : "Elimina carico"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deletePlanningWarning
              ? `Il carico ${deleteRow?.camion} della commessa ${deleteRow?.commessa} ha una pianificazione spedizione collegata. Eliminando il carico verrà eliminata anche la pianificazione. Vuoi continuare?`
              : `Vuoi eliminare definitivamente il carico ${deleteRow?.camion} della commessa ${deleteRow?.commessa} e tutti gli elementi associati?`}
          </DialogContentText>
          {deleteError&&<Alert severity="error" sx={{mt:2}}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} disabled={isDeleting}>
            Annulla
          </Button>
          <Button color="error" variant="contained" disabled={isDeleting} onClick={()=>void confirmDelete(deletePlanningWarning)}>
            {isDeleting?"Eliminazione...":deletePlanningWarning?"Elimina carico e pianificazione":"Elimina"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={reopenRow !== null}
        onClose={() => setReopenRow(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Riapri carico</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Riaprire il carico della commessa {reopenRow?.commessa} - Camion{" "}
            {reopenRow?.camion}?<br />
            <br />
            Il carico tornerà modificabile e sarà possibile aggiungere o
            rimuovere unità prima della spedizione definitiva.
          </DialogContentText>
          <TextField
            select
            required
            fullWidth
            label="Operatore"
            value={reopenOperatorId}
            onChange={(event) => setReopenOperatorId(event.target.value)}
            sx={{ mb: 2 }}
          >
            <MenuItem value="" disabled>
              Seleziona operatore
            </MenuItem>
            {operators.map((operator) => (
              <MenuItem key={operator.id} value={operator.id}>
                {operatorLabel(operator)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Motivo della riapertura (facoltativo)"
            value={reopenReason}
            onChange={(event) => setReopenReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReopenRow(null)}>Annulla</Button>
          <Button
            variant="contained"
            disabled={!reopenOperatorId}
            onClick={() => {
              const operator = operators.find(
                (item) => item.id === reopenOperatorId,
              );
              if (reopenRow && operator)
                onReopenLoad(reopenRow, operator, reopenReason);
              setReopenRow(null);
            }}
          >
            Riapri carico
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={departureRow !== null}
        onClose={() => { if (!isDeparting) setDepartureRow(null); }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Conferma partenza</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 2,
              pt: 1,
            }}
          >
            <TextField
              label="Commessa"
              value={departureRow?.commessa ?? ""}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="Cliente"
              value={departureRow?.cliente ?? ""}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="Camion"
              value={departureRow?.camion ?? ""}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="Modalità di trasporto"
              value={transport.mode ? shipmentTransportLabel(transport.mode) : "—"}
              slotProps={{ input: { readOnly: true } }}
              sx={{ gridColumn: "1 / -1" }}
            />
            {transport.mode === "BILICO_ESSEPI" && <TextField
              label={demoBranding.rimorchio}
              value={
                departureTrailer
                  ? `${departureTrailer.targa} — ${departureTrailer.descrizione}`
                  : "—"
              }
              slotProps={{ input: { readOnly: true } }}
            />}
            {transport.requiresCarrier ? <TextField
              select
              required
              label="Trasportatore"
              value={departureCarrierId}
              onChange={(event) => setDepartureCarrierId(event.target.value)}
              disabled={isDeparting}
              sx={{ gridColumn: "1 / -1" }}
            >
              <MenuItem value="" disabled>
                Seleziona trasportatore
              </MenuItem>
              {activeCarriers.map((carrier) => (
                <MenuItem key={carrier.id} value={carrier.id}>
                  {carrier.nome}
                </MenuItem>
              ))}
            </TextField> : <TextField
              label={transport.mode === "TERZI_PER_ESSEPI" ? "Modalità Terzi per Essepi" : "Tipo di mezzo (facoltativo)"}
              value={transport.detailLabel || "—"}
              slotProps={{ input: { readOnly: true } }}
              sx={{ gridColumn: "1 / -1" }}
            />}
            <TextField select required label="Operatore partenza" value={departureOperatorId}
              disabled={isDeparting} onChange={event => setDepartureOperatorId(event.target.value)} sx={{ gridColumn: "1 / -1" }}>
              {activeOperators.map(operator => <MenuItem key={operator.id} value={operator.id}>{operatorLabel(operator)}</MenuItem>)}
            </TextField>
            <TextField
              label="Data e ora partenza"
              value={
                departureAt ? new Date(departureAt).toLocaleString("it-IT") : ""
              }
              slotProps={{ input: { readOnly: true } }}
              sx={{ gridColumn: "1 / -1" }}
            />
          </Box>
          {transport.requiresCarrier && !activeCarriers.length && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Nessun trasportatore attivo disponibile. Configurarlo nelle
              Impostazioni.
            </Alert>
          )}
          {departureError && <Alert severity="error" sx={{ mt: 2 }}>{departureError}</Alert>}
          {!transport.mode && <Alert severity="warning" sx={{ mt: 2 }}>Salvare la modalità effettiva in Carico camion prima di confermare la partenza.</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={isDeparting} onClick={() => setDepartureRow(null)}>Annulla</Button>
          <Button
            disabled={isDeparting || !departureOperatorId || !transport.mode || (transport.requiresCarrier && !departureCarrierId)}
            variant="contained"
            onClick={async () => {
              if (!departureRow || isDeparting) return;
              setIsDeparting(true);
              setDepartureError(null);
              await confirmDeparture(
                () => onConfirmDeparture(departureRow, transport.requiresCarrier ? departureCarrierId : undefined, departureOperatorId),
                () => setDepartureRow(null),
                setDepartureError,
              );
              setIsDeparting(false);
            }}
          >
            Conferma partenza
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        fullScreen
        open={packagePrintRow !== null}
        onClose={() => setPackagePrintRow(null)}
      >
        <DialogTitle>
          Stampa etichette pacchi — {packagePrintRow?.commessa} /{" "}
          {packagePrintRow?.camion}
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            Seleziona uno o più pacchi da ristampare.
          </Typography>
          <Box
            className="no-print"
            sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}
          >
            {printablePackages.map((pack) => (
              <FormControlLabel
                key={pack.codice}
                control={
                  <Checkbox
                    checked={selectedPackageCodes.has(pack.codice)}
                    onChange={(event) =>
                      setSelectedPackageCodes((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(pack.codice);
                        else next.delete(pack.codice);
                        return next;
                      })
                    }
                  />
                }
                label={`${pack.codice} (${pack.numeroPezzi} elementi)`}
              />
            ))}
          </Box>
          {selectedPackages.length === 0 ? (
            <Typography sx={{ mt: 3 }}>Nessun pacco selezionato</Typography>
          ) : (
            <Box className="package-print-collection">
              {selectedPackages.map((pack) => (
                <PackagePrintPreview key={pack.codice} pack={pack} />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions className="no-print">
          <Button onClick={() => setPackagePrintRow(null)}>Chiudi</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default Dashboard;
