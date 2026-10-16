# SISLOG — Spedizioni / Elenco informativo

15 ottobre 2026. Modifica verificata esclusivamente in ambiente TEST isolato. Nessun commit, push, build o deploy di produzione. Nessuna modifica al database o al backend in questa attività.

## Interfaccia

Elenco è una tabella informativa, anche su mobile, con queste dieci colonne: Commessa; Cliente; Carico / Camion; Partenza prevista; Stato operativo carico; Modalità di trasporto; Ritiro / Consegna; Targa bilico; Indirizzo di consegna; Note.

Eliminate le colonne Azioni, Stato spedizione, Data partenza effettiva e Dettaglio / Mezzo. Nessuna azione di modifica/conferma nelle righe o click di riga. Le intestazioni ordinabili restano interattive per il solo ordinamento.

Tabella con larghezza minima 1700 px e scorrimento orizzontale interno; testi con spazio minimo e indirizzo/note multilinea, senza ellissi che ne nascondano il contenuto. Ordinamento iniziale per partenza prevista crescente; date mancanti in fondo anche quando si inverte l'ordinamento. Ricerca Commessa/Cliente/Camion, filtro Stato spedizione, Modalità e intervallo date conservati. La modalità visualizzata e il relativo filtro usano il dato effettivo del carico, se disponibile, altrimenti quello pianificato. KPI e regola preesistente di permanenza delle spedizioni concluse nella vista operativa restano invariati.

## Fonti delle nuove colonne

- Ritiro / Consegna: Ritira Cliente mostra `ShipmentItem.cliente`; Bilico Essepi e Terzi per Essepi mostrano soltanto il nome di un trasportatore identificato nell'anagrafica già caricata. Il trasportatore effettivo della sessione collegata al loadId precede quello della pianificazione; per Bilico, in assenza del dato effettivo, sono usati carrierId, plannedCarrierId o transportDetailId del piano. Un ID sconosciuto resta senza nominativo.
- Terzi per Essepi: transportDetailLabel può essere un tipo di mezzo, non un nominativo. Non viene trasformato in nome di trasportatore. Senza un carrierId effettivamente disponibile e riconosciuto compare “—”. Non è stata aggiunta alcuna nuova anagrafica.
- Targa bilico: assegnazione esistente da `transports`, associata al loadId; per prenotazioni manuali, commessa e camion normalizzati devono corrispondere. Sono ammesse assegnazioni IMPEGNATO/CARICATO/IN_VIAGGIO. In assenza della riga di assegnazione, un trailerId già risolto dal piano/sessione può essere letto nell'anagrafica mezzi. Assegnazioni multiple ambigue, rilasciate o spostate su un altro carico/commessa non vengono presentate come attuali. Per modalità diverse da Bilico la colonna resta “—”.
- Indirizzo: `ShipmentItem.deliveryAddress`, già implementato nella pianificazione. Nessuna duplicazione in altri modelli.
- Note: `ShipmentItem.notes`, senza perdita delle righe interne.

Campi vuoti, null, undefined o solo spazi diventano “—”. Nessun nominativo o targa inventati. Il componente riceve da App le sessioni di carico già presenti nello stato, senza nuove chiamate API.

## Azioni dal Calendario

Il Calendario rimane l'unico accesso a creazione e modifica. Il dialogo già aperto dalle schede conserva Salva, Annulla e Elimina spedizione; ora espone anche Conferma partenza per le spedizioni pronte e Collega quando esiste un carico compatibile, usando i medesimi handler e API precedenti. Se il form è stato modificato, partenza/collegamento richiedono prima il salvataggio, evitando di agire su valori precedenti non più visibili.

Le pianificazioni senza data e quelle di domenica, non collocabili nelle sei colonne operative del Calendario, hanno accessi dedicati sopra la griglia. Anche i carichi virtuali senza pianificazione restano apribili per pianificarli. Le pianificazioni datate fuori dal mese corrente sono raggiungibili con la navigazione mensile esistente. Drag, riprogrammazione e blocchi sulle spedizioni già partite non sono modificati; il file ShipmentCalendar.tsx è invariato.

Nessun cambiamento alle regole di carico, trasporto, collegamento o partenza. Dopo collegamento/partenza riusciti viene chiuso il dialogo di pianificazione ora usato come punto d'accesso all'azione.

## File di questa attività

Modificati:
- `frontend/src/pages/Shipments.tsx`: tabella, filtri/ordinamento, dati presentati e accessibilità delle azioni dal Calendario. Le modifiche precedenti al campo indirizzo sono conservate.
- `frontend/src/App.tsx`: passa le sessioni `truckLoads` già disponibili a Shipments.

Aggiunti:
- `frontend/src/services/shipmentListPresentation.ts`: risoluzione di nominativi/targhe, modalità effettiva e segnaposto.
- `frontend/scripts/shipment-list-presentation.test.mjs`: otto test della presentazione dati.
- `docs/spedizioni-elenco-informativo-test.md`: questo report.

Gli altri file backend/frontend e report già modificati/non tracciati all'inizio, relativi all'indirizzo e alla diagnostica precedente, non sono stati alterati da questa attività. Copie prima dell'intervento: `.verification/shipments-list/Shipments.tsx.before` e `App.tsx.before`.

## Verifiche

- TypeScript frontend e controllo diff: superati.
- Otto test di presentazione superati: tre modalità; nome cliente separato dal tipo mezzo; precedenza del trasportatore effettivo anche per sessioni legacy; targa disponibile/assente; prenotazione manuale normalizzata; ambiguità; ID sconosciuti; mezzi rilasciati/riassegnati; indirizzi/note multilinea e segnaposto.
- Chrome headless con il componente reale: dieci intestazioni esatte; assenza di pulsanti nelle righe desktop e mobile; valori delle tre modalità; ordinamento crescente iniziale e inversione; ricerca cliente; filtri stato/modalità; intervallo date; scorrimento orizzontale.
- Calendario: apertura/modifica e Salva, creazione con indirizzo, eliminazione, collegamento, conferma partenza e accesso ai casi senza data/domenica. Verificate le richieste POST/PUT/PATCH/DELETE degli handler esistenti e il blocco della partenza con modifiche non salvate.
- Screenshot desktop 1200×900 e mobile 390×844 ispezionati.

Le verifiche UI usano dati dichiaratamente fittizi e API simulate nella sola fixture locale: non sono stati inviati esempi ai servizi o database SISLOG. Gli otto test usano oggetti in memoria. Nessuna lettura/scrittura di database in questa attività e nessuna nuova migration; i test backend reali dell'indirizzo erano già stati eseguiti nell'attività precedente. Server diagnostico arrestato automaticamente.

Evidenze locali ignorate da Git: `.verification/shipments-list/ui-report.json`, `list-desktop.png`, `list-mobile.png`, fixture e script di verifica. Comando test unitari: `node --import ./backend/node_modules/tsx/dist/loader.mjs --test frontend/scripts/shipment-list-presentation.test.mjs`.
