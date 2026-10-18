# SISLOG TEST - Fase 1: completamento carico e partenza

Il comando **Completa carico** usa `POST /loading-sessions/:id/complete` per Bilico Essepi, Ritiro cliente e Conto terzi. Non chiama `/ship`, non imposta date di partenza e non marca il materiale come spedito. Il frontend usa la risposta del backend e aggiorna i dati condivisi con Spedizioni.

L'endpoint accetta anche le destinazioni senza rimorchio; per Bilico Essepi restano i controlli sul rimorchio assegnato e sul trasportatore effettivo. Restano i controlli sui dettagli di trasporto previsti per ciascuna modalità e sulla completezza del materiale. La rilevazione già esistente dell'ultima unità caricata continua a portare il carico in ATTESA_SPEDIZIONE quando i requisiti sono soddisfatti. La richiesta di completamento ripetuta è idempotente.

La partenza resta una conferma separata in Dashboard o Spedizioni, tramite gli endpoint esistenti. Solo tale operazione imposta SPEDITO, shippedAt e actualDepartureDate, registra PARTENZA_CONFERMATA e aggiorna materiale e trasporti. Non è introdotto alcun blocco DDT.

Durante l'attesa i pannelli/pacchi rimangono caricati e il rimorchio resta impegnato nello stato CARICATO, senza data di partenza, disponibilità futura o rilascio anticipato. Il completamento non assegna o libera risorse. I controlli di completamento, riapertura e scarico sono ora eseguiti nella stessa transazione della scrittura, usando BEGIN IMMEDIATE come la partenza, per impedire operazioni basate su uno stato precedente alla partenza.

Il collegamento Calendario/carico della Fase A, la composizione del materiale, il PDF e il funzionamento dell'anteprima DDT non sono modificati. Nessuna migrazione, bonifica o scrittura sui database TEST/DEMO esistenti; test su memoria o file temporanei. Nessun commit, push o deploy.

Nuovi test backend per tutte e tre le modalità: carico incompleto, completamento senza partenza, coerenza Spedizioni, risorse trattenute, completamento ripetuto, conferma successiva senza DDT, doppia partenza e richieste da una seconda connessione dopo la conferma. Nuovo test frontend sulle API e la conversione degli stati nelle tre modalità, più rendering di Carico camion con il comando unico di completamento.

Verifica finale: suite backend integrale **195/195**, suite frontend integrale **50/50**, TypeScript backend/frontend e `git diff --check` superati. Nessuna criticità emersa nei controlli. La partenza resta possibile senza DDT definitivo, come richiesto per questa fase.
