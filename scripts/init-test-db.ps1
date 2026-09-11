param([switch]$Refresh)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    if ($Refresh) { & node scripts/init-test-db.mjs --refresh }
    else { & node scripts/init-test-db.mjs }
    if ($LASTEXITCODE -ne 0) { throw "Inizializzazione TEST fallita ($LASTEXITCODE)" }
}
finally { Pop-Location }
