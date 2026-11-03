$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendPath = Join-Path $projectRoot "frontend"
$backendPath = Join-Path $projectRoot "backend"
$frontendIndex = Join-Path $projectRoot ".verification\frontend-release\index.html"
$backendDist = Join-Path $backendPath ".release-candidate"
$backendPackage = Join-Path $projectRoot ".verification\ddt-release-1.1.0\backend"
$backendPackageDist = Join-Path $backendPackage "dist"
$backendPackageAssets = Join-Path $backendPackage "assets\ddt"
$ddtAssets = Join-Path $backendPath "assets\ddt"

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
foreach ($asset in @("essepi-v3.png", "DejaVuSans.ttf", "DejaVuSans-Bold.ttf")) {
    if (-not (Test-Path -LiteralPath (Join-Path $ddtAssets $asset) -PathType Leaf)) {
        throw "Asset DDT richiesto non trovato: $(Join-Path $ddtAssets $asset)"
    }
}

New-Item -ItemType Directory -Path $backendPackageDist -Force | Out-Null
New-Item -ItemType Directory -Path $backendPackageAssets -Force | Out-Null
Copy-Item -Path (Join-Path $backendDist "*") -Destination $backendPackageDist -Recurse -Force
Copy-Item -Path (Join-Path $ddtAssets "*") -Destination $backendPackageAssets -Recurse -Force
foreach ($asset in @("essepi-v3.png", "DejaVuSans.ttf", "DejaVuSans-Bold.ttf")) {
    $sourceHash = (Get-FileHash -LiteralPath (Join-Path $ddtAssets $asset) -Algorithm SHA256).Hash
    $candidateHash = (Get-FileHash -LiteralPath (Join-Path $backendPackageAssets $asset) -Algorithm SHA256).Hash
    if ($sourceHash -ne $candidateHash) { throw "Verifica hash asset DDT fallita: $asset" }
}

Write-Host "Candidato di rilascio compilato. Nessun file dist attivo e nessun servizio sono stati modificati." -ForegroundColor Green
Write-Host "Frontend candidato: $frontendIndex"
Write-Host "Backend compilato:  $backendDist"
Write-Host "Backend con asset:  $backendPackage"
