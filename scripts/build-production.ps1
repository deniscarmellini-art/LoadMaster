$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendPath = Join-Path $projectRoot "frontend"
$backendPath = Join-Path $projectRoot "backend"
$frontendIndex = Join-Path $projectRoot ".verification\frontend-release\index.html"
$backendDist = Join-Path $backendPath ".release-candidate"

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

Write-Host "[1/2] Compilazione candidato frontend (nessuna pubblicazione)..."
Invoke-NpmCommand -WorkingDirectory $frontendPath -Arguments @("run", "build:production")

Write-Host "[2/2] Compilazione candidato backend (nessuna pubblicazione)..."
Invoke-NpmCommand -WorkingDirectory $backendPath -Arguments @("run", "build:production")

if (-not (Test-Path -LiteralPath $frontendIndex -PathType Leaf)) {
    throw "Build frontend incompleta: file non trovato $frontendIndex"
}
if (-not (Test-Path -LiteralPath $backendDist -PathType Container)) {
    throw "Build backend incompleta: cartella non trovata $backendDist"
}

Write-Host "Candidato di rilascio compilato. Nessun file dist attivo e nessun servizio sono stati modificati." -ForegroundColor Green
Write-Host "Frontend candidato: $frontendIndex"
Write-Host "Backend candidato:  $backendDist"
