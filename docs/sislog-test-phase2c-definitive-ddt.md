# SISLOG TEST — Fase 2C

## Comportamento

- Carico camion espone **Annulla DDT** soltanto con documento valido e carico non partito. La conferma mostra numero e data, richiede motivazione e un operatore attivo già presente nel sistema.
- L'annullamento riutilizza il servizio della Fase 2B e conserva numero, data, snapshot, PDF e hash. Registra operatore, istante e motivazione anche in `OperationalEvents` (`DDT_CANCELLED`). Non riapre il carico e non registra partenze.
- I documenti annullati restano visibili e ristampabili in Carico camion e nel dettaglio documentale dello Storico. L'interfaccia indica **ANNULLATO**; il PDF originale rimane identico. La nuova emissione conserva il collegamento al documento sostituito.
- Senza DDT valido vengono meno i blocchi documentali già introdotti nella Fase 2B. Le correzioni documentali seguono il Calendario; le correzioni del materiale richiedono la normale riapertura esplicita dalla Dashboard, disponibile anche su mobile. Il carico ancora chiuso può essere riemesso senza riapertura.
- La partenza rimane esclusivamente in Dashboard → Operazioni. In TEST richiede un documento `EMESSO` della stessa sessione e dello stesso carico; gli endpoint alternativi non aggirano il controllo, comprese le pianificazioni prive di carico.

## Transazioni e concorrenza

Il controllo del DDT è eseguito **dentro** la transazione `BEGIN IMMEDIATE` di `LoadingService.ship`, prima delle modifiche di partenza. Rimangono le verifiche su completamento, modalità effettiva e assegnazioni.

Annullamento, emissione e partenza condividono la serializzazione SQLite. Se parte il camion, l'annullamento successivo viene rifiutato; se viene annullato il documento, la partenza successiva viene rifiutata. I controlli di partenza rilevano anche date, assegnazioni ed eventi già registrati.

Una richiesta di annullamento ripetuta restituisce conflitto senza riscrivere l'audit. Il frontend verifica lo stato dopo il tentativo, così una risposta persa può essere riconciliata senza ripetere emissioni o alterare la motivazione. Le protezioni esistenti per progressivi, chiavi di emissione e immutabilità rimangono invariate.

L'identità registrata è l'operatore selezionato nel sistema esistente: non viene introdotto un nuovo sistema di autenticazione.

## File principali

- Backend: `loadingService.ts`, `shipmentService.ts`, `definitiveDdtService.ts`, `issuedDdtService.ts`, repository di carico/DDT e collegamento TEST in `app.ts`.
- Frontend: `DefinitiveDdtPanel.tsx`, API DDT, Dashboard e menu operazioni, dettaglio documentale dello Storico, mappatura dell'evento di annullamento.
- Test: `issuedDdt.test.ts`, regressioni di partenza e relativi fixture isolati, script frontend DDT/Dashboard/carico.

Non sono necessarie nuove migrazioni. Il generatore e il layout PDF approvato non sono stati modificati.

## Verifica

Comandi dalla radice del repository:

```powershell
npm.cmd --prefix backend test
node --import ./backend/node_modules/tsx/dist/loader.mjs --test --test-concurrency=1 frontend/scripts/*.test.mjs
npm.cmd run type-check
```

I test del ciclo DDT verificano motivazione obbligatoria, operatore, audit, tentativi ripetuti, annullamenti concorrenti, esclusione reciproca fra annullamento e partenza su connessioni distinte, mancato cambiamento di stato, correzioni documentali, riapertura materiale, nuovo snapshot/progressivo, ristampa originale e divieto dopo la partenza.

Esito della verifica del 18/10/2026: **229/229 test backend**, **69/69 test frontend**, controllo TypeScript backend/frontend e `git diff --check` superati. La suite frontend richiede il loader TSX indicato sopra per risolvere gli import TypeScript senza estensione.

I test di regressione della partenza usano documenti sintetici esclusivamente su database temporanei; i test di emissione usano il generatore effettivo. Nessuna emissione, annullamento o partenza è stata eseguita sul database TEST operativo.

Il DDT dimostrativo **X-Lam/0001/2026**, sessione `demo-session-02`, è preservato. Prima e dopo le verifiche vengono confrontati tutti i campi di `DdtDocuments` (PDF tramite SHA-256) e i contatori `DdtSequences`, tramite connessione SQLite in sola lettura. Hash originale: `d4f820308790d44f785020007e073a9862c0653de39baa5c2a95225f3b01a8e2`.

Nessun accesso alla produzione; nessun commit, push o deploy.
