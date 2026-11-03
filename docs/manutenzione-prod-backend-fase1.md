# Manutenzione centralizzata SisLog - preparazione PROD

Questa procedura descrive la preparazione del backend e dei comandi locali. Non e stata eseguita sul sistema PROD reale: stato, servizi e database PROD non sono stati inizializzati o modificati.

## Percorsi e comportamento

- TEST: `%ProgramData%\SisLog\TEST\maintenance-state.json`.
- PROD: `%ProgramData%\SisLog\PROD\maintenance-state.json`.
- Il formato condiviso e JSON con `formatVersion`, `updateRevision`, `state`, `message` e `scheduledAt`. Gli stati memorizzati sono `idle` e `scheduled`; il backend calcola `maintenance` quando la scadenza e raggiunta.
- La configurazione backend rifiuta percorsi TEST/PROD uguali e, quando entrambi esistono, riferimenti allo stesso file.
- In PROD, un file assente, non leggibile o non valido blocca le scritture con `503 MAINTENANCE_STATE_UNAVAILABLE`; letture e `/api/health` restano disponibili. TEST mantiene il comportamento esistente per il proprio file assente.
- `activeWriteRequests` e in memoria nel processo backend. Prima di arrestare l'unica istanza PROD, verificare `GET /api/maintenance` e attendere `activeWriteRequests: 0`. Dopo un riavvio il contatore riparte da zero; lo stato persistente resta nel file.

## Preparazione

Prima di pianificare un fermo, identificare l'account effettivo del backend PROD e l'account o gruppo Windows autorizzato a gestire la manutenzione. Non assumere che il processo usi l'account dell'utente collegato.

- Per un servizio Windows, controllare `StartName` e `ProcessId` con `Get-CimInstance Win32_Service` e verificare il PID che ascolta sulla porta backend.
- Per un'attivita pianificata, verificare l'identita configurata nel principal dell'attivita.
- Per un processo avviato da launcher o console, verificare il proprietario del PID effettivo con Process Explorer oppure tramite `Get-CimInstance Win32_Process` e `GetOwner`.
- Convertire gli account verificati in SID per evitare ambiguita dovute alla lingua di Windows:

```powershell
$identity = [System.Security.Principal.NTAccount]::new('DOMINIO\account')
$sid = $identity.Translate([System.Security.Principal.SecurityIdentifier]).Value
$sid
```

Passare allo script il SID dell'account backend e quello del gruppo ristretto di operatori autorizzati. I SID devono essere distinti da `SYSTEM` e `Administrators`; gli amministratori sono autorizzati dal controllo dello script. Non usare gruppi generici come `Users`.

Verificare in anticipo che PowerShell possa eseguire gli script secondo le policy aziendali. Usare script firmati e la policy approvata dall'organizzazione. Non modificare la policy della macchina e non usare `ExecutionPolicy Bypass` come procedura ordinaria PROD.

## Prima installazione PROD - una sola volta

Durante una finestra controllata, inizializzare il file **una sola volta e prima di avviare il backend PROD aggiornato**. Usare una console elevata e i SID gia verificati:

```powershell
$backendSid = 'S-1-5-...'
$operatorGroupSid = 'S-1-5-...'
.\scripts\maintenance-prod.ps1 -Action Init -BackendIdentity $backendSid -OperatorIdentity $operatorGroupSid
```

`Init` crea `%ProgramData%\SisLog\PROD\maintenance-state.json` in stato `idle`, solo se il file non esiste. Non sovrascrive uno stato preesistente. Se il file esiste gia, fermarsi e verificarne origine e contenuto: non cancellarlo e non reinizializzarlo.

Prima di avviare il backend, controllare file e ACL NTFS:

```powershell
$statePath = Join-Path $env:ProgramData 'SisLog\PROD\maintenance-state.json'
$stateDirectory = Split-Path -Parent $statePath
Get-Content -LiteralPath $statePath
Get-Acl -LiteralPath $stateDirectory | Format-List AreAccessRulesProtected, AccessToString
Get-Acl -LiteralPath $statePath | Format-List AreAccessRulesProtected, AccessToString
```

Lo script imposta ACL protette: `SYSTEM` e `Administrators` hanno controllo completo; l'account backend ha lettura; il gruppo operatori ha `Modify`. Verificare che account e SID corrispondano alle identita effettive, che il backend possa leggere il file e che soltanto gli operatori autorizzati possano modificarlo. Se la verifica fallisce, non avviare il backend aggiornato: in PROD un file non verificabile blocca le scritture.

Dopo l'avvio controllato del backend, verificare `GET /api/maintenance`: deve restituire `state: idle`, `updateRevision: 0` e `activeWriteRequests: 0`. Verificare anche `/api/health` e una lettura applicativa prima di riaprire SisLog agli operatori.

## Aggiornamenti successivi

Non eseguire nuovamente `Init`. Gli aggiornamenti successivi riutilizzano il file e gli stessi SID verificati.

Per programmare l'avviso di due minuti:

```powershell
.\scripts\maintenance-prod.ps1 -Action Schedule -BackendIdentity $backendSid -OperatorIdentity $operatorGroupSid
```

Per annullare prima della scadenza:

```powershell
.\scripts\maintenance-prod.ps1 -Action Cancel -BackendIdentity $backendSid -OperatorIdentity $operatorGroupSid
```

Alla scadenza il backend blocca le nuove scritture. Prima di fermarlo, attendere che `GET /api/maintenance` mostri `activeWriteRequests: 0`. Eseguire l'aggiornamento e riavviare il backend con la procedura PROD esistente. Quando il servizio aggiornato e operativo, riaprire le postazioni:

```powershell
.\scripts\maintenance-prod.ps1 -Action Resume -BackendIdentity $backendSid -OperatorIdentity $operatorGroupSid
```

`Resume` porta lo stato a `idle` e incrementa `updateRevision`, cosi le postazioni possono rilevare la nuova versione. `Cancel` e valido solo prima della scadenza; dopo l'inizio della manutenzione usare `Resume` soltanto quando il servizio e tornato disponibile.

Gli script PROD rifiutano file assenti, danneggiati o con ACL non conformi e sostituiscono il JSON in modo atomico. Lo script TEST usa il percorso derivato da `%ProgramData%\SisLog\TEST` e rifiuta componenti di percorso che siano junction o collegamenti simbolici.
