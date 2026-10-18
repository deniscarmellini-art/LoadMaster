# SISLOG TEST - Partenza dalla Dashboard

La partenza effettiva si conferma soltanto da **Dashboard -> ⋮ Operazioni -> Conferma partenza**, sulla riga del carico in ATTESA_SPEDIZIONE. Il menu è disponibile su desktop e mobile.

Il menu offre Visualizza carico, Visualizza / Stampa DDT (anteprima) quando i dati necessari sono disponibili e Conferma partenza. Visualizza apre la sessione esistente in consultazione. Il doppio clic sulla riga desktop, il clic sulla scheda mobile e il pulsante principale mobile aprono il carico, senza aprire o eseguire la partenza. La riapertura esplicita già presente nel menu desktop rimane distinta.

La finestra di conferma riusa l'operazione esistente e mostra cliente, commessa, camion e modalità effettiva di trasporto. Mantiene la selezione dell'operatore e i controlli sul trasportatore quando previsti. Le sessioni sono identificate dal backendLoadId della riga, senza scegliere carichi omonimi attraverso confronti di commessa/camion. Una selezione assente o ambigua non consente la conferma.

Rimosse azione, finestra e chiamata API di partenza da Spedizioni/Calendario; restano pianificazione, collegamenti espliciti e visualizzazione degli stati. Il testo informativo in Carico camion indica la Dashboard come punto di conferma. La logica di completamento della Fase 1 non cambia.

La Dashboard continua a chiamare `departShipment` per il piano collegato oppure `shipLoadingApi` per una sessione senza piano persistito. Entrambi usano il servizio backend di partenza esistente. Nessun nuovo servizio o endpoint di spedizione. Dopo il successo viene eseguito il refresh condiviso di carichi, materiale, trasporti e pianificazioni; lo Storico legge la partenza registrata dal backend. Data e ora effettive sono quelle del server, non quelle di apertura della finestra.

## DDT

Riusato il visualizzatore dell'anteprima esistente, senza modificare PDF, numerazione, materiale o totali. Dal visualizzatore si può aprire il PDF in una nuova scheda e usare la stampa del browser. Il menu distingue esplicitamente l'anteprima dal DDT definitivo.

Un controllo TEST di sola lettura (`GET /loading-sessions/:id/ddt-preview/availability`) verifica i dati del modello dell'anteprima quando viene aperto il menu; eventuali problemi di generazione restano gestiti dal visualizzatore esistente. L'indisponibilità del DDT disabilita soltanto la relativa voce, senza bloccare Conferma partenza. Non è introdotto il requisito di emissione definitiva.

## Verifiche

Test frontend su azioni primarie, menu, DDT facoltativo, identità nella conferma per le tre modalità, identificazione tramite ID e assenza di comandi di partenza nelle altre schermate. Test backend con due istanze/connessioni: una sola partenza tra richieste concorrenti, singolo evento, timestamp coerenti per carico/Calendario/Storico e partenza possibile senza DDT. Verificata anche l'assenza di scritture nel controllo di disponibilità DDT.

Nessuna modifica ai dati TEST/DEMO esistenti: verifiche esclusivamente in memoria o su database temporanei rimossi al termine. Nessun commit, push o deploy.

Risultati: suite backend **200/200**, suite frontend **61/61**, controlli TypeScript backend/frontend e `git diff --check` superati. Confermati i test sulle tre modalità di trasporto, completamento separato, concorrenza e anteprima PDF invariata.
