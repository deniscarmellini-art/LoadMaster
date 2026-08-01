import { useCallback, useState } from "react";
import { Button, CssBaseline, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, ThemeProvider } from "@mui/material";

import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import PrintLabels from "./pages/PrintLabels";
import theme from "./theme/theme";
import type { Commessa, Pannello } from "./types/excel";

const panelKey = (panel: Pannello) => `${panel.numeroCamion}\u0000${panel.numeroPannello}`;

function mergeImportedCommessa(current: Commessa[], incoming: Commessa, removeMissing: boolean) {
  const targetIndex = current.findIndex((item) => item.ordine === incoming.ordine);
  if (targetIndex < 0) return [...current, incoming];

  const target = current[targetIndex];
  const incomingTrucks = new Set(incoming.pannelli.map((panel) => panel.numeroCamion));
  const incomingByKey = new Map(incoming.pannelli.map((panel) => [panelKey(panel), panel]));
  const mergedPanels = target.pannelli.flatMap((existing) => {
    const updated = incomingByKey.get(panelKey(existing));
    if (updated) {
      incomingByKey.delete(panelKey(existing));
      return [{ ...updated, preparato: existing.preparato, caricato: existing.caricato }];
    }
    if (removeMissing && incomingTrucks.has(existing.numeroCamion)) return [];
    return [existing];
  });

  mergedPanels.push(...incomingByKey.values());
  const next = [...current];
  next[targetIndex] = { ...incoming, pannelli: mergedPanels };
  return next;
}

export default function App() {
  const [commesse, setCommesse] = useState<Commessa[]>([]);
  const [page, setPage] = useState<"dashboard" | "labels">("dashboard");
  const [pendingImport, setPendingImport] = useState<Commessa | null>(null);
  const [confirmRemoved, setConfirmRemoved] = useState(false);

  const handleImported = useCallback((commessa: Commessa) => {
    const importedTrucks = new Set(commessa.pannelli.map((panel) => panel.numeroCamion));
    const duplicate = commesse.some((existing) => existing.ordine === commessa.ordine && existing.pannelli.some((panel) => importedTrucks.has(panel.numeroCamion)));
    if (duplicate) setPendingImport(commessa);
    else setCommesse((current) => mergeImportedCommessa(current, commessa, false));
  }, [commesse]);

  const removedPanels = pendingImport ? (() => {
    const incomingKeys = new Set(pendingImport.pannelli.map(panelKey));
    const incomingTrucks = new Set(pendingImport.pannelli.map((panel) => panel.numeroCamion));
    return commesse.flatMap((item) => item.ordine === pendingImport.ordine
      ? item.pannelli.filter((panel) => incomingTrucks.has(panel.numeroCamion) && !incomingKeys.has(panelKey(panel)))
      : []);
  })() : [];

  const updateExisting = () => {
    if (!pendingImport) return;
    if (removedPanels.length > 0) setConfirmRemoved(true);
    else {
      setCommesse((current) => mergeImportedCommessa(current, pendingImport, false));
      setPendingImport(null);
    }
  };

  const completeUpdate = (removeMissing: boolean) => {
    if (pendingImport) setCommesse((current) => mergeImportedCommessa(current, pendingImport, removeMissing));
    setConfirmRemoved(false);
    setPendingImport(null);
  };

  const duplicateTruck = pendingImport?.pannelli.find((panel) =>
    commesse.some((item) => item.ordine === pendingImport.ordine && item.pannelli.some((existing) => existing.numeroCamion === panel.numeroCamion)),
  )?.numeroCamion;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MainLayout>
        {page === "dashboard" ? (
          <Dashboard
            commesse={commesse}
            onImported={handleImported}
            onDeleteCommessa={(ordine) => setCommesse((current) => current.filter((item) => item.ordine !== ordine))}
            onOpenLabels={() => setPage("labels")}
          />
        ) : (
          <PrintLabels commesse={commesse} onBack={() => setPage("dashboard")} />
        )}
      </MainLayout>
      <Dialog open={pendingImport !== null && !confirmRemoved} onClose={() => setPendingImport(null)}>
        <DialogTitle>Commessa già presente</DialogTitle>
        <DialogContent>
          <DialogContentText>
            La commessa {pendingImport?.ordine} - Camion {duplicateTruck} è già presente.<br /><br />
            Come vuoi procedere?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingImport(null)}>Annulla</Button>
          <Button variant="contained" onClick={updateExisting}>Aggiorna commessa esistente</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirmRemoved} onClose={() => completeUpdate(false)}>
        <DialogTitle>Pannelli rimossi dalla distinta</DialogTitle>
        <DialogContent>
          <DialogContentText>
            La nuova distinta non contiene più {removedPanels.length} {removedPanels.length === 1 ? "pannello" : "pannelli"}. Vuoi eliminarli dalla commessa?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => completeUpdate(false)}>Mantieni pannelli</Button>
          <Button color="error" variant="contained" onClick={() => completeUpdate(true)}>Elimina pannelli rimossi</Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
