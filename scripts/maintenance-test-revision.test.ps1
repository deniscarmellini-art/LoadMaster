$ErrorActionPreference = 'Stop'
$verificationRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.verification'))
[System.IO.Directory]::CreateDirectory($verificationRoot) | Out-Null
$testDirectory = Join-Path $verificationRoot ("maintenance-revision-test-" + [Guid]::NewGuid().ToString('N'))
[System.IO.Directory]::CreateDirectory($testDirectory) | Out-Null
$statePath = Join-Path $testDirectory 'state.json'
$maintenanceCommand = Join-Path $PSScriptRoot 'maintenance-test.ps1'

try {
  [System.IO.File]::WriteAllText($statePath, '{"formatVersion":1,"updateRevision":4,"state":"idle","message":null,"scheduledAt":null}')

  & $maintenanceCommand -Action Resume -StatePath $statePath | Out-Null
  $state = [System.IO.File]::ReadAllText($statePath) | ConvertFrom-Json
  if ($state.updateRevision -ne 5) { throw "Resume expected revision 5, received $($state.updateRevision)." }

  & $maintenanceCommand -Action Schedule -StatePath $statePath | Out-Null
  $state = [System.IO.File]::ReadAllText($statePath) | ConvertFrom-Json
  if ($state.updateRevision -ne 5) { throw 'Schedule must not increment updateRevision.' }

  & $maintenanceCommand -Action Cancel -StatePath $statePath | Out-Null
  $state = [System.IO.File]::ReadAllText($statePath) | ConvertFrom-Json
  if ($state.updateRevision -ne 5) { throw 'Cancel must not increment updateRevision.' }

  & $maintenanceCommand -Action Resume -StatePath $statePath | Out-Null
  $state = [System.IO.File]::ReadAllText($statePath) | ConvertFrom-Json
  if ($state.updateRevision -ne 6) { throw "Second Resume expected revision 6, received $($state.updateRevision)." }

  Write-Output 'PASS: Resume increments updateRevision; Schedule and Cancel preserve it.'
} finally {
  $resolvedTempRoot = $verificationRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  $resolvedTestDirectory = [System.IO.Path]::GetFullPath($testDirectory)
  if (-not $resolvedTestDirectory.StartsWith($resolvedTempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Test cleanup path escaped .verification.'
  }
  if ([System.IO.File]::Exists($statePath)) { [System.IO.File]::Delete($statePath) }
  if ([System.IO.Directory]::Exists($testDirectory)) { [System.IO.Directory]::Delete($testDirectory) }
}
