import { useMemo, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";

import DashboardContent from "../components/dashboard/DashboardContent";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardKpi from "../components/dashboard/DashboardKpi";
import { creaDashboard } from "../services/dashboardService";

import type { Commessa } from "../types/excel";

interface DashboardProps {
  commesse: Commessa[];
  onImported: (commessa: Commessa) => void;
  onDeleteCommessa: (ordine: string) => void;
  onOpenLabels: () => void;
}

function Dashboard({ commesse, onImported, onDeleteCommessa, onOpenLabels }: DashboardProps) {
  const [deleteOrder, setDeleteOrder] = useState<string | null>(null);

  const dashboard = useMemo(() => creaDashboard(commesse), [commesse]);

  const activeRows = useMemo(
    () => dashboard.filter((row) => row.stato !== "Partita"),
    [dashboard],
  );
  const deletePanels = commesse.filter((item) => item.ordine === deleteOrder).flatMap((item) => item.pannelli);
  const hasProductionData = deletePanels.some((panel) => panel.preparato || panel.caricato);
  const confirmDelete = () => {
    if (!deleteOrder || hasProductionData) return;
    onDeleteCommessa(deleteOrder);
    setDeleteOrder(null);
  };

  return (
    <>
      <DashboardHeader onImported={onImported} onOpenLabels={onOpenLabels} />
      <DashboardKpi rows={activeRows} />
      <DashboardContent
        onDelete={(row) => setDeleteOrder(row.commessa)}
        onPrintLabels={onOpenLabels}
        onUpdate={() => document.getElementById("dashboard-excel-import")?.click()}
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
    </>
  );
}

export default Dashboard;
