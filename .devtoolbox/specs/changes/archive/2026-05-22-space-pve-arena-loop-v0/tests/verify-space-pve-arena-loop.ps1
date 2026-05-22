Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$changeRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Resolve-Path (Join-Path $changeRoot '..\..\..\..')
$logsRoot = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $logsRoot | Out-Null

Push-Location $workspaceRoot
try {
    $buildLog = Join-Path $logsRoot 'verify-space-pve-dotnet-build.log'
    & dotnet build 'Weltraum Spiel.sln' --no-restore -v:minimal *> $buildLog
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet build failed with exit code $LASTEXITCODE. See $buildLog"
    }

    $testLog = Join-Path $logsRoot 'verify-space-pve-dotnet-test.log'
    & dotnet test 'Weltraum Spiel.sln' --no-build -v:minimal --filter 'FullyQualifiedName~PrototypePveArenaLoopValidationTests' *> $testLog
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet test failed with exit code $LASTEXITCODE. See $testLog"
    }

    $protocolPath = Join-Path $PSScriptRoot 'test-protocol.md'
    $protocol = Get-Content -LiteralPath $protocolPath -Raw
    if ($protocol -notmatch 'c2c91703f03f443cb7e3f9a2632ca4ec' -or $protocol -notmatch '8 total, 8 passed') {
        throw "Unity EditMode 8/8 evidence is missing from $protocolPath"
    }

    Write-Host 'space-pve-arena-loop-v0 verification passed.'
    Write-Host "Build log: $buildLog"
    Write-Host "Test log: $testLog"
}
finally {
    Pop-Location
}
