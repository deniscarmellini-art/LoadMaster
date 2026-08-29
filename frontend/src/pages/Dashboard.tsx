import { useMemo, useRef, useState } from "react";
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
} from "@mui/material";

import DashboardContent from "../components/dashboard/DashboardContent";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import UpcomingShipments from "../components/dashboard/UpcomingShipments";
import { creaDashboardOperativa } from "../services/dashboardService";
import { importaExcel } from "../services/excelImport";

import type { Commessa } from "../types/excel";
import type { Camion } from "../models/Camion";
import type { CaricoCamion } from "../models/Loading";
import type { Pacco } from "../models/Scanning";
import type { Operatore, Rimorchio, Trasportatore } from "../models/Settings";
import type { ShipmentItem } from "../services/shipmentsApi";
import { operatorLabel } from "../models/Settings";
import PackagePrintPreview from "../components/scanning/PackagePrintPreview";
import { ApiClientError } from "../services/apiClient";

interface DashboardProps {
  commesse: Commessa[];
  onImported: (commessa: Commessa) => Promise<void>;
  onDeleteCommessa: (ordine: string, confirmPlanning?: boolean) => Promise<void>;
  onOpenLabels: () => void;
  onOpenScanning: (row: Camion) => void;
  onOpenScanningList: () => void;
  onOpenWarehouse: () => void;
  onOpenSettings: () => void;
  onOpenLoading: () => void;
  onOpenTransports: () => void;
  onOpenShipments: () => void;
  onOpenHistory: (row?: Camion) => void;
  truckLoads: CaricoCamion[];
  packages: Pacco[];
  operators: Operatore[];
  trailers: Rimorchio[];
  carriers: Trasportatore[];
  shipments: ShipmentItem[];
  onReopenLoad: (row: Camion, operator: Operatore, reason: string) => void;
  onContinueLoad: (loadId: string) => void;
  onStartLoad: (row: Camion) => void;
  onConfirmDeparture: (
    row: Camion,
    carrierId: string,
    departedAt: string,
  ) => void;
}

function Dashboard({
  commesse,
  onImported,
  onDeleteCommessa,
  onOpenLabels,
  onOpenScanning,
  onOpenScanningList,
  onOpenWarehouse,
  onOpenSettings,
  onOpenLoading,
  onOpenTransports,
  onOpenShipments,
  onOpenHistory,
  truckLoads,
  packages,
  operators,
  trailers,
  carriers,
  shipments,
  onReopenLoad,
  onContinueLoad,
  onStartLoad,
  onConfirmDeparture,
}: DashboardProps) {
  const [deleteOrder, setDeleteOrder] = useState<string | null>(null);
  const [deletePlanningWarning, setDeletePlanningWarning] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [reopenRow, setReopenRow] = useState<Camion | null>(null);
  const [reopenOperatorId, setReopenOperatorId] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [departureRow, setDepartureRow] = useState<Camion | null>(null);
  const [departureCarrierId, setDepartureCarrierId] = useState("");
  const [departureAt, setDepartureAt] = useState("");
  const [packagePrintRow, setPackagePrintRow] = useState<Camion | null>(null);
  const [selectedPackageCodes, setSelectedPackageCodes] = useState<Set<string>>(
    new Set(),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const activeCarriers = carriers.filter((carrier) => carrier.attivo);
  const departureLoad = departureRow
    ? truckLoads.find(
        (load) =>
          load.commessa === departureRow.commessa &&
          load.camion === departureRow.camion &&
          load.stato === "ATTESA_SPEDIZIONE",
      )
    : undefined;
  const departureTrailer = trailers.find(
    (trailer) => trailer.id === departureLoad?.rimorchioId,
  );
  const openPackagePrint = (row: Camion) => {
    const codes = packages
      .filter(
        (pack) => pack.commessa === row.commessa && pack.camion === row.camion,
      )
      .map((pack) => pack.codice);
    setSelectedPackageCodes(new Set(codes));
    setPackagePrintRow(row);
  };
  const closeDeleteDialog=()=>{setDeleteOrder(null);setDeletePlanningWarning(false);setDeleteError(null);};
  const confirmDelete = async (confirmPlanning=false) => {
    if (!deleteOrder) return;
    try {
      await onDeleteCommessa(deleteOrder,confirmPlanning);
      closeDeleteDialog();
    } catch(error:unknown) {
      if(error instanceof ApiClientError&&error.code==="PREVENTIVE_PLAN_CONFIRMATION_REQUIRED"){
        setDeletePlanningWarning(true);setDeleteError(null);return;
      }
      setDeleteError(error instanceof Error?error.message:"Errore durante l'eliminazione della commessa.");
    }
  };
  const openFilePicker = () => {
    if (!isImporting) fileInputRef.current?.click();
  };
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      await onImported(await importaExcel(file));
    } catch (error) {
      console.error("Errore durante l'importazione del file Excel", error);
      alert("Errore durante l'importazione del file.");
    } finally {
      event.target.value = "";
      setIsImporting(false);
    }
  };

  return (
    <>
      <DashboardHeader
        isImporting={isImporting}
        onImportClick={openFilePicker}
        onOpenHistory={() => onOpenHistory()}
        onOpenLabels={onOpenLabels}
        onOpenLoading={onOpenLoading}
        onOpenTransports={onOpenTransports}
        onOpenShipments={onOpenShipments}
        onOpenScanning={onOpenScanningList}
        onOpenSettings={onOpenSettings}
        onOpenWarehouse={onOpenWarehouse}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        hidden
        onChange={handleFileChange}
      />
      <UpcomingShipments
        carriers={carriers}
        shipments={shipments}
        trailers={trailers}
        onOpenShipments={onOpenShipments}
      />
      <DashboardContent
        onDelete={(row) => {setDeleteOrder(row.commessa);setDeletePlanningWarning(false);setDeleteError(null);}}
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
          setDepartureCarrierId("");
          setDepartureAt(new Date().toISOString());
        }}
        onOpenHistory={onOpenHistory}
        onUpdate={openFilePicker}
        rows={activeRows}
      />
      <DashboardHeader
        section="menu"
        isImporting={isImporting}
        onImportClick={openFilePicker}
        onOpenHistory={() => onOpenHistory()}
        onOpenLabels={onOpenLabels}
        onOpenLoading={onOpenLoading}
        onOpenTransports={onOpenTransports}
        onOpenShipments={onOpenShipments}
        onOpenScanning={onOpenScanningList}
        onOpenSettings={onOpenSettings}
        onOpenWarehouse={onOpenWarehouse}
      />
      <Dialog open={deleteOrder !== null} onClose={closeDeleteDialog}>
        <DialogTitle>
          {deletePlanningWarning
            ? "Elimina commessa e pianificazione"
            : "Elimina commessa"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deletePlanningWarning
              ? "La commessa ha una pianificazione spedizione collegata. Eliminando la commessa verrà eliminata anche la pianificazione. Vuoi continuare?"
              : `Vuoi eliminare definitivamente la commessa ${deleteOrder} e tutti i pannelli associati?`}
          </DialogContentText>
          {deleteError&&<Alert severity="error" sx={{mt:2}}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog}>
            Annulla
          </Button>
          <Button color="error" variant="contained" onClick={()=>void confirmDelete(deletePlanningWarning)}>
            {deletePlanningWarning?"Elimina commessa e pianificazione":"Elimina"}
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
        onClose={() => setDepartureRow(null)}
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
              label="Rimorchio Essepi"
              value={
                departureTrailer
                  ? `${departureTrailer.targa} — ${departureTrailer.descrizione}`
                  : "—"
              }
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              select
              required
              label="Trasportatore"
              value={departureCarrierId}
              onChange={(event) => setDepartureCarrierId(event.target.value)}
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
          {!activeCarriers.length && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Nessun trasportatore attivo disponibile. Configurarlo nelle
              Impostazioni.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepartureRow(null)}>Annulla</Button>
          <Button
            disabled={!departureCarrierId || !activeCarriers.length}
            variant="contained"
            onClick={() => {
              if (departureRow && departureCarrierId)
                onConfirmDeparture(
                  departureRow,
                  departureCarrierId,
                  departureAt,
                );
              setDepartureRow(null);
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
                label={`${pack.codice} (${pack.numeroPezzi} pannelli)`}
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
