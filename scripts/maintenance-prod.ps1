param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Init', 'Schedule', 'Cancel', 'Resume')]
  [string]$Action,
  [string]$BackendIdentity,
  [string]$OperatorIdentity
)

$ErrorActionPreference = 'Stop'
$statePath = [System.IO.Path]::GetFullPath((Join-Path $env:ProgramData 'SisLog\PROD\maintenance-state.json'))
$directory = [System.IO.Path]::GetDirectoryName($statePath)
$lockPath = "$statePath.lock"
$administrators = 'S-1-5-32-544'
$system = 'S-1-5-18'

function Resolve-Sid([string]$Identity) {
  if ([string]::IsNullOrWhiteSpace($Identity)) { throw 'Specificare -BackendIdentity e -OperatorIdentity.' }
  try {
    if ($Identity -match '^S-\d(-\d+)+$') { return [System.Security.Principal.SecurityIdentifier]::new($Identity) }
    return ([System.Security.Principal.NTAccount]::new($Identity)).Translate([System.Security.Principal.SecurityIdentifier])
  } catch { throw "Identita Windows non valida o non risolvibile: $Identity ($($_.Exception.Message))" }
}

function Get-Identities {
  $script:backendSid = Resolve-Sid $BackendIdentity
  $script:operatorSid = Resolve-Sid $OperatorIdentity
  $allSids = @($system, $administrators, $script:backendSid.Value, $script:operatorSid.Value)
  if (($allSids | Select-Object -Unique).Count -ne 4) {
    throw 'Backend e gruppo operatori devono essere identita distinte da SYSTEM e Administrators.'
  }
  $script:systemSid = [System.Security.Principal.SecurityIdentifier]::new($system)
  $script:administratorsSid = [System.Security.Principal.SecurityIdentifier]::new($administrators)
}

function New-Rule([System.Security.Principal.SecurityIdentifier]$Sid, [System.Security.AccessControl.FileSystemRights]$Rights, [bool]$DirectoryRule) {
  $type = [System.Security.AccessControl.AccessControlType]::Allow
  if ($DirectoryRule) {
    $inheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
    return [System.Security.AccessControl.FileSystemAccessRule]::new($Sid, $Rights, $inheritance, [System.Security.AccessControl.PropagationFlags]::None, $type)
  }
  return [System.Security.AccessControl.FileSystemAccessRule]::new($Sid, $Rights, $type)
}

function Set-RestrictedAcl([string]$Path, [bool]$IsDirectory) {
  $acl = Get-Acl -LiteralPath $Path
  [void]$acl.SetAccessRuleProtection($true, $false)
  foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($rule) }
  if ($IsDirectory) {
    [void]$acl.AddAccessRule((New-Rule $script:systemSid ([System.Security.AccessControl.FileSystemRights]::FullControl) $true))
    [void]$acl.AddAccessRule((New-Rule $script:administratorsSid ([System.Security.AccessControl.FileSystemRights]::FullControl) $true))
    [void]$acl.AddAccessRule((New-Rule $script:backendSid ([System.Security.AccessControl.FileSystemRights]::ReadAndExecute) $true))
    [void]$acl.AddAccessRule((New-Rule $script:operatorSid ([System.Security.AccessControl.FileSystemRights]::Modify) $true))
  } else {
    [void]$acl.AddAccessRule((New-Rule $script:systemSid ([System.Security.AccessControl.FileSystemRights]::FullControl) $false))
    [void]$acl.AddAccessRule((New-Rule $script:administratorsSid ([System.Security.AccessControl.FileSystemRights]::FullControl) $false))
    [void]$acl.AddAccessRule((New-Rule $script:backendSid ([System.Security.AccessControl.FileSystemRights]::Read) $false))
    [void]$acl.AddAccessRule((New-Rule $script:operatorSid ([System.Security.AccessControl.FileSystemRights]::Modify) $false))
  }
  Set-Acl -LiteralPath $Path -AclObject $acl
}

function Assert-RestrictedAcl([string]$Path, [bool]$IsDirectory) {
  $acl = Get-Acl -LiteralPath $Path
  if (-not $acl.AreAccessRulesProtected) { throw "ACL non protetta dall'ereditarieta: $Path" }
  $rules = @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
  if ($rules.Count -ne 4) { throw "ACL non conforme: sono attese solo le quattro identita autorizzate in $Path" }
  $expected = [System.Collections.Generic.Dictionary[string, System.Security.AccessControl.FileSystemRights]]::new([System.StringComparer]::OrdinalIgnoreCase)
  $expected.Add($system, [System.Security.AccessControl.FileSystemRights]::FullControl)
  $expected.Add($administrators, [System.Security.AccessControl.FileSystemRights]::FullControl)
  $backendRights = if ($IsDirectory) { [System.Security.AccessControl.FileSystemRights]::ReadAndExecute } else { [System.Security.AccessControl.FileSystemRights]::Read }
  $synchronize = [System.Security.AccessControl.FileSystemRights]::Synchronize
  $expected.Add($script:backendSid.Value, ($backendRights -bor $synchronize))
  $expected.Add($script:operatorSid.Value, ([System.Security.AccessControl.FileSystemRights]::Modify -bor $synchronize))
  foreach ($rule in $rules) {
    $sid = $rule.IdentityReference.Value
    if (-not $expected.ContainsKey($sid)) { throw "Identita non autorizzata nell'ACL di $Path`: $sid" }
    if ($rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow -or $rule.FileSystemRights -ne $expected[$sid]) {
      throw "Permessi ACL non conformi per $sid in $Path"
    }
    if ($IsDirectory) {
      $wanted = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
      if ($rule.InheritanceFlags -ne $wanted -or $rule.PropagationFlags -ne [System.Security.AccessControl.PropagationFlags]::None) { throw "Ereditarieta ACL non conforme per $sid in $Path" }
    } elseif ($rule.InheritanceFlags -ne [System.Security.AccessControl.InheritanceFlags]::None -or $rule.PropagationFlags -ne [System.Security.AccessControl.PropagationFlags]::None) {
      throw "Il file di stato non deve propagare permessi: $Path"
    }
    [void]$expected.Remove($sid)
  }
  if ($expected.Count -ne 0) { throw "ACL incompleta: $Path" }
}

function Assert-CallerAuthorized {
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $callerSids = @($identity.User.Value) + @($identity.Groups | ForEach-Object { $_.Value })
  if ($identity.User.Value -ne $script:operatorSid.Value -and $callerSids -notcontains $script:operatorSid.Value -and $callerSids -notcontains $administrators) {
    throw "L'utente corrente non appartiene al gruppo operatori autorizzato: $OperatorIdentity"
  }
}

function Read-State {
  try { $state = [System.IO.File]::ReadAllText($statePath) | ConvertFrom-Json }
  catch { throw "File di manutenzione PROD assente o non leggibile: $statePath. Nessuna azione eseguita." }
  if ($null -eq $state -or $state.formatVersion -ne 1 -or $state.state -notin @('idle', 'scheduled')) {
    throw 'File di manutenzione PROD danneggiato o incompatibile. Nessuna azione eseguita.'
  }
  if ($state.PSObject.Properties.Name -contains 'updateRevision') {
    if (($state.updateRevision -isnot [int] -and $state.updateRevision -isnot [long]) -or $state.updateRevision -lt 0 -or $state.updateRevision -gt 9007199254740991) {
      throw 'Revisione aggiornamento PROD non valida. Nessuna azione eseguita.'
    }
    $script:updateRevision = [long]$state.updateRevision
  } else { $script:updateRevision = 0 }
  if ($state.state -eq 'idle') {
    if ($null -ne $state.scheduledAt -or $null -ne $state.message) { throw 'Stato idle PROD incoerente.' }
    $script:scheduledAt = $null
  } else {
    if ([string]::IsNullOrWhiteSpace([string]$state.message)) { throw 'Messaggio manutenzione PROD non valido.' }
    try { $script:scheduledAt = [DateTimeOffset]::Parse([string]$state.scheduledAt).ToUniversalTime() }
    catch { throw 'Scadenza manutenzione PROD non valida.' }
  }
  return $state
}

function Write-Atomic([object]$State) {
  $temporaryPath = "$statePath.$([guid]::NewGuid().ToString('N')).tmp"
  $backupPath = "$temporaryPath.bak"
  $json = $State | ConvertTo-Json -Compress
  $utf8 = [System.Text.UTF8Encoding]::new($false)
  try {
    $stream = [System.IO.File]::Open($temporaryPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try {
      $bytes = $utf8.GetBytes($json)
      $stream.Write($bytes, 0, $bytes.Length)
      $stream.Flush($true)
    } finally { $stream.Dispose() }
    Set-RestrictedAcl $temporaryPath $false
    [System.IO.File]::Replace($temporaryPath, $statePath, $backupPath)
    if ([System.IO.File]::Exists($backupPath)) { [System.IO.File]::Delete($backupPath) }
  } finally {
    if ([System.IO.File]::Exists($temporaryPath)) { [System.IO.File]::Delete($temporaryPath) }
    if ([System.IO.File]::Exists($backupPath)) { [System.IO.File]::Delete($backupPath) }
  }
}

function Acquire-StateLock {
  try { return [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None) }
  catch { throw "Un'altra azione manutenzione e in corso oppure manca il permesso di scrittura nella cartella PROD: $directory" }
}

Get-Identities
if ($Action -eq 'Init') {
  if ([System.IO.File]::Exists($statePath)) { throw "Init rifiutata: il file esiste gia e non verra sovrascritto: $statePath" }
  [System.IO.Directory]::CreateDirectory($directory) | Out-Null
  Set-RestrictedAcl $directory $true
}
elseif (-not [System.IO.File]::Exists($statePath)) {
  throw "File manutenzione PROD mancante. Eseguire prima Init; non verra creato automaticamente: $statePath"
}

$lock = Acquire-StateLock
try {
  if ($Action -eq 'Init') {
    if ([System.IO.File]::Exists($statePath)) { throw "Init rifiutata: il file e stato creato nel frattempo e non verra sovrascritto: $statePath" }
    Assert-RestrictedAcl $directory $true
    Assert-CallerAuthorized
    $initial = [ordered]@{ formatVersion = 1; updateRevision = 0; state = 'idle'; message = $null; scheduledAt = $null }
    $temporaryPath = "$statePath.$([guid]::NewGuid().ToString('N')).tmp"
    try {
      $json = $initial | ConvertTo-Json -Compress
      $stream = [System.IO.File]::Open($temporaryPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
      try {
        $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($json)
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush($true)
      } finally { $stream.Dispose() }
      Set-RestrictedAcl $temporaryPath $false
      [System.IO.File]::Move($temporaryPath, $statePath)
    } finally { if ([System.IO.File]::Exists($temporaryPath)) { [System.IO.File]::Delete($temporaryPath) } }
    Assert-RestrictedAcl $statePath $false
    Write-Output "File manutenzione PROD inizializzato in stato idle. Nessun file esistente e stato sostituito: $statePath"
    return
  }

  if (-not [System.IO.File]::Exists($statePath)) { throw "File manutenzione PROD assente; nessuna azione eseguita: $statePath" }
  Assert-RestrictedAcl $directory $true
  Assert-RestrictedAcl $statePath $false
  Assert-CallerAuthorized
  $existing = Read-State
  $now = [DateTimeOffset]::UtcNow

  switch ($Action) {
    'Schedule' {
      if ($existing.state -ne 'idle') {
        if ($script:scheduledAt -le $now) { throw 'La manutenzione PROD e gia iniziata. Usare Resume per riaprire il servizio.' }
        throw 'Esiste gia un avviso PROD programmato. Usare Cancel prima di riprogrammarlo.'
      }
      $next = [ordered]@{ formatVersion = 1; updateRevision = $script:updateRevision; state = 'scheduled'; message = 'Aggiornamento SisLog PROD programmato'; scheduledAt = $now.AddMinutes(2).ToString('O') }
      Write-Atomic $next
      Write-Output "Avviso PROD programmato per $($next.scheduledAt) UTC. File: $statePath"
    }
    'Cancel' {
      if ($existing.state -ne 'scheduled') { throw 'Nessun avviso PROD programmato da annullare.' }
      if ($script:scheduledAt -le $now) { throw 'La manutenzione PROD e gia iniziata. Cancel non riapre il servizio; usare Resume.' }
      $next = [ordered]@{ formatVersion = 1; updateRevision = $script:updateRevision; state = 'idle'; message = $null; scheduledAt = $null }
      Write-Atomic $next
      Write-Output "Avviso PROD annullato prima della scadenza. File: $statePath"
    }
    'Resume' {
      if ($existing.state -ne 'scheduled') { throw 'Resume e consentito solo se la manutenzione PROD programmata e iniziata.' }
      if ($script:scheduledAt -gt $now) { throw 'La manutenzione PROD non e ancora iniziata. Usare Cancel per annullare la programmazione.' }
      if ($script:updateRevision -ge 9007199254740991) { throw 'Revisione aggiornamento PROD esaurita.' }
      $next = [ordered]@{ formatVersion = 1; updateRevision = ($script:updateRevision + 1); state = 'idle'; message = $null; scheduledAt = $null }
      Write-Atomic $next
      Write-Output "Manutenzione PROD terminata; revisione $($next.updateRevision), operazioni riabilitate. File: $statePath"
    }
  }
} finally { $lock.Dispose() }
