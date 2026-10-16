# SISLOG — Diagnostica prestazioni QR

Data: 14 ottobre 2026. Revisione analizzata: `35cf4269`. Stato Git iniziale pulito.

## Esito

La differenza è nel percorso di registrazione, non in un ritardo configurato per il lettore. Scansione attende due PATCH sequenziali, poi cinque GET globali e il relativo aggiornamento React prima di riabilitare il campo. Carico camion esegue un POST e aggiorna lo stato locale dopo la risposta; il campo rimane abilitato durante la richiesta.

Questa è una causa strutturale verificata nel codice e riprodotta dalle misure backend. Non è stata misurata la latenza end-to-end del lettore fisico Inateck: non si può attribuire un tempo assoluto al dispositivo, alla rete o al rendering del browser senza una sessione sul dispositivo usato dall'operatore.

La modifica precedente di riconoscimento automatico commessa non è presente in questo checkout: non ci sono FirstScan/resolveScanningQr né il GET preventivo di riconoscimento. Non è stata ripristinata o reintrodotta.

## Ricezione, attese e richieste

Entrambe le pagine usano `frontend/src/components/scanning/ScannerInput.tsx:22`: QR completo inviato subito su Enter (`:38`), nessun debounce, attesa di silenzio fra caratteri o timeout di acquisizione. Entrambe usano parsePanelQr. In Scansione parseOperationalQr viene eseguito prima del parser elemento, senza attese.

`frontend/src/services/apiClient.ts:44` invia fetch immediatamente e attende anche response.json prima di risolvere la Promise. Non introduce retry o ritardi artificiali.

| Percorso normale | Chiamate per elemento riuscito | Attesa sul campo |
| --- | --- | --- |
| Scansione, nuovo singolo | PATCH /panels/:id/scan → PATCH /panels/:id/close-single → 5 GET | Campo disabilitato fino a registrazione e refresh completati |
| Scansione, recupero singolo acquisito ma non chiuso | PATCH close-single → 5 GET | Stessa attesa del refresh |
| Scansione, primo elemento pacco | POST /packages → 5 GET | Stessa attesa del refresh |
| Scansione, elemento in pacco esistente | POST /packages/:id/panels → 5 GET | Stessa attesa del refresh |
| Carico camion, singolo o pacco | POST /loading-sessions/:id/units | Nessun blocco per la richiesta unità; esito dopo risposta backend |

Sono conteggi del percorso principale: escludono errori, avvio sessione, impostazioni, polling e finestre di conferma. Un refresh già in corso viene condiviso tramite scanningRefreshRef: non sempre si vedono cinque nuove GET attribuibili alla stessa lettura.

Evidenze: `PanelScanning.tsx:52-64`, `:90-91`, `:114`, `:133`; `TruckLoading.tsx:89`, `:97`, `:99`; `scanningApi.ts`, `loadingApi.ts:12`.

Il setTimeout di 200 ms in `TruckLoading.tsx:76-84` raggruppa il salvataggio di operatore/destinazione. Non viene avviato per ogni QR se tali impostazioni non cambiano. Può bloccare la disponibilità iniziale mentre saving è attivo, ma non spiega la lentezza ordinaria di Scansione.

## Refresh completo e SQL

`App.tsx:145-177` usa Promise.all su /loads, /warehouse, /loading-sessions, /transports e /shipments; sostituisce commesse, singoli, pacchi, pacchi sospesi, bozze, sessioni, trasporti e spedizioni. `PanelScanning` attende questo refresh prima del messaggio di successo. I callback onCloseSingle e onClosePackage passati da App sono vuoti: la pagina dipende dal refresh per riallineare lo stato.

`App.tsx:711` applica invece la risposta del carico agli elementi/pacchi interessati tramite onScanUnit. Il submit di TruckLoading non attende onRefresh. Il polling globale resta attivo: 10 secondi in Scansione, 7,5 in Carico camion, oltre a ingresso pagina, focus finestra e ritorno visibile (`App.tsx:194`, `hooks/useAutoRefresh.ts`). Gli intervalli non sono pause imposte a ogni QR. Possono però sovrapporre lavoro globale alla registrazione.

I cinque GET vengono lanciati in parallelo dal browser; il backend usa DatabaseSync, quindi query, costruzione risposte e parte dei ricalcoli occupano sincronicamente lo stesso event loop. Promise.all non rende parallele le esecuzioni SQLite. Il refresh finisce quando sono risolte tutte le richieste, inclusi trasferimento, parsing e conversioni dei dati. La somma dei tempi inject del benchmark descrive lavoro server, non la formula esatta della latenza di rete.

SQL della registrazione:

- scan: verifica pannello, UPDATE dei metadati di acquisizione, INSERT PANEL_SCANNED, rilettura pannello, transazione BEGIN IMMEDIATE/COMMIT.
- close-single: nuova verifica, UPDATE a DISPONIBILE, INSERT SINGLE_CLOSED, ricalcolo stato carico/sessione, rilettura, seconda transazione.
- pacco: verifiche del pacco attivo e dell'appartenenza, UPDATE pannello, ricalcolo quantità/peso/volume con aggregazioni, eventi e ricalcolo stato; primo elemento include creazione pacco.
- carico: verifica sessione e unità disponibile/appartenenza, INSERT LoadingUnits, UPDATE pannello o pacco e figli, evento UNIT_LOADED, ricalcoli e risposta con sessione/unità/eventi. Il backend non è privo di controlli o ricalcoli: evita soprattutto le GET globali dopo ogni elemento.

`ScanningRepository.transaction:16` e `LoadingRepository.transaction:23` chiamano entrambi trackMaterialAvailability. `repositories/materialAvailability.ts:26-46,83-89` legge tutti i carichi e tutti i pannelli e costruisce JSON/hash prima e dopo ogni transazione, anche quando cambia un solo elemento. Due transazioni del singolo comportano quattro snapshot globali; il POST di carico ne comporta due. Il numero di query qui è piccolo, ma le righe elaborate crescono con l'intero archivio. Il costo include raggruppamento, JSON.stringify e SHA-256 in JavaScript.

SQL del refresh:

- /loads: reconcileAllOperationalLoadStatuses, elenco carichi, pannelli e tre letture di disponibilità materiale per ogni carico (`LoadRepository:86,126,131`; `materialAvailability:141`).
- /warehouse: singoli globali, elenco pacchi e una query dei figli per ogni pacco (`ScanningRepository:28-29,41`).
- /loading-sessions: nuovo reconcileAll, sessioni, unità/eventi/metriche e derivazione stato per sessione (`LoadingRepository:25,35-36`).
- /shipments: ulteriore reconcileAll (`ShipmentRepository:58-59`).

Quindi alcune GET di sola consultazione eseguono anche UPDATE di riconciliazione. Per questo la diagnostica non le ha invocate sul database operativo: le ha eseguite soltanto sulla copia.

EXPLAIN QUERY PLAN sulla copia conferma `SCAN u` nel conteggio correlato delle LoadingUnits e `SCAN OperationalEvents` più ordinamento temporaneo nella lettura eventi per loadingSessionId. Panels per loadId usa già un indice: non è corretto proporre genericamente di aggiungere un altro indice a Panels.

## Misure eseguite

Backup SQLite online dal solo `sistema-logistico-test.sqlite`, aperto in sola lettura, verso `.verification/qr-performance/isolated-*.sqlite`. App Fastify con environment=test caricata direttamente dai sorgenti, senza ascolto su porte. Solo sulla copia sono stati importati 70 pannelli fittizi e creati scansioni, pacco e sessione di prova.

Archivio di partenza: 48 carichi, 1.277 pannelli, 76 pacchi e 35 sessioni. Alla misura si aggiungono un carico, 70 pannelli, una sessione e, per il test pacco, un pacco. Riscaldamento delle GET prima delle misure. Dieci campioni per API singolo/carico/refresh; un campione creazione pacco e nove aggiunte. Strumentazione delle esecuzioni SQL e prepare attiva solo nel processo diagnostico: i tempi includono questo overhead e non costituiscono una garanzia SLA.

| API | Media ms | Mediana ms | Esecuzioni SQL/campione | JSON medio |
| --- | ---: | ---: | ---: | ---: |
| PATCH scan | 23,19 | 22,44 | 10 | 550 B |
| PATCH close-single | 24,10 | 24,88 | 18 | 553 B |
| GET loads | 52,70 | 51,93 | 569 | 947.489 B |
| GET warehouse | 13,68 | 13,80 | 78 | 694.449 B |
| GET loading-sessions | 61,69 | 61,53 | 649 | 264.319 B |
| GET transports | 1,84 | 1,82 | 11 | 5.589 B |
| GET shipments | 31,74 | 31,15 | 374 | 29.107 B |
| POST creazione pacco | 27,84 | 27,84 | 31 | 1.202 B |
| POST aggiunta al pacco | 22,29 | 22,24 | 27 | 4.193 B |
| POST carico unità | 28,63 | 28,69 | 50 | 3.358 B |

Le esecuzioni SQL contano all/get/run; BEGIN/COMMIT e tempi prepare sono rilevati separatamente nel JSON. Non equivalgono a righe scritte: comprendono SELECT e UPDATE di riconciliazione anche senza cambiamenti effettivi.

Totali indicativi per un nuovo singolo: circa 47,29 ms per registrazione e 161,66 ms di lavoro server per refresh, circa 208,95 ms complessivi contro 28,63 ms del carico, prima di rete e React. Le cinque GET generano 1.681 esecuzioni SQL e circa 1,94 MB di JSON non compresso; con la registrazione si arriva a 1.709 esecuzioni. Il rapporto di lavoro server è circa 7,3:1 in questo campione, non una misura della velocità percepita del lettore. Il refresh rappresenta circa il 77% del lavoro server misurato di Scansione.

Risultati dettagliati: `.verification/qr-performance/backend-measurements.json`, piani in `query-plans.json`. Script riproducibile: `node --import ./backend/node_modules/tsx/dist/loader.mjs .verification/qr-performance/benchmark.mjs`. Crea sempre una nuova copia isolata, non effettua refresh o modifiche dei database operativi.

## Focus, nuove letture e React

Scansione chiama beginInteraction sincronicamente e mantiene il ref di blocco fino al finally; nuovi submit durante l'elaborazione vengono ignorati. Il campo viene anche disabilitato. Un lettore a emulazione tastiera può quindi perdere caratteri della lettura successiva se questa parte durante il blocco. La riabilitazione arriva dopo tutte le GET. useScannerFocus avvia il tentativo sul frame successivo e attende input abilitato/overlay chiusi. I 1.000 ms sono un limite massimo di tentativo, non un ritardo fisso. Una nuova interazione keyboard/pointer invalida il token e può annullare il ripristino: causa condizionale di perdita focus da verificare col lettore, non dimostrata dal benchmark (`useScannerFocus.ts:16-45`).

Carico camion non usa managedFocus e non ha un ref/pending per la richiesta loadUnitApi. Il campo resta attivo durante la richiesta e normalmente mantiene il focus; questo contribuisce alla sensazione di continuità ma permette richieste sovrapposte. Non va copiato indiscriminatamente come ottimizzazione. I controlli backend restano determinanti. Le risposte concorrenti possono arrivare in ordine diverso: va distinto l'essere pronti a ricevere caratteri dall'avere già confermato la registrazione precedente.

Entrambe le pagine mantengono input controllati: ogni carattere aggiornando lo stato della pagina può causarne un render. In Scansione panelDetails, ricerche nei pacchi e ordinamento mobile sono ricalcolati anche mentre si digita, benché le liste non siano cambiate (`PanelScanning.tsx:94-98`); il costo può crescere con pannelli e pacchi. TruckLoading memoizza units, loaded ed elementRows (`:66-71`), pur mantenendo alcune elaborazioni e mappe nel render. Nessuna tabella è virtualizzata. Nel refresh Scansione sostituisce molti riferimenti globali e invalida memo e trasformazioni anche di dati non interessati. Sono costi supportati dal codice, ma non sono stati quantificati con React Profiler: non vanno presentati come il collo di bottiglia dominante già misurato.

## Misurazione temporanea nel browser TEST

Preparata `.verification/qr-performance/browser-probe.js`, verificata sintatticamente. Non è inserita nei sorgenti né attivata automaticamente. Incollarla nella console solo sulla pagina TEST :5174; verifica prima /api/test-environment. Non invia QR, non sostituisce fetch, non cambia stato/focus e non registra il contenuto dei QR.

Rileva in una timeline performance.now:
- QR_ENTER: ricezione del QR completo (Enter), lunghezza e repeat; non misura la decodifica hardware precedente.
- API_START e API_RESPONSE_END: tempi browser delle richieste API tramite Resource Timing.
- UI_DOM_UPDATE: osservazione di modifiche a tabelle/avvisi, non certificazione di paint né commit React esatto.
- INPUT_STATE e SCANNER_FOCUS: campo riabilitato e focus. In Carico registra anche se era già disponibile all'arrivo del QR.

Esportare con `sislogQrProbe.export()`; arrestare con `sislogQrProbe.stop()` o ricaricare. Le richieste di polling e quelle sovrapposte restano visibili, da correlare per intervallo temporale: ResourceObserver notifica dopo il trasferimento e non assegna un ID applicativo alla singola scansione. Suggerita una serie di 20 letture dello stesso tipo per pagina, separando prima lettura, sessione stabile e pacco, e una serie rapida per osservare il blocco. La probe è pronta ma non è stata eseguita sul lettore fisico; i tempi browser/UI/disponibilità non vengono inventati nel report.

## Interventi consigliati, senza implementarli

| Priorità | Intervento | Impatto atteso | Rischio |
| --- | --- | --- | --- |
| 1 | Dopo risposta riuscita aggiornare il pannello/pacco interessato e i contatori; spostare il refresh globale fuori dal percorso bloccante, mantenendo riconciliazione periodica e su errori/conflitti | Molto alto: elimina dal percorso critico le cinque GET e gran parte del traffico/render | Medio: gestire snapshot concorrenti, stato carico, singoli, bozze e pacchi; evitare che un refresh iniziato prima della scrittura sovrascriva la risposta recente |
| 2 | API atomica per acquisire e chiudere un singolo, riusando servizi/regole e mantenendo entrambi gli eventi necessari | Alto: un round-trip, un COMMIT e una coppia di snapshot manifest al posto di due | Medio: test rollback, replay/idempotenza, operatore/stati/pacco e recupero delle scansioni già acquisite; successo solo dopo COMMIT |
| 3 | Memoizzare panelDetails/ordinamenti e indicizzare in memoria identità/appartenenza pacchi; separare lo stato del campo dall'intera tabella | Medio, maggiore su liste grandi/lettori che emettono rapidamente molti caratteri | Basso-medio: dipendenze complete per evitare stati visualizzati obsoleti |
| 4 | Evitare riconciliazioni globali ripetute e risposte storiche complete nelle GET del refresh; introdurre letture mirate/delta del carico | Alto sull'intero archivio e sul polling | Medio-alto: spostare i ricalcoli nel punto corretto senza alterare transizioni, storico e visibilità multiutente |
| 5 | Limitare trackMaterialAvailability ai carichi realmente interessati, mantenendo prima/dopo e invarianti di disponibilità | Alto al crescere del database; vantaggio anche per Carico camion | Alto: import multi-camion, riassegnazioni, annullamenti, pacchi e certificazione storica richiedono copertura completa |
| 6 | Valutare indici mirati sugli eventi per sessione e sulle unità attive, guidati dai piani rilevati e da nuovi benchmark | Medio; riduce scansioni e ordinamenti durante ricalcoli/refresh | Basso-medio: nessuna modifica schema in questa fase; valutare anche costo scritture e query con OR |
| 7 | Se serve acquisizione continua, introdurre una coda esplicita di QR con elaborazione seriale, deduplicazione e stato ricevuto/in elaborazione/registrato/fallito | Alto per ritmo operativo, non riduce da solo il lavoro server | Medio-alto: ordine, cambio commessa/pacco, errori, navigazione e limiti della coda; non basta rimuovere disabled o il ref di blocco |

La combinazione consigliata inizialmente è 1 + 2, poi 3. Focus da ripristinare dopo aggiornamento confermato e input pronto, conservando le interazioni intenzionali dell'operatore. Nessun timeout arbitrario, successo anticipato, rimozione dei controlli o parallelizzazione cieca delle registrazioni.

## File e limiti della fase

Unico file versionabile aggiunto: questo report. Nessuna modifica ai sorgenti applicativi o al comportamento delle scansioni, nessuna migrazione, commit, push o deploy. Strumenti e database diagnostico sono sotto .verification, ignorata da Git. Nessun accesso al database produzione; sorgente TEST aperta in sola lettura, tutte le mutazioni confinante alla copia diagnostica. Nessun avvio/riavvio dei servizi operativi.

Per rimuovere la diagnostica basta eliminare il report e i soli file della cartella locale `.verification/qr-performance`; non c'è strumentazione attiva da togliere dall'app. Le copie isolate contengono dati TEST e restano locali. Validazioni eseguite: benchmark API/SQL completato senza errori, EXPLAIN QUERY PLAN, controllo sintassi probe e controllo diff. Non sono stati eseguiti test funzionali di scrittura sui database ufficiali.
