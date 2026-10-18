# SISLOG TEST - Simulatore scansioni QR

In Carico camion, aprire il carico desiderato e selezionare l'operatore. Attendere il salvataggio della sessione, poi premere **Simula scansione — TEST**, sotto i comandi dello scanner (desktop e telefono).

La finestra mostra commessa e camion selezionati e permette di scegliere gli elementi singoli e i pacchi disponibili. Premere la riga di un'unità per inviarne il QR alla normale funzione di scansione. L'esito appare nella finestra e l'elenco viene aggiornato dopo ogni tentativo. Si possono scegliere altre unità senza digitare codici e senza chiudere la finestra. Il simulatore registra realmente il materiale nel carico TEST.

Gli elementi devono essere preparati attraverso il flusso normale. Sono esclusi gli elementi nei pacchi, i pacchi aperti/vuoti/incoerenti, il materiale non disponibile o già caricato e quello di altri carichi. Una sessione chiusa o spedita non propone unità. L'ultima scansione segue le regole della Fase 1: attesa spedizione, con partenza da confermare separatamente.

## Implementazione e protezioni

- Formati delle etichette invariati: `C=...|CL=...|N=...|CA=...|S=...|L=...|H=...|P=...` e `PK=...|C=...|CL=...|CA=...|PZ=...|KG=...|MC=...`. I generatori sono ora condivisi con il backend; il frontend li riesporta con gli stessi nomi e le stesse firme.
- Unico endpoint aggiunto: `GET /api/loading-sessions/:id/test-qr-candidates`, di sola lettura e senza cache. Produce i QR dai dati della sessione/carico e del materiale, senza creare unità, carichi, etichette o eventi.
- L'endpoint è registrato solo con `config.environment === "test"`; chiamate dirette da development, demo e production ricevono 404. Non si basa su un parametro fornito dal browser.
- Il frontend richiede il booleano `VITE_SISLOG_TEST === true` sia per il componente sia per il servizio che recupera l'elenco. Il flag è già imposto dalla configurazione Vite; una stringa `"true"` non abilita la funzione.
- La scelta passa il QR alla stessa funzione `submit` di Carico camion, che usa i parser e `loadUnitApi` esistenti. Non è stato introdotto un secondo percorso di caricamento o un bypass dei controlli. Le scansioni reali continuano a funzionare fuori da TEST.
- Durante una simulazione si attende l'esito prima di accettarne un'altra. Il server del caricamento verifica nuovamente stato, disponibilità e appartenenza: una disponibilità cambiata dopo l'apertura non autorizza il carico.

Le verifiche scrivono esclusivamente su fixture temporanee o in memoria, rimosse al termine. Nessuna modifica ai dati TEST/DEMO esistenti, nessun commit, push o deploy.

Verifica finale: **199/199 test backend**, **54/54 test frontend**, TypeScript backend/frontend e `git diff --check` superati. I nuovi test coprono generatori QR condivisi, disponibilità ed esclusione dei figli dei pacchi, caricamenti ripetuti tramite API normali, duplicati, appartenenza al carico, sessioni spedite, elenco senza scritture e protezioni frontend/backend fuori da TEST.
