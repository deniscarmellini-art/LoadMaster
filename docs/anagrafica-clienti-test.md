# Anagrafiche Clienti e importazione Excel — TEST

Verifiche concluse il 16 ottobre 2026. Nessun commit, push o deploy; produzione non modificata.

## Analisi del modello precedente

Non esisteva una tabella anagrafica clienti compatibile. `ClientVehicleTypes` contiene le tipologie di mezzo, non clienti.

L'importazione commesse esistente legge il nome cliente dal tracciato Excel e lo conserva in `Loads.cliente`; `Loads.numeroCliente` e `Panels.numeroCliente` appartengono al tracciato operativo e non sono ID dell'anagrafica fiscale. Le pianificazioni collegate usano il cliente testuale del carico; quelle manuali conservano `ShipmentPlans.manualCliente`. Lo storico continua a usare questi dati.

Non è stato modificato questo importatore, né è stata tentata una corrispondenza automatica fra nomi, codici importati e nuovi clienti.

## Backup e migrazione

Prima di modificare lo schema è stato eseguito un backup online, aprendo soltanto il database TEST in lettura:

`.verification/customers/test-before-customers-1792069399305.sqlite`

`migrateCustomers` crea `Customers` e aggiunge a `ShipmentPlans` il campo nullable `customerId`, con chiave esterna verso `Customers.id` e `ON DELETE RESTRICT`. È presente un indice sul collegamento. La migrazione è transazionale e idempotente; non popola clienti o collegamenti.

Schema `Customers`:

| Campo | Tipo e funzione |
| --- | --- |
| `id` | TEXT, chiave primaria, UUID generato dal backend |
| `denominazione` | TEXT obbligatorio |
| `via`, `nazione`, `cap`, `luogo` | TEXT, facoltativi |
| `telefono`, `nomeContatto`, `cellulare`, `email` | TEXT, facoltativi |
| `partitaIva`, `codiceFiscale` | TEXT, facoltativi |
| `createdAt`, `updatedAt` | TEXT, timestamp tecnici |

CAP, telefoni e identificativi fiscali non vengono convertiti in numeri. Le API rifiutano valori numerici prima della coercizione automatica dello schema. Sono mantenuti zeri iniziali e formattazione interna del testo. Le email possono essere singole, multiple separate da spazi/virgole/punto e virgola, oppure nel formato `Nome <indirizzo>`; il testo originale non viene riscritto.

Il server TEST con watch ha applicato la migrazione al database TEST. Non sono state modificate le definizioni o le relazioni di Carriers, Trailers, Loads, LoadingSessions e TransportAssignments.

## Interfaccia

La voce di navigazione e il titolo «Impostazioni» diventano «Anagrafiche», mantenendo l'identificativo interno della pagina e tutte le sezioni precedenti. La nuova scheda Clienti permette ricerca, creazione, consultazione completa e modifica. Le modifiche usano `expectedUpdatedAt` per evitare di sovrascrivere dati modificati da un'altra postazione.

L'elenco e l'anteprima sono paginati. Nelle finestre la disposizione passa a una colonna su schermi piccoli. Errori di validazione o duplicato mantengono aperta la scheda.

Nella pianificazione è disponibile il collegamento cliente facoltativo per il futuro DDT. Selezionarlo non modifica né il nome cliente testuale né l'indirizzo di consegna. L'ID rimane associato dopo collegamento al carico, cambio data e conclusione della spedizione. Restano in vigore i blocchi esistenti sulle spedizioni consolidate.

## Importazione

L'importatore riutilizza la dipendenza `xlsx` già installata. Nessuna dipendenza aggiunta.

1. Selezione di un `.xlsx`, massimo 10 MB.
2. Riconoscimento delle undici intestazioni, anche riordinate e con differenze di maiuscole/spazi, nei primi 30 record del foglio.
3. Lettura dei valori formattati, compresi gli zeri memorizzati nei formati numerici. Formule, errori Excel, numeri non affidabili e righe senza denominazione vengono segnalati; non vengono valutate formule.
4. Anteprima server senza scritture: nuovi, invariati, aggiornamenti da confermare, possibili duplicati, ambigui, duplicati nel file e non validi.
5. Le differenze mostrano anche il valore precedente. Ogni aggiornamento deve essere selezionato singolarmente; nessuno è preselezionato. I campi vuoti possono cancellare il valore esistente solo nell'aggiornamento esplicitamente selezionato, come indicato nell'anteprima.
6. «Conferma importazione» scrive in un'unica transazione. Un'anagrafica modificata dopo l'anteprima invalida la conferma: occorre ricalcolarla. Un errore durante la scrittura annulla l'intero batch.
7. Report di inserimenti, aggiornamenti, invariati e scarti, con esito per riga e download JSON.

La partita IVA e il codice fiscale sono confrontati senza differenze di maiuscole o separatori. Identificativi che indicano clienti diversi, identificativi fiscali discordanti e record differenti con la stessa identità nel file non vengono sovrascritti. Un nome coincidente senza identificazione fiscale certa richiede revisione manuale. La denominazione viene confrontata ignorando maiuscole e spazi consecutivi.

La creazione e la modifica manuale verificano le identità nella stessa transazione della scrittura, anche fra connessioni diverse. Non esiste un endpoint di cancellazione clienti.

La conferma ripetuta della stessa anteprima restituisce il report già prodotto. Rileggere lo stesso file riconosce i dati già presenti e non genera nuovi duplicati. Anteprime e report di conferma sono mantenuti in memoria per 15 minuti; al riavvio occorre rileggere il file. I clienti salvati rimangono nel database.

## Verifica del file reale

File letto senza modificarlo: `C:/Users/denis.carmellini/Downloads/Anagrafica Clienti Xlam.xlsx`.

SHA-256: `6c95c7fb57b034245088c1e07ee34fea3664175e2abe88c4f5691593317ee33d`.

Foglio `Foglio1`, intestazioni alla riga 1, **488 righe cliente**. Sono utilizzate soltanto le undici colonne richieste, senza attribuire significati ai dati extra non intestati.

L'anteprima definitiva su un database temporaneo vuoto produce:

- **472 nuovi candidati**;
- **6 ambigui**, righe Excel 8, 131, 209, 213, 268, 271;
- **10 non validi**: 33 e 100 per valori numerici potenzialmente alterati; 64, 105, 173, 244, 256, 257, 258, 266 per email incomplete o malformate;
- **487 righe con avvisi di origine numerica** su almeno un campo sensibile. Non significa che tutti i valori siano errati: gli zeri già assenti nel file non possono essere recuperati con certezza e non sono inventati.

Il file reale è stato sottoposto dalle verifiche automatizzate soltanto ad anteprima, senza conferma sul database TEST in uso. Durante la lavorazione sono risultati presenti **471 clienti** in quel database, conservati integralmente. Il confronto finale in sola lettura con il file restituisce **469 invariati, 3 nuovi candidati, 6 ambigui e 10 non validi**. Due righe già presenti risultano ora segnalate dai controlli email più completi e non vengono corrette o cancellate automaticamente. Nessuna spedizione risulta collegata automaticamente.

## Test

- **177 test backend superati, 0 fallimenti**, compresa la suite preesistente di importazione commesse, scansioni, pacchi, carichi, spedizioni, rimorchi e storico.
- Nuovi test: migrazione/idempotenza; campo stringa e zeri; email singole/multiple; creazione/modifica; duplicati fiscali e denominazione; modifica concorrente; anteprima senza scritture; conferma obbligatoria; selezione esplicita degli aggiornamenti; scarti; doppia conferma; file ripetuto; conflitti di identità; modifiche da seconda connessione; rollback dell'intero batch; creazione concorrente; collegamento spedizione, conservazione dopo partenza e riavvio; chiave esterna e separazione degli indirizzi.
- **3 test parser Excel superati**: intestazioni riordinate/case insensitive, formati con zeri, telefoni e identificativi testuali, intestazioni mancanti/duplicate/ambigue, righe vuote/incomplete, formule e precisione numerica.
- Browser Chrome con API reali e database temporaneo: navigazione Anagrafiche/Clienti; undici campi; creazione, modifica, ricerca e scheda; upload XLSX; anteprima senza scritture; checkbox aggiornamento; report; ripetizione senza duplicati; collegamento e riapertura della spedizione con cliente storico e indirizzo di consegna invariati; errore duplicato; layout mobile e pulsanti visibili. Superato.
- Migrazione ripetuta su copia del backup TEST: **tutte le 19 tabelle preesistenti identiche**, nessun cliente generato, nessun collegamento automatico e nessuna violazione di chiave esterna.
- Il TEST in uso ha ricevuto attività concorrente: il confronto successivo rileva solo aggiornamenti del timestamp `updatedAt` su una sessione di carico e un'assegnazione; nessun ripristino o annullamento di queste modifiche.
- TypeScript frontend/backend e `git diff --check`: superati.

Log, fixture, anteprime e copie SQLite sono nella directory ignorata `.verification/customers`, non nei file applicativi. Le prove di conferma importazione e salvataggio clienti usano soltanto database temporanei.

## File di questa attività

Backend:

- `src/database/customerMigration.ts` — nuovo schema e collegamento nullable.
- `src/database/sqliteDatabase.ts` — registrazione migrazione.
- `src/models/customer.ts` — modello e stati importazione.
- `src/repositories/customerRepository.ts` — persistenza, identificazione, concorrenza, anteprima/conferma/report.
- `src/routes/customerRoutes.ts`, `src/app.ts` — API clienti e importazione.
- `src/repositories/shipmentRepository.ts`, `src/routes/shipmentRoutes.ts`, `src/services/shipmentService.ts` — collegamento cliente, validazione e conservazione.
- `src/customers.test.ts`, `src/app.test.ts` — nuovi test e registrazione nella suite.

Frontend:

- `src/models/Customer.ts`, `src/services/customersApi.ts` — modello condiviso nell'interfaccia e client API.
- `src/services/customerExcelImport.ts` — parser Excel indipendente dall'importazione commesse.
- `src/pages/Customers.tsx` — gestione schede e flusso importazione.
- `src/pages/Settings.tsx` — scheda Clienti, conservando le sezioni esistenti.
- `src/components/navigation/PrimaryNavigation.tsx`, `src/components/layout/SectionTitle.tsx` — etichetta Anagrafiche.
- `src/components/shipments/ShipmentCustomerPicker.tsx`, `src/pages/Shipments.tsx`, `src/services/shipmentsApi.ts` — collegamento cliente nella pianificazione.
- `scripts/customer-excel-import.test.mjs` — test del parser.
- Questo report.

Le modifiche precedenti nel workspace sono state conservate. Nessuna modifica all'importatore commesse, alle logiche operative o ai file compilati di produzione.

## Prima della produzione

- Verificare i sei casi ambigui e correggere i dieci record non validi; verificare gli zeri iniziali con la fonte anagrafica autorevole. Non basta convertire a testo un valore già arrotondato o privo di zeri.
- Definire la gestione di omonimi, sedi e identificativi discordanti: attualmente i casi non certi richiedono revisione manuale e non vengono uniti automaticamente.
- Verificare i limiti concordati: 10 MB, 10.000 righe, un solo foglio/blocco di intestazioni compatibile per file. In presenza di più elenchi il file è rifiutato con messaggio esplicito.
- Il collegamento cliente rispetta i blocchi delle pianificazioni consolidate. Un eventuale collegamento successivo alla partenza richiederà un flusso dedicato; i controlli esistenti non sono stati aggirati.
- La stampa DDT non è implementata. In quella fase occorrerà definire e salvare lo snapshot dei dati fiscali e degli indirizzi usati nel documento, separato dalla scheda cliente modificabile e dall'indirizzo di consegna.
- Prima di qualsiasi futura applicazione in produzione serviranno un backup del database di destinazione e una verifica dedicata della migrazione. Il backup TEST iniziale precede i clienti aggiunti durante la lavorazione e non va ripristinato alla cieca, perdendo tali dati.
