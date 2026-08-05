$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $projectRoot "backend"
$backendEnv = Join-Path $backendPath ".env"
$backendEntry = Join-Path $backendPath "dist\server.js"
$frontendIndex = Join-Path $projectRoot "frontend\dist\index.html"

if (-not (Test-Path -LiteralPath $backendEnv -PathType Leaf)) {
    throw "Configurazione mancante: copiare backend/.env.production.example in backend/.env e configurare i percorsi assoluti."
}
if ((Get-Item -LiteralPath $backendEnv).Length -eq 0) {
    throw "Configurazione vuota: copiare backend/.env.production.example in backend/.env e configurare i percorsi assoluti."
}
if (-not (Test-Path -LiteralPath $frontendIndex -PathType Leaf)) {
    throw "Frontend compilato non trovato: $frontendIndex. Eseguire scripts/build-production.ps1."
}
if (-not (Test-Path -LiteralPath $backendEntry -PathType Leaf)) {
    throw "Backend compilato non trovato: $backendEntry. Eseguire scripts/build-production.ps1."
}

$configuration = @{}
foreach ($line in Get-Content -LiteralPath $backendEnv) {
    if ($line -match '^\s*([^#][^=]*)=(.*)$') {
        $configuration[$matches[1].Trim()] = $matches[2].Trim()
    }
}

foreach ($requiredName in @("PORT", "HOST", "NODE_ENV", "DATABASE_URL", "FRONTEND_DIST_PATH")) {
    if (-not $configuration.ContainsKey($requiredName) -or [string]::IsNullOrWhiteSpace($configuration[$requiredName])) {
        throw "Variabile obbligatoria mancante in backend/.env: $requiredName"
    }
}
if ($configuration["NODE_ENV"] -ne "production") {
    throw "NODE_ENV deve essere production in backend/.env"
}

$port = 0
if (-not [int]::TryParse($configuration["PORT"], [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
    throw "PORT non valida in backend/.env: $($configuration['PORT'])"
}

$portInUse = $false
$tcpClient = New-Object System.Net.Sockets.TcpClient
try {
    $connectResult = $tcpClient.BeginConnect("127.0.0.1", $port, $null, $null)
    $portInUse = $connectResult.AsyncWaitHandle.WaitOne(500) -and $tcpClient.Connected
}
catch {
    $portInUse = $false
}
finally {
    $tcpClient.Close()
}

if ($portInUse) {
    $listenerLine = netstat -ano -p TCP | Where-Object { $_ -match "^\s*TCP\s+\S+:$port\s+\S+\s+LISTENING\s+(\d+)\s*$" } | Select-Object -First 1
    $ownerId = if ($listenerLine -and $listenerLine -match "LISTENING\s+(\d+)\s*$") { [int]$matches[1] } else { 0 }
    $owner = if ($ownerId) { Get-Process -Id $ownerId -ErrorAction SilentlyContinue } else { $null }
    $ownerLabel = if ($owner) { "$($owner.ProcessName) (PID $($owner.Id))" } elseif ($ownerId) { "PID $ownerId" } else { "un altro processo" }
    throw "La porta $port e gia in uso da $ownerLabel. Arrestare il processo precedente oppure configurare un'altra porta."
}

$serverName = if ($env:COMPUTERNAME) { $env:COMPUTERNAME } else { "NOME-SERVER" }

Write-Host "Avvio SisLog in modalita produzione..." -ForegroundColor Green
Write-Host "URL operatori: http://${serverName}:$port"
Write-Host "API health:    http://${serverName}:$port/api/health"
Write-Host "Ingresso:      $backendEntry"

Push-Location $backendPath
try {
    & node "dist/server.js"
    if ($LASTEXITCODE -ne 0) {
        throw "Il backend SisLog si e arrestato con codice $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}
