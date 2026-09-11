# SisLog: produzione e TEST

## Architettura

| Ambiente | Frontend | API | Database |
| --- | --- | --- | --- |
| PRODUZIONE | `https://192.167.4.96:3001`, build `frontend/dist` | stessa origine, `/api` | `C:\Sviluppo\LoadMaster\backend\data\sistema-logistico.sqlite` |
| TEST | `https://192.167.4.96:5174`, Vite con hot reload | proxy `/api` verso `http://127.0.0.1:3002` | `C:\Sviluppo\LoadMaster\backend\data\sistema-logistico-test.sqlite` |

Il backend TEST ascolta solo su loopback: i dispositivi LAN usano il frontend HTTPS sulla 5174. Il certificato gia presente in `backend/certs/sislog-{cert,key}.pem` viene letto anche da Vite, senza modificarlo. Usare un nome/IP coperto dal certificato e la stessa CA gia considerata attendibile dai dispositivi production. Se la rete blocca 5174 occorre una regola firewall limitata alla LAN; gli script non cambiano il firewall.

Il backend TEST esegue `src/testServer.ts` tramite tsx e Node watch, senza leggere `backend/.env`. Porta e percorso database sono fissi e non possono essere deviati da `PORT`, `DATABASE_URL` o `NODE_ENV` ereditati. Vengono rifiutati link simbolici e hard link del DB TEST. Vite non ha fallback alla 3001, neppure se `.env.local` contiene un vecchio `VITE_API_URL`. Se TEST e spento, le richieste falliscono: non passano alla produzione.

La fascia **AMBIENTE TEST** appare soltanto nel dev server, anche su mobile. Il codice viene eliminato dalla build production. Entrambi gli ambienti usano gli stessi sorgenti; sviluppo e test non scrivono nelle cartelle `dist` servite dalla produzione.

Il flag frontend `VITE_SISLOG_TEST` viene imposto dalla configurazione Vite (`true` per il server, `false` per la build), non dai file `.env` o da valori ereditati nel terminale.

## Avvio TEST

Da PowerShell:

```powershell
Set-Location C:\Sviluppo\LoadMaster
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-test.ps1
```

Oppure `npm.cmd run start:test` (anche `npm.cmd run dev`). Al primo avvio viene creata una copia consistente del database production usando SQLite online backup con sorgente aperta in sola lettura; agli avvii successivi il DB TEST esistente viene conservato. Le migrazioni di sviluppo vengono applicate esclusivamente al DB TEST. Nessuna build production e nessuna installazione delle dipendenze viene eseguita durante l'avvio TEST.

Aprire `https://192.167.4.96:5174`. Il terminale mostra frontend, API e database TEST. Le modifiche frontend usano hot reload, quelle backend riavviano solo il processo TEST. Ctrl+C ferma solo i processi figli avviati dallo script. Le porte occupate causano un errore; non vengono terminati processi estranei.

## Inizializzare o aggiornare il DB TEST

Chiudere TEST prima di aggiornare la copia:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\init-test-db.ps1
# Aggiornamento esplicito dalla produzione: sostituisce solo TEST.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\init-test-db.ps1 -Refresh
```

Il comando senza `-Refresh` conserva un DB TEST gia esistente. Il refresh archivia il precedente DB TEST in `sistema-logistico-test.sqlite.<timestamp>.bak`. Le modifiche fatte in TEST non vengono mai sincronizzate verso production. Il lock `backend/data/.sislog-test.lock` impedisce refresh/avvii concorrenti. Dopo un arresto forzato del PC puo rimanere: prima di rimuoverlo manualmente verificare che il PID scritto nel lock e i processi TEST sulle porte 3002/5174 siano terminati. Non fermare mai il processo production sulla 3001. I file journal/WAL residui bloccano il refresh: aprire e chiudere regolarmente TEST prima di riprovare.

## Avvio PRODUZIONE (invariato)

```powershell
Set-Location C:\Sviluppo\LoadMaster
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-production.ps1
```

La produzione gia attiva non va riavviata per usare TEST. Lo script production continua a leggere `backend/.env`, eseguire `backend/dist/server.js` e servire `frontend/dist`. Il vecchio messaggio LAN nello script cita `.99`: l'indirizzo operativo di questa macchina e `.96`, come riportato sopra. Non sono stati modificati configurazione, certificati o script di avvio production.

## Verifiche e pubblicazione

```powershell
npm.cmd run type-check
npm.cmd --prefix backend test
# Compilazioni di verifica production, senza toccare i dist attivi:
node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.json --outDir backend/.test-dist
npm.cmd --prefix frontend run build -- --outDir ../.verification/frontend-production
```

I test backend compilano in `backend/.test-dist`, non in `backend/dist`. `.verification` e gli output di test sono ignorati da Git. La build frontend di verifica usa comunque la modalita production.

`scripts/build-production.ps1` e `npm.cmd run build` restano comandi di **pubblicazione esplicita**: riscrivono i `dist` production. Non usarli per lo sviluppo con operatori connessi. La pubblicazione richiede una finestra dedicata; un eventuale cambio schema verra applicato al DB reale solo avviando il backend production aggiornato. Una verifica build non pubblica automaticamente TEST.

Database, backup, lock, `.env` macchina-specifici e certificati non vanno aggiunti a Git. I file `.env.example` restano modelli versionabili; TEST non richiede un secondo `.env` locale.
