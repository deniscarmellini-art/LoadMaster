import { useMemo, useRef, useState } from "react";
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, MenuItem, TextField, Typography } from "@mui/material";

import DashboardContent from "../components/dashboard/DashboardContent";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardKpi from "../components/dashboard/DashboardKpi";
import { creaDashboard } from "../services/dashboardService";
import { importaExcel } from "../services/excelImport";

import type { Commessa } from "../types/excel";
import type { Camion } from "../models/Camion";
import type { CaricoCamion } from "../models/Loading";
import type { Pacco } from "../models/Scanning";
import type { Operatore } from "../models/Settings";
import { operatorLabel } from "../models/Settings";
import PackagePrintPreview from "../components/scanning/PackagePrintPreview";

interface DashboardProps {
  commesse: Commessa[];
  onImported: (commessa: Commessa) => void;
  onDeleteCommessa: (ordine: string) => void;
  onOpenLabels: () => void;
  onOpenScanning: (row: Camion) => void;
  onOpenScanningList: () => void;
  onOpenWarehouse: () => void;
  onOpenSettings: () => void;
  onOpenLoading: () => void;
  truckLoads: CaricoCamion[];
  packages: Pacco[];
  activeScanningSessions: Set<string>;
  operators: Operatore[];
  onReopenLoad: (row:Camion,operator:Operatore,reason:string) => void;
  onContinueLoad: (row:Camion) => void;
  onStartLoad: (row:Camion) => void;
  onConfirmDeparture: (row:Camion) => void;
}

function Dashboard({ commesse, onImported, onDeleteCommessa, onOpenLabels, onOpenScanning, onOpenScanningList, onOpenWarehouse, onOpenSettings, onOpenLoading, truckLoads, packages, activeScanningSessions, operators, onReopenLoad, onContinueLoad, onStartLoad, onConfirmDeparture }: DashboardProps) {
  const [deleteOrder, setDeleteOrder] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [reopenRow,setReopenRow]=useState<Camion|null>(null);const [reopenOperatorId,setReopenOperatorId]=useState("");const [reopenReason,setReopenReason]=useState("");
  const [packagePrintRow,setPackagePrintRow]=useState<Camion|null>(null);
  const [selectedPackageCodes,setSelectedPackageCodes]=useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dashboard = useMemo(() => creaDashboard(commesse).map(row=>truckLoads.find(load=>load.commessa===row.commessa&&load.camion===row.camion&&load.stato==="IN_CARICO")?{...row,stato:"In carico" as const}:row), [commesse,truckLoads]);

  const activeRows = useMemo(
    () => dashboard.filter((row) => row.stato !== "Partita"),
    [dashboard],
  );
  const printablePackages = useMemo(() => packagePrintRow ? packages.filter((pack) => pack.commessa === packagePrintRow.commessa && pack.camion === packagePrintRow.camion) : [], [packagePrintRow, packages]);
  const selectedPackages = printablePackages.filter((pack) => selectedPackageCodes.has(pack.codice));
  const openPackagePrint = (row:Camion) => {
    const codes = packages.filter((pack) => pack.commessa === row.commessa && pack.camion === row.camion).map((pack) => pack.codice);
    setSelectedPackageCodes(new Set(codes));
    setPackagePrintRow(row);
  };
  const deletePanels = commesse.filter((item) => item.ordine === deleteOrder).flatMap((item) => item.pannelli);
  const hasProductionData = deletePanels.some((panel) => panel.preparato || panel.caricato);
  const confirmDelete = () => {
    if (!deleteOrder || hasProductionData) return;
    onDeleteCommessa(deleteOrder);
    setDeleteOrder(null);
  };
  const openFilePicker = () => {
    if (!isImporting) fileInputRef.current?.click();
  };
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      onImported(await importaExcel(file));
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
      <DashboardHeader isImporting={isImporting} onImportClick={openFilePicker} onOpenLabels={onOpenLabels} onOpenLoading={onOpenLoading} onOpenScanning={onOpenScanningList} onOpenSettings={onOpenSettings} onOpenWarehouse={onOpenWarehouse} />
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFileChange} />
      <DashboardKpi rows={activeRows} />
      <DashboardContent
        onDelete={(row) => setDeleteOrder(row.commessa)}
        onContinueLoad={onContinueLoad}
        onOpenScanning={onOpenScanning}
        isScanningActive={(row) => activeScanningSessions.has(`${row.commessa}\u0000${row.camion}`)}
        onStartLoad={onStartLoad}
        onPrintPackages={openPackagePrint}
        hasPackages={(row) => packages.some((pack) => pack.commessa === row.commessa && pack.camion === row.camion)}
        onReopen={(row)=>{setReopenRow(row);setReopenOperatorId("");setReopenReason("");}}
        onConfirmDeparture={onConfirmDeparture}
        onUpdate={openFilePicker}
        rows={activeRows}
      />
      <Dialog open={deleteOrder !== null} onClose={() => setDeleteOrder(null)}>
        <DialogTitle>{hasProductionData ? "Impossibile eliminare la commessa" : "Elimina commessa"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {hasProductionData
              ? `La commessa ${deleteOrder} contiene dati di produzione e deve essere prima archiviata oppure svuotata.`
              : `Vuoi eliminare definitivamente la commessa ${deleteOrder} e tutti i pannelli associati?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOrder(null)}>{hasProductionData ? "Chiudi" : "Annulla"}</Button>
          {!hasProductionData && <Button color="error" variant="contained" onClick={confirmDelete}>Elimina</Button>}
        </DialogActions>
      </Dialog>
      <Dialog open={reopenRow!==null} onClose={()=>setReopenRow(null)} fullWidth maxWidth="sm"><DialogTitle>Riapri carico</DialogTitle><DialogContent><DialogContentText sx={{mb:2}}>Riaprire il carico della commessa {reopenRow?.commessa} - Camion {reopenRow?.camion}?<br/><br/>Il carico tornerà modificabile e sarà possibile aggiungere o rimuovere unità prima della spedizione definitiva.</DialogContentText><TextField select required fullWidth label="Operatore" value={reopenOperatorId} onChange={event=>setReopenOperatorId(event.target.value)} sx={{mb:2}}><MenuItem value="" disabled>Seleziona operatore</MenuItem>{operators.map(operator=><MenuItem key={operator.id} value={operator.id}>{operatorLabel(operator)}</MenuItem>)}</TextField><TextField fullWidth multiline minRows={2} label="Motivo della riapertura (facoltativo)" value={reopenReason} onChange={event=>setReopenReason(event.target.value)}/></DialogContent><DialogActions><Button onClick={()=>setReopenRow(null)}>Annulla</Button><Button variant="contained" disabled={!reopenOperatorId} onClick={()=>{const operator=operators.find(item=>item.id===reopenOperatorId);if(reopenRow&&operator)onReopenLoad(reopenRow,operator,reopenReason);setReopenRow(null);}}>Riapri carico</Button></DialogActions></Dialog>
      <Dialog fullScreen open={packagePrintRow!==null} onClose={()=>setPackagePrintRow(null)}>
        <DialogTitle>Stampa etichette pacchi — {packagePrintRow?.commessa} / {packagePrintRow?.camion}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{mb:1}}>Seleziona uno o più pacchi da ristampare.</Typography>
          <Box className="no-print" sx={{display:"flex",flexWrap:"wrap",gap:1}}>
            {printablePackages.map((pack)=><FormControlLabel key={pack.codice} control={<Checkbox checked={selectedPackageCodes.has(pack.codice)} onChange={(event)=>setSelectedPackageCodes(current=>{const next=new Set(current);if(event.target.checked)next.add(pack.codice);else next.delete(pack.codice);return next;})}/>} label={`${pack.codice} (${pack.numeroPezzi} pannelli)`}/>) }
          </Box>
          {selectedPackages.length===0 ? <Typography sx={{mt:3}}>Nessun pacco selezionato</Typography> : <Box className="package-print-collection">{selectedPackages.map((pack)=><PackagePrintPreview key={pack.codice} pack={pack}/>)}</Box>}
        </DialogContent>
        <DialogActions className="no-print"><Button onClick={()=>setPackagePrintRow(null)}>Chiudi</Button></DialogActions>
      </Dialog>
    </>
  );
}

export default Dashboard;
