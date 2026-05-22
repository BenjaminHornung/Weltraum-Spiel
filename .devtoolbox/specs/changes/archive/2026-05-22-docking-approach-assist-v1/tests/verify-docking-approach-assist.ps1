param(
    [string]$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
)

$ErrorActionPreference = 'Stop'

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host "== $Name =="
    & $Command
    if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

$solution = Join-Path $WorkspaceRoot 'Weltraum Spiel.sln'
$assistScript = Join-Path $WorkspaceRoot 'Assets\Scripts\Prototype\PrototypeDockingApproachAssist.cs'
$protocol = Join-Path $WorkspaceRoot '.devtoolbox\specs\changes\docking-approach-assist-v1\tests\test-protocol.md'

if (-not (Test-Path -LiteralPath $solution)) {
    throw "Missing solution at $solution"
}

if (-not (Test-Path -LiteralPath $assistScript)) {
    throw "Missing docking assist script at $assistScript"
}

if (-not (Test-Path -LiteralPath $protocol)) {
    throw "Missing test protocol at $protocol"
}

$forbiddenAssignments = Select-String -LiteralPath $assistScript -Pattern '\b(position|velocity|linearVelocity|angularVelocity)\s*='
if ($forbiddenAssignments) {
    $forbiddenAssignments | ForEach-Object { Write-Host $_.Line }
    throw 'Docking assist runtime contains a forbidden direct position/velocity assignment.'
}

Invoke-Step 'dotnet build' {
    dotnet build $solution --no-restore
}

Invoke-Step 'focused dotnet test' {
    dotnet test $solution --no-build --filter 'FullyQualifiedName~DockingApproachAssist|FullyQualifiedName~DockingPort|FullyQualifiedName~BootstrapBindsPlayerHudCanvasSeparateFromPrototypeWindows|FullyQualifiedName~DockingSnapshotTranslatesEligibilityAndProtectsHardLockPlaceholder'
}

$protocolText = Get-Content -LiteralPath $protocol -Raw
foreach ($required in @(
    '32343285a72e4f0c80d2eca8286cf789',
    'Passed 10/10',
    'No matches in the runtime assist component',
    'verify_fresh'
)) {
    if ($protocolText -notlike "*$required*") {
        throw "Test protocol missing required evidence: $required"
    }
}

Write-Host 'Docking approach assist verification passed.'
