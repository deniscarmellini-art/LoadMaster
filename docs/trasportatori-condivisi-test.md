# Trasportatori condivisi e tipi di mezzo — TEST

## Modello riutilizzato

- `Carriers` rimane l'unica anagrafica Trasportatori. Gli ID di Angeli e Cristelli non cambiano; restano invariati collegamenti e assegnazioni dei rimorchi.
- `ClientVehicleTypes` era già un'anagrafica indipendente. È riutilizzata, con i suoi ID esistenti, come «Tipi di mezzo», disponibile anche nella pianificazione Terzi per Essepi. Non è stata creata una seconda tabella di tipologie.
- `ShipmentPlans.plannedCarrierId` viene riutilizzato per entrambe le modalità. Solo `vehicleTypeId`, nullable e collegato a `ClientVehicleTypes`, è nuovo nella pianificazione.
- Le due selezioni sono facoltative in pianificazione e indipendenti: nessuna matrice di abbinamenti trasportatore/mezzo. Le verifiche di esistenza e attivazione rimangono; i valori disattivati già salvati possono essere conservati.
- L'Elenco filtra per l'ID del trasportatore risolto, non per una stringa combinata. Per Terzi mostra il nome dell'anagrafica quando il collegamento esiste; conserva il precedente fallback per i dati storici non risolti.

## Migrazione

`migrateSharedTransportRegistry` è transazionale e registrata una sola volta in `TransportRegistryMigrations`. Non ripopola scelte cancellate dall'utente ai riavvii successivi.

I valori di `ThirdPartyTransportModes` e i dettagli originali delle pianificazioni restano conservati. Per ogni valore combinato, il trasportatore viene riconosciuto solo quando il prefisso identifica esattamente un record esistente. Il suffisso diventa una tipologia, riutilizzando prima le tipologie esistenti con lo stesso nome normalizzato. I casi ambigui o sconosciuti restano invariati.

Su indicazione esplicita dell'utente, «Sulpizii Ferro» e «Sulpizii Alluminio» vengono separati in trasportatore Sulpizii e tipi Ferro/Alluminio. Sulpizii viene aggiunto alla stessa `Carriers` solo se assente; Angeli e Cristelli non vengono ricreati.

In TEST risultano 3 trasportatori e 9 tipologie: Pianale, Ribassato, Motrice, Autotreno, Centinato, Bilichetto, Eccezionale, Alluminio, Ferro. Le 31 pianificazioni del database TEST restano presenti. RD Chalet / 265410 ha il collegamento al Cristelli esistente e al tipo Bilichetto, conservando «Cristelli Bilichetto» come dettaglio storico.

Il backend TEST in esecuzione con watch ha applicato automaticamente la migrazione. Identità verificata su `http://127.0.0.1:3002/api/test-environment`: database `backend/data/sistema-logistico-test.sqlite`. Nessun accesso in scrittura al database di produzione, nessun deploy.

La gestione operativa dei carichi mantiene le selezioni storiche. Il resolver accetta inoltre le tipologie condivise per Terzi: serve a consentire la partenza di una sessione legacy che eredita la nuova pianificazione. Non cambia le verifiche di completezza, gli stati o le assegnazioni effettive; una sessione con modalità già definita mantiene i suoi dati effettivi.

## File di questa attività

- `backend/src/database/sharedTransportRegistryMigration.ts` — migrazione e recupero valori.
- `backend/src/database/sqliteDatabase.ts` — registrazione migrazione.
- `backend/src/repositories/shipmentRepository.ts` — persistenza, mapping e validazione.
- `backend/src/services/shipmentService.ts` — campi indipendenti e compatibilità alla partenza.
- `backend/src/routes/shipmentRoutes.ts` — campo API `vehicleTypeId`.
- `backend/src/repositories/loadingTransport.ts` — risoluzione del tipo condiviso in aggiunta ai dettagli legacy.
- `backend/src/sharedTransportRegistry.test.ts`, `backend/src/app.test.ts` — nuovi test e registrazione nella suite.
- `frontend/src/services/shipmentsApi.ts` — tipo del nuovo campo API.
- `frontend/src/pages/Settings.tsx` — etichette delle anagrafiche; modalità combinate indicate come storiche.
- `frontend/src/pages/Shipments.tsx` — due selezioni, riapertura e filtro Trasportatore.
- `frontend/src/services/shipmentListPresentation.ts`, `frontend/scripts/shipment-list-presentation.test.mjs` — identità condivisa e test.
- Questo documento.

Le modifiche precedenti relative a indirizzo, Elenco e DatePicker sono conservate. Nessun commit o push.

## Verifiche

- Controllo TypeScript frontend e backend: superato.
- Suite backend: 167 test superati, inclusi migrazione/idempotenza, ID invariati, Sulpizii unico, casi sconosciuti, validazione ID/attivazione, riapertura dopo riavvio e conservazione di trasportatore/tipo dopo partenza del carico collegato.
- Presentazione frontend: 12 test superati, incluse tutte le modalità, identità condivisa e priorità del trasporto effettivo.
- Browser Chrome, fixture isolata senza database: filtro sullo stesso trasportatore restituisce Bilico e Terzi; combinazione con filtro modalità; modifica indipendente di trasportatore/tipo, salvataggio e riapertura; aggiornamento del filtro dopo modifica. Superato.
- Migrazione su copia isolata di una precedente snapshot TEST con 32 pianificazioni (include una pianificazione fittizia del precedente test API): confronto integrale di rimorchi, assegnazioni, sessioni, eventi, carichi, pannelli e modalità combinate. Tutto invariato; record dei trasportatori preesistenti identici; dettagli originali delle pianificazioni preservati; chiavi esterne valide.
- Lettura finale del database TEST: 31 pianificazioni, Angeli/Cristelli con gli ID originali, un solo Sulpizii, 9 tipologie, nessuna violazione di chiave esterna.

Le fixture, i log e le copie SQLite di verifica sono nella directory ignorata `.verification/shared-transport-registry`; non sono file applicativi.
