# SISLOG — Indirizzo di consegna nella pianificazione

15 ottobre 2026. Implementazione e verifiche in TEST, senza commit, push o deploy.

## Modifica

Il dialogo Pianifica spedizione / Modifica pianificazione include il campo facoltativo multilinea **Indirizzo di consegna** subito dopo Riferimento ordine e prima di Carico / Camion. Usa lo stesso TextField degli altri campi, con almeno due righe e altezza adattabile. Il valore viene caricato nella riapertura, modificato e salvato; una nuova pianificazione parte con indirizzo vuoto.

La proprietà API `deliveryAddress` è distinta da `cliente` e `orderReference`. Il backend conserva le righe interne e rimuove soltanto gli spazi iniziali/finali; un valore vuoto o null viene memorizzato come NULL. Quando un client precedente omette il campo durante una modifica, il valore già salvato viene conservato. La riprogrammazione della sola data non lo altera.

## Database e flusso dati

Migration incrementale e idempotente: `ALTER TABLE ShipmentPlans ADD COLUMN deliveryAddress TEXT NULL`, eseguita dentro una transazione e soltanto se la colonna non esiste. Nessun riempimento automatico dai nomi cliente o dai riferimenti ordine; le pianificazioni precedenti hanno indirizzo NULL.

ShipmentPlans è l'unica fonte del nuovo dato. Il collegamento manuale/automatico tramite loadId e la conclusione della spedizione mantengono la stessa pianificazione: non occorrono colonne duplicate in Loads o LoadingSessions. Il dato resta nel database anche quando la spedizione conclusa esce dalla vista operativa e potrà essere letto dal piano associato per il futuro DDT. Non sono stati aggiunti generazione, stampa, numerazione o altri flussi DDT.

Rimane il blocco esistente alla modifica delle pianificazioni dopo la partenza: l'indirizzo storico non viene riscritto. Le pianificazioni già salvate e ancora modificabili possono invece ricevere o cambiare indirizzo normalmente.

La migration è stata verificata su un backup SQLite isolato del database TEST con 28 pianificazioni: eseguita due volte, nessuna colonna duplicata, tutti i valori preesistenti conservati, nuovi indirizzi NULL. Gli scenari di scrittura sono confinati alle copie isolate e ai database temporanei dei test; nessuna modifica al database di produzione. Il database TEST operativo non è stato sostituito né aggiornato manualmente: il normale avvio del backend TEST dai sorgenti applicherà la migration al proprio database. Nessuna modifica ai dist operativi.

## File

Modificati:
- `frontend/src/pages/Shipments.tsx`: campo nel dialogo e caricamento/reset del form.
- `frontend/src/services/shipmentsApi.ts`: proprietà opzionale nei tipi frontend e payload.
- `backend/src/repositories/shipmentRepository.ts`: tipo del piano, INSERT, UPDATE e lettura del valore.
- `backend/src/routes/shipmentRoutes.ts`: ammissione del campo nullable nelle API create/update.
- `backend/src/database/sqliteDatabase.ts`: registrazione della migration.
- `backend/src/app.test.ts`: inclusione dei nuovi test nella suite ordinaria.

Aggiunti:
- `backend/src/database/shipmentDeliveryAddressMigration.ts`.
- `backend/src/shipmentDeliveryAddress.test.ts`.
- `docs/indirizzo-consegna-pianificazione-test.md`: questo report.

Il report diagnostico QR preesistente è rimasto invariato. Nessuna modifica ai sorgenti di Carico camion, scansione QR, importazione o DDT.

## Risultati

- Compilazione TypeScript backend e controllo TypeScript frontend: superati.
- Suite backend completa: **164/164 superati**, inclusi i tre nuovi gruppi di test.
- Migration: database legacy nullable, nessuna inferenza dal cliente, idempotenza e conservazione del valore dopo una seconda esecuzione.
- API: creazione senza indirizzo, creazione con indirizzo multilinea, modifica, riapertura tramite GET, omissione da client legacy, cancellazione esplicita, whitespace e rifiuto di oggetti non validi.
- Flusso reale su database temporaneo: piano manuale con indirizzo → import e collegamento automatico al carico → preparazione elemento → sessione di carico → registrazione carico → partenza → chiusura/riavvio backend. Indirizzo invariato, stato CONCLUSA e data effettiva presenti; tentativo di riscrittura dopo partenza respinto con 409.
- UI Chrome: posizione corretta del campo, textarea facoltativa, creazione con/senza indirizzo, salvataggio, modifica e riapertura, nuovo form senza residui e valori API separati dal cliente.
- Desktop 1200×900 e mobile 390×844: controllo screenshot, nessun overflow orizzontale del dialogo.
- `git diff --check`: superato. Nessuna build o pubblicazione di produzione.

Evidenze locali ignorate da Git: `.verification/delivery-address/migration-report.json`, `ui-report.json`, screenshot desktop/mobile e script di test. I server diagnostici isolati vengono arrestati automaticamente alla fine della verifica.
