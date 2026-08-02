import { useCallback, useState } from "react";
import { Button, CssBaseline, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, ThemeProvider } from "@mui/material";

import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import ActiveLoads from "./pages/ActiveLoads";
import PanelScanning from "./pages/PanelScanning";
import PrintLabels from "./pages/PrintLabels";
import Warehouse from "./pages/Warehouse";
import Settings from "./pages/Settings";
import TruckLoading from "./pages/TruckLoading";
import History from "./pages/History";
import theme from "./theme/theme";
import { creaDashboard } from "./services/dashboardService";
import type { Camion } from "./models/Camion";
import type { Pacco, UnitaSingola } from "./models/Scanning";
import { getSettingsLoadErrors, loadSettings, saveSettings } from "./services/settingsStore";
import type { CaricoCamion } from "./models/Loading";
import type { Operatore } from "./models/Settings";
import { operatorLabel } from "./models/Settings";
import type { Commessa, Pannello } from "./types/excel";
import { buildPanelKey } from "./utils/panelIdentity";
import { normalizeOrder, normalizeTruck } from "./utils/loadIdentity";

const panelKey = (panel: Pannello) => `${normalizeTruck(panel.numeroCamion)}\u0000${String(panel.numeroPannello).trim()}`;

function mergeImportedCommessa(current: Commessa[], incoming: Commessa, removeMissing: boolean) {
  const targetIndex = current.findIndex((item) => normalizeOrder(item.ordine) === normalizeOrder(incoming.ordine));
  if (targetIndex < 0) return [...current, incoming];

  const target = current[targetIndex];
  const incomingTrucks = new Set(incoming.pannelli.map((panel) => normalizeTruck(panel.numeroCamion)));
  const incomingByKey = new Map(incoming.pannelli.map((panel) => [panelKey(panel), panel]));
  const mergedPanels = target.pannelli.flatMap((existing) => {
    const updated = incomingByKey.get(panelKey(existing));
    if (updated) {
      incomingByKey.delete(panelKey(existing));
      return [{ ...updated, preparato: existing.preparato, caricato: existing.caricato }];
    }
    if (removeMissing && incomingTrucks.has(normalizeTruck(existing.numeroCamion))) return [];
    return [existing];
  });

  mergedPanels.push(...incomingByKey.values());
  const next = [...current];
  next[targetIndex] = { ...incoming, pannelli: mergedPanels };
  return next;
}

export default function App() {
  const [commesse, setCommesse] = useState<Commessa[]>([]);
  const [page, setPage] = useState<"dashboard" | "labels" | "scanning" | "scanning-list" | "warehouse" | "settings" | "loading" | "history">("dashboard");
  const [scanningTarget, setScanningTarget] = useState<Camion | null>(null);
  const [packages, setPackages] = useState<Pacco[]>([]);
  const [singles, setSingles] = useState<UnitaSingola[]>([]);
  const [packageDrafts, setPackageDrafts] = useState<Map<string,Pannello[]>>(new Map());
  const [activeScanningSessions, setActiveScanningSessions] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState(loadSettings);
  const [truckLoads, setTruckLoads] = useState<CaricoCamion[]>([]);
  const [resumeLoad,setResumeLoad]=useState<CaricoCamion|null>(null);
  const [loadingInstance,setLoadingInstance]=useState(0);
  const [historyLoadId,setHistoryLoadId]=useState<string|undefined>();
  const [pendingImport, setPendingImport] = useState<Commessa | null>(null);
  const [blockedImport,setBlockedImport]=useState<{commessa:string;camion:string}|null>(null);
  const [confirmRemoved, setConfirmRemoved] = useState(false);
  const changeSettings=(next:typeof settings)=>{try{saveSettings(next,settings);setSettings(next);}catch{alert("Impossibile salvare le anagrafiche nel browser.");}};

  const resumeLoadingSession = useCallback((loadId:string) => {
    const existing = truckLoads.find((load) => load.loadId === loadId);
    if (!existing) return;
    setResumeLoad(existing);
    setLoadingInstance((value) => value + 1);
    setPage("loading");
  }, [truckLoads]);

  const handleImported = useCallback((commessa: Commessa) => {
    const importedTrucks = new Map(commessa.pannelli.map(panel=>[normalizeTruck(panel.numeroCamion),panel.numeroCamion]));
    const shipped = truckLoads.find(load=>load.stato==="SPEDITO"&&importedTrucks.has(normalizeTruck(load.camion))&&normalizeOrder(load.commessa)===normalizeOrder(commessa.ordine));
    if(shipped){setPendingImport(null);setBlockedImport({commessa:commessa.ordine,camion:shipped.camion});return;}
    const duplicate = commesse.some(existing=>normalizeOrder(existing.ordine)===normalizeOrder(commessa.ordine)&&existing.pannelli.some(panel=>importedTrucks.has(normalizeTruck(panel.numeroCamion))))||truckLoads.some(load=>load.stato!=="SPEDITO"&&normalizeOrder(load.commessa)===normalizeOrder(commessa.ordine)&&importedTrucks.has(normalizeTruck(load.camion)));
    if (duplicate) setPendingImport(commessa);
    else setCommesse((current) => mergeImportedCommessa(current, commessa, false));
  }, [commesse,truckLoads]);

  const removedPanels = pendingImport ? (() => {
    const incomingKeys = new Set(pendingImport.pannelli.map(panelKey));
    const incomingTrucks = new Set(pendingImport.pannelli.map((panel) => normalizeTruck(panel.numeroCamion)));
    return commesse.flatMap((item) => normalizeOrder(item.ordine) === normalizeOrder(pendingImport.ordine)
      ? item.pannelli.filter((panel) => incomingTrucks.has(normalizeTruck(panel.numeroCamion)) && !incomingKeys.has(panelKey(panel)))
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
            onOpenHistory={(row) => {setHistoryLoadId(row?truckLoads.find(load=>load.commessa===row.commessa&&load.camion===row.camion&&load.stato==="SPEDITO")?.loadId:undefined);setPage("history");}}
            operators={settings.operatori.filter(item=>item.attivo)}
            carriers={settings.trasportatori}
            trailers={settings.rimorchi}
            truckLoads={truckLoads}
            packages={packages}
            onReopenLoad={(row,operator:Operatore,reason)=>{const existing=truckLoads.find(load=>load.commessa===row.commessa&&load.camion===row.camion&&load.stato==="ATTESA_SPEDIZIONE");if(existing){const value={...existing,stato:"IN_CARICO" as const,operatoreId:operator.id,operatore:operatorLabel(operator),eventi:[...existing.eventi,{tipo:"RIAPERTURA" as const,dataOra:new Date().toISOString(),operatoreId:operator.id,operatore:operatorLabel(operator),nota:reason||undefined}]};setTruckLoads(current=>current.map(load=>load===existing?value:load));setResumeLoad(value);setPage("loading");}}}
            onContinueLoad={resumeLoadingSession}
            onStartLoad={(row)=>{const load:CaricoCamion={loadId:crypto.randomUUID(),commessa:row.commessa,cliente:row.cliente,camion:row.camion,stato:"IN_CARICO",operatoreId:"",operatore:"",avviatoIl:new Date().toISOString(),scansioni:[],eventi:[]};setTruckLoads(current=>[...current,load]);setResumeLoad(load);setLoadingInstance(value=>value+1);setPage("loading");}}
            onConfirmDeparture={(row,carrierId,departedAt)=>{const load=truckLoads.find(item=>item.commessa===row.commessa&&item.camion===row.camion&&item.stato==="ATTESA_SPEDIZIONE");if(load){setTruckLoads(current=>current.map(item=>item.loadId===load.loadId?{...item,stato:"SPEDITO",trasportatoreId:carrierId,speditoIl:departedAt,eventi:[...item.eventi,{tipo:"PARTENZA",dataOra:departedAt,operatoreId:item.operatoreId,operatore:item.operatore}]}:item));const numbers=new Set(load.scansioni.flatMap(scan=>scan.tipoUnita==="PACCO"?packages.find(pack=>pack.codice===scan.codiceUnita)?.pannelli.map(panel=>panel.numeroPannello)??[]:[scan.codiceUnita]));setCommesse(current=>current.map(item=>item.ordine!==load.commessa?item:{...item,pannelli:item.pannelli.map(panel=>panel.numeroCamion===load.camion&&numbers.has(panel.numeroPannello)?{...panel,caricato:true,spedito:true}:panel)}));setPackages(current=>current.map(pack=>pack.commessa===load.commessa&&pack.camion===load.camion&&load.scansioni.some(scan=>scan.tipoUnita==="PACCO"&&scan.codiceUnita===pack.codice)?{...pack,stato:"SPEDITO"}:pack));}}}
          />
        ) : page === "labels" ? (
          <PrintLabels commesse={commesse} onBack={() => setPage("dashboard")} />
        ) : page === "scanning-list" ? (
          <ActiveLoads activeSessions={activeScanningSessions} onBack={()=>setPage("dashboard")} onOpen={openScanning} packages={packages} rows={creaDashboard(commesse)} />
        ) : page === "warehouse" ? (
          <Warehouse commesse={commesse} drafts={packageDrafts} onBack={()=>setPage("dashboard")} onCancelPackage={(pack)=>{setPackages(current=>current.filter(item=>item.codice!==pack.codice));markPanelsMissing(pack.commessa,pack.camion,pack.pannelli.map(panel=>panel.numeroPannello));}} onCancelSingle={(unit)=>{setSingles(current=>current.filter(item=>item!==unit));markPanelsMissing(unit.commessa,unit.camion,[unit.numeroPannello]);}} onRemoveDraftPanel={(key,panel)=>setPackageDrafts(current=>{const next=new Map(current);next.set(key,(next.get(key)??[]).filter(item=>item.numeroPannello!==panel.numeroPannello));return next;})} packages={packages} singles={singles} />
        ) : page === "settings" ? (
          <Settings loadErrors={getSettingsLoadErrors()} onBack={()=>setPage("dashboard")} onChange={changeSettings} settings={settings} usedOperatorIds={new Set([...singles.map(item=>item.operatoreId),...packages.map(item=>item.operatoreId)].filter((id):id is string=>Boolean(id)))} />
        ) : page === "history" ? (
          <History commesse={commesse} initialLoadId={historyLoadId} loads={truckLoads} packages={packages} settings={settings} singles={singles} onBack={()=>{setHistoryLoadId(undefined);setPage("dashboard");}} />
        ) : page === "loading" ? (
          <TruckLoading key={`${resumeLoad?.loadId??"loading-list"}:${loadingInstance}`} initialLoad={resumeLoad} onResumeLoad={resumeLoadingSession} loads={truckLoads} onSessionChange={(load)=>{const normalized={...load,tipoDestinazione:load.tipoDestinazione??(load.rimorchioId?"RIMORCHIO_ESSEPI" as const:load.trasportatoreId?"TRASPORTATORE" as const:undefined)};setTruckLoads(current=>{const index=current.findIndex(item=>item.loadId===normalized.loadId);return index<0?[...current,normalized]:current.map((item,i)=>i===index?normalized:item);});}} carriers={settings.trasportatori} commesse={commesse} onBack={()=>{setResumeLoad(null);setPage("dashboard");}} onComplete={(load,units,destination)=>{const normalized={...load,tipoDestinazione:destination==="trailer"?"RIMORCHIO_ESSEPI" as const:"TRASPORTATORE" as const};setTruckLoads(current=>{const index=current.findIndex(item=>item.loadId===normalized.loadId);return index<0?[...current,normalized]:current.map((item,i)=>i===index?normalized:item);});setResumeLoad(null);const numbers=new Set(units.flatMap(unit=>unit.pannelli.map(panel=>panel.numeroPannello)));setCommesse(current=>current.map(item=>item.ordine!==load.commessa?item:{...item,pannelli:item.pannelli.map(panel=>panel.numeroCamion===load.camion&&numbers.has(panel.numeroPannello)?{...panel,caricato:true,spedito:destination==="carrier"}:panel)}));setPackages(current=>current.map(pack=>pack.commessa===load.commessa&&pack.camion===load.camion&&units.some(unit=>unit.tipo==="PACCO"&&unit.codice===pack.codice)?{...pack,stato:destination==="carrier"?"SPEDITO":"CARICATO"}:pack));}} onScanUnit={(row,unit)=>{const numbers=new Set(unit.pannelli.map(panel=>panel.numeroPannello));setCommesse(current=>current.map(item=>item.ordine!==row.commessa?item:{...item,pannelli:item.pannelli.map(panel=>panel.numeroCamion===row.camion&&numbers.has(panel.numeroPannello)?{...panel,caricato:true}:panel)}));if(unit.tipo==="PACCO")setPackages(current=>current.map(pack=>pack.codice===unit.codice?{...pack,stato:"CARICATO"}:pack));}} onUndoUnit={(row,unit)=>{const numbers=new Set(unit.pannelli.map(panel=>panel.numeroPannello));setCommesse(current=>current.map(item=>item.ordine!==row.commessa?item:{...item,pannelli:item.pannelli.map(panel=>panel.numeroCamion===row.camion&&numbers.has(panel.numeroPannello)?{...panel,caricato:false}:panel)}));if(unit.tipo==="PACCO")setPackages(current=>current.map(pack=>pack.codice===unit.codice?{...pack,stato:"DISPONIBILE"}:pack));}} operators={settings.operatori} packages={packages} rows={creaDashboard(commesse)} singles={singles} trailers={settings.rimorchi} />
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
            singles={singles.filter(unit=>commesse.find(item=>item.ordine===unit.commessa)?.pannelli.some(panel=>buildPanelKey({commessa:unit.commessa,cliente:scanningTarget.cliente,camion:unit.camion,numeroPannello:unit.numeroPannello})===buildPanelKey({commessa:scanningTarget.commessa,cliente:scanningTarget.cliente,camion:panel.numeroCamion,numeroPannello:panel.numeroPannello})))}
            target={scanningTarget}
          />
        ) : null}
      </MainLayout>
      <Dialog open={blockedImport!==null} onClose={()=>setBlockedImport(null)}>
        <DialogTitle>Importazione non consentita</DialogTitle>
        <DialogContent><DialogContentText>Importazione non consentita.<br/><br/>La commessa {blockedImport?.commessa} - Camion {blockedImport?.camion} risulta già spedita ed è presente nello Storico.</DialogContentText></DialogContent>
        <DialogActions><Button onClick={()=>setBlockedImport(null)}>Chiudi</Button></DialogActions>
      </Dialog>
      <Dialog open={pendingImport !== null && !confirmRemoved} onClose={() => setPendingImport(null)}>
        <DialogTitle>Commessa e camion già presenti</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Questa commessa e questo camion sono già presenti.
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
