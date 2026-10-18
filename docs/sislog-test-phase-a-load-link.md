# SISLOG TEST — Fase A: collegamento pianificazioni/carichi

Il Calendario mostra il collegamento, il numero camion/carico e il loadId completo. Carico camion legge solo l'unica pianificazione persistita collegata al loadId selezionato. Nessun fallback per commessa/camion; zero o più piani collegati generano un avviso senza selezionare dati alternativi. Nessuna migrazione o modifica ai dati esistenti.

## Importazioni: rilievo prima di eventuali modifiche

Alla prima consegna della Fase A era rimasto invariato questo comportamento preesistente:
- `backend/src/services/loadService.ts`, metodo `import`, chiama `reconcileShipments`.
- `backend/src/repositories/loadRepository.ts`, aggiornamento import, chiama la stessa riconciliazione.
- `backend/src/repositories/shipmentReconciliation.ts` collega automaticamente i piani manuali quando trova un candidato unico usando commessa e camion normalizzati; in assenza di camion usa la sola commessa. Esclude candidati multipli, carichi già pianificati, piani concorrenti e partenze consolidate.

Queste protezioni evitano i conflitti rilevati, ma l'unicità del candidato al momento dell'import non prova l'intenzione dell'utente. Un'importazione parziale può collegare un piano prima che arrivino altri carichi della stessa commessa.

Il rilievo precedente descrive il comportamento prima del completamento autorizzato della Fase A. Le chiamate automatiche sono ora rimosse dai percorsi di importazione iniziale, aggiornamento carico e aggiornamento commessa.

## Completamento: conferma esplicita dei suggerimenti

Verificati prima dell'intervento schema, importazioni, test e collegamento manuale esistente. L'import non contiene un identificativo condiviso della pianificazione. Il vincolo commessa/camion vale solo per i carichi attivi e non certifica l'identità della spedizione. I vecchi test prevedevano anche abbinamenti senza camion: non è una garanzia sufficiente per mantenerli automatici.

- `reconcileManualShipments` rimane compatibile come sola anteprima, senza scritture; `SUGGESTION` sostituisce `MATCH`. Il comando di manutenzione è di sola lettura e rifiuta `--apply` prima di aprire il database.
- Creare una pianificazione direttamente da un carico tramite `loadId` resta invariato. Non sono eseguite migrazioni o correzioni dei collegamenti esistenti.
- Nel dialogo di una pianificazione manuale non partita sono visibili i carichi disponibili della stessa commessa, anche se il numero camion differisce. Il testo suggerisce soltanto; ogni candidato mostra numero, cliente e ID completo. Carichi occupati o spediti sono esclusi. La mancanza di candidati è segnalata.
- Riutilizzato `linkShipment` / `PATCH /shipments/:id/link`, senza un secondo endpoint o meccanismo. La conferma nomina piano e ID del carico scelto. Le modifiche non salvate disabilitano il collegamento.
- Il backend serializza verifica e scrittura con `BEGIN IMMEDIATE`: controlla esistenza, conflitti e partenze consolidate. Una relazione già esistente non è sostituibile; confermare di nuovo lo stesso ID è idempotente. Errori dal backend sono mostrati all'operatore, anche se la disponibilità è cambiata dopo il suggerimento.
- Importazioni parziali o ripetute non aggiornano ShipmentPlans; più carichi della stessa commessa restano distinti. Stati, partenza, assegnazioni fisiche e modulo DDT non sono modificati.

Test aggiornati per confermare esplicitamente i piani prima di verificare indirizzo, trasporto e partenza. Nuovi casi coprono suggerimenti singoli/multipli, occupati e spediti, conflitti, ID mancanti, divieto di ricollegamento, conferme ripetute, duplicati, importazioni parziali/ripetute e piani creati direttamente da ID. Tutte le scritture di verifica usano database in memoria o temporanei; nessun accesso in scrittura ai dati TEST/DEMO esistenti.

## Verifiche

TypeScript backend/frontend. Test frontend: shipment-load-link, shipment-calendar-presentation, truck-loading-header, import-manifest (17 casi). Test backend mirati a pianificazioni e riconciliazione con database in memoria o temporanei. Nessun avvio DEMO, commit, push o deploy.

Completamento autorizzato: controllo TypeScript backend/frontend e `git diff --check` superati; suite backend integrale `npm --prefix backend test`: **190/190**; test frontend precedenti più shipment-link-suggestions: **19/19**. Verificata anche la sintassi del comando di anteprima. Nessuna modifica ai dati TEST/DEMO esistenti.
