# Tipi di mezzo in Terzi per Essepi — TEST

## Modifica

In Impostazioni → Trasporti → Terzi per Essepi la tabella «Modalità storiche Terzi per Essepi» è sostituita da «Tipi di mezzo». Legge e modifica `settings.tipiMezzoCliente`, quindi usa gli stessi record e gli stessi ID della tabella già esistente `ClientVehicleTypes`. Aggiunta, modifica e attivazione/disattivazione operano su questa anagrafica; non aggiornano `modalitaTerziEssepi` / `ThirdPartyTransportModes`.

I nomi vengono salvati senza spazi iniziali/finali e con gli spazi interni consecutivi ridotti a uno. La chiave usata per riconoscere un duplicato ignora maiuscole/minuscole e tutti gli spazi, inclusi tab e a capo. Il controllo comprende i record disattivati ed esclude il record stesso in modifica.

La verifica avviene sia nell'interfaccia sia nelle API. Sul backend controllo e scrittura sono nella stessa transazione `BEGIN IMMEDIATE`, per evitare duplicati anche attraverso connessioni distinte. Il conflitto restituisce HTTP 409 / `DUPLICATE_VEHICLE_TYPE` con un messaggio esplicito. Non è necessaria alcuna modifica dello schema.

Il salvataggio della finestra attende l'esito prima di dichiarare il successo; in caso di errore resta aperta. I messaggi sui duplicati rimangono visibili anche quando viene effettuato un altro clic fuori dalla notifica.

## Dati e compatibilità

- Nessuna nuova tabella o migrazione; nessuna cancellazione o fusione di record.
- Anagrafica Trasportatori e assegnazioni dei rimorchi invariate.
- I 14 valori combinati storici restano nel database TEST e nelle API di compatibilità.
- In TEST sono presenti 9 tipi unici: Motrice, Ribassato, Pianale, Centinato, Bilichetto, Autotreno, Eccezionale, Ferro e Alluminio.
- Le nuove pianificazioni continuano a usare esclusivamente Trasportatore e Tipo mezzo indipendenti.
- Le tipologie disattivate non compaiono tra le scelte per una nuova pianificazione; quella già selezionata in una pianificazione salvata resta visibile come non attiva e può essere conservata.
- Nessun intervento sui dati di produzione. Le verifiche API scrivono soltanto su database temporanei; quelle grafiche usano fixture locali senza database. Il database TEST corrente è stato verificato in sola lettura: 9 tipi, 14 combinazioni storiche, 31 pianificazioni e gli stessi 3 trasportatori con i loro ID.

## File di questa attività

- `frontend/src/pages/Settings.tsx`: vista Terzi sulla stessa anagrafica dei tipi, CRUD, verifica duplicati e corretta gestione dell'esito del salvataggio.
- `frontend/src/App.tsx`: visualizzazione dell'errore specifico sui duplicati restituito dalle API, anche in caso di modifiche concorrenti.
- `backend/src/repositories/transportRegistryRepository.ts`: verifica normalizzata e transazione; applicate solo a `ClientVehicleTypes`.
- `backend/src/services/transportRegistryService.ts`: risposta di validazione per nome vuoto o duplicato.
- `backend/src/vehicleTypeRegistry.test.ts`: nuovi test API e concorrenza.
- `backend/src/app.test.ts`: registrazione dei nuovi test nella suite.
- Questo documento.

Le altre modifiche già presenti nel workspace sono state conservate. Nessun commit, push o deploy.

## Test e risultati

- TypeScript frontend e backend: superato.
- Suite backend completa: **170 test superati, 0 fallimenti**.
- Nuovi test API: aggiunta/modifica; duplicati per maiuscole e spazi, compresi record disattivati; stesso nome sullo stesso ID; nome vuoto; riattivazione; due connessioni concorrenti; persistenza dopo riavvio; selezione disattivata conservata nel piano esistente e rifiutata nel piano nuovo; nessuna variazione dei trasportatori o delle modalità storiche.
- Browser Chrome su fixture isolata: vista Terzi con 9 tipi unici, assenza della tabella delle combinazioni; aggiunta e modifica; duplicati bloccati senza salvataggio; disattivazione sulla stessa anagrafica; pianificazione storica con «Cristelli — Motrice» ancora corretta; tipo disattivato visibile ma disabilitato nel piano esistente e assente dalle scelte di un nuovo piano. Superato.
- `git diff --check`: superato.

Log e fixture di verifica in `.verification/vehicle-types`, esclusa da Git.
