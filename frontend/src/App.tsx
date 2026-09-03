import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  ThemeProvider,
} from "@mui/material";

import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import ActiveLoads from "./pages/ActiveLoads";
import PanelScanning from "./pages/PanelScanning";
import PrintLabels from "./pages/PrintLabels";
import Warehouse from "./pages/Warehouse";
import Settings from "./pages/Settings";
import TruckLoading from "./pages/TruckLoading";
import History from "./pages/History";
import Transports from "./pages/Transports";
import Shipments from "./pages/Shipments";
import MobileDashboardReturn from "./components/navigation/MobileDashboardReturn";
import theme from "./theme/theme";
import {
  creaDashboard,
  creaDashboardOperativa,
  toOperationalLoadStatus,
} from "./services/dashboardService";
import type { Camion } from "./models/Camion";
import type { Pacco, UnitaSingola } from "./models/Scanning";
import { loadSettings } from "./services/settingsStore";
import { loadSettingsFromApi, saveSettingsToApi } from "./services/settingsApi";
import { ApiClientError } from "./services/apiClient";
import type { CaricoCamion } from "./models/Loading";
import type { Operatore } from "./models/Settings";
import { operatorLabel } from "./models/Settings";
import type { Commessa, Pannello } from "./types/excel";
import { buildPanelKey } from "./utils/panelIdentity";
import { normalizeOrder, normalizeTruck } from "./utils/loadIdentity";
import {
  deleteLoadFromApi,
  importCommessaToApi,
  loadCommesseFromApi,
  updateCommessaInApi,
} from "./services/loadsApi";
import {
  cancelPackageApi,
  cancelPanelApi,
  loadScanningSnapshot,
  removePanelFromPackage,
  updatePanelManualLocation,
  updatePackageManualLocation,
} from "./services/scanningApi";
import {
  listLoadingSessions,
  reopenLoadingApi,
  shipLoadingApi,
} from "./services/loadingApi";
import { listTransports, type TransportItem } from "./services/transportsApi";
import { departShipment, listShipments, type ShipmentItem } from "./services/shipmentsApi";
import useAutoRefresh from "./hooks/useAutoRefresh";

const panelKey = (panel: Pannello) =>
  `${normalizeTruck(panel.numeroCamion)}\u0000${String(panel.numeroPannello).trim()}`;

export default function App() {
  const [commesse, setCommesse] = useState<Commessa[]>([]);
  const [loadsLoading, setLoadsLoading] = useState(true);
  const [loadsError, setLoadsError] = useState<string | null>(null);
  const [page, setPage] = useState<
    | "dashboard"
    | "labels"
    | "scanning"
    | "scanning-list"
    | "warehouse"
    | "settings"
    | "loading"
    | "transports"
    | "shipments"
    | "history"
  >("dashboard");
  const [scanningTarget, setScanningTarget] = useState<Camion | null>(null);
  const [packages, setPackages] = useState<Pacco[]>([]);
  const [singles, setSingles] = useState<UnitaSingola[]>([]);
  const [packageDrafts, setPackageDrafts] = useState<Map<string, Pannello[]>>(
    new Map(),
  );
  const [packageDraftIds, setPackageDraftIds] = useState<Map<string, string>>(
    new Map(),
  );
  const [activeScanningSessions, setActiveScanningSessions] = useState<
    Set<string>
  >(new Set());
  const [settings, setSettings] = useState(loadSettings);
  const [settingsLoadErrors, setSettingsLoadErrors] = useState<string[]>([]);
  const [truckLoads, setTruckLoads] = useState<CaricoCamion[]>([]);
  const [transports, setTransports] = useState<TransportItem[]>([]);
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [resumeLoad, setResumeLoad] = useState<CaricoCamion | null>(null);
  const [loadingInstance, setLoadingInstance] = useState(0);
  const [historyLoadId, setHistoryLoadId] = useState<string | undefined>();
  const [pendingImport, setPendingImport] = useState<Commessa | null>(null);
  const [blockedImport, setBlockedImport] = useState<{
    commessa: string;
    camion: string;
  } | null>(null);
  const [confirmRemoved, setConfirmRemoved] = useState(false);
  const settingsRef = useRef(settings);
  const scanningRefreshRef = useRef<Promise<void> | null>(null);
  const settingsRefreshRef = useRef<Promise<void> | null>(null);
  settingsRef.current = settings;

  const refreshSettings = useCallback(async () => {
    if (settingsRefreshRef.current) return settingsRefreshRef.current;
    const request = loadSettingsFromApi()
      .then((value) => {
        setSettings(value);
        setSettingsLoadErrors([]);
      })
      .catch(() => {
        setSettingsLoadErrors([
          "Backend non raggiungibile: impossibile caricare le anagrafiche.",
        ]);
      });
    settingsRefreshRef.current = request;
    try {
      await request;
    } finally {
      if (settingsRefreshRef.current === request)
        settingsRefreshRef.current = null;
    }
  }, []);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);
  const refreshScanningData = useCallback(async () => {
    if (scanningRefreshRef.current) return scanningRefreshRef.current;
    const operatorName = (id: string) => {
      const value = settingsRef.current.operatori.find((item) => item.id === id);
      return value ? operatorLabel(value) : id;
    };
    const request = Promise.all([
      loadCommesseFromApi(),
      loadScanningSnapshot(operatorName),
      listLoadingSessions(operatorName),
      listTransports(),
      listShipments(),
    ]).then(([loads, snapshot, sessions, transportItems, shipmentItems]) => {
      setCommesse(loads);
      setSingles(snapshot.singles);
      setPackages(snapshot.packages);
      setPackageDrafts(snapshot.drafts);
      setPackageDraftIds(snapshot.draftIds);
      setTruckLoads(sessions);
      setTransports(transportItems);
      setShipments(shipmentItems);
      setLoadsError(null);
    });
    scanningRefreshRef.current = request;
    try {
      await request;
    } finally {
      if (scanningRefreshRef.current === request)
        scanningRefreshRef.current = null;
    }
  }, []);
  useEffect(() => {
    let active = true;
    void refreshScanningData()
      .catch(() => {
        if (active)
          setLoadsError(
            "Backend non raggiungibile: impossibile caricare commesse ed elementi.",
          );
      })
      .finally(() => {
        if (active) setLoadsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshScanningData]);
  const refreshIntervals: Partial<Record<typeof page, number>> = {
    dashboard: 15_000,
    scanning: 10_000,
    "scanning-list": 10_000,
    warehouse: 15_000,
    loading: 7_500,
    transports: 15_000,
    shipments: 15_000,
  };
  const refreshDataOnFocus = page !== "labels" && page !== "settings";
  useAutoRefresh(refreshScanningData, {
    enabled: refreshDataOnFocus,
    intervalMs: refreshIntervals[page],
    scopeKey: page,
  });
  useAutoRefresh(refreshSettings, {
    enabled: page === "settings",
    scopeKey: page,
  });
  const changeSettings = async (next: typeof settings): Promise<boolean> => {
    const previous = settings;
    setSettings(next);
    try {
      const saved = await saveSettingsToApi(next, previous);
      setSettings(saved);
      setSettingsLoadErrors([]);
      return true;
    } catch (error: unknown) {
      setSettings(previous);
      const message =
        error instanceof ApiClientError && error.code === "RESOURCE_IN_USE"
          ? "Il record è già utilizzato e non può essere eliminato."
          : "Errore durante il salvataggio.";
      setSettingsLoadErrors([message]);
      return false;
    }
  };

  const resumeLoadingSession = useCallback(
    (loadId: string) => {
      const existing = truckLoads.find((load) => load.loadId === loadId);
      if (!existing) return;
      setResumeLoad(existing);
      setLoadingInstance((value) => value + 1);
      setPage("loading");
    },
    [truckLoads],
  );
  const trailerLocationByLoadId = new Map(
    truckLoads
      .filter((load) => Boolean(load.backendLoadId))
      .map((load) => {
        const trailer = settings.rimorchi.find(
          (item) => item.id === load.rimorchioId,
        );
        const location = trailer
          ? [trailer.targa, trailer.descrizione].filter(Boolean).join(" — ")
          : "Da assegnare";
        return [load.backendLoadId!, location] as const;
      }),
  );
  const operationalStatusByLoadId = useMemo(
    () =>
      new Map(
        creaDashboardOperativa(commesse, truckLoads).map((row) => [
          row.id,
          toOperationalLoadStatus(row.stato),
        ]),
      ),
    [commesse, truckLoads],
  );
  const shipmentsWithOperationalStatus = useMemo(
    () =>
      shipments.map((shipment) => ({
        ...shipment,
        operationalStatus: shipment.loadId
          ? operationalStatusByLoadId.get(shipment.loadId) ??
            shipment.operationalStatus
          : shipment.operationalStatus,
      })),
    [shipments, operationalStatusByLoadId],
  );

  const handleImported = useCallback(
    async (commessa: Commessa): Promise<void> => {
      const importedTrucks = new Map(
        commessa.pannelli.map((panel) => [
          normalizeTruck(panel.numeroCamion),
          panel.numeroCamion,
        ]),
      );
      const shipped = truckLoads.find(
        (load) =>
          load.stato === "SPEDITO" &&
          importedTrucks.has(normalizeTruck(load.camion)) &&
          normalizeOrder(load.commessa) === normalizeOrder(commessa.ordine),
      );
      if (shipped) {
        setPendingImport(null);
        setBlockedImport({ commessa: commessa.ordine, camion: shipped.camion });
        return;
      }
      const duplicate =
        commesse.some(
          (existing) =>
            normalizeOrder(existing.ordine) ===
              normalizeOrder(commessa.ordine) &&
            existing.pannelli.some((panel) =>
              importedTrucks.has(normalizeTruck(panel.numeroCamion)),
            ),
        ) ||
        truckLoads.some(
          (load) =>
            load.stato !== "SPEDITO" &&
            normalizeOrder(load.commessa) === normalizeOrder(commessa.ordine) &&
            importedTrucks.has(normalizeTruck(load.camion)),
        );
      if (duplicate) setPendingImport(commessa);
      else setCommesse(await importCommessaToApi(commessa));
    },
    [commesse, truckLoads],
  );

  const removedPanels = pendingImport
    ? (() => {
        const incomingKeys = new Set(pendingImport.pannelli.map(panelKey));
        return commesse.flatMap((item) =>
          normalizeOrder(item.ordine) === normalizeOrder(pendingImport.ordine)
            ? item.pannelli.filter(
                (panel) =>
                  !incomingKeys.has(panelKey(panel)),
              )
            : [],
        );
      })()
    : [];
  const removedLoadedPanels = removedPanels.filter((panel) => panel.caricato);
  const shippedLoadKeys = new Set(
    truckLoads
      .filter((load) => load.stato === "SPEDITO")
      .map(
        (load) =>
          `${normalizeOrder(load.commessa)}\u0000${normalizeTruck(load.camion)}`,
      ),
  );
  const printableCommesse = commesse
    .map((commessa) => ({
      ...commessa,
      pannelli: commessa.pannelli.filter(
        (panel) =>
          !shippedLoadKeys.has(
            `${normalizeOrder(commessa.ordine)}\u0000${normalizeTruck(panel.numeroCamion)}`,
          ),
      ),
    }))
    .filter((commessa) => commessa.pannelli.length > 0);

  const updateExisting = async () => {
    if (!pendingImport) return;
    if (removedPanels.length > 0) setConfirmRemoved(true);
    else {
      try {
        setCommesse(await updateCommessaInApi(pendingImport, false));
        setPendingImport(null);
      } catch (error: unknown) {
        alert(error instanceof Error?error.message:"Errore durante l'aggiornamento della distinta.");
      }
    }
  };

  const completeUpdate = async (removeMissing: boolean) => {
    if (!pendingImport) {
      setConfirmRemoved(false);
      return;
    }
    try {
      setCommesse(await updateCommessaInApi(pendingImport, removeMissing));
      setConfirmRemoved(false);
      setPendingImport(null);
    } catch (error: unknown) {
      alert(error instanceof Error?error.message:"Errore durante l'aggiornamento della distinta.");
    }
  };

  const scanKey = (order: string, truck: string) => `${order}\u0000${truck}`;
  const openScanning = (target: Camion) => {
    setScanningTarget(target);
    setActiveScanningSessions((current) =>
      new Set(current).add(scanKey(target.commessa, target.camion)),
    );
    setPage("scanning");
  };
  const scanningCommessa = scanningTarget
    ? commesse.find((item) => item.ordine === scanningTarget.commessa)
    : undefined;
  const setDraftForTarget: React.Dispatch<React.SetStateAction<Pannello[]>> = (
    action,
  ) => {
    if (!scanningTarget) return;
    const key = scanKey(scanningTarget.commessa, scanningTarget.camion);
    setPackageDrafts((current) => {
      const next = new Map(current);
      const old = next.get(key) ?? [];
      next.set(key, typeof action === "function" ? action(old) : action);
      return next;
    });
  };
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MainLayout>
        {loadsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : loadsError ? (
          <Alert severity="error">{loadsError}</Alert>
        ) : page === "dashboard" ? (
          <Dashboard
            commesse={commesse}
            onImported={handleImported}
            onDeleteLoad={async (row, confirmPlanning) => {
              await deleteLoadFromApi(row.id, confirmPlanning);
              await refreshScanningData();
            }}
            onOpenLabels={() => setPage("labels")}
            onOpenScanning={openScanning}
            onOpenScanningList={() => setPage("scanning-list")}
            onOpenWarehouse={() => setPage("warehouse")}
            onOpenSettings={() => setPage("settings")}
            onOpenLoading={() => {
              setResumeLoad(null);
              setPage("loading");
            }}
            onOpenTransports={() => setPage("transports")}
            onOpenShipments={() => setPage("shipments")}
            shipments={shipmentsWithOperationalStatus}
            onOpenHistory={(row) => {
              setHistoryLoadId(
                row
                  ? truckLoads.find(
                      (load) =>
                        load.commessa === row.commessa &&
                        load.camion === row.camion &&
                        load.stato === "SPEDITO",
                    )?.loadId
                  : undefined,
              );
              setPage("history");
            }}
            operators={settings.operatori.filter((item) => item.attivo)}
            carriers={settings.trasportatori}
            trailers={settings.rimorchi}
            transports={transports}
            truckLoads={truckLoads}
            packages={packages}
            onReopenLoad={(row, operator: Operatore, reason) => {
              const existing = truckLoads.find(
                (load) =>
                  load.commessa === row.commessa &&
                  load.camion === row.camion &&
                  load.stato === "ATTESA_SPEDIZIONE",
              );
              if (existing)
                void reopenLoadingApi(existing.loadId, reason).then(
                  async () => {
                    await refreshScanningData();
                    const value = {
                      ...existing,
                      stato: "IN_CARICO" as const,
                      eventi: [
                        ...existing.eventi,
                        {
                          tipo: "RIAPERTURA" as const,
                          dataOra: new Date().toISOString(),
                          operatoreId: operator.id,
                          operatore: operatorLabel(operator),
                          nota: reason || undefined,
                        },
                      ],
                    };
                    setResumeLoad(value);
                    setPage("loading");
                  },
                );
            }}
            onContinueLoad={resumeLoadingSession}
            onStartLoad={(row) => {
              const load: CaricoCamion = {
                loadId: "",
                backendLoadId: row.id,
                commessa: row.commessa,
                cliente: row.cliente,
                camion: row.camion,
                stato: "DA_CARICARE",
                operatoreId: "",
                operatore: "",
                avviatoIl: "",
                scansioni: [],
                eventi: [],
              };
              setResumeLoad(load);
              setLoadingInstance((value) => value + 1);
              setPage("loading");
            }}
            onConfirmDeparture={(row, carrierId) => {
              const load = truckLoads.find(
                (item) =>
                  item.commessa === row.commessa &&
                  item.camion === row.camion &&
                  item.stato === "ATTESA_SPEDIZIONE",
              );
              if (!load) return;
              const shipment = shipments.find(
                (item) =>
                  item.persisted &&
                  item.loadId === load.backendLoadId,
              );
              void (shipment
                ? departShipment(shipment.id, carrierId)
                : shipLoadingApi(load.loadId, carrierId)
              ).then(refreshScanningData);
            }}
          />
        ) : page === "labels" ? (
          <PrintLabels
            commesse={printableCommesse}
            listeOperative={settings.listeOperative}
            onBack={() => setPage("dashboard")}
          />
        ) : page === "scanning-list" ? (
          <ActiveLoads
            activeSessions={activeScanningSessions}
            onBack={() => setPage("dashboard")}
            onOpen={openScanning}
            packages={packages}
            rows={creaDashboard(commesse)}
          />
        ) : page === "warehouse" ? (
          <Warehouse
            commesse={commesse}
            drafts={packageDrafts}
            onBack={() => setPage("dashboard")}
            onCancelPackage={(pack) => {
              if (pack.id)
                void cancelPackageApi(pack.id, pack.operatoreId).then(
                  refreshScanningData,
                );
            }}
            onCancelSingle={(unit) => {
              const panel = commesse
                .find((item) => item.ordine === unit.commessa)
                ?.pannelli.find(
                  (item) =>
                    item.numeroCamion === unit.camion &&
                    item.numeroPannello === unit.numeroPannello,
                );
              if (panel?.backendId)
                void cancelPanelApi(panel.backendId, unit.operatoreId).then(
                  refreshScanningData,
                );
            }}
            onRemoveDraftPanel={(key, panel) => {
              const id = packageDraftIds.get(key);
              if (id && panel.backendId)
                void removePanelFromPackage(
                  id,
                  panel.backendId,
                  panel.scannedByOperatorId ?? "",
                ).then(refreshScanningData);
            }}
            onUpdatePanelLocation={async (panel, location) => {
              if (!panel.backendId)
                throw new Error("Identificativo elemento non disponibile");
              await updatePanelManualLocation(panel.backendId, location);
              await refreshScanningData();
            }}
            onUpdatePackageLocation={async (pack, location) => {
              if (!pack.id)
                throw new Error("Identificativo pacco non disponibile");
              await updatePackageManualLocation(pack.id, location);
              await refreshScanningData();
            }}
            packages={packages}
            singles={singles}
            trailerLocationByLoadId={trailerLocationByLoadId}
          />
        ) : page === "settings" ? (
          <Settings
            loadErrors={settingsLoadErrors}
            onBack={() => setPage("dashboard")}
            onChange={changeSettings}
            settings={settings}
            usedOperatorIds={
              new Set(
                [
                  ...singles.map((item) => item.operatoreId),
                  ...packages.map((item) => item.operatoreId),
                ].filter((id): id is string => Boolean(id)),
              )
            }
          />
        ) : page === "transports" ? (
          <Transports
            items={transports}
            onBack={() => setPage("dashboard")}
            onRefresh={async () => setTransports(await listTransports())}
          />
        ) : page === "shipments" ? (
          <Shipments
            items={shipmentsWithOperationalStatus}
            trailers={settings.rimorchi}
            carriers={settings.trasportatori}
            transports={transports}
            onBack={() => setPage("dashboard")}
            onRefresh={refreshScanningData}
          />
        ) : page === "history" ? (
          <History
            commesse={commesse}
            initialLoadId={historyLoadId}
            loads={truckLoads}
            packages={packages}
            settings={settings}
            singles={singles}
            onBack={() => {
              setHistoryLoadId(undefined);
              setPage("dashboard");
            }}
          />
        ) : page === "loading" ? (
          <TruckLoading
            key={`${resumeLoad?.loadId ?? "loading-list"}:${loadingInstance}`}
            initialLoad={resumeLoad}
            onResumeLoad={resumeLoadingSession}
            loads={truckLoads}
            onSessionChange={(load) => {
              const normalized = {
                ...load,
                tipoDestinazione:
                  load.tipoDestinazione ??
                  (load.rimorchioId
                    ? ("RIMORCHIO_ESSEPI" as const)
                    : load.trasportatoreId
                      ? ("TRASPORTATORE" as const)
                      : undefined),
              };
              setTruckLoads((current) => {
                const index = current.findIndex(
                  (item) => item.loadId === normalized.loadId,
                );
                return index < 0
                  ? [...current, normalized]
                  : current.map((item, i) => (i === index ? normalized : item));
              });
            }}
            carriers={settings.trasportatori}
            commesse={commesse}
            transports={transports}
            onBack={() => {
              setResumeLoad(null);
              setPage("dashboard");
            }}
            onComplete={(load, units, destination) => {
              const normalized = {
                ...load,
                tipoDestinazione:
                  destination === "trailer"
                    ? ("RIMORCHIO_ESSEPI" as const)
                    : ("TRASPORTATORE" as const),
              };
              setTruckLoads((current) => {
                const index = current.findIndex(
                  (item) => item.loadId === normalized.loadId,
                );
                return index < 0
                  ? [...current, normalized]
                  : current.map((item, i) => (i === index ? normalized : item));
              });
              setResumeLoad(null);
              const numbers = new Set(
                units.flatMap((unit) =>
                  unit.pannelli.map((panel) => panel.numeroPannello),
                ),
              );
              setCommesse((current) =>
                current.map((item) =>
                  item.ordine !== load.commessa
                    ? item
                    : {
                        ...item,
                        pannelli: item.pannelli.map((panel) =>
                          panel.numeroCamion === load.camion &&
                          numbers.has(panel.numeroPannello)
                            ? {
                                ...panel,
                                caricato: true,
                                spedito: destination === "carrier",
                              }
                            : panel,
                        ),
                      },
                ),
              );
              setPackages((current) =>
                current.map((pack) =>
                  pack.commessa === load.commessa &&
                  pack.camion === load.camion &&
                  units.some(
                    (unit) =>
                      unit.tipo === "PACCO" && unit.codice === pack.codice,
                  )
                    ? {
                        ...pack,
                        stato:
                          destination === "carrier" ? "SPEDITO" : "CARICATO",
                      }
                    : pack,
                ),
              );
            }}
            onScanUnit={(row, unit, status) => {
              const numbers = new Set(
                unit.pannelli.map((panel) => panel.numeroPannello),
              );
              setCommesse((current) =>
                current.map((item) =>
                  item.ordine !== row.commessa
                    ? item
                    : {
                        ...item,
                        pannelli: item.pannelli.map((panel) =>
                          panel.numeroCamion === row.camion &&
                          numbers.has(panel.numeroPannello)
                            ? { ...panel, caricato: true, loadStatus: status }
                            : panel.numeroCamion === row.camion
                              ? { ...panel, loadStatus: status }
                              : panel,
                        ),
                      },
                ),
              );
              if (unit.tipo === "PACCO")
                setPackages((current) =>
                  current.map((pack) =>
                    pack.codice === unit.codice
                      ? { ...pack, stato: "CARICATO" }
                      : pack,
                  ),
                );
            }}
            onUndoUnit={(row, unit, status) => {
              const numbers = new Set(
                unit.pannelli.map((panel) => panel.numeroPannello),
              );
              setCommesse((current) =>
                current.map((item) =>
                  item.ordine !== row.commessa
                    ? item
                    : {
                        ...item,
                        pannelli: item.pannelli.map((panel) =>
                          panel.numeroCamion === row.camion &&
                          numbers.has(panel.numeroPannello)
                            ? { ...panel, caricato: false, loadStatus: status }
                            : panel.numeroCamion === row.camion
                              ? { ...panel, loadStatus: status }
                              : panel,
                        ),
                      },
                ),
              );
              if (unit.tipo === "PACCO")
                setPackages((current) =>
                  current.map((pack) =>
                    pack.codice === unit.codice
                      ? { ...pack, stato: "DISPONIBILE" }
                      : pack,
                  ),
                );
            }}
            operators={settings.operatori}
            packages={packages}
            rows={creaDashboard(commesse)}
            singles={singles}
            trailers={settings.rimorchi}
          />
        ) : scanningTarget && scanningCommessa ? (
          <PanelScanning
            commessa={scanningCommessa}
            draftPanels={
              packageDrafts.get(
                scanKey(scanningTarget.commessa, scanningTarget.camion),
              ) ?? []
            }
            draftId={packageDraftIds.get(
              scanKey(scanningTarget.commessa, scanningTarget.camion),
            )}
            onDraftChange={setDraftForTarget}
            onDataChanged={refreshScanningData}
            onBack={() => {
              setScanningTarget(null);
              setPage("dashboard");
            }}
            onClosePackage={() => undefined}
            onCloseSingle={() => undefined}
            packages={packages}
            operators={settings.operatori.filter((operator) => operator.attivo)}
            singles={singles.filter((unit) =>
              commesse
                .find((item) => item.ordine === unit.commessa)
                ?.pannelli.some(
                  (panel) =>
                    buildPanelKey({
                      commessa: unit.commessa,
                      cliente: scanningTarget.cliente,
                      camion: unit.camion,
                      numeroPannello: unit.numeroPannello,
                    }) ===
                    buildPanelKey({
                      commessa: scanningTarget.commessa,
                      cliente: scanningTarget.cliente,
                      camion: panel.numeroCamion,
                      numeroPannello: panel.numeroPannello,
                    }),
                ),
            )}
            target={scanningTarget}
          />
        ) : null}
        {page !== "dashboard" && !loadsLoading && !loadsError && (
          <MobileDashboardReturn
            onBack={() => {
              setHistoryLoadId(undefined);
              setResumeLoad(null);
              setScanningTarget(null);
              setPage("dashboard");
            }}
          />
        )}
      </MainLayout>
      <Dialog
        open={blockedImport !== null}
        onClose={() => setBlockedImport(null)}
      >
        <DialogTitle>Importazione non consentita</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Importazione non consentita.
            <br />
            <br />
            La commessa {blockedImport?.commessa} - Camion{" "}
            {blockedImport?.camion} risulta già spedita ed è presente nello
            Storico.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockedImport(null)}>Chiudi</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={pendingImport !== null && !confirmRemoved}
        onClose={() => setPendingImport(null)}
      >
        <DialogTitle>Commessa e camion già presenti</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Questa commessa e questo camion sono già presenti.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingImport(null)}>Annulla</Button>
          <Button variant="contained" onClick={updateExisting}>
            Aggiorna commessa esistente
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirmRemoved} onClose={() => completeUpdate(false)}>
        <DialogTitle>Elementi rimossi dalla distinta</DialogTitle>
        <DialogContent>
          <DialogContentText>
            La nuova distinta non contiene più {removedPanels.length}{" "}
            {removedPanels.length === 1 ? "elemento" : "elementi"}.{" "}
            {removedLoadedPanels.length > 0 && (
              <>
                <br />
                <br />
                <b>
                  Attenzione: {removedLoadedPanels.length} risultano già
                  caricati. Confermando verranno scaricati e rimossi dalla
                  commessa.
                </b>
              </>
            )}
            <br />
            <br />
            Vuoi eliminarli dalla commessa?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => completeUpdate(false)}>
            Mantieni elementi
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => completeUpdate(true)}
          >
            Elimina elementi rimossi
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
