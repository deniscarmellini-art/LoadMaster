import { useCallback, useEffect, useState } from "react";
import { Button, CssBaseline, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, ThemeProvider } from "@mui/material";

import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import ActiveLoads from "./pages/ActiveLoads";
import PanelScanning from "./pages/PanelScanning";
import PrintLabels from "./pages/PrintLabels";
import Warehouse from "./pages/Warehouse";
import Settings from "./pages/Settings";
import TruckLoading from "./pages/TruckLoading";
import theme from "./theme/theme";
import { creaDashboard } from "./services/dashboardService";
import type { Camion } from "./models/Camion";
import type { Pacco, UnitaSingola } from "./models/Scanning";
import { loadSettings, saveSettings } from "./services/settingsStore";
import type { CaricoCamion } from "./models/Loading";
import type { Operatore } from "./models/Settings";
import { operatorLabel } from "./models/Settings";
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
  const [page, setPage] = useState<"dashboard" | "labels" | "scanning" | "scanning-list" | "warehouse" | "settings" | "loading">("dashboard");
  const [scanningTarget, setScanningTarget] = useState<Camion | null>(null);
  const [packages, setPackages] = useState<Pacco[]>([]);
  const [singles, setSingles] = useState<UnitaSingola[]>([]);
  const [packageDrafts, setPackageDrafts] = useState<Map<string,Pannello[]>>(new Map());
  const [activeScanningSessions, setActiveScanningSessions] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState(loadSettings);
  const [truckLoads, setTruckLoads] = useState<CaricoCamion[]>([]);
  const [resumeLoad,setResumeLoad]=useState<CaricoCamion|null>(null);
  const [pendingImport, setPendingImport] = useState<Commessa | null>(null);
  const [confirmRemoved, setConfirmRemoved] = useState(false);
  useEffect(()=>saveSettings(settings),[settings]);

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
  const removedLoadedPanels = removedPanels.filter((panel) => panel.caricato);

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

  const markPanelsAvailable = (order:string, truck:string, panelNumbers:string[]) => {
    const numbers = new Set(panelNumbers);
    setCommesse((current) => current.map((item) => item.ordine !== order ? item : {
      ...item,
      pannelli: item.pannelli.map((panel) => panel.numeroCamion === truck && numbers.has(panel.numeroPannello) ? { ...panel, preparato:true } : panel),
    }));
  };

  const scanKey = (order:string,truck:string) => `${order}\u0000${truck}`;
  const openScanning = (target:Camion) => { setScanningTarget(target); setActiveScanningSessions(current=>new Set(current).add(scanKey(target.commessa,target.camion))); setPage("scanning"); };
  const scanningCommessa = scanningTarget ? commesse.find((item) => item.ordine === scanningTarget.commessa) : undefined;
  const setDraftForTarget:React.Dispatch<React.SetStateAction<Pannello[]>> = (action) => {
    if(!scanningTarget)return;const key=scanKey(scanningTarget.commessa,scanningTarget.camion);setPackageDrafts(current=>{const next=new Map(current);const old=next.get(key)??[];next.set(key,typeof action==="function"?action(old):action);return next;});
  };
  const markPanelsMissing=(order:string,truck:string,numbers:string[])=>{const set=new Set(numbers);setCommesse(current=>current.map(item=>item.ordine!==order?item:{...item,pannelli:item.pannelli.map(panel=>panel.numeroCamion===truck&&set.has(panel.numeroPannello)?{...panel,preparato:false}:panel)}));};

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
            onOpenScanning={openScanning}
            onOpenScanningList={() => setPage("scanning-list")}
            onOpenWarehouse={() => setPage("warehouse")}
            onOpenSettings={() => setPage("settings")}
            onOpenLoading={() => {setResumeLoad(null);setPage("loading");}}
            operators={settings.operatori.filter(item=>item.attivo)}
            truckLoads={truckLoads}
            packages={packages}
            activeScanningSessions={activeScanningSessions}
            onReopenLoad={(row,operator:Operatore,reason)=>{const existing=truckLoads.find(load=>load.commessa===row.commessa&&load.camion===row.camion&&load.stato==="ATTESA_SPEDIZIONE");if(existing){const value={...existing,stato:"IN_CARICO" as const,operatoreId:operator.id,operatore:operatorLabel(operator),eventi:[...existing.eventi,{tipo:"RIAPERTURA" as const,dataOra:new Date().toISOString(),operatoreId:operator.id,operatore:operatorLabel(operator),nota:reason||undefined}]};setTruckLoads(current=>current.map(load=>load===existing?value:load));setResumeLoad(value);setPage("loading");}}}
            onContinueLoad={(row)=>{const load=truckLoads.find(item=>item.commessa===row.commessa&&item.camion===row.camion&&item.stato==="IN_CARICO");if(load){setResumeLoad(load);setPage("loading");}}}
            onStartLoad={(row)=>{setResumeLoad({commessa:row.commessa,cliente:row.cliente,camion:row.camion,stato:"DA_CARICARE",operatoreId:"",operatore:"",avviatoIl:"",scansioni:[],eventi:[]});setPage("loading");}}
            onConfirmDeparture={(row)=>{const load=truckLoads.find(item=>item.commessa===row.commessa&&item.camion===row.camion&&item.stato==="ATTESA_SPEDIZIONE");if(load){setResumeLoad(load);setPage("loading");}}}
          />
        ) : page === "labels" ? (
          <PrintLabels commesse={commesse} onBack={() => setPage("dashboard")} />
        ) : page === "scanning-list" ? (
          <ActiveLoads activeSessions={activeScanningSessions} onBack={()=>setPage("dashboard")} onOpen={openScanning} packages={packages} rows={creaDashboard(commesse)} />
        ) : page === "warehouse" ? (
          <Warehouse commesse={commesse} drafts={packageDrafts} onBack={()=>setPage("dashboard")} onCancelPackage={(pack)=>{setPackages(current=>current.filter(item=>item.codice!==pack.codice));markPanelsMissing(pack.commessa,pack.camion,pack.pannelli.map(panel=>panel.numeroPannello));}} onCancelSingle={(unit)=>{setSingles(current=>current.filter(item=>item!==unit));markPanelsMissing(unit.commessa,unit.camion,[unit.numeroPannello]);}} onRemoveDraftPanel={(key,panel)=>setPackageDrafts(current=>{const next=new Map(current);next.set(key,(next.get(key)??[]).filter(item=>item.numeroPannello!==panel.numeroPannello));return next;})} packages={packages} singles={singles} />
        ) : page === "settings" ? (
          <Settings onBack={()=>setPage("dashboard")} onChange={setSettings} settings={settings} usedOperatorIds={new Set([...singles.map(item=>item.operatoreId),...packages.map(item=>item.operatoreId)].filter((id):id is string=>Boolean(id)))} />
        ) : page === "loading" ? (
          <TruckLoading initialLoad={resumeLoad} loads={truckLoads} onSessionChange={(load)=>setTruckLoads(current=>{const index=current.findIndex(item=>item.commessa===load.commessa&&item.camion===load.camion);return index<0?[...current,load]:current.map((item,i)=>i===index?load:item);})} carriers={settings.trasportatori.filter(item=>item.attivo)} commesse={commesse} onBack={()=>{setResumeLoad(null);setPage("dashboard");}} onComplete={(load,units,destination)=>{setTruckLoads(current=>{const index=current.findIndex(item=>item.commessa===load.commessa&&item.camion===load.camion&&item.stato==="IN_CARICO");return index<0?[...current,load]:current.map((item,i)=>i===index?load:item);});setResumeLoad(null);const numbers=new Set(units.flatMap(unit=>unit.pannelli.map(panel=>panel.numeroPannello)));setCommesse(current=>current.map(item=>item.ordine!==load.commessa?item:{...item,pannelli:item.pannelli.map(panel=>panel.numeroCamion===load.camion&&numbers.has(panel.numeroPannello)?{...panel,caricato:true,spedito:destination==="carrier"}:panel)}));setPackages(current=>current.map(pack=>pack.commessa===load.commessa&&pack.camion===load.camion&&units.some(unit=>unit.tipo==="PACCO"&&unit.codice===pack.codice)?{...pack,stato:destination==="carrier"?"SPEDITO":"CARICATO"}:pack));}} onScanUnit={(row,unit)=>{const numbers=new Set(unit.pannelli.map(panel=>panel.numeroPannello));setCommesse(current=>current.map(item=>item.ordine!==row.commessa?item:{...item,pannelli:item.pannelli.map(panel=>panel.numeroCamion===row.camion&&numbers.has(panel.numeroPannello)?{...panel,caricato:true}:panel)}));if(unit.tipo==="PACCO")setPackages(current=>current.map(pack=>pack.codice===unit.codice?{...pack,stato:"CARICATO"}:pack));}} onUndoUnit={(row,unit)=>{const numbers=new Set(unit.pannelli.map(panel=>panel.numeroPannello));setCommesse(current=>current.map(item=>item.ordine!==row.commessa?item:{...item,pannelli:item.pannelli.map(panel=>panel.numeroCamion===row.camion&&numbers.has(panel.numeroPannello)?{...panel,caricato:false}:panel)}));if(unit.tipo==="PACCO")setPackages(current=>current.map(pack=>pack.codice===unit.codice?{...pack,stato:"DISPONIBILE"}:pack));}} operators={settings.operatori.filter(item=>item.attivo)} packages={packages} rows={creaDashboard(commesse)} singles={singles} trailers={settings.rimorchi.filter(item=>item.attivo)} />
        ) : scanningTarget && scanningCommessa ? (
          <PanelScanning
            commessa={scanningCommessa}
            draftPanels={packageDrafts.get(scanKey(scanningTarget.commessa,scanningTarget.camion))??[]}
            onDraftChange={setDraftForTarget}
            onBack={() => { setScanningTarget(null); setPage("dashboard"); }}
            onClosePackage={(pack) => { setPackages((current) => [...current,pack]); setPackageDrafts(current=>{const next=new Map(current);next.delete(scanKey(pack.commessa,pack.camion));return next;}); markPanelsAvailable(pack.commessa,pack.camion,pack.pannelli.map((panel)=>panel.numeroPannello)); }}
            onCloseSingle={(unit) => { setSingles((current) => [...current,unit]); markPanelsAvailable(unit.commessa,unit.camion,[unit.numeroPannello]); }}
            packages={packages}
            operators={settings.operatori.filter(operator=>operator.attivo)}
            singles={singles}
            target={scanningTarget}
          />
        ) : null}
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
            La nuova distinta non contiene più {removedPanels.length} {removedPanels.length === 1 ? "pannello" : "pannelli"}. {removedLoadedPanels.length>0&&<><br/><br/><b>Attenzione: {removedLoadedPanels.length} risultano già caricati. Confermando verranno scaricati e rimossi dalla commessa.</b></>}<br/><br/>Vuoi eliminarli dalla commessa?
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
