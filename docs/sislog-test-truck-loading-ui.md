# SISLOG TEST - Messaggi e apertura di Carico camion

## Stato e conferma di chiusura

Il backend già porta il carico in ATTESA_SPEDIZIONE all'ultima unità caricata e valorizza completedAt automaticamente. Né la percentuale né completedAt provano quindi una conferma esplicita dell'operatore. Le transizioni rimangono invariate.

Il comando di completamento registra ora un evento di audit LOADING_CLOSURE_CONFIRMED, soltanto alla conferma esplicita e senza duplicarlo alle richieste ripetute. La risposta della sessione espone closureConfirmedAt, mappato in chiusuraConfermataIl nel frontend. Nessuna nuova colonna, migrazione o modifica retroattiva dei dati. Le vecchie chiusure esplicite già riconoscibili come LOADING_COMPLETED senza nota automatica sono lette senza riscrivere l'audit. Le chiusure storiche non distinguibili dalle attese automatiche non sono ricostruite o inventate.

Riapertura esplicita e rimozione di unità invalidano la conferma letta dall'audit; non sono modificate le rispettive operazioni o transizioni. I test verificano che, al comando di completamento di un carico già al 100%, nessuna tabella operativa cambi oltre alla nuova traccia di audit.

Messaggi identici su desktop e mobile:

- Caricamento completo, senza conferma esplicita: **Tutti gli elementi caricati — pronto per la chiusura**.
- ATTESA_SPEDIZIONE con conferma esplicita: **Carico completato — in attesa della partenza**.

## Pulsanti e consultazione

Riutilizzata la conversione degli stati visualizzati: Da caricare -> DA_CARICARE; Da completare -> DA_COMPLETARE; In carico -> IN_CARICO; Attesa spedizione -> ATTESA_SPEDIZIONE.

- DA_CARICARE: Avvia carico.
- DA_COMPLETARE / IN_CARICO: Continua carico.
- ATTESA_SPEDIZIONE: Visualizza carico.

Visualizza apre la sessione esistente in consultazione: niente autosalvataggio delle impostazioni, aggiornamenti locali impliciti o chiamate di riapertura. I controlli di modifica sono disabilitati. La riapertura esplicita già disponibile rimane distinta. Se il carico ha raggiunto il 100% ma la chiusura non è ancora confermata, il comando esplicito Completa carico resta disponibile, senza riaprire o modificare il materiale. Per un carico già confermato, anche quel comando è disabilitato.

Non cambiano le scansioni, il simulatore, la composizione del materiale, Calendario, Spedizioni o DDT. Verifiche esclusivamente su fixture temporanee/in memoria; nessuna modifica ai dati TEST/DEMO esistenti. Nessun commit, push o deploy.

Verifiche: suite backend **199/199**, frontend **57/57**; verifiche mirate finali su conferma, audit legacy e riapertura **5/5**. TypeScript backend/frontend e `git diff --check` superati. I test frontend coprono messaggi con/senza conferma, indipendenza dalla sola percentuale, mappatura dei quattro stati e rendering desktop/mobile con controlli di modifica disabilitati.
