# SFRIDO 265852 / PK-2026-000240 — correzione preparata, NON applicata

La classificazione documentale è esplicita e limitata all'ID elemento `04a5c37a-a3f5-4fbf-975e-f14b2d1cc0e5`, carico `bdb815b9-8438-4b52-a7a3-bfb83ba96fab`, pacco `061d5710-464e-402c-9c14-6563da944eaa`, codice PK-2026-000240, commessa 265852, camion C1-. Il nome SFRIDO da solo non attiva alcuna eccezione.

L'elemento deve avere quantità 1 dopo una rettifica separata. Le dimensioni, superficie, peso e volume rimangono zero nel record originale e sono rappresentati come **non disponibili** nel modello documentale. Il documento non presenta zero come misura reale. Si conservano sei voci: cinque pannelli e un lotto. I 520 kg e 1,040 m³ sono subtotali noti dei pannelli; il peso e il volume complessivi del carico sono dichiarati non determinabili. I dati ordinari mantengono le validazioni esistenti.

Non vengono modificati emissione, progressivi, requestKey, annullamento, PDF archiviati o manutenzione. Nessuna migrazione di schema è necessaria. L'installazione del software da sola NON corregge la quantità: finché è zero il DDT resta bloccato con un messaggio esplicito.

## Procedura differita: richiede una NUOVA autorizzazione

Non eseguire questa procedura durante il collaudo del candidato.

1. Ottenere autorizzazione esplicita e conservarne il riferimento; identificare un operatore attivo e la motivazione.
2. Dopo il collaudo e l'autorizzazione al rilascio, installare la correzione backend con la normale procedura controllata. Verificare i tre file runtime contro `runtime-inventory.json` prodotto dal collaudo isolato. Il tool confronta gli hash installati, quindi non può correggere i dati prima dell'installazione software.
3. In una finestra operativa separata, portare PROD in manutenzione e fermare il backend. Nessuna di queste azioni è eseguita dal tool. Non fermare TEST.
4. Creare un nuovo backup coerente fuori da Git, protetto e verificato con integrity_check, foreign_key_check e SHA-256. A backend fermo il file originale deve coincidere byte per byte con il backup. Non usare automaticamente il backup storico del 6 novembre.
5. Eseguire il tool soltanto dopo tutti questi controlli. Copiare eventualmente lo script in una cartella operativa protetta; non servono installazioni npm o migrazioni. Richiede Node >=24.

Esempio da completare con i percorsi e i riferimenti verificati, **non eseguito**:

```powershell
node <percorso-protetto>/rectify-sfrido-quantity.mjs --apply `
  --confirm PROD-265852-PK-2026-000240-QUANTITY-1 `
  --backup <nuovo-backup-verificato-fuori-Git.sqlite> `
  --software-inventory <runtime-inventory.json-del-candidato-installato> `
  --operator-id <operatore-attivo> `
  --reason "SFRIDO fisicamente caricato: rettifica a 1 lotto sfuso, misure e peso non disponibili" `
  --authorization-reference <riferimento-autorizzazione> `
  --report <nuovo-report-in-cartella-protetta-fuori-Git.json>
```

Il tool usa BEGIN IMMEDIATE, ricontrolla identità, sei righe, cinque pannelli validi, totali, stato del pacco, unità di carico, chiusura e assenza completa di documenti DDT per il carico. Se una precondizione non coincide, interrompe. Non sgancia elementi, non cancella record, non riapre sessioni e non altera scansioni, dimensioni, pesi, volumi o numero pacco.

L'unica rettifica di dati operativi è `Panels.quantita: 0 -> 1` su quell'ID. Viene aggiunto un evento append-only `SFRIDO_QUANTITY_RECTIFIED`, con operatore, data/ora, motivazione, riferimento autorizzazione, prima/dopo e chiave univoca logica della correzione. Audit e quantità sono nella stessa transazione: se l'audit fallisce tutto viene annullato. Una ripetizione con quantità 1 e audit corrispondente non duplica l'evento. Una quantità già cambiata senza audit richiede verifica manuale e viene rifiutata. Gli storici già presenti non vengono riscritti; anche updatedAt e scannedAt del pannello rimangono invariati.

6. Verificare il report e l'evento, integrity_check/foreign_key_check, i cinque pannelli, pacco e unità di carico; DdtDocuments e DdtSequences devono essere invariati. Il tool lascia il backend fermo e la manutenzione attiva.
7. Un eventuale avvio, verifica dell'anteprima, Resume ed emissione DDT appartengono ad azioni successive e separatamente autorizzate. Prima dell'emissione verificare la riga "1 lotto", i trattini e la dicitura dei soli totali noti. Non cambiare numeri o ristampare documenti tramite rigenerazione: i PDF già archiviati continuano a essere restituiti dai blob originali.

## Collaudi senza dati reali

- TypeScript backend/frontend e build soltanto nella copia isolata.
- Regressioni backend ordinarie e SFRIDO su database temporanei/in memoria; eventuali emissioni nei test sono esclusivamente sintetiche.
- `node --test backend/scripts/sfrido-rectification.test.mjs` collauda atomicità, audit, idempotenza e rifiuti su fixture in memoria; non invocare il CLI con --apply su PROD durante questi test.
- Nessuna rettifica o migrazione sui database operativi è inclusa nella preparazione.
