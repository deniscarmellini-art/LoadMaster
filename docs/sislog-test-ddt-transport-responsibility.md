# TEST — responsabilità del trasporto DDT

La responsabilità documentale deriva esclusivamente dalla modalità effettiva salvata in `LoadingSessions.transportMode`:

| Modalità | Dicitura | Vettore effettivo |
| --- | --- | --- |
| BILICO_ESSEPI | Trasporto a cura del mittente | Conserva i controlli esistenti su vettore e rimorchio assegnato |
| RITIRA_CLIENTE | Trasporto a cura del destinatario | Non obbligatorio; non viene usato come responsabile del trasporto |
| TERZI_PER_ESSEPI | Trasporto a cura del vettore | Obbligatorio per DDT e partenza, selezionato esplicitamente |

Si riutilizza `LoadingSessions.carrierId` per il vettore effettivo di Conto terzi. Il tipo di mezzo/modalità di dettaglio resta distinto in `transportDetailId`. Nessuna migrazione o modifica dei dati esistenti.

`documentTransport` espone responsabilità, dicitura e anagrafica effettiva come regola condivisibile con la futura emissione definitiva. L'anteprima la applica senza scritture e senza recuperare vettori o modalità dal Calendario. Una modalità effettiva assente deve essere confermata in Carico camion; non viene inferita dai dati pianificati.

Carico camion consente la selezione esplicita del vettore Conto terzi; la Dashboard riutilizza il servizio di partenza esistente e consente di confermarlo nella stessa transazione. Il completamento può ancora lasciare il carico in attesa senza vettore: non cambiano le transizioni, le risorse fisiche o il blocco DDT (non ancora introdotto).

Renderer PDF, numerazione, materiale, totali e piè di pagina restano invariati. La nuova dicitura utilizza il riquadro dei dati di trasporto esistente.

Le verifiche usano database in memoria o temporanei; nessun dato TEST/DEMO esistente viene modificato.

Verifica del 17/10/2026: TypeScript backend/frontend superato; 204 test backend e 61 frontend superati. Ripetuti con esito positivo i test di conferma senza fallback dal vettore pianificato (3) e quelli frontend della Dashboard/partenza (6). Controllati i PDF con 4, 20 e 80 elementi e testi lunghi: rispettivamente 1, 3, 7 e 10 pagine, senza elementi duplicati o tagli; ispezionate visivamente la pagina singola e l'ultima pagina con testi lunghi. `git diff --check` superato.
