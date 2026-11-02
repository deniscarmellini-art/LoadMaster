param(
  [ValidateSet('Schedule', 'Cancel', 'Resume')]
  [string]$Action = 'Schedule',
  [string]$StatePath = "$env:ProgramData\SisLog\TEST\maintenance-state.json"
)

$ErrorActionPreference = 'Stop'
$fullPath = [System.IO.Path]::GetFullPath($StatePath)
$directory = [System.IO.Path]::GetDirectoryName($fullPath)
[System.IO.Directory]::CreateDirectory($directory) | Out-Null

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
  [System.IO.File]::WriteAllText($temporaryPath, $json, $utf8WithoutBom)
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
