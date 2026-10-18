# SISLOG TEST — Esportazione programma consegne

## Utilizzo

In **Spedizioni → Elenco**, impostare i filtri e scegliere **Esporta pianificazione**. La finestra mostra numero delle consegne e periodo; i pulsanti **Scarica PDF** e **Scarica Excel** esportano gli stessi dati. In assenza di risultati viene mostrato un messaggio, senza creare file vuoti.

La funzione è disponibile esclusivamente nel frontend TEST. Non invia email e non modifica pianificazioni, assegnazioni, carichi o DDT.

## Criteri e origine dei dati

- La lista e l'export condividono `filterShipmentList`: ricerca, modalità, trasportatore e intervallo di partenza prevista. Il filtro «Stato spedizione» è stato rimosso; la colonna «Stato operativo carico» resta visibile.
- Le date sono confrontate per giorno, includendo gli estremi. Sono supportate anche le date storiche salvate come timestamp ISO; una data con ora nell'ultimo giorno selezionato viene inclusa.
- L'Elenco esclude già le righe con partenza effettiva, stato operativo `SPEDITO`, stato spedizione `IN_VIAGGIO` o `CONCLUSA`, riutilizzando il predicato di partenza senza modificare il Calendario. Tutte le altre pianificazioni rispettose dei filtri sono visibili, senza limiti impliciti di anzianità. L'export riceve esattamente queste righe, prima dell'ordinamento a video, e conserva un ulteriore controllo di esclusione delle partenze.
- Le righe vengono ordinate per data crescente, mantenendo l'ordine relativo a parità di giorno. Senza limiti temporali le pianificazioni prive di data restano in fondo; con un intervallo sono escluse.
- Data, commessa, cliente, riferimento ordine, camion/carico, destinazione e note provengono dalla pianificazione. Modalità e tipo mezzo usano la stessa presentazione dell'Elenco, con le anagrafiche e i collegamenti già esistenti.
- Il trasportatore selezionato viene riportato in intestazione con il nome anagrafico. I dati mancanti non vengono inventati. Se il nome del trasportatore selezionato non è disponibile, occorre aggiornare l'Elenco.

La finestra di esportazione conserva una copia dei valori all'apertura: PDF ed Excel prodotti dalla stessa finestra hanno le stesse righe e lo stesso istante di generazione. Per applicare nuovi filtri, chiudere e riaprire la finestra.

## Formati

**PDF:** A4 orizzontale, intestazione V3 con logo e font del DDT, dati aziendali completi e barra verde `PROGRAMMA CONSEGNE` con numero pagina. Logo, posizione, dimensioni, font, colori e spaziature riprendono quelli del DDT; la barra si estende alla larghezza utile del foglio orizzontale. Sotto sono riportati trasportatore, periodo, data/ora in Europe/Rome e totale consegne. Otto colonne: la modalità di trasporto rimane nell'Excel ma è esclusa dal solo PDF. La larghezza del riferimento ordine si adatta entro limiti leggibili, recuperando spazio per indirizzo e note. Un indirizzo vuoto viene rappresentato come **INDIRIZZO MANCANTE** in grassetto rosso su fondo chiaro, senza modificare il modello o i dati originali. Le righe ordinarie restano unite ove possibile; una nota più lunga di una pagina prosegue sulle successive, senza troncamenti. Intestazione e titoli della tabella si ripetono su tutte le pagine.

**Excel:** un foglio con metadati, nove colonne, date Excel numeriche con formato `dd/mm/yyyy`, larghezze, altezze e filtro automatico. Indirizzi e note conservano tutto il testo. SheetJS CE non serializza l'allineamento: solo per questo nuovo export vengono aggiunti al file OOXML gli stili `wrapText`, preservando i formati numerici. `fflate`, già presente transitivamente, è dichiarato come dipendenza diretta. Testo che inizia con `=` rimane testo; oltre il limite nativo Excel di 32767 caratteri per cella si mostra un errore invece di troncare i dati.

Entrambi i formati riportano **Documento di pianificazione — non sostituisce il DDT**.

## File interessati

- `frontend/src/pages/Shipments.tsx`: filtro condiviso e inserimento della funzione nell'Elenco.
- `frontend/src/components/shipments/DeliveryProgramExport.tsx`: finestra TEST, generazione e download, caricamento/errori.
- `frontend/src/components/shipments/ShipmentCalendar.tsx` e `frontend/src/services/shipmentDeparture.ts`: estrazione del predicato di partenza senza cambiarne il comportamento.
- `frontend/src/services/shipmentListFilters.ts`: filtri condivisi e confronto delle date.
- `frontend/src/services/deliveryProgramModel.ts`: modello unico, esclusioni e ordinamento.
- `frontend/src/services/deliveryProgramPdf.ts` e `deliveryProgramExcel.ts`: generatori separati dai documenti dello Storico e dai DDT.
- `frontend/package.json`, `frontend/package-lock.json`: dipendenza diretta `fflate`.
- `frontend/scripts/delivery-program.test.mjs`: test di dati e formati.
- `scripts/check-delivery-program-files.py`: controllo dei file di prova in sola lettura e rendering PDF.

## Verifiche del 18/10/2026

```powershell
$env:DELIVERY_QA_DIR='D:\Denis\Lavoro\LoadMaster\.verification\delivery-program'
node --import ./backend/node_modules/tsx/dist/loader.mjs --test --test-concurrency=1 frontend/scripts/*.test.mjs
python scripts/check-delivery-program-files.py
npm.cmd run type-check
npm.cmd --prefix frontend run build
git diff --check
```

**83 test frontend superati**, TypeScript backend/frontend e build superati. I test specifici controllano tutti i filtri, le date inclusive, l'uguaglianza fra righe esportate e righe visualizzate al netto delle partenze, tutti gli indicatori di partenza, nessun risultato, dati mancanti, date e contenuti Excel, stili a capo, una pagina PDF e un documento di stress di 19 pagine con nota da 180 righe.

Il controllo Python verifica confini della pagina, intestazioni e piè di pagina, presenza esattamente una volta di ogni istruzione della nota lunga e validità degli stili XLSX. Le pagine campione iniziali, intermedie e finali sono state renderizzate e controllate visivamente.

La build ordinaria mantiene disabilitate le funzioni TEST, secondo la configurazione Vite già esistente; i generatori sono verificati direttamente anche tramite Vite SSR nei test. Nessun deploy è stato eseguito.

I file di prova utilizzano fixture dei test, senza scritture sul database operativo. Nessun intervento su produzione, DDT definitivi o esportazioni preesistenti dello Storico. Nessun commit o push.

## Verifica del perfezionamento PDF

Eseguiti nuovamente i quattro test pertinenti di `frontend/scripts/delivery-program.test.mjs`, compresa la regressione Excel, TypeScript backend/frontend, build frontend e `git diff --check`: tutti superati. Il PDF breve contiene un indirizzo mancante evidenziato e un riferimento lungo mantenuto su una riga. Il caso di stress aggiornato produce 27 pagine e conserva integralmente anche un riferimento eccezionalmente lungo e le 180 istruzioni della nota.

`scripts/check-delivery-program-files.py` confronta i dati aziendali con quelli del generatore DDT, controlla posizione e dimensione del logo, colore e posizione della barra, numero pagina nella barra, assenza della colonna modalità, evidenziazione dell'indirizzo mancante e presenza del testo completo. Verificati anche i rendering delle pagine iniziali e finali. Gli hash dei sorgenti di DDT, Excel, modello condiviso, filtri e predicato di partenza risultano invariati rispetto all'inizio di questo intervento.

## Correzione del caricamento PDF nel browser

Il generatore e le risorse V3 risultavano validi, ma il browser riceveva **504 Outdated Optimize Dep** per gli import versionati di `jspdf` e `jspdf-autotable`; il modulo `deliveryProgramPdf.ts`, logo e font rispondevano invece con HTTP 200. I test Vite SSR con `configFile:false` usavano la stessa cache predefinita del server interattivo, invalidandone le dipendenze ottimizzate. I soli test del renderer non intercettavano questo problema.

`frontend/vite.config.ts` assegna ora al solo server TEST la cache `frontend/node_modules/.vite-sislog-test`, separata dalla `.vite` usata dai test. Non vengono modificati il renderer, il layout, le risorse o il codice di download per aggirare l'errore.

Il nuovo `frontend/scripts/delivery-program-vite.test.mjs` verifica la separazione configurata e percorre via HTTP il controller client, il modulo dinamico PDF, le due dipendenze ottimizzate e le tre risorse V3. Dopo un caricamento SSR separato ricontrolla gli stessi URL versionati, che devono continuare a rispondere con HTTP 200. I server del test usano cache temporanee isolate, senza toccare quella del server aperto.

Collaudo effettuato anche dall'interfaccia reale su `192.168.178.150:5174`: filtro Trasporti Valmer, Esporta pianificazione, Scarica PDF. L'operatore ha confermato il dialogo nativo di salvataggio; verificato il file `C:\Users\Denis\Downloads\Programma_consegne_2026-10-18 (3).pdf` (252138 byte, una pagina), con SL-2601 e SL-2605, esclusione di SL-2604 già spedita e layout approvato conservato.

Cinque test pertinenti superati (test client HTTP e quattro test di dati/formati), TypeScript backend/frontend, build frontend e `git diff --check`. Nessuna modifica a Excel, filtri, DDT o dati operativi.

## Semplificazione Elenco e filtri

Il pulsante **Esporta pianificazione** occupa ora il sesto spazio della griglia filtri, senza una riga dedicata. Sono presenti ricerca, modalità, trasportatore e due date. La griglia usa sei colonne sui desktop larghi, tre o due a larghezze intermedie e una sugli schermi piccoli; il pulsante ha la stessa altezza dei filtri compatti. Conservata la colonna dello stato operativo.

Le esclusioni descritte sopra sono applicate direttamente nella lista condivisa dalle esportazioni. Verificati gli stati non partiti, compresa `ATTESA_SPEDIZIONE`, le partenze con e senza data effettiva, le pianificazioni vecchie o prive di data e i limiti di periodo. Superati **27 test pertinenti**, TypeScript backend/frontend e `git diff --check`. Nessuna modifica a generatori PDF/Excel, Calendario, Storico, backend o dati operativi.
