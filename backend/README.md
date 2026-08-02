# Sistema Logistico API

Backend Node.js e TypeScript di Sistema Logistico. In questa prima fase espone soltanto endpoint diagnostici e inizializza il database locale di sviluppo, senza migrare i dati del frontend.

## Requisiti

- Node.js 24 o successivo
- npm 11 o successivo

## Installazione

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

## Variabili d'ambiente

| Variabile | Default | Descrizione |
| --- | --- | --- |
| `PORT` | `3001` | Porta HTTP del backend |
| `HOST` | `127.0.0.1` | Interfaccia di ascolto |
| `NODE_ENV` | `development` | Ambiente applicativo |
| `DATABASE_URL` | `./data/sistema-logistico.sqlite` | Percorso del database SQLite locale |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Origine autorizzata dal CORS |

Non inserire password o segreti nel file `.env`.

## Comandi

```powershell
npm run dev
npm run type-check
npm run build
npm run start
npm test
npm run test:health
```

`npm run test:health` richiede che il backend sia già in esecuzione sulla porta configurata.

## Endpoint

- `GET /api/health`: stato, nome, versione e timestamp del servizio.
- `GET /api/info`: versione e informazioni non sensibili sull'ambiente di esecuzione.
- `GET|POST /api/operators` e `PUT|PATCH|DELETE /api/operators/:id`.
- `GET|POST /api/trailers` e `PUT|PATCH|DELETE /api/trailers/:id`.
- `GET|POST /api/carriers` e `PUT|PATCH|DELETE /api/carriers/:id`.
- `GET /api/loads` e `GET /api/loads/:id`.
- `POST /api/loads/import` e `PUT /api/loads/:id/import`.
- `DELETE /api/loads/:id` e `GET /api/loads/:id/panels`.

Le operazioni `DELETE` sono logiche: il record rimane nel database con `active = false`.
Le operazioni `PATCH` accettano `{ "active": true|false }` e modificano soltanto lo stato del record.

Gli errori sono restituiti in un formato JSON coerente con `success: false`, codice e messaggio.

## Database locale

Il database viene creato per impostazione predefinita in `backend/data/sistema-logistico.sqlite`. Contiene le anagrafiche e le tabelle operative `Loads` e `Panels`. Gli import Excel vengono salvati in transazione; `Panels.loadId` usa `ON DELETE CASCADE` e la coppia `loadId + numeroPannello` è univoca.

SQLite è destinato esclusivamente allo sviluppo locale. Il file non deve essere aperto o condiviso direttamente tramite una cartella di rete. Tutti i client dovranno accedere ai dati esclusivamente tramite le API. La separazione tra configurazione, repository e servizi prepara una futura sostituzione con PostgreSQL o SQL Server.
