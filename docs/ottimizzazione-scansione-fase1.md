# SISLOG — Ottimizzazione Scansione, fase 1

14 ottobre 2026. Solo TEST (`VITE_SISLOG_TEST` imposto da Vite). Intervento 1 del report diagnostico; nessuna API atomica, riconoscimento automatico commessa, modifica backend/schema, Carico camion o QR offline. Nessun commit, push o deploy.

## Soluzione

Dopo ogni risposta riuscita del backend, la pagina applica il pannello o il pacco restituito allo stato locale in App. Mantiene i dati degli elementi estranei, aggiorna singoli, pacchi, bozza/ID e i contatori della pagina. Le API di creazione/aggiunta/chiusura pacco restituiscono tutti i figli, totali e dimensioni: non vengono ricostruiti da ipotesi locali. Le conversioni sono quelle già usate dallo snapshot di magazzino (`toPanel` e `toPackage`, quest'ultima ora esportata).

Per un nuovo singolo restano PATCH scan e PATCH close-single sequenziali. Sul successo vengono eliminate le cinque GET globali dal percorso della scansione. Lo stesso vale per il recupero del singolo già acquisito, la creazione/aggiunta a pacco e la chiusura pacco. Il messaggio di successo arriva solo dopo risposta positiva del backend. Operatore, appartenenza, duplicati, stati e logica di registrazione esistente sono conservati.

Una revisione locale viene invalidata all'inizio dell'interazione e quando si applica la risposta confermata. Ogni batch di refresh cattura la revisione iniziale: se è stata superata, non sovrascrive lo stato locale, neppure se la risposta viene consegnata dopo il successo della scansione. Il successivo polling/focus esegue normalmente un nuovo snapshot. Non viene avviato un refresh globale su ogni successo.

In caso di errore backend o conflitto, il recupero invalida la revisione, attende l'eventuale batch precedente e richiede un batch nuovo completo. Nel caso scan riuscita/close-single fallita, lo snapshot conserva l'acquisizione e il tentativo successivo esegue soltanto close-single. Un recupero di rete fallito resta un errore, senza dichiarare successo. QR sintatticamente invalidi e duplicati individuati localmente restano rifiutati senza registrazione, come prima.

La sincronizzazione periodica ogni 10 secondi e al focus resta attiva. Rimozione elementi, annullamento scansione, sospensione/ripresa e uscita dalla pagina mantengono il recupero completo esistente. La chiusura pacco in TEST è protetta dal ref di interazione anche contro conferme ripetute.

Il campo resta protetto durante la richiesta in corso. Il focus viene ripristinato dopo il completamento e la riabilitazione; se Enter ripetuti hanno invalidato il vecchio token mentre il campo era disabilitato e il focus è finito sul body, viene usato un token corrente. Il passaggio intenzionale ad altri controlli conserva invece la regola preesistente di cancellazione del ripristino.

## File dell'attività

Modificati:
- `frontend/src/App.tsx`: applicazione locale delle risposte, revisione dei refresh e recupero fresco; attivazione solo TEST.
- `frontend/src/pages/PanelScanning.tsx`: riuso delle risposte API, eliminazione refresh sul successo, recupero errori e focus; protezione conferma chiusura.
- `frontend/src/services/scanningApi.ts`: esportazione della conversione toPackage esistente.

Aggiunti:
- `frontend/src/services/scanningLocalState.ts`: aggiornamenti mirati e revisione snapshot.
- `frontend/scripts/scanning-local-state.test.mjs`: test delle transizioni locali e del rifiuto di snapshot obsoleti.
- `docs/ottimizzazione-scansione-fase1.md`: questo report.

Il preesistente `docs/diagnostica-prestazioni-qr.md`, già non tracciato all'inizio, è stato conservato senza modificarlo. Nessun altro sorgente è stato modificato.

## Verifiche e risultati

- TypeScript frontend e `git diff --check`: superati.
- Test stato locale: 4/4 superati, inclusi aggiornamenti per ID/commessa/camion, dati estranei conservati, replay senza duplicazioni, totali/dimensioni e revisione.
- Suite backend su database temporanei: 161/161 superati. Include stati, eventi, duplicati, rollback, pacchi, carico e importazione offline.
- Build frontend in `.verification/scanning-phase1/frontend-build`: riuscita. Soltanto avviso preesistente sulle dimensioni dei bundle. Nessuna scrittura nei dist operativi.
- Chrome headless con App reale, navigazione e input React reali: superati singoli consecutivi, nessuna GET nel percorso riuscito, duplicati, QR invalidi, letture seriali ravvicinate, Enter ripetuto senza doppia chiamata, errore parziale e recupero, retry del singolo acquisito, creazione/aggiunta/chiusura pacco, conferma chiusura doppia, contatori, rimozione/reinserimento, annullamento singolo, sospensione/ripresa e focus dopo successo/errori.
- Concorrenza: un batch delle cinque GET è stato trattenuto dopo la lettura del database e rilasciato dopo una nuova registrazione. Il pannello è rimasto disponibile: nessuna regressione causata dallo snapshot vecchio.
- Secondo client indipendente: registrazione concorrente e conflitto recuperati; modifiche visibili sia al focus sia al successivo polling reale di 10 secondi. È una simulazione di due postazioni tramite browser e client HTTP separati, non un test su due PC fisici.
- Contatori dopo i casi principali: 50 previsti, 24 disponibili, 26 mancanti e un pacco chiuso. Pacco verificato sul backend: due elementi, 100 kg, 0,2 m³ e dimensioni 1000 × 1000 × 1000 mm.

Tutti i test UI sono stati eseguiti su un backup SQLite isolato del DB TEST, aperto in sola lettura per la copia; le mutazioni riguardano solo la fixture fittizia sulla copia. I server diagnostici 5184/3199 sono stati arrestati al termine. Nessuna modifica ai database operativi TEST/produzione o ai dati ufficiali.

## Tempi prima/dopo

Confronto sullo stesso server diagnostico, Chrome headless desktop 1200 × 900, App precedente salvata prima dell'intervento e App modificata. Otto nuovi singoli per versione. Misura dal keydown Enter del QR completo al campo vuoto, abilitato e nuovamente focalizzato. Nessun ritardo artificiale nella serie di misurazione; il trattenimento delle risposte è stato usato soltanto nei successivi test di concorrenza. Nessuna esclusione di campioni.

| Misura | Prima | Dopo |
| --- | ---: | ---: |
| Media | 475,31 ms | 219,74 ms |
| Mediana | 418,00 ms | 217,80 ms |
| Minimo | 355,50 ms | 177,90 ms |
| Massimo | 714,40 ms | 280,50 ms |
| Richieste per singolo riuscito | 7 | 2 |
| GET globali richieste dal successo | 5 | 0 |

Riduzione media misurata circa 54%. Sono tempi browser su ambiente di sviluppo e rete loopback, non del lettore Inateck fisico. Non vanno confusi con i tempi solo backend del report precedente. Risultati e tracce API in `.verification/scanning-phase1/ui-report.json`; strumenti locali `server.mjs`, `check.mjs`, `reset.mjs` e fixture ignorati da Git. Il benchmark usa la stessa idea di timeline della probe diagnostica, con osservazione di abilitazione/focus e registrazione delle chiamate API.

## Limiti residui

- Restano le due richieste per il singolo e i ricalcoli SQL esistenti: la seconda ottimizzazione non è stata eseguita.
- Le API di scansione non restituiscono lo stato generale del carico/sessione. Il codice conserva quindi il loadStatus autorevole precedente fino al polling successivo; non inventa nuovi stati. Pannelli, pacchi e contatori della pagina Scansione, oggetto di questa fase, dispongono invece di tutti i dati necessari e vengono aggiornati subito.
- Uno snapshot obsoleto scartato viene recuperato al successivo polling/focus. In presenza di aggiornamenti continui, la sincronizzazione di dati estranei può essere rinviata; un conflitto backend richiede comunque un recupero completo fresco.
- Resta il blocco breve durante le API. Le letture ravvicinate sono state verificate quando il campo torna pronto, senza perdita dei QR acquisiti. Non è stata introdotta una coda per acquisire QR distinti mentre il campo è disabilitato: una trasmissione del lettore in quell'intervallo non è garantita, come nel comportamento preesistente. Gestirla richiederebbe la distinta ottimizzazione della coda, fuori dalla fase 1 richiesta.
- Nessuna misurazione hardware Inateck o su dispositivo mobile fisico; il vantaggio va confermato anche sulla postazione operativa TEST.

## Ripristino isolato

Copie originali e manifest sono in `.verification/scanning-phase1`. Da root:

`powershell.exe -NoProfile -File .verification/scanning-phase1/restore.ps1`

Lo script verifica gli hash di tutti i sei file dell'attività prima di scrivere. Se esistono modifiche successive si ferma senza alterare nulla; altrimenti ripristina solo i tre file modificati e rimuove solo i tre file nuovi. Non tocca il report diagnostico preesistente, Git, database o altre funzionalità. Conservare la cartella locale ignorata da Git se serve questa possibilità di ripristino.
