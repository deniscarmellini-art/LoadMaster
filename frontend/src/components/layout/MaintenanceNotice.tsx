import { Alert, Box, Button, Typography } from "@mui/material";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getMaintenanceNotice, type MaintenanceNotice as MaintenanceState } from "../../services/maintenanceApi";
import { canReload, maintenanceResumeCycle, reloadSafety } from "../../services/reloadSafety";
import { markUpdateRevisionApplied, observeUpdateRevision, revisionCycle, revisionFromCycle, type RevisionStorage } from "../../services/maintenanceRevision";

export default function MaintenanceNotice() {
  const [notice, setNotice] = useState<MaintenanceState | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [resumeCycle, setResumeCycle] = useState<string | null>(null);
  const safety = useSyncExternalStore(reloadSafety.subscribe, reloadSafety.getSnapshot, reloadSafety.getSnapshot);
  const previousConfirmed = useRef<MaintenanceState | null>(null);
  const handledReloads = useRef(new Set<string>());
  const observedRevision = useRef<number | null>(null);
  const getTabStorage = (): RevisionStorage => {
    try { return window.sessionStorage; }
    catch { return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }; }
  };

  useEffect(() => {
    const markEdited = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches("input,textarea,select,[contenteditable='true']")) reloadSafety.markEdited();
    };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (canReload(reloadSafety.getSnapshot())) return;
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("input", markEdited, true);
    document.addEventListener("change", markEdited, true);
    window.addEventListener("beforeunload", warnBeforeUnload);
    const dialogObserver = new MutationObserver(() => reloadSafety.setCriticalConfirmation(!!document.querySelector('[role="dialog"][aria-modal="true"]')));
    dialogObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["role", "aria-modal"] });
    reloadSafety.setCriticalConfirmation(!!document.querySelector('[role="dialog"][aria-modal="true"]'));
    return () => {
      document.removeEventListener("input", markEdited, true);
      document.removeEventListener("change", markEdited, true);
      window.removeEventListener("beforeunload", warnBeforeUnload);
      dialogObserver.disconnect();
      reloadSafety.setCriticalConfirmation(false);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const controller = new AbortController();
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await getMaintenanceNotice(controller.signal);
        if (!active) return;
        const previous = previousConfirmed.current;
        const observation = observeUpdateRevision(getTabStorage(), response.updateRevision, observedRevision.current);
        observedRevision.current = observation.observed;
        if (observation.pending !== null) {
          setResumeCycle(revisionCycle(observation.pending));
        } else if (previous && maintenanceResumeCycle(previous.state, response.state)) {
          // Compatibility fallback for a state file managed by an older TEST script.
          const cycle = previous.scheduledAt ?? `resumed-${Date.parse(response.serverTime)}`;
          setResumeCycle((current) => current === cycle ? current : cycle);
        }
        previousConfirmed.current = response;
        setNotice(response);
        setServerOffsetMs(Date.parse(response.serverTime) - Date.now());
        setUnavailable(false);
      } catch {
        if (active && !controller.signal.aborted) setUnavailable(true);
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const pollId = window.setInterval(() => void poll(), 5000);
    const clockId = window.setInterval(() => setClock(Date.now()), 1000);
    return () => { active = false; controller.abort(); window.clearInterval(pollId); window.clearInterval(clockId); };
  }, []);

  useEffect(() => {
    if (!resumeCycle || !canReload(safety) || handledReloads.current.has(resumeCycle)) return;
    const targetRevision = revisionFromCycle(resumeCycle);
    if (targetRevision !== null && (notice?.updateRevision ?? -1) < targetRevision) return;
    const key = `sislog-maintenance-reloaded:${resumeCycle}`;
    if (targetRevision !== null) {
      markUpdateRevisionApplied(getTabStorage(), targetRevision);
      observedRevision.current = targetRevision;
    }
    try {
      if (targetRevision === null && window.sessionStorage.getItem(key) === "1") {
        handledReloads.current.add(resumeCycle);
        setResumeCycle(null);
        return;
      }
      window.sessionStorage.setItem(key, "1");
    } catch {
      // The in-memory set still ensures one reload for this page lifetime.
    }
    handledReloads.current.add(resumeCycle);
    setResumeCycle(null);
    window.location.reload();
  }, [notice?.updateRevision, resumeCycle, safety]);

  const reloadAfterConfirmation = () => {
    if (!resumeCycle || reloadSafety.getSnapshot().pendingWrites > 0) return;
    const targetRevision = revisionFromCycle(resumeCycle);
    if (targetRevision !== null && (notice?.updateRevision ?? -1) < targetRevision) return;
    const confirmed = window.confirm("Verifica che le modifiche siano state salvate e che eventuali operazioni con esito incerto siano state controllate. Dopo la conferma SisLog verrà ricaricato.");
    if (!confirmed) return;
    reloadSafety.acknowledgeResolved();
    handledReloads.current.add(resumeCycle);
    if (targetRevision !== null) {
      markUpdateRevisionApplied(getTabStorage(), targetRevision);
      observedRevision.current = targetRevision;
    } else {
      try { window.sessionStorage.setItem(`sislog-maintenance-reloaded:${resumeCycle}`, "1"); } catch { /* Storage may be unavailable. */ }
    }
    window.location.reload();
  };

  const scheduledSeconds = notice?.scheduledAt
    ? Math.max(0, Math.ceil((Date.parse(notice.scheduledAt) - (clock + serverOffsetMs)) / 1000))
    : null;
  const blocked = notice?.state === "maintenance" || (notice?.state === "scheduled" && scheduledSeconds === 0);

  useEffect(() => {
    if (!blocked) return;
    const preventActivation = (event: KeyboardEvent) => {
      if ((event.key === "Enter" || event.key === " ") && event.target instanceof HTMLElement && event.target.closest("button,a,input,select,textarea,[role=button]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const preventFormSubmit = (event: SubmitEvent) => { event.preventDefault(); event.stopImmediatePropagation(); };
    document.addEventListener("keydown", preventActivation, true);
    document.addEventListener("submit", preventFormSubmit, true);
    return () => { document.removeEventListener("keydown", preventActivation, true); document.removeEventListener("submit", preventFormSubmit, true); };
  }, [blocked]);

  if (notice?.state === "idle" && !unavailable && !resumeCycle) return null;
  const title = resumeCycle
    ? "Aggiornamento completato. Verifica il lavoro prima di ricaricare SisLog."
    : unavailable
      ? "Stato aggiornamento non verificabile. Riprovo automaticamente."
      : blocked
        ? "Aggiornamento SisLog in corso. Attendere la riapertura."
        : notice?.message ?? "Aggiornamento SisLog programmato";
  const severity = unavailable ? "error" : blocked ? "info" : resumeCycle ? "success" : "warning";
  const seconds = scheduledSeconds ?? 0;
  const timer = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const targetRevision = resumeCycle ? revisionFromCycle(resumeCycle) : null;
  const revisionWaiting = targetRevision !== null && (notice?.updateRevision ?? -1) < targetRevision;
  const safetyMessage = revisionWaiting
    ? "La postazione ha rilevato un aggiornamento; attendo che il server esponga la revisione corrispondente."
    : safety.pendingWrites > 0
    ? `Attendi il completamento di ${safety.pendingWrites} richiesta/e.`
    : safety.uncertainWrites > 0
      ? "Esistono richieste dall'esito incerto. Verificale prima di proseguire."
        : safety.criticalConfirmation
          ? "È aperta una finestra di conferma. Completa o chiudi l'operazione prima di ricaricare."
      : safety.edited
        ? "Sono stati modificati campi in questa scheda. Salvali prima di proseguire."
        : "Ricaricamento in corso.";

  return <>
    {blocked && <Box aria-hidden="true" sx={{ position: "fixed", inset: 0, zIndex: 1301, bgcolor: "rgba(0,0,0,0.08)", cursor: "not-allowed", "@media print": { display: "none" } }} />}
    <Box sx={{ position: "sticky", top: 28, zIndex: 1400, px: { xs: 1, md: 3 }, pt: 1, "@media print": { display: "none" } }}>
      <Alert severity={severity} variant="filled" role="status" aria-live="polite" sx={{ alignItems: "center", "& .MuiAlert-message": { width: "100%" } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography component="div" sx={{ fontWeight: 800 }}>{title}</Typography>
            {!blocked && !unavailable && !resumeCycle && <Typography component="div" variant="body2">Completa e salva le operazioni in corso prima della scadenza.</Typography>}
            {blocked && <Typography component="div" variant="body2">Le modifiche restano visualizzate; le nuove operazioni sono sospese.</Typography>}
            {resumeCycle && <Typography component="div" variant="body2">{safetyMessage}</Typography>}
          </Box>
          {!blocked && !unavailable && !resumeCycle && <Typography component="div" aria-label="Tempo rimanente" sx={{ fontWeight: 900, fontSize: { xs: "1.15rem", md: "1.35rem" }, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{seconds === 0 ? "00:00" : timer}</Typography>}
          {resumeCycle && <Button variant="contained" color="primary" disabled={revisionWaiting || safety.pendingWrites > 0 || safety.criticalConfirmation} onClick={reloadAfterConfirmation}>Ricarica SisLog</Button>}
        </Box>
      </Alert>
    </Box>
  </>;
}
