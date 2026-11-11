# Registro versioni SisLog

Questo registro riporta le versioni applicative pubblicate. La data e il riferimento Git indicano il rilascio effettivo, non la data di un commit non verificato.

## [1.0.0] - data e commit non verificati

Stato: versione attualmente identificata in PROD dal footer precedente, che mostrava `Versione 1.0`. Il codice la normalizza a `1.0.0`; non vengono attribuiti retroattivamente una data o un commit.

### Note

- Versione applicativa di riferimento mantenuta dal codice frontend.

## [1.1.0] - NON ANCORA PUBBLICATA

Stato: in preparazione per il primo aggiornamento controllato. Non è ancora disponibile agli utenti.

Data di rilascio, commit distribuito e note definitive saranno registrati soltanto dopo la pubblicazione effettiva.

## [1.1.1] - NON ANCORA RILASCIATA

Candidato di collaudo: nessuna pubblicazione o modifica della produzione attiva.

- Promosse le migliorie operative di Scansione, import QR offline, aggiornamenti locali e controllo revisioni.
- Promossi layout Carico camion, controlli trasporto, ricerca cliente con conferma esplicita e calendario Europe/Rome con filtro settimane completate.
- Abilitata esportazione pianificazioni PDF/Excel anche in produzione.
- Allineati anteprima e download DDT, nome file e continuazione compatta; invariati emissione, numerazione, archiviazione e requestKey.
- Trasportatore modificabile alla conferma partenza, con validazioni esistenti.
- Simulatore QR, fascia ambiente e strumenti di prova rimangono TEST; nessuna associazione cliente implicita nei salvataggi di pianificazione.

## [1.1.2] - NON ANCORA RILASCIATA

Candidato correttivo SFRIDO; nessun deploy o rettifica dei dati PROD eseguiti.

- Classificazione esplicita come lotto sfuso del solo elemento SFRIDO verificato del pacco PK-2026-000240, commessa 265852; nessuna eccezione automatica per elementi omonimi.
- Anteprima e PDF DDT: 1 lotto, misure e peso non disponibili; 520 kg e 1,040 m³ dei cinque pannelli indicati come dati noti parziali, senza dichiararli totali dell'intero carico.
- Invariate validazioni ordinarie, numerazione DDT, requestKey, PDF archiviati, annullamento e manutenzione.
- Aggiunti test di regressione e procedura separata di rettifica quantità, subordinata ad autorizzazione, backup e installazione software. Nessuna rettifica automatica o migrazione.
