# SISLOG TEST — Fase 2B

## Attivazione controllata

È stato verificato il percorso reale di `backend/data/sistema-logistico-test.sqlite` usando `assertTestDatabase`: nome previsto, directory reale, nessun link simbolico/hard link o condivisione del file con la produzione.

Prima dell'attivazione è stato creato un backup coerente mediante l'API SQLite `backup`, con connessione sorgente in sola lettura e `PRAGMA integrity_check` sulla copia. Backup precedente alla migration:

`backend/data/backups/pre-ddt-2b-2026-10-17T11-53-06.776Z-a2d3ce39-172e-4fbd-aa81-edb00e1b3411.sqlite`

SHA-256: `cf647e6f589b5f26c5eab9b2fd9edcfd460a8a1b8b7c35b4b60f0eeb05b57933`.

`scripts/activate-test-ddt.mjs` effettua backup, verifica, migration e confronto dell'hash dei dati operativi prima/dopo. L'attivazione ha confermato dati operativi invariati e zero documenti emessi. Non apre il database di produzione. Le copie sono escluse da Git. L'avvio TEST abilita ora lo schema DDT; gli avvii DEMO/development/production non lo attivano e non registrano le nuove API.

## Emissione e archivio

`IssuedDdtService` riutilizza il servizio transazionale della Fase 2A. Verifica chiusura formale, ATTESA_SPEDIZIONE, composizione completa realmente caricata, una pianificazione collegata tramite loadId, dati documentali e modalità effettiva di trasporto. Per Ritiro cliente non richiede carrierId; per Bilico e Conto terzi usa soltanto il vettore effettivo, con i controlli esistenti sul trasporto fisico.

Lo snapshot comprende modello definitivo, sessione/carico, pianificazione, cliente identificato, unità attive, pannelli caricati, pacchi caricati, vettore/rimorchio e versione del modello grafico con intestazione e condizioni. Nessun dato previsto del Calendario sostituisce il trasporto effettivo.

Lo stesso renderer del layout approvato produce anteprima e definitivo. L'anteprima mantiene comportamento e dicitura precedenti. Nel definitivo cambiano soltanto numero, data, metadati del PDF e assenza della dicitura ANTEPRIMA. Snapshot, numero annuale, PDF BLOB e SHA-256 vengono confermati nella stessa transazione SQLite.

La nuova `DdtDocuments.requestKey` ha indice univoco e protezione di immutabilità. La stessa richiesta restituisce lo stesso documento anche se la prima risposta è andata persa; richieste diverse non possono creare due DDT validi. Il replay di una richiesta relativa a un documento poi annullato restituisce quel documento annullato, senza nuova emissione. Una nuova emissione richiede una nuova conferma/chiave. Il frontend conserva la chiave del tentativo tra retry e, quando possibile, rimontaggi della schermata.

Le ristampe leggono esclusivamente il BLOB originale e ne verificano l'hash. La corruzione blocca la risposta PDF. Anche un DDT annullato conserva i byte originali per lo storico; non viene rigenerato o sovrastampato.

## Protezioni

Trigger SQLite proteggono le sorgenti documentali su ogni connessione, comprese importazioni e scritture da altri repository:

- Sessione, scansioni/unità attive, pannelli e pacchi: nessuna riapertura, variazione di composizione, dimensioni, pesi, ubicazioni o trasporto effettivo con DDT valido.
- Carico e pianificazione: nessuna modifica dei dati documentali, eliminazione o ricollegamento.
- Assegnazione fisica: nessun disimpegno anticipato o cambio di risorsa. Restano consentiti la partenza e il successivo rientro tramite i servizi esistenti.
- Anagrafiche cliente, vettore e rimorchio utilizzate da un DDT in attesa: protette finché non parte o il documento non viene annullato. Dopo la partenza lo storico usa comunque lo snapshot originale.

Restano separate le date previste di carico/partenza del Calendario e la registrazione della partenza effettiva. Queste operazioni non riscrivono il DDT. Confermare lo stesso vettore già effettivo alla partenza non normalizza o risalva i campi documentali; cambiarlo con un DDT valido viene bloccato.

L'annullamento backend richiede operatore attivo e motivo, è transazionale e viene impedito dopo la partenza. Sblocca modifiche e riapertura; un nuovo DDT avrà un nuovo progressivo e collegherà il documento sostituito. I riferimenti storici DDT a carico/sessione restano protetti dalle FK restrittive, anche dopo annullamento: l'annullamento non elimina lo storico.

## Interfaccia e API TEST

In Carico camion, nella zona di chiusura, compare **Emetti DDT definitivo**, abilitato soltanto dopo validazione backend. La finestra spiega assegnazione di numero/data, archiviazione, blocco e assenza di partenza automatica. Dopo l'emissione mostra numero/data, avviso di blocco e **Visualizza / Ristampa DDT**. La visualizzazione passa in sola lettura. Non esiste un comando UI di annullamento del documento.

La Dashboard visualizza l'originale quando esiste un DDT valido; senza documento mantiene la visualizzazione dell'anteprima. Il pulsante esplicito Anteprima DDT in Carico camion resta distinto.

API registrate esclusivamente in TEST:

- `GET /api/loading-sessions/:id/ddt`: documento valido o disponibilità/motivo del blocco.
- `POST /api/loading-sessions/:id/ddt`: `{operatorId, requestKey}`.
- `GET /api/ddt/:id/pdf`: originale verificato, header `X-DDT-Status`.
- `POST /api/ddt/:id/cancel`: `{operatorId, reason}`; predisposta solo lato backend.

Le protezioni SQLite restituiscono HTTP 409 con `DDT_LOAD_LOCKED`. Gli endpoint esistenti mantengono anche le proprie validazioni operative. La presenza di un DDT annullato non viene considerata presenza di un DDT valido.

**Il blocco obbligatorio della partenza senza DDT valido non è stato introdotto.** Non sono cambiate le transizioni o il punto operativo di partenza nella Dashboard. Questa verifica andrà aggiunta nella fase successiva, prima della produzione, consultando esclusivamente DDT in stato EMESSO.

## Verifiche

Le emissioni di collaudo automatiche avvengono soltanto su database temporanei, con cliente/materiale fixture. Nessuna chiamata di emissione è stata effettuata sul database TEST esistente. I test coprono le tre modalità, chiusura esplicita, doppio clic/retry, concorrenza, cambio d'anno, ristampe dopo riavvio, integrità/corruzione, protezioni API/SQL/import, annullamento/riapertura, nuova emissione e partenza separata. PDF fixture verificati con PyMuPDF e ispezione visiva della pagina singola e dell'ultima pagina multipagina.

Verifiche del 17/10/2026: suite backend **225/225**, suite frontend **64/64**, TypeScript backend/frontend e `git diff --check` superati. PDF di tutte e tre le modalità e documento da 80 elementi/7 pagine verificati: nessun elemento duplicato, numero definitivo presente, assenza della dicitura ANTEPRIMA, intestazioni e piè di pagina corretti. I controlli di regressione dell'anteprima restano inclusi nella suite backend.

Ripetuti dopo gli ultimi aggiornamenti i 7 test frontend pertinenti di DDT/Dashboard, incluso retry con risposta persa e mantenimento della stessa chiave: tutti superati. Le fixture PDF e le immagini di QA sono conservate in `.verification/ddt2b-final` (escluse da Git).

Riapplicazione controllata dei trigger finali: backup `backend/data/backups/pre-ddt-2b-2026-10-17T16-52-22.633Z-29b3dc9d-6854-41c9-83c5-099e53353ee5.sqlite`, SHA-256 `eb702f27bc74d0a89f7d82b935c9c24bef41f554dc9dfa7e9be4664281bb8358`; dati operativi prima/dopo invariati e ancora zero documenti sul database TEST esistente.
