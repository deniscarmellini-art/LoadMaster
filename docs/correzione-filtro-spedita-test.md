# Correzione filtro Spedita — TEST

## Causa verificata

Il filtro usa `ShipmentStatus.CONCLUSA`, non `Loads.stato=SPEDITO`. Lo stato della pianificazione è calcolato dal repository: una partenza diventa CONCLUSA, oppure IN_VIAGGIO per Bilico Essepi con assegnazione ancora in viaggio. Lo Storico legge invece LoadingSessions con stato SPEDITO e shippedAt valorizzato.

La lettura del solo database TEST, aperto con `readOnly:true` e repository `list(false)` per evitare riconciliazioni, ha identificato due esclusioni:

- Il frontend applicava il limite operativo di sette giorni prima del filtro: le 19 voci CONCLUSA già restituite non erano quindi selezionabili. Le date registrate arrivavano all'8 ottobre 2026, prima della finestra corrente del 16 ottobre.
- L'API escludeva dalla proiezione dei carichi senza piano tutti i Loads SPEDITO: nove carichi presenti nello Storico non arrivavano all'Elenco.

## Correzione

La selezione esplicita Spedita cerca fra tutte le voci ricevute, inclusi i record oltre sette giorni. La lista ordinaria conserva la finestra precedente. Ricerca, modalità, trasportatore e intervallo sulla partenza prevista continuano ad applicarsi; una spedizione senza partenza prevista non corrisponde a un intervallo su tale data. IN_VIAGGIO resta distinto da CONCLUSA e mantiene il proprio filtro.

La proiezione dei carichi senza pianificazione comprende ora anche quelli spediti. Riutilizza shippedAt e i dettagli di trasporto della sessione SPEDITO, senza creare righe ShipmentPlans, senza inventare date previste e senza duplicare i carichi già collegati a una pianificazione. Gli ID rimangono `load:<id>` e persisted rimane false. Per i piani collegati, shippedAt supplisce solo all'assenza della data effettiva del piano.

Schema, valori persistiti, contratto API, Storico, conferma partenza e controlli operativi non cambiano. Nel Calendario i carichi storici senza data prevista non generano schede pianificabili; le spedizioni già partite restano protette.

## File di questa attività

- `backend/src/repositories/shipmentRepository.ts`: inclusione della proiezione storica e data effettiva dalla sessione.
- `frontend/src/pages/Shipments.tsx`: applicazione del filtro Spedita prima dell'esclusione temporale operativa.
- `backend/src/shippedShipments.test.ts`: regressione su database in memoria.
- `backend/src/app.test.ts`: registrazione del nuovo test nella suite.
- `docs/correzione-filtro-spedita-test.md`: questo report.

Le modifiche delle attività precedenti sono conservate. Nessuna migration o modifica manuale ai dati TEST; nessun accesso ai dati di produzione, commit, push o deploy.

## Verifiche e risultati

- Suite backend: 178 test superati, zero errori. Comprende creazione e partenza reale su database temporaneo, persistenza, Storico e protezioni dopo partenza.
- Nuova regressione: storico senza piano, piano senza data effettiva con sessione spedita, carico SPEDITO senza data nota, IN_VIAGGIO distinto da SPEDITO operativo, PRONTA e PIANIFICATA; nessuna duplicazione e confronto delle tabelle prima/dopo la proiezione senza scritture.
- TypeScript frontend e compilazione backend verso la sola directory di test: superati. Controllo diff superato.
- Chrome isolato con componente reale e dati simulati: filtri Pianificata, Pronta, In viaggio e Spedita; partenze recenti, oltre sette giorni e senza data; finestra ordinaria preservata; Calendario senza piano fittizio e nessuna chiamata di scrittura.
- Chrome isolato su snapshot in sola lettura del TEST: tutte le 28 voci CONCLUSA visualizzate da Spedita, comprese nove senza piano. I 27 carichi SPEDITO risultano rappresentati una sola volta; l'ulteriore voce è una pianificazione manuale conclusa.

Evidenze ignorate da Git in `.verification/shipped-filter/` e fixture in `frontend/.verification/`. Le verifiche browser non usano servizi reali né scrivono nel database.
