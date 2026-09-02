# Sistema Logistico

**Gestione pannelli, pacchi e spedizioni**

Versione: **1.0 Alpha**

---

# Descrizione

Sistema Logistico è il gestionale sviluppato per ESSEPI dedicato alla gestione completa della logistica dei pannelli X-LAM.

Il software permette di gestire l'intero flusso produttivo dalla distinta di carico fino alla spedizione del camion.

Funzioni principali:

- Importazione distinte Excel
- Scansione pannelli finiti
- Creazione pacchi
- Stampa etichette QR
- Gestione magazzino
- Carico camion
- Storico spedizioni
- Gestione operatori
- Gestione rimorchi
- Gestione trasportatori

---

# Struttura del progetto

```
LoadMaster
│
├── backend
│   ├── src
│   ├── data
│   └── ...
│
├── frontend
│   ├── src
│   ├── public
│   └── ...
│
└── README.md
```

---

# Requisiti

- Node.js LTS
- npm
- Visual Studio Code
- Git

---

# HTTPS locale per scansione QR da smartphone

La fotocamera browser (`getUserMedia`) richiede HTTPS. L'indirizzo LAN HTTP, per esempio `http://192.168.178.150:5173`, non è sufficiente su smartphone.

## Creare un certificato locale

Installare `mkcert`, creare la CA locale e individuarne il percorso:

```powershell
winget install FiloSottile.mkcert
mkcert -install
mkcert -CAROOT
```

Ricavare l'IPv4 LAN del PC con `ipconfig`, quindi generare certificato e chiave fuori dal repository, sostituendo l'IP di esempio con quello reale:

```powershell
New-Item -ItemType Directory -Force C:\SisLog-Certificati
Set-Location C:\SisLog-Certificati
mkcert 192.168.178.150 localhost 127.0.0.1 ::1
```

Non copiare certificati o chiavi nel repository. Creare `frontend/.env.local` partendo da `frontend/.env.local.example` e inserire i nomi generati:

```env
VITE_API_URL=/api
VITE_HTTPS_CERT_PATH=C:/SisLog-Certificati/192.168.178.150+3.pem
VITE_HTTPS_KEY_PATH=C:/SisLog-Certificati/192.168.178.150+3-key.pem
```

Se entrambe le variabili HTTPS sono assenti, Vite parte normalmente in HTTP. Una configurazione parziale blocca invece l'avvio con un errore esplicito.

## Autorizzare smartphone e tablet

Dal percorso mostrato da `mkcert -CAROOT`, trasferire sul dispositivo solamente `rootCA.pem`, mai `rootCA-key.pem`, e installarlo come CA attendibile. Su iPhone/iPad occorre anche abilitare la piena attendibilità del certificato nelle impostazioni; su Android installarlo dalle impostazioni di sicurezza.

## Avvio e verifica

PC e smartphone devono essere sulla stessa rete. Avviare Fastify in un terminale e Vite in un secondo terminale:

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

Aprire sul telefono, usando l'IP reale del PC:

```text
https://192.168.178.150:5173
https://192.168.178.150:5173/api/health
```

Vite inoltra `/api` a `http://127.0.0.1:3001`: il browser usa una sola origine HTTPS, quindi non c'è mixed content e Fastify resta in HTTP. Potrebbe essere necessario consentire la porta TCP 5173 nel firewall privato di Windows. Se l'IP del PC cambia, generare un nuovo certificato oppure assegnare al PC un IP stabile.

---

# Pubblicazione su Windows Server

## Prerequisiti

- Windows Server aggiornato e accessibile dalla rete degli operatori.
- Node.js LTS e npm installati per eseguire build e backend.
- Porta TCP `3001` consentita nel Windows Firewall.
- Installazione consigliata in `D:\Applicazioni\SisLog`, con database SQLite su disco locale e non su una condivisione di rete.

## Configurazione

Dopo aver copiato o aggiornato il progetto, creare la configurazione locale del backend senza versionarla:

```powershell
cd D:\Applicazioni\SisLog\backend
Copy-Item .env.production.example .env
notepad .env
```

Verificare almeno queste variabili:

```env
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
DATABASE_URL=D:/Applicazioni/SisLog/data/sistema_logistico.sqlite
FRONTEND_DIST_PATH=D:/Applicazioni/SisLog/frontend/dist
FRONTEND_ORIGIN=http://NOME-SERVER:3001
```

`DATABASE_URL` e `FRONTEND_DIST_PATH` devono essere percorsi assoluti. La cartella del database viene creata automaticamente se manca; un database SQLite esistente viene aperto senza essere cancellato o sostituito.

## Build e avvio

Dalla root del progetto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-production.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-production.ps1
```

Lo script di build installa le dipendenze con `npm ci`, compila prima il frontend e poi il backend, quindi verifica `frontend/dist/index.html` e `backend/dist`. Lo script di avvio esegue esclusivamente `backend/dist/server.js`: non avvia Vite, watcher o server di sviluppo.

Gli operatori accedono a:

```text
http://NOME-SERVER:3001
```

Le API restano disponibili sotto `http://NOME-SERVER:3001/api/`. Aprire nel Windows Firewall la porta TCP `3001` solo per le reti necessarie.

## Aggiornamenti e backup

Prima di ogni aggiornamento arrestare SisLog ed eseguire una copia del file indicato da `DATABASE_URL`. Non cancellare `backend/.env` né il database durante build o deploy. Dopo il backup, aggiornare i sorgenti, rilanciare `build-production.ps1` e quindi `start-production.ps1`.

In sviluppo frontend e backend restano separati: Vite usa `localhost:5173`, Fastify usa `localhost:3001` e il CORS è attivo. In produzione Fastify serve sia la SPA compilata sia le API sullo stesso origin e Vite non viene utilizzato.

---

# Prima apertura del progetto

Aprire sempre la cartella:

```
LoadMaster
```

NON aprire direttamente:

```
frontend
```

oppure

```
backend
```

---

# Avvio del programma

Aprire due terminali.

## Terminale 1

Backend

```
cd backend
npm install
npm run dev
```

Il backend sarà disponibile su:

```
http://localhost:3001
```

Verifica:

```
http://localhost:3001/api/health
```

---

## Terminale 2

Frontend

```
cd frontend
npm install
npm run dev
```

Il programma sarà disponibile su:

```
http://localhost:5173
```

oppure

```
http://localhost:5174
```

se la porta 5173 è occupata.

---

# Variabili ambiente

Frontend

file:

```
frontend/.env
```

contenuto:

```
VITE_API_URL=http://localhost:3001/api
```

---

Backend

file:

```
backend/.env
```

contenuto:

```
PORT=3001
HOST=127.0.0.1
NODE_ENV=development
DATABASE_URL=./data/sistema_logistico.sqlite
FRONTEND_ORIGIN=http://localhost:5173
```

---

# File NON presenti su GitHub

Non vengono caricati su GitHub:

```
frontend/.env

backend/.env

backend/data/sistema_logistico.sqlite
```

Vengono invece caricati:

```
frontend/.env.example

backend/.env.example
```

---

# Aggiornare il progetto

Entrare nella cartella principale

```
LoadMaster
```

eseguire

```
git pull
```

avviare backend

```
cd backend
npm run dev
```

avviare frontend

```
cd ../frontend
npm run dev
```

---

# Salvare le modifiche

Dalla cartella principale

```
LoadMaster
```

controllare

```
git status
```

aggiungere i file

```
git add .
```

creare il commit

```
git commit -m "Descrizione modifiche"
```

inviare su GitHub

```
git push origin main
```

controllare

```
git status
```

risultato atteso

```
nothing to commit, working tree clean
```

---

# Backup

Il codice è salvato su GitHub.

Il database NON è salvato su GitHub.

Il database va copiato periodicamente.

Percorso:

```
backend/data/
```

---

# Stato sviluppo

## Completato

✔ Dashboard

✔ Import Excel

✔ Scansione pannelli

✔ Creazione pacchi

✔ Stampa etichette

✔ Magazzino

✔ Carico camion

✔ Storico spedizioni

✔ Backend

---

## In sviluppo

- Persistenza database
- Gestione utenti
- Backup automatici
- Report PDF
- Database centralizzato aziendale

---

# Note

Questo software è sviluppato internamente per ESSEPI.

Autore progetto:

Denis Carmellini

Supporto sviluppo:

OpenAI ChatGPT
# Sistema Logistico

**Gestione pannelli, pacchi e spedizioni**

Versione: **1.0 Alpha**

---

# Descrizione

Sistema Logistico è il gestionale sviluppato per ESSEPI dedicato alla gestione completa della logistica dei pannelli X-LAM.

Il software permette di gestire l'intero flusso produttivo dalla distinta di carico fino alla spedizione del camion.

Funzioni principali:

- Importazione distinte Excel
- Scansione pannelli finiti
- Creazione pacchi
- Stampa etichette QR
- Gestione magazzino
- Carico camion
- Storico spedizioni
- Gestione operatori
- Gestione rimorchi
- Gestione trasportatori

---

# Struttura del progetto

```
LoadMaster
│
├── backend
│   ├── src
│   ├── data
│   └── ...
│
├── frontend
│   ├── src
│   ├── public
│   └── ...
│
└── README.md
```

---

# Requisiti

- Node.js LTS
- npm
- Visual Studio Code
- Git

---

# Prima apertura del progetto

Aprire sempre la cartella:

```
LoadMaster
```

NON aprire direttamente:

```
frontend
```

oppure

```
backend
```

---

# Avvio del programma

Aprire due terminali.

## Terminale 1

Backend

```
cd backend
npm install
npm run dev
```

Il backend sarà disponibile su:

```
http://localhost:3001
```

Verifica:

```
http://localhost:3001/api/health
```

---

## Terminale 2

Frontend

```
cd frontend
npm install
npm run dev
```

Il programma sarà disponibile su:

```
http://localhost:5173
```

oppure

```
http://localhost:5174
```

se la porta 5173 è occupata.

---

# Variabili ambiente

Frontend

file:

```
frontend/.env
```

contenuto:

```
VITE_API_URL=http://localhost:3001/api
```

---

Backend

file:

```
backend/.env
```

contenuto:

```
PORT=3001
HOST=127.0.0.1
NODE_ENV=development
DATABASE_URL=./data/sistema_logistico.sqlite
FRONTEND_ORIGIN=http://localhost:5173
```

---

# File NON presenti su GitHub

Non vengono caricati su GitHub:

```
frontend/.env

backend/.env

backend/data/sistema_logistico.sqlite
```

Vengono invece caricati:

```
frontend/.env.example

backend/.env.example
```

---

# Aggiornare il progetto

Entrare nella cartella principale

```
LoadMaster
```

eseguire

```
git pull
```

avviare backend

```
cd backend
npm run dev
```

avviare frontend

```
cd ../frontend
npm run dev
```

---

# Salvare le modifiche

Dalla cartella principale

```
LoadMaster
```

controllare

```
git status
```

aggiungere i file

```
git add .
```

creare il commit

```
git commit -m "Descrizione modifiche"
```

inviare su GitHub

```
git push origin main
```

controllare

```
git status
```

risultato atteso

```
nothing to commit, working tree clean
```

---

# Backup

Il codice è salvato su GitHub.

Il database NON è salvato su GitHub.

Il database va copiato periodicamente.

Percorso:

```
backend/data/
```

---

# Stato sviluppo

## Completato

✔ Dashboard

✔ Import Excel

✔ Scansione pannelli

✔ Creazione pacchi

✔ Stampa etichette

✔ Magazzino

✔ Carico camion

✔ Storico spedizioni

✔ Backend

---

## In sviluppo

- Persistenza database
- Gestione utenti
- Backup automatici
- Report PDF
- Database centralizzato aziendale

---

# Note

Questo software è sviluppato internamente per ESSEPI.

Autore progetto:

Denis Carmellini

Supporto sviluppo:

OpenAI ChatGPT
# Sistema Logistico

**Gestione pannelli, pacchi e spedizioni**

Versione: **1.0 Alpha**

---

# Descrizione

Sistema Logistico è il gestionale sviluppato per ESSEPI dedicato alla gestione completa della logistica dei pannelli X-LAM.

Il software permette di gestire l'intero flusso produttivo dalla distinta di carico fino alla spedizione del camion.

Funzioni principali:

- Importazione distinte Excel
- Scansione pannelli finiti
- Creazione pacchi
- Stampa etichette QR
- Gestione magazzino
- Carico camion
- Storico spedizioni
- Gestione operatori
- Gestione rimorchi
- Gestione trasportatori

---

# Struttura del progetto

```
LoadMaster
│
├── backend
│   ├── src
│   ├── data
│   └── ...
│
├── frontend
│   ├── src
│   ├── public
│   └── ...
│
└── README.md
```

---

# Requisiti

- Node.js LTS
- npm
- Visual Studio Code
- Git

---

# Prima apertura del progetto

Aprire sempre la cartella:

```
LoadMaster
```

NON aprire direttamente:

```
frontend
```

oppure

```
backend
```

---

# Avvio del programma

Aprire due terminali.

## Terminale 1

Backend

```
cd backend
npm install
npm run dev
```

Il backend sarà disponibile su:

```
http://localhost:3001
```

Verifica:

```
http://localhost:3001/api/health
```

---

## Terminale 2

Frontend

```
cd frontend
npm install
npm run dev
```

Il programma sarà disponibile su:

```
http://localhost:5173
```

oppure

```
http://localhost:5174
```

se la porta 5173 è occupata.

---

# Variabili ambiente

Frontend

file:

```
frontend/.env
```

contenuto:

```
VITE_API_URL=http://localhost:3001/api
```

---

Backend

file:

```
backend/.env
```

contenuto:

```
PORT=3001
HOST=127.0.0.1
NODE_ENV=development
DATABASE_URL=./data/sistema_logistico.sqlite
FRONTEND_ORIGIN=http://localhost:5173
```

---

# File NON presenti su GitHub

Non vengono caricati su GitHub:

```
frontend/.env

backend/.env

backend/data/sistema_logistico.sqlite
```

Vengono invece caricati:

```
frontend/.env.example

backend/.env.example
```

---

# Aggiornare il progetto

Entrare nella cartella principale

```
LoadMaster
```

eseguire

```
git pull
```

avviare backend

```
cd backend
npm run dev
```

avviare frontend

```
cd ../frontend
npm run dev
```

---

# Salvare le modifiche

Dalla cartella principale

```
LoadMaster
```

controllare

```
git status
```

aggiungere i file

```
git add .
```

creare il commit

```
git commit -m "Descrizione modifiche"
```

inviare su GitHub

```
git push origin main
```

controllare

```
git status
```

risultato atteso

```
nothing to commit, working tree clean
```

---

# Backup

Il codice è salvato su GitHub.

Il database NON è salvato su GitHub.

Il database va copiato periodicamente.

Percorso:

```
backend/data/
```

---

# Stato sviluppo

## Completato

✔ Dashboard

✔ Import Excel

✔ Scansione pannelli

✔ Creazione pacchi

✔ Stampa etichette

✔ Magazzino

✔ Carico camion

✔ Storico spedizioni

✔ Backend

---

## In sviluppo

- Persistenza database
- Gestione utenti
- Backup automatici
- Report PDF
- Database centralizzato aziendale

---

# Note

Questo software è sviluppato internamente per ESSEPI.

Autore progetto:

Denis Carmellini

Supporto sviluppo:
