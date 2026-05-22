$ErrorActionPreference = "Stop"

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\..")
$logsRoot = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $logsRoot | Out-Null

$buildLog = Join-Path $logsRoot "verify-ship-blueprint-builder-dotnet-build.log"
$testLog = Join-Path $logsRoot "verify-ship-blueprint-builder-dotnet-test.log"
$unityEvidence = Join-Path $PSScriptRoot "unity-results\blueprint-editmode-mcp-2026-05-22.txt"

Push-Location $workspaceRoot
try {
    dotnet build "Weltraum Spiel.sln" --no-restore -v:minimal *> $buildLog
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet build failed; see $buildLog"
    }

    dotnet test "Weltraum Spiel.sln" --no-build -v:minimal --filter "FullyQualifiedName~PrototypeShipBlueprintBuilderValidationTests" *> $testLog
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet test failed; see $testLog"
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $unityEvidence)) {
    throw "Unity evidence file missing: $unityEvidence"
}

$unityText = Get-Content -LiteralPath $unityEvidence -Raw
if ($unityText -notmatch "Result:\s*Passed" -or $unityText -notmatch "passed=5" -or $unityText -notmatch "failed=0") {
    throw "Unity evidence file does not prove a passing 5-test run: $unityEvidence"
}

Write-Output "Ship blueprint builder verification PASS"
