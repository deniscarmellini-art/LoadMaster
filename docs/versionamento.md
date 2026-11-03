# Versionamento dei rilasci SisLog

## Fonte e visualizzazione

La versione applicativa frontend ha una sola fonte: `frontend/package.json`, campo `version`. Vite la incorpora nella build e il footer la mostra come `Versione X.Y.Z By C.D.`. `frontend/package-lock.json` riporta lo stesso valore per coerenza con npm. La versione API restituita dal backend e un identificativo distinto dell'API e non determina il footer.

## Procedura per ogni rilascio

1. Scegliere il nuovo numero SemVer in `frontend/package.json` e aggiornare il campo corrispondente in `frontend/package-lock.json`. Non aggiornare la versione automaticamente a ogni commit o push.
2. Preparare o completare la sezione della versione in `CHANGELOG.md`, elencando soltanto le modifiche incluse nel rilascio.
3. Dopo la pubblicazione effettiva, annotare la data in cui la versione e diventata disponibile agli utenti e l'hash del commit Git realmente distribuito. Non usare la data di preparazione o un commit solo previsto.
4. Verificare il footer nella build isolata prima della distribuzione. La build ordinaria di verifica non deve scrivere in `frontend/dist`.
5. Creare il tag annotato `vX.Y.Z` sul commit verificato come effettivamente distribuito, per esempio:

   ```powershell
   git tag -a v1.2.0 <hash-commit-distribuito> -m "SisLog 1.2.0"
   ```

   Il tag si crea soltanto per un rilascio completato; non e creato automaticamente da commit o push.

## Riferimento storico 1.0.0

La produzione e stata identificata tramite il footer precedente `Versione 1.0`. Il numero e normalizzato nel codice a `1.0.0`; le prove disponibili non stabiliscono la data di rilascio o il commit distribuito. Questi dati restano indicati come non verificati in `CHANGELOG.md` e non vanno ricostruiti per supposizione.
