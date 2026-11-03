param(
  [ValidateSet('Schedule', 'Cancel', 'Resume')]
  [string]$Action = 'Schedule'
)

$ErrorActionPreference = 'Stop'
if ($args.Count -gt 0) {
  throw 'Parametri aggiuntivi non supportati. Lo script TEST usa solo il percorso fisso ProgramData\SisLog\TEST.'
}
$programData = $env:ProgramData
if ([string]::IsNullOrWhiteSpace($programData) -or -not [System.IO.Path]::IsPathRooted($programData)) {
  throw 'ProgramData non valido; nessuna azione eseguita.'
}
$programData = [System.IO.Path]::GetFullPath($programData)
$fullPath = [System.IO.Path]::GetFullPath((Join-Path $programData 'SisLog\TEST\maintenance-state.json'))
$productionPath = [System.IO.Path]::GetFullPath((Join-Path $programData 'SisLog\PROD\maintenance-state.json'))
if ($fullPath.Equals($productionPath, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'I percorsi di manutenzione TEST e PROD coincidono; nessuna azione eseguita.'
}

function Assert-NoReparsePointInPath([string]$Path) {
  $resolved = [System.IO.Path]::GetFullPath($Path)
  $root = [System.IO.Path]::GetPathRoot($resolved)
  $current = $root
  $segments = $resolved.Substring($root.Length).Split([char[]]@('\', '/'), [System.StringSplitOptions]::RemoveEmptyEntries)
  foreach ($segment in $segments) {
    $current = Join-Path $current $segment
    if ([System.IO.File]::Exists($current) -or [System.IO.Directory]::Exists($current)) {
      $entry = Get-Item -LiteralPath $current -Force
      if (($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Il percorso manutenzione contiene un junction o collegamento non consentito: $current. Nessuna azione eseguita."
      }
    }
  }
}

# Check both fixed environment paths before creating directories or reading state.
Assert-NoReparsePointInPath $fullPath
Assert-NoReparsePointInPath $productionPath
$directory = [System.IO.Path]::GetDirectoryName($fullPath)
[System.IO.Directory]::CreateDirectory($directory) | Out-Null
Assert-NoReparsePointInPath $fullPath
Assert-NoReparsePointInPath $productionPath

$existingScheduleExpired = $false
$updateRevision = 0
if ([System.IO.File]::Exists($fullPath)) {
  $existing = $null
  try {
    $existing = [System.IO.File]::ReadAllText($fullPath) | ConvertFrom-Json
  } catch {
    if ($Action -eq 'Schedule') { throw 'File di manutenzione TEST non leggibile; non programmo un nuovo avviso.' }
    # Resume/Cancel can still recover a malformed TEST state; absent revision starts at zero.
  }
  if ($null -ne $existing) {
    if ($existing.PSObject.Properties.Name -contains 'updateRevision') {
      if (($existing.updateRevision -isnot [int] -and $existing.updateRevision -isnot [long]) -or $existing.updateRevision -lt 0) {
        throw 'Revisione aggiornamento non valida nel file di manutenzione.'
      }
      $updateRevision = [long]$existing.updateRevision
    }
    if ($existing.formatVersion -eq 1 -and $existing.state -eq 'scheduled' -and $existing.scheduledAt) {
      $existingScheduleExpired = [DateTimeOffset]::Parse($existing.scheduledAt).ToUniversalTime() -le [DateTimeOffset]::UtcNow
    }
  }
}
if ($Action -eq 'Schedule' -and $existingScheduleExpired) {
  throw 'La manutenzione e gia in corso. Usa -Action Resume per riaprire SisLog TEST prima di programmare un nuovo avviso.'
}
if ($Action -eq 'Cancel' -and $existingScheduleExpired) {
  throw 'La manutenzione e gia in corso. Usa -Action Resume per riabilitare SisLog TEST.'
}

if ($Action -eq 'Schedule') {
  $state = [ordered]@{
    formatVersion = 1
    updateRevision = $updateRevision
    state = 'scheduled'
    message = 'Aggiornamento SisLog TEST programmato'
    scheduledAt = [DateTimeOffset]::UtcNow.AddMinutes(2).ToString('O')
  }
} else {
  if ($Action -eq 'Resume') { $updateRevision++ }
  $state = [ordered]@{
    formatVersion = 1
    updateRevision = $updateRevision
    state = 'idle'
    message = $null
    scheduledAt = $null
  }
}

$temporaryPath = "$fullPath.$([Guid]::NewGuid().ToString('N')).tmp"
$backupPath = "$temporaryPath.bak"
$json = $state | ConvertTo-Json -Compress
$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
try {
  Assert-NoReparsePointInPath $fullPath
  Assert-NoReparsePointInPath $productionPath
  [System.IO.File]::WriteAllText($temporaryPath, $json, $utf8WithoutBom)
  Assert-NoReparsePointInPath $fullPath
  Assert-NoReparsePointInPath $productionPath
  if ([System.IO.File]::Exists($fullPath)) {
    [System.IO.File]::Replace($temporaryPath, $fullPath, $backupPath)
    [System.IO.File]::Delete($backupPath)
  } else {
    [System.IO.File]::Move($temporaryPath, $fullPath)
  }
} finally {
  if ([System.IO.File]::Exists($temporaryPath)) { [System.IO.File]::Delete($temporaryPath) }
  if ([System.IO.File]::Exists($backupPath)) { [System.IO.File]::Delete($backupPath) }
}

if ($Action -eq 'Schedule') {
  Write-Output "Avviso TEST programmato per $($state.scheduledAt) UTC. File: $fullPath"
} elseif ($Action -eq 'Cancel') {
  Write-Output "Avviso TEST annullato. File: $fullPath"
} else {
  Write-Output "Manutenzione TEST terminata; operazioni riabilitate. File: $fullPath"
}
