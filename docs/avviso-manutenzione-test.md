# Avviso aggiornamento SisLog TEST

## Revisione aggiornamento

Il file persistente include `updateRevision`, incrementato soltanto da `Resume`; `Schedule` e `Cancel` conservano il contatore. I file precedenti senza il campo sono letti come revisione `0`. `GET /api/maintenance` espone la revisione. Ogni scheda la conserva in `sessionStorage` e, dopo una revisione nuova, ricarica una sola volta se `reloadSafety` non rileva modifiche, richieste pendenti o esiti incerti. Se la ricarica automatica resta sospesa, l'operatore può verificare il lavoro e usare il pulsante `Ricarica SisLog`.

La fase 1 avvisa le postazioni. La fase 2 aggiunge il blocco delle nuove richieste di scrittura TEST alla scadenza. Le letture restano disponibili, le richieste già ammesse terminano e il server non viene arrestato automaticamente. Nessuna pagina viene ricaricata.

Lo stato persistente si trova in `%ProgramData%\SisLog\TEST\maintenance-state.json`, fuori dal repository e dalle cartelle di build. L'endpoint read-only è `GET /api/maintenance`, registrato solo dal backend TEST. Il frontend TEST interroga l'endpoint ogni cinque secondi.

Da PowerShell sul PC che ospita SisLog TEST, dalla cartella del repository:

```powershell
.\scripts\maintenance-test.ps1
```

Il comando mostra l'avviso con scadenza a due minuti. Prima della scadenza, per annullarlo:

```powershell
.\scripts\maintenance-test.ps1 -Action Cancel
```

Dopo la scadenza, per terminare la manutenzione e riabilitare le scritture:

```powershell
.\scripts\maintenance-test.ps1 -Action Resume
```

Per test isolati è possibile indicare un percorso temporaneo tramite `-StatePath`. `Cancel` rifiuta di riaprire le scritture quando la scadenza è già passata; in quel caso usare `Resume`. La barriera copre tutti i metodi HTTP di scrittura (POST, PUT, PATCH, DELETE); le GET presenti sono di sola lettura. Non usare questo comando come coordinamento sicuro di aggiornamenti PROD: questa procedura è esclusivamente TEST.
