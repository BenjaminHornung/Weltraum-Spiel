param(
    [Parameter(Mandatory)][string]$TurnId,
    [Parameter(Mandatory)][long]$StartedAtUnixSeconds
)
$ErrorActionPreference = 'Stop'
$worktree = 'C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13'
$head = '6ac0f61947c5a6aa3e5b156831542d8188c75c0a'
$app = '01a13648-c55b-7250-bf07-34921d70b43b'
$templatePath = 'E:\DEV\Weltraum-Spiel\TARGET_PC\ROOT_AST_CRITICAL_CONTROLLER_SOURCE-20261021\R04_TEMPLATE.json'
$initialPath = 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R04_INITIAL_CONSUMED-20261021.json'
$taskPath = 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R04_FINAL_EXECUTION_TASK-20261021.json'
$approvalPath = 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R04_HUMAN_APPROVAL-20261021.json'
$consumptionPath = 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R04_GRANT_CONSUMED-20261021.json'
$readyPath = 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R04_ROOT_READY-20261021.json'
$pendingReadyPath = 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R04_ROOT_READY-20261021.json.pending'
$sourceRoot = Join-Path $worktree '.a0-runtime\benni-pc-core-material-poison-source-r01'
$evidenceRoot = Join-Path $worktree '.a0-runtime\benni-pc-core-material-poison-ast-once-r04'
$node = 'C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-other-pc-restored\Tooling\PortableNode\node.exe'
$compiler = 'C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\rt08-build-toolchain\node_modules\typescript\lib\typescript.js'
$pwsh = 'C:\IFI_SourceCode\Utils\PowerShell\pwsh.exe'
$git = 'C:\Program Files\Git\cmd\git.exe'
$utf8 = [Text.UTF8Encoding]::new($false, $true)
$spentR03Initial = 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R03_INITIAL_CONSUMED-20261021.json'
$spentR03Stop = 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R03_ROOT_STOP-20261021.json'

function Read-JsonPin([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "REQUIRED_FILE_MISSING:$Path" }
    $bytes = [IO.File]::ReadAllBytes($Path)
    $raw = $utf8.GetString($bytes)
    [ordered]@{ path = $Path; bytes = $bytes.Length; sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant(); rawText = $raw; json = ($raw | ConvertFrom-Json -AsHashtable) }
}
function Assert-Pin([string]$Path, [long]$Bytes, [string]$Sha256) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "PIN_MISSING:$Path" }
    $item = Get-Item -LiteralPath $Path
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($item.Length -ne $Bytes -or $actual -cne $Sha256) { throw "PIN_DRIFT:$Path" }
}
function Write-NewJson([string]$Path, $Value) {
    $raw = ($Value | ConvertTo-Json -Depth 12) + "`n"
    $bytes = $utf8.GetBytes($raw)
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    $actual = [IO.File]::ReadAllBytes($Path)
    if ($actual.Length -ne $bytes.Length -or $utf8.GetString($actual) -cne $raw) { throw "WRITE_READBACK_FAILED:$Path" }
    [ordered]@{ path = $Path; bytes = $actual.Length; sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant(); rawText = $raw }
}

Assert-Pin $spentR03Initial 887 '599a312eac120fd67fbde34a0764be372571801eacaea31eec5fc285eba6ab67'
Assert-Pin $spentR03Stop 1773 '684820da0cb3940b1e7f6439d8db63394af3d9a3ec5d295716d8b0f9e0c09623'

$initial = Read-JsonPin $initialPath
$pollEnd = [Math]::Min([long]$initial.json.rootStartedEpochMs + 90000, [long]$initial.json.rootAbsoluteEndEpochMs)
while (-not (Test-Path -LiteralPath $readyPath -PathType Leaf)) {
    if ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $pollEnd) { throw 'ROOT_READY_WAIT_EXPIRED' }
    Start-Sleep -Milliseconds 200
}
if ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $pollEnd) { throw 'ROOT_READY_ARRIVED_AFTER_POLL_DEADLINE' }
if (Test-Path -LiteralPath $pendingReadyPath) { throw 'ROOT_READY_PENDING_LEFTOVER' }
$task = Read-JsonPin $taskPath
$approval = Read-JsonPin $approvalPath
$consumption = Read-JsonPin $consumptionPath
$ready = Read-JsonPin $readyPath
$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
if ($StartedAtUnixSeconds -le 0 -or $StartedAtUnixSeconds -gt [long]::MaxValue / 1000) { throw 'ACTUAL_TURN_SECONDS_INVALID' }
$actualStartMs = [long]($StartedAtUnixSeconds * 1000)
if ($actualStartMs -gt $now -or $now -ge [long]$ready.json.appDeadlineEpochMs) { throw 'ACTUAL_TURN_CLOCK_INVALID_OR_EXPIRED' }
if ($ready.json.status -cne 'ROOT_READY_FINAL_CHAIN_FULLY_READ_BACK' -or $ready.json.ownerApp -cne $app -or $ready.json.turnId -cne $TurnId -or
    $ready.json.cwd -cne $worktree -or $ready.json.head -cne $head -or $ready.json.actualStartEpochMs -ne $actualStartMs -or
    $task.json.owner.turnId -cne $TurnId -or $task.json.owner.startedAtUnixSeconds -ne $StartedAtUnixSeconds -or $task.json.owner.cwd -cne $worktree -or
    $task.json.owner.head -cne $head -or $task.json.owner.app -cne $app -or $task.json.owner.appDeadlineEpochMs -ne $ready.json.appDeadlineEpochMs) { throw 'ACTUAL_TURN_BINDING_MISMATCH' }
if ($ready.json.taskSha256 -cne $task.sha256 -or $ready.json.approvalSha256 -cne $approval.sha256 -or
    $ready.json.initialConsumptionSha256 -cne $initial.sha256 -or $ready.json.finalConsumptionSha256 -cne $consumption.sha256 -or
    $approval.json.taskSha256 -cne $task.sha256 -or $approval.json.initialConsumptionSha256 -cne $initial.sha256 -or
    $consumption.json.taskSha256 -cne $task.sha256 -or $consumption.json.approvalSha256 -cne $approval.sha256 -or
    $consumption.json.initialConsumptionSha256 -cne $initial.sha256) { throw 'CONTROL_HASH_CHAIN_MISMATCH' }

$template = Read-JsonPin $templatePath
if ($template.sha256 -cne $initial.json.templateSha256 -or $template.json.status -cne 'PREPARED_SOURCE_ONLY_NO_CURRENT_AUTHORITY' -or
    $template.json.owner.app -cne $app -or $template.json.owner.worktree -cne $worktree -or $template.json.owner.head -cne $head) { throw 'TEMPLATE_BINDING_MISMATCH' }
foreach ($pin in $template.json.fixedReviewPins.sixSourcePins) { Assert-Pin ([IO.Path]::GetFullPath((Join-Path $worktree $pin.relative))) $pin.bytes $pin.sha256 }
Assert-Pin $node 86997320 '0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4'
Assert-Pin $compiler 9112572 '3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675'
Assert-Pin $pwsh 301368 'db6dd81183fe57d22e03b911ec9a30a2fd7c40542e97743615355a6fb44f458f'
Assert-Pin $git 43352 '78211c7ed73988da93a6d8a33d47ec6187f464d7ea2a9a00c182bbd7a1ecf30f'
$actualHead = (& $git --no-optional-locks -C $worktree rev-parse HEAD | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $actualHead -cne $head) { throw 'CURRENT_HEAD_MISMATCH' }

$g01 = Read-JsonPin 'E:\DEV\Weltraum-Spiel\TARGET_PC\G01_APP_INSTALL_R01_ROOT_ACCEPTANCE-20261021.json'
if ($g01.json.status -cne 'ISOLATED_INSTALL_FILE_QUALIFICATION_ACCEPTED' -or $g01.json.actual.app -cne $app -or $g01.json.actual.status -cne 'COMPLETED_A0_IDLE_ROOT_INDEPENDENTLY_OBSERVED' -or
    $g01.json.actual.withinActualAppDeadline -ne $true -or $g01.json.registryPackages -ne 60 -or $g01.json.localLinks -ne 1) { throw 'G01_ACCEPTANCE_MISMATCH' }
foreach ($dir in @(
    'C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime\benni-pc-g01-app-install-r01',
    'C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime\benni-pc-g01-app-install-once-r01'
)) { if (-not (Test-Path -LiteralPath $dir -PathType Container)) { throw "G01_TARGET_MISSING:$dir" } }

$m5Path = 'C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime\benni-pc-m5-prestart-diagnostics-source-r01\PRESERVATION_BEFORE.json'
Assert-Pin $m5Path 10390 'cbafbabda4dc344193f82b69e66cf6851f9ec0ac903eff671a3319064065063f'
$m5 = (Read-JsonPin $m5Path).json
if (@($m5.copies).Count -ne 5 -or @($m5.runtimeSlots).Count -ne 8) { throw 'M5_COUNT_MISMATCH' }
foreach ($copy in $m5.copies) { Assert-Pin $copy.path $copy.bytes $copy.sha256 }
foreach ($slot in $m5.runtimeSlots) { if ($slot.exists -ne $false -or (Test-Path -LiteralPath $slot.path)) { throw "M5_SLOT_PRESENT:$($slot.path)" } }

foreach ($root in @(
    (Join-Path $worktree '.a0-runtime\benni-pc-core-material-poison-ast-once-r01'),
    (Join-Path $worktree '.a0-runtime\benni-pc-core-material-poison-ast-once-r02'),
    (Join-Path $worktree '.a0-runtime\benni-pc-core-material-poison-ast-once-r03'),
    $evidenceRoot
)) { if (Test-Path -LiteralPath $root) { throw "AST_ROOT_ALREADY_EXISTS:$root" } }
if ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge [long]$ready.json.appDeadlineEpochMs) { throw 'DEADLINE_BEFORE_COPY' }
[IO.Directory]::CreateDirectory($evidenceRoot) | Out-Null
$recorderSource = Join-Path $sourceRoot 'Run-Check.ps1'
$recorderTarget = Join-Path $evidenceRoot 'Run-Check.ps1'
$copyBytes = [IO.File]::ReadAllBytes($recorderSource)
$copyStream = [IO.File]::Open($recorderTarget, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
try { $copyStream.Write($copyBytes, 0, $copyBytes.Length); $copyStream.Flush($true) } finally { $copyStream.Dispose() }
$copyReadback = [IO.File]::ReadAllBytes($recorderTarget)
$recorderSha = (Get-FileHash -LiteralPath $recorderTarget -Algorithm SHA256).Hash.ToLowerInvariant()
if ($copyReadback.Length -ne 3295 -or $recorderSha -cne 'e5d5f7ee00e7a6d3b7f14d240c5ff133c44e4230b87a99a3a543efdc8a8f6abe' -or
    [Convert]::ToBase64String($copyReadback) -cne [Convert]::ToBase64String($copyBytes)) { throw 'RECORDER_COPY_MISMATCH' }
$beforeRecorder = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
if ($beforeRecorder + 60000 -gt [long]$ready.json.appDeadlineEpochMs) { throw 'INSUFFICIENT_APP_BUDGET_BEFORE_RECORDER' }
[Environment]::SetEnvironmentVariable('NODE_COMPILE_CACHE', $null, 'Process')
& $recorderTarget -Label 'CORE_MATERIAL_POISON_AST' -Exe $node -CheckArgs @((Join-Path $sourceRoot 'ast-check.cjs'))

$receiptPin = Read-JsonPin (Join-Path $evidenceRoot 'evidence\CORE_MATERIAL_POISON_AST.json')
$receipt = $receiptPin.json
if ($receipt.label -cne 'CORE_MATERIAL_POISON_AST' -or $receipt.terminal -ne $true -or $receipt.exitCode -ne 0 -or $receipt.expectedExit -ne 0 -or
    $receipt.stdoutEof -ne $true -or $receipt.stderrEof -ne $true -or $receipt.safeHandleClosed -ne $true -or $receipt.elapsedMs -gt 60000 -or
    $receipt.passed -ne $true -or $null -ne $receipt.failure) { throw 'PROCESS_RECEIPT_FAILED' }
$stdout = $receipt.stdout | ConvertFrom-Json -AsHashtable
if ($stdout.status -cne 'PASS_STATIC_ONLY' -or $stdout.compiler -cne '5.9.3' -or $stdout.parseErrors -ne 0 -or
    $stdout.firstAcquireStatementSameExistingPoisonGuard -ne $true -or $stdout.remainingAcquireUnchanged -ne $true -or
    $stdout.allOtherFactoryMembersUnchanged -ne $true -or $stdout.existingTestCountUnchanged -ne $true -or
    $stdout.extendedCases -ne 1 -or $stdout.addedCaseStatements -ne 5 -or $stdout.productImports -ne $false -or
    $stdout.methodsExecuted -ne $false -or $stdout.tests -cne 'NOT_RUN' -or $stdout.reproduction -cne 'NOT_RUN') { throw 'CHECKER_STDOUT_MISMATCH' }
if ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge [long]$ready.json.appDeadlineEpochMs) { throw 'DEADLINE_BEFORE_A0_RESULT' }
$controlPins = @($task, $approval, $initial, $consumption, $ready) | ForEach-Object { [ordered]@{ path = $_.path; bytes = $_.bytes; sha256 = $_.sha256 } }
$result = [ordered]@{
    schema = 'hestia.core-material-poison-ast-r04-a0-result.v1'; status = 'PASS_STATIC_ONLY'; turnId = $TurnId
    ownerApp = $app; cwd = $worktree; head = $head; actualStartEpochMs = $actualStartMs; appDeadlineEpochMs = [long]$ready.json.appDeadlineEpochMs
    payloadInvocationCount = 1; toolExitCode = 0; sourcePinsPassed = 6; m5CopyPinsPassed = 5; m5AbsentSlotsPassed = 8
    g01Accepted = $true; recorderCopyReadbackPassed = $true; recorderBytes = $copyReadback.Length; recorderSha256 = $recorderSha
    controlFiles = $controlPins; receipt = [ordered]@{ path = $receiptPin.path; bytes = $receiptPin.bytes; sha256 = $receiptPin.sha256; elapsedMs = $receipt.elapsedMs }
    sourcePins = $template.json.fixedReviewPins.sixSourcePins; g01 = [ordered]@{ path = $g01.path; bytes = $g01.bytes; sha256 = $g01.sha256 }
    m5 = [ordered]@{ path = $m5Path; bytes = 10390; sha256 = 'cbafbabda4dc344193f82b69e66cf6851f9ec0ac903eff671a3319064065063f'; copyPins = 5; absentSlots = 8 }
    checker = $stdout; tests = 'NOT_RUN'; reproduction = 'NOT_RUN'; productAdoption = 'NOT_RUN'
}
$resultPin = Write-NewJson (Join-Path $evidenceRoot 'evidence\CORE_MATERIAL_POISON_AST_A0_RESULT.json') $result
[pscustomobject]@{ status = $result.status; path = $resultPin.path; bytes = $resultPin.bytes; sha256 = $resultPin.sha256 } | ConvertTo-Json -Compress
