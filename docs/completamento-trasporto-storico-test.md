# Completamento trasporto storico — solo TEST

In Carico camion, nel pannello DDT, «Completa dati trasporto» è disponibile solo per sessioni con chiusura storica `LOADING_COMPLETED`, ancora in attesa di spedizione, materiale coerente e trasporto incompleto. Un DDT valido o una partenza registrata impediscono l'operazione.

La finestra conserva destinazione e rimorchio storici in sola lettura. Per `RIMORCHIO_ESSEPI` propone Bilico Essepi; il vettore mancante deve essere scelto esplicitamente, senza consultare la pianificazione. Sono obbligatori un operatore attivo e la conferma dei dati.

Le route GET/POST `/api/loading-sessions/:id/historical-transport` sono registrate esclusivamente in TEST. Il POST usa `BEGIN IMMEDIATE`, ricontrolla l'idoneità e una revisione dei dati, valida il trasporto e completa solo i campi mancanti. Non aggiorna date della sessione, stato, operatore storico, materiale o assegnazioni. L'evento `HISTORICAL_TRANSPORT_CONFIRMED` conserva operatore confermante, data corrente, prima/dopo e provenienza storica. Un errore audit annulla l'intera transazione.

Il percorso ordinario DDT resta invariato: nessuna emissione automatica e nessun allentamento dei controlli. I trigger DDT esistenti continuano a proteggere il carico da modifiche dopo l'emissione.

Verifiche: test backend `historicalTransport.test.ts` (incluso in `npm --prefix backend test`), regressioni DDT, test frontend `frontend/scripts/historical-transport-history.test.mjs`, TypeScript e build. La prova Edge usa fixture con API simulate. Il caso reale 265484 / Wood Solution / C1- è stato verificato con connessione SQLite `readOnly`, senza conferma né emissione.
