$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendPath = Join-Path $projectRoot "frontend"
$backendPath = Join-Path $projectRoot "backend"
$frontendIndex = Join-Path $frontendPath "dist\index.html"
$backendDist = Join-Path $backendPath "dist"

function Invoke-NpmCommand {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    Push-Location $WorkingDirectory
    try {
        & npm.cmd @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Comando npm fallito in $WorkingDirectory con codice $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host "[1/4] Installazione dipendenze frontend..."
Invoke-NpmCommand -WorkingDirectory $frontendPath -Arguments @("ci")

Write-Host "[2/4] Build frontend di produzione..."
Invoke-NpmCommand -WorkingDirectory $frontendPath -Arguments @("run", "build")

Write-Host "[3/4] Installazione dipendenze backend..."
Invoke-NpmCommand -WorkingDirectory $backendPath -Arguments @("ci")

Write-Host "[4/4] Build backend..."
Invoke-NpmCommand -WorkingDirectory $backendPath -Arguments @("run", "build")

if (-not (Test-Path -LiteralPath $frontendIndex -PathType Leaf)) {
    throw "Build frontend incompleta: file non trovato $frontendIndex"
}
if (-not (Test-Path -LiteralPath $backendDist -PathType Container)) {
    throw "Build backend incompleta: cartella non trovata $backendDist"
}

Write-Host "Build di produzione completata correttamente." -ForegroundColor Green
Write-Host "Frontend: $frontendIndex"
Write-Host "Backend:  $backendDist"
