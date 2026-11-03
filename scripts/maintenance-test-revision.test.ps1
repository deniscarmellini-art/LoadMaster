$ErrorActionPreference = 'Stop'
$verificationRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.verification'))
[System.IO.Directory]::CreateDirectory($verificationRoot) | Out-Null
$testDirectory = Join-Path $verificationRoot ("maintenance-revision-test-" + [Guid]::NewGuid().ToString('N'))
[System.IO.Directory]::CreateDirectory($testDirectory) | Out-Null
$maintenanceCommand = Join-Path $PSScriptRoot 'maintenance-test.ps1'
$oldProgramData = $env:ProgramData
$junctionPaths = [System.Collections.Generic.List[string]]::new()

function Assert-CommandRejected([scriptblock]$CommandBlock, [string]$FailureMessage) {
  $failed = $false
  try { & $CommandBlock | Out-Null } catch { $failed = $true }
  if (-not $failed) { throw $FailureMessage }
}

try {
  # The TEST script derives its only state path from this temporary ProgramData.
  $env:ProgramData = $testDirectory
  $testStateDirectory = Join-Path $testDirectory 'SisLog\TEST'
  $prodStateDirectory = Join-Path $testDirectory 'SisLog\PROD'
  [System.IO.Directory]::CreateDirectory($testStateDirectory) | Out-Null
  [System.IO.Directory]::CreateDirectory($prodStateDirectory) | Out-Null
  $statePath = Join-Path $testStateDirectory 'maintenance-state.json'
  $prodStatePath = Join-Path $prodStateDirectory 'maintenance-state.json'
  [System.IO.File]::WriteAllText($statePath, '{"formatVersion":1,"updateRevision":4,"state":"idle","message":null,"scheduledAt":null}')
  $prodSentinel = '{"formatVersion":1,"updateRevision":77,"state":"idle","message":null,"scheduledAt":null}'
  [System.IO.File]::WriteAllText($prodStatePath, $prodSentinel)
  $prodHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $prodStatePath).Hash

  & $maintenanceCommand -Action Resume | Out-Null
  $state = [System.IO.File]::ReadAllText($statePath) | ConvertFrom-Json
  if ($state.updateRevision -ne 5) { throw "Resume expected revision 5, received $($state.updateRevision)." }

  & $maintenanceCommand -Action Schedule | Out-Null
  $state = [System.IO.File]::ReadAllText($statePath) | ConvertFrom-Json
  $remaining = ([DateTimeOffset]::Parse($state.scheduledAt) - [DateTimeOffset]::UtcNow).TotalSeconds
  if ($state.state -ne 'scheduled' -or $state.updateRevision -ne 5 -or $remaining -lt 110 -or $remaining -gt 130) { throw 'Schedule must preserve the revision and use the two-minute countdown.' }

  & $maintenanceCommand -Action Cancel | Out-Null
  $state = [System.IO.File]::ReadAllText($statePath) | ConvertFrom-Json
  if ($state.updateRevision -ne 5 -or $state.state -ne 'idle') { throw 'Cancel must preserve the revision and restore idle.' }

  & $maintenanceCommand -Action Resume | Out-Null
  $state = [System.IO.File]::ReadAllText($statePath) | ConvertFrom-Json
  if ($state.updateRevision -ne 6) { throw "Second Resume expected revision 6, received $($state.updateRevision)." }

  # Arbitrary absolute and relative paths are no longer accepted parameters.
  Assert-CommandRejected { & $maintenanceCommand -Action Schedule -StatePath $prodStatePath } 'The TEST script accepted a PROD StatePath.'
  Assert-CommandRejected { & $maintenanceCommand -Action Schedule -StatePath '..\PROD\maintenance-state.json' } 'The TEST script accepted a relative StatePath.'
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $prodStatePath).Hash -ne $prodHash) { throw 'An alternate-path attempt changed the PROD sentinel.' }

  # A TEST path redirected to a PROD directory junction is rejected before file access/write.
  $junctionProgramData = Join-Path $testDirectory 'junction-test-programdata'
  $junctionProdDirectory = Join-Path $junctionProgramData 'SisLog\PROD'
  $junctionTestDirectory = Join-Path $junctionProgramData 'SisLog\TEST'
  [System.IO.Directory]::CreateDirectory($junctionProdDirectory) | Out-Null
  $junctionProdState = Join-Path $junctionProdDirectory 'maintenance-state.json'
  [System.IO.File]::WriteAllText($junctionProdState, $prodSentinel)
  New-Item -ItemType Junction -Path $junctionTestDirectory -Value $junctionProdDirectory | Out-Null
  $junctionPaths.Add($junctionTestDirectory)
  $junctionHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $junctionProdState).Hash
  $env:ProgramData = $junctionProgramData
  Assert-CommandRejected { & $maintenanceCommand -Action Schedule } 'The TEST script followed a TEST-to-PROD junction.'
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $junctionProdState).Hash -ne $junctionHash) { throw 'A TEST-to-PROD junction attempt changed the PROD sentinel.' }

  # A PROD path redirected to the TEST directory is also rejected.
  $reverseProgramData = Join-Path $testDirectory 'junction-prod-programdata'
  $reverseTestDirectory = Join-Path $reverseProgramData 'SisLog\TEST'
  $reverseProdDirectory = Join-Path $reverseProgramData 'SisLog\PROD'
  [System.IO.Directory]::CreateDirectory($reverseTestDirectory) | Out-Null
  New-Item -ItemType Junction -Path $reverseProdDirectory -Value $reverseTestDirectory | Out-Null
  $junctionPaths.Add($reverseProdDirectory)
  $env:ProgramData = $reverseProgramData
  Assert-CommandRejected { & $maintenanceCommand -Action Schedule } 'The TEST script accepted a PROD-to-TEST junction.'

  Write-Output 'PASS: TEST Schedule/Cancel/Resume; revision/countdown; arbitrary path rejection; both PROD/TEST junction directions rejected without changing PROD sentinels.'
} finally {
  $env:ProgramData = $oldProgramData
  foreach ($junctionPath in $junctionPaths) {
    if ([System.IO.Directory]::Exists($junctionPath)) { [System.IO.Directory]::Delete($junctionPath) }
  }
  $resolvedTestDirectory = [System.IO.Path]::GetFullPath($testDirectory)
  $resolvedVerificationRoot = $verificationRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $resolvedTestDirectory.StartsWith($resolvedVerificationRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Test cleanup path escaped .verification.'
  }
  if ([System.IO.Directory]::Exists($testDirectory)) { Remove-Item -LiteralPath $testDirectory -Recurse -Force }
}
