$ErrorActionPreference = 'Stop'
$worktree = 'C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13'
$source = Join-Path $worktree '.a0-runtime\benni-pc-core-material-poison-source-r01'
$taskPath = 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R02_EXECUTION_TASK-20261021.json'
$g01AcceptancePath = 'E:\DEV\Weltraum-Spiel\TARGET_PC\G01_APP_INSTALL_R01_ROOT_ACCEPTANCE-20261021.json'
$node = 'C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-other-pc-restored\Tooling\PortableNode\node.exe'
$compiler = 'C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\rt08-build-toolchain\node_modules\typescript\lib\typescript.js'
$pwsh = 'C:\IFI_SourceCode\Utils\PowerShell\pwsh.exe'
$evidence = Join-Path $worktree '.a0-runtime\benni-pc-core-material-poison-ast-once-r04'
$expectedPins = @(
    @{ relative = 'apps/weltraum-browser/src/render/three/backend/threeMaterialFactory.ts'; bytes = 5172; sha256 = 'fd0658244e613c684b1ecced904ad9ec4d6b823953490bd322cf12a572295542' },
    @{ relative = 'apps/weltraum-browser/tests/unit/renderBackendLifecycle.test.ts'; bytes = 44944; sha256 = '6ab4b4d0acb0160411e651106ac8ee1a60cd13c960d5f3ea8a8cbd18ab2473d1' },
    @{ relative = '.a0-runtime/benni-pc-core-material-poison-source-r01/ast-check.cjs'; bytes = 3458; sha256 = 'bba66c6a51ba19aea9c848251f7122e5ca883333dde103d273b3c4778abe0cd7' },
    @{ relative = '.a0-runtime/benni-pc-core-material-poison-source-r01/Run-Check.ps1'; bytes = 3295; sha256 = 'e5d5f7ee00e7a6d3b7f14d240c5ff133c44e4230b87a99a3a543efdc8a8f6abe' },
    @{ relative = '.a0-runtime/benni-pc-core-material-poison-source-r01/before/threeMaterialFactory.ts'; bytes = 5114; sha256 = '9b259862c6534691773e2a7f7df7ed5c4696491243535844f69af84240fb1a6d' },
    @{ relative = '.a0-runtime/benni-pc-core-material-poison-source-r01/before/renderBackendLifecycle.test.ts'; bytes = 44455; sha256 = '23c796f32c182cc5ec0ca5ad3b200911d40dfe97d5f2ec430b3f8e9f73d651c9' }
)
function Assert-Pin([string]$Path, [long]$Bytes, [string]$Sha256) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "REQUIRED_FILE_MISSING: $Path" }
    $item = Get-Item -LiteralPath $Path
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($item.Length -ne $Bytes -or $actual -cne $Sha256) { throw "REQUIRED_FILE_PIN_MISMATCH: $Path" }
}
if (-not (Test-Path -LiteralPath $worktree -PathType Container)) { throw 'SAME_A0_WORKTREE_MISSING' }
$task = Get-Content -LiteralPath $taskPath -Raw | ConvertFrom-Json -AsHashtable
if ($task.schema -cne 'hestia.core-material-poison-ast-r02-once-task.v1' -or
    $task.status -cne 'PREPARED_NOT_AUTHORIZED_R01_SPENT_NO_RETRY' -or
    $task.ownerApp -cne '01a13648-c55b-7250-bf07-34921d70b43b' -or
    $task.ownerPaseo -cne '58fc7970-b84f-485d-8cd0-e577205823e9' -or
    $task.worktree -cne $worktree -or $task.head -cne '6ac0f61947c5a6aa3e5b156831542d8188c75c0a' -or
    @($task.pins).Count -ne $expectedPins.Count) { throw 'REVIEWED_TASK_IDENTITY_OR_SCOPE_MISMATCH' }
for ($i = 0; $i -lt $expectedPins.Count; $i++) {
    $pin = $expectedPins[$i]
    if ($task.pins[$i].relative -cne $pin.relative -or $task.pins[$i].bytes -ne $pin.bytes -or
        $task.pins[$i].sha256 -cne $pin.sha256) { throw "TASK_PIN_ROW_MISMATCH: $i" }
    $full = [IO.Path]::GetFullPath((Join-Path $worktree $pin.relative))
    $prefix = [IO.Path]::GetFullPath($worktree).TrimEnd('\') + '\'
    if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "TASK_PATH_ESCAPES_WORKTREE: $($pin.relative)" }
    Assert-Pin $full $pin.bytes $pin.sha256
}
if ($task.node.path -cne $node -or $task.node.version -cne '22.23.2' -or
    $task.node.sha256 -cne '0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4') { throw 'NODE_BINDING_MISMATCH' }
Assert-Pin $node 86997320 '0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4'
if ($task.compiler.path -cne $compiler -or $task.compiler.version -cne '5.9.3' -or
    $task.compiler.sha256 -cne '3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675') { throw 'COMPILER_BINDING_MISMATCH' }
Assert-Pin $compiler 9112572 '3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675'
$g01 = Get-Content -LiteralPath $g01AcceptancePath -Raw | ConvertFrom-Json -AsHashtable
if ($g01.status -cne 'ISOLATED_INSTALL_FILE_QUALIFICATION_ACCEPTED' -or
    $g01.actual.app -cne '01a13648-c55b-7250-bf07-34921d70b43b' -or
    $g01.actual.status -cne 'COMPLETED_A0_IDLE_ROOT_INDEPENDENTLY_OBSERVED' -or
    $g01.actual.withinActualAppDeadline -ne $true -or $g01.actual.freezeIsAppEnd -ne $false -or
    $g01.registryPackages -ne 60 -or $g01.localLinks -ne 1 -or $g01.npmCiAttempts -ne 1) { throw 'G01_TERMINAL_BASELINE_MISMATCH' }
foreach ($requiredDirectory in @(
    $worktree,
    $source,
    (Split-Path -Parent $node),
    (Split-Path -Parent $compiler),
    (Split-Path -Parent $pwsh),
    (Join-Path $worktree '.a0-runtime\benni-pc-g01-app-install-r01'),
    (Join-Path $worktree '.a0-runtime\benni-pc-g01-app-install-once-r01')
)) {
    if (-not (Test-Path -LiteralPath $requiredDirectory -PathType Container)) { throw "REQUIRED_DIRECTORY_MISSING: $requiredDirectory" }
}
foreach ($spentOrFutureRoot in @(
    (Join-Path $worktree '.a0-runtime\benni-pc-core-material-poison-ast-once-r01'),
    (Join-Path $worktree '.a0-runtime\benni-pc-core-material-poison-ast-once-r02'),
    (Join-Path $worktree '.a0-runtime\benni-pc-core-material-poison-ast-once-r03'),
    $evidence
)) {
    if (Test-Path -LiteralPath $spentOrFutureRoot) { throw "SPENT_OR_FUTURE_AST_OUTPUT_ALREADY_EXISTS: $spentOrFutureRoot" }
}
$recorderText = Get-Content -LiteralPath (Join-Path $source 'Run-Check.ps1') -Raw
$checkerText = Get-Content -LiteralPath (Join-Path $source 'ast-check.cjs') -Raw
foreach ($requiredText in @(
    '$PSScriptRoot',
    'WorkingDirectory=$PSScriptRoot',
    'ArgumentList.Add',
    "Environment.Remove('NODE_OPTIONS')",
    "Environment.Remove('NODE_V8_COVERAGE')",
    '[IO.FileMode]::CreateNew',
    '48000',
    '59000',
    '60000'
)) {
    if (-not $recorderText.Contains($requiredText)) { throw "RECORDER_SOURCE_CONTRACT_MISSING: $requiredText" }
}
foreach ($requiredText in @(
    "path.resolve(__dirname, '../..')",
    "path.join(__dirname, 'before/threeMaterialFactory.ts')",
    "path.join(__dirname, 'before/renderBackendLifecycle.test.ts')",
    'rt08-build-toolchain/node_modules/typescript/lib/typescript.js',
    'require(compiler)'
)) {
    if (-not $checkerText.Contains($requiredText)) { throw "CHECKER_SOURCE_CONTRACT_MISSING: $requiredText" }
}
if ($checkerText -match 'process\.(env|argv)') { throw 'CHECKER_HAS_UNBOUND_PROCESS_INPUT' }
$pwshItem = Get-Item -LiteralPath $pwsh
Assert-Pin $pwsh 301368 'db6dd81183fe57d22e03b911ec9a30a2fd7c40542e97743615355a6fb44f458f'
$expectedTaskSha = '97216b3fd6e13e80637a7b62079e092311c5f5360d20faf15c78158ca1a90d3c'
$actualTaskSha = (Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualTaskSha -cne $expectedTaskSha) { throw 'REVIEWED_R02_TASK_BYTES_CHANGED' }
$templatePath = 'E:\DEV\Weltraum-Spiel\TARGET_PC\ROOT_AST_CRITICAL_CONTROLLER_SOURCE-20261021\R04_TEMPLATE.json'
$expectedTemplateSha = '4955f76a7b6cb2981533451c2044020d4891ed3e1eae1726d73263abb808968a'
$templateSha = (Get-FileHash -LiteralPath $templatePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($templateSha -cne $expectedTemplateSha) { throw 'R04_TEMPLATE_BYTES_CHANGED' }
$template = Get-Content -LiteralPath $templatePath -Raw | ConvertFrom-Json -AsHashtable
$templateStatus = 'PREPARED_SOURCE_ONLY_NO_CURRENT_AUTHORITY'
$templateScope = 'ONE_QUALIFIED_NODE_PROCESS_STATIC_AST_PARSING_AND_SCOPE_DIFF_ONLY_NO_PRODUCT_IMPORT_METHOD_OR_TEST_EXECUTION'
if ($template.schema -cne 'hestia.core-material-poison-ast-next-task-template.v1' -or
    $template.status -cne $templateStatus -or $template.attempt -cne 'CORE_MATERIAL_POISON_AST_R04' -or
    $template.scope -cne $templateScope -or
    $template.owner.app -cne '01a13648-c55b-7250-bf07-34921d70b43b' -or
    $template.owner.paseoAgent -cne '58fc7970-b84f-485d-8cd0-e577205823e9' -or
    $template.owner.worktree -cne $worktree -or $template.owner.head -cne '6ac0f61947c5a6aa3e5b156831542d8188c75c0a' -or
    $template.fixedReviewPins.taskSource -cne $taskPath -or
    $template.fixedReviewPins.expectedTaskSha256 -cne $expectedTaskSha -or
    @($template.fixedReviewPins.sixSourcePins).Count -ne 6) { throw 'R04_TEMPLATE_SCHEMA_OWNER_OR_R02_LINK_MISMATCH' }
for ($i = 0; $i -lt $expectedPins.Count; $i++) {
    $a = $expectedPins[$i]; $b = $template.fixedReviewPins.sixSourcePins[$i]
    if ($a.relative -cne $b.relative -or $a.bytes -ne $b.bytes -or $a.sha256 -cne $b.sha256) { throw "R04_TEMPLATE_SOURCE_PIN_MISMATCH: $i" }
}
$future = $template.futureAttempt
$expectedEvidence = Join-Path $worktree '.a0-runtime\benni-pc-core-material-poison-ast-once-r04'
$expectedRecorder = Join-Path $source 'Run-Check.ps1'
$expectedChecker = Join-Path $source 'ast-check.cjs'
$expectedPayload = '$ErrorActionPreference=''Stop'';[Environment]::SetEnvironmentVariable(''NODE_COMPILE_CACHE'',$null,''Process'');& ''' +
    $expectedEvidence + '\Run-Check.ps1'' -Label ''CORE_MATERIAL_POISON_AST'' -Exe ''' + $node +
    ''' -CheckArgs @(''' + $expectedChecker + ''')'
if ($future.evidenceRoot -cne $expectedEvidence -or $future.recorderSource -cne $expectedRecorder -or
    $future.checkerAbsolute -cne $expectedChecker -or $future.checkerCwd -cne $expectedEvidence -or
    $future.evidenceReceipt -cne 'evidence\CORE_MATERIAL_POISON_AST.json' -or
    $future.exactPayloadCommand -cne $expectedPayload -or $future.workBudgetMs -ne 48000 -or
    $future.totalBudgetMs -ne 60000 -or $future.maxActualAppTurnMs -ne 600000 -or
    $future.readOnlyBindingWaitMs -ne 90000 -or $future.initialConsumptionFile -cne 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R04_INITIAL_CONSUMED-20261021.json' -or
    $future.finalExecutionTaskFile -cne 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R04_FINAL_EXECUTION_TASK-20261021.json' -or
    $future.directHumanApprovalFile -cne 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R04_HUMAN_APPROVAL-20261021.json' -or
    $future.finalGrantConsumptionFile -cne 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R04_GRANT_CONSUMED-20261021.json' -or
    $future.rootReadyFile -cne 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R04_ROOT_READY-20261021.json' -or
    $future.rootReadyPendingFile -cne 'E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R04_ROOT_READY-20261021.json.pending' -or
    $future.stop -cne 'FIRST_ERROR_INCLUDING_ROOT_AND_A0_PREPARATION_STOP_NO_RETRY_NO_FALLBACK_PRESERVE_PARTIAL_EVIDENCE') { throw 'R04_FUTURE_PATH_COMMAND_OR_BUDGET_MISMATCH' }
$a0RunOncePath = 'E:\DEV\Weltraum-Spiel\TARGET_PC\ROOT_AST_CRITICAL_CONTROLLER_SOURCE-20261021\R04_A0_RUN_ONCE.ps1'
if ($future.a0RunOnceSource.path -cne $a0RunOncePath -or $future.a0RunOnceSource.bytes -ne 12926 -or
    $future.a0RunOnceSource.sha256 -cne 'e8a65aca5845b8a042a8e1908eef03d5e04fc59c68504ca4a1fffc88b6964bfd') { throw 'A0_RUN_ONCE_TEMPLATE_PIN_MISMATCH' }
Assert-Pin $a0RunOncePath 12926 'e8a65aca5845b8a042a8e1908eef03d5e04fc59c68504ca4a1fffc88b6964bfd'
$a0Tokens = $null; $a0ParseErrors = $null
[Management.Automation.Language.Parser]::ParseFile($a0RunOncePath, [ref]$a0Tokens, [ref]$a0ParseErrors) | Out-Null
if (@($a0ParseErrors).Count -ne 0) { throw 'A0_RUN_ONCE_POWERSHELL_PARSE_FAILED' }
if ($template.directHumanAuthority.source -cne 'NONE' -or
    $template.directHumanAuthority.questionItemId -ne $null -or
    $template.directHumanAuthority.answer -ne $null -or
    $template.directHumanAuthority.initialConsumptionCreated -ne $false -or
    $template.directHumanAuthority.finalTaskCreated -ne $false -or
    $template.directHumanAuthority.finalApprovalCreated -ne $false -or
    $template.directHumanAuthority.finalConsumptionCreated -ne $false -or
    $template.directHumanAuthority.rootReadyCreated -ne $false) { throw 'R04_TEMPLATE_CONTAINS_CURRENT_AUTHORITY' }
$spentInitial='E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R03_INITIAL_CONSUMED-20261021.json'
$spentStop='E:\DEV\Weltraum-Spiel\TARGET_PC\CORE_MATERIAL_POISON_AST_R03_ROOT_STOP-20261021.json'
Assert-Pin $spentInitial 887 '599a312eac120fd67fbde34a0764be372571801eacaea31eec5fc285eba6ab67'
Assert-Pin $spentStop 1773 '684820da0cb3940b1e7f6439d8db63394af3d9a3ec5d295716d8b0f9e0c09623'
if($template.spentR03.questionCallId-cne'call_cf1f33842b8b4ec0ab389519c038342b'-or$template.spentR03.answerToken-cne'JA_CORE_MATERIAL_POISON_AST_R03_ONCE'-or$template.spentR03.status-cne'SPENT_NO_R04_AUTHORITY'){throw 'R03_SPENT_BINDING_MISMATCH'}
$futureControlFiles = @(
    $future.initialConsumptionFile, $future.finalExecutionTaskFile, $future.directHumanApprovalFile,
    $future.finalGrantConsumptionFile, $future.rootReadyFile, $future.rootReadyPendingFile
)
foreach ($futureFile in $futureControlFiles) {
    $parentPath = Split-Path -Parent $futureFile
    if (-not (Test-Path -LiteralPath $parentPath -PathType Container)) { throw "FUTURE_CONTROL_PARENT_MISSING: $parentPath" }
    if (Test-Path -LiteralPath $futureFile) { throw "R04_FUTURE_CONTROL_FILE_ALREADY_EXISTS: $futureFile" }
    if ([IO.Path]::GetFileName($futureFile) -match 'R0[12]') { throw "OLD_ATTEMPT_FILE_REUSED: $futureFile" }
}
if (-not (Test-Path -LiteralPath (Split-Path -Parent $expectedEvidence) -PathType Container) -or
    (Test-Path -LiteralPath $expectedEvidence)) { throw 'R04_EVIDENCE_PARENT_OR_ABSENCE_MISMATCH' }
if (-not (Test-Path -LiteralPath (Split-Path -Parent $expectedRecorder) -PathType Container) -or
    -not (Test-Path -LiteralPath $expectedChecker -PathType Leaf)) { throw 'R04_SOURCE_PARENT_OR_CHECKER_MISSING' }
$m5Baseline = $template.futureAttempt.m5PreservationBaseline
$expectedM5Path = Join-Path $source '..\benni-pc-m5-prestart-diagnostics-source-r01\PRESERVATION_BEFORE.json'
$expectedM5Path = [IO.Path]::GetFullPath($expectedM5Path)
if ($m5Baseline.path -cne $expectedM5Path -or $m5Baseline.bytes -ne 10390 -or
    $m5Baseline.sha256 -cne 'cbafbabda4dc344193f82b69e66cf6851f9ec0ac903eff671a3319064065063f' -or
    $m5Baseline.requiredCopyPins -ne 5 -or @($m5Baseline.absentSlots).Count -ne 8) { throw 'M5_BASELINE_TEMPLATE_BINDING_MISMATCH' }
Assert-Pin $m5Baseline.path 10390 'cbafbabda4dc344193f82b69e66cf6851f9ec0ac903eff671a3319064065063f'
$m5 = Get-Content -LiteralPath $m5Baseline.path -Raw | ConvertFrom-Json -AsHashtable
if (@($m5.copies).Count -ne 5 -or @($m5.runtimeSlots).Count -ne 8) { throw 'M5_BASELINE_COPY_OR_SLOT_COUNT_MISMATCH' }
foreach ($copy in $m5.copies) { Assert-Pin $copy.path $copy.bytes $copy.sha256 }
$m5ArtifactRoot = 'C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13'
foreach ($slot in $m5.runtimeSlots) {
    $leaf = [IO.Path]::GetFileName($slot.path)
    if ($slot.exists -ne $false -or $slot.path -cne (Join-Path $m5ArtifactRoot $leaf) -or
        $leaf -notin $m5Baseline.absentSlots -or (Test-Path -LiteralPath $slot.path)) { throw "M5_SLOT_NOT_ABSENT_OR_PINNED: $($slot.path)" }
}
if (@($m5Baseline.absentSlots | Where-Object { $_ -notin @($m5.runtimeSlots | ForEach-Object { [IO.Path]::GetFileName($_.path) }) }).Count -ne 0) { throw 'M5_TEMPLATE_SLOT_SET_MISMATCH' }
$gitExe = 'C:\Program Files\Git\cmd\git.exe'
Assert-Pin $gitExe 43352 '78211c7ed73988da93a6d8a33d47ec6187f464d7ea2a9a00c182bbd7a1ecf30f'
$gitHead = (& $gitExe --no-optional-locks -C $worktree rev-parse HEAD | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $gitHead -cne '6ac0f61947c5a6aa3e5b156831542d8188c75c0a') { throw 'CURRENT_A0_GIT_HEAD_MISMATCH' }
$worksheetPath = 'E:\DEV\Weltraum-Spiel\TARGET_PC\ROOT_AST_CRITICAL_CONTROLLER_SOURCE-20261021\R04_EXEC_CELLS.md'
$worksheetText = Get-Content -LiteralPath $worksheetPath -Raw
if (-not $worksheetText.Contains($expectedTemplateSha)) { throw 'WORKSHEET_TEMPLATE_HASH_BINDING_MISSING' }
$result = [ordered]@{
    schema = 'hestia.root-ast-preparation.readiness.v1'
    status = 'SOURCE_PREPARATION_ONLY_NO_RUNTIME_AUTHORITY'
    observedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    pinnedInputsChecked = $expectedPins.Count
    nodeBytesChecked = 86997320
    compilerBytesChecked = 9112572
    powershellHost = [ordered]@{ path = $pwsh; bytes = $pwshItem.Length; version = $pwshItem.VersionInfo.FileVersion; sha256 = 'db6dd81183fe57d22e03b911ec9a30a2fd7c40542e97743615355a6fb44f458f' }
    g01Baseline = 'ACCEPTED_COMPLETED_APP_TURN_INSTALL_TARGETS_PRESENT'
    previousAstOutputsAbsent = 4
    recorderAndCheckerPins = 'PASS'
    r02TaskSha256 = $actualTaskSha
    r04TemplateSha256 = $templateSha
    worksheetTemplateHashBinding = 'PASS'
    currentA0Head = $gitHead
    readOnlyGit = [ordered]@{ path = $gitExe; bytes = 43352; sha256 = '78211c7ed73988da93a6d8a33d47ec6187f464d7ea2a9a00c182bbd7a1ecf30f'; noOptionalLocks = $true }
    m5CopyPinsChecked = @($m5.copies).Count
    m5AbsentSlotsChecked = @($m5.runtimeSlots).Count
    r04FutureControlFilesAbsent = $futureControlFiles.Count
    ownerTurnDeadline = 'FUTURE_ACTUAL_READ_ONLY_BINDING_REQUIRED'
    freshHumanAuthority = 'NONE'
    nodeProcesses = 0
    payloadExecutions = 0
    testStarts = 0
}
$result | ConvertTo-Json -Depth 5

