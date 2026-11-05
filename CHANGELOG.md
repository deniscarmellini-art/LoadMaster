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
