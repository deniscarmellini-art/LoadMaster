# Anteprima DDT - fase 1

Disponibile soltanto fuori produzione. `GET /api/loading-sessions/:id/ddt-preview` restituisce `application/pdf`, `Cache-Control: no-store` e un nome file provvisorio. Non assegna progressivi e non registra documenti, partenze o eventi. Le query SELECT sono eseguite in una transazione di lettura coerente, senza usare repository che riconciliano gli stati durante le letture.

Carico camion mostra **Anteprima DDT** su desktop e mobile, dopo almeno un elemento caricato e il salvataggio delle impostazioni. Il dialogo consente visualizzazione, apertura in una scheda e download. Gli errori restituiti dal server sono visibili e ripetibili.

## Dati e limiti

- Commessa e nome cliente provengono dal carico importato, partita IVA dal cliente anagrafico collegato o risolto con le regole TEST descritte sotto.
- Destinazione e note provengono dalla pianificazione collegata tramite loadId. Note vuote rimangono vuote.
- Vettore proviene da LoadingSessions.carrierId e Carriers.name. Non viene sostituito da plannedCarrierId, etichette del tipo mezzo o nomi inventati. Le modalità che non conservano un trasportatore effettivo restituiscono un errore esplicito.
- Materiale: sole LoadingUnits attive; prima singoli, poi pacchi con dettaglio. Un elemento presente anche come figlio di un pacco caricato compare soltanto nel pacco.
- Quantità, superficie e peso vengono riportati come importati. Peso e superficie non sono moltiplicati per quantità. N. Elementi conta le righe fisiche univoche, come il flusso operativo attuale.
- Tipologia = Panels.tipoPannello; misure = lunghezza × altezza, come V3. Nessuna descrizione CLT sintetica o conversione del tipo materiale.
- Dati obbligatori assenti, valori materiali non validi e testi troppo lunghi per il layout leggibile restituiscono HTTP 422. Sessione assente: 404. Un carico parziale può avere un'anteprima del solo materiale già caricato.

## Layout V3

Logo estratto dal facsimile e font DejaVu Sans, A4 verticale, intestazione e footer ripetuti. Diciture PEFC, condizioni di vendita e CONAI trascritte integralmente dal V3. Singoli e pacchi possono proseguire sulla pagina successiva, con intestazione CONTINUA. Riepilogo soltanto alla fine; nessun totale m²; data, ora e firma di trasporto vuote.

Differenze intenzionali: identificativo `X-Lam/ANTEPRIMA/anno`, avviso rosso `ANTEPRIMA — NON VALIDO COME DDT` al posto della dicitura FACSIMILE; altezze dinamiche per testi lunghi e gruppi reali. L'anno e la data documento sono quelli correnti in Europe/Rome. Nessuna emissione definitiva o archiviazione.

Distribuire backend/assets/ddt insieme a backend/dist. Il percorso produzione non carica il generatore e non espone l'endpoint.

## Verifiche ripetibili

Da PowerShell nella radice:

```powershell
$env:DDT_PREVIEW_QA_DIR = "$PWD/.verification/ddt"
npm.cmd --prefix backend run test:ddt-preview
python scripts/check-ddt-preview-pdfs.py
npm.cmd --prefix backend test
npm.cmd --prefix backend run type-check
npm.cmd --prefix frontend run type-check
```

Il controllo PDF richiede PyMuPDF e verifica file da 4, 20 e 80 elementi (1, 2 e 6 pagine), codici univoci, testi, intestazioni, footer e limiti pagina. Produce PNG per l'ispezione visiva. Le fixture sono dati sintetici in database temporanei, eliminati alla fine dei test.

Per controllare i DEMO già presenti in TEST, senza migrazioni o scritture:

```powershell
npm.cmd --prefix backend run build
node backend/scripts/check-ddt-preview-test-data.mjs
```

Questo script apre soltanto backend/data/sistema-logistico-test.sqlite con readOnly:true e salva il report in .verification/ddt/test-data. Non completa automaticamente dati mancanti nel database TEST.

## Riconoscimento cliente in TEST

Abilitato dal backend soltanto con environment=test, e nell'interfaccia con VITE_SISLOG_TEST. Durante creazione/modifica della pianificazione (anche cambio data o collegamento al carico), se manca customerId si cerca il nome del cliente del carico importato in Customers.denominazione. Sono ignorati solo maiuscole/minuscole e spazi superflui, senza eliminare punteggiatura o accenti. Una sola corrispondenza viene salvata nella transazione della pianificazione e compare nell'audit. Per pianificazioni manuali non ancora collegate si usa il nome cliente inserito.

Un collegamento già presente resta conservato, anche se il modulo invia null; una diversa selezione manuale esplicita può sostituirlo. Con zero o più corrispondenze non si sceglie alcun cliente: il Calendario richiede la selezione manuale per il DDT. La pianificazione incompleta può ancora essere salvata, senza introdurre un obbligo anagrafico per tutte le operazioni logistiche.

Per i piani preesistenti senza collegamento, l'anteprima usa lo stesso riconoscimento in una transazione di sola lettura. Non aggiorna customerId e non crea eventi. In caso di assenza o ambiguità restituisce un errore esplicito. Un customerId esistente, anche se non più leggibile, non viene sostituito con un cliente omonimo. Il nome cliente originale della commessa resta nel DDT; la partita IVA proviene dall'anagrafica così individuata. Layout, progressivo provvisorio e conferma partenza non cambiano.

Verifica SL-2604 del 16/10/2026: customerId ancora NULL, ultima modifica pianificazione registrata il 14/09/2026; l'audit disponibile non contiene una selezione anagrafica. Non è possibile ricostruire dal solo database un tentativo non persistito. Il salvataggio frontend ora mostra il messaggio effettivo del backend anziché un errore generico. Con il nuovo fallback Linea Forma Srl viene riconosciuto univocamente; l'anteprima prosegue fino al controllo successivo, che segnala la destinazione merce mancante.
