# SISLOG TEST — Fase 2A: struttura DDT definitivi

## Attivazione e ambito

La migration additiva `migrateDefinitiveDdt` segue le convenzioni SQLite esistenti: tabelle, indici e trigger idempotenti, con transazione `BEGIN IMMEDIATE`. Non contiene backfill, emissioni, assegnazioni di numeri o modifiche ai record operativi.

L'attivazione è **esplicita**: `openSqliteDatabase(path, {enableDefinitiveDdt:true})`. Il normale avvio dell'applicazione non attiva questo schema, neppure in TEST/DEMO. In questa fase l'opzione viene usata esclusivamente su database temporanei dei test. Il servizio rifiuta emissione e annullamento fuori dall'ambiente `test` e non è collegato a route o interfacce.

Non sono stati modificati anteprima, renderer PDF, Dashboard o servizio di partenza. Nessun documento reale o DEMO viene emesso. I test di archiviazione utilizzano byte sintetici, non documenti utilizzabili.

## Tabelle

`DdtSequences`: `year` (chiave primaria), `lastNumber`. Non si possono cancellare i contatori o diminuirli; gli incrementi sono unitari.

`DdtDocuments`:

| Gruppo | Campi |
| --- | --- |
| Identità e origine | `id`, `loadingSessionId`, `loadId` con FK restrittive |
| Numerazione | `sequence`, `year`, `fullNumber` |
| Emissione | `issuedAt` UTC, `documentDate` italiana, `issuedByOperatorId` |
| Stato | `status`: EMESSO / ANNULLATO |
| Annullamento | `cancelledAt`, `cancelledByOperatorId`, `cancellationReason` obbligatori per ANNULLATO |
| Sostituzione | `replacedByDdtId`, FK al successivo documento della stessa sessione |
| Snapshot | `snapshotVersion`, `snapshotJson` |
| Originale | `pdfReference`, `pdfSha256`, `pdfBytes` BLOB |

Numero completo e coppia anno/progressivo sono univoci. L'indice parziale su `loadingSessionId WHERE status='EMESSO'` impedisce due documenti validi contemporaneamente. I trigger impediscono cancellazione, modifica di identità, numerazione, date di emissione, snapshot, PDF e hash, nonché riscrittura dell'audit di annullamento. Il solo aggiornamento successivo ammesso oltre all'annullamento è il collegamento al sostitutivo. L'annullamento è impedito anche a livello SQL se risulta una partenza effettiva sulla sessione, sul carico o sulla pianificazione collegata.

## Numerazione e atomicità

`DefinitiveDdtService.issue` acquisisce `BEGIN IMMEDIATE`, verifica operatore attivo, assenza di partenza e chiusura formale del carico in ATTESA_SPEDIZIONE. Il solo raggiungimento del 100% non basta. Valida il trasporto effettivo con la regola documentale condivisa, senza fallback dal Calendario.

Data, anno e ora sono rilevati dopo l'acquisizione della transazione: timestamp UTC, anno/data civile `Europe/Rome`. Il contatore annuale viene incrementato con UPSERT/RETURNING. Il formato ha almeno quattro cifre: `X-Lam/0001/2026`.

La stessa transazione contiene allocazione, snapshot, generazione dei byte tramite adapter interno, salvataggio BLOB/hash e collegamento al documento annullato sostituito. Un errore in qualsiasi passaggio annulla tutto. Il numero di un'emissione mai confermata può quindi essere assegnato dal successivo tentativo; un numero già emesso, anche annullato, non viene mai riutilizzato.

Le connessioni attendono il lock fino a cinque secondi; oltre tale soglia l'operazione fallisce senza scritture parziali. L'anteprima non usa questo servizio e non riserva numeri. Dopo l'annullamento si mantiene l'intera catena dei sostitutivi, anche attraverso anni diversi.

## Archivio e ristampa

L'originale è un BLOB nel medesimo database SQLite, con riferimento logico `sqlite:ddt/<uuid>` e SHA-256. Non si usano cartelle del PC di sviluppo né file esterni da coordinare con la transazione. Il database potrà essere spostato sul server aziendale senza riscrivere i riferimenti.

`originalPdf(id)` restituisce esclusivamente i byte archiviati e verifica l'hash a ogni lettura; non rigenera il documento e non usa i dati operativi correnti. Anche il documento annullato mantiene l'originale identico. L'ora di partenza rimane nei dati operativi e non aggiorna snapshot o PDF. Per i backup va utilizzata una copia coerente SQLite che includa i BLOB; non una copia non coordinata dei file mentre sono in uso.

## API interne e Fase 2B

Repository: lettura metadati, ricerca del documento valido, recupero originale verificato, numerazione e inserimento transazionali. Service: emissione e annullamento motivato in TEST. L'adapter di snapshot riceve numero, data, sessione/carico e responsabilità effettiva; il renderer riceve una copia del medesimo snapshot archiviato. Entrambi sono sincroni e lavorano sotto il lock della transazione.

Restano da realizzare/confermare in Fase 2B:

- Attivazione controllata dello schema sul database TEST autorizzato e successivo percorso di rilascio.
- Verifica del progressivo iniziale prima di un futuro uso reale, se esistono DDT dell'annualità già emessi fuori dall'applicazione. Questa fase non importa né presume contatori aziendali esistenti.
- Assembler documentale definitivo con validazione completa dei dati reali e renderer definitivo, mantenendo il layout approvato e separando numero/data/watermark dall'anteprima.
- Route, permessi, conferme operative, gestione di retry/risposta persa e interfaccia di emissione/annullamento/ristampa.
- Politica per eventuali modifiche o riaperture del carico con DDT valido: l'originale resta immutabile, ma prima della partenza servirà impedire incongruenze o richiedere annullamento e nuova emissione.
- Dimensionamento dell'archivio BLOB e procedure aziendali di backup/ripristino e conservazione. Un eventuale archivio esterno futuro richiederà un protocollo atomico distinto, non una semplice scrittura di file.
- Blocco della partenza senza DDT valido, ancora volutamente assente; procedura post-partenza esclusa da questa fase.

Queste scelte non richiedono migrazioni distruttive dei dati esistenti nella Fase 2A.

## Verifiche del 17/10/2026

- `npm.cmd --prefix backend test`: **214/214** superati, inclusi **10** test della Fase 2A.
- `npm.cmd run type-check`: backend e frontend superati.
- `git diff --check`: superato.

Copertura specifica: schema inattivo al normale avvio, migration idempotente, progressivo annuale e mezzanotte italiana al cambio d'anno, indice univoco della sessione, identità sessione/carico, immutabilità anche via SQL, annullamento motivato e catena di sostituzioni, partenza separata, rollback in ogni fase inclusa la scrittura del sostitutivo, persistenza dopo riavvio, hash e corruzione simulata dell'archivio, tentativi simultanei da worker con connessioni SQLite distinte. La suite di regressione include l'anteprima e la partenza senza introdurre il futuro blocco DDT.

Tutte le emissioni simulate e le migration attivate da queste verifiche riguardano database in memoria o cartelle temporanee. Nessuna attivazione dello schema o emissione su database TEST/DEMO esistenti; nessun commit, push o deploy.
