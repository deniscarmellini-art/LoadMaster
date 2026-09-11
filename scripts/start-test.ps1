$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    & node (Join-Path $PSScriptRoot "start-test.mjs")
    if ($LASTEXITCODE -ne 0) { throw "Avvio TEST fallito ($LASTEXITCODE)" }
}
finally { Pop-Location }
