$ErrorActionPreference = 'Stop'

$testsRoot = $PSScriptRoot
$workspaceRoot = (Resolve-Path (Join-Path $testsRoot '..\..\..\..\..')).Path
$logsRoot = Join-Path $testsRoot 'logs'
New-Item -ItemType Directory -Force -Path $logsRoot | Out-Null

Push-Location $workspaceRoot
try {
    $buildLog = Join-Path $logsRoot 'verify-runtime-hardpoints-dotnet-build.log'
    & dotnet build "Weltraum Spiel.sln" --no-restore -v:quiet *> $buildLog
    if ($LASTEXITCODE -ne 0) {
        Get-Content -Path $buildLog
        exit $LASTEXITCODE
    }

    $testLog = Join-Path $logsRoot 'verify-runtime-hardpoints-dotnet-test.log'
    & dotnet test "Weltraum Spiel.sln" --no-build -v:quiet *> $testLog
    if ($LASTEXITCODE -ne 0) {
        Get-Content -Path $testLog
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}

$unityResultsPath = Join-Path $testsRoot 'hardpoints-editmode-api-2026-05-22.xml'
if (-not (Test-Path -LiteralPath $unityResultsPath)) {
    throw "Unity hardpoint EditMode result XML is missing: $unityResultsPath"
}

[xml]$unityResults = Get-Content -LiteralPath $unityResultsPath
$testRun = $unityResults.'test-run'
if ($testRun.result -ne 'Passed' -or [int]$testRun.total -ne 11 -or [int]$testRun.failed -ne 0) {
    throw "Unity hardpoint EditMode result was not the expected 11/11 pass."
}

Write-Output 'Runtime hardpoint verification PASS'
