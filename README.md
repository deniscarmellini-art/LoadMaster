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

OpenAI ChatGPTwc.rs/)
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

OpenAI ChatGPTtation]# Sistema Logistico

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

OpenAI ChatGPTiting `.# Sistema Logistico

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

OpenAI ChatGPT